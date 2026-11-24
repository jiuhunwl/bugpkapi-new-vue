import type { RouteRecordRaw } from 'vue-router';


// accessMode 为 backend 时，公告管理页（/content/notices、/content/home-notice）
// 与用户公告中心（/notice）的菜单与授权均由 bp_menu 驱动，勿在此重复声明管理页路由。
// 用户公告中心菜单（bp_menu 202）仅授予 user 角色，这里保留一个 hideInMenu 的
// 兜底路由，保证 admin 等未授权角色从工作台弹窗跳转 /notice 时不落 404；
// 对已拥有菜单的角色，会按路由 name 与后端菜单路由合并，后端 meta 优先。
const routes: RouteRecordRaw[] = [
  {
    component: () => import('#/views/notice/user/list.vue'),
    meta: {
      hideInMenu: true,
      icon: 'mdi:bullhorn-outline',
      title: 'system.notice.userTitle',
    },
    name: 'UserNoticeCenter',
    path: '/notice',
  },
];

export default routes;
