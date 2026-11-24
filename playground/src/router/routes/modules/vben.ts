import type { RouteRecordRaw } from 'vue-router';


const routes: RouteRecordRaw[] = [
  {
    name: 'MyOperationLog',
    path: '/console/operation-logs',
    component: () => import('#/views/_core/profile/operation-log.vue'),
    meta: {
      hideInMenu: true,
      icon: 'lucide:history',
      title: 'system.operationLog.personalTitle',
    },
  },
  {
    name: 'Profile',
    path: '/profile',
    component: () => import('#/views/_core/profile/index.vue'),
    meta: {
      icon: 'lucide:user',
      hideInMenu: true,
      title: 'page.auth.profile',
    },
  },
];

export default routes;
