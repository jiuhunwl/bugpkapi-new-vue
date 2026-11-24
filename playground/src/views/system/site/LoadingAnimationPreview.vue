<script lang="ts" setup>
import type {
  GlobalLoadingPreset,
  LoadingAnimationPreset,
} from '#/api/system/site';

import { computed, ref, watch } from 'vue';

import {
  normalizeGlobalLoadingPreset,
  normalizeLoadingAnimationPreset,
} from '#/api/system/site';
import { $t } from '#/locales';

import LoadingPresetAnimation from '#/components/loading/loading-preset-animation.vue';

const props = withDefaults(
  defineProps<{
    enabled?: boolean;
    /** 全局加载动画预设，kind='loading' 时生效 */
    globalPreset?: GlobalLoadingPreset;
    /** splash=启动动画，loading=全局加载动画 */
    kind?: 'loading' | 'splash';
    preset?: LoadingAnimationPreset;
    siteName?: string;
    url?: string;
  }>(),
  {
    enabled: false,
    globalPreset: 'bar',
    kind: 'splash',
    preset: 'forge',
    siteName: 'BugPk-Api',
    url: '',
  },
);

const customImageFailed = ref(false);
const normalizedUrl = computed(() => String(props.url || '').trim());
// 自定义素材只覆盖启动动画；全局加载动画固定使用内置预设
const showCustomImage = computed(
  () =>
    props.kind === 'splash' &&
    props.enabled &&
    !!normalizedUrl.value &&
    !customImageFailed.value,
);
const splashPreset = computed(() =>
  normalizeLoadingAnimationPreset(props.preset),
);
const loadingPreset = computed(() =>
  normalizeGlobalLoadingPreset(props.globalPreset),
);
const presetLabel = computed(() =>
  props.kind === 'splash'
    ? $t(`siteSettings.loading.presets.${splashPreset.value}`)
    : $t(`siteSettings.loading.globalPresets.${loadingPreset.value}`),
);

watch(normalizedUrl, () => {
  customImageFailed.value = false;
});
</script>

<template>
  <div class="loading-preview">
    <img
      v-if="showCustomImage"
      class="loading-preview__image"
      :alt="$t('siteSettings.loading.previewAlt')"
      referrerpolicy="no-referrer"
      :src="normalizedUrl"
      @error="customImageFailed = true"
    />

    <!-- 预设渲染交给共享组件：后台预览与运行时全局加载指示器共用同一份
         结构与类名，保证「预览 = 线上效果」。样式来自全局 loading-presets.css -->
    <LoadingPresetAnimation
      v-else
      :kind="props.kind"
      :loading-preset="loadingPreset"
      :site-name="props.siteName"
      :splash-preset="splashPreset"
    />

    <span class="loading-preview__badge">
      {{
        showCustomImage
          ? $t('siteSettings.loading.customBadge')
          : presetLabel
      }}
    </span>
  </div>
</template>

<style scoped>
/* 预设本体样式来自全局 styles/loading-presets.css，与首屏 splash 同源 */
.loading-preview {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 260px;
  overflow: hidden;
  background: #07111f;
  border: 1px solid rgb(37 99 235 / 22%);
  border-radius: 14px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 5%);
}

.loading-preview__image {
  width: min(100%, 520px);
  max-height: 240px;
  padding: 18px;
  object-fit: contain;
}

/* 预览容器内把 absolute 舞台改为随内容撑高 */
.loading-preview :deep(.bp-sp),
.loading-preview :deep(.bp-ld) {
  position: relative;
  inset: auto;
  width: 100%;
  min-height: 260px;
}

.loading-preview__badge {
  position: absolute;
  right: 12px;
  bottom: 12px;
  padding: 5px 9px;
  font-size: 11px;
  font-weight: 700;
  color: #bae6fd;
  background: rgb(8 47 73 / 78%);
  border: 1px solid rgb(56 189 248 / 22%);
  border-radius: 999px;
}
</style>
