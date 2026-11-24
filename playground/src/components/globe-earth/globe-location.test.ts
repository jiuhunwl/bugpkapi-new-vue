import { describe, expect, it } from 'vitest';

import { hasDirectCoordinates, resolveGlobeLocation } from './globe-location';

describe('globe location resolver', () => {
  it('prefers exact backend coordinates', () => {
    expect(
      resolveGlobeLocation({
        city: '深圳',
        latitude: 22.5431,
        longitude: 114.0579,
        region: '中国 广东 深圳',
        status: 'resolved',
      }),
    ).toMatchObject({
      label: '中国 广东 深圳',
      latitude: 22.5431,
      longitude: 114.0579,
      precision: 'coordinates',
    });
  });

  it('falls back to a province coordinate', () => {
    expect(
      resolveGlobeLocation({ country: '中国', province: '广东省' }),
    ).toMatchObject({ label: '广东', precision: 'province' });
  });

  it('rejects invalid coordinates and failed statuses', () => {
    expect(
      hasDirectCoordinates({ latitude: 91, longitude: 20 }),
    ).toBe(false);
    expect(
      resolveGlobeLocation({
        country: 'China',
        latitude: 22,
        longitude: 114,
        status: 'unavailable',
      }),
    ).toBeNull();
  });
});
