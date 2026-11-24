import type { AdminAccessLocation } from '#/api/core/user';
import type { GeoJSONFeature } from './geo-utils';

import {
  chinaMaritimeBoundaryFeatures,
  chinaMaritimeIslandFeatures,
  chinaProvinceFeatures,
  officialChinaFeature,
  officialWorldFeatures,
} from './map-geo-data';
import { $t } from '#/locales';
import { asLines, chinaProvinceLabel } from './geo-utils';

type Metric = 'calls' | 'failures';
type Position = [number, number];
type Position3D = [number, number, number, number];

interface MapGeoJSONFeature extends GeoJSONFeature {
  type?: string;
}

interface MapGeoJSONCollection {
  features: MapGeoJSONFeature[];
  type: 'FeatureCollection';
}

interface BoundaryDatum {
  coords: Position[];
  name: string;
  sourceFeatureId: unknown;
  sourceKind?: string;
}

export interface AdminAccessMapRegistration {
  geoJSON: MapGeoJSONCollection;
  name: string;
}

const CHINA_MAP_NAME = 'bugpk-china-compliant';
const CHINA_SOUTH_SEA_MAP_NAME = 'bugpk-china-south-sea-inset';
const WORLD_MAP_NAME = 'bugpk-world-compliant';

const CALL_COLOR = '#67e8f9';
const FAILURE_COLOR = '#fb7185';
const MAP_AREA_COLOR = '#17334a';
const MAP_BORDER_COLOR = '#9be7f4';
const CHINA_BORDER_COLOR = '#5eead4';

const chinaAdministrativeFeatures = chinaProvinceFeatures.map((feature) =>
  normalizeFeatureName(feature, chinaProvinceLabel(feature)),
);

const normalizedOfficialChinaFeature = normalizeFeatureName(
  officialChinaFeature,
  '中华人民共和国',
);
const normalizedWorldFeatures = officialWorldFeatures.map((feature) =>
  feature === officialChinaFeature
    ? normalizedOfficialChinaFeature
    : normalizeFeatureName(feature, worldFeatureName(feature)),
);

const normalizedMaritimeIslandFeatures = chinaMaritimeIslandFeatures.map(
  (feature, index) =>
    normalizeFeatureName(
      feature,
      feature.properties?.NAME_ZH ?? `南海诸岛 ${index + 1}`,
    ),
);
const normalizedMaritimeBoundaryFeatures = chinaMaritimeBoundaryFeatures.map(
  (feature, index) =>
    normalizeFeatureName(
      feature,
      feature.properties?.NAME_ZH ?? `南海界线 ${index + 1}`,
    ),
);

const chinaMapGeoJSON: MapGeoJSONCollection = {
  features: chinaAdministrativeFeatures,
  type: 'FeatureCollection',
};

const southChinaSeaInsetGeoJSON: MapGeoJSONCollection = {
  features: [
    ...normalizedMaritimeIslandFeatures,
    ...normalizedMaritimeBoundaryFeatures,
  ],
  type: 'FeatureCollection',
};

const worldMapGeoJSON: MapGeoJSONCollection = {
  features: normalizedWorldFeatures,
  type: 'FeatureCollection',
};

/**
 * Runtime setup is intentionally left to the caller so this module has no
 * hard dependency on a chart renderer:
 *
 * 1. Install `echarts` for the 2D options and `echarts-gl` for the globe.
 * 2. Call `echarts.registerMap(registration.name, registration.geoJSON)` for
 *    every entry below before passing a 2D option to `chart.setOption()`.
 * 3. Import `echarts-gl` once before using `buildGlobe3DOption()`.
 *
 * The module performs no remote map or texture requests at runtime.
 */
export const ADMIN_ACCESS_MAP_REGISTRATIONS: readonly AdminAccessMapRegistration[] =
  [
    { geoJSON: chinaMapGeoJSON, name: CHINA_MAP_NAME },
    {
      geoJSON: southChinaSeaInsetGeoJSON,
      name: CHINA_SOUTH_SEA_MAP_NAME,
    },
    { geoJSON: worldMapGeoJSON, name: WORLD_MAP_NAME },
  ];

