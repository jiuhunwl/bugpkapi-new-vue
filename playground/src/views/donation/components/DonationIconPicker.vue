<script setup lang="ts">
import type { DonationIconPreset } from '../model';

import { IconifyIcon, SvgWeChatIcon } from '@vben/icons';

import { $t } from '#/locales';

import { donationIconPresets } from '../model';

const props = withDefaults(
  defineProps<{
    disabled?: boolean;
    icon: string;
  }>(),
  {
    disabled: false,
  },
);

const emit = defineEmits<{
  select: [preset: DonationIconPreset];
}>();

function selectPreset(preset: DonationIconPreset) {
  if (props.disabled) return;
  emit('select', preset);
}

function isWeChatIcon(icon: string) {
  return icon === 'simple-icons:wechat' || icon === 'svg:wechat';
}
</script>

<template>
  <div class="icon-picker">
    <div class="icon-picker__intro">
      <span>{{ $t('donationSettings.iconPicker.title') }}</span>
      <small>{{ $t('donationSettings.iconPicker.description') }}</small>
    </div>
    <div class="icon-picker__grid">
      <button
        v-for="preset in donationIconPresets"
        :key="preset.key"
        class="icon-option"
        :class="{ 'is-selected': icon === preset.icon }"
        :disabled="disabled"
        type="button"
        @click="selectPreset(preset)"
      >
        <span
          class="icon-option__mark"
          :style="{
            backgroundColor: `${preset.color}18`,
            color: preset.color,
          }"
        >
          <SvgWeChatIcon v-if="isWeChatIcon(preset.icon)" />
          <IconifyIcon v-else :icon="preset.icon" />
        </span>
        <span class="icon-option__label">{{ $t(preset.labelKey) }}</span>
        <IconifyIcon
          v-if="icon === preset.icon"
          class="icon-option__check"
          icon="lucide:check"
        />
      </button>
    </div>
  </div>
</template>

<style scoped>
.icon-picker {
  display: grid;
  gap: 9px;
}

.icon-picker__intro {
  display: flex;
  gap: 8px;
  align-items: baseline;
  justify-content: space-between;
}

.icon-picker__intro span {
  font-size: 12px;
  font-weight: 700;
  color: hsl(var(--foreground));
}

.icon-picker__intro small {
  font-size: 11px;
  color: hsl(var(--muted-foreground));
}

.icon-picker__grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(86px, 1fr));
  gap: 8px;
}

.icon-option {
  position: relative;
  display: grid;
  gap: 7px;
  place-items: center;
  min-width: 0;
  min-height: 86px;
  padding: 10px 8px;
  color: hsl(var(--foreground));
  cursor: pointer;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    transform 160ms ease;
}

.icon-option:hover:not(:disabled) {
  border-color: hsl(var(--primary) / 55%);
  box-shadow: 0 7px 20px rgb(15 23 42 / 8%);
  transform: translateY(-1px);
}

.icon-option:focus-visible {
  outline: 2px solid hsl(var(--primary));
  outline-offset: 2px;
}

.icon-option.is-selected {
  background: hsl(var(--primary) / 5%);
  border-color: hsl(var(--primary));
  box-shadow: 0 0 0 2px hsl(var(--primary) / 10%);
}

.icon-option:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.icon-option__mark {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  font-size: 20px;
  border-radius: 9px;
}

.icon-option__label {
  max-width: 100%;
  overflow: hidden;
  font-size: 12px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.icon-option__check {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 14px;
  height: 14px;
  padding: 2px;
  color: hsl(var(--primary-foreground));
  background: hsl(var(--primary));
  border-radius: 999px;
}

@media (prefers-reduced-motion: reduce) {
  .icon-option {
    transition: none;
  }
}

@media (max-width: 980px) {
  .icon-picker__grid {
    grid-template-columns: repeat(3, minmax(86px, 1fr));
  }
}

@media (max-width: 520px) {
  .icon-picker__intro {
    align-items: flex-start;
    flex-direction: column;
  }

  .icon-picker__grid {
    grid-template-columns: repeat(2, minmax(86px, 1fr));
  }
}
</style>
