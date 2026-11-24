<script setup lang="ts">
import type { AdminAccessLocation } from '#/api/core/user';

import { computed, ref } from 'vue';

import {
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
  officialWorldFeatures,
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

const WIDTH = 1100;
const HEIGHT = 540;
const { locale } = useI18n();
const projection = createEquirectangularProjection(WIDTH, HEIGHT, {
  east: 180,
  north: 84,
  south: -60,
  west: -180,
});
const hovered = ref<AdminAccessLocation | null>(null);
const hoveredCountry = ref('');

const locationByCountry = computed(() => {
  const result = new Map<string, number>();
  for (const location of props.locations) {
    const key = normalizeRegion(location.country);
    if (!key) continue;
    const value =
      props.metric === 'failures' ? location.failedCalls : location.callCount;
    result.set(key, (result.get(key) ?? 0) + value);
  }
  return result;
});

const maxCountryValue = computed(() =>
  Math.max(1, ...locationByCountry.value.values()),
);

const features = computed(() =>
  officialWorldFeatures.map(
    (feature, index) => {
      const properties = feature.properties ?? {};
      const label = featureLabel(feature);
      const aliases = [
        label,
        properties.NAME,
        properties.NAME_EN,
        properties.ADMIN,
        properties.COUNTRY,
        properties.OFFICIAL_NAME_ZH,
        properties.SOVEREIGNT,
      ]
        .map(normalizeRegion)
        .filter(Boolean);
      const value = aliases.reduce(
        (current, alias) => current || locationByCountry.value.get(alias) || 0,
        0,
      );
      const [longitude, latitude] = featureCenter(feature);
      const [labelX, labelY] = projection(
        Number(properties.LABEL_X ?? longitude),
        Number(properties.LABEL_Y ?? latitude),
      );
      return {
        fill: countryFill(value),
        key: `${properties.ADM0_A3 ?? properties.ISO_A3 ?? label}-${index}`,
        label,
        labelX,
        labelY,
        path: featurePath(feature, projection),
        value,
      };
    },
  ),
);

const maritimeIslands = chinaMaritimeIslandFeatures.map((feature, index) => ({
  key: `maritime-island-${feature.properties?.sourceFeatureId ?? index}`,
  path: featurePath(feature, projection),
}));

const maritimeBoundaryLines = chinaMaritimeBoundaryFeatures.map(
  (feature, index) => ({
    key: `maritime-boundary-${feature.properties?.sourceFeatureId ?? index}`,
    path: featurePath(feature, projection),
  }),
);

const chinaValue = computed(() =>
  ['china', 'cn', 'chn', '中国', '中华人民共和国'].reduce(
    (value, alias) => value || locationByCountry.value.get(alias) || 0,
    0,
  ),
);

const points = computed(() =>
  props.locations
    .map((location, index) => {
      const latitude = validCoordinate(location.latitude, -90, 90);
      const longitude = validCoordinate(location.longitude, -180, 180);
      if (latitude === null || longitude === null) return null;
      const [x, y] = projection(longitude, latitude);
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
    .filter((point): point is NonNullable<typeof point> => point !== null),
);

function countryFill(value: number) {
  if (value <= 0) return 'rgba(31, 52, 77, 0.72)';
  const alpha = 0.22 + (value / maxCountryValue.value) * 0.62;
  return `rgba(34, 211, 238, ${alpha.toFixed(2)})`;
}

function pointRadius(value: number) {
  return 3 + Math.sqrt(value / Math.max(1, maxCountryValue.value)) * 8;
}

function formatCount(value: number) {
  return new Intl.NumberFormat(locale.value, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function countryEnter(label: string) {
  hoveredCountry.value = label;
}
</script>

<template>
  <div class="world-access-map">
    <svg
      :aria-label="$t('adminAccess.map.worldAria')"
      class="world-access-map__svg"
      role="img"
      viewBox="0 0 1100 540"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <radialGradient id="world-map-ocean" cx="50%" cy="45%" r="70%">
          <stop offset="0" stop-color="#17385b" />
          <stop offset="1" stop-color="#081522" />
        </radialGradient>
        <filter id="world-map-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="1100" height="540" fill="url(#world-map-ocean)" rx="16" />
      <g class="world-access-map__graticule">
        <path d="M0 135H1100M0 270H1100M0 405H1100" />
        <path d="M275 0V540M550 0V540M825 0V540" />
      </g>
      <g class="world-access-map__countries">
        <path
          v-for="feature in features"
          :key="feature.key"
          :class="{ 'is-active': hoveredCountry === feature.label }"
          :d="feature.path"
          :fill="feature.fill"
          @mouseenter="countryEnter(feature.label)"
          @mouseleave="hoveredCountry = ''"
        >
          <title>
            {{ feature.label }} · {{ $t('adminAccess.visitsCount', [formatCount(feature.value)]) }}
          </title>
        </path>
      </g>
      <g data-map-layer="china-maritime">
        <g data-geometry="island">
          <path
            v-for="island in maritimeIslands"
            :key="island.key"
            :d="island.path"
            :fill="countryFill(chinaValue)"
            stroke="rgba(186, 230, 253, 0.55)"
            stroke-width="0.55"
          />
        </g>
        <g data-geometry="boundary-line">
          <path
            v-for="line in maritimeBoundaryLines"
            :key="line.key"
            :d="line.path"
            fill="none"
            stroke="rgba(186, 230, 253, 0.72)"
            stroke-linecap="round"
            stroke-width="0.7"
          />
        </g>
      </g>
      <g class="world-access-map__labels" aria-hidden="true">
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
      <g class="world-access-map__points" filter="url(#world-map-glow)">
        <g
          v-for="point in points"
          :key="point.key"
          class="world-access-map__point"
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
            {{ point.region || point.country || $t('adminAccess.unknownRegion') }} ·
            {{ formatCount(point.value) }}
          </title>
        </g>
      </g>
    </svg>
    <div v-if="hovered" class="world-access-map__tooltip">
      <strong>{{ hovered.region || hovered.country || $t('adminAccess.unknownRegion') }}</strong>
      <span>{{ $t('adminAccess.callsCount', [formatCount(hovered.callCount)]) }} ·
        {{ $t('adminAccess.ipsCount', [formatCount(hovered.uniqueIps)]) }}</span>
      <span v-if="hovered.isp">{{ hovered.isp }}</span>
    </div>
    <div class="world-access-map__legend">
      <span><i class="legend-swatch legend-swatch--normal"></i>{{ $t('adminAccess.map.hotspot') }}</span>
      <span><i class="legend-swatch legend-swatch--danger"></i>{{ $t('adminAccess.map.failureHotspot') }}</span>
      <span>{{ $t('adminAccess.map.worldLegend', [features.length]) }}</span>
    </div>
  </div>
</template>

<style scoped>
.world-access-map {
  position: relative;
  width: 100%;
  min-height: 340px;
  overflow: hidden;
  border-radius: 14px;
  background: #081522;
}

.world-access-map__svg {
  display: block;
  width: 100%;
  min-height: 340px;
}

.world-access-map__graticule path {
  fill: none;
  stroke: rgb(148 163 184 / 16%);
  stroke-dasharray: 3 7;
  stroke-width: 1;
}

.world-access-map__countries path {
  cursor: crosshair;
  stroke: rgb(186 230 253 / 55%);
  stroke-width: 0.55;
  transition:
    fill 180ms ease,
    stroke 180ms ease;
}

.world-access-map__countries path.is-active {
  stroke: #f7c873;
  stroke-width: 1.4;
}

.world-access-map__labels text {
  pointer-events: none;
  fill: rgb(226 232 240 / 62%);
  font-size: 5.6px;
  letter-spacing: 0.1px;
  paint-order: stroke;
  stroke: #081522;
  stroke-width: 1.5px;
}

.world-access-map__point {
  cursor: pointer;
}

.point-halo {
  fill: #67e8f9;
  opacity: 0.2;
}

.point-core {
  fill: #67e8f9;
  stroke: #ecfeff;
  stroke-width: 1;
}

.point-core--danger {
  fill: #fb7185;
  stroke: #ffe4e6;
}

.world-access-map__tooltip {
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

.world-access-map__tooltip strong {
  color: #f8fafc;
  font-size: 13px;
}

.world-access-map__legend {
  position: absolute;
  bottom: 10px;
  left: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  color: rgb(203 213 225 / 72%);
  font-size: 10px;
}

.world-access-map__legend span {
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
  background: #67e8f9;
}

.legend-swatch--danger {
  background: #fb7185;
}
</style>
