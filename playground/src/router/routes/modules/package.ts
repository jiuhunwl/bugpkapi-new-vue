import type { RouteRecordRaw } from 'vue-router';


const routes: RouteRecordRaw[] = [
  {
    component: () => import('#/views/package/global/list.vue'),
    meta: {
      icon: 'mdi:web',
      order: 9993,
      title: 'system.package.globalTitle',
    },
    name: 'GlobalPackage',
    path: '/package/global',
  },
  {
    component: () => import('#/views/package/interface/list.vue'),
    meta: {
      icon: 'mdi:package-variant',
      order: 9992,
      title: 'system.package.interfaceTitle',
    },
    name: 'InterfacePackage',
    path: '/package/interface',
  },
  {
    component: () => import('#/views/purchase/global/list.vue'),
    meta: {
      icon: 'mdi:shopping-outline',
      order: 9991,
      title: 'system.package.buyGlobalTitle',
    },
    name: 'UserGlobalPackage',
    path: '/purchase/global',
  },
  {
    component: () => import('#/views/purchase/interface/list.vue'),
    meta: {
      icon: 'mdi:shopping-outline',
      order: 9990,
      title: 'system.package.buyInterfaceTitle',
    },
    name: 'UserInterfacePackage',
    path: '/purchase/interface',
  },
  {
    component: () => import('#/views/purchase/interface/detail.vue'),
    meta: {
      hideInMenu: true,
      title: 'system.package.interfacePackageBuy',
    },
    name: 'UserInterfacePackageDetail',
    path: '/purchase/interface/detail/:id',
  },
  {
    component: () => import('#/views/purchase/point/list.vue'),
    meta: {
      icon: 'mdi:database-plus',
      order: 9989,
      title: 'system.package.buyPointTitle',
    },
    name: 'UserPointPackage',
    path: '/purchase/point',
  },
  {
    component: () => import('#/views/payment/order/user.vue'),
    meta: {
      icon: 'mdi:receipt-clock-outline',
      order: 9988,
      title: 'system.package.userPaymentOrderTitle',
    },
    name: 'UserPaymentOrder',
    path: '/purchase/orders',
  },
  {
    component: () => import('#/views/purchase/assets/index.vue'),
    meta: {
      icon: 'lucide:wallet-cards',
      order: 9987,
      title: 'system.package.assets.title',
    },
    name: 'UserAssetCenter',
    path: '/purchase/assets',
  },
];

export default routes;
