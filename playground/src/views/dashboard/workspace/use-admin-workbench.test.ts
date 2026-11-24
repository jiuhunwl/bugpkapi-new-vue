import type { AdminWorkbenchStats } from '#/api/core/user';

import { describe, expect, it, vi } from 'vitest';

import {
  adminWorkbenchSections,
  useAdminWorkbench,
} from './use-admin-workbench';
import {
  adminOverviewFields,
  createDefaultAdminWorkbenchStats,
} from './workspace-stats';

function response(value: Partial<AdminWorkbenchStats>) {
  return value as AdminWorkbenchStats;
}

describe('admin workbench section loader', () => {
  it('requests and replaces only the selected section', async () => {
    const load = vi.fn().mockResolvedValue(
      response({
        overview: {
          ...createDefaultAdminWorkbenchStats().overview,
          totalUsers: 42,
        },
      }),
    );
    const workbench = useAdminWorkbench({
      fallbackErrorMessage: () => 'failed',
      load,
    });

    await workbench.refreshSection('overview');

    expect(load).toHaveBeenCalledWith(['overview'], undefined, '30d');
    expect(workbench.stats.value.overview.totalUsers).toBe(42);
    expect(workbench.loading.overview).toBe(false);
    expect(workbench.loading.hotApis).toBe(false);
  });

  it('retains the previous section data after a refresh failure', async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          hotApis: [
            {
              apiCode: 'saved',
              apiStatus: 1,
              avgElapsedMs: 1,
              billableCalls: 1,
              chargeAmount: '0',
              failedCalls: 0,
              id: 'saved',
              name: 'Saved API',
              successCalls: 1,
              successRate: '100%',
              todayCalls: 1,
            },
          ],
        }),
      )
      .mockRejectedValueOnce(new Error('network timeout'));
    const workbench = useAdminWorkbench({
      fallbackErrorMessage: () => 'failed',
      load,
    });

    await workbench.refreshSection('hotApis');
    await workbench.refreshSection('hotApis');

    expect(workbench.stats.value.hotApis[0]?.id).toBe('saved');
    expect(workbench.errors.hotApis).toBe('network timeout');
    expect(workbench.loading.hotApis).toBe(false);
  });

  it('loads all sections in a single aggregated request on refreshAll', async () => {
    const load = vi.fn().mockResolvedValue(
      response({
        overview: {
          ...createDefaultAdminWorkbenchStats().overview,
          totalUsers: 7,
        },
      }),
    );
    const workbench = useAdminWorkbench({
      fallbackErrorMessage: () => 'failed',
      load,
    });

    await workbench.refreshAll();

    // 核心验收：7 个 section 只触发 1 次 HTTP（一次传全部 sections）
    expect(load).toHaveBeenCalledTimes(1);
    expect(load.mock.calls[0]?.[0]).toEqual(adminWorkbenchSections);
    expect(workbench.stats.value.overview.totalUsers).toBe(7);
    expect(workbench.loading.overview).toBe(false);
    expect(workbench.loading.hotApis).toBe(false);
  });

  it('keeps old section data when refreshAll fails (no wipe of UI)', async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          overview: {
            ...createDefaultAdminWorkbenchStats().overview,
            totalUsers: 42,
          },
        }),
      )
      .mockRejectedValueOnce(new Error('boom'));
    const workbench = useAdminWorkbench({
      fallbackErrorMessage: () => 'failed',
      load,
    });

    await workbench.refreshAll();
    expect(workbench.stats.value.overview.totalUsers).toBe(42);

    await expect(workbench.refreshAll()).rejects.toThrow('boom');
    // 失败后旧数据仍保留
    expect(workbench.stats.value.overview.totalUsers).toBe(42);
    expect(workbench.loading.overview).toBe(false);
  });

  it('refreshSection still loads only the single target section', async () => {
    const load = vi.fn().mockResolvedValue(response({}));
    const workbench = useAdminWorkbench({
      fallbackErrorMessage: () => 'failed',
      load,
    });

    await workbench.refreshSection('overview');

    expect(load).toHaveBeenCalledWith(['overview'], undefined, '30d');
  });

  it('degraded section does NOT produce errors (analyticsReady=false is not an error)', async () => {
    const onRefreshed = vi.fn();
    const workbench = useAdminWorkbench({
      fallbackErrorMessage: () => '统计修复中',
      load: vi.fn().mockResolvedValue(
        response({
          analyticsReady: false,
          degradedSections: ['overview'],
          overview: {
            ...createDefaultAdminWorkbenchStats().overview,
            totalUsers: 0,
          },
        }),
      ),
      onRefreshed,
    });

    await workbench.refreshSection('overview');

    // 降级是信息态，不是错误：不应写入 errors
    expect(workbench.errors.overview).toBe('');
    expect(workbench.available.overview).toBe(false);
    expect(workbench.degraded.overview).toBe(true);
  });

  it('single section failure does not affect other sections (error isolation)', async () => {
    const workbench = useAdminWorkbench({
      fallbackErrorMessage: () => 'failed',
      load: vi.fn().mockImplementation((sections: string[]) => {
        if (sections.includes('hotApis')) {
          return Promise.reject(new Error('hotApis boom'));
        }
        return Promise.resolve(
          response({
            overview: {
              ...createDefaultAdminWorkbenchStats().overview,
              totalUsers: 9,
            },
          }),
        );
      }),
    });

    await workbench.refreshSection('overview');
    await expect(workbench.refreshSection('hotApis')).resolves.toBeUndefined();

    // overview 健康，hotApis 失败：互不影响
    expect(workbench.available.overview).toBe(true);
    expect(workbench.errors.overview).toBe('');
    expect(workbench.errors.hotApis).toBe('hotApis boom');
    expect(workbench.available.hotApis).toBe(false);
  });

  it('marks a first degraded response unavailable instead of accepting zero data', async () => {
    const onRefreshed = vi.fn();
    const workbench = useAdminWorkbench({
      fallbackErrorMessage: () => '统计修复中',
      load: vi.fn().mockResolvedValue(
        response({
          analyticsReady: false,
          degradedSections: ['overview'],
          overview: {
            ...createDefaultAdminWorkbenchStats().overview,
            totalUsers: 0,
          },
        }),
      ),
      onRefreshed,
    });

    await workbench.refreshAll();

    expect(workbench.available.overview).toBe(false);
    // 降级不再写入 errors（修复"模块加载失败"误报）
    expect(workbench.errors.overview).toBe('');
    expect(workbench.degraded.overview).toBe(true);
    expect(onRefreshed).not.toHaveBeenCalledWith('overview');
  });

  it('retries retryable errors up to the configured limit and recovers', async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(
        response({
          overview: {
            ...createDefaultAdminWorkbenchStats().overview,
            totalUsers: 55,
          },
        }),
      );
    const workbench = useAdminWorkbench({
      fallbackErrorMessage: () => 'failed',
      load,
      retry: 2,
      retryBaseDelayMs: 0, // 测试中立刻重试
    });

    await workbench.refreshSection('overview');

    // 第一次失败 + 一次重试成功 → load 调用 2 次，最终拿到数据
    expect(load).toHaveBeenCalledTimes(2);
    expect(workbench.stats.value.overview.totalUsers).toBe(55);
    expect(workbench.errors.overview).toBe('');
    expect(workbench.available.overview).toBe(true);
  });

  it('does NOT retry on non-retryable errors (4xx class)', async () => {
    const load = vi.fn().mockRejectedValue(new Error('403 forbidden'));
    const workbench = useAdminWorkbench({
      fallbackErrorMessage: () => 'failed',
      load,
      retry: 3,
      retryBaseDelayMs: 0,
    });

    await workbench.refreshSection('overview');

    // 4xx 类不重试 → 只调用 1 次
    expect(load).toHaveBeenCalledTimes(1);
    expect(workbench.errors.overview).toBe('403 forbidden');
  });

  it('silently retains old data on CircuitOpenError without setting errors', async () => {
    // 动态导入避免类型耦合
    const { CircuitOpenError } = await import('@vben/request');
    const load = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          overview: {
            ...createDefaultAdminWorkbenchStats().overview,
            totalUsers: 77,
          },
        }),
      )
      .mockRejectedValueOnce(new CircuitOpenError('circuit open'));
    const workbench = useAdminWorkbench({
      fallbackErrorMessage: () => 'failed',
      load,
    });

    await workbench.refreshAll();
    expect(workbench.stats.value.overview.totalUsers).toBe(77);

    await workbench.refreshAll(); // 第二次：熔断 → 静默
    expect(workbench.stats.value.overview.totalUsers).toBe(77);
    expect(workbench.errors.overview).toBe('');
  });
});

