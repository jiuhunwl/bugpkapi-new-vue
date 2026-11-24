import type { DatavGeoJSON } from './datav-geo-loader';

import { describe, expect, it } from 'vitest';

import './test-i18n';

import {
  DIRECT_MUNICIPALITY_ADCODES,
  HAINAN_ADCODE,
  useDrilldown,
} from './useDrilldown';

function makeGeoJSON(): DatavGeoJSON {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [113, 23],
              [114, 23],
              [114, 24],
              [113, 24],
              [113, 23],
            ],
          ],
        },
        properties: { adcode: '440100', name: '广州市' },
      },
    ],
  };
}

/**
 * 创建一个 mock loader，同步返回 GeoJSON。
 */
function createMockLoader() {
  return {
    loadGeoJSON: async () => makeGeoJSON(),
    has: () => true,
    clear: () => {},
  };
}

describe('useDrilldown', () => {
  it('starts at depth 0 with empty stack', () => {
    const dd = useDrilldown(createMockLoader());
    expect(dd.depth.value).toBe(0);
    expect(dd.current.value).toBeNull();
    expect(dd.stack.value).toHaveLength(0);
  });

  it('enter() pushes level and increments depth', async () => {
    const dd = useDrilldown(createMockLoader());
    await dd.enter('440000', '广东省', 'province');
    expect(dd.depth.value).toBe(1);
    expect(dd.current.value).toMatchObject({
      adcode: '440000',
      label: '广东省',
      granularity: 'city',
    });
    expect(dd.geoJSON.value).not.toBeNull();
  });

  it('back() pops the stack and decrements depth', async () => {
    const dd = useDrilldown(createMockLoader());
    await dd.enter('440000', '广东省', 'province');
    expect(dd.depth.value).toBe(1);
    dd.back();
    expect(dd.depth.value).toBe(0);
    expect(dd.current.value).toBeNull();
  });

  it('reset() clears the entire stack', async () => {
    const dd = useDrilldown(createMockLoader());
    await dd.enter('440000', '广东省', 'province');
    await dd.enter('440100', '广州市', 'city');
    dd.reset();
    expect(dd.depth.value).toBe(0);
    expect(dd.stack.value).toHaveLength(0);
  });

  it('breadcrumb includes "全国" root with isLast when at depth 0', () => {
    const dd = useDrilldown(createMockLoader());
    const items = dd.breadcrumb.value;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ label: '全国', isLast: true, index: -1 });
  });

  it('breadcrumb marks only the last item as isLast after entering', async () => {
    const dd = useDrilldown(createMockLoader());
    await dd.enter('440000', '广东省', 'province');
    const items = dd.breadcrumb.value;
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ label: '全国', isLast: false });
    expect(items[1]).toMatchObject({ label: '广东省', isLast: true });
  });

  it('direct municipality (Beijing) skips city to district granularity', async () => {
    const dd = useDrilldown(createMockLoader());
    await dd.enter('110000', '北京市', 'province');
    expect(dd.current.value).toMatchObject({
      adcode: '110000',
      granularity: 'district',
    });
  });

  it('Shanghai as direct municipality skips city layer', async () => {
    const dd = useDrilldown(createMockLoader());
    await dd.enter('310000', '上海市', 'province');
    expect(dd.current.value?.granularity).toBe('district');
  });

  it('Hainan province skips city layer', async () => {
    const dd = useDrilldown(createMockLoader());
    await dd.enter(HAINAN_ADCODE, '海南省', 'province');
    expect(dd.current.value?.granularity).toBe('district');
  });

  it('normal province enters city granularity', async () => {
    const dd = useDrilldown(createMockLoader());
    await dd.enter('440000', '广东省', 'province');
    expect(dd.current.value?.granularity).toBe('city');
  });

  it('enter from city goes to district', async () => {
    const dd = useDrilldown(createMockLoader());
    await dd.enter('440000', '广东省', 'province');
    await dd.enter('440100', '广州市', 'city');
    expect(dd.depth.value).toBe(2);
    expect(dd.current.value).toMatchObject({
      adcode: '440100',
      granularity: 'district',
    });
  });

  it('cannot drill deeper than max depth (2)', async () => {
    const dd = useDrilldown(createMockLoader());
    await dd.enter('440000', '广东省', 'province');
    await dd.enter('440100', '广州市', 'city');
    expect(dd.canDrillDeeper.value).toBe(false);
    // Attempting to enter again should not increase depth
    await dd.enter('440106', '天河区', 'district');
    expect(dd.depth.value).toBe(2);
  });

  it('serialize() returns a copy of the stack', async () => {
    const dd = useDrilldown(createMockLoader());
    await dd.enter('440000', '广东省', 'province');
    const serialized = dd.serialize();
    expect(serialized).toHaveLength(1);
    expect(serialized[0]).toMatchObject({ adcode: '440000' });
    // Mutating the copy should not affect the original
    serialized[0]!.adcode = '999999';
    expect(dd.stack.value[0]?.adcode).toBe('440000');
  });

  it('restoreFrom() restores the stack state', async () => {
    const dd = useDrilldown(createMockLoader());
    const saved: Array<{ adcode: string; label: string; granularity: 'city' | 'district' | 'province' }> = [
      { adcode: '440000', label: '广东省', granularity: 'city' },
    ];
    dd.restoreFrom(saved);
    expect(dd.depth.value).toBe(1);
    expect(dd.current.value).toMatchObject({ adcode: '440000' });
  });

  it('granularityLabel reflects the current level', async () => {
    const dd = useDrilldown(createMockLoader());
    expect(dd.granularityLabel.value).toBe('省级');
    await dd.enter('440000', '广东省', 'province');
    expect(dd.granularityLabel.value).toBe('市级');
    await dd.enter('440100', '广州市', 'city');
    expect(dd.granularityLabel.value).toBe('区县级');
  });

  it('DIRECT_MUNICIPALITY_ADCODES contains Beijing, Shanghai, Tianjin, Chongqing', () => {
    expect(DIRECT_MUNICIPALITY_ADCODES.has('110000')).toBe(true);
    expect(DIRECT_MUNICIPALITY_ADCODES.has('120000')).toBe(true);
    expect(DIRECT_MUNICIPALITY_ADCODES.has('310000')).toBe(true);
    expect(DIRECT_MUNICIPALITY_ADCODES.has('500000')).toBe(true);
    expect(DIRECT_MUNICIPALITY_ADCODES.has('440000')).toBe(false);
  });
});
