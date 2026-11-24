<script setup lang="ts">
import type { KeyApi } from '#/api/key';

import { computed } from 'vue';

import { $t } from '#/locales';

interface Props {
  modelValue: KeyApi.KeyOwnerScope;
  showAll?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showAll: false,
});

const emit = defineEmits<{
  change: [scope: KeyApi.KeyOwnerScope];
  'update:modelValue': [scope: KeyApi.KeyOwnerScope];
}>();

const options = computed<Array<{ label: string; value: KeyApi.KeyOwnerScope }>>(
  () => {
    const mine = {
      label: $t('system.key.myKeys'),
      value: 'mine' as const,
    };
    if (!props.showAll) return [mine];
    return [
      {
        label: $t('system.key.userKeys'),
        value: 'all' as const,
      },
      mine,
    ];
  },
);

function selectScope(scope: KeyApi.KeyOwnerScope) {
  if (scope === props.modelValue) return;
  emit('update:modelValue', scope);
  emit('change', scope);
}
</script>

<template>
  <div
    :aria-label="$t('system.key.ownerScope')"
    class="key-owner-tabs"
    role="tablist"
  >
    <button
      v-for="option in options"
      :key="option.value"
      :aria-selected="option.value === modelValue"
      class="key-owner-tab"
      :class="{ active: option.value === modelValue }"
      role="tab"
      type="button"
      @click="selectScope(option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.key-owner-tabs {
  display: inline-flex;
  gap: 4px;
  padding: 3px;
  margin-bottom: 12px;
  background: hsl(var(--muted) / 55%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.key-owner-tab {
  min-width: 96px;
  padding: 6px 14px;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 6px;
  transition:
    color 0.15s ease,
    background-color 0.15s ease,
    box-shadow 0.15s ease;
}

.key-owner-tab:hover {
  color: hsl(var(--foreground));
}

.key-owner-tab.active {
  color: hsl(var(--foreground));
  background: hsl(var(--background));
  box-shadow: 0 1px 3px hsl(var(--foreground) / 12%);
}
</style>
