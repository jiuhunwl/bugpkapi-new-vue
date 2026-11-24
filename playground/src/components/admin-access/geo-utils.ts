import { $t } from '#/locales';

export interface GeoJSONFeature {
  type?: string;
  geometry?: {
    coordinates?: unknown;
    type?: string;
  };
  properties?: Record<string, any>;
}

export interface GeoJSONCollection {
  features?: GeoJSONFeature[];
  type?: string;
}

export type LonLat = readonly [number, number];

export interface Projection {
  height: number;
  width: number;
  (longitude: number, latitude: number): [number, number];
}

type ChinaSpecialRegion = 'hong-kong' | 'macau' | 'taiwan';

interface AccessLocationLike {
  city?: unknown;
  country?: unknown;
  province?: unknown;
  region?: unknown;
}

export const CHINA_HONG_KONG_LABEL = '中国香港';
export const CHINA_LABEL = '中国';
export const CHINA_MACAU_LABEL = '中国澳门';
export const CHINA_TAIWAN_LABEL = '中国台湾';

const CHINA_SPECIAL_LABEL_BY_ADCODE: Record<string, string> = {
  '710000': '台湾省',
  '810000': '香港特别行政区',
  '820000': '澳门特别行政区',
};
const CHINA_WORLD_CODES = new Set(['chn', 'cn', 'cntw', 'twn']);
const HONG_KONG_CODES = new Set(['cnhk', 'hk', 'hkg']);
const MACAU_CODES = new Set(['cnmo', 'mac', 'macao', 'macau', 'mo']);
const TAIWAN_COUNTRY_CODES = new Set(['cntw', 'tw', 'twn']);
const LEGACY_TAIWAN_LABELS = [
  String.fromCodePoint(0x4e2d, 0x534e, 0x6c11, 0x56fd),
  String.fromCodePoint(0x4e2d, 0x83ef, 0x6c11, 0x570b),
  ['Republic', 'of', 'China'].join(' '),
];
const LEGACY_TAIWAN_NAMES = LEGACY_TAIWAN_LABELS.map(normalizeRegion);

export function asRings(feature: GeoJSONFeature): LonLat[][] {
  const geometry = feature.geometry;
  if (!geometry || !geometry.coordinates) {
    return [];
  }
  if (geometry.type === 'Polygon') {
    return normalizeRings(geometry.coordinates);
  }
  if (geometry.type === 'MultiPolygon') {
    const polygons = Array.isArray(geometry.coordinates)
      ? geometry.coordinates
      : [];
    return polygons.flatMap((polygon) => normalizeRings(polygon));
  }
  return [];
}

export function asLines(feature: GeoJSONFeature): LonLat[][] {
  const geometry = feature.geometry;
  if (!geometry || !geometry.coordinates) {
    return [];
  }
  if (geometry.type === 'LineString') {
    const line = normalizeLine(geometry.coordinates);
    return line.length >= 2 ? [line] : [];
  }
  if (geometry.type === 'MultiLineString') {
    const lines = Array.isArray(geometry.coordinates)
      ? geometry.coordinates
      : [];
    return lines
      .map((line) => normalizeLine(line))
      .filter((line) => line.length >= 2);
  }
  return asRings(feature);
}

export function featureLabel(feature: GeoJSONFeature) {
  const properties = feature.properties ?? {};
  const label = String(
    properties.NAME_ZH ??
      properties.name ??
      properties.NAME ??
      properties.ADMIN ??
      properties.SOVEREIGNT ??
      $t('adminAccess.unknownRegion'),
  ).trim();
  return isTaiwanCountryFeature(properties) ? CHINA_TAIWAN_LABEL : label;
}

export function chinaProvinceLabel(feature: GeoJSONFeature) {
  const properties = feature.properties ?? {};
  const adcode = String(properties.adcode ?? '').trim();
  return CHINA_SPECIAL_LABEL_BY_ADCODE[adcode] ?? featureLabel(feature);
}

export function isChinaWorldFeature(feature: GeoJSONFeature) {
  const properties = feature.properties ?? {};
  const codes = [properties.ADM0_A3, properties.ISO_A2, properties.ISO_A3];
  if (codes.some((code) => CHINA_WORLD_CODES.has(normalizeRegion(code)))) {
    return true;
  }
  return [properties.ADMIN, properties.SOVEREIGNT].some((value) =>
    isChinaReference(cleanLabel(value)),
  );
}

