<script setup lang="ts">
import type { AdminAccessLocation } from '#/api/core/user';

import { computed, ref } from 'vue';

import {
  type GeoJSONFeature,
  chinaProvinceLabel,
  createEquirectangularProjection,
  featureCenter,
  featureLabel,
  featurePath,
  normalizeRegion,
  validCoordinate,
} from './geo-utils';
import {
  chinaMaritimeBoundaryFeatures,
  chinaMaritimeIslandFeatures,
  chinaProvinceFeatures,
  officialChinaFeature,
} from './map-geo-data';
import { $t, useI18n } from '#/locales';

const props = withDefaults(
  defineProps<{
    locations: readonly AdminAccessLocation[];
    metric?: 'calls' | 'failures';
  }>(),
  {
    metric: 'calls',
  },
);

const emit = defineEmits<{
  /** 省份点击下钻事件 */
  drill: [payload: { adcode: string; label: string; granularity: 'province' }];
}>();

const WIDTH = 1000;
const HEIGHT = 560;
const { locale } = useI18n();
const projection = createEquirectangularProjection(WIDTH, HEIGHT, {
  east: 136,
  north: 54,
  south: 17,
  west: 72,
});
const maritimeProjection = createEquirectangularProjection(166, 164, {
  east: 125,
  north: 26,
  south: 3,
  west: 108,
});
const officialChinaPath = featurePath(officialChinaFeature, projection);
const hovered = ref<AdminAccessLocation | null>(null);
const hoveredProvince = ref('');

const locationValue = (location: AdminAccessLocation) =>
  props.metric === 'failures' ? location.failedCalls : location.callCount;

const provinceKey = (value: unknown) =>
  normalizeRegion(value)
    .replace(/^中国(?=台湾|香港|澳门)/, '')
    .replace(/(省|市|自治区|特别行政区|壮族|回族|维吾尔族|地区)$/g, '')
    .replace(
      /(sheng|province|autonomousregion|municipality|specialadministrativeregion)$/g,
      '',
    );

const locationForProvince = (location: AdminAccessLocation) =>
  provinceKey(location.province || location.region || location.city);

const valuesByProvince = computed(() => {
  const result = new Map<string, number>();
  for (const location of props.locations) {
    const key = locationForProvince(location);
    if (!key) continue;
    result.set(key, (result.get(key) ?? 0) + locationValue(location));
  }
  return result;
});

const maxProvinceValue = computed(() =>
  Math.max(1, ...valuesByProvince.value.values()),
);

const features = computed(() =>
  chinaProvinceFeatures.map((feature, index) => {
      const matchLabel = featureLabel(feature);
      const label = chinaProvinceLabel(feature);
      const value = valuesByProvince.value.get(provinceKey(matchLabel)) ?? 0;
      const [longitude, latitude] = featureCenter(feature);
      const [labelLongitude, labelLatitude] = provinceLabelPosition(
        feature,
        longitude,
        latitude,
      );
      const [labelX, labelY] = projection(labelLongitude, labelLatitude);
      const adcode = String(feature.properties?.adcode ?? index);
      return {
        adcode,
        fill: provinceFill(value),
        key: `${adcode}-${index}`,
        label,
        labelX,
        labelY,
        path: featurePath(feature, projection),
        matchLabel,
        value,
      };
    }),
);

const maritimeIslands = chinaMaritimeIslandFeatures.map((feature, index) => ({
  key: `maritime-island-${feature.properties?.sourceFeatureId ?? index}`,
  path: featurePath(feature, maritimeProjection),
}));

const maritimeBoundaryLines = chinaMaritimeBoundaryFeatures.map(
  (feature, index) => ({
    key: `maritime-boundary-${feature.properties?.sourceFeatureId ?? index}`,
    path: featurePath(feature, maritimeProjection),
  }),
);

