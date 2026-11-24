import type { AdminAccessLocation } from '#/api/core/user';

import { createApp, h } from 'vue';

import { describe, expect, it } from 'vitest';

import DrilldownMap from './DrilldownMap.vue';
import { installTestI18n } from './test-i18n';

/**
 * 构造一个简单的市级 GeoJSON（广州市下属区县模拟）。
 */
function makeCityGeoJSON() {
  return {
    type: 'FeatureCollection' as const,
    features: [
      makeFeature('440103', '荔湾区', [113.22, 23.03]),
      makeFeature('440104', '越秀区', [113.27, 23.13]),
      makeFeature('440105', '海珠区', [113.26, 23.08]),
      makeFeature('440106', '天河区', [113.36, 23.12]),
      makeFeature('440111', '白云区', [113.27, 23.16]),
    ],
  };
}

function makeFeature(adcode: string, name: string, center: [number, number]) {
  const [lon, lat] = center;
  const delta = 0.05;
  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [lon - delta, lat - delta],
          [lon + delta, lat - delta],
          [lon + delta, lat + delta],
          [lon - delta, lat + delta],
          [lon - delta, lat - delta],
        ],
      ],
    },
    properties: { adcode, name, center },
  };
}

function makeLocation(
  region: string,
  callCount = 100,
  city = '广州市',
): AdminAccessLocation {
  return {
    averageElapsedMs: 50,
    callCount,
    city,
    country: '中国',
    failedCalls: 0,
    firstSeen: '2026-01-01',
    isp: 'Test ISP',
    lastSeen: '2026-01-02',
    province: '广东省',
    region: `广东省 ${city} ${region}`,
    riskHits: 0,
    successCalls: callCount,
    uniqueIps: 10,
  };
}

function mountMap(props: Record<string, unknown>) {
  const container = document.createElement('div');
  document.body.append(container);
  const app = createApp(DrilldownMap, props);
  installTestI18n(app);
  app.mount(container);
  return {
    container,
    unmount: () => {
      app.unmount();
      container.remove();
    },
  };
}

describe('DrilldownMap rendering', () => {
  it('renders the correct number of region paths from GeoJSON', () => {
    const { container, unmount } = mountMap({
      geoJSON: makeCityGeoJSON(),
      locations: [],
      metric: 'calls',
      granularity: 'district',
      parentLabel: '广州市',
    });

    const paths = container.querySelectorAll('.drilldown-map__region');
    expect(paths).toHaveLength(5);
    unmount();
  });

  it('renders label text for each feature', () => {
    const { container, unmount } = mountMap({
      geoJSON: makeCityGeoJSON(),
      locations: [],
      metric: 'calls',
      granularity: 'district',
      parentLabel: '广州市',
    });

    const labels = [
      ...container.querySelectorAll('.drilldown-map__labels text'),
    ].map((node) => node.textContent?.trim());

    expect(labels).toContain('荔湾区');
    expect(labels).toContain('天河区');
    expect(labels).toContain('白云区');
    unmount();
  });

  it('shows the data source attribution text', () => {
    const { container, unmount } = mountMap({
      geoJSON: makeCityGeoJSON(),
      locations: [],
      metric: 'calls',
      granularity: 'district',
      parentLabel: '广州市',
    });

    const attribution = container.querySelector('.drilldown-map__data-source');
    expect(attribution?.textContent).toContain('阿里云 DataV');
    expect(attribution?.textContent).toContain('国家基础地理信息中心');
    unmount();
  });

  it('shows loading overlay when loading=true', () => {
    const { container, unmount } = mountMap({
      geoJSON: makeCityGeoJSON(),
      locations: [],
      metric: 'calls',
      granularity: 'district',
      parentLabel: '广州市',
      loading: true,
    });

    const loadingEl = container.querySelector('.drilldown-map__loading');
    expect(loadingEl).not.toBeNull();
    expect(loadingEl?.textContent).toContain('正在加载');
    unmount();
  });

  it('shows empty hint when GeoJSON has no features', () => {
    const { container, unmount } = mountMap({
      geoJSON: { type: 'FeatureCollection', features: [] },
      locations: [],
      metric: 'calls',
      granularity: 'district',
      parentLabel: '广州市',
    });

    const hint = container.querySelector('.drilldown-map__empty-hint');
    expect(hint).not.toBeNull();
    expect(hint?.textContent).toContain('暂无下属区划');
    unmount();
  });

  it('shows error message banner when errorMessage is provided', () => {
    const { container, unmount } = mountMap({
      geoJSON: makeCityGeoJSON(),
      locations: [],
      metric: 'calls',
      granularity: 'district',
      parentLabel: '广州市',
      errorMessage: '区县数据加载失败',
    });

    const errorEl = container.querySelector('.drilldown-map__error');
    expect(errorEl).not.toBeNull();
    expect(errorEl?.textContent).toContain('区县数据加载失败');
    unmount();
  });

  it('emits drill event with adcode when clicking a region (not deepest)', async () => {
    let emitted: { adcode: string; granularity: string; label: string } | null =
      null;
    const container = document.createElement('div');
    document.body.append(container);
    const app = createApp({
      setup() {
        return () =>
          h(DrilldownMap, {
            geoJSON: makeCityGeoJSON(),
            locations: [],
            metric: 'calls',
            granularity: 'district',
            parentLabel: '广州市',
            isDeepest: false,
            onDrill: (payload: {
              adcode: string;
              granularity: string;
              label: string;
            }) => {
              emitted = payload;
            },
          });
      },
    });
    installTestI18n(app);
    app.mount(container);

    const firstPath = container.querySelector(
      '.drilldown-map__region',
    ) as SVGPathElement | null;
    expect(firstPath).not.toBeNull();
    firstPath?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    // Wait a tick for Vue event processing.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(emitted).toEqual({
      adcode: '440103',
      granularity: 'district',
      label: '荔湾区',
    });

    app.unmount();
    container.remove();
  });

  it('adapts projection bbox for different GeoJSON bounds', () => {
    // Small bbox GeoJSON
    const smallGeo = {
      type: 'FeatureCollection' as const,
      features: [
        makeFeature('001', '小区1', [113.2, 23.0]),
        makeFeature('002', '小区2', [113.4, 23.2]),
      ],
    };
    const { container: smallContainer, unmount: unmountSmall } = mountMap({
      geoJSON: smallGeo,
      locations: [],
      metric: 'calls',
      granularity: 'district',
      parentLabel: '广州市',
    });

    const smallPaths = smallContainer.querySelectorAll(
      '.drilldown-map__region',
    );
    expect(smallPaths).toHaveLength(2);
    // All paths should have valid d attributes within viewBox 0 0 1000 560
    smallPaths.forEach((path) => {
      const d = path.getAttribute('d');
      expect(d).toBeTruthy();
      expect(d!.length).toBeGreaterThan(10);
    });
    unmountSmall();
  });

  it('renders points for locations with valid coordinates', () => {
    const locations = [makeLocation('天河区'), makeLocation('越秀区')];
    // Add coordinates to locations
    const locatedLocations = locations.map((loc, i) => ({
      ...loc,
      latitude: 23.1 + i * 0.05,
      longitude: 113.3 + i * 0.05,
    }));

    const { container, unmount } = mountMap({
      geoJSON: makeCityGeoJSON(),
      locations: locatedLocations,
      metric: 'calls',
      granularity: 'district',
      parentLabel: '广州市',
    });

    const points = container.querySelectorAll('.drilldown-map__point');
    expect(points.length).toBeGreaterThan(0);
    unmount();
  });
});