export function accessLocationLabel(location: AccessLocationLike) {
  const country = cleanLabel(location.country);
  const province = cleanLabel(location.province);
  const region = cleanLabel(location.region);
  const city = cleanLabel(location.city);
  const values = [country, province, region, city];
  const specialRegion = chinaSpecialRegion(values);

  if (specialRegion) {
    return specialChinaLocationLabel(specialRegion, {
      city,
      country,
      province,
      region,
    });
  }

  const parts: string[] = [];
  const countryLabel = isChinaReference(country) ? CHINA_LABEL : country;
  addLocationPart(parts, countryLabel);
  addLocationPart(parts, province);
  addLocationPart(parts, city);

  const regionDetail = stripKnownLocationParts(region, {
    city,
    country: [country, countryLabel],
    province,
  });
  addLocationPart(parts, regionDetail);

  if (parts.length === 0) {
    addLocationPart(parts, region);
  }

  return parts.join(' · ') || $t('adminAccess.unknownRegion');
}

export function featureCenter(feature: GeoJSONFeature): LonLat {
  const properties = feature.properties ?? {};
  const candidate = properties.centroid ?? properties.center;
  if (
    Array.isArray(candidate) &&
    Number.isFinite(Number(candidate[0])) &&
    Number.isFinite(Number(candidate[1]))
  ) {
    return [Number(candidate[0]), Number(candidate[1])];
  }
  const points = asRings(feature).flat();
  if (points.length === 0) {
    return [0, 0];
  }
  const sum = points.reduce(
    (result, point) => [result[0] + point[0], result[1] + point[1]],
    [0, 0],
  );
  return [sum[0] / points.length, sum[1] / points.length];
}

export function featurePath(
  feature: GeoJSONFeature,
  project: Projection,
): string {
  const closePath = ['MultiPolygon', 'Polygon'].includes(
    String(feature.geometry?.type ?? ''),
  );
  return asLines(feature)
    .flatMap((ring) =>
      splitDateLine(ring).map((segment) => {
        if (segment.length < 2) return '';
        const path = segment
          .map(([longitude, latitude], index) => {
            const [x, y] = project(longitude, latitude);
            return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
          })
          .join(' ');
        return `${path}${closePath && segment.length > 2 ? ' Z' : ''}`;
      }),
    )
    .filter(Boolean)
    .join(' ');
}

export function createEquirectangularProjection(
  width: number,
  height: number,
  bounds: { east: number; north: number; south: number; west: number } = {
    east: 180,
    north: 90,
    south: -60,
    west: -180,
  },
): Projection {
  const longitudeSpan = Math.max(1, bounds.east - bounds.west);
  const latitudeSpan = Math.max(1, bounds.north - bounds.south);
  const project = ((longitude: number, latitude: number) => [
    ((longitude - bounds.west) / longitudeSpan) * width,
    ((bounds.north - latitude) / latitudeSpan) * height,
  ]) as Projection;
  project.width = width;
  project.height = height;
  return project;
}

export function validCoordinate(
  value: unknown,
  minimum: number,
  maximum: number,
) {
  if (value === null || value === undefined || value === '') return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) &&
    numberValue >= minimum &&
    numberValue <= maximum
    ? numberValue
    : null;
}

