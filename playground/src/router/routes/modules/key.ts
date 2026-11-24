import type { RouteRecordRaw } from 'vue-router';


const routes: RouteRecordRaw[] = [
  {
    component: () => import('#/views/key/list.vue'),
    meta: {
      hideInMenu: true,
      icon: 'mdi:key-chain',
      order: 9994,
      title: 'system.key.title',
    },
    name: 'KeyManagement',
    path: '/key',
  },
  {
    meta: {
      hideInBreadcrumb: true,
      hideInMenu: true,
      hideInTab: true,
      title: 'system.key.title',
    },
    name: 'LegacyKeyListRedirect',
    path: '/key/list',
    redirect: '/key',
  },
];

export default routes;
