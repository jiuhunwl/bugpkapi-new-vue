<script lang="ts" setup>
import { computed } from 'vue';

import { useAntdDesignTokens } from '@vben/hooks';
import { preferences, usePreferences } from '@vben/preferences';

import { App, ConfigProvider, theme } from 'ant-design-vue';

import GlobalRouteLoading from '#/components/loading/global-route-loading.vue';
import { antdLocale, useI18n } from '#/locales';

defineOptions({ name: 'App' });

// 语言切换后重新挂载路由视图：表格列、表单 schema 等配置在 setup 阶段
// 通过 $t 求值后即固化，只有重建组件才能拿到新语言，避免必须刷新页面。
const { locale } = useI18n();

const { isDark } = usePreferences();
const { tokens } = useAntdDesignTokens();

const tokenTheme = computed(() => {
  const algorithm = isDark.value
    ? [theme.darkAlgorithm]
    : [theme.defaultAlgorithm];

  // antd 紧凑模式算法
  if (preferences.app.compact) {
    algorithm.push(theme.compactAlgorithm);
  }

  return {
    algorithm,
    token: tokens,
  };
});
</script>

<template>
  <ConfigProvider :locale="antdLocale" :theme="tokenTheme">
    <App>
      <RouterView :key="locale" />
      <!-- 全局路由加载指示器：预设由后台「站点配置 → 全局加载动画」决定 -->
      <GlobalRouteLoading />
    </App>
  </ConfigProvider>
</template>
