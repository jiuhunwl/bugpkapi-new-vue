<script setup lang="ts">
import type { CheckboxRootEmits, CheckboxRootProps } from 'reka-ui';

import { useId } from 'vue';

import { useForwardPropsEmits } from 'reka-ui';

import { Checkbox } from '../../ui/checkbox';

const props = defineProps<CheckboxRootProps & { indeterminate?: boolean }>();

const emits = defineEmits<CheckboxRootEmits>();

const checked = defineModel<boolean>();

const forwarded = useForwardPropsEmits(props, emits);

const id = useId();
</script>

<template>
  <div class="inline-flex min-w-0 max-w-full shrink-0 items-start gap-2 self-start align-middle">
    <Checkbox
      v-bind="forwarded"
      :id="id"
      v-model="checked"
      class="mt-0.5 h-5 min-h-5 w-5 min-w-5 max-h-5 max-w-5 flex-none appearance-none self-start"
    />
    <label
      :for="id"
      class="min-w-0 cursor-pointer select-none break-words text-sm leading-5"
    >
      <slot></slot>
    </label>
  </div>
</template>
