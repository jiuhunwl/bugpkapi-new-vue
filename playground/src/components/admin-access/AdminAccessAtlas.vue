<script setup lang="ts">
import type { DrilldownGranularity } from './datav-geo-loader';
import type { DrilldownLevel } from './useDrilldown';

import type {
  AdminAccessLocation,
  AdminAccessRange,
  AdminAccessSummary,
} from '#/api/core/user';

import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue';

import { IconifyIcon, RotateCw } from '@vben/icons';

import { Button, Tooltip } from 'ant-design-vue';

import { $t, useI18n } from '#/locales';

import AdminGlobe3D from './AdminGlobe3D.vue';
import ChinaAccessMap from './ChinaAccessMap.vue';
import { filterByChain } from './drilldown-aggregator';
import DrilldownBreadcrumb from './DrilldownBreadcrumb.vue';
import DrilldownMap from './DrilldownMap.vue';
import { accessLocationLabel } from './geo-utils';
import { useDrilldown } from './useDrilldown';
import WorldAccessMap from './WorldAccessMap.vue';

const props = withDefaults(
  defineProps<{
    available?: boolean;
    loading?: boolean;
    locations: readonly AdminAccessLocation[];
    range: AdminAccessRange;
    summary: AdminAccessSummary;
  }>(),
  {
    available: true,
    loading: false,
  },
);

const emit = defineEmits<{
  'range-change': [range: AdminAccessRange];
  refresh: [];
}>();

type Scope = 'china' | 'world';
type Dimension = '2d' | '3d';
type Metric = 'calls' | 'failures';

/**
 * 时间范围选项。
 *
 * 「全部」不设下界上限：后端会以该表最早的小时桶为起点做一次索引 range 扫描，
 * 因此这四个选项共享同一执行计划，切换范围不会带来性能落差。
 */
const RANGE_OPTIONS = computed<Array<{ label: string; value: AdminAccessRange }>>(
  () => [
    { label: $t('adminAccess.atlas.rangeTodayOption'), value: 'today' },
    { label: $t('adminAccess.atlas.range7dOption'), value: '7d' },
    { label: $t('adminAccess.atlas.range30dOption'), value: '30d' },
    { label: $t('adminAccess.atlas.rangeAllOption'), value: 'all' },
  ],
);

const { locale } = useI18n();

/** 范围对应的展示文案，用于「近 N 天」这类动态描述。 */
const rangeLabel = computed(() => {
  switch (props.range) {
    case 'today': {
      return $t('adminAccess.atlas.rangeToday');
    }
    case '7d': {
      return $t('adminAccess.atlas.range7d');
    }
    case 'all': {
      return $t('adminAccess.atlas.rangeAll');
    }
    default: {
      return $t('adminAccess.atlas.rangeDays', [
        props.summary.windowDays || 30,
      ]);
    }
  }
});

function selectRange(next: AdminAccessRange) {
  if (next === props.range) return;
  emit('range-change', next);
}

const scope = shallowRef<Scope>('world');
const dimension = shallowRef<Dimension>('3d');
const metric = shallowRef<Metric>('calls');

const drilldown = useDrilldown();

const DRILLDOWN_SESSION_KEY = 'admin-access-atlas-drilldown-stack';

const mapLocations = computed(() =>
  scope.value === 'china'
    ? props.locations.filter((location) => isChinaLocation(location))
    : props.locations,
);

/**
 * 明细表数据：按下钻栈的 adcode 链过滤。
 * 未下钻时显示全量；下钻后逐级 AND 叠加过滤条件。
 */
const drilldownFilteredLocations = computed(() => {
  if (scope.value !== 'china' || drilldown.depth.value === 0) {
    return mapLocations.value;
  }
  return filterByChain(mapLocations.value, drilldown.stack.value);
});

const rankedLocations = computed(() =>
  [...drilldownFilteredLocations.value].sort((left, right) => {
    const leftValue =
      metric.value === 'failures' ? left.failedCalls : left.callCount;
    const rightValue =
      metric.value === 'failures' ? right.failedCalls : right.callCount;
    return rightValue - leftValue || right.uniqueIps - left.uniqueIps;
  }),
);

