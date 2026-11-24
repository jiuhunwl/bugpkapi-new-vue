import type { RouteRecordRaw } from 'vue-router';

// 友情链接 / 友链中心 / 友链配置已收敛为同一个「友链中心」页（申请审核 / 友链列表 / 站点配置）。
// 可见入口由后台菜单驱动（/content/friend-link），这里只保留旧路径的兼容跳转，
// hideInMenu 让它们在后端菜单模式下仍然注册，旧书签不会走进 404。
const routes: RouteRecordRaw[] = [
  {
    component: () => import('#/views/friend-link/index.vue'),
    meta: {
      icon: 'mdi:link-variant',
      order: 9990,
      title: 'system.friendLink.applicationTitle',
    },
    name: 'FriendLinkCenter',
    path: '/friend-link',
  },
  {
    meta: { hideInMenu: true, title: 'system.friendLink.applicationTitle' },
    name: 'FriendLinkListCompat',
    path: '/friend-link/list',
    redirect: { name: 'FriendLinkCenter', query: { tab: 'links' } },
  },
  {
    meta: { hideInMenu: true, title: 'system.friendLink.applicationTitle' },
    name: 'FriendLinkApplicationsCompat',
    path: '/friend-link/applications',
    redirect: { name: 'FriendLinkCenter', query: { tab: 'applications' } },
  },
  {
    meta: { hideInMenu: true, title: 'system.friendLink.applicationTitle' },
    name: 'FriendLinkConfigCompat',
    path: '/friend-link/config',
    redirect: { name: 'FriendLinkCenter', query: { tab: 'config' } },
  },
  // 「我的友链」由后端按登录账号注入（rbac injectUserFeatureMenus，负数菜单 ID），
  // 这里放一份 hideInMenu 兜底：普通用户侧会按路由 name 与注入菜单合并、后端 meta 优先，
  // 管理端则保证直接输入 /friend-link/mine 也能打开自助页（接口本身只返回当前账号的数据）。
  {
    component: () => import('#/views/friend-link/mine.vue'),
    meta: {
      hideInMenu: true,
      icon: 'mdi:link-box-variant-outline',
      title: 'system.friendLink.mineTitle',
    },
    name: 'FriendLinkMine',
    path: '/friend-link/mine',
  },
];

export default routes;
