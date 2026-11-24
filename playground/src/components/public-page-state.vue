<script setup lang="ts">
import { computed } from 'vue';
import type { VNode } from 'vue';

import { IconifyIcon } from '@vben/icons';

const props = withDefaults(
  defineProps<{
    description?: string;
    icon: string;
    title: string;
    tone?: 'danger' | 'info' | 'success' | 'warning';
  }>(),
  { tone: 'info' },
);

defineSlots<{
  action?: () => VNode[];
}>();

const stateClass = computed(() => `is-${props.tone}`);
</script>

<template>
  <section class="public-page-state" :class="stateClass" role="status">
    <IconifyIcon class="public-page-state-icon" :icon="props.icon" />
    <h2>{{ props.title }}</h2>
    <p v-if="props.description">{{ props.description }}</p>
    <div v-if="$slots.action" class="public-page-state-action">
      <slot name="action" />
    </div>
  </section>
</template>

<style scoped>
.public-page-state {
  display: grid;
  justify-items: center;
  gap: 12px;
  padding: 56px 24px;
  color: var(--ps-text, var(--home-text));
  text-align: center;
  background: var(--ps-surface, var(--home-surface));
  border: 1px solid var(--ps-border, var(--home-border));
  border-radius: 12px;
}

.public-page-state-icon {
  font-size: 36px;
  color: var(--ps-primary, var(--home-primary));
}

.public-page-state.is-danger .public-page-state-icon {
  color: var(--ps-danger, var(--home-danger));
}

.public-page-state.is-success .public-page-state-icon {
  color: var(--ps-success, var(--home-success));
}

.public-page-state.is-warning .public-page-state-icon {
  color: var(--ps-warning, var(--home-warning));
}

.public-page-state h2,
.public-page-state p {
  margin: 0;
}

.public-page-state p {
  max-width: 52ch;
  color: var(--ps-muted, var(--home-muted));
}
</style>
