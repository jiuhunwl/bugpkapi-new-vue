<script setup lang="ts">
import type { StyleValue } from 'vue';

import type { PageProps } from './types';

import { computed, nextTick, onMounted, ref, useTemplateRef } from 'vue';

import { CSS_VARIABLE_LAYOUT_CONTENT_HEIGHT } from '@vben-core/shared/constants';
import { cn } from '@vben-core/shared/utils';

defineOptions({
  name: 'Page',
});

const {
  autoContentHeight = false,
  heightOffset = 0,
  footerFixed = false,
} = defineProps<PageProps>();

const headerHeight = ref(0);
const footerHeight = ref(0);
const shouldAutoHeight = ref(false);

const headerRef = useTemplateRef<HTMLDivElement>('headerRef');
const footerRef = useTemplateRef<HTMLDivElement>('footerRef');

const contentStyle = computed<StyleValue>(() => {
  if (autoContentHeight) {
    return {
      height: `calc(var(${CSS_VARIABLE_LAYOUT_CONTENT_HEIGHT}) - ${headerHeight.value}px - ${footerHeight.value}px - ${typeof heightOffset === 'number' ? `${heightOffset}px` : heightOffset})`,
      overflowY: shouldAutoHeight.value ? 'auto' : 'unset',
    };
  }
  return {};
});

async function calcContentHeight() {
  if (!autoContentHeight) {
    return;
  }
  shouldAutoHeight.value = false;
  await nextTick();
  headerHeight.value = headerRef.value?.offsetHeight || 0;

  footerHeight.value = footerFixed ? 0 : footerRef.value?.offsetHeight || 0;

  setTimeout(() => {
    shouldAutoHeight.value = true;
  }, 30);
}

onMounted(() => {
  calcContentHeight();
});
</script>

<template>
  <div class="vben-page relative flex h-full min-w-0 flex-col">
    <div
      v-if="
        description ||
        $slots.description ||
        title ||
        $slots.title ||
        $slots.extra
      "
      ref="headerRef"
      :class="
        cn(
          'vben-page-header relative flex min-w-0 flex-col items-stretch gap-3 border-b border-border bg-card px-4 py-3 sm:flex-row sm:items-end sm:px-5 sm:py-4 lg:px-6',
          headerClass,
        )
      "
    >
      <div class="min-w-0 flex-auto">
        <slot name="title">
          <div v-if="title" class="mb-2 flex text-lg font-semibold">
            {{ title }}
          </div>
        </slot>

        <slot name="description">
          <p v-if="description" class="text-muted-foreground">
            {{ description }}
          </p>
        </slot>
      </div>

      <div
        v-if="$slots.extra"
        class="vben-page-header-extra min-w-0 shrink-0 self-stretch sm:self-auto"
      >
        <slot name="extra"></slot>
      </div>
    </div>

    <div
      :class="
        cn(
          autoContentHeight ? 'h-full' : 'flex-1',
          'vben-page-content min-w-0 p-3 sm:p-4',
          contentClass,
        )
      "
      :style="contentStyle"
    >
      <slot></slot>
    </div>
    <div
      v-if="$slots.footer"
      ref="footerRef"
      :class="
        cn(
          'vben-page-footer flex flex-col items-stretch gap-2 bg-card px-4 py-3 sm:flex-row sm:items-center sm:px-5 sm:py-4 lg:px-6',
          footerClass,
        )
      "
    >
      <slot name="footer"></slot>
    </div>
  </div>
</template>
