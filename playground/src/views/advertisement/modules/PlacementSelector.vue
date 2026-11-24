<script setup lang="ts">
import type { AdvertisementApi } from '#/api/advertisement';

import { computed } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { $t } from '#/locales';

const model = defineModel<AdvertisementApi.Placement>({ required: true });

const options = computed(() => [
  {
    description: $t('advertisementAdmin.placementDescriptions.home'),
    icon: 'lucide:house',
    label: $t('advertisementAdmin.placements.home'),
    value: 'HOME' as const,
  },
  {
    description: $t('advertisementAdmin.placementDescriptions.console'),
    icon: 'lucide:layout-dashboard',
    label: $t('advertisementAdmin.placements.console'),
    value: 'CONSOLE' as const,
  },
  {
    description: $t('advertisementAdmin.placementDescriptions.notice'),
    icon: 'lucide:megaphone',
    label: $t('advertisementAdmin.placements.notice'),
    value: 'NOTICE' as const,
  },
  {
    description: $t('advertisementAdmin.placementDescriptions.serviceProvider'),
    icon: 'lucide:handshake',
    label: $t('advertisementAdmin.placements.serviceProvider'),
    value: 'SERVICE_PROVIDER' as const,
  },
  {
    description: $t('advertisementAdmin.placementDescriptions.apiResponse'),
    icon: 'lucide:braces',
    label: $t('advertisementAdmin.placements.apiResponse'),
    value: 'API_RESPONSE' as const,
  },
]);
</script>

<template>
  <div class="placement-selector" role="radiogroup">
    <button
      v-for="option in options"
      :key="option.value"
      :aria-checked="model === option.value"
      class="placement-option"
      :class="{ 'placement-option--active': model === option.value }"
      role="radio"
      type="button"
      @click="model = option.value"
    >
      <span class="placement-option__icon">
        <IconifyIcon :icon="option.icon" class="size-5" />
      </span>
      <span class="placement-option__copy">
        <strong>{{ option.label }}</strong>
        <small>{{ option.description }}</small>
      </span>
      <IconifyIcon
        v-if="model === option.value"
        class="placement-option__check size-4"
        icon="lucide:circle-check"
      />
    </button>
  </div>
</template>

<style scoped>
.placement-selector {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.placement-option {
  position: relative;
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 10px;
  min-height: 92px;
  padding: 13px;
  text-align: left;
  cursor: pointer;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    transform 160ms ease;
}

.placement-option:hover {
  border-color: hsl(var(--primary) / 55%);
  transform: translateY(-1px);
}

.placement-option:focus-visible {
  outline: 2px solid hsl(var(--primary));
  outline-offset: 2px;
}

.placement-option--active {
  background: linear-gradient(
    145deg,
    hsl(var(--primary) / 11%),
    hsl(var(--card)) 72%
  );
  border-color: hsl(var(--primary));
  box-shadow: 0 8px 22px hsl(var(--primary) / 10%);
}

.placement-option__icon {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
  border-radius: 9px;
}

.placement-option__copy {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.placement-option__copy strong {
  padding-right: 14px;
  font-size: 13px;
  line-height: 1.35;
  color: hsl(var(--foreground));
}

.placement-option__copy small {
  font-size: 11px;
  line-height: 1.55;
  color: hsl(var(--muted-foreground));
}

.placement-option__check {
  position: absolute;
  top: 10px;
  right: 10px;
  color: hsl(var(--primary));
}

@media (max-width: 1000px) {
  .placement-selector {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .placement-selector {
    grid-template-columns: 1fr;
  }

  .placement-option {
    min-height: 76px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .placement-option {
    transition: none;
  }
}
</style>