export function normalizeRegion(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase()
    .replace(/[\s\-_，。、“”'"·()（）]/g, '');
}

function cleanLabel(value: unknown) {
  return String(value ?? '').trim();
}

function addLocationPart(parts: string[], value: string) {
  const cleaned = cleanupLocationPart(value);
  const key = locationComparisonKey(cleaned);
  if (!key) return;
  const duplicate = parts.some((part) => locationComparisonKey(part) === key);
  if (!duplicate) parts.push(cleaned);
}

function chinaSpecialRegion(values: string[]): ChinaSpecialRegion | undefined {
  if (values.some(isTaiwanReference)) return 'taiwan';
  if (values.some(isHongKongReference)) return 'hong-kong';
  if (values.some(isMacauReference)) return 'macau';
  return undefined;
}

function cleanupLocationPart(value: string) {
  return value
    .replace(/^[\s,，。·/|>]+|[\s,，。·/|>]+$/g, '')
    .replace(/[\s,，。·/|>]+/g, ' ')
    .trim();
}

function specialChinaLocationLabel(
  specialRegion: ChinaSpecialRegion,
  location: Record<'city' | 'country' | 'province' | 'region', string>,
) {
  const label = specialRegionLabel(specialRegion);
  const details: string[] = [];
  for (const value of [location.province, location.city]) {
    addLocationPart(
      details,
      stripSpecialRegionReferences(value, specialRegion),
    );
  }

  let regionDetail = stripSpecialRegionReferences(
    location.region,
    specialRegion,
  );
  regionDetail = stripKnownLocationParts(regionDetail, {
    city: location.city,
    country: [location.country],
    province: location.province,
  });
  const structuredValues = [location.province, location.city].filter(
    (value) => stripSpecialRegionReferences(value, specialRegion).length > 0,
  );
  const regionRepeatsTranslatedDetail =
    structuredValues.length > 0 &&
    isSpecialRegionReference(location.region, specialRegion) &&
    !structuredValues.some((value) =>
      normalizedIncludes(location.region, value),
    );
  if (!regionRepeatsTranslatedDetail) {
    addLocationPart(details, regionDetail);
  }

  return [label, ...details].join(' · ');
}

function specialRegionLabel(specialRegion: ChinaSpecialRegion) {
  if (specialRegion === 'hong-kong') return CHINA_HONG_KONG_LABEL;
  if (specialRegion === 'macau') return CHINA_MACAU_LABEL;
  return CHINA_TAIWAN_LABEL;
}

function stripKnownLocationParts(
  value: string,
  known: { city: string; country: string[]; province: string },
) {
  const tokens = [
    ...known.country,
    ...locationTokenVariants(known.province, 'province'),
    ...locationTokenVariants(known.city, 'city'),
  ];
  return removeLocationTokens(value, tokens);
}

function locationTokenVariants(value: string, kind: 'city' | 'province') {
  const cleaned = cleanLabel(value);
  if (!cleaned) return [];
  const suffixPattern =
    kind === 'province'
      ? /(壮族自治区|回族自治区|维吾尔自治区|特别行政区|自治区|省|市)$/
      : /(自治州|地区|盟|市)$/;
  const base = cleaned.replace(suffixPattern, '');
  const suffixes =
    kind === 'province'
      ? [
          '壮族自治区',
          '回族自治区',
          '维吾尔自治区',
          '特别行政区',
          '自治区',
          '省',
          '市',
        ]
      : ['自治州', '地区', '盟', '市'];
  return [cleaned, base, ...suffixes.map((suffix) => `${base}${suffix}`)]
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);
}

function locationComparisonKey(value: string) {
  return normalizeRegion(value).replace(
    /(壮族自治区|回族自治区|维吾尔自治区|特别行政区|自治区|自治州|地区|province|municipality|city|省|市|盟)$/,
    '',
  );
}

function normalizedIncludes(value: string, expected: string) {
  const normalizedValue = normalizeRegion(value);
  const normalizedExpected = locationComparisonKey(expected);
  return Boolean(
    normalizedExpected && normalizedValue.includes(normalizedExpected),
  );
}

function removeLocationTokens(value: string, tokens: string[]) {
  let result = cleanLabel(value);
  const uniqueTokens = [
    ...new Set(tokens.map(cleanLabel).filter(Boolean)),
  ].sort((left, right) => right.length - left.length);
  for (const token of uniqueTokens) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = /^[a-z\d]+$/i.test(token) ? `\\b${escaped}\\b` : escaped;
    result = result.replace(new RegExp(pattern, 'giu'), ' ');
  }
  return cleanupLocationPart(result);
}

function stripSpecialRegionReferences(
  value: string,
  specialRegion: ChinaSpecialRegion,
) {
  const commonChinaTokens = [
    '中华人民共和国',
    '中國',
    CHINA_LABEL,
    "People's Republic of China",
    'China',
    'PRC',
    'CN',
  ];
  const specialTokens =
    specialRegion === 'hong-kong'
      ? [
          '香港特别行政区',
          '香港特別行政區',
          CHINA_HONG_KONG_LABEL,
          '中國香港',
          '香港',
          'Hong Kong SAR',
          'Hong Kong',
          'HKSAR',
          'CN-HK',
          'HKG',
          'HK',
        ]
      : specialRegion === 'macau'
        ? [
            '澳门特别行政区',
            '澳門特別行政區',
            CHINA_MACAU_LABEL,
            '中國澳門',
            '澳门',
            '澳門',
            'Macao SAR',
            'Macau SAR',
            'Macao',
            'Macau',
            'CN-MO',
            'MAC',
            'MO',
          ]
        : [
            '台湾省',
            '台灣省',
            CHINA_TAIWAN_LABEL,
            '中國臺灣',
            '台湾',
            '台灣',
            ...LEGACY_TAIWAN_LABELS,
            'Taiwan Province',
            'Taiwan',
            'CN-TW',
            'TWN',
            'TW',
          ];
  return removeLocationTokens(value, [...specialTokens, ...commonChinaTokens]);
}

