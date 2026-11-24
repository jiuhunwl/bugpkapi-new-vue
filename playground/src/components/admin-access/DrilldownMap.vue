<script setup lang="ts">
import type { AdminAccessLocation } from '#/api/core/user';

import type {
  GeoJSONCollection,
  GeoJSONFeature,
  Projection,
} from './geo-utils';
import type { DrilldownGranularity } from './datav-geo-loader';

import { computed, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  createEquirectangularProjection,
  featureCenter,
  featureLabel,
  featurePath,
  normalizeRegion,
  validCoordinate,
} from './geo-utils';
import {
  aggregateByCity,
  aggregateByDistrict,
  type AggregateResult,
} from './drilldown-aggregator';
import { $t, useI18n } from '#/locales';

const { locale } = useI18n();

const props = withDefaults(
  defineProps<{
    /** GeoJSON FeatureCollection（市级或区县级） */
    geoJSON: GeoJSONCollection;
    /** 全量 locations（已按 scope 过滤过） */
    locations: readonly AdminAccessLocation[];
    /** 当前指标 */
    metric?: 'calls' | 'failures';
    /** 当前粒度 */
    granularity: DrilldownGranularity;
    /** 是否正在加载 */
    loading?: boolean;
    /** 上一级 adcode（省级下钻时为省 adcode，用于聚合匹配） */
    parentLabel?: string;
    /** 是否处于最细层级（到达后点击区域不再下钻，而是闪烁提示） */
    isDeepest?: boolean;
    /** 加载失败时的错误提示文案 */
    errorMessage?: string;
  }>(),
  {
    metric: 'calls',
    loading: false,
    isDeepest: false,
    errorMessage: '',
  },
);

const emit = defineEmits<{
  /** 下钻到下一级 */
  drill: [
    payload: {
      adcode: string;
      granularity: DrilldownGranularity;
      label: string;
    },
  ];
  /** 返回上一级 */
  back: [];
  /** 空数据或错误反馈 */
  empty: [message: string];
}>();

const WIDTH = 1000;
const HEIGHT = 560;

const hoveredFeature = ref<string>('');
const flashFeature = ref<string>('');

/**
 * 计算 GeoJSON 的 bounding box（动态投影核心）。
 */
function computeBounds(features: GeoJSONFeature[]): {
  east: number;
  north: number;
  south: number;
  west: number;
} {
  let west = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;

  for (const feature of features) {
    const rings = extractRings(feature);
    for (const [longitude, latitude] of rings) {
      if (longitude < west) west = longitude;
      if (longitude > east) east = longitude;
      if (latitude < south) south = latitude;
      if (latitude > north) north = latitude;
    }
  }

  // 兜底：如果没找到有效坐标，使用一个合理默认范围
  if (
    !Number.isFinite(west) ||
    !Number.isFinite(east) ||
    !Number.isFinite(south) ||
    !Number.isFinite(north)
  ) {
    return { east: 136, north: 54, south: 17, west: 72 };
  }

  // 加一点 padding，避免边缘贴边
  const lonPad = (east - west) * 0.05 || 0.5;
  const latPad = (north - south) * 0.05 || 0.5;
  return {
    east: east + lonPad,
    north: north + latPad,
    south: south - latPad,
    west: west - lonPad,
  };
}

/**
 * 从 feature 的 geometry 中提取所有 [lon, lat] 坐标点。
 */
function extractRings(
  feature: GeoJSONFeature,
): Array<readonly [number, number]> {
  const geometry = feature.geometry;
  if (!geometry || !geometry.coordinates) return [];
  const points: Array<readonly [number, number]> = [];
  collectCoords(geometry.coordinates, geometry.type, points);
  return points;
}

