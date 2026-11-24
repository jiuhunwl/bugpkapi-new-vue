import type { AdminAccessLocation } from '#/api/core/user';

import { describe, expect, it } from 'vitest';

import {
  chinaMaritimeBoundaryFeatures,
  chinaMaritimeIslandFeatures,
  chinaProvinceFeatures,
  officialChinaFeature,
  officialWorldFeatures,
} from './map-geo-data';
import {
  ADMIN_ACCESS_MAP_REGISTRATIONS,
  buildChina2DOption,
  buildGlobe3DOption,
  buildWorld2DOption,
} from './map-options';

type LooseRecord = Record<string, any>;

const locations: AdminAccessLocation[] = [
  {
    averageElapsedMs: 18,
    callCount: 100,
    city: '北京市',
    country: '中国',
    failedCalls: 4,
    latitude: 39.9042,
    longitude: 116.4074,
    province: '北京市',
    region: '中国 北京市',
    riskHits: 1,
    successCalls: 96,
    uniqueIps: 21,
  },
  {
    averageElapsedMs: 23,
    callCount: 25,
    city: '台北市',
    country: '中国',
    failedCalls: 12,
    latitude: 25.033,
    longitude: 121.5654,
    province: '台湾省',
    region: '中国 台湾省 台北市',
    riskHits: 2,
    successCalls: 13,
    uniqueIps: 8,
  },
  {
    averageElapsedMs: 0,
    callCount: 999,
    country: '未知',
    failedCalls: 999,
    latitude: 95,
    longitude: 200,
    region: '无效坐标',
    riskHits: 0,
    successCalls: 0,
    uniqueIps: 1,
  },
];

function seriesById(option: LooseRecord, id: string) {
  const series = Array.isArray(option.series) ? option.series : [];
  return series.find((item: LooseRecord) => item.id === id) as
    | LooseRecord
    | undefined;
}

function registration(name: string) {
  return ADMIN_ACCESS_MAP_REGISTRATIONS.find((item) => item.name === name);
}

function minimumLatitude(lines: LooseRecord) {
  return Math.min(
    ...lines.data.flatMap((item: LooseRecord) =>
      item.coords.map((coordinate: number[]) => coordinate[1]),
    ),
  );
}

