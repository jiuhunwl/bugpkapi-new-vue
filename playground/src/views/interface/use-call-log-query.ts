import type { getInterfaceCallLogList, InterfaceApi } from '#/api/interface';
import type { CallLogPageRequest } from './log-pagination';

import { shallowRef } from 'vue';
import { createCallLogCursorPager } from './log-pagination';
import { createLatestRequestRunner } from './log-request';

/** List and count have independent lifetimes: a slow count never hides rows. */
export function useCallLogQuery(load: typeof getInterfaceCallLogList) {
  const fastMode = shallowRef(true);
  const currentPage = shallowRef(1);
  const pageSize = shallowRef(20);
  const hasNext = shallowRef(false);
  const total = shallowRef<number | null>(null);
  const loading = shallowRef(false);
  const countLoading = shallowRef(false);
  const countError = shallowRef(false);
  const hasLoaded = shallowRef(false);
  const pager = createCallLogCursorPager();
  const runner = createLatestRequestRunner(
    (
      params: InterfaceApi.CallLogListParams,
      userScope: boolean,
      signal: AbortSignal,
    ) => load(params, userScope, signal),
  );
  let scope = '';
  let generation = 0;
  let lastPage = 1;
  let countController: AbortController | undefined;
  let lastQuery:
    | { filters: InterfaceApi.CallLogListParams; userScope: boolean }
    | undefined;

  function cancelCount() {
    countController?.abort();
    countController = undefined;
    countLoading.value = false;
    countError.value = false;
  }

  function cancel() {
    generation++;
    runner.cancel();
    cancelCount();
    loading.value = false;
    hasLoaded.value = false;
    lastQuery = undefined;
  }

  function reset() {
    cancel();
    pager.reset();
    scope = '';
    lastPage = currentPage.value = 1;
    hasNext.value = false;
    total.value = null;
  }

  async function query(
    gridPage: CallLogPageRequest,
    filters: InterfaceApi.CallLogListParams,
    userScope: boolean,
  ) {
    const size = fastMode.value ? pageSize.value : gridPage.pageSize;
    const key = JSON.stringify([
      Object.entries(filters).sort(([a], [b]) => a.localeCompare(b)),
      userScope,
      fastMode.value,
      size,
    ]);
    if (key !== scope) {
      pager.reset();
      lastPage = currentPage.value = 1;
      hasNext.value = false;
      scope = key;
    }
    const requestPage = fastMode.value
      ? currentPage.value
      : gridPage.currentPage;
    const params = { ...filters, includeTotal: !fastMode.value };
    const request = pager.start(
      { currentPage: requestPage, pageSize: size },
      params,
    );
    const version = ++generation;
    cancelCount();
    total.value = null;
    loading.value = true;
    hasLoaded.value = false;
    lastQuery = undefined;
    try {
      const result = await runner.run(request.params, userScope);
      if (version === generation) {
        pager.accept(request, result);
        lastPage = currentPage.value = requestPage;
        hasNext.value = !!result.nextCursor;
        total.value =
          result.totalOmitted || result.total < 0 ? null : result.total;
        lastQuery = { filters: { ...filters }, userScope };
        hasLoaded.value = true;
      }
      return result;
    } catch (error) {
      if (version === generation) currentPage.value = lastPage;
      throw error;
    } finally {
      if (version === generation) {
        loading.value = false;
        // Rows stay usable while the count runs with the exact same filters.
        // Errors are represented in countError and may be retried from the footer.
        if (lastQuery && total.value === null) void loadTotal().catch(() => {});
      }
    }
  }

  async function loadTotal() {
    if (!lastQuery || loading.value || countLoading.value) return;
    const version = generation;
    const controller = new AbortController();
    countController = controller;
    countLoading.value = true;
    countError.value = false;
    try {
      const result = await load(
        { ...lastQuery.filters, includeTotal: true, page: 1, pageSize: 1 },
        lastQuery.userScope,
        controller.signal,
      );
      if (version === generation && !controller.signal.aborted) {
        total.value =
          result.totalOmitted || result.total < 0 ? null : result.total;
      }
    } catch (error) {
      if (version === generation && !controller.signal.aborted) {
        countError.value = true;
        total.value = null;
        throw error;
      }
    } finally {
      if (countController === controller) {
        countController = undefined;
        countLoading.value = false;
      }
    }
  }

  return {
    cancel,
    countLoading,
    countError,
    currentPage,
    fastMode,
    hasLoaded,
    hasNext,
    loading,
    loadTotal,
    pageSize,
    query,
    reset,
    total,
  };
}