function collectCoords(
  coords: unknown,
  type: string | undefined,
  output: Array<readonly [number, number]>,
): void {
  if (!Array.isArray(coords)) return;
  if (type === 'LineString') {
    for (const p of coords) {
      if (Array.isArray(p) && p.length >= 2) {
        output.push([Number(p[0]), Number(p[1])]);
      }
    }
    return;
  }
  if (type === 'MultiLineString' || type === 'Polygon') {
    for (const line of coords) {
      if (Array.isArray(line)) {
        for (const p of line) {
          if (Array.isArray(p) && p.length >= 2) {
            output.push([Number(p[0]), Number(p[1])]);
          }
        }
      }
    }
    return;
  }
  if (type === 'MultiPolygon') {
    for (const polygon of coords) {
      if (Array.isArray(polygon)) {
        for (const ring of polygon) {
          if (Array.isArray(ring)) {
            for (const p of ring) {
              if (Array.isArray(p) && p.length >= 2) {
                output.push([Number(p[0]), Number(p[1])]);
              }
            }
          }
        }
      }
    }
    return;
  }
}

/**
 * 动态投影 —— 基于 GeoJSON bbox 自适应。
 */
const projection = computed<Projection>(() => {
  const features = props.geoJSON.features ?? [];
  const bounds = computeBounds(features);
  return createEquirectangularProjection(WIDTH, HEIGHT, bounds);
});

/**
 * 当前粒度下的聚合数据。
 */
const aggregate = computed<AggregateResult>(() => {
  const parentLabel = props.parentLabel ?? '';
  if (props.granularity === 'city') {
    return aggregateByCity(props.locations, parentLabel, props.metric);
  }
  return aggregateByDistrict(props.locations, parentLabel, props.metric);
});

const maxValue = computed(() => aggregate.value.max);

/**
 * 标准 key（去掉 省/市/区 后缀并小写）。
 */
function normalizeKey(value: string): string {
  return normalizeRegion(value)
    .replace(
      /(省|市|自治区|特别行政区|壮族|回族|维吾尔|地区|区|县|自治州|盟|新区)$/g,
      '',
    )
    .replace(
      /(sheng|province|city|district|autonomousregion|municipality|specialadministrativeregion)$/g,
      '',
    );
}

/**
 * 计算 feature 的填充色（复用 ChinaAccessMap 的 rgba(45,212,191,alpha) 体系）。
 */
function featureFill(featureLabel: string): string {
  const key = normalizeKey(featureLabel);
  const value = aggregate.value.valuesByKey.get(key) ?? 0;
  if (value <= 0) return 'rgba(29, 66, 81, 0.72)';
  const alpha = 0.2 + (value / maxValue.value) * 0.68;
  return `rgba(45, 212, 191, ${alpha.toFixed(2)})`;
}

/**
 * 构建用于渲染的 feature 列表。
 */
const renderedFeatures = computed(() => {
  const features = props.geoJSON.features ?? [];
  return features.map((feature, index) => {
    const label = featureLabel(feature);
    const adcode = String(feature.properties?.adcode ?? index);
    const [lon, lat] = featureCenter(feature);
    const [labelX, labelY] = projection.value(lon, lat);
    return {
      adcode,
      fill: featureFill(label),
      key: `${adcode}-${index}`,
      label,
      labelX,
      labelY,
      path: featurePath(feature, projection.value),
    };
  });
});

/**
 * 散点图（经纬度在当前投影范围内才显示）。
 */