const activeCountries = computed(() => {
  const countries = new Set(
    props.locations
      .map((location) => String(location.country ?? '').trim())
      .filter(Boolean),
  );
  return countries.size || props.summary.activeCountries;
});

const selectedMetricLabel = computed(() =>
  metric.value === 'failures'
    ? $t('adminAccess.atlas.metricFailuresLabel')
    : $t('adminAccess.atlas.metricCallsLabel'),
);

function isChinaLocation(location: AdminAccessLocation) {
  const value = `${location.country ?? ''} ${location.province ?? ''} ${location.region ?? ''}`;
  return /中国|China|香港|澳门|台湾|Hong Kong|Macau|Taiwan|北京|天津|河北|山西|内蒙古|辽宁|吉林|黑龙江|上海|江苏|浙江|安徽|福建|江西|山东|河南|湖北|湖南|广东|广西|海南|重庆|四川|贵州|云南|西藏|陕西|甘肃|青海|宁夏|新疆/i.test(
    value,
  );
}

function formatCount(value: number) {
  return new Intl.NumberFormat(locale.value, {
    maximumFractionDigits: 1,
    notation: 'compact',
  }).format(Number(value) || 0);
}

function formatFullCount(value: number) {
  return new Intl.NumberFormat(locale.value).format(Number(value) || 0);
}

function successRate(location: AdminAccessLocation) {
  const resolved = location.successCalls + location.failedCalls;
  if (!resolved) return '—';
  return `${Math.round((location.successCalls / resolved) * 1000) / 10}%`;
}

function coordinateLabel(location: AdminAccessLocation) {
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return $t('adminAccess.coordinateMissing');
  }
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}

function selectScope(nextScope: Scope) {
  // 切换范围前保存当前下钻状态（仅中国范围）
  if (scope.value === 'china' && drilldown.depth.value > 0) {
    saveDrilldownToSession();
  }
  scope.value = nextScope;
  // 切回中国时恢复下钻状态
  if (nextScope === 'china') {
    restoreDrilldownFromSession();
  } else {
    drilldown.reset();
  }
}

/**
 * 省份点击下钻（来自 ChinaAccessMap 或 AdminGlobe3D）。
 */
async function handleProvinceDrill(payload: {
  adcode: string;
  granularity?: 'province' | DrilldownGranularity;
  label: string;
}) {
  // 确保 2D 中国视图
  dimension.value = '2d';
  scope.value = 'china';
  await drilldown.enter(payload.adcode, payload.label, 'province');
}

/**
 * 市/区县点击继续下钻（来自 DrilldownMap）。
 */
async function handleSubDrill(payload: {
  adcode: string;
  granularity: DrilldownGranularity;
  label: string;
}) {
  const clickedGranularity =
    payload.granularity === 'district' ? 'city' : 'city';
  await drilldown.enter(payload.adcode, payload.label, clickedGranularity);
}

/**
 * 面包屑点击跳转到指定层级。
 */
function handleBreadcrumbSelect(index: number) {
  if (index < 0) {
    // 点击"全国"
    drilldown.reset();
    return;
  }
  // 回退到指定层级（保留 0~index 的栈）
  const targetDepth = index + 1;
  while (drilldown.depth.value > targetDepth) {
    drilldown.back();
  }
}

/**
 * 返回上一级。
 */
function handleDrilldownBack() {
  drilldown.back();
}

/**
 * 当前 DrilldownMap 的 parentLabel（用于聚合匹配）。
 */
const drilldownParentLabel = computed(() => {
  if (drilldown.depth.value === 0) return '';
  // 使用当前层级的 label 作为聚合的父标签
  return drilldown.current.value?.label ?? '';
});

/**
 * DrilldownMap 的 granularity prop。
 */
const drilldownGranularity = computed<DrilldownGranularity>(() => {
  const g = drilldown.current.value?.granularity;
  if (g === 'district') return 'district';
  return 'city';
});

/**
 * DrilldownMap 是否处于最细层级。
 */
const drilldownIsDeepest = computed(() => drilldown.depth.value >= 2);

/**
 * 面包屑上一级名称（返回按钮文案）。
 */
