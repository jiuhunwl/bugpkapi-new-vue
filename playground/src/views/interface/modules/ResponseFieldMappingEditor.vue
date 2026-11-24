<script lang="ts" setup>
import type { InterfaceApi } from '#/api/interface';

import { computed } from 'vue';

import { IconifyIcon, Plus } from '@vben/icons';

import { AutoComplete, Button, Input } from 'ant-design-vue';

import { $t } from '#/locales';

import {
  getResponseFieldPreset,
  isValidResponseJSONPath,
  mergeUnifiedVideoFieldPreset,
  RESPONSE_FIELD_PRESET_DEFINITIONS,
  type ResponseFieldPresetGroup,
  type ResponseFieldPresetType,
} from '../response-field-mapping';

const props = withDefaults(
  defineProps<{
    modelValue?: InterfaceApi.ResponseFieldMapping[];
  }>(),
  { modelValue: () => [] },
);

const emit = defineEmits<{
  'update:modelValue': [value: InterfaceApi.ResponseFieldMapping[]];
}>();

const groupOrder: ResponseFieldPresetGroup[] = [
  'envelope',
  'data',
  'author',
  'livePhoto',
  'music',
  'videoBackup',
];

const rows = computed(() => props.modelValue || []);
const presetOptions = computed(() =>
  groupOrder.map((group) => ({
    label: $t(`polling.fieldMappings.groups.${group}`),
    options: RESPONSE_FIELD_PRESET_DEFINITIONS.filter(
      (definition) => definition.group === group,
    ).map((definition) => ({
      label: `${definition.value} · ${presetTypeLabel(definition.type)}`,
      value: definition.value,
    })),
  })),
);
const canApplyUnifiedPreset = computed(() => {
  if (rows.value.length >= 50) return false;
  const targets = new Set(rows.value.map((mapping) => mapping.target.trim()));
  return RESPONSE_FIELD_PRESET_DEFINITIONS.some(
    (definition) => !targets.has(definition.value),
  );
});

function presetTypeLabel(type: ResponseFieldPresetType) {
  return $t(`polling.fieldMappings.types.${type}`);
}

function addMapping() {
  if (rows.value.length >= 50) return;
  emit('update:modelValue', [...rows.value, { source: '', target: '' }]);
}

function applyUnifiedPreset() {
  emit(
    'update:modelValue',
    mergeUnifiedVideoFieldPreset(rows.value),
  );
}

function removeMapping(index: number) {
  emit(
    'update:modelValue',
    rows.value.filter((_, rowIndex) => rowIndex !== index),
  );
}

function updateMapping(
  index: number,
  field: keyof InterfaceApi.ResponseFieldMapping,
  value: string,
) {
  emit(
    'update:modelValue',
    rows.value.map((mapping, rowIndex) =>
      rowIndex === index ? { ...mapping, [field]: value } : mapping,
    ),
  );
}

function updateTarget(index: number, value: unknown) {
  updateMapping(index, 'target', typeof value === 'string' ? value : '');
}

function pathStatus(value: string) {
  return value.trim() && !isValidResponseJSONPath(value) ? 'error' : undefined;
}

function selectedPresetText(target: string) {
  const preset = getResponseFieldPreset(target.trim());
  return preset
    ? `${preset.value} · ${presetTypeLabel(preset.type)}`
    : '';
}
</script>

<template>
  <details class="mapping-editor" :open="rows.length > 0">
    <summary>
      <span>{{ $t('polling.fieldMappings.title') }}</span>
      <span class="mapping-count">{{ rows.length }}</span>
    </summary>
    <div class="mapping-content">
      <p>{{ $t('polling.fieldMappings.description') }}</p>
      <div class="mapping-toolbar">
        <code>$.payload.author.nickname → data.author.name</code>
        <code>payload.items[].play_url → data.video_backup[].url</code>
        <Button
          :disabled="!canApplyUnifiedPreset"
          size="small"
          @click="applyUnifiedPreset"
        >
          <IconifyIcon class="size-4" icon="lucide:list-plus" />
          {{ $t('polling.fieldMappings.applyUnifiedPreset') }}
        </Button>
      </div>
      <div v-if="rows.length" class="mapping-list">
        <div class="mapping-column-labels" aria-hidden="true">
          <span>{{ $t('polling.fieldMappings.sourceLabel') }}</span>
          <span />
          <span>{{ $t('polling.fieldMappings.targetLabel') }}</span>
          <span />
        </div>
        <div
          v-for="(mapping, index) in rows"
          :key="index"
          class="mapping-row"
        >
          <Input
            allow-clear
            :aria-label="$t('polling.fieldMappings.sourceLabel')"
            :placeholder="$t('polling.fieldMappings.sourcePlaceholder')"
            :status="pathStatus(mapping.source)"
            :value="mapping.source"
            @update:value="updateMapping(index, 'source', $event)"
          />
          <IconifyIcon class="mapping-arrow" icon="lucide:arrow-right" />
          <AutoComplete
            allow-clear
            :aria-label="$t('polling.fieldMappings.targetLabel')"
            :options="presetOptions"
            :placeholder="$t('polling.fieldMappings.targetPlaceholder')"
            :status="pathStatus(mapping.target)"
            :value="mapping.target"
            @update:value="updateTarget(index, $event)"
          />
          <Button
            danger
            type="text"
            :aria-label="$t('polling.fieldMappings.remove', [index + 1])"
            @click="removeMapping(index)"
          >
            <IconifyIcon class="size-4" icon="lucide:trash-2" />
          </Button>
          <div
            v-if="selectedPresetText(mapping.target)"
            class="mapping-preset-meta"
          >
            {{ selectedPresetText(mapping.target) }}
          </div>
        </div>
      </div>
      <Button :disabled="rows.length >= 50" size="small" @click="addMapping">
        <Plus class="size-4" />
        {{ $t('polling.fieldMappings.add') }}
      </Button>
    </div>
  </details>
</template>

<style scoped>
.mapping-editor {
  overflow: hidden;
  background: hsl(var(--muted) / 35%);
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.mapping-editor summary {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 9px 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
}

.mapping-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--background));
  border-radius: 999px;
}

.mapping-content {
  display: grid;
  gap: 10px;
  padding: 0 12px 12px;
}

.mapping-content p {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: hsl(var(--muted-foreground));
}

.mapping-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.mapping-toolbar code {
  padding: 3px 7px;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 4px;
}

.mapping-toolbar button {
  margin-left: auto;
}

.mapping-list {
  display: grid;
  gap: 8px;
}

.mapping-column-labels,
.mapping-row {
  display: grid;
  grid-template-columns: minmax(150px, 1fr) 18px minmax(180px, 1fr) 32px;
  gap: 8px;
  align-items: center;
}

.mapping-column-labels {
  padding: 0 2px;
  font-size: 11px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
}

.mapping-arrow {
  color: hsl(var(--muted-foreground));
}

.mapping-preset-meta {
  grid-column: 3 / 4;
  margin-top: -4px;
  overflow: hidden;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 640px) {
  .mapping-toolbar {
    align-items: stretch;
  }

  .mapping-toolbar code,
  .mapping-toolbar button {
    width: 100%;
    margin-left: 0;
  }

  .mapping-column-labels {
    display: none;
  }

  .mapping-row {
    grid-template-columns: minmax(0, 1fr) 18px minmax(0, 1fr) 32px;
  }
}
</style>
