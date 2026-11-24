import { describe, expect, it } from 'vitest';

import * as mapGeoData from './map-geo-data';
import {
  chinaMaritimeBoundaryFeatures,
  chinaMaritimeIslandFeatures,
  chinaProvinceFeatures,
  officialMapSources,
  officialWorldFeatures,
} from './map-geo-data';
import { asLines, asRings, chinaProvinceLabel } from './geo-utils';

describe('official access atlas geography', () => {
  it('exposes the official single-sovereignty China feature for the China map outline', () => {
    const officialChinaFeature = (
      mapGeoData as typeof mapGeoData & {
        officialChinaFeature?: (typeof officialWorldFeatures)[number];
      }
    ).officialChinaFeature;

    expect(officialChinaFeature?.properties).toMatchObject({
      ADM0_A3: 'CHN',
      OFFICIAL_NAME_ZH: '中华人民共和国',
      SOVEREIGNT: 'China',
    });
    expect(asRings(officialChinaFeature ?? {})).not.toHaveLength(0);
  });

  it('keeps all 34 province-level divisions with complete Hong Kong, Macau and Taiwan labels', () => {
    const labels = chinaProvinceFeatures.map(chinaProvinceLabel);

    expect(chinaProvinceFeatures).toHaveLength(34);
    expect(labels).toContain('台湾省');
    expect(labels).toContain('香港特别行政区');
    expect(labels).toContain('澳门特别行政区');
    expect(labels).toContain('内蒙古自治区');
    expect(labels).toContain('新疆维吾尔自治区');
  });

  it('uses the official world feature in which Taiwan is included in China', () => {
    const china = officialWorldFeatures.find(
      (feature) => feature.properties?.ADM0_A3 === 'CHN',
    );
    const rings = china ? asRings(china) : [];
    const taiwanRing = rings.find((ring) =>
      ring.some(
        ([longitude, latitude]) =>
          longitude >= 119 &&
          longitude <= 123 &&
          latitude >= 21 &&
          latitude <= 26,
      ),
    );

    expect(officialWorldFeatures.length).toBeGreaterThanOrEqual(200);
    expect(china?.properties).toMatchObject({
      ADMIN: 'China',
      NAME_ZH: '中国',
      OFFICIAL_NAME_ZH: '中华人民共和国',
      SOVEREIGNT: 'China',
    });
    expect(taiwanRing).toBeDefined();
    expect(
      officialWorldFeatures.some(
        (feature) => feature.properties?.ADM0_A3 === 'TWN',
      ),
    ).toBe(false);
  });

  it('includes official South China Sea islands and all returned boundary segments', () => {
    const islandCoordinates = chinaMaritimeIslandFeatures.flatMap(asRings).flat();

    expect(chinaMaritimeIslandFeatures.length).toBeGreaterThan(0);
    expect(chinaMaritimeBoundaryFeatures).toHaveLength(10);
    expect(chinaMaritimeBoundaryFeatures.every((feature) => asLines(feature).length > 0)).toBe(
      true,
    );
    expect(Math.min(...islandCoordinates.map((point) => point[1]))).toBeLessThan(
      17,
    );
  });

  it('records the official agency, CRS and source requests', () => {
    expect(officialMapSources.world).toMatchObject({
      agency: '中华人民共和国自然资源部标准地图服务系统',
      crs: 'EPSG:4326',
    });
    expect(officialMapSources.maritime).toMatchObject({
      agency: '中华人民共和国自然资源部标准地图服务系统',
      crs: 'EPSG:4326',
    });
    expect(officialMapSources.provinces).toMatchObject({
      agency: '中华人民共和国自然资源部标准地图服务系统',
      crs: 'EPSG:4326',
      dataset: 'China_Province_pl@China',
    });
    expect(
      chinaProvinceFeatures.every(
        (feature) =>
          feature.properties?.sourceDataset === 'China_Province_pl@China',
      ),
    ).toBe(true);
  });
});