const points = computed(() =>
  props.locations
    .map((location, index) => {
      let latitude = validCoordinate(location.latitude, 17, 54);
      let longitude = validCoordinate(location.longitude, 72, 136);
      if (latitude === null || longitude === null) {
        const fallback = features.value.find(
          (feature) =>
            provinceKey(feature.label) === locationForProvince(location),
        );
        if (!fallback) return null;
        [longitude, latitude] = featureCenterForLabel(fallback.label);
      }
      const [x, y] = projection(longitude, latitude);
      return {
        ...location,
        key: `${location.region}-${latitude}-${longitude}-${index}`,
        value: locationValue(location),
        x,
        y,
      };
    })
    .filter((point): point is NonNullable<typeof point> => point !== null),
);

function featureCenterForLabel(label: string): [number, number] {
  const feature = chinaProvinceFeatures.find(
    (item) =>
      provinceKey(featureLabel(item)) === provinceKey(label) ||
      provinceKey(chinaProvinceLabel(item)) === provinceKey(label),
  );
  if (!feature) return [104, 35];
  const center = featureCenter(feature);
  return [center[0], center[1]];
}

function provinceLabelPosition(
  feature: GeoJSONFeature,
  longitude: number,
  latitude: number,
): [number, number] {
  const adcode = String(feature.properties?.adcode ?? '');
  if (adcode === '810000') return [116.1, 23.15];
  if (adcode === '820000') return [111.65, 21.35];
  return [longitude, latitude];
}

function provinceFill(value: number) {
  if (value <= 0) return 'rgba(29, 66, 81, 0.72)';
  const alpha = 0.2 + (value / maxProvinceValue.value) * 0.68;
  return `rgba(45, 212, 191, ${alpha.toFixed(2)})`;
}

function pointRadius(value: number) {
  return 3 + Math.sqrt(value / Math.max(1, maxProvinceValue.value)) * 9;
}

function formatCount(value: number) {
  return new Intl.NumberFormat(locale.value, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}
</script>

<template>
  <div class="china-access-map">
    <svg
      :aria-label="$t('adminAccess.map.chinaAria')"
      class="china-access-map__svg"
      role="img"
      viewBox="0 0 1000 560"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="china-map-ocean" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#082c38" />
          <stop offset="1" stop-color="#071923" />
        </linearGradient>
        <filter id="china-map-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id="china-map-official-territory" clipPathUnits="userSpaceOnUse">
          <path :d="officialChinaPath" />
        </clipPath>
      </defs>
      <rect width="1000" height="560" fill="url(#china-map-ocean)" rx="16" />
      <g class="china-access-map__graticule">
        <path d="M0 140H1000M0 280H1000M0 420H1000" />
        <path d="M200 0V560M400 0V560M600 0V560M800 0V560" />
      </g>
      <path
        :d="officialChinaPath"
        data-map-layer="official-china-territory"
        fill="rgba(29, 66, 81, 0.72)"
      />
      <g
        class="china-access-map__provinces"
        clip-path="url(#china-map-official-territory)"
      >
        <path
          v-for="feature in features"
          :key="feature.key"
          :class="{
            'is-active': hoveredProvince === feature.label,
            'china-access-map__province--drillable': true,
          }"
          :d="feature.path"
          :fill="feature.fill"
          :data-adcode="feature.adcode"
          :data-drillable="true"
          @click="emit('drill', { adcode: feature.adcode, label: feature.label, granularity: 'province' })"
          @mouseenter="hoveredProvince = feature.label"
          @mouseleave="hoveredProvince = ''"
        >
          <title>
            {{ feature.label }} · {{ $t('adminAccess.visitsCount', [formatCount(feature.value)]) }}
          </title>
        </path>
      </g>
      <path
        :d="officialChinaPath"
        class="china-access-map__official-outline"
        data-map-layer="official-china-outline"
      />
      <g class="china-access-map__labels" aria-hidden="true">
        <text
          v-for="feature in features"
          :key="`label-${feature.key}`"
          :x="feature.labelX"
          :y="feature.labelY"
          text-anchor="middle"
        >
          {{ feature.label }}
        </text>
      </g>
      <g
        data-map-layer="south-china-sea-inset"
        transform="translate(824 366)"
      >
        <rect
          width="174"
          height="184"
          fill="rgba(7, 25, 35, 0.9)"
          rx="7"
          stroke="rgba(153, 246, 228, 0.55)"
          stroke-width="0.8"
        />
        <text
          x="87"
          y="11"
          fill="rgba(226, 232, 240, 0.82)"
          font-size="8"
          text-anchor="middle"
        >
          {{ $t('adminAccess.map.southChinaSeaInset') }}
        </text>
        <g data-geometry="island" transform="translate(4 16)">
          <path
            v-for="island in maritimeIslands"
            :key="island.key"
            :d="island.path"
            fill="rgba(29, 66, 81, 0.72)"
            stroke="rgba(153, 246, 228, 0.64)"
            stroke-width="0.55"
          />
        </g>
        <g data-geometry="boundary-line" transform="translate(4 16)">
          <path
            v-for="line in maritimeBoundaryLines"
            :key="line.key"
            :d="line.path"
            fill="none"
            stroke="rgba(153, 246, 228, 0.88)"
            stroke-linecap="round"
            stroke-width="0.8"
          />
        </g>
      </g>
      <g class="china-access-map__points" filter="url(#china-map-glow)">
        <g
          v-for="point in points"
          :key="point.key"
          class="china-access-map__point"
          @mouseenter="hovered = point"
          @mouseleave="hovered = null"
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
    <div v-if="hovered" class="china-access-map__tooltip">
      <strong>{{ hovered.region || hovered.province || $t('adminAccess.unknownRegion') }}</strong>
      <span>{{ $t('adminAccess.callsCount', [formatCount(hovered.callCount)]) }} ·
        {{ $t('adminAccess.ipsCount', [formatCount(hovered.uniqueIps)]) }}</span>
      <span v-if="hovered.isp">{{ hovered.isp }}</span>
    </div>
    <div class="china-access-map__legend">
      <span><i class="legend-swatch legend-swatch--normal"></i>{{ $t('adminAccess.map.hotspot') }}</span>
      <span><i class="legend-swatch legend-swatch--danger"></i>{{ $t('adminAccess.map.failureHotspot') }}</span>
      <span>{{ $t('adminAccess.map.chinaLegend') }}</span>
    </div>
  </div>