const worldBoundaryData = boundaryData(normalizedWorldFeatures);
const chinaBoundaryData = boundaryData(chinaAdministrativeFeatures);
const southChinaSeaBoundaryData = [
  ...boundaryData(normalizedMaritimeIslandFeatures, 'island'),
  ...boundaryData(normalizedMaritimeBoundaryFeatures, 'boundary-line'),
];

export function buildChina2DOption(
  locations: readonly AdminAccessLocation[],
  metric: Metric = 'calls',
) {
  return {
    animationDurationUpdate: 500,
    backgroundColor: 'transparent',
    geo: [
      {
        emphasis: {
          itemStyle: {
            areaColor: '#20516a',
            borderColor: '#cffafe',
          },
          label: { color: '#f8fafc' },
        },
        id: 'china-main-map',
        itemStyle: {
          areaColor: MAP_AREA_COLOR,
          borderColor: CHINA_BORDER_COLOR,
          borderWidth: 0.8,
        },
        label: {
          color: '#dbeafe',
          fontSize: 9,
          formatter: completeRegionLabel,
          show: true,
        },
        layoutCenter: ['48%', '48%'],
        layoutSize: '102%',
        map: CHINA_MAP_NAME,
        nameProperty: 'name',
        roam: true,
        selectedMode: false,
      },
      {
        bottom: '7%',
        id: 'china-south-sea-inset',
        itemStyle: {
          areaColor: '#112f43',
          borderColor: CHINA_BORDER_COLOR,
          borderWidth: 0.7,
        },
        label: { show: false },
        map: CHINA_SOUTH_SEA_MAP_NAME,
        nameProperty: 'name',
        right: '4%',
        roam: false,
        silent: true,
        width: '22%',
      },
    ],
    series: [
      build2DTerritorialLines(
        'china-south-sea-lines',
        southChinaSeaBoundaryData,
        1,
      ),
      build2DHotspots(locations, metric, {
        east: 136,
        north: 54,
        south: 3,
        west: 72,
      }),
    ],
    tooltip: { confine: true, trigger: 'item' },
  };
}

export function buildWorld2DOption(
  locations: readonly AdminAccessLocation[],
  metric: Metric = 'calls',
) {
  return {
    animationDurationUpdate: 500,
    backgroundColor: 'transparent',
    geo: {
      emphasis: {
        itemStyle: {
          areaColor: '#24516c',
          borderColor: '#ecfeff',
        },
        label: { color: '#f8fafc' },
      },
      id: 'world-main-map',
      itemStyle: {
        areaColor: '#1f344d',
        borderColor: MAP_BORDER_COLOR,
        borderWidth: 0.55,
      },
      label: {
        color: '#cbd5e1',
        fontSize: 6,
        formatter: completeRegionLabel,
        show: true,
      },
      map: WORLD_MAP_NAME,
      nameProperty: 'name',
      roam: true,
      selectedMode: false,
    },
    series: [
      build2DTerritorialLines(
        'world-china-south-sea-lines',
        southChinaSeaBoundaryData,
        0,
      ),
      build2DHotspots(locations, metric),
    ],
    tooltip: { confine: true, trigger: 'item' },
  };
}

export function buildGlobe3DOption(
  locations: readonly AdminAccessLocation[],
  metric: Metric = 'calls',
) {
  return {
    backgroundColor: 'transparent',
    globe: {
      atmosphere: { show: true },
      environment: '#06121e',
      globeOuterRadius: 88,
      globeRadius: 84,
      light: {
        ambient: { intensity: 0.8 },
        main: { intensity: 1.4, shadow: false },
      },
      shading: 'lambert',
      viewControl: {
        autoRotate: true,
        autoRotateSpeed: 2.2,
        distance: 190,
        minDistance: 125,
        maxDistance: 300,
        panSensitivity: 0,
        rotateSensitivity: 1,
        zoomSensitivity: 1,
      },
    },
    series: [
      buildGlobeAltitudeDomain(),
      build3DBoundaries(
        'globe-world-boundaries',
        '全球国家/地区边界',
        worldBoundaryData,
        MAP_BORDER_COLOR,
        0.55,
      ),
      build3DBoundaries(
        'globe-china-boundaries',
        '中国省级行政区边界',
        chinaBoundaryData,
        CHINA_BORDER_COLOR,
        0.8,
      ),
      build3DBoundaries(
        'globe-china-south-sea-lines',
        '中国南海界线',
        southChinaSeaBoundaryData,
        CHINA_BORDER_COLOR,
        1,
      ),
      build3DHotspots(locations, metric),
    ],
    tooltip: { confine: true, trigger: 'item' },
  };
}

