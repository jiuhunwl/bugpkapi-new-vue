<script setup lang="ts">
import type {
  AdvertisementParameterDraft,
  AdvertisementParameterType,
} from '../form-model';

import { computed } from 'vue';

import { IconifyIcon, Plus } from '@vben/icons';

import { Alert, Button, Input, InputNumber, Select, Tag } from 'ant-design-vue';

import { $t } from '#/locales';

import {
  createAdvertisementParameter,
  defaultParameterValue,
} from '../form-model';

interface Props {
  preservedKeys?: string[];
}

const props = withDefaults(defineProps<Props>(), {
  preservedKeys: () => [],
});
const model = defineModel<AdvertisementParameterDraft[]>({ required: true });

const typeOptions = computed(() => [
  {
    label: $t('advertisementAdmin.parameters.types.string'),
    value: 'STRING',
  },
  {
    label: $t('advertisementAdmin.parameters.types.number'),
    value: 'NUMBER',
  },
  {
    label: $t('advertisementAdmin.parameters.types.boolean'),
    value: 'BOOLEAN',
  },
]);
const booleanOptions = computed(() => [
  { label: $t('advertisementAdmin.parameters.booleanTrue'), value: 'true' },
  { label: $t('advertisementAdmin.parameters.booleanFalse'), value: 'false' },
]);

function addParameter() {
  if (model.value.length >= 30) return;
  model.value = [...model.value, createAdvertisementParameter()];
}

function removeParameter(index: number) {
  model.value = model.value.filter((_, itemIndex) => itemIndex !== index);
}

function updateParameter(
  index: number,
  patch: Partial<AdvertisementParameterDraft>,
) {
  model.value = model.value.map((item, itemIndex) =>
    itemIndex === index ? { ...item, ...patch } : item,
  );
}

function updateType(index: number, type: AdvertisementParameterType) {
  updateParameter(index, {
    type,
    value: defaultParameterValue(type),
  });
}

function updateTypeFromSelect(index: number, value: unknown) {
  if (value === 'BOOLEAN' || value === 'NUMBER' || value === 'STRING') {
    updateType(index, value);
  }
}

function updateBoolean(index: number, value: unknown) {
  updateParameter(index, { value: value === 'true' });
}
</script>

<template>
  <div class="parameter-editor">
    <div class="parameter-editor__header">
      <div>
        <h4>{{ $t('advertisementAdmin.parameters.title') }}</h4>
        <p>{{ $t('advertisementAdmin.parameters.description') }}</p>
      </div>
      <Button
        :disabled="model.length >= 30"
        size="small"
        type="primary"
        @click="addParameter"
      >
        <Plus class="size-4" />
        {{ $t('advertisementAdmin.parameters.add') }}
      </Button>
    </div>

    <Alert
      v-if="props.preservedKeys.length > 0"
      :message="$t('advertisementAdmin.parameters.preservedTitle')"
      show-icon
      type="info"
    >
      <template #description>
        <div class="parameter-preserved">
          <span>{{ $t('advertisementAdmin.parameters.preservedHelp') }}</span>
          <div class="parameter-preserved__keys">
            <Tag v-for="key in props.preservedKeys" :key="key">{{ key }}</Tag>
          </div>
        </div>
      </template>
    </Alert>

    <div v-if="model.length > 0" class="parameter-list">
      <article
        v-for="(parameter, index) in model"
        :key="parameter.clientId"
        class="parameter-row"
      >
        <span class="parameter-row__index">{{ index + 1 }}</span>
        <label class="parameter-field">
          <span>{{ $t('advertisementAdmin.parameters.name') }}</span>
          <Input
            :maxlength="128"
            :placeholder="$t('advertisementAdmin.parameters.namePlaceholder')"
            :value="parameter.key"
            @update:value="updateParameter(index, { key: String($event) })"
          />
        </label>
        <label class="parameter-field">
          <span>{{ $t('advertisementAdmin.parameters.type') }}</span>
          <Select
            class="w-full"
            :options="typeOptions"
            :value="parameter.type"
            @update:value="updateTypeFromSelect(index, $event)"
          />
        </label>
        <label class="parameter-field">
          <span>{{ $t('advertisementAdmin.parameters.value') }}</span>
          <InputNumber
            v-if="parameter.type === 'NUMBER'"
            class="w-full"
            :value="Number(parameter.value)"
            @update:value="
              updateParameter(index, { value: Number($event ?? 0) })
            "
          />
          <Select
            v-else-if="parameter.type === 'BOOLEAN'"
            class="w-full"
            :options="booleanOptions"
            :value="String(Boolean(parameter.value))"
            @update:value="updateBoolean(index, $event)"
          />
          <Input
            v-else
            :placeholder="$t('advertisementAdmin.parameters.valuePlaceholder')"
            :value="String(parameter.value ?? '')"
            @update:value="updateParameter(index, { value: String($event) })"
          />
        </label>
        <Button
          :aria-label="$t('advertisementAdmin.parameters.remove', [index + 1])"
          class="parameter-row__remove"
          danger
          type="text"
          @click="removeParameter(index)"
        >
          <IconifyIcon class="size-4" icon="lucide:trash-2" />
        </Button>
      </article>
    </div>

    <button v-else class="parameter-empty" type="button" @click="addParameter">
      <span class="parameter-empty__icon">
        <IconifyIcon class="size-5" icon="lucide:list-plus" />
      </span>
      <strong>{{ $t('advertisementAdmin.parameters.empty') }}</strong>
      <small>{{ $t('advertisementAdmin.parameters.emptyHelp') }}</small>
    </button>
  </div>