const points = computed(() => {
  const bounds = computeBounds(props.geoJSON.features ?? []);
  return props.locations
    .map((location, index) => {
      const latitude = validCoordinate(
        location.latitude,
        bounds.south - 5,
        bounds.north + 5,
      );
      const longitude = validCoordinate(
        location.longitude,
        bounds.west - 5,
        bounds.east + 5,
      );
      if (latitude === null || longitude === null) return null;
      const [x, y] = projection.value(longitude, latitude);
      return {
        ...location,
        key: `${location.region}-${latitude}-${longitude}-${index}`,
        value:
          props.metric === 'failures'
            ? location.failedCalls
            : location.callCount,
        x,
        y,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);
});

/**
 * 最大散点值（用于散点半径比例）。
 */
const maxPointValue = computed(() =>
  Math.max(1, ...points.value.map((p) => p.value)),
);

function pointRadius(value: number): number {
  return 3 + Math.sqrt(value / maxPointValue.value) * 9;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat(locale.value, {
    maximumFractionDigits: 1,
    notation: 'compact',
  }).format(value);
}

/**
 * 点击区域：如果是最细层级则闪烁提示，否则 emit drill。
 */
function handleFeatureClick(feature: { adcode: string; label: string }): void {
  if (props.isDeepest) {
    // 闪烁提示
    flashFeature.value = feature.adcode;
    emit(
      'empty',
      $t('adminAccess.map.drilldownMaxDepth', [feature.label]),
    );
    setTimeout(() => {
      flashFeature.value = '';
    }, 600);
    return;
  }
  const nextGranularity: DrilldownGranularity =
    props.granularity === 'city' ? 'district' : 'district';
  emit('drill', {
    adcode: feature.adcode,
    granularity: nextGranularity,
    label: feature.label,
  });
}

/**
 * 数据来源标注文案。
 */
const DATA_SOURCE_TEXT = computed(() => $t('adminAccess.map.drilldownSource'));

/**
 * 监听空 features。
 */
const isEmpty = computed(() => {
  const features = props.geoJSON.features ?? [];
  return features.length === 0;
});
</script>

<template>
  <div class="drilldown-map">
    <div v-if="props.loading" class="drilldown-map__loading">
      <IconifyIcon icon="lucide:loader-circle" class="animate-spin" />
      <span>{{ $t('adminAccess.map.drilldownLoading') }}</span>
    </div>

    <div v-if="props.errorMessage" class="drilldown-map__error">
      <IconifyIcon icon="lucide:alert-triangle" />
      <span>{{ props.errorMessage }}</span>
    </div>

    <div
      v-if="isEmpty && !props.loading && !props.errorMessage"
      class="drilldown-map__empty-hint"
    >
      <span>{{ $t('adminAccess.map.drilldownEmpty') }}</span>
    </div>

    <svg
      :aria-label="$t('adminAccess.map.drilldownAria')"
      class="drilldown-map__svg"
      role="img"
      :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="drilldown-map-ocean" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#082c38" />
          <stop offset="1" stop-color="#071923" />
        </linearGradient>
        <filter id="drilldown-map-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect
        :width="WIDTH"
        :height="HEIGHT"
        fill="url(#drilldown-map-ocean)"
        rx="16"
      />

      <g class="drilldown-map__graticule">
        <path
          :d="`M0 ${HEIGHT / 4}H${WIDTH}M0 ${HEIGHT / 2}H${WIDTH}M0 ${(HEIGHT / 4) * 3}H${WIDTH}`"
        />
        <path
          :d="`M${WIDTH / 5} 0V${HEIGHT}M${(WIDTH / 5) * 2} 0V${HEIGHT}M${(WIDTH / 5) * 3} 0V${HEIGHT}M${(WIDTH / 5) * 4} 0V${HEIGHT}`"
        />
      </g>

      <g class="drilldown-map__regions">
        <path
          v-for="feature in renderedFeatures"
          :key="feature.key"
          :class="{
            'drilldown-map__region': true,
            'is-active': hoveredFeature === feature.key,
            'is-flash': flashFeature === feature.key,
          }"
          :d="feature.path"
          :fill="feature.fill"
          :data-drillable="!props.isDeepest ? 'true' : 'false'"
          :data-adcode="feature.adcode"
          @click="handleFeatureClick(feature)"
          @mouseenter="hoveredFeature = feature.key"
          @mouseleave="hoveredFeature = ''"
        >
          <title>
            {{ feature.label }} ·
            {{
              $t('adminAccess.visitsCount', [
                formatCount(
                  aggregate.valuesByKey.get(normalizeKey(feature.label)) ?? 0,
                ),
              ])
            }}
          </title>
        </path>
      </g>

      <g class="drilldown-map__labels" aria-hidden="true">
        <text
          v-for="feature in renderedFeatures"
          :key="`label-${feature.key}`"
          :x="feature.labelX"
          :y="feature.labelY"
          text-anchor="middle"
        >
          {{ feature.label }}
        </text>
      </g>

      <g class="drilldown-map__points" filter="url(#drilldown-map-glow)">
        <g
          v-for="point in points"
          :key="point.key"
          class="drilldown-map__point"
        >
          <circle
            :cx="point.x"
            :cy="point.y"
            :r="pointRadius(point.value) * 2.2"
            class="point-halo"
          />
          <circle
            :cx="point.x"
            :cy="point.y"
            :r="pointRadius(point.value)"
            :class="
              props.metric === 'failures'
                ? 'point-core point-core--danger'
                : 'point-core'
            "
          />
          <title>
            {{ point.region || point.province || $t('adminAccess.unknownRegion') }} ·
            {{ formatCount(point.value) }}
          </title>
        </g>
      </g>
    </svg>

    <div class="drilldown-map__legend">
      <span><i class="legend-swatch legend-swatch--normal"></i>{{ $t('adminAccess.map.hotspot') }}</span>
      <span><i class="legend-swatch legend-swatch--danger"></i>{{ $t('adminAccess.map.failureHotspot') }}</span>
    </div>

    <div class="drilldown-map__data-source">
      {{ DATA_SOURCE_TEXT }}
    </div>
  </div>
</template>

<style scoped>
.drilldown-map {
  position: relative;
  width: 100%;
  min-height: 340px;
  overflow: hidden;
  border-radius: 14px;
  background: #071923;
}

.drilldown-map__svg {
  display: block;
  width: 100%;
  min-height: 340px;
}

.drilldown-map__graticule path {
  fill: none;
  stroke: rgb(148 163 184 / 14%);
  stroke-dasharray: 3 7;
  stroke-width: 1;
}

.drilldown-map__region {
  cursor: pointer;
  stroke: rgb(153 246 228 / 64%);
  stroke-width: 0.7;
  transition:
    fill 180ms ease,
    stroke 180ms ease;
}

.drilldown-map__region.is-active {
  stroke: #f7c873;
  stroke-width: 1.8;
}

.drilldown-map__region.is-flash {
  animation: drilldown-flash 0.6s ease;
}

@keyframes drilldown-flash {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
    stroke: #f7c873;
    stroke-width: 2.4;
  }
}