function normalizeFeatureName(
  feature: MapGeoJSONFeature,
  name: unknown,
): MapGeoJSONFeature {
  return {
    ...feature,
    properties: {
      ...feature.properties,
      name: String(name ?? '').trim(),
    },
  };
}

function worldFeatureName(feature: MapGeoJSONFeature) {
  const properties = feature.properties ?? {};
  const code = String(properties.ADM0_A3 ?? '')
    .trim()
    .toUpperCase();
  if (code === 'CHN') return '中华人民共和国';
  return String(
    properties.OFFICIAL_NAME_ZH ??
      properties.NAME_ZH ??
      properties.COUNTRY ??
      properties.NAME ??
      properties.ADMIN ??
      properties.SOVEREIGNT ??
      '未知地区',
  ).trim();
}

function completeRegionLabel(parameters: { name?: unknown }) {
  return String(parameters.name ?? '').trim();
}

function featureLineStrings(feature: MapGeoJSONFeature): Position[][] {
  return asLines(feature).map((line) =>
    line.map(([longitude, latitude]) => [longitude, latitude]),
  );
}

function splitDateLine(line: Position[]) {
  const segments: Position[][] = [];
  let current: Position[] = [];
  for (const coordinate of line) {
    const previous = current[current.length - 1];
    if (previous && Math.abs(coordinate[0] - previous[0]) > 180) {
      if (current.length >= 2) segments.push(current);
      current = [];
    }
    current.push(coordinate);
  }
  if (current.length >= 2) segments.push(current);
  return segments;
}

function boundaryData(
  features: readonly MapGeoJSONFeature[],
  sourceKind?: string,
): BoundaryDatum[] {
  return features.flatMap((feature) => {
    const name = String(feature.properties?.name ?? '未知地区');
    const sourceFeatureId = feature.properties?.sourceFeatureId;
    return featureLineStrings(feature)
      .flatMap((line) => splitDateLine(line))
      .map((coords) => ({
        coords,
        name,
        sourceFeatureId,
        sourceKind,
      }));
  });
}

function build2DTerritorialLines(
  id: string,
  data: BoundaryDatum[],
  geoIndex: number,
) {
  return {
    coordinateSystem: 'geo',
    data,
    effect: { show: false },
    geoIndex,
    id,
    lineStyle: {
      color: CHINA_BORDER_COLOR,
      opacity: 0.95,
      type: 'dashed',
      width: 1.2,
    },
    polyline: true,
    silent: true,
    type: 'lines',
    zlevel: 3,
  };
}

function build3DBoundaries(
  id: string,
  name: string,
  data: BoundaryDatum[],
  color: string,
  width: number,
) {
  return {
    blendMode: 'lighter',
    coordinateSystem: 'globe',
    data,
    id,
    lineStyle: {
      color,
      opacity: 0.72,
      width,
    },
    name,
    polyline: true,
    silent: true,
    type: 'lines3D',
  };
}

function buildGlobeAltitudeDomain() {
  return {
    coordinateSystem: 'globe',
    data: [
      [0, 0, 0],
      [0, 0, 0.8],
    ],
    dimensions: ['lng', 'lat', 'alt'],
    encode: {
      alt: 2,
      lat: 1,
      lng: 0,
    },
    id: 'globe-altitude-domain',
    itemStyle: { opacity: 0 },
    silent: true,
    symbolSize: 0,
    tooltip: { show: false },
    type: 'scatter3D',
  };
}

function build2DHotspots(
  locations: readonly AdminAccessLocation[],
  metric: Metric,
  bounds?: { east: number; north: number; south: number; west: number },
) {
  const data = hotspotData(locations, metric, false, bounds);
  return {
    coordinateSystem: 'geo',
    data,
    geoIndex: 0,
    id: 'access-hotspots',
    itemStyle: {
      color: metricColor(metric),
      shadowBlur: 14,
      shadowColor: metricColor(metric),
    },
    name: metric === 'failures' ? '失败热点' : '访问热点',
    rippleEffect: {
      brushType: 'stroke',
      period: 4,
      scale: 3.4,
    },
    showEffectOn: 'render',
    symbol: 'circle',
    symbolSize: hotspotSymbolSize(data, false),
    tooltip: { formatter: hotspotTooltip },
    type: 'effectScatter',
    zlevel: 5,
  };
}

