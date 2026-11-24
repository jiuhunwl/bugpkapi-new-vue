import type { DonationApi } from '#/api/donation';

import { computed, onScopeDispose, shallowRef } from 'vue';

import { getPublicDonationSupporters } from '#/api/donation';

const defaultPageSize = 12;

export function usePublicDonationSupporters() {
  const error = shallowRef<Error | null>(null);
  const items = shallowRef<DonationApi.Supporter[]>([]);
  const loading = shallowRef(false);
  const loadingMore = shallowRef(false);
  const page = shallowRef(0);
  const total = shallowRef(0);
  let controller: AbortController | null = null;

  const hasMore = computed(() => items.value.length < total.value);

  async function loadPage(targetPage: number, reset: boolean) {
    if (!reset && (loading.value || loadingMore.value || !hasMore.value)) {
      return;
    }
    controller?.abort();
    const requestController = new AbortController();
    controller = requestController;
    error.value = null;
    if (reset) loading.value = true;
    else loadingMore.value = true;

    try {
      const result = await getPublicDonationSupporters(
        { page: targetPage, pageSize: defaultPageSize },
        requestController.signal,
      );
      if (requestController.signal.aborted) return;
      items.value = reset
        ? [...result.items]
        : [...items.value, ...result.items];
      page.value = targetPage;
      total.value = result.total;
    } catch (cause) {
      if (requestController.signal.aborted) return;
      error.value = cause instanceof Error ? cause : new Error(String(cause));
    } finally {
      if (controller === requestController) {
        loading.value = false;
        loadingMore.value = false;
        controller = null;
      }
    }
  }

  function reload() {
    return loadPage(1, true);
  }

  function loadMore() {
    return loadPage(page.value + 1, false);
  }

  onScopeDispose(() => controller?.abort());

  return {
    error,
    hasMore,
    items,
    loadMore,
    loading,
    loadingMore,
    reload,
    total,
  };
}
