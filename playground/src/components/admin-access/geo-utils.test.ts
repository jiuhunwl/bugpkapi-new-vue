import { describe, expect, it } from 'vitest';

import chinaGeoJSON from '#/assets/maps/china.json';
import worldGeoJSON from '#/assets/maps/world.json';

import {
  accessLocationLabel,
  chinaProvinceLabel,
  createEquirectangularProjection,
  featureLabel,
  featurePath,
  isChinaWorldFeature,
} from './geo-utils';

const legacySimplifiedName = String.fromCodePoint(
  0x4e2d,
  0x534e,
  0x6c11,
  0x56fd,
);
const legacyTraditionalName = String.fromCodePoint(
  0x4e2d,
  0x83ef,
  0x6c11,
  0x570b,
);

describe('admin access geographic labels', () => {
  it("does not misclassify the People's Republic of China as Taiwan", () => {
    expect(
      featureLabel({
        properties: {
          ADM0_A3: 'CHN',
          NAME_EN: "People's Republic of China",
          NAME_ZH: '中华人民共和国',
          TYPE: 'Country',
        },
      }),
    ).toBe('中华人民共和国');
    expect(
      accessLocationLabel({ country: "People's Republic of China" }),
    ).toBe('中国');
  });

  it('renders the Taiwan feature on the world globe as China Taiwan', () => {
    expect(
      featureLabel({
        properties: {
          ADM0_A3: 'TWN',
          ISO_A2: 'CN-TW',
          NAME: 'Taiwan',
          NAME_ZH: legacySimplifiedName,
          TYPE: 'Sovereign country',
        },
      }),
    ).toBe('中国台湾');
  });

  it('keeps the bundled Taiwan map feature under China', () => {
    const taiwanFeature = (
      worldGeoJSON as {
        features?: Array<Parameters<typeof featureLabel>[0]>;
      }
    ).features?.find((feature) => feature.properties?.ADM0_A3 === 'TWN');

    expect(taiwanFeature?.properties).toMatchObject({
      ADMIN: 'China',
      FCLASS_ISO: 'Admin-1 states provinces',
      NAME_ZH: '中国台湾',
      SOVEREIGNT: 'China',
      TYPE: 'Province',
    });
    expect(JSON.stringify(taiwanFeature)).not.toContain(legacySimplifiedName);
    expect(JSON.stringify(taiwanFeature)).not.toContain(legacyTraditionalName);
  });

  it('keeps the China 2D province feature name unchanged', () => {
    expect(
      featureLabel({
        properties: {
          adcode: 710000,
          level: 'province',
          name: '台湾省',
        },
      }),
    ).toBe('台湾省');
  });

  it('uses detailed China province labels with fixed Hong Kong, Macau and Taiwan names', () => {
    const features = (
      chinaGeoJSON as {
        features?: Array<Parameters<typeof chinaProvinceLabel>[0]>;
      }
    ).features?.filter(
      (feature) =>
        feature.properties?.adchar !== 'JD' && feature.properties?.name,
    );
    const labelFor = (adcode: number) =>
      chinaProvinceLabel(
        features?.find(
          (feature) => Number(feature.properties?.adcode) === adcode,
        ) ?? {},
      );

    expect(features).toHaveLength(34);
    expect(labelFor(440000)).toBe('广东省');
    expect(labelFor(710000)).toBe('台湾省');
    expect(labelFor(810000)).toBe('香港特别行政区');
    expect(labelFor(820000)).toBe('澳门特别行政区');
  });

  it('replaces the world-level China geometry with the province layer', () => {
    const features =
      (
        worldGeoJSON as {
          features?: Array<Parameters<typeof isChinaWorldFeature>[0]>;
        }
      ).features ?? [];
    const replacedFeatures = features.filter(isChinaWorldFeature);

    expect(
      replacedFeatures.map((feature) => feature.properties?.ADM0_A3).sort(),
    ).toEqual(['CHN', 'TWN']);
  });

  it('keeps mainland hotspot addresses detailed to province and city', () => {
    expect(
      accessLocationLabel({
        city: '深圳市',
        country: '中国',
        province: '广东省',
        region: '中国 广东省 深圳市',
      }),
    ).toBe('中国 · 广东省 · 深圳市');
    expect(
      accessLocationLabel({
        city: '深圳市',
        country: 'China',
        province: '广东省',
        region: '中国 广东省 深圳市 南山区',
      }),
    ).toBe('中国 · 广东省 · 深圳市 · 南山区');
  });

  it('normalizes Hong Kong and Macau hotspot labels', () => {
    expect(
      accessLocationLabel({
        city: '九龙',
        country: 'China',
        province: '香港特别行政区',
        region: '中国 香港 九龙',
      }),
    ).toBe('中国香港 · 九龙');
    expect(
      accessLocationLabel({
        country: 'MO',
        province: '澳门特别行政区',
        region: 'Macau',
      }),
    ).toBe('中国澳门');
  });

  it('normalizes Taiwan hotspot tooltips on the 3D globe', () => {
    expect(
      accessLocationLabel({
        city: '台北',
        country: 'Taiwan',
        province: '台湾省',
        region: 'Taiwan Taipei',
      }),
    ).toBe('中国台湾 · 台北');
    expect(accessLocationLabel({ country: 'TW' })).toBe('中国台湾');
    expect(
      accessLocationLabel({
        country: legacySimplifiedName,
      }),
    ).toBe('中国台湾');
  });

  it('renders official maritime LineString and MultiLineString geometry', () => {
    const projection = createEquirectangularProjection(360, 180);

    expect(
      featurePath(
        {
          geometry: {
            coordinates: [
              [110, 16],
              [111, 15],
            ],
            type: 'LineString',
          },
        },
        projection,
      ),
    ).toMatch(/^M\S+ L\S+$/);
    expect(
      featurePath(
        {
          geometry: {
            coordinates: [
              [
                [110, 16],
                [111, 15],
              ],
              [
                [112, 14],
                [113, 13],
              ],
            ],
            type: 'MultiLineString',
          },
        },
        projection,
      ).match(/M/g),
    ).toHaveLength(2);
  });
});
