<script lang="ts" setup>
import type { ResponsiveGridProps } from './types';

import { computed, useSlots } from 'vue';

defineOptions({
  name: 'ResponsiveGrid',
  inheritAttrs: false,
});

const props = withDefaults(defineProps<ResponsiveGridProps>(), {
  columns: 4,
  tabletColumns: 2,
  mobileColumns: 1,
  gap: 16,
  loading: false,
  empty: false,
  skeletonCount: 3,
});

const slots = useSlots();

// 断点列数映射（移动优先：无前缀 → md: 平板 → lg: 桌面），字符串需为静态字面量以便 Tailwind v4 扫描
const columnClasses: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
};

const tabletColumnClasses: Record<number, string> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
};

const desktopColumnClasses: Record<number, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
};

const gridClass = computed(() => {
  const mobile = columnClasses[props.mobileColumns] ?? 'grid-cols-1';
  const tablet = tabletColumnClasses[props.tabletColumns] ?? 'md:grid-cols-2';
  const desktop = desktopColumnClasses[props.columns] ?? 'lg:grid-cols-4';
  return `responsive-grid grid ${mobile} ${tablet} ${desktop}`;
});

const gridStyle = computed(() => ({
  gap: `${props.gap}px`,
}));
</script>

<template>
  <div :class="gridClass" :style="gridStyle" v-bind="$attrs">
    <template v-if="loading">
      <!-- 自定义骨架屏 -->
      <slot v-if="slots.skeleton" name="skeleton"></slot>
      <!-- 默认骨架屏 -->
      <div
        v-for="n in skeletonCount"
        :key="`skeleton-${n}`"
        class="responsive-grid__skeleton"
      >
        <div class="responsive-grid__skeleton-line"></div>
        <div class="responsive-grid__skeleton-line"></div>
        <div class="responsive-grid__skeleton-line"></div>
      </div>
    </template>
    <template v-else-if="empty">
      <slot name="empty">
        <div class="responsive-grid__empty">暂无数据</div>
      </slot>
    </template>
    <slot v-else></slot>
  </div>
</template>

<style lang="scss" scoped>
.responsive-grid {
  width: 100%;
  // 断点列数由 Tailwind 工具类（grid-cols-1 / md:grid-cols-* / lg:grid-cols-*）控制，
  // 间距由 props.gap 内联注入。

  &__skeleton {
    min-height: 120px;
    padding: 16px;
    background: hsl(var(--card));
    border: 1px solid hsl(var(--border));
    border-radius: 8px;
    animation: responsive-grid-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  &__skeleton-line {
    width: 100%;
    height: 12px;
    margin-bottom: 10px;
    background: hsl(var(--muted));
    border-radius: 4px;

    &:first-child {
      width: 66%;
      height: 16px;
    }

    &:last-child {
      width: 80%;
      margin-bottom: 0;
    }
  }

  &__empty {
    display: flex;
    grid-column: 1 / -1;
    align-items: center;
    justify-content: center;
    min-height: 120px;
    padding: 24px;
    font-size: 14px;
    font-weight: 500;
    color: hsl(var(--muted-foreground));
    background: hsl(var(--card));
    border: 1px solid hsl(var(--border));
    border-style: dashed;
    border-radius: 12px;
  }
}

@keyframes responsive-grid-pulse {
  50% {
    opacity: 0.5;
  }
}
</style>
