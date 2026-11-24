<script setup lang="ts">
import type { HomeApi } from '#/api/home';

import { computed, reactive } from 'vue';
import { RouterLink } from 'vue-router';

import { IconifyIcon } from '@vben/icons';

import { usePublicSiteTheme } from '#/composables/use-public-site-theme';
import { formatSettlementPrice } from '#/composables/use-settlement-currency';
import { $t } from '#/locales';
import { isMarketPriceFree } from '#/utils/market-price';

const props = withDefaults(
  defineProps<{
    failed?: boolean;
    items: HomeApi.HotApiItem[];
    loading?: boolean;
    total?: number;
  }>(),
  { failed: false, loading: false, total: 0 },
);

const { siteThemeVars } = usePublicSiteTheme();
const failedIcons = reactive(new Set<string>());

const viewAllLabel = computed(() =>
  props.failed
    ? $t('page.public.market.allApis')
    : $t('page.public.home.v3.featured.viewAll', [
        props.total > 0 ? props.total : props.items.length,
      ]),
);

interface RenderCard {
  avatarUrl: string;
  calls: string;
  desc: string;
  hot: boolean;
  id: number | string;
  method: string;
  methodTone: 'get' | 'post';
  name: string;
  price: string;
  priceTone: 'free' | 'paid' | 'points';
  to: { name: 'ApiDocs'; params: { id: number | string } };
}

const cards = computed<RenderCard[]>(() =>
  props.items.map((item) => ({
    id: item.id,
    name: item.name,
    desc: item.description || $t('page.public.home.concise.api.descriptionFallback'),
    method: methodLabel(item.requestMethod),
    methodTone: methodTone(item.requestMethod),
    price: apiPrice(item),
    priceTone: priceTone(item),
    calls: formatCalls(item.callCount),
    hot: Number(item.isTop ?? 0) === 1 || Number(item.isFeatured ?? 0) === 1,
    avatarUrl: String(item.avatarUrl ?? '').trim(),
    to: { name: 'ApiDocs', params: { id: item.id } },
  })),
);

function priceTone(item: HomeApi.HotApiItem): 'free' | 'paid' | 'points' {
  if (isMarketPriceFree(item.price, item.pointPrice)) return 'free';
  return Number(item.pointPrice ?? 0) > 0 ? 'points' : 'paid';
}

function methodLabel(method: string | undefined) {
  const value = String(method || 'GET').toUpperCase();
  if (value.includes('POST') && value.includes('GET')) {
    return 'GET/POST';
  }
  return value.includes('POST') ? 'POST' : 'GET';
}
function methodTone(method: string | undefined) {
  const value = String(method || 'GET').toUpperCase();
  return value.includes('POST') && !value.includes('GET') ? 'post' : 'get';
}
function apiPrice(item: HomeApi.HotApiItem) {
  // 后端把 decimal(12,4) 直接序列化为字符串（如 "0.0000"），
  // 必须用共享判定统一识别免费，不能与字面量 0 直接比较。
  if (isMarketPriceFree(item.price, item.pointPrice)) {
    return $t('page.public.home.concise.api.free');
  }
  const points = Number(item.pointPrice ?? 0);
  if (Number.isFinite(points) && points > 0) {
    return $t('page.public.home.concise.api.points', [points]);
  }
  return $t('page.public.home.concise.api.balance', [
    formatSettlementPrice(item.price, 4),
  ]);
}
function formatCalls(value: number) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num) || num <= 0) return '▲ 0';
  if (num >= 10_000) return `▲ ${(num / 10_000).toFixed(1)}w`;
  return `▲ ${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(num)}`;
}
</script>

<template>
  <section id="apis" class="section" :style="siteThemeVars" data-testid="home-featured">
    <div class="sec-head reveal">
      <div>
        <span class="eyebrow">{{ $t('page.public.home.v3.featured.eyebrow') }}</span>
        <h2>{{ $t('page.public.home.v3.featured.title') }}</h2>
        <p>{{ $t('page.public.home.v3.featured.desc') }}</p>
      </div>
      <RouterLink class="more" to="/apilist">
        {{ viewAllLabel }}
      </RouterLink>
    </div>

    <div class="api-grid">
      <RouterLink v-for="card in cards" :key="card.id" class="api-card reveal" :data-testid="`home-api-card-${card.id}`" :to="card.to">
        <span class="go">→</span>
        <div class="top">
          <span class="plat">
            <img
              v-if="card.avatarUrl && !failedIcons.has(card.avatarUrl)"
              :alt="card.name"
              loading="lazy"
              referrerpolicy="no-referrer"
              :src="card.avatarUrl"
              @error="failedIcons.add(card.avatarUrl)"
            />
            <IconifyIcon v-else aria-hidden="true" icon="lucide:plug" />
          </span>
          <h3>{{ card.name }}</h3>
        </div>
        <p class="desc">{{ card.desc }}</p>
        <div class="foot">
          <span class="tag" :class="card.methodTone">{{ card.method }}</span>
          <span class="tag" :class="`price-${card.priceTone}`">{{ card.price }}</span>
          <span v-if="card.hot" class="tag hot">{{ $t('page.public.home.v3.featured.hot') }}</span>
          <span class="calls">{{ card.calls }}</span>
        </div>
      </RouterLink>
    </div>
  </section>