const drilldownParentName = computed(() => {
  const items = drilldown.breadcrumb.value;
  if (items.length < 2) return '';
  return items[items.length - 2]?.label ?? '';
});

/**
 * sessionStorage 持久化 —— 保存。
 */
function saveDrilldownToSession() {
  try {
    const stack = drilldown.serialize();
    sessionStorage.setItem(DRILLDOWN_SESSION_KEY, JSON.stringify(stack));
  } catch {
    // sessionStorage 不可用时静默忽略
  }
}

/**
 * sessionStorage 持久化 —— 恢复。
 */
function restoreDrilldownFromSession() {
  try {
    const saved = sessionStorage.getItem(DRILLDOWN_SESSION_KEY);
    if (!saved) return;
    const stack = JSON.parse(saved) as DrilldownLevel[];
    if (Array.isArray(stack) && stack.length > 0) {
      drilldown.restoreFrom(stack);
    }
  } catch {
    // 解析失败静默忽略
  }
}

/**
 * ESC 键逐级返回。
 */
function handleEscKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  if (scope.value === 'china' && drilldown.depth.value > 0) {
    event.preventDefault();
    drilldown.back();
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleEscKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleEscKeydown);
});

/**
 * 下钻深度变化时保存到 sessionStorage。
 */
watch(
  () => drilldown.depth.value,
  () => {
    if (scope.value === 'china' && drilldown.depth.value > 0) {
      saveDrilldownToSession();
    } else if (drilldown.depth.value === 0) {
      try {
        sessionStorage.removeItem(DRILLDOWN_SESSION_KEY);
      } catch {
        // ignore
      }
    }
  },
);
</script>

