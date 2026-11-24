import { $t } from '#/locales';

export type GlobeLocationPrecision =
  | 'city'
  | 'coordinates'
  | 'country'
  | 'province';

export interface GlobeLocation {
  city?: null | string;
  country?: null | string;
  isp?: null | string;
  latitude?: null | number | string;
  longitude?: null | number | string;
  provider?: null | string;
  province?: null | string;
  region?: null | string;
  resolved?: boolean;
  status?: null | string;
}

export interface ResolvedMarker {
  label: string;
  latitude: number;
  longitude: number;
  precision?: GlobeLocationPrecision;
  provider?: string;
}

interface CoordinateEntry {
  label: string;
  latitude: number;
  longitude: number;
}

const CITY_COORDINATES: Record<string, CoordinateEntry> = {
  beijing: entry('北京', 39.9042, 116.4074),
  guangzhou: entry('广州', 23.1291, 113.2644),
  hangzhou: entry('杭州', 30.2741, 120.1551),
  london: entry('伦敦', 51.5072, -0.1276),
  'losangeles': entry('洛杉矶', 34.0522, -118.2437),
  newyork: entry('纽约', 40.7128, -74.006),
  paris: entry('巴黎', 48.8566, 2.3522),
  seoul: entry('首尔', 37.5665, 126.978),
  shanghai: entry('上海', 31.2304, 121.4737),
  shenzhen: entry('深圳', 22.5431, 114.0579),
  singapore: entry('新加坡', 1.3521, 103.8198),
  sydney: entry('悉尼', -33.8688, 151.2093),
  tokyo: entry('东京', 35.6762, 139.6503),
  北京: entry('北京', 39.9042, 116.4074),
  广州: entry('广州', 23.1291, 113.2644),
  杭州: entry('杭州', 30.2741, 120.1551),
  上海: entry('上海', 31.2304, 121.4737),
  深圳: entry('深圳', 22.5431, 114.0579),
};

const CHINA_PROVINCE_COORDINATES: Record<string, CoordinateEntry> = {
  北京: entry('北京', 39.9042, 116.4074),
  福建: entry('福建', 26.0745, 119.2965),
  广东: entry('广东', 23.1291, 113.2644),
  广西: entry('广西', 22.817, 108.3665),
  河北: entry('河北', 38.0428, 114.5149),
  河南: entry('河南', 34.7466, 113.6254),
  湖北: entry('湖北', 30.5928, 114.3055),
  湖南: entry('湖南', 28.2278, 112.9389),
  江苏: entry('江苏', 32.0603, 118.7969),
  辽宁: entry('辽宁', 41.8057, 123.4315),
  山东: entry('山东', 36.6512, 117.1201),
  上海: entry('上海', 31.2304, 121.4737),
  四川: entry('四川', 30.5728, 104.0668),
  天津: entry('天津', 39.0842, 117.201),
  浙江: entry('浙江', 30.2741, 120.1551),
  重庆: entry('重庆', 29.563, 106.5516),
};

const COUNTRY_COORDINATES: Record<string, CoordinateEntry> = {
  australia: entry('澳大利亚', -33.8688, 151.2093),
  brazil: entry('巴西', -15.7939, -47.8828),
  canada: entry('加拿大', 45.4215, -75.6972),
  china: entry('中国', 39.9042, 116.4074),
  france: entry('法国', 48.8566, 2.3522),
  germany: entry('德国', 52.52, 13.405),
  india: entry('印度', 28.6139, 77.209),
  japan: entry('日本', 35.6762, 139.6503),
  korea: entry('韩国', 37.5665, 126.978),
  singapore: entry('新加坡', 1.3521, 103.8198),
  uk: entry('英国', 51.5072, -0.1276),
  usa: entry('美国', 38.9072, -77.0369),
};

const COUNTRY_ALIASES: Record<string, string> = {
  au: 'australia',
  australia: 'australia',
  澳大利亚: 'australia',
  br: 'brazil',
  brazil: 'brazil',
  巴西: 'brazil',
  ca: 'canada',
  canada: 'canada',
  加拿大: 'canada',
  china: 'china',
  cn: 'china',
  中国: 'china',
  中华人民共和国: 'china',
  de: 'germany',
  france: 'france',
  fr: 'france',
  germany: 'germany',
  德国: 'germany',
  法国: 'france',
  gb: 'uk',
  india: 'india',
  jp: 'japan',
  japan: 'japan',
  kr: 'korea',
  singapore: 'singapore',
  sg: 'singapore',
  uk: 'uk',
  'unitedkingdom': 'uk',
  'unitedstates': 'usa',
  'unitedstatesofamerica': 'usa',
  us: 'usa',
  usa: 'usa',
  印度: 'india',
  新加坡: 'singapore',
  日本: 'japan',
  美国: 'usa',
  英国: 'uk',
  韩国: 'korea',
};

export function resolveGlobeLocation(
  location?: GlobeLocation | null,
): ResolvedMarker | null {
  if (!location || isFailedStatus(location.status)) return null;

  const latitude = coordinate(location.latitude, -90, 90);
  const longitude = coordinate(location.longitude, -180, 180);
  if (
    latitude !== null &&
    longitude !== null &&
    (latitude !== 0 || longitude !== 0)
  ) {
    return {
      label: locationLabel(location),
      latitude,
      longitude,
      precision: 'coordinates',
      provider: clean(location.provider),
    };
  }

  const city = CITY_COORDINATES[normalize(location.city)];
  if (city) return marker(city, 'city', location.provider);

  const countryKey = COUNTRY_ALIASES[normalize(location.country)];
  if (countryKey === 'china') {
    const province = CHINA_PROVINCE_COORDINATES[normalize(location.province)];
    if (province) return marker(province, 'province', location.provider);
  }

  const country = countryKey ? COUNTRY_COORDINATES[countryKey] : undefined;
  return country ? marker(country, 'country', location.provider) : null;
}

export function hasDirectCoordinates(location?: GlobeLocation | null) {
  return resolveGlobeLocationCoordinates(location) !== null;
}

function resolveGlobeLocationCoordinates(location?: GlobeLocation | null) {
  if (!location || isFailedStatus(location.status)) return null;
  const latitude = coordinate(location.latitude, -90, 90);
  const longitude = coordinate(location.longitude, -180, 180);
  if (
    latitude === null ||
    longitude === null ||
    (latitude === 0 && longitude === 0)
  ) {
    return null;
  }
  return { latitude, longitude };
}

function coordinate(value: unknown, min: number, max: number) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max
    ? parsed
    : null;
}

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function entry(label: string, latitude: number, longitude: number) {
  return { label, latitude, longitude };
}

function isFailedStatus(status: unknown) {
  return ['invalid', 'private', 'unavailable'].includes(
    clean(status).toLowerCase(),
  );
}

function locationLabel(location: GlobeLocation) {
  return (
    clean(location.region) ||
    [location.country, location.province, location.city]
      .map(clean)
      .filter(Boolean)
      .join(' ') ||
    $t('globeEarth.visitLocation')
  );
}

function marker(
  value: CoordinateEntry,
  precision: GlobeLocationPrecision,
  provider: unknown,
): ResolvedMarker {
  return {
    ...value,
    precision,
    provider: clean(provider),
  };
}

function normalize(value: unknown) {
  return clean(value)
    .toLowerCase()
    .replace(/[\s\-_·]+/g, '')
    .replace(/[省市自治区特别行政区州郡县镇地区]+$/g, '');
}
