<script setup lang="ts">
import type { HomeApi } from '#/api/home';

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { usePublicSiteTheme } from '#/composables/use-public-site-theme';
import { $t } from '#/locales';
import {
  certifyHomeStatValue,
  numericHomeStat,
  resolveHomeStatAvailability,
} from '#/views/home/home-metrics';

const props = withDefaults(
  defineProps<{
    failed?: boolean;
    loading?: boolean;
    stats?: HomeApi.PlatformStats;
  }>(),
  { failed: false, loading: false, stats: undefined },
);

const { siteThemeVars } = usePublicSiteTheme();

interface StatItem {
  count?: number;
  decimal: number;
  key: string;
  label: string;
  suffix?: string;
  sub: string;
}

const statsEl = ref<HTMLElement>();
let countObserver: IntersectionObserver | undefined;

// The backend stamps every overview response with an analytics verdict. When it
// cannot certify a traffic metric it names the field in `unavailableFields`, and
// that metric must render as unavailable instead of as a real zero.
const availability = computed(() => resolveHomeStatAvailability(props.stats));
const unavailableHint = computed(() =>
  $t('page.public.home.v3.stats.unavailable'),
);

function metricCount(
  field: Parameters<typeof certifyHomeStatValue>[0],
  value: number | string | undefined,
) {
  return numericHomeStat(certifyHomeStatValue(field, value, availability.value));
}

function metricSub(
  field: Parameters<typeof certifyHomeStatValue>[0],
  fallback: string,
) {
  return availability.value.available[field] ? fallback : unavailableHint.value;
}

const statItems = computed<StatItem[]>(() => {
  const stats = props.stats;
  const certifiedAvailability = certifyHomeStatValue(
    'availabilityPercent',
    stats?.availabilityPercent,
    availability.value,
  );
  const availabilitySource = stats?.availabilitySource;
  return [
    {
      count: metricCount('enabledApiTotal', stats?.enabledApiTotal),
      decimal: 0,
      key: 'apis',
      label: $t('page.public.home.v3.stats.apis'),
      sub: metricSub(
        'enabledApiTotal',
        $t('page.public.home.v3.stats.apisMeta'),
      ),
    },
    {
      count: metricCount('calls24h', stats?.calls24h),
      decimal: 0,
      key: 'calls',
      label: $t('page.public.home.v3.stats.calls'),
      sub: metricSub('calls24h', $t('page.public.home.v3.stats.callsMeta')),
    },
    {
      count: numericHomeStat(certifiedAvailability),
      decimal: 2,
      key: 'availability',
      label: $t('page.public.home.v3.stats.availability'),
      suffix: '%',
      sub: metricSub(
        'availabilityPercent',
        availabilitySource
          ? $t('page.public.home.v3.stats.availabilitySource', [
              availabilitySource,
            ])
          : $t('page.public.home.v3.stats.availabilityMeta'),
      ),
    },
    {
      count: metricCount('peakQps24h', stats?.peakQps24h),
      decimal: 0,
      key: 'peakQps',
      label: $t('page.public.home.v3.stats.peakQps'),
      sub: metricSub(
        'peakQps24h',
        $t('page.public.home.v3.stats.peakQpsMeta'),
      ),
    },
  ];
});

const placeholder = '—';

onMounted(() => {
  if (typeof IntersectionObserver === 'undefined') return;
  countObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        countObserver?.unobserve(entry.target);
        animateCounts(entry.target);
      }
    },
    { threshold: 0.2 },
  );
  observeRoot();
});

onBeforeUnmount(() => {
  countObserver?.disconnect();
  countObserver = undefined;
});

watch(
  () => [props.stats, props.failed],
  async () => {
    await nextTick();
    observeRoot();
  },
);

function observeRoot() {
  if (!countObserver?.takeRecords) return;
  const root = statsEl.value;
  if (!root) return;
  countObserver.disconnect();
  countObserver.observe(root);
}

function animateCounts(root: Element) {
  if (props.failed || props.loading) return;
  for (const el of root.querySelectorAll<HTMLElement>('[data-count]')) {
    const target = Number.parseFloat(el.dataset.count ?? '0');
    const decimals = Number.parseInt(el.dataset.decimal ?? '0', 10) || 0;
    if (!Number.isFinite(target)) continue;
    runCountUp(el, target, decimals);
  }
}

function runCountUp(el: HTMLElement, target: number, decimals: number) {
  const start = performance.now();
  const duration = 1400;
  const tick = (now: number) => {
    const progress = Math.min((now - start) / duration, 1);
    const value = target * (1 - (1 - progress) ** 3);
    el.textContent = `${formatValue(value, decimals)}${el.dataset.suffix || ''}`;
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function formatValue(value: number, decimals: number) {
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value);
}

function displayFallback(value: number | undefined, decimals = 0, suffix = '') {
  if (props.loading || props.failed) return placeholder;
  if (value === undefined) return placeholder;
  return `${formatValue(value, decimals)}${suffix}`;
}
</script>

<template>
  <div
    ref="statsEl"
    class="stats"
    :style="siteThemeVars"
    data-testid="home-metrics"
    :data-analytics-ready="availability.analyticsReady ? 'true' : 'false'"
  >
    <div v-for="item in statItems" :key="item.key" class="stat">
      <div
        v-if="!loading && !failed && item.count !== undefined"
        class="num"
        :data-count="item.count"
        :data-decimal="item.decimal"
        :data-suffix="item.suffix"
      >
        {{ displayFallback(item.count, item.decimal, item.suffix) }}
      </div>
      <div v-else class="num">{{ placeholder }}</div>
      <div class="label">{{ item.label }}</div>
      <div class="sub">{{ item.sub }}</div>
    </div>
  </div>
</template>

<style scoped>
/* 改为 gap 分隔的卡片组：原方案用 overflow:hidden 容器 + 1px 竖线，
   窄屏折行后线条位置全错，还得靠 nth-child 打补丁。现在留白即分隔。 */
.stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}
.stat {
  position: relative;
  min-width: 0;
  padding: 24px 24px 20px;
  background: var(--home-surface-strong);
  border: 1px solid var(--home-border);
  border-radius: 16px;
  transition:
    border-color 0.18s ease,
    transform 0.18s ease;
}
.stat:hover {
  border-color: var(--home-border-strong);
  transform: translateY(-2px);
}
.stat .num {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: clamp(24px, 2.6vw, 34px);
  font-weight: 800;
  letter-spacing: -0.5px;
  background: var(--home-grad);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.stat .label {
  margin-top: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--home-muted);
}
.stat .sub {
  margin-top: 2px;
  font-size: 11.5px;
  color: var(--home-text-faint);
}
/* 卡片化之后窄屏只需改列数，不再需要 nth-child 修补分割线 */
@media (max-width: 860px) {
  .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .stat { padding: 18px; }
}
@media (max-width: 360px) {
  .stats { grid-template-columns: 1fr; }
}
</style>
