<script setup lang="ts">
import type { CSSProperties } from 'vue';

import { computed } from 'vue';

interface Props {
  /**
   * @zh_CN 是否收起文本
   */
  collapsed?: boolean;
  /**
   * @zh_CN Logo 图片适应方式
   */
  fit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  /**
   * @zh_CN Logo 跳转地址
   */
  href?: string;
  /**
   * @zh_CN Logo 图片大小
   */
  logoSize?: number;
  /**
   * @zh_CN Logo 图标
   */
  src?: string;
  /**
   * @zh_CN 暗色主题 Logo 图标 (可选，若不设置则使用 src)
   */
  srcDark?: string;
  /**
   * @zh_CN Logo 文本
   */
  text: string;
  /**
   * @zh_CN Logo 主题
   */
  theme?: string;
}

defineOptions({
  name: 'VbenLogo',
});

const props = withDefaults(defineProps<Props>(), {
  collapsed: false,
  href: 'javascript:void 0',
  logoSize: 32,
  src: '',
  srcDark: '',
  theme: 'light',
  fit: 'cover',
});

// 品牌兜底统一走 bugpk-icon；旧的 BP 渐变字母块（bp-mark.svg）已彻底删除。
const FALLBACK_LOGO = '/brand-options/bugpk-icon.png';

/**
 * @zh_CN 根据主题选择合适的 logo 图标
 */
const logoSrc = computed(() => {
  // 如果是暗色主题且提供了 srcDark，则使用暗色主题的 logo
  if (props.theme === 'dark' && props.srcDark) {
    return props.srcDark;
  }
  // 否则使用默认的 src
  return props.src || FALLBACK_LOGO;
});

function handleLogoError(event: Event) {
  const image = event.currentTarget;
  if (!(image instanceof HTMLImageElement)) return;
  if (image.getAttribute('src') === FALLBACK_LOGO) return;
  image.src = FALLBACK_LOGO;
}

const logoStyle = computed<CSSProperties>(() => ({
  height: `${props.logoSize}px`,
  objectFit: props.fit,
  width: `${props.logoSize}px`,
}));
</script>

<template>
  <div :class="theme" class="flex h-full items-center text-lg">
    <a
      :class="$attrs.class"
      :href="href"
      class="flex h-full items-center gap-2 overflow-hidden px-3 text-lg leading-normal transition-all duration-500"
    >
      <img
        v-if="logoSrc"
        :key="logoSrc"
        :alt="text"
        class="relative shrink-0 bg-transparent"
        decoding="async"
        draggable="false"
        fetchpriority="high"
        :src="logoSrc"
        :style="logoStyle"
        @error="handleLogoError"
      />
      <template v-if="!collapsed">
        <slot name="text">
          <span class="text-foreground truncate font-semibold text-nowrap">
            {{ text }}
          </span>
        </slot>
      </template>
    </a>
  </div>
</template>