function isChinaReference(value: string) {
  const normalized = normalizeRegion(value);
  return [
    'china',
    'cn',
    'peoplesrepublicofchina',
    'prc',
    '中华人民共和国',
    '中国',
    '中國',
  ].includes(normalized);
}

function isHongKongReference(value: unknown) {
  const normalized = normalizeRegion(value);
  return (
    HONG_KONG_CODES.has(normalized) ||
    normalized.includes('hongkong') ||
    normalized.includes('香港')
  );
}

function isMacauReference(value: unknown) {
  const normalized = normalizeRegion(value);
  return (
    MACAU_CODES.has(normalized) ||
    normalized.includes('macau') ||
    normalized.includes('macao') ||
    normalized.includes('澳门') ||
    normalized.includes('澳門')
  );
}

function isSpecialRegionReference(
  value: unknown,
  specialRegion: ChinaSpecialRegion,
) {
  if (specialRegion === 'hong-kong') return isHongKongReference(value);
  if (specialRegion === 'macau') return isMacauReference(value);
  return isTaiwanReference(value);
}

function isTaiwanCountryFeature(properties: Record<string, any>) {
  const codes = [
    properties.ADM0_A3,
    properties.GU_A3,
    properties.ISO_A2,
    properties.ISO_A2_EH,
    properties.ISO_A3,
    properties.ISO_A3_EH,
    properties.POSTAL,
    properties.SU_A3,
  ];
  if (codes.some((code) => TAIWAN_COUNTRY_CODES.has(normalizeRegion(code)))) {
    return true;
  }

  const featureType = [
    properties.featurecla,
    properties.FCLASS_ISO,
    properties.TYPE,
  ]
    .map(normalizeRegion)
    .join(' ');
  if (!featureType.includes('country')) return false;

  return [
    properties.ADMIN,
    properties.NAME,
    properties.NAME_EN,
    properties.NAME_ZH,
    properties.NAME_ZHT,
    properties.SOVEREIGNT,
  ].some(isTaiwanReference);
}

function isTaiwanReference(value: unknown) {
  const normalized = normalizeRegion(value);
  return (
    TAIWAN_COUNTRY_CODES.has(normalized) ||
    LEGACY_TAIWAN_NAMES.some((name) =>
      name === 'republicofchina'
        ? normalized === name || normalized.startsWith(`${name}taiwan`)
        : normalized.includes(name),
    ) ||
    normalized.includes('taiwan') ||
    normalized.includes('台湾') ||
    normalized.includes('台灣') ||
    normalized.includes('中国台湾') ||
    normalized.includes('中國臺灣')
  );
}

function normalizeLine(value: unknown): LonLat[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (point): point is [unknown, unknown] =>
        Array.isArray(point) && point.length >= 2,
    )
    .map(
      ([longitude, latitude]) =>
        [Number(longitude), Number(latitude)] as LonLat,
    )
    .filter(
      ([longitude, latitude]) =>
        Number.isFinite(longitude) && Number.isFinite(latitude),
    );
}

function normalizeRings(value: unknown): LonLat[][] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((ring) => Array.isArray(ring))
    .map((ring) => normalizeLine(ring))
    .filter((ring) => ring.length >= 2);
}

function splitDateLine(points: readonly LonLat[]) {
  const segments: LonLat[][] = [];
  let current: LonLat[] = [];
  for (const point of points) {
    const previous = current[current.length - 1];
    if (previous && Math.abs(point[0] - previous[0]) > 180) {
      if (current.length > 1) segments.push(current);
      current = [];
    }
    current.push(point);
  }
  if (current.length > 1) segments.push(current);
  return segments;
}
