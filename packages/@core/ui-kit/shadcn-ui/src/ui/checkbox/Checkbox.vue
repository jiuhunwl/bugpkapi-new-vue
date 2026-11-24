<script setup lang="ts">
import type { CheckboxRootEmits, CheckboxRootProps } from 'reka-ui';

import type { HTMLAttributes } from 'vue';

import { cn } from '@vben-core/shared/utils';

import { Check, Minus } from '@lucide/vue';
import { reactiveOmit } from '@vueuse/core';
import { CheckboxIndicator, CheckboxRoot, useForwardPropsEmits } from 'reka-ui';

const props = defineProps<
  CheckboxRootProps & {
    class?: HTMLAttributes['class'];
    indeterminate?: boolean;
  }
>();
const emits = defineEmits<CheckboxRootEmits>();

const delegatedProps = reactiveOmit(props, 'class', 'indeterminate');

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <CheckboxRoot
    v-slot="slotProps"
    data-slot="checkbox"
    v-bind="forwarded"
    :class="
      cn(
        'peer border-input data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive h-5 min-h-5 w-5 min-w-5 max-h-5 max-w-5 aspect-square flex-none appearance-none self-start rounded-[5px] border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
        indeterminate && 'bg-primary text-primary-foreground border-primary',
        props.class,
      )
    "
  >
    <CheckboxIndicator
      data-slot="checkbox-indicator"
      class="grid place-content-center text-current transition-none"
      :force-mount="indeterminate ? true : undefined"
    >
      <slot v-bind="slotProps">
        <Minus v-if="indeterminate" class="h-4 w-4 flex-none" />
        <Check v-else class="h-4 w-4 flex-none" />
      </slot>
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
