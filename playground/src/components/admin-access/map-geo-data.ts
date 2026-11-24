import type { GeoJSONCollection, GeoJSONFeature } from './geo-utils';

import chinaMaritimeGeoJSON from '#/assets/maps/mnr-china-maritime.json';
import chinaProvinceGeoJSON from '#/assets/maps/mnr-china-provinces.json';
import officialWorldGeoJSON from '#/assets/maps/mnr-world.json';

export const chinaProvinceFeatures = Object.freeze(
  (chinaProvinceGeoJSON as GeoJSONCollection).features ?? [],
);

export const officialWorldFeatures = Object.freeze(
  (officialWorldGeoJSON as GeoJSONCollection).features ?? [],
);

const officialChinaMatches = officialWorldFeatures.filter((feature) => {
  const properties = feature.properties ?? {};
  return (
    String(properties.ADM0_A3 ?? '') === 'CHN' &&
    String(properties.COUNTRY ?? '') === '中华人民共和国' &&
    String(properties.ISO_A2 ?? '') === 'CN' &&
    String(properties.ISO_A3 ?? '') === 'CHN' &&
    String(properties.OFFICIAL_NAME_ZH ?? '') === '中华人民共和国'
  );
});

if (officialChinaMatches.length !== 1) {
  throw new Error(
    `Official world map data must contain exactly one China feature, got ${officialChinaMatches.length}`,
  );
}

export const officialChinaFeature = officialChinaMatches[0]!;

const chinaMaritimeFeatures = Object.freeze(
  (chinaMaritimeGeoJSON as GeoJSONCollection).features ?? [],
);

export const chinaMaritimeIslandFeatures = Object.freeze(
  chinaMaritimeFeatures.filter((feature) =>
    isMaritimeKind(feature, 'island'),
  ),
);

export const chinaMaritimeBoundaryFeatures = Object.freeze(
  chinaMaritimeFeatures.filter((feature) =>
    isMaritimeKind(feature, 'boundary-line'),
  ),
);

export const officialMapSources = Object.freeze({
  maritime: (chinaMaritimeGeoJSON as { source?: unknown }).source,
  provinces: (chinaProvinceGeoJSON as { source?: unknown }).source,
  world: (officialWorldGeoJSON as { source?: unknown }).source,
});

function isMaritimeKind(feature: GeoJSONFeature, kind: string) {
  return String(feature.properties?.kind ?? '') === kind;
}
