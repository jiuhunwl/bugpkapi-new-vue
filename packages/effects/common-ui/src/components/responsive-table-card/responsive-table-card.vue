<script lang="ts" setup>
import type {
  ResponsiveTableCardBreakpoint,
  ResponsiveTableCardProps,
} from './types';

import { computed } from 'vue';

import { useMediaQuery } from '@vueuse/core';

defineOptions({
  name: 'ResponsiveTableCard',
  inheritAttrs: false,
});

const props = withDefaults(defineProps<ResponsiveTableCardProps>(), {
  breakpoint: 'md',
  loading: false,
  empty: false,
  emptyText: '暂无数据',
});

const breakpointQueries: Record<ResponsiveTableCardBreakpoint, string> = {
  // 对应 03 文档断点：md: >=48rem(768px)、lg: >=64rem(1024px)
  md: '(max-width: 767.98px)',
  lg: '(max-width: 1023.98px)',
};

// 移动端渲染卡片列表，桌面/平板渲染 Table（自动根据宽度切换）
const isMobile = useMediaQuery(
  computed(() => breakpointQueries[props.breakpoint] ?? breakpointQueries.md),
);
</script>

<template>
  <div class="responsive-table-card" v-bind="$attrs">
    <!-- 加载中：骨架屏（可插槽自定义） -->
    <div v-if="loading" class="responsive-table-card__loading">
      <slot name="loading">
        <div class="responsive-table-card__skeleton">
          <div
            v-for="n in 4"
            :key="n"
            class="responsive-table-card__skeleton-row"
          />
        </div>
      </slot>
    </div>

    <!-- 空态 -->
    <div v-else-if="empty" class="responsive-table-card__empty">
      <slot name="empty">{{ emptyText }}</slot>
    </div>

    <!-- 桌面/平板：表格（由页面通过 #desktopTable 插槽自定义） -->
    <div
      v-else-if="!isMobile"
      class="responsive-table-card__desktop"
    >
      <slot name="desktopTable"></slot>
    </div>

    <!-- 移动端：卡片列表（由页面通过 #mobileCards 插槽自定义） -->
    <div v-else class="responsive-table-card__mobile">
      <slot name="mobileCards"></slot>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.responsive-table-card {
  width: 100%;

  &__desktop {
    overflow-x: auto;
  }

  &__mobile {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  &__empty {
    @apply text-muted-foreground border-border bg-card;

    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 140px;
    padding: 24px;
    font-size: 14px;
    border-radius: 8px;
    border-style: dashed;
  }

  &__skeleton {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  &__skeleton-row {
    @apply bg-muted animate-pulse rounded;

    height: 48px;
  }
}
</style>