<template>
  <section class="admin-access-atlas">
    <header class="admin-access-atlas__head">
      <div class="admin-access-atlas__title-wrap">
        <span class="admin-access-atlas__icon"><IconifyIcon icon="lucide:globe-2" /></span>
        <div>
          <div class="admin-access-atlas__eyebrow">NETWORK OPERATIONS</div>
          <h2>{{ $t('adminAccess.atlas.title') }}</h2>
          <p>
            {{ $t('adminAccess.atlas.subtitle', [rangeLabel]) }}
          </p>
        </div>
      </div>
      <div class="admin-access-atlas__summary">
        <div>
          <span>{{ $t('adminAccess.atlas.totalCalls') }}</span>
          <strong>{{ props.available ? formatCount(props.summary.totalCalls) : '—' }}</strong>
        </div>
        <div>
          <span>{{ $t('adminAccess.atlas.activeCountries') }}</span>
          <strong>{{ props.available ? activeCountries : '—' }}</strong>
        </div>
        <div>
          <span>{{ $t('adminAccess.atlas.uniqueIps') }}</span>
          <strong>{{ props.available ? formatCount(props.summary.uniqueIps) : '—' }}</strong>
        </div>
        <Tooltip :title="$t('adminAccess.atlas.refresh')">
          <Button
            class="admin-access-atlas__refresh"
            :disabled="props.loading"
            :loading="props.loading"
            shape="circle"
            :aria-label="$t('adminAccess.atlas.refresh')"
            @click="emit('refresh')"
          >
            <template #icon>
              <RotateCw class="size-4" />
            </template>
          </Button>
        </Tooltip>
      </div>
    </header>

    <div class="admin-access-atlas__toolbar">
      <div class="atlas-segment" role="tablist" :aria-label="$t('adminAccess.atlas.timeRange')">
        <button
          v-for="option in RANGE_OPTIONS"
          :key="option.value"
          :aria-selected="range === option.value"
          :class="{ 'is-active': range === option.value }"
          :disabled="props.loading"
          role="tab"
          type="button"
          @click="selectRange(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
      <div class="atlas-segment" role="tablist" :aria-label="$t('adminAccess.atlas.mapScope')">
        <button
          :class="{ 'is-active': scope === 'world' }"
          type="button"
          @click="selectScope('world')"
        >
          <IconifyIcon icon="lucide:orbit" /> {{ $t('adminAccess.atlas.scopeWorld') }}
        </button>
        <button
          :class="{ 'is-active': scope === 'china' }"
          type="button"
          @click="selectScope('china')"
        >
          <IconifyIcon icon="lucide:map" /> {{ $t('adminAccess.atlas.scopeChina') }}
        </button>
      </div>
      <div class="atlas-segment" role="tablist" :aria-label="$t('adminAccess.atlas.mapDimension')">
        <button
          :class="{ 'is-active': dimension === '2d' }"
          type="button"
          @click="dimension = '2d'"
        >
          {{ $t('adminAccess.atlas.dimension2d') }}
        </button>
        <button
          :class="{ 'is-active': dimension === '3d' }"
          type="button"
          @click="dimension = '3d'"
        >
          {{ $t('adminAccess.atlas.dimension3d') }}
        </button>
      </div>
      <div
        class="atlas-segment atlas-segment--metric"
        role="tablist"
        :aria-label="$t('adminAccess.atlas.metric')"
      >
        <button
          :class="{ 'is-active': metric === 'calls' }"
          type="button"
          @click="metric = 'calls'"
        >
          {{ $t('adminAccess.atlas.metricCalls') }}
        </button>
        <button
          :class="{ 'is-active': metric === 'failures' }"
          type="button"
          @click="metric = 'failures'"
        >
          {{ $t('adminAccess.atlas.metricFailures') }}
        </button>
      </div>
      <span class="atlas-window"><span class="atlas-live-dot"></span>{{ selectedMetricLabel }} · {{ rangeLabel }}</span>
    </div>

    <DrilldownBreadcrumb
      v-if="scope === 'china' && drilldown.depth.value > 0"
      class="admin-access-atlas__drilldown-nav"
      :items="drilldown.breadcrumb.value"
      :granularity-label="drilldown.granularityLabel.value"
      :parent-label="drilldownParentName"
      @select="handleBreadcrumbSelect"
      @back="handleDrilldownBack"
    />

    <div class="admin-access-atlas__body">
      <div class="admin-access-atlas__map">
        <div v-if="props.loading" class="admin-access-atlas__loading">
          <IconifyIcon icon="lucide:loader-circle" class="animate-spin" />
          {{ $t('adminAccess.atlas.loading') }}
        </div>
        <AdminGlobe3D
          v-if="dimension === '3d'"
          :locations="mapLocations"
          :metric="metric"
          @drill="handleProvinceDrill"
        />
        <WorldAccessMap
          v-else-if="scope === 'world'"
          :locations="mapLocations"
          :metric="metric"
        />
        <template v-else>
          <!-- 下钻视图：市级 / 区县级 -->
          <DrilldownMap
            v-if="drilldown.depth.value > 0 && drilldown.geoJSON.value"
            :geo-j-s-o-n="drilldown.geoJSON.value"
            :locations="mapLocations"
            :metric="metric"
            :granularity="drilldownGranularity"
            :loading="drilldown.loading.value"
            :parent-label="drilldownParentLabel"
            :is-deepest="drilldownIsDeepest"
            :error-message="drilldown.loadError.value ?? ''"
            @drill="handleSubDrill"
            @back="handleDrilldownBack"
            @empty="() => {}"
          />
          <!-- 省级视图（全国） -->
          <ChinaAccessMap
            v-else
            :locations="mapLocations"
            :metric="metric"
            @drill="handleProvinceDrill"
          />
        </template>
      </div>

      <aside class="admin-access-atlas__list">
        <div class="atlas-list-head">
          <div>
            <h3>{{ $t('adminAccess.atlas.detailsTitle') }}</h3>
            <p>
              {{
                $t(
                  scope === 'china'
                    ? 'adminAccess.atlas.detailsSummaryDomestic'
                    : 'adminAccess.atlas.detailsSummaryGlobal',
                  [props.available ? rankedLocations.length : '—'],
                )
              }}
            </p>
          </div>
          <IconifyIcon icon="lucide:list-filter" />
        </div>
        <div v-if="rankedLocations.length > 0" class="atlas-location-list">
          <article
            v-for="(location, index) in rankedLocations"
            :key="`${location.region}-${index}`"
            class="atlas-location-row"
          >
            <span class="atlas-location-row__rank">{{
              String(index + 1).padStart(2, '0')
            }}</span>
            <div class="atlas-location-row__main">
              <strong>{{ accessLocationLabel(location) }}</strong>
              <span>{{ location.isp || $t('adminAccess.ispUnknown') }} ·
                {{ coordinateLabel(location) }}</span>
              <small>{{
                $t('adminAccess.atlas.seenRange', [
                  location.firstSeen || '—',
                  location.lastSeen || '—',
                ])
              }}</small>
            </div>
            <div class="atlas-location-row__stats">
              <b>{{
                formatFullCount(
                  metric === 'failures'
                    ? location.failedCalls
                    : location.callCount,
                )
              }}</b>
              <span>{{ $t('adminAccess.atlas.successRate', [successRate(location)]) }} ·
                {{ $t('adminAccess.ipsCount', [formatCount(location.uniqueIps)]) }}</span>
            </div>
          </article>
        </div>
        <div v-else class="atlas-empty">
          <IconifyIcon icon="lucide:map-pin-off" />
          <span>{{
            props.available
              ? $t('adminAccess.atlas.emptyRange')
              : $t('adminAccess.atlas.emptyUnavailable')
          }}</span>
        </div>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.admin-access-atlas {
  overflow: hidden;
  border: 1px solid rgb(148 163 184 / 24%);
  border-radius: 18px;
  color: #dbeafe;
  background:
    radial-gradient(circle at 10% 0%, rgb(34 211 238 / 8%), transparent 30%),
    linear-gradient(145deg, #071522, #0a1d2c 62%, #06111d);
  box-shadow: 0 18px 50px rgb(2 6 23 / 18%);
}

.admin-access-atlas__head {
  display: flex;
  gap: 20px;
  align-items: center;
  justify-content: space-between;
  padding: 20px 22px 16px;
  border-bottom: 1px solid rgb(148 163 184 / 16%);
}

.admin-access-atlas__title-wrap {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  min-width: 0;
}

.admin-access-atlas__icon {
  display: grid;
  flex: 0 0 auto;
  width: 38px;
  height: 38px;
  place-items: center;
  border: 1px solid rgb(103 232 249 / 35%);
  border-radius: 12px;
  color: #67e8f9;
  background: rgb(8 145 178 / 18%);
  font-size: 20px;
}

.admin-access-atlas__eyebrow {
  color: #5eead4;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
}

.admin-access-atlas h2,
.admin-access-atlas h3,
.admin-access-atlas p {
  margin: 0;
}

.admin-access-atlas h2 {
  margin-top: 2px;
  color: #f8fafc;
  font-size: 20px;
  font-weight: 700;
}

.admin-access-atlas__title-wrap p {
  margin-top: 4px;
  color: rgb(186 230 253 / 68%);
  font-size: 12px;
}

.admin-access-atlas__summary {
  display: flex;
  gap: 22px;
  flex: 0 0 auto;
}

.admin-access-atlas__refresh {
  display: inline-flex;
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  align-self: center;
  border: 1px solid rgb(103 232 249 / 28%);
  border-radius: 8px;
  color: #a5f3fc;
  background: rgb(8 145 178 / 12%);
  cursor: pointer;
}

.admin-access-atlas__refresh:hover:not(:disabled) {
  color: #ecfeff;
  background: rgb(8 145 178 / 24%);
}

.admin-access-atlas__refresh:disabled {
  cursor: wait;
  opacity: 0.65;
}

.admin-access-atlas__summary div {
  display: grid;
  gap: 4px;
  min-width: 74px;
  text-align: right;
}

.admin-access-atlas__summary span {
  color: rgb(186 230 253 / 62%);
  font-size: 11px;
}

.admin-access-atlas__summary strong {
  color: #f8fafc;
  font-size: 20px;
  line-height: 1;
}

.admin-access-atlas__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  padding: 12px 22px;
  border-bottom: 1px solid rgb(148 163 184 / 14%);
}

