import type { RouteRecordRaw } from 'vue-router';


const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'mdi:credit-card-settings-outline',
      order: 9992,
      title: 'system.payment.title',
    },
    name: 'PaymentManagement',
    path: '/payment',
    redirect: '/payment/config',
    children: [
      {
        component: () => import('#/views/payment/config/index.vue'),
        meta: {
          icon: 'mdi:credit-card-settings-outline',
          title: 'system.payment.configTitle',
        },
        name: 'PaymentConfig',
        path: '/payment/config',
      },
      {
        component: () => import('#/views/payment/amount/index.vue'),
        meta: {
          icon: 'mdi:cash-plus',
          title: 'system.payment.amountTitle',
        },
        name: 'PaymentAmountConfig',
        path: '/payment/amounts',
      },
      {
        component: () => import('#/views/payment/order/index.vue'),
        meta: {
          icon: 'mdi:receipt-text-clock-outline',
          title: 'system.payment.orderTitle',
        },
        name: 'PaymentOrder',
        path: '/payment/orders',
      },
    ],
  },
];

export default routes;
