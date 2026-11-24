import { describe, expect, it } from 'vitest';

import {
  configuredIpFields,
  emptyIpFieldMappings,
  missingCoordinatePairFields,
  parseIpFieldMappings,
  serializeIpFieldMappings,
} from './mapping';

describe('IP source field mappings', () => {
  it('parses legacy parseRule text and serializes in stable order', () => {
    const mappings = parseIpFieldMappings(
      'longitude=$.data.lng, country=$.data.country, latitude=$.data.lat',
    );
    expect(mappings.country).toBe('$.data.country');
    expect(serializeIpFieldMappings(mappings)).toBe(
      'country=$.data.country, latitude=$.data.lat, longitude=$.data.lng',
    );
  });

  it('requires at least one mapping and keeps coordinates paired', () => {
    const mappings = emptyIpFieldMappings();
    mappings.country = '$.country';
    expect(configuredIpFields(mappings)).toEqual(['country']);
    expect(missingCoordinatePairFields(mappings)).toEqual([]);
    mappings.latitude = '$.latitude';
    expect(missingCoordinatePairFields(mappings)).toEqual(['longitude']);
  });
});
