import type { HomeApi } from '#/api/home';

import { describe, expect, it } from 'vitest';

import {
  certifyHomeStatValue,
  numericHomeStat,
  resolveHomeStatAvailability,
} from './home-metrics';

function stats(
  overrides: Partial<HomeApi.PlatformStats> = {},
): HomeApi.PlatformStats {
  return {
    activeRegions24h: 0,
    activeRegions24hDelta: 0,
    apiTotal: 0,
    availabilityPercent: 0,
    availabilitySource: 'API_STATUS',
    calls24h: 0,
    calls24hDeltaPercent: 0,
    enabledApiTotal: 0,
    peakQps24h: 0,
    peakQps24hDelta: 0,
    userTotal: 0,
    ...overrides,
  };
}

describe('resolveHomeStatAvailability', () => {
  it('certifies every metric when the response omits the truth envelope', () => {
    const availability = resolveHomeStatAvailability(stats());
    expect(availability.analyticsReady).toBe(true);
    expect(availability.unavailable).toEqual([]);
    expect(availability.available.calls24h).toBe(true);
  });

  it('degrades every metric when the backend reports analyticsReady=false', () => {
    const availability = resolveHomeStatAvailability(
      stats({ analyticsReady: false }),
    );
    expect(availability.analyticsReady).toBe(false);
    expect(availability.unavailable).toEqual([
      'enabledApiTotal',
      'calls24h',
      'availabilityPercent',
      'peakQps24h',
    ]);
  });

  it('degrades every metric when false arrives without named fields', () => {
    const availability = resolveHomeStatAvailability(
      stats({ analyticsReady: false, unavailableFields: [] }),
    );
    expect(availability.available.peakQps24h).toBe(false);
    expect(availability.available.enabledApiTotal).toBe(false);
  });

  it('degrades only the fields the backend could not certify', () => {
    const availability = resolveHomeStatAvailability(
      stats({
        analyticsReady: false,
        unavailableFields: ['calls24h', 'peakQps24h'],
      }),
    );
    expect(availability.available.calls24h).toBe(false);
    expect(availability.available.peakQps24h).toBe(false);
    // Live counters come from bp_interface_api, not the rollups.
    expect(availability.available.enabledApiTotal).toBe(true);
    expect(availability.available.availabilityPercent).toBe(true);
  });

  it('honours an explicit list even when the verdict claims readiness', () => {
    const availability = resolveHomeStatAvailability(
      stats({ analyticsReady: true, unavailableFields: ['calls24h'] }),
    );
    expect(availability.analyticsReady).toBe(true);
    expect(availability.available.calls24h).toBe(false);
    expect(availability.available.peakQps24h).toBe(true);
  });

  it('treats an undefined stats payload as unavailable-unknown but not degraded', () => {
    const availability = resolveHomeStatAvailability(undefined);
    expect(availability.analyticsReady).toBe(true);
    expect(availability.unavailable).toEqual([]);
  });
});

describe('certifyHomeStatValue', () => {
  it('drops an uncertified value so the placeholder is used', () => {
    const availability = resolveHomeStatAvailability(
      stats({ analyticsReady: false, unavailableFields: ['calls24h'] }),
    );
    expect(certifyHomeStatValue('calls24h', 0, availability)).toBeUndefined();
  });

  it('keeps a certified zero, because zero can be the real answer', () => {
    const availability = resolveHomeStatAvailability(stats());
    expect(certifyHomeStatValue('calls24h', 0, availability)).toBe(0);
  });

  it('keeps certified non-zero values', () => {
    const availability = resolveHomeStatAvailability(stats());
    expect(certifyHomeStatValue('peakQps24h', 21, availability)).toBe(21);
  });
});

describe('numericHomeStat', () => {
  it('parses the string availability field', () => {
    expect(numericHomeStat('99.87')).toBe(99.87);
  });

  it('rejects empty and non-numeric values', () => {
    expect(numericHomeStat('')).toBeUndefined();
    expect(numericHomeStat(undefined)).toBeUndefined();
    expect(numericHomeStat('n/a')).toBeUndefined();
  });
});