</template>

<style scoped>
.parameter-editor {
  display: grid;
  gap: 14px;
}

.parameter-editor__header {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
}

.parameter-editor__header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: hsl(var(--foreground));
}

.parameter-editor__header p {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.65;
  color: hsl(var(--muted-foreground));
}

.parameter-preserved {
  display: grid;
  gap: 8px;
}

.parameter-preserved__keys {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.parameter-list {
  display: grid;
  gap: 10px;
}

.parameter-row {
  display: grid;
  grid-template-columns: 28px minmax(150px, 1fr) 132px minmax(160px, 1.2fr) 34px;
  gap: 10px;
  align-items: end;
  padding: 12px;
  background: hsl(var(--muted) / 28%);
  border: 1px solid hsl(var(--border));
  border-radius: 9px;
}

.parameter-row__index {
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  margin-bottom: 4px;
  font-size: 11px;
  font-weight: 700;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
  border-radius: 999px;
}

.parameter-field {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.parameter-field > span {
  font-size: 12px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.parameter-row__remove {
  margin-bottom: 1px;
}

.parameter-empty {
  display: grid;
  justify-items: center;
  padding: 24px;
  text-align: center;
  cursor: pointer;
  background: hsl(var(--muted) / 18%);
  border: 1px dashed hsl(var(--border));
  border-radius: 10px;
}

.parameter-empty:hover,
.parameter-empty:focus-visible {
  border-color: hsl(var(--primary));
}

.parameter-empty:focus-visible {
  outline: 2px solid hsl(var(--primary));
  outline-offset: 2px;
}

.parameter-empty__icon {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  margin-bottom: 9px;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
  border-radius: 10px;
}

.parameter-empty strong {
  font-size: 13px;
  color: hsl(var(--foreground));
}

.parameter-empty small {
  max-width: 460px;
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.6;
  color: hsl(var(--muted-foreground));
}

@media (max-width: 820px) {
  .parameter-row {
    grid-template-columns: 28px minmax(0, 1fr) 34px;
  }

  .parameter-field {
    grid-column: 2;
  }

  .parameter-row__index {
    grid-row: 1;
    grid-column: 1;
  }

  .parameter-row__remove {
    grid-row: 1;
    grid-column: 3;
  }
}

@media (max-width: 560px) {
  .parameter-editor__header {
    flex-direction: column;
  }
}
</style>
