<script lang="ts" setup>
import { computed } from 'vue';

import { Checkbox, Select } from 'ant-design-vue';

import { $t } from '#/locales';

interface Props {
  activeScene: string;
  disabled?: boolean;
  enabledScenes: string[];
  scenes: string[];
}

interface Emits {
  'update:activeScene': [value: string];
  'update:enabledScenes': [value: string[]];
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const sceneOptions = computed(() =>
  props.scenes.map((value) => ({
    description:
      value === 'default'
        ? $t('captchaConfig.defaultSceneDescription')
        : $t('captchaConfig.sceneDescriptionTemplate', [value]),
    label: $t(`captchaConfig.sceneLabels.${value}`),
    value,
  })),
);

const selectOptions = computed(() =>
  sceneOptions.value.map(({ label, value }) => ({
    label: `${label} (${value})`,
    value,
  })),
);

function onEnabledChange(values: unknown) {
  const next = Array.isArray(values)
    ? values.map((value) => String(value))
    : [];
  emit('update:enabledScenes', next);
}

function onActiveSceneChange(value: unknown) {
  emit('update:activeScene', String(value ?? 'default'));
}
</script>

<template>
  <section class="space-y-4" aria-labelledby="captcha-scene-heading">
    <div>
      <h3 id="captcha-scene-heading" class="text-sm font-semibold text-gray-700">
        {{ $t('captchaConfig.sceneHeading') }}
      </h3>
      <p class="mt-1 text-xs leading-5 text-gray-500">
        {{ $t('captchaConfig.sceneDescription') }}
      </p>
    </div>

    <Checkbox.Group
      class="grid w-full grid-cols-1 gap-2 sm:grid-cols-2"
      :disabled="disabled"
      :value="enabledScenes"
      @change="onEnabledChange"
    >
      <Checkbox
        v-for="item in sceneOptions"
        :key="item.value"
        :value="item.value"
        class="min-h-14 rounded-md border border-gray-200 px-3 py-2 transition-colors hover:border-primary"
      >
        <span class="inline-flex min-w-0 flex-col align-top">
          <span class="block text-sm font-medium text-gray-700">
            {{ item.label }}
          </span>
          <span class="block break-all text-xs leading-5 text-gray-500">
            {{ item.description }}
          </span>
        </span>
      </Checkbox>
    </Checkbox.Group>

    <div class="flex flex-col gap-2">
      <span class="text-sm font-medium text-gray-600">
        {{ $t('captchaConfig.editScene') }}
      </span>
      <Select
        class="w-full"
        :options="selectOptions"
        :value="activeScene"
        @change="onActiveSceneChange"
      />
    </div>
  </section>
</template>

<style scoped>
:deep(.ant-checkbox-wrapper) {
  align-items: flex-start;
  margin-inline-start: 0;
}

:deep(.ant-checkbox) {
  flex: 0 0 18px;
  width: 18px;
  min-width: 18px;
  max-width: 18px;
  height: 18px;
  min-height: 18px;
  max-height: 18px;
  margin-top: 2px;
}

:deep(.ant-checkbox-inner) {
  width: 18px;
  height: 18px;
  border-radius: 5px;
}

:deep(.ant-checkbox + span) {
  min-width: 0;
  padding-inline-start: 10px;
}
</style>