describe('migration health fallback', () => {
  for (const scope of ['all', 'overview'] as const) {
    it(
      'retains real overview values when ' +
        scope +
        ' refresh reports analyticsReady=false without section details',
      async () => {
        const load = vi
          .fn()
          .mockResolvedValueOnce(
            response({
              analyticsReady: true,
              overview: {
                ...createDefaultAdminWorkbenchStats().overview,
                totalUsers: 42,
                todayCalls: 17,
              },
            }),
          )
          .mockResolvedValueOnce(
            response({
              analyticsReady: false,
              overview: createDefaultAdminWorkbenchStats().overview,
            }),
          );
        const workbench = useAdminWorkbench({
          fallbackErrorMessage: () => '统计重建中',
          load,
        });
        if (scope === 'all') {
          await workbench.refreshAll();
          await workbench.refreshAll();
        } else {
          await workbench.refreshSection('overview');
          await workbench.refreshSection('overview');
        }
        expect(workbench.stats.value.overview.totalUsers).toBe(42);
        expect(workbench.stats.value.overview.todayCalls).toBe(17);
        // 降级不写入 errors（核心修复点）
        expect(workbench.errors.overview).toBe('');
        expect(workbench.available.overview).toBe(true);
      },
    );
  }
});

describe('overview field-level isolation', () => {
  it('renders healthy overview fields during a partial first response and never certifies failed defaults', async () => {
    const workbench = useAdminWorkbench({
      fallbackErrorMessage: () => 'failed',
      load: vi.fn().mockResolvedValue(
        response({
          analyticsReady: false,
          degradedSections: ['overview'],
          overview: {
            ...createDefaultAdminWorkbenchStats().overview,
            totalUsers: 42,
            apiTotal: 8,
            totalRevenue: '138.25',
            unavailableFields: ['todayCalls', 'todayRevenue'],
          },
        }),
      ),
    });
    await workbench.refreshAll();
    expect(workbench.stats.value.overview.totalUsers).toBe(42);
    expect(workbench.overviewAvailable.totalUsers).toBe(true);
    expect(workbench.overviewAvailable.todayCalls).toBe(false);
    expect(workbench.degraded.overview).toBe(true);
    expect(workbench.lastOverviewSuccessAt.value).toBeNull();
  });
  it('retains a real stale field while updating independently healthy values', async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          overview: {
            ...createDefaultAdminWorkbenchStats().overview,
            totalUsers: 10,
            todayCalls: 7,
          },
        }),
      )
      .mockResolvedValueOnce(
        response({
          analyticsReady: false,
          degradedSections: ['overview'],
          overview: {
            ...createDefaultAdminWorkbenchStats().overview,
            totalUsers: 42,
            todayCalls: 0,
            unavailableFields: ['todayCalls'],
          },
        }),
      );
    const workbench = useAdminWorkbench({
      load,
      fallbackErrorMessage: () => 'failed',
    });
    await workbench.refreshAll();
    const refreshed = workbench.lastOverviewSuccessAt.value;
    await workbench.refreshSection('overview');
    expect(workbench.stats.value.overview.totalUsers).toBe(42);
    expect(workbench.stats.value.overview.todayCalls).toBe(7);
    expect(workbench.overviewAvailable.todayCalls).toBe(true);
    expect(workbench.lastOverviewSuccessAt.value).toBe(refreshed);
  });
});

