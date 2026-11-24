import type { RouteRecordRaw } from 'vue-router';


const routes: RouteRecordRaw[] = [
  {
    component: () => import('#/views/ticket/user-list.vue'),
    meta: {
      fullPathKey: false,
      keepAlive: false,
      icon: 'lucide:messages-square',
      order: 4,
      title: 'ticket.title',
    },
    name: 'UserTicketCenter',
    path: '/console/tickets',
  },
  {
    component: () => import('#/views/ticket/user-detail.vue'),
    meta: {
      fullPathKey: false,
      keepAlive: false,
      hideInBreadcrumb: false,
      hideInMenu: true,
      hideInTab: false,
      title: 'ticket.detail.title',
      activePath: '/console/tickets',
    },
    name: 'UserTicketDetail',
    path: '/console/tickets/:id',
  },
  {
    component: () => import('#/views/ticket/admin-list.vue'),
    meta: {
      fullPathKey: false,
      keepAlive: false,
      icon: 'lucide:message-square-reply',
      order: 6,
      title: 'ticket.adminTitle',
    },
    name: 'AdminTicketManagement',
    path: '/admin/tickets',
  },
  {
    component: () => import('#/views/ticket/admin-detail.vue'),
    meta: {
      fullPathKey: false,
      keepAlive: false,
      hideInBreadcrumb: false,
      hideInMenu: true,
      hideInTab: false,
      title: 'ticket.detail.title',
      activePath: '/admin/tickets',
    },
    name: 'AdminTicketDetail',
    path: '/admin/tickets/:id',
  },
  {
    meta: {
      fullPathKey: false,
      keepAlive: false,
      hideInBreadcrumb: true,
      hideInMenu: true,
      hideInTab: true,
      title: 'ticket.title',
    },
    name: 'LegacyTicketCenterRedirect',
    path: '/tickets',
    redirect: '/console/tickets',
  },
];

export default routes;
