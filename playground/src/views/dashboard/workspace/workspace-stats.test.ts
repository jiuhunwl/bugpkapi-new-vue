import { describe, expect, it } from 'vitest';

import {
  createDefaultAdminWorkbenchStats,
  mergeAdminWorkbenchAll,
  mergeAdminWorkbenchSection,
  normalizeAdminWorkbenchStats,
} from './workspace-stats';

describe('admin workspace stats', () => {
  it('keeps legacy active-user call counts visible during rolling upgrades', () => {
    const stats = normalizeAdminWorkbenchStats({
      activeUsers: [
        {
          callCount: '37',
          id: '12',
          realName: '测试用户',
          username: 'tester',
        },
      ],
    });

    expect(stats.activeUsers).toEqual([
      {
        chargeAmount: 0,
        id: '12',
        realName: '测试用户',
        successCalls: 0,
        successRate: '—',
        todayCalls: 37,
        username: 'tester',
      },
    ]);
  });

  it('normalizes the current active-user response contract', () => {
    const stats = normalizeAdminWorkbenchStats({
      activeUsers: [
        {
          chargeAmount: '2.5000',
          id: 18,
          realName: 'Active User',
          successCalls: '8',
          successRate: '80.00%',
          todayCalls: '10',
          username: 'active-user',
        },
      ],
    });

    expect(stats.activeUsers[0]).toMatchObject({
      chargeAmount: '2.5000',
      id: 18,
      successCalls: 8,
      successRate: '80.00%',
      todayCalls: 10,
    });
  });

  it('normalizes outcome composition and accepts dash rates', () => {
    const stats = normalizeAdminWorkbenchStats({
      outcomes: {
        available: true,
        calls: 10,
        successCalls: 0,
        expectedEmptyCalls: 10,
        clientErrorCalls: 0,
        throttledCalls: 0,
        upstreamFailureCalls: 0,
        sampleCalls: 0,
        successRate: '—',
        serviceFailureRate: '—',
        clientErrorRate: '—',
        throttleRate: '—',
        expectedEmptyRate: '100.00%',
      },
    });

    expect(stats.outcomes.available).toBe(true);
    expect(stats.outcomes.serviceFailureRate).toBe('—');
    expect(stats.outcomes.expectedEmptyRate).toBe('100.00%');
  });

  it('merges only the independently refreshed section', () => {
    const current = createDefaultAdminWorkbenchStats();
    current.hotApis = [
      {
        apiCode: 'keep-me',
        apiStatus: 1,
        avgElapsedMs: 10,
        billableCalls: 1,
        chargeAmount: '1.00',
        failedCalls: 0,
        id: '1',
        name: 'Existing API',
        successCalls: 1,
        successRate: '100%',
        todayCalls: 1,
      },
    ];

    const merged = mergeAdminWorkbenchSection(
      current,
      { overview: { totalUsers: 42 } },
      'overview',
    );

    expect(merged.overview.totalUsers).toBe(42);
    expect(merged.hotApis).toEqual(current.hotApis);
    expect(merged).not.toBe(current);
  });

  it('keeps real section data when an aggregated response marks it degraded', () => {
    const current = createDefaultAdminWorkbenchStats();
    current.overview.totalUsers = 42;
    current.hotApis = [
      {
        apiCode: 'saved',
        apiStatus: 1,
        avgElapsedMs: 8,
        billableCalls: 7,
        chargeAmount: '1.25',
        failedCalls: 1,
        id: 'saved',
        name: 'Saved API',
        successCalls: 9,
        successRate: '90%',
        todayCalls: 10,
      },
    ];

    const merged = mergeAdminWorkbenchAll(current, {
      analyticsReady: false,
      degradedSections: ['hotApis'],
      hotApis: [],
      overview: { totalUsers: 51 },
    });

    expect(merged.analyticsReady).toBe(false);
    expect(merged.degradedSections).toEqual(['hotApis']);
    expect(merged.hotApis).toEqual(current.hotApis);
    expect(merged.overview.totalUsers).toBe(51);
  });

  it('keeps a section unchanged when its single-section response is degraded', () => {
    const current = createDefaultAdminWorkbenchStats();
    current.overview.totalUsers = 42;

    const merged = mergeAdminWorkbenchSection(
      current,
      {
        analyticsReady: false,
        degradedSections: ['overview'],
        overview: { totalUsers: 0 },
      },
      'overview',
    );

    expect(merged.overview.totalUsers).toBe(42);
    expect(merged.degradedSections).toEqual(['overview']);
  });
});

describe('overview availability validation', () => {
  it('does not certify omitted, null or malformed fields as zero', () => {
    const next = normalizeAdminWorkbenchStats({
      overview: {
        totalUsers: 42,
        todayCalls: null,
        apiTotal: 'oops',
        unavailableFields: [],
      },
    });
    expect(next.overview.unavailableFields).toContain('todayCalls');
    expect(next.overview.unavailableFields).toContain('apiTotal');
    expect(next.overview.unavailableFields).toContain('keyTotal');
    expect(next.overview.unavailableFields).not.toContain('totalUsers');
  });
  it('ignores unrecognized field-health schemas rather than accepting their defaults', () => {
    const next = normalizeAdminWorkbenchStats({
      analyticsReady: false,
      degradedSections: ['overview'],
      overview: {
        ...createDefaultAdminWorkbenchStats().overview,
        totalUsers: 42,
        unavailableFields: ['unknownMetric'],
      },
    });
    expect(next.overview.unavailableFields).toContain('totalUsers');
  });
  it('accepts real zero counts when the complete source reports success', () => {
    const next = normalizeAdminWorkbenchStats({
      overview: createDefaultAdminWorkbenchStats().overview,
    });
    expect(next.overview.unavailableFields).toEqual([]);
  });
});
