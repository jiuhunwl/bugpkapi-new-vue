import { createApp } from 'vue';

import { describe, expect, it } from 'vitest';

import ChinaAccessMap from './ChinaAccessMap.vue';
import { asRings, createEquirectangularProjection } from './geo-utils';
import { chinaProvinceFeatures } from './map-geo-data';
import { installTestI18n } from './test-i18n';

describe('ChinaAccessMap territorial rendering', () => {
  it('uses the same province style for Taiwan, Hong Kong and Macau', () => {
    const { container, unmount } = mountMap();

    expect(
      container.querySelectorAll('.china-access-map__provinces path.is-special'),
    ).toHaveLength(0);
    expect(
      container.querySelectorAll('.china-access-map__labels text.is-special'),
    ).toHaveLength(0);
    unmount();
  });

  it('shows complete province-level labels without abbreviating suffixes', () => {
    const { container, unmount } = mountMap();
    const labels = [
      ...container.querySelectorAll('.china-access-map__labels text'),
    ].map((node) => node.textContent?.trim());

    expect(labels).toContain('北京市');
    expect(labels).toContain('内蒙古自治区');
    expect(labels).toContain('新疆维吾尔自治区');
    expect(labels).toContain('台湾省');
    expect(labels).toContain('香港特别行政区');
    expect(labels).toContain('澳门特别行政区');
    unmount();
  });

  it('keeps the complete Hong Kong and Macau labels clear of Guangdong', () => {
    const { container, unmount } = mountMap();
    const labels = [
      ...container.querySelectorAll('.china-access-map__labels text'),
    ];
    const position = (label: string) => {
      const node = labels.find((item) => item.textContent?.trim() === label);
      return [
        Number(node?.getAttribute('x')),
        Number(node?.getAttribute('y')),
      ] as const;
    };
    const distance = (
      left: readonly [number, number],
      right: readonly [number, number],
    ) => Math.hypot(left[0] - right[0], left[1] - right[1]);
    const guangdong = position('广东省');

    expect(distance(position('香港特别行政区'), guangdong)).toBeGreaterThan(25);
    expect(distance(position('澳门特别行政区'), guangdong)).toBeGreaterThan(25);
    expect(
      distance(position('香港特别行政区'), position('澳门特别行政区')),
    ).toBeGreaterThan(35);
    unmount();
  });

  it('renders a South China Sea inset with islands and the official boundary line', () => {
    const { container, unmount } = mountMap();
    const inset = container.querySelector(
      '[data-map-layer="south-china-sea-inset"]',
    );

    expect(inset).not.toBeNull();
    expect(
      inset?.querySelectorAll('[data-geometry="island"] path').length,
    ).toBeGreaterThan(0);
    expect(
      inset?.querySelectorAll('[data-geometry="boundary-line"] path'),
    ).toHaveLength(10);
    expect(inset?.textContent).toContain('南海诸岛');
    unmount();
  });

  it('clips the province layer to the official China outline and keeps the inset clear of Taiwan', () => {
    const { container, unmount } = mountMap();
    const provinceLayer = container.querySelector(
      '.china-access-map__provinces',
    );
    const outline = container.querySelector(
      '[data-map-layer="official-china-outline"]',
    );
    const inset = container.querySelector(
      '[data-map-layer="south-china-sea-inset"]',
    );
    const insetFrame = inset?.querySelector('rect');
    const insetX = Number(
      inset?.getAttribute('transform')?.match(/^translate\((\d+)/)?.[1],
    );
    const taiwan = chinaProvinceFeatures.find(
      (feature) => String(feature.properties?.adcode ?? '') === '710000',
    );
    const projection = createEquirectangularProjection(1000, 560, {
      east: 136,
      north: 54,
      south: 17,
      west: 72,
    });
    const taiwanRightEdge = Math.max(
      ...(taiwan ? asRings(taiwan).flat() : []).map(
        ([longitude, latitude]) => projection(longitude, latitude)[0],
      ),
    );

    expect(provinceLayer?.getAttribute('clip-path')).toBe(
      'url(#china-map-official-territory)',
    );
    expect(outline?.getAttribute('d')?.length).toBeGreaterThan(100);
    expect(insetX).toBeGreaterThan(taiwanRightEdge);
    expect(Number(insetFrame?.getAttribute('width'))).toBeLessThanOrEqual(180);
    unmount();
  });
});

function mountMap() {
  const container = document.createElement('div');
  document.body.append(container);
  const app = createApp(ChinaAccessMap, { locations: [] });
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
