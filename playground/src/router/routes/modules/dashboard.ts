import type { RouteRecordRaw } from 'vue-router';


const routes: RouteRecordRaw[] = [
  {
    name: 'Workspace',
    path: '/console/workspace',
    component: () => import('#/views/dashboard/workspace/index.vue'),
    meta: {
      affixTab: true,
      icon: 'carbon:workspace',
      keepAlive: true,
      order: -1,
      title: 'page.dashboard.workspace',
    },
  },
  {
    name: 'LegacyRiskControlEarthRedirect',
    path: '/risk-control/earth',
    redirect: '/risk-control/dashboard',
    meta: {
      hideInBreadcrumb: true,
      hideInMenu: true,
      hideInTab: true,
      title: 'system.riskControl.dashboard.title',
    },
  },
];

export default routes;
