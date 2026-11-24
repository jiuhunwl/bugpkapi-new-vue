import type {
  AdminAccessRange,
  AdminWorkbenchSection,
  AdminWorkbenchStats,
} from '#/api/core/user';

import { reactive, readonly, ref } from 'vue';

import { CircuitOpenError } from '@vben/request';

import { getAdminWorkbenchStatsApi } from '#/api/core/user';

import {
  adminOverviewFields,
  createDefaultAdminWorkbenchStats,
  normalizeAdminWorkbenchStats,
  mergeAdminWorkbenchAll,
  mergeAdminWorkbenchSection,
} from './workspace-stats';

export const adminWorkbenchSections: AdminWorkbenchSection[] = [
  'overview',
  'callTrend7d',
  'revenueTrend7d',
  'hotApis',
  'alerts',
  'activeUsers',
  'access',
];

type AdminWorkbenchLoader = (
  sections?: AdminWorkbenchSection[],
  config?: Parameters<typeof getAdminWorkbenchStatsApi>[1],
  accessRange?: AdminAccessRange,
) => Promise<AdminWorkbenchStats>;

interface UseAdminWorkbenchOptions {
  fallbackErrorMessage: () => string;
  load?: AdminWorkbenchLoader;
  /** 请求层透传配置（signal / circuitGroupKey 等），为 undefined 时不改变 load 调用签名 */
  requestConfig?: Parameters<typeof getAdminWorkbenchStatsApi>[1];
  onRefreshed?: (section: AdminWorkbenchSection) => Promise<void> | void;
  /**
   * 失败时的有界重试次数（默认 0，不重试）。
   * 仅对"可重试错误"（网络/超时/5xx 类）重试；CircuitOpenError 与业务错误不重试。
   * 退避：baseDelay * 2^attempt（指数退避）。
   */
  retry?: number;
  /** 重试退避基准延迟（毫秒，默认 250ms） */
  retryBaseDelayMs?: number;
}

function sectionRecord<T>(value: T): Record<AdminWorkbenchSection, T> {
  return {
    access: value,
    activeUsers: value,
    alerts: value,
    callTrend7d: value,
    hotApis: value,
    overview: value,
    revenueTrend7d: value,
  };
}