describe('standalone admin access ECharts options', () => {
  it('provides all 34 complete China province labels and a South China Sea inset', () => {
    const option = buildChina2DOption(locations, 'calls') as LooseRecord;
    const chinaMap = registration('bugpk-china-compliant');
    const insetMap = registration('bugpk-china-south-sea-inset');
    const labels = chinaMap?.geoJSON.features.map(
      (feature) => feature.properties?.name,
    );

    expect(labels).toHaveLength(34);
    expect(labels).toEqual(
      expect.arrayContaining([
        '北京市',
        '广西壮族自治区',
        '西藏自治区',
        '新疆维吾尔自治区',
        '台湾省',
        '香港特别行政区',
        '澳门特别行政区',
      ]),
    );
    expect(
      chinaMap?.geoJSON.features.every(
        (feature) =>
          feature.properties?.sourceDataset === 'China_Province_pl@China',
      ),
    ).toBe(true);
    expect(
      chinaMap?.geoJSON.features.every(
        (feature, index) =>
          feature.geometry === chinaProvinceFeatures[index]?.geometry,
      ),
    ).toBe(true);
    expect(
      chinaMap?.geoJSON.features.some(
        (feature) =>
          feature.properties?.adchar === 'JD' ||
          feature.properties?.adcode === '100000_JD',
      ),
    ).toBe(false);
    expect(insetMap?.geoJSON.features).toHaveLength(258);
    expect(
      insetMap?.geoJSON.features.filter(
        (feature) => feature.properties?.kind === 'island',
      ),
    ).toHaveLength(248);
    expect(
      insetMap?.geoJSON.features.filter(
        (feature) => feature.properties?.kind === 'boundary-line',
      ),
    ).toHaveLength(10);
    expect(option.geo).toHaveLength(2);
    expect(option.geo[1]).toMatchObject({
      id: 'china-south-sea-inset',
      map: 'bugpk-china-south-sea-inset',
    });
    expect(option.geo[0].label.formatter({ name: '广西壮族自治区' })).toBe(
      '广西壮族自治区',
    );
  });

  it('renders Taiwan with the shared China province style and no yellow override', () => {
    const option = buildChina2DOption(locations, 'calls') as LooseRecord;
    const serialized = JSON.stringify(option);

    expect(option.geo[0].regions ?? []).toEqual([]);
    expect(option.geo[0].itemStyle).toMatchObject({
      areaColor: expect.any(String),
      borderColor: expect.any(String),
    });
    expect(serialized.toLowerCase()).not.toContain('taiwan-series');
    expect(serialized).not.toContain('#f7c873');
  });

  it('disables geo selection with the supported selectedMode option', () => {
    const china = buildChina2DOption(locations, 'calls') as LooseRecord;
    const world = buildWorld2DOption(locations, 'calls') as LooseRecord;

    expect(china.geo[0].selectedMode).toBe(false);
    expect(china.geo[0]).not.toHaveProperty('select');
    expect(world.geo.selectedMode).toBe(false);
    expect(world.geo).not.toHaveProperty('select');
  });

  it('adds South China Sea territorial lines to China and world 2D maps', () => {
    const china = buildChina2DOption(locations, 'calls') as LooseRecord;
    const world = buildWorld2DOption(locations, 'calls') as LooseRecord;
    const chinaLines = seriesById(china, 'china-south-sea-lines');
    const worldLines = seriesById(world, 'world-china-south-sea-lines');

    expect(chinaLines).toMatchObject({
      coordinateSystem: 'geo',
      polyline: true,
      silent: true,
      type: 'lines',
    });
    expect(worldLines).toMatchObject({
      coordinateSystem: 'geo',
      polyline: true,
      silent: true,
      type: 'lines',
    });
    if (!chinaLines || !worldLines) {
      throw new Error('Expected China and world South China Sea line series');
    }
    expect(chinaLines?.data.length).toBeGreaterThanOrEqual(9);
    expect(worldLines?.data.length).toBe(chinaLines?.data.length);
    expect(minimumLatitude(chinaLines)).toBeLessThan(10);
    expect(worldLines?.data).toEqual(chinaLines?.data);
    expect(
      chinaLines?.data.filter(
        (item: LooseRecord) => item.sourceKind === 'island',
      ),
    ).toHaveLength(chinaMaritimeIslandFeatures.length);
    expect(
      chinaLines?.data.filter(
        (item: LooseRecord) => item.sourceKind === 'boundary-line',
      ),
    ).toHaveLength(chinaMaritimeBoundaryFeatures.length);
    expect(
      chinaLines?.data.some((item: LooseRecord) =>
        String(item.name).startsWith('南海诸岛'),
      ),
    ).toBe(true);
    expect(
      chinaLines?.data.some(
        (item: LooseRecord) => item.name === '南海诸岛归属范围线',
      ),
    ).toBe(true);
  });

  it('uses all 247 official world features with Taiwan inside the single China feature', () => {
    const option = buildWorld2DOption(locations, 'calls') as LooseRecord;
    const worldMap = registration('bugpk-world-compliant');
    const chinaFeatures = worldMap?.geoJSON.features.filter(
      (feature) => feature.properties?.ADM0_A3 === 'CHN',
    );

    expect(worldMap?.geoJSON.features).toHaveLength(247);
    expect(worldMap?.geoJSON.features).toHaveLength(
      officialWorldFeatures.length,
    );
    expect(chinaFeatures).toHaveLength(1);
    expect(chinaFeatures?.[0]?.properties).toMatchObject({
      ADM0_A3: 'CHN',
      name: '中华人民共和国',
      OFFICIAL_NAME_ZH: '中华人民共和国',
    });
    expect(chinaFeatures?.[0]?.geometry).toBe(officialChinaFeature.geometry);
    expect(
      worldMap?.geoJSON.features.some(
        (feature) => feature.properties?.ADM0_A3 === 'TWN',
      ),
    ).toBe(false);
    expect(
      option.series.filter((series: LooseRecord) =>
        /taiwan|台湾/i.test(`${series.id ?? ''} ${series.name ?? ''}`),
      ),
    ).toEqual([]);
  });

  it('uses globe, shared boundary lines and scatter3D for the 3D option', () => {
    const option = buildGlobe3DOption(locations, 'calls') as LooseRecord;
    const worldBoundaries = seriesById(option, 'globe-world-boundaries');
    const chinaBoundaries = seriesById(option, 'globe-china-boundaries');
    const southSea = seriesById(option, 'globe-china-south-sea-lines');
    const hotspots = seriesById(option, 'access-hotspots');

    expect(option.globe).toMatchObject({
      shading: expect.any(String),
      viewControl: {
        autoRotate: true,
      },
    });
    expect(worldBoundaries).toMatchObject({
      coordinateSystem: 'globe',
      polyline: true,
      type: 'lines3D',
    });
    expect(chinaBoundaries).toMatchObject({
      coordinateSystem: 'globe',
      polyline: true,
      type: 'lines3D',
    });
    expect(southSea).toMatchObject({
      coordinateSystem: 'globe',
      polyline: true,
      type: 'lines3D',
    });
    expect(hotspots).toMatchObject({
      coordinateSystem: 'globe',
      type: 'scatter3D',
    });
    if (!southSea) {
      throw new Error('Expected globe South China Sea line series');
    }
    expect(minimumLatitude(southSea)).toBeLessThan(10);
    expect(
      new Set(
        worldBoundaries?.data.map((item: LooseRecord) => item.sourceFeatureId),
      ).size,
    ).toBe(officialWorldFeatures.length);
    expect(
      new Set(
        chinaBoundaries?.data.map((item: LooseRecord) => item.sourceFeatureId),
      ).size,
    ).toBe(chinaProvinceFeatures.length);
    expect(
      southSea?.data.filter(
        (item: LooseRecord) => item.sourceKind === 'island',
      ),
    ).toHaveLength(chinaMaritimeIslandFeatures.length);
    expect(
      southSea?.data.filter(
        (item: LooseRecord) => item.sourceKind === 'boundary-line',
      ),
    ).toHaveLength(chinaMaritimeBoundaryFeatures.length);
    expect(
      option.series.filter((series: LooseRecord) =>
        /taiwan|台湾/i.test(`${series.id ?? ''} ${series.name ?? ''}`),
      ),
    ).toEqual([]);
  });

  it('uses ECharts-GL globe coordinate dimension names for 3D hotspots', () => {
    const option = buildGlobe3DOption(locations, 'calls') as LooseRecord;
    const hotspots = seriesById(option, 'access-hotspots');

    expect(hotspots?.dimensions).toEqual(['lng', 'lat', 'alt', 'metric']);
    expect(hotspots?.encode).toMatchObject({
      alt: 2,
      lat: 1,
      lng: 0,
      tooltip: 3,
    });
    expect(hotspots?.encode).not.toHaveProperty('longitude');
    expect(hotspots?.encode).not.toHaveProperty('latitude');
    expect(hotspots?.encode).not.toHaveProperty('altitude');
  });

  it('pins the globe altitude domain so boundaries stay on the sphere', () => {
    const option = buildGlobe3DOption(locations, 'calls') as LooseRecord;
    const altitudeDomain = seriesById(option, 'globe-altitude-domain');

    expect(option.globe).toMatchObject({
      globeOuterRadius: 88,
      globeRadius: 84,
    });
    expect(altitudeDomain).toMatchObject({
      coordinateSystem: 'globe',
      dimensions: ['lng', 'lat', 'alt'],
      encode: { alt: 2, lat: 1, lng: 0 },
      itemStyle: { opacity: 0 },
      silent: true,
      symbolSize: 0,
      tooltip: { show: false },
      type: 'scatter3D',
    });
    expect(altitudeDomain?.data).toEqual([
      [0, 0, 0],
      [0, 0, 0.8],
    ]);
  });

  it.each([
    ['china', buildChina2DOption],
    ['world', buildWorld2DOption],
    ['globe', buildGlobe3DOption],
  ] as const)(
    'preserves hotspot values, colors and monotonic sizing for %s',
    (_name, builder) => {
      const callsOption = builder(locations, 'calls') as LooseRecord;
      const failuresOption = builder(locations, 'failures') as LooseRecord;
      const calls = seriesById(callsOption, 'access-hotspots');
      const failures = seriesById(failuresOption, 'access-hotspots');

      if (!calls || !failures) {
        throw new Error('Expected access hotspot series for both metrics');
      }

      expect(calls.data).toHaveLength(2);
      expect(failures.data).toHaveLength(2);
      expect(calls.data.map((item: LooseRecord) => item.metricValue)).toEqual([
        100, 25,
      ]);
      expect(
        failures.data.map((item: LooseRecord) => item.metricValue),
      ).toEqual([4, 12]);
      expect(calls.itemStyle.color).toBe('#67e8f9');
      expect(failures.itemStyle.color).toBe('#fb7185');
      expect(calls.symbolSize(calls.data[0].value)).toBeGreaterThan(
        calls.symbolSize(calls.data[1].value),
      );
      expect(failures.symbolSize(failures.data[1].value)).toBeGreaterThan(
        failures.symbolSize(failures.data[0].value),
      );
    },
  );
});
