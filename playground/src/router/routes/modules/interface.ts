import type { RouteRecordRaw } from 'vue-router';


const routes: RouteRecordRaw[] = [
  {
    component: () => import('#/views/interface/list.vue'),
    meta: {
      hideInMenu: true,
      icon: 'mdi:api',
      order: 9995,
      title: 'system.interface.listTitle',
    },
    name: 'InterfaceList',
    path: '/console/interfaces',
  },
  {
    component: () => import('#/views/interface/log.vue'),
    meta: {
      hideInMenu: true,
      icon: 'mdi:clipboard-text-clock',
      order: 9994,
      title: 'system.interface.callLogTitle',
    },
    name: 'InterfaceCallLog',
    path: '/console/call-logs',
  },
  {
    meta: {
      hideInBreadcrumb: true,
      hideInMenu: true,
      hideInTab: true,
      title: 'system.interface.listTitle',
    },
    name: 'LegacyInterfaceListRedirect',
    path: '/interface/list',
    redirect: '/console/interfaces',
  },
  {
    meta: {
      hideInBreadcrumb: true,
      hideInMenu: true,
      hideInTab: true,
      title: 'system.interface.callLogTitle',
    },
    name: 'LegacyInterfaceCallLogRedirect',
    path: '/interface/log',
    redirect: '/console/call-logs',
  },
];

export default routes;