/** 判断错误是否值得重试（网络层/超时/5xx 类；熔断与 4xx 不重试） */
function isRetryableError(error: unknown): boolean {
  if (error instanceof CircuitOpenError) return false;
  if (!(error instanceof Error)) return true;
  const message = error.message.trim().toLowerCase();
  if (
    /\b(401|403|4\d{2}|unauthorized|forbidden|invalid|bad request)\b/.test(
      message,
    )
  ) {
    return false;
  }
  return true;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function useAdminWorkbench(options: UseAdminWorkbenchOptions) {
  const load = options.load ?? getAdminWorkbenchStatsApi;
  const requestConfig = options.requestConfig;
  const retry = Math.max(0, Number(options.retry ?? 0));
  const retryBaseDelayMs = Math.max(0, Number(options.retryBaseDelayMs ?? 250));

  const stats = ref<AdminWorkbenchStats>(createDefaultAdminWorkbenchStats());
  const available = reactive(sectionRecord(false));
  const overviewAvailable = reactive(
    Object.fromEntries(
      adminOverviewFields.map((field) => [field, false]),
    ) as Record<(typeof adminOverviewFields)[number], boolean>,
  );
  const lastOverviewSuccessAt = ref<number | null>(null);
  const lastRefreshSucceeded = ref(false);

  function acceptOverview(value: AdminWorkbenchStats) {
    const next = normalizeAdminWorkbenchStats(value).overview;
    const unavailable = new Set(next.unavailableFields);
    for (const field of adminOverviewFields) {
      if (!unavailable.has(field)) overviewAvailable[field] = true;
    }
    if (adminOverviewFields.some((field) => overviewAvailable[field]))
      available.overview = true;
    if (unavailable.size === 0) lastOverviewSuccessAt.value = Date.now();
  }
  const loading = reactive(sectionRecord(false));
  const errors = reactive(sectionRecord(''));
  // 「降级」与「失败」分开：降级是数据迟到（非错误），失败才是真错误
  const degraded = reactive(sectionRecord(false));
  // 访问态势图册的时间范围。默认 30 天，与后端默认口径一致。
  const accessRange = ref<AdminAccessRange>('30d');

  /**
   * setAccessRange 切换访问态势范围，并立即按新范围重查 access section。
   *
   * 不复用 refreshSection：那里面有 loading 短路保护，而范围切换恰好是在
   * 面板可能正处于加载中时发起的（用户连点不同范围），必须允许并发覆盖。
   * 这里改为直接调用请求并在返回后比对范围是否仍是当前值，丢弃过期响应。
   */
  async function setAccessRange(next: AdminAccessRange) {
    if (next === accessRange.value) return;
    accessRange.value = next;
    const requestedRange = next;
    loading.access = true;
    errors.access = '';
    try {
      const value = await callLoadWithRetry(['access']);
      if (accessRange.value !== requestedRange) {
        // 用户已切到别的范围，本次响应已过期，丢弃以免覆盖更新的结果。
        return;
      }
      stats.value = mergeAdminWorkbenchSection(stats.value, value, 'access');
      const degradedSet = degradedResponseSections(value, ['access']);
      if (degradedSet.has('access')) {
        degraded.access = true;
        return;
      }
      available.access = true;
      degraded.access = false;
      await options.onRefreshed?.('access');
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        return;
      }
      errors.access =
        error instanceof Error && error.message.trim()
          ? error.message
          : options.fallbackErrorMessage();
    } finally {
      if (accessRange.value === requestedRange) {
        loading.access = false;
      }
    }
  }

  /** 7 个 section 的 loading 联动（全量刷新时避免面板局部闪烁） */
  function markAllLoading(sections: AdminWorkbenchSection[], value: boolean) {
    sections.forEach((section) => {
      loading[section] = value;
    });
  }

  /** Clear request errors; retain health until a real response supersedes it. */
  function clearAllStatus() {
    adminWorkbenchSections.forEach((section) => {
      errors[section] = '';
    });
  }

  /** 调用 load，兼容测试签名（无 requestConfig 时不携带第二参数） */
  function callLoad(
    sections: AdminWorkbenchSection[],
  ): Promise<AdminWorkbenchStats> {
    // 访问态势必须始终带上当前范围：省略时后端按默认 30 天返回，
    // 会导致用户切到「今天」后刷新整页又变回 30 天。
    if (requestConfig) {
      return load(sections, requestConfig, accessRange.value);
    }
    return load(sections, undefined, accessRange.value);
  }

  /** 带重试的 load 调用（仅对可重试错误重试） */
  async function callLoadWithRetry(
    sections: AdminWorkbenchSection[],
  ): Promise<AdminWorkbenchStats> {
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        return await callLoad(sections);
      } catch (error) {
        if (attempt >= retry || !isRetryableError(error)) {
          throw error;
        }
        attempt += 1;
        await sleep(retryBaseDelayMs * 2 ** (attempt - 1));
      }
    }
  }

  function degradedResponseSections(
    value: AdminWorkbenchStats,
    requested: AdminWorkbenchSection[],
  ) {
    const degradedSet = new Set(value.degradedSections ?? []);
    if (value.analyticsReady === false && degradedSet.size === 0) {
      requested.forEach((section) => degradedSet.add(section));
    }
    if (
      requested.includes('overview') &&
      normalizeAdminWorkbenchStats(value).overview.unavailableFields?.length
    ) {
      degradedSet.add('overview');
    }
    return degradedSet;
  }

  /**
   * refreshSection — 保持原签名兼容。
   * load([section]) 单 section 请求；请求层去重保证与任意并发的同 URL 请求共享。
   */
  async function refreshSection(section: AdminWorkbenchSection) {
    if (loading[section]) return;
    loading[section] = true;
    errors[section] = '';
    try {
      const value = await callLoadWithRetry([section]);
      stats.value = mergeAdminWorkbenchSection(stats.value, value, section);
      if (section === 'overview') acceptOverview(value);
      const degradedSet = degradedResponseSections(value, [section]);
      if (degradedSet.has(section)) {
        // 降级是「数据未就绪」，不是错误：保留旧数据，仅标记降级
        // 首次降级（此前无真实数据）→ available=false；已有旧数据 → 保持 true
        // 不写 errors，避免触发整页错误横幅
        degraded[section] = true;
        return;
      }
      available[section] = true;
      degraded[section] = false;
      await options.onRefreshed?.(section);
    } catch (error) {
      // 熔断降级信号：静默保留旧数据，不设置 section 错误、不抛给调用方
      if (error instanceof CircuitOpenError) {
        return;
      }
      errors[section] =
        error instanceof Error && error.message.trim()
          ? error.message
          : options.fallbackErrorMessage();
    } finally {
      loading[section] = false;
    }
  }

  /**
   * refreshAllSections — 一次请求全量合并（核心优化：7 次 HTTP → 1 次）
   * 显式传全部 sections，与后端 ParseAdminWorkbenchSections 语义一致。
   */
  async function refreshAllSections(): Promise<AdminWorkbenchStats> {
    markAllLoading(adminWorkbenchSections, true);
    clearAllStatus();
    lastRefreshSucceeded.value = false;
    try {
      const value = await callLoadWithRetry(adminWorkbenchSections);
      stats.value = mergeAdminWorkbenchAll(stats.value, value);
      acceptOverview(value);
      const degradedSet = degradedResponseSections(
        value,
        adminWorkbenchSections,
      );
      const healthySections = adminWorkbenchSections.filter(
        (section) => !degradedSet.has(section),
      );
      adminWorkbenchSections.forEach((section) => {
        if (degradedSet.has(section)) {
          // 降级标记（非错误）：保留旧数据，不写 errors
          degraded[section] = true;
          return;
        }
        available[section] = true;
        degraded[section] = false;
        errors[section] = '';
      });
      await Promise.all(
        healthySections.map((section) => options.onRefreshed?.(section)),
      );
      lastRefreshSucceeded.value =
        healthySections.length === adminWorkbenchSections.length;
      return stats.value;
    } catch (error) {
      // 熔断降级信号：静默保留旧数据，不设置 section 错误、不抛给调用方
      if (error instanceof CircuitOpenError) {
        return stats.value;
      }
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : options.fallbackErrorMessage();
      adminWorkbenchSections.forEach((section) => {
        errors[section] = message;
      });
      throw error;
    } finally {
      markAllLoading(adminWorkbenchSections, false);
    }
  }

  /**
   * refreshAll — 兼容旧接口（内部 = refreshAllSections，一次请求）
   */
  async function refreshAll(): Promise<AdminWorkbenchStats> {
    return refreshAllSections();
  }

  return {
    accessRange: readonly(accessRange),
    available: readonly(available),
    degraded: readonly(degraded),
    errors: readonly(errors),
    loading: readonly(loading),
    overviewAvailable: readonly(overviewAvailable),
    lastOverviewSuccessAt: readonly(lastOverviewSuccessAt),
    lastRefreshSucceeded: readonly(lastRefreshSucceeded),
    refreshAll,
    refreshAllSections,
    refreshSection,
    setAccessRange,
    stats: readonly(stats),
  };
}
