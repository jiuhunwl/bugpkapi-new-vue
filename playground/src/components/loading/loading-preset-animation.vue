<script lang="ts" setup>
import type {
  GlobalLoadingPreset,
  LoadingAnimationPreset,
} from '#/api/system/site';

import { computed } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  normalizeGlobalLoadingPreset,
  normalizeLoadingAnimationPreset,
} from '#/api/system/site';

import { $t } from '#/locales';

/**
 * 启动 / 全局加载动画的纯渲染器。
 *
 * 预设本体样式来自全局 styles/loading-presets.css。后台「站点配置」的
 * 实时预览和运行时的全局路由加载指示器共用本组件——两边看到的
 * 结构与类名完全一致，保证「后台预览 = 线上效果」。
 *
 * 每个预设的标记（圆角块）使用与该预设语义对应的图标，而不是
 * 统一的字母块：锻造=锤、扫描=扫描线、进度轨=服务器、品牌=网关节点。
 */
const props = withDefaults(
  defineProps<{
    kind?: 'loading' | 'splash';
    loadingPreset?: GlobalLoadingPreset;
    siteName?: string;
    splashPreset?: LoadingAnimationPreset;
  }>(),
  {
    kind: 'loading',
    loadingPreset: 'bar',
    siteName: '',
    splashPreset: 'forge',
  },
);

const splash = computed(() =>
  normalizeLoadingAnimationPreset(props.splashPreset),
);
const loading = computed(() => normalizeGlobalLoadingPreset(props.loadingPreset));
</script>

<template>
  <!-- 启动动画（splash） -->
  <div v-if="props.kind === 'splash'" class="bp-sp" aria-hidden="true">
    <div class="bp-sp__mesh"></div>

    <div v-if="splash === 'forge'" class="bp-sp__mark">
      <IconifyIcon icon="lucide:hammer" />
    </div>

    <div v-else-if="splash === 'gateway'" class="bp-sp__gw">
      <span class="bp-sp__pk"></span>
      <span class="bp-sp__pk"></span>
      <span class="bp-sp__pk"></span>
      <div class="bp-sp__core"><i></i>API</div>
    </div>

    <div v-else-if="splash === 'orbit'" class="bp-sp__orbit">
      <span>API</span><i></i><i></i><i></i>
    </div>

    <div v-else-if="splash === 'scan'" class="bp-sp__scan">
      <IconifyIcon icon="lucide:scan-line" />
    </div>

    <div v-else-if="splash === 'rail'" class="bp-sp__rail">
      <div class="bp-sp__mini"><IconifyIcon icon="lucide:server" /></div>
      <div class="bp-sp__track"><i></i></div>
      <div class="bp-sp__pct">
        {{ $t('siteSettings.loading.defaultStatus') }}
      </div>
    </div>

    <div v-else class="bp-sp__dots"><i></i><i></i><i></i></div>

    <div v-if="splash !== 'rail'" class="bp-sp__brand">
      <b>{{ props.siteName || 'BugPk-Api' }}</b>
      <small>{{ $t('siteSettings.loading.defaultStatus') }}</small>
    </div>
  </div>

  <!-- 全局加载动画 -->
  <div v-else class="bp-ld" aria-hidden="true">
    <template v-if="loading === 'bar'">
      <div class="bp-ld__bar"><i></i></div>
      <div class="bp-ld__pv"><span></span><span></span><span></span></div>
    </template>

    <div v-else-if="loading === 'ring'" class="bp-ld__ring"></div>

    <div v-else-if="loading === 'skeleton'" class="bp-ld__sk">
      <div class="bp-ld__row">
        <span class="bp-ld__av"></span><span class="bp-ld__ln"></span>
      </div>
      <div class="bp-ld__row">
        <span class="bp-ld__ln"></span>
        <span class="bp-ld__ln bp-ld__ln--short"></span>
      </div>
      <div class="bp-ld__row">
        <span class="bp-ld__av"></span><span class="bp-ld__ln"></span>
      </div>
    </div>

    <div v-else-if="loading === 'packet'" class="bp-ld__pf">
      <i></i><i></i><i></i>
    </div>

    <div v-else-if="loading === 'logo'" class="bp-ld__logo">
      <IconifyIcon icon="lucide:waypoints" />
    </div>

    <div v-else class="bp-ld__dots"><i></i><i></i><i></i></div>

    <div class="bp-ld__cap">
      {{ $t(`siteSettings.loading.globalPresets.${loading}`) }}
    </div>
  </div>
</template>
