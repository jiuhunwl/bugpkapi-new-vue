import { defineOverridesPreferences } from '@vben/preferences';

import { DEFAULT_SITE_NAME } from './site-brand';
import { DEFAULT_VBEN_USER_AVATAR } from './utils/user-avatar';

/**
 * @description 项目配置文件
 * 只需要覆盖项目中的一部分配置，不需要的配置不用覆盖，会自动使用默认配置
 * !!! 更改配置后请清空缓存，否则可能不生效
 */
export const overridesPreferences = defineOverridesPreferences({
  // overrides
  app: {
    accessMode: 'backend',
    defaultAvatar: DEFAULT_VBEN_USER_AVATAR,
    defaultHomePath: '/console/workspace',
    enableRefreshToken: true,
    name: import.meta.env.VITE_APP_TITLE || DEFAULT_SITE_NAME,
  },
  logo: {
    fit: 'contain',
    // 像素图标已完全移除；控制台/登录页默认走品牌图标 bugpk-icon。
    source: '/brand-options/bugpk-icon.png',
    sourceDark: '/brand-options/bugpk-icon.png',
  },
  theme: {
    mode: 'light',
  },
  transition: {
    // 路由切换的全局加载动画由 GlobalRouteLoading 呈现（后台可选预设），
    // 关闭框架默认 spinner，避免两套加载指示叠加。
    loading: false,
  },
  widget: {
    // 顶栏铃铛由 layouts/basic.vue 的 #notification 插槽接入站内消息中心。
    notification: true,
  },
});
