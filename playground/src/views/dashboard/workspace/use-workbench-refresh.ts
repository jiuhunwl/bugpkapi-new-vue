import { reactive, readonly } from 'vue';

/**
 * 工作台刷新协调器（页面级“单飞令牌”）
 *
 * 同时被 useAdminWorkbench（挂载直调 / 手动刷新）与 useAdminAutoRefresh（轮询）复用，
 * 解决“轮询单飞 / 挂载直调 / 手动刷新互斥”三源合一：
 * - refresh()（弱触发，轮询/挂载）：已有在途刷新则直接共享同一 promise（合并）；
 * - refresh({ force: true })（手动刷新）：打断在途轮询（version++ 使旧结果失效），发起新刷新；
 * - reset()：组件卸载 / 协调器 dispose 时解除进行中状态。
 */

export interface WorkbenchRefreshState {
  /** 全局刷新令牌：任何刷新（轮询/挂载/手动）进行中 → true */
  refreshing: boolean;
  /** 上一次成功时间（供轮询决策与观测） */
  lastSuccessAt: number | null;
  /** 取消/失效令牌：force 抢断时 version++ 使在途刷新结果作废 */
  version: number;
  /** 熔断观察：最近一次 CircuitOpenError 的时间（组合层据此静默保留旧数据） */
  circuitOpenAt: number | null;
}

interface UseWorkbenchRefreshOptions {
  /** 统一刷新器；返回 true 表示成功（供 lastSuccessAt 更新） */
  refresh: () => Promise<boolean>;
  /** 状态变更回调（可选） */
  onStateChange?: (state: WorkbenchRefreshState) => void;
}

export function useWorkbenchRefresh(options: UseWorkbenchRefreshOptions) {
  const state = reactive<WorkbenchRefreshState>({
    circuitOpenAt: null,
    lastSuccessAt: null,
    refreshing: false,
    version: 0,
  });

  /** 当前在途刷新 promise（合并/共享的关键） */
  let inFlight: Promise<void> | undefined;

  /**
   * 运行一次统一刷新（内部吞错，不向上抛未处理 promise）
   * @param runVersion 本次刷新创建时的 version，用于判断结果是否已失效
   */
  function runRefreshing(runVersion: number): Promise<void> {
    const current = Promise.resolve()
      .then(() => options.refresh())
      .then((ok) => {
        // force 抢断后旧版本的结果作废，不更新 lastSuccessAt
        if (runVersion === state.version && ok) {
          state.lastSuccessAt = Date.now();
        }
      })
      .catch((error: unknown) => {
        // 熔断错误仅记录时间，具体页面提示由组合层负责
        if (
          error instanceof Object &&
          (error as { code?: string; name?: string }).name ===
            'CircuitOpenError'
        ) {
          state.circuitOpenAt = Date.now();
        }
      })
      .finally(() => {
        if (inFlight === current) {
          inFlight = undefined;
        }
        if (runVersion === state.version) {
          state.refreshing = false;
          options.onStateChange?.(state);
        }
      });
    inFlight = current;
    return current;
  }

  /**
   * 触发刷新
   * @param bypass.force - true 表示手动强刷（打断在途轮询）；false/省略为弱触发
   */
  function refresh(bypass?: { force?: boolean }): Promise<void> {
    const force = bypass?.force === true;
    if (!force && inFlight) {
      // 弱触发且已有在途：合并（drop 新请求，直接共享进行中 promise）
      return inFlight;
    }
    if (force) {
      // 手动强刷：使在途刷新结果失效并立即发起新请求（请求层去重也会合并同 URL）
      state.version += 1;
    }
    state.refreshing = true;
    options.onStateChange?.(state);
    return runRefreshing(state.version);
  }

  /** 解除进行中状态（组件卸载 / 协调器销毁） */
  function reset(): void {
    state.version += 1;
    state.refreshing = false;
    inFlight = undefined;
  }

  return {
    refresh,
    reset,
    state: readonly(state),
  };
}