.drilldown-map__labels text {
  pointer-events: none;
  fill: rgb(226 232 240 / 75%);
  font-size: 9px;
  paint-order: stroke;
  stroke: #071923;
  stroke-width: 2px;
}

.drilldown-map__point {
  cursor: pointer;
}

.point-halo {
  fill: #5eead4;
  opacity: 0.22;
}

.point-core {
  fill: #5eead4;
  stroke: #ecfeff;
  stroke-width: 1;
}

.point-core--danger {
  fill: #fb7185;
  stroke: #ffe4e6;
}

.drilldown-map__loading {
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

.drilldown-map__error {
  position: absolute;
  z-index: 5;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  gap: 6px;
  align-items: center;
  padding: 7px 14px;
  border: 1px solid rgb(251 113 133 / 40%);
  border-radius: 8px;
  color: #fda4af;
  background: rgb(50 15 25 / 86%);
  font-size: 11px;
}

.drilldown-map__empty-hint {
  position: absolute;
  z-index: 5;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  padding: 12px 18px;
  border: 1px solid rgb(148 163 184 / 30%);
  border-radius: 10px;
  color: rgb(203 213 225 / 80%);
  background: rgb(7 18 31 / 88%);
  font-size: 12px;
}

.drilldown-map__legend {
  position: absolute;
  bottom: 10px;
  left: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  color: rgb(203 213 225 / 72%);
  font-size: 10px;
}

.drilldown-map__legend span {
  display: inline-flex;
  gap: 5px;
  align-items: center;
}

.legend-swatch {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.legend-swatch--normal {
  background: #5eead4;
}

.legend-swatch--danger {
  background: #fb7185;
}

.drilldown-map__data-source {
  position: absolute;
  right: 14px;
  bottom: 8px;
  color: rgb(148 163 184 / 52%);
  font-size: 9px;
}
</style>
