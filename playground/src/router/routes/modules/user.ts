import type { RouteRecordRaw } from 'vue-router';


const routes: RouteRecordRaw[] = [
  {
    component: () => import('#/views/user/security/index.vue'),
    meta: {
      hideInMenu: false,
      icon: 'lucide:shield-check',
      order: 9995,
      title: 'page.auth.security.title',
    },
    name: 'UserSecuritySettings',
    path: '/security',
  },
  {
    component: () => import('#/views/user/inbox/index.vue'),
    meta: {
      hideInMenu: true,
      icon: 'lucide:bell',
      title: 'inbox.userTitle',
    },
    name: 'UserInbox',
    path: '/user/inbox',
  },
  {
    meta: {
      icon: 'mdi:account-cog',
      order: 9996,
      title: 'system.user.title',
    },
    name: 'UserManagement',
    path: '/user',
    children: [
      {
        path: '/user/list',
        name: 'SystemUser',
        meta: {
          icon: 'mdi:account',
          title: 'system.user.listTitle',
        },
        component: () => import('#/views/system/user/list.vue'),
      },
      {
        path: '/user/role',
        name: 'SystemRole',
        meta: {
          icon: 'mdi:account-group',
          title: 'system.role.title',
        },
        component: () => import('#/views/system/role/list.vue'),
      },
    ],
  },
];

export default routes;
