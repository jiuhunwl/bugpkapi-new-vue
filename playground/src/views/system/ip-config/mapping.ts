export const IP_FIELD_KEYS = [
  'country',
  'province',
  'city',
  'isp',
  'latitude',
  'longitude',
] as const;

export type IpFieldKey = (typeof IP_FIELD_KEYS)[number];
export type IpFieldMappings = Record<IpFieldKey, string>;

export function emptyIpFieldMappings(): IpFieldMappings {
  return {
    city: '',
    country: '',
    isp: '',
    latitude: '',
    longitude: '',
    province: '',
  };
}

export function parseIpFieldMappings(rule?: string): IpFieldMappings {
  const result = emptyIpFieldMappings();
  for (const item of String(rule ?? '').split(',')) {
    const separator = item.indexOf('=');
    if (separator <= 0) continue;
    const key = item.slice(0, separator).trim().toLowerCase();
    const path = item.slice(separator + 1).trim();
    if ((IP_FIELD_KEYS as readonly string[]).includes(key) && path) {
      result[key as IpFieldKey] = path;
    }
  }
  return result;
}

export function serializeIpFieldMappings(mappings: IpFieldMappings) {
  return IP_FIELD_KEYS.map((key) => {
    const path = mappings[key].trim();
    return path ? `${key}=${path}` : '';
  })
    .filter(Boolean)
    .join(', ');
}

export function configuredIpFields(mappings: IpFieldMappings) {
  return IP_FIELD_KEYS.filter((key) => mappings[key].trim());
}

export function missingCoordinatePairFields(mappings: IpFieldMappings) {
  const hasLatitude = Boolean(mappings.latitude.trim());
  const hasLongitude = Boolean(mappings.longitude.trim());
  if (hasLatitude === hasLongitude) return [] as IpFieldKey[];
  return [hasLatitude ? 'longitude' : 'latitude'] as IpFieldKey[];
}
