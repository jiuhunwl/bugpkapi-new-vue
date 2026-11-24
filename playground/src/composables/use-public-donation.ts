import type { DonationApi } from '#/api/donation';

import { onScopeDispose, shallowRef } from 'vue';

import { getPublicDonationConfig } from '#/api/donation';

export function usePublicDonation() {
  const config = shallowRef<DonationApi.Config | null>(null);
  const error = shallowRef<Error | null>(null);
  const loading = shallowRef(true);
  let controller: AbortController | null = null;

  async function load() {
    controller?.abort();
    const requestController = new AbortController();
    controller = requestController;
    loading.value = true;
    error.value = null;
    try {
      config.value = await getPublicDonationConfig(requestController.signal);
    } catch (cause) {
      if (requestController.signal.aborted) return;
      error.value = cause instanceof Error ? cause : new Error(String(cause));
    } finally {
      if (
        !requestController.signal.aborted &&
        controller === requestController
      ) {
        loading.value = false;
      }
    }
  }

  onScopeDispose(() => controller?.abort());

  return { config, error, load, loading };
}
