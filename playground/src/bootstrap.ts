import { createApp, watchEffect } from 'vue';

import { registerAccessDirective } from '@vben/access';
import { registerLoadingDirective } from '@vben/common-ui';
import { providePluginsOptions } from '@vben/plugins';
import { preferences } from '@vben/preferences';
import { initStores } from '@vben/stores';
import '@vben/styles';
import '@vben/styles/antd';
import '@vben/styles/global';

import { useTitle } from '@vueuse/core';

import { $t, setupI18n } from '#/locales';
import { router } from '#/router';

import { initComponentAdapter } from './adapter/component';
import { initSetupVbenForm, useVbenForm } from './adapter/form';
import App from './app.vue';
import { setupProactiveAuthRefresh } from './composables/use-proactive-auth-refresh';
import { refreshSettlementCurrency } from './composables/use-settlement-currency';
import { initPublicCustomCode, initSiteBrand } from './site-brand';

import './styles/loading-presets.css';
import './styles/responsive.css';
import './styles/ticket-chips.css';

/**
 * 让 html / body / #app 的背景跟随当前主题变量，
 * 覆盖 index.html 首屏 prepaint 按系统偏好写下的内联背景色。
 */
function syncRootBackground() {
  const background = 'hsl(var(--background-deep))';
  const root = document.documentElement;
  root.style.setProperty('--public-prepaint-background', background);
  root.style.backgroundColor = background;
  document.body.style.backgroundColor = background;
  document
    .getElementById('app')
    ?.style.setProperty('background-color', background);
}

async function bootstrap(namespace: string) {
  // 首屏 prepaint（index.html 内联脚本）只按系统偏好设置 html/body/#app 背景色，
  // 手动切换主题或缓存偏好与系统不一致时，页面底色会和组件深浅相反。
  // 这里改为引用主题变量，后续切换主题会自动跟随。
  syncRootBackground();

  // 初始化组件适配器
  await initComponentAdapter();

  // 初始化表单组件
  await initSetupVbenForm();

  // 注入插件全局配置
  providePluginsOptions({
    form: { useVbenForm },
  });

  // 设置弹窗的默认配置
  // setDefaultModalProps({
  //   fullscreenButton: false,
  // });
  // 设置抽屉的默认配置
  // setDefaultDrawerProps({
  //   zIndex: 1020,
  // });

  const app = createApp(App);

  // 注册v-loading指令
  registerLoadingDirective(app, {
    loading: 'loading', // 在这里可以自定义指令名称，也可以明确提供false表示不注册这个指令
    spinning: 'spinning',
  });

  // 国际化 i18n 配置
  await setupI18n(app);

  // 配置 pinia-tore
  await initStores(app, { namespace });

  // 站点货币是全局展示口径：应用启动即拉取，避免后台/公开页首屏先按 CNY 渲染。
  void refreshSettlementCurrency();

  // access token 到期前主动续期（含多标签页协调），避免被动 401 放大失效概率。
  setupProactiveAuthRefresh();

  // 初始化时区HANDLER

  // 安装权限指令
  registerAccessDirective(app);

  // 初始化 tippy
  const { initTippy } = await import('@vben/common-ui/es/tippy');
  initTippy(app);

  // 配置路由及路由守卫
  app.use(router);

  // 配置@tanstack/vue-query
  const { VueQueryPlugin } = await import('@tanstack/vue-query');
  app.use(VueQueryPlugin);

  // 配置Motion插件
  const { MotionPlugin } = await import('@vben/plugins/motion');
  app.use(MotionPlugin);

  // 动态更新标题
  watchEffect(() => {
    // API docs own their loaded title, including hash/query navigation.
    if (
      preferences.app.dynamicTitle &&
      router.currentRoute.value.name !== 'ApiDocs'
    ) {
      const routeTitle = router.currentRoute.value.meta?.title;
      const pageTitle =
        (routeTitle ? `${$t(routeTitle)} - ` : '') + preferences.app.name;
      useTitle(pageTitle);
    }
  });

  // Resolve the configured brand before mounting so the shell never flashes
  // the framework logo. Request errors keep the local default brand image.
  await initSiteBrand();

  app.mount('#app');

  // 自定义代码在应用挂载后异步加载，错误不会阻断主应用启动。
  void initPublicCustomCode();
}

export { bootstrap };
