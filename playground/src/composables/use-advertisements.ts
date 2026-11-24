import type { MaybeRefOrGetter } from 'vue';

import type { AdvertisementApi } from '#/api/advertisement';

import { readonly, ref, shallowRef, toValue, watch } from 'vue';

import { getPublicAdvertisements } from '#/api/advertisement';

function useAdvertisements(
  placement: MaybeRefOrGetter<AdvertisementApi.PublicPlacement>,
) {
  const items = ref<AdvertisementApi.PublicAdvertisement[]>([]);
  const loading = shallowRef(false);
  const failed = shallowRef(false);

  watch(
    () => toValue(placement),
    async (value, _previous, onCleanup) => {
      const controller = new AbortController();
      onCleanup(() => controller.abort());
      loading.value = true;
      failed.value = false;
      try {
        items.value = await getPublicAdvertisements(value, controller.signal);
      } catch (error) {
        if (controller.signal.aborted) return;
        items.value = [];
        failed.value = true;
      } finally {
        if (!controller.signal.aborted) {
          loading.value = false;
        }
      }
    },
    { immediate: true },
  );

  return {
    failed: readonly(failed),
    items: readonly(items),
    loading: readonly(loading),
  };
}

export { useAdvertisements };