describe('overview unsuccessful refresh status', () => {
  it('does not clear pending health or report success when the next request is circuit-blocked', async () => {
    const { CircuitOpenError } = await import('@vben/request');
    const load = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          analyticsReady: false,
          degradedSections: ['overview'],
          overview: {
            ...createDefaultAdminWorkbenchStats().overview,
            totalUsers: 42,
            unavailableFields: ['todayCalls'],
          },
        }),
      )
      .mockRejectedValueOnce(new CircuitOpenError('circuit open'));
    const workbench = useAdminWorkbench({
      load,
      fallbackErrorMessage: () => 'failed',
    });
    await workbench.refreshAll();
    await workbench.refreshAll();
    expect(workbench.degraded.overview).toBe(true);
    expect(workbench.lastRefreshSucceeded.value).toBe(false);
    expect(workbench.lastOverviewSuccessAt.value).toBeNull();
    expect(workbench.overviewAvailable.todayCalls).toBe(false);
    expect(workbench.stats.value.overview.totalUsers).toBe(42);
  });
});

describe('fully unavailable overview fields', () => {
  for (const scope of ['all', 'overview'] as const) {
    it(
      'keeps a first all-field failure unavailable during ' +
        scope +
        ' refresh without section flags',
      async () => {
        const defaults = createDefaultAdminWorkbenchStats();
        const onRefreshed = vi.fn();
        const workbench = useAdminWorkbench({
          fallbackErrorMessage: () => 'load failed',
          onRefreshed,
          load: vi.fn().mockResolvedValue({
            ...defaults,
            analyticsReady: true,
            degradedSections: [],
            overview: {
              ...defaults.overview,
              unavailableFields: [...adminOverviewFields],
            },
          }),
        });
        if (scope === 'all') await workbench.refreshAll();
        else await workbench.refreshSection('overview');
        expect(Object.values(workbench.overviewAvailable)).toHaveLength(16);
        expect(
          Object.values(workbench.overviewAvailable).every(
            (available) => !available,
          ),
        ).toBe(true);
        expect(workbench.available.overview).toBe(false);
        expect(workbench.degraded.overview).toBe(true);
        expect(workbench.lastOverviewSuccessAt.value).toBeNull();
        expect(onRefreshed).not.toHaveBeenCalledWith('overview');
      },
    );
  }
});


