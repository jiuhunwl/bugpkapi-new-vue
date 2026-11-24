<script setup lang="ts">
import type { RequestValidationPresetKey } from '../request-validation';

import { Button, Input, Select, Tag } from 'ant-design-vue';

import { $t } from '#/locales';

interface PresetOption {
  label: string;
  value: RequestValidationPresetKey;
}

defineProps<{
  domainPreview?: string;
  options: PresetOption[];
}>();

const emit = defineEmits<{ apply: [] }>();
const presetKey = defineModel<RequestValidationPresetKey>('presetKey', {
  required: true,
});
const fieldName = defineModel<string>('fieldName', { required: true });
</script>

<template>
  <section class="preset-panel">
    <header class="preset-panel__header">
      <div>
        <h3 class="preset-panel__title">
          {{ $t('requestValidation.preset.title') }}
        </h3>
        <p class="preset-panel__description">
          {{ $t('requestValidation.preset.description') }}
        </p>
      </div>
      <Tag color="blue">{{ $t('requestValidation.preset.badge') }}</Tag>
    </header>

    <div class="preset-panel__form">
      <label class="preset-field">
        <span>{{ $t('requestValidation.preset.parameter') }}</span>
        <Input
          v-model:value="fieldName"
          :maxlength="128"
          :placeholder="$t('requestValidation.preset.parameterPlaceholder')"
        />
      </label>
      <label class="preset-field">
        <span>{{ $t('requestValidation.preset.platform') }}</span>
        <Select
          v-model:value="presetKey"
          class="w-full"
          :options="options"
        />
      </label>
      <Button type="primary" @click="emit('apply')">
        {{ $t('requestValidation.preset.apply') }}
      </Button>
    </div>

    <div v-if="domainPreview" class="preset-panel__domains">
      <span>{{ $t('requestValidation.preset.domains') }}</span>
      <code>{{ domainPreview }}</code>
    </div>
  </section>
</template>

<style scoped>
.preset-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  background: hsl(var(--muted) / 28%);
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
}

.preset-panel__header {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
}

.preset-panel__title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: hsl(var(--foreground));
}

.preset-panel__description {
  margin: 5px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: hsl(var(--muted-foreground));
}

.preset-panel__form {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(220px, 1.2fr) auto;
  gap: 12px;
  align-items: end;
}

.preset-field {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.preset-panel__domains {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.preset-panel__domains code {
  padding: 3px 7px;
  overflow: hidden;
  text-overflow: ellipsis;
  color: hsl(var(--foreground));
  white-space: nowrap;
  background: hsl(var(--background));
  border-radius: 5px;
}

@media (max-width: 768px) {
  .preset-panel__form {
    grid-template-columns: 1fr;
  }
}
</style>