.admin-access-atlas__drilldown-nav {
  margin: 0 22px;
  padding: 6px 14px;
}

.atlas-segment {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border: 1px solid rgb(148 163 184 / 22%);
  border-radius: 9px;
  background: rgb(15 34 50 / 72%);
}

.atlas-segment button {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border: 0;
  border-radius: 6px;
  color: rgb(186 230 253 / 72%);
  background: transparent;
  cursor: pointer;
  font-size: 11px;
  transition:
    color 160ms ease,
    background 160ms ease;
}

.atlas-segment button:hover:not(:disabled) {
  color: #e0f2fe;
  background: rgb(34 211 238 / 10%);
}

.atlas-segment button.is-active {
  color: #042f3d;
  background: #67e8f9;
  box-shadow: 0 3px 12px rgb(34 211 238 / 18%);
}

.atlas-segment button:disabled {
  cursor: not-allowed;
  opacity: 0.35;
}

.atlas-window {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  margin-left: auto;
  color: rgb(186 230 253 / 65%);
  font-size: 11px;
}

.atlas-live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #f7c873;
  box-shadow: 0 0 0 4px rgb(247 200 115 / 12%);
}

.admin-access-atlas__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(300px, 36%);
  gap: 14px;
  padding: 14px;
}

.admin-access-atlas__map {
  position: relative;
  min-width: 0;
}