describe('call trend freshness recovery', () => {
  it('retains the last valid trend through degraded and failed refreshes, then accepts recovery', async () => {
    const defaults = createDefaultAdminWorkbenchStats();
    const ready = {
      ...defaults,
      analyticsReady: true,
      degradedSections: [],
      overview: {
        ...defaults.overview,
        totalUsers: 42,
        unavailableFields: [],
      },
      callTrend7d: {
        ...defaults.callTrend7d,
        labels: ['10-10'],
        total: 1,
        totalCalls: [1],
        successCalls: [1],
        failedCalls: [0],
        billableCalls: [0],
        chargeAmounts: ['0.0000'],
      },
    } satisfies AdminWorkbenchStats;
    const load = vi
      .fn()
      .mockResolvedValueOnce(ready)
      .mockResolvedValueOnce(response({
        ...ready,
        analyticsReady: false,
        degradedSections: ['callTrend7d'],
        callTrend7d: defaults.callTrend7d,
        overview: { ...ready.overview, totalUsers: 43 },
      }))
      .mockRejectedValueOnce(new Error('statistics temporarily unavailable'))
      .mockResolvedValueOnce(response({
        ...ready,
        callTrend7d: {
          ...ready.callTrend7d,
          total: 2,
          totalCalls: [2],
          failedCalls: [1],
        },
      }));
    const workbench = useAdminWorkbench({
      load,
      fallbackErrorMessage: () => 'failed',
    });
    await workbench.refreshAll();
    expect(workbench.stats.value.callTrend7d.total).toBe(1);
    await workbench.refreshAll();
    expect(workbench.stats.value.callTrend7d.total).toBe(1);
    expect(workbench.stats.value.callTrend7d.totalCalls).toEqual([1]);
    expect(workbench.stats.value.overview.totalUsers).toBe(43);
    expect(workbench.available.callTrend7d).toBe(true);
    expect(workbench.degraded.callTrend7d).toBe(true);
    expect(workbench.lastRefreshSucceeded.value).toBe(false);
    await workbench.refreshSection('callTrend7d');
    expect(workbench.stats.value.callTrend7d.total).toBe(1);
    expect(workbench.errors.callTrend7d).toBe('statistics temporarily unavailable');
    await workbench.refreshAll();
    expect(workbench.stats.value.callTrend7d.total).toBe(2);
    expect(workbench.stats.value.callTrend7d.successCalls).toEqual([1]);
    expect(workbench.stats.value.callTrend7d.failedCalls).toEqual([1]);
    expect(workbench.degraded.callTrend7d).toBe(false);
    expect(workbench.errors.callTrend7d).toBe('');
    expect(workbench.lastRefreshSucceeded.value).toBe(true);
  });
});