</template>

<style scoped>
.china-access-map {
  position: relative;
  width: 100%;
  min-height: 340px;
  overflow: hidden;
  border-radius: 14px;
  background: #071923;
}

.china-access-map__svg {
  display: block;
  width: 100%;
  min-height: 340px;
}

.china-access-map__graticule path {
  fill: none;
  stroke: rgb(148 163 184 / 14%);
  stroke-dasharray: 3 7;
  stroke-width: 1;
}

.china-access-map__provinces path {
  cursor: crosshair;
  stroke: rgb(153 246 228 / 64%);
  stroke-width: 0.7;
  transition:
    fill 180ms ease,
    stroke 180ms ease;
}

.china-access-map__provinces path.china-access-map__province--drillable {
  cursor: pointer;
}

.china-access-map__provinces path.is-active {
  stroke: #f7c873;
  stroke-width: 1.8;
}

.china-access-map__official-outline {
  fill: none;
  pointer-events: none;
  stroke: rgb(153 246 228 / 78%);
  stroke-width: 1;
}

.china-access-map__labels text {
  pointer-events: none;
  fill: rgb(226 232 240 / 75%);
  font-size: 8px;
  paint-order: stroke;
  stroke: #071923;
  stroke-width: 2px;
}

.china-access-map__point {
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

.china-access-map__tooltip {
  position: absolute;
  right: 14px;
  top: 14px;
  display: grid;
  gap: 3px;
  max-width: 220px;
  padding: 10px 12px;
  border: 1px solid rgb(148 163 184 / 30%);
  border-radius: 10px;
  color: #e2e8f0;
  background: rgb(7 18 31 / 88%);
  box-shadow: 0 10px 28px rgb(0 0 0 / 25%);
  font-size: 11px;
  backdrop-filter: blur(10px);
}

.china-access-map__tooltip strong {
  color: #f8fafc;
  font-size: 13px;
}

.china-access-map__legend {
  position: absolute;
  bottom: 10px;
  left: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  color: rgb(203 213 225 / 72%);
  font-size: 10px;
}

.china-access-map__legend span {
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
</style>