.admin-access-atlas__loading {
  position: absolute;
  z-index: 5;
  top: 12px;
  left: 12px;
  display: inline-flex;
  gap: 6px;
  align-items: center;
  padding: 7px 10px;
  border: 1px solid rgb(103 232 249 / 30%);
  border-radius: 8px;
  color: #a5f3fc;
  background: rgb(7 24 38 / 86%);
  font-size: 11px;
}

.admin-access-atlas__list {
  min-width: 0;
  overflow: hidden;
  border: 1px solid rgb(148 163 184 / 18%);
  border-radius: 14px;
  background: rgb(7 22 35 / 72%);
}

.atlas-list-head {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  justify-content: space-between;
  padding: 14px 14px 11px;
  border-bottom: 1px solid rgb(148 163 184 / 15%);
  color: #67e8f9;
}

.atlas-list-head h3 {
  color: #f8fafc;
  font-size: 14px;
}

.atlas-list-head p {
  margin-top: 3px;
  color: rgb(186 230 253 / 58%);
  font-size: 10px;
}

.atlas-location-list {
  max-height: 500px;
  overflow-y: auto;
}

.atlas-location-row {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: start;
  padding: 11px 12px;
  border-bottom: 1px solid rgb(148 163 184 / 11%);
}

.atlas-location-row:last-child {
  border-bottom: 0;
}

.atlas-location-row__rank {
  padding-top: 2px;
  color: #5eead4;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10px;
}

.atlas-location-row__main {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.atlas-location-row__main strong {
  overflow: hidden;
  color: #e2e8f0;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.atlas-location-row__main span,
.atlas-location-row__main small {
  overflow: hidden;
  color: rgb(186 230 253 / 60%);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.atlas-location-row__main small {
  color: rgb(148 163 184 / 54%);
}

.atlas-location-row__stats {
  display: grid;
  gap: 2px;
  min-width: 78px;
  text-align: right;
}

.atlas-location-row__stats b {
  color: #f7c873;
  font-size: 13px;
}

.atlas-location-row__stats span {
  color: rgb(186 230 253 / 58%);
  font-size: 9px;
  white-space: nowrap;
}

.atlas-empty {
  display: grid;
  min-height: 220px;
  place-items: center;
  gap: 8px;
  color: rgb(186 230 253 / 60%);
  font-size: 12px;
}

@media (max-width: 1100px) {
  .admin-access-atlas__body {
    grid-template-columns: minmax(0, 1fr) minmax(260px, 40%);
  }
}

@media (max-width: 860px) {
  .admin-access-atlas__head {
    align-items: flex-start;
    flex-direction: column;
  }

  .admin-access-atlas__summary {
    width: 100%;
    justify-content: space-between;
  }

  .admin-access-atlas__summary div {
    text-align: left;
  }

  .admin-access-atlas__body {
    grid-template-columns: 1fr;
  }

  .atlas-location-list {
    max-height: 340px;
  }
}

@media (max-width: 560px) {
  .admin-access-atlas__head,
  .admin-access-atlas__toolbar {
    padding-right: 13px;
    padding-left: 13px;
  }

  .admin-access-atlas__body {
    padding: 9px;
  }

  .atlas-window {
    width: 100%;
    margin-left: 0;
  }
}
</style>
