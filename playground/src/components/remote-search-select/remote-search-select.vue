<script setup lang="ts">
import type { RemoteOptionFetcher } from './use-remote-options';

import { onBeforeUnmount } from 'vue';

import { Select } from 'ant-design-vue';

import { useRemoteOptions } from './use-remote-options';

defineOptions({ name: 'RemoteSearchSelect' });

const props = withDefaults(
  defineProps<{
    debounceMs?: number;
    fetchOptions: RemoteOptionFetcher;
    initialLoad?: boolean;
    placeholder?: string;
  }>(),
  { debounceMs: 300, initialLoad: true, placeholder: '' },
);

const value = defineModel<number | string | undefined>();

const { options, loading, search, load, dispose } = useRemoteOptions(
  props.fetchOptions,
  props.debounceMs,
);

function onDropdownVisibleChange(open: boolean) {
  if (open && props.initialLoad && options.value.length === 0) {
    load('');
  }
}

onBeforeUnmount(dispose);
</script>

<template>
  <Select
    v-model:value="value"
    :filter-option="false"
    :loading="loading"
    :options="options"
    :placeholder="placeholder"
    allow-clear
    show-search
    @dropdown-visible-change="onDropdownVisibleChange"
    @search="search"
  />
</template>
