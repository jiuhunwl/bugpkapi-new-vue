import type { RouteRecordRaw } from 'vue-router';


const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'ion:settings-outline',
      order: 9997,
      title: 'system.title',
    },
    name: 'System',
    path: '/system',
    children: [
      {
        path: '/system/register',
        name: 'SystemRegisterOpenConfig',
        meta: {
          icon: 'mdi:account-plus-outline',
          title: 'system.register.openConfigTitle',
        },
        component: () => import('#/views/system/register/index.vue'),
      },
      {
        path: '/system/register/email',
        name: 'SystemRegisterEmailConfig',
        meta: {
          icon: 'mdi:email-cog-outline',
          title: 'system.register.emailConfig',
        },
        component: () => import('#/views/system/register/email-config.vue'),
      },
      {
        path: '/system/register/mobile',
        name: 'SystemRegisterMobileConfig',
        meta: {
          icon: 'mdi:cellphone-cog',
          title: 'system.register.mobileConfig',
        },
        component: () => import('#/views/system/register/mobile-config.vue'),
      },
      {
        path: '/system/login/quick',
        name: 'SystemQuickLoginConfig',
        meta: {
          icon: 'mdi:login-variant',
          title: 'system.login.quickLoginConfig',
        },
        component: () => import('#/views/system/login/quick-login.vue'),
      },
      {
        path: '/system/menu',
        name: 'SystemMenu',
        meta: { icon: 'mdi:menu', title: 'system.menu.title' },
        component: () => import('#/views/system/menu/list.vue'),
      },
      {
        path: '/system/site',
        name: 'SystemSiteConfig',
        meta: { icon: 'mdi:web-sync', title: 'system.site.title' },
        component: () => import('#/views/system/site/index.vue'),
      },
      {
        path: '/system/ip-config',
        name: 'SystemIpSourceConfig',
        meta: { icon: 'mdi:ip-network', title: 'ipConfig.title' },
        component: () => import('#/views/system/ip-config/index.vue'),
      },
      {
        path: '/system/log-delete',
        name: 'SystemLogDelete',
        meta: {
          icon: 'mdi:delete-clock-outline',
          title: 'system.logDelete.title',
        },
        component: () => import('#/views/system/log-delete/index.vue'),
      },
      {
        path: '/system/operation-log',
        name: 'SystemOperationLog',
        meta: {
          icon: 'mdi:clipboard-text-clock-outline',
          order: 7,
          title: 'system.operationLog.title',
        },
        component: () => import('#/views/system/operation-log/index.vue'),
      },
      {
        path: '/system/about',
        name: 'SystemAbout',
        meta: {
          icon: 'mdi:information-outline',
          order: 8,
          title: 'system.about.title',
        },
        component: () => import('#/views/system/about/index.vue'),
      },
      {
        path: '/system/updates',
        name: 'SystemReleaseNotes',
        meta: {
          hideInMenu: true,
          activePath: '/system/about',
          title: 'system.updates.title',
        },
        component: () => import('#/views/system/updates/index.vue'),
      },
      {
        path: '/system/captcha-config',
        name: 'SystemCaptchaConfig',
        meta: {
          icon: 'mdi:shield-key-outline',
          order: 9,
          title: 'captchaConfig.title',
        },
        component: () => import('#/views/system/captcha-config/index.vue'),
      },
      {
        path: '/system/session-config',
        name: 'SystemSessionConfig',
        meta: {
          icon: 'mdi:timer-outline',
          order: 10,
          title: 'sessionConfig.title',
        },
        component: () => import('#/views/system/session-config/index.vue'),
      },
      {
        path: '/system/image-host-config',
        name: 'SystemImageHostConfig',
        meta: {
          icon: 'mdi:cloud-upload-outline',
          order: 12,
          title: 'imageHostConfig.title',
        },
        component: () => import('#/views/system/image-host-config/index.vue'),
      },
      {
        path: '/system/agreement',
        name: 'SystemAgreementConfig',
        meta: {
          icon: 'mdi:file-sign',
          order: 11,
          title: 'agreementConfig.title',
        },
        component: () => import('#/views/system/agreement/index.vue'),
      },
    ],
  },
];

export default routes;
