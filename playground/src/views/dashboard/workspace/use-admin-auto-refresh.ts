import { onBeforeUnmount, onMounted, shallowRef, watch } from 'vue';

import { useDocumentVisibility } from '@vueuse/core';

export const ADMIN_AUTO_REFRESH_STORAGE_KEY =
  'bugpk:admin-workbench:auto-refresh-seconds';
export const ADMIN_AUTO_REFRESH_MIN_SECONDS = 5;
export const ADMIN_AUTO_REFRESH_MAX_SECONDS = 3600;

interface UseAdminAutoRefreshOptions {
  defaultInterval?: number;
  storageKey?: string;
  /** 卸载/销毁时回调（用于协调器 dispose） */
  onDispose?: () => void;
}

interface SchedulerState {
  timer?: ReturnType<typeof setTimeout>;
  refreshToken?: symbol;
}

function normalizeInterval(value: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  const rounded = Math.round(value);
  if (rounded <= 0) {
    return 0;
  }
  return Math.min(
    ADMIN_AUTO_REFRESH_MAX_SECONDS,
    Math.max(ADMIN_AUTO_REFRESH_MIN_SECONDS, rounded),
  );
}

function loadSavedInterval(storageKey: string, fallback: number) {
  if (typeof localStorage === 'undefined') {
    return fallback;
  }
  const rawSaved = localStorage.getItem(storageKey);
  if (rawSaved === null) {
    return fallback;
  }
  const saved = Number(rawSaved);
  return normalizeInterval(saved, fallback);
}

export function useAdminAutoRefresh(
  refresh: () => Promise<void>,
  options: UseAdminAutoRefreshOptions = {},
) {
  const {
    defaultInterval = 5,
    onDispose,
    storageKey = ADMIN_AUTO_REFRESH_STORAGE_KEY,
  } = options;
  const visibility = useDocumentVisibility();
  const normalizedDefault = normalizeInterval(defaultInterval, 5);
  const intervalSeconds = shallowRef<number>(
    loadSavedInterval(storageKey, normalizedDefault),
  );

  let disposed = false;
  let mounted = false;
  let activeRefresh: Promise<void> | undefined;
  const scheduler: SchedulerState = {};

  function clearTimer() {
    if (scheduler.timer) {
      clearTimeout(scheduler.timer);
      scheduler.timer = undefined;
    }
  }

  /**
   * clear-then-schedule：先清旧 timer 再按当前状态调度，避免“旧 setTimeout 回调
   * 还在链路上、新值又叠一个”的重复滚动/轮询问题。
   */
  function scheduleNextRefresh() {
    clearTimer();
    if (
      disposed ||
      !mounted ||
      visibility.value !== 'visible' ||
      intervalSeconds.value <= 0
    ) {
      return;
    }
    scheduler.timer = setTimeout(() => {
      scheduler.timer = undefined;
      void runScheduledRefresh();
    }, intervalSeconds.value * 1000);
  }

  /**
   * 单飞：轮询触发交给协调器（refresh 参数），若上一轮刷新仍在途，
   * 协调器内部会 drop/merge（见 use-workbench-refresh.ts），这里仅负责时间调度。
   */
  async function runScheduledRefresh() {
    if (
      disposed ||
      visibility.value !== 'visible' ||
      intervalSeconds.value <= 0
    ) {
      // 不满足调度条件：重新按条件调度（等效于等待下一次可见）
      scheduleNextRefresh();
      return;
    }
    activeRefresh ??= Promise.resolve()
      .then(() => refresh())
      .catch(() => {
        // workbench 模块自持错误状态
      })
      .finally(() => {
        activeRefresh = undefined;
      });
    await activeRefresh;
    scheduleNextRefresh();
  }

  function setIntervalSeconds(value: number) {
    const normalized = normalizeInterval(value, intervalSeconds.value);
    if (normalized === intervalSeconds.value) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(storageKey, String(normalized));
      }
      scheduleNextRefresh();
      return;
    }
    intervalSeconds.value = normalized;
  }

  watch(intervalSeconds, (value) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(storageKey, String(value));
    }
    // 间隔变化：clear-then-schedule
    scheduleNextRefresh();
  });

  watch(visibility, () => {
    // 可见性变化：隐藏时停止（clearTimer），恢复可见时重新调度
    if (visibility.value !== 'visible') {
      clearTimer();
      return;
    }
    scheduleNextRefresh();
  });

  onMounted(() => {
    mounted = true;
    scheduleNextRefresh();
  });

  onBeforeUnmount(() => {
    disposed = true;
    mounted = false;
    clearTimer();
    onDispose?.();
  });

  return {
    intervalSeconds,
    setIntervalSeconds,
  };
}