function build3DHotspots(
  locations: readonly AdminAccessLocation[],
  metric: Metric,
) {
  const data = hotspotData(locations, metric, true);
  return {
    blendMode: 'lighter',
    coordinateSystem: 'globe',
    data,
    dimensions: ['lng', 'lat', 'alt', 'metric'],
    encode: {
      alt: 2,
      lat: 1,
      lng: 0,
      tooltip: 3,
    },
    id: 'access-hotspots',
    itemStyle: {
      color: metricColor(metric),
      opacity: 0.96,
    },
    name: metric === 'failures' ? '失败热点' : '访问热点',
    symbol: 'circle',
    symbolSize: hotspotSymbolSize(data, true),
    tooltip: { formatter: hotspotTooltip },
    type: 'scatter3D',
  };
}

function hotspotData(
  locations: readonly AdminAccessLocation[],
  metric: Metric,
  threeDimensional: boolean,
  bounds?: { east: number; north: number; south: number; west: number },
) {
  return locations
    .map((location, index) => {
      const latitude = finiteCoordinate(location.latitude, -90, 90);
      const longitude = finiteCoordinate(location.longitude, -180, 180);
      if (latitude === null || longitude === null) return null;
      if (
        bounds &&
        (longitude < bounds.west ||
          longitude > bounds.east ||
          latitude < bounds.south ||
          latitude > bounds.north)
      ) {
        return null;
      }
      const metricValue = Math.max(
        0,
        Number(
          metric === 'failures' ? location.failedCalls : location.callCount,
        ) || 0,
      );
      const value: Position3D | [number, number, number] = threeDimensional
        ? [longitude, latitude, 0.8, metricValue]
        : [longitude, latitude, metricValue];
      return {
        key: `${location.region}-${latitude}-${longitude}-${index}`,
        location,
        metricValue,
        name:
          location.region ||
          location.province ||
          location.city ||
          location.country ||
          '未知地区',
        value,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
}

function hotspotSymbolSize(
  data: Array<{ metricValue: number }>,
  threeDimensional: boolean,
) {
  const maximum = Math.max(1, ...data.map((item) => item.metricValue));
  const minimumSize = threeDimensional ? 7 : 5;
  const sizeRange = threeDimensional ? 18 : 14;
  return (value: unknown) => {
    const metricValue = Array.isArray(value)
      ? Math.max(0, Number(value[value.length - 1]) || 0)
      : Math.max(0, Number(value) || 0);
    return minimumSize + Math.sqrt(metricValue / maximum) * sizeRange;
  };
}

function finiteCoordinate(value: unknown, minimum: number, maximum: number) {
  if (value === null || value === undefined || value === '') return null;
  const numberValue = Number(value);
  if (
    !Number.isFinite(numberValue) ||
    numberValue < minimum ||
    numberValue > maximum
  ) {
    return null;
  }
  return numberValue;
}

function metricColor(metric: Metric) {
  return metric === 'failures' ? FAILURE_COLOR : CALL_COLOR;
}

function hotspotTooltip(parameters: {
  data?: { location?: AdminAccessLocation; metricValue?: number };
}) {
  const location = parameters.data?.location;
  if (!location) return '';
  const title = escapeHtml(
    location.region ||
      location.province ||
      location.city ||
      location.country ||
      $t('adminAccess.unknownRegion'),
  );
  const value = new Intl.NumberFormat('zh-CN').format(
    Number(parameters.data?.metricValue) || 0,
  );
  const calls = new Intl.NumberFormat('zh-CN').format(location.callCount || 0);
  const uniqueIps = new Intl.NumberFormat('zh-CN').format(
    location.uniqueIps || 0,
  );
  return `${title}<br/>${$t('adminAccess.map.hotspotMetric', [value])}<br/>${$t('adminAccess.map.hotspotCalls', [calls, uniqueIps])}`;
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
