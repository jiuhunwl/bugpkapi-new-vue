import { onBeforeUnmount, onMounted, watch } from 'vue';

import { useDocumentVisibility } from '@vueuse/core';

interface UseRiskAutoRefreshOptions {
  intervalMs?: number;
}

export function useRiskAutoRefresh(
  refresh: () => Promise<void>,
  options: UseRiskAutoRefreshOptions = {},
) {
  const { intervalMs = 30_000 } = options;
  const visibility = useDocumentVisibility();

  let activeRefresh: Promise<void> | undefined;
  let disposed = false;
  let refreshQueued = false;
  let timer: ReturnType<typeof setInterval> | undefined;

  function refreshNow() {
    if (disposed) {
      return Promise.resolve();
    }
    refreshQueued = true;
    if (activeRefresh) {
      return activeRefresh;
    }
    activeRefresh = (async () => {
      while (!disposed && refreshQueued) {
        refreshQueued = false;
        try {
          await refresh();
        } catch {
          // The shared request client already presents the backend error.
        }
      }
    })().finally(() => {
      activeRefresh = undefined;
      refreshQueued = false;
    });
    return activeRefresh;
  }

  function runScheduledRefresh() {
    if (visibility.value !== 'visible') {
      return;
    }
    void refreshNow();
  }

  watch(visibility, (value) => {
    if (value === 'visible') {
      void runScheduledRefresh();
    }
  });

  onMounted(() => {
    void runScheduledRefresh();
    timer = setInterval(() => {
      void runScheduledRefresh();
    }, intervalMs);
  });

  onBeforeUnmount(() => {
    disposed = true;
    refreshQueued = false;
    if (timer) {
      clearInterval(timer);
      timer = undefined;
    }
  });

  return {
    refreshNow,
  };
}