</template>

<style scoped>
.section { padding: 70px 0 0; }
@media (max-width: 768px) { .section { padding: 52px 0 0; } }
@media (max-width: 420px) { .section { padding: 42px 0 0; } }
.sec-head {
  display: flex;
  gap: 16px;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  margin-bottom: 24px;
}
.sec-head .eyebrow {
  display: inline-block;
  margin-bottom: 9px;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--home-primary);
}
.sec-head h2 {
  font-size: clamp(21px, 3vw, 32px);
  font-weight: 800;
  letter-spacing: -0.3px;
  color: var(--home-heading);
}
.sec-head p {
  max-width: 60ch;
  margin-top: 8px;
  font-size: 14px;
  color: var(--home-muted);
}
.sec-head .more {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  flex: none;
  min-height: 44px;
  padding: 8px 16px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--home-primary);
  background: var(--home-surface);
  border: 1px solid var(--home-border);
  border-radius: 11px;
  transition: all 0.2s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.sec-head .more:hover {
  border-color: rgb(var(--home-primary-rgb) / 40%);
  transform: translateY(-1px);
}
.api-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
@media (max-width: 1024px) { .api-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 620px) { .api-grid { grid-template-columns: 1fr; gap: 12px; } }
.api-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 13px;
  min-width: 0;
  padding: 20px;
  overflow: hidden;
  color: inherit;
  text-decoration: none;
  background: var(--home-surface-strong);
  border: 1px solid var(--home-border);
  border-radius: 16px;
  transition: all 0.25s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.api-card::after {
  position: absolute;
  inset: 0;
  content: '';
  pointer-events: none;
  opacity: 0;
  background: radial-gradient(420px 160px at 20% 0%, rgb(var(--home-primary-rgb) / 12%), transparent 70%);
  border-radius: inherit;
  transition: opacity 0.25s cubic-bezier(0.22, 0.61, 0.36, 1);
}
/* hover 统一为「上移 2px + 描边提亮」。原先 -4px 配 glow，
   与同屏其他卡片（-2px）抬升幅度不一致，显得散。 */
.api-card:hover {
  border-color: rgb(var(--home-primary-rgb) / 45%);
  box-shadow: 0 14px 34px var(--home-shadow);
  transform: translateY(-2px);
}
.api-card:hover::after { opacity: 1; }
@media (max-width: 920px) { .api-card:hover { transform: none; } }
.api-card .top { display: flex; gap: 12px; align-items: center; min-width: 0; }
.plat {
  display: grid;
  flex: none;
  place-items: center;
  width: 44px;
  height: 44px;
  overflow: hidden;
  color: var(--home-primary);
  background: rgb(var(--home-primary-rgb) / 8%);
  border-radius: 12px;
}
.plat img { width: 100%; height: 100%; object-fit: contain; }
.plat svg { width: 22px; height: 22px; }
@media (max-width: 420px) { .plat { width: 40px; height: 40px; } }
.api-card .top h3 {
  min-width: 0;
  font-size: 15.5px;
  font-weight: 700;
  line-height: 1.35;
  color: var(--home-heading);
  overflow-wrap: anywhere;
}
.api-card .desc {
  display: -webkit-box;
  min-height: 42px;
  overflow: hidden;
  font-size: 13px;
  line-height: 1.65;
  color: var(--home-muted);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.api-card .foot { display: flex; gap: 7px; align-items: center; flex-wrap: wrap; margin-top: auto; }
.tag {
  padding: 4px 10px;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 11.5px;
  font-weight: 700;
  border-radius: 999px;
}
.tag.get {
  color: var(--home-success);
  background: var(--home-success-soft);
  border: 1px solid rgb(52 211 153 / 30%);
}
.tag.post {
  color: var(--home-warning);
  background: var(--home-warning-soft);
  border: 1px solid rgb(251 191 36 / 30%);
}
.tag.free,
.tag.price-free {
  color: var(--home-success);
  background: var(--home-success-soft);
  border: 1px solid rgb(52 211 153 / 30%);
}
.tag.price-points {
  color: var(--home-warning);
  background: var(--home-warning-soft);
  border: 1px solid rgb(251 191 36 / 30%);
}
.tag.price-paid {
  color: var(--home-primary);
  background: rgb(var(--home-primary-rgb) / 10%);
  border: 1px solid rgb(var(--home-primary-rgb) / 30%);
}
.tag.hot {
  color: #fb7185;
  background: rgb(251 113 133 / 10%);
  border: 1px solid rgb(251 113 133 / 30%);
}
.api-card .calls {
  margin-left: auto;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 11.5px;
  color: var(--home-text-faint);
}
.api-card .go {
  position: absolute;
  top: 14px;
  right: 14px;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  color: var(--home-text-faint);
  background: var(--home-surface);
  border-radius: 9px;
  opacity: 0;
  transform: translateX(-6px);
  transition: all 0.25s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.api-card:hover .go { color: var(--home-primary); opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) { .api-card, .api-card .go, .sec-head .more { transition: none; } }
</style>
