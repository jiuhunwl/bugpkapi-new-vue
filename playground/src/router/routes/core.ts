import type { RouteRecordRaw } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';


const BasicLayout = () => import('#/layouts/basic.vue');
const AuthPageLayout = () => import('#/layouts/auth.vue');
/** 全局404页面 */
const fallbackNotFoundRoute: RouteRecordRaw = {
  component: () => import('#/views/_core/fallback/not-found.vue'),
  meta: {
    hideInBreadcrumb: true,
    hideInMenu: true,
    hideInTab: true,
    ignoreAccess: true,
    title: '404',
  },
  name: 'FallbackNotFound',
  path: '/:path(.*)*',
};

/** 基本路由，这些路由是必须存在的 */
const coreRoutes: RouteRecordRaw[] = [
  {
    name: 'Home',
    path: '/',
    component: () => import('#/views/home/index.vue'),
    meta: {
      hideInBreadcrumb: true,
      hideInMenu: true,
      hideInTab: true,
      ignoreAccess: true,
      title: 'page.public.nav.home',
    },
  },
  /**
   * 根路由
   * 使用基础布局，作为所有页面的父级容器，子级就不必配置BasicLayout。
   * 此路由必须存在，且不应修改
   */
  {
    children: [],
    component: BasicLayout,
    meta: {
      hideInBreadcrumb: true,
      title: 'Root',
    },
    name: 'Root',
    path: '/console',
    redirect: '/console/workspace',
  },
  {
    name: 'LegacyWorkspaceRedirect',
    path: '/workspace',
    redirect: '/console/workspace',
    meta: {
      hideInBreadcrumb: true,
      hideInMenu: true,
      hideInTab: true,
      title: 'page.dashboard.workspace',
    },
  },
  {
    name: 'HomeRedirect',
    path: '/home',
    redirect: '/',
    meta: {
      hideInBreadcrumb: true,
      hideInMenu: true,
      hideInTab: true,
      ignoreAccess: true,
      title: 'page.public.nav.home',
    },
  },
  {
    name: 'ApiList',
    path: '/apis',
    redirect: (to) => ({ path: '/apilist', query: to.query, hash: to.hash }),
    meta: {
      hideInBreadcrumb: true,
      hideInMenu: true,
      hideInTab: true,
      ignoreAccess: true,
      title: 'page.public.nav.apiList',
    },
  },
  {
    name: 'ApiMarket',
    path: '/apilist',
    component: () => import('#/views/market/index.vue'),
    meta: {
      hideInBreadcrumb: true,
      hideInMenu: true,
      hideInTab: true,
      ignoreAccess: true,
      title: 'page.public.nav.market',
    },
  },
  {
    name: 'FriendLinks',
    path: '/links',
    component: () => import('#/views/links/index.vue'),
    meta: {
      hideInBreadcrumb: true,
      hideInMenu: true,
      hideInTab: true,
      ignoreAccess: true,
      title: 'page.public.nav.links',
    },
  },
  {
    name: 'Donate',
    path: '/donate',
    component: () => import('#/views/donate/index.vue'),
    meta: {
      hideInBreadcrumb: true,
      hideInMenu: true,
      hideInTab: true,
      ignoreAccess: true,
      title: 'page.public.nav.donate',
    },
  },
  {
    name: 'PrivacyPolicy',
    path: '/privacy-policy',
    component: () => import('#/views/legal/index.vue'),
    props: {
      documentType: 'privacy',
    },
    meta: {
      hideInBreadcrumb: true,
      hideInMenu: true,
      hideInTab: true,
      ignoreAccess: true,
      title: 'legal.common.privacyPolicy',
    },
  },
  {
    name: 'TermsOfService',
    path: '/terms-of-service',
    component: () => import('#/views/legal/index.vue'),
    props: {
      documentType: 'terms',
    },
    meta: {
      hideInBreadcrumb: true,
      hideInMenu: true,
      hideInTab: true,
      ignoreAccess: true,
      title: 'legal.common.termsOfService',
    },
  },
  {
    name: 'PaymentAgreement',
    path: '/payment-agreement',
    component: () => import('#/views/legal/index.vue'),
    props: {
      documentType: 'payment',
    },
    meta: {
      hideInBreadcrumb: true,
      hideInMenu: true,
      hideInTab: true,
      ignoreAccess: true,
      title: 'legal.common.paymentAgreement',
    },
  },
  {
    name: 'ApiDocs',
    path: '/docs/:id',
    component: () => import('#/views/market/docs.vue'),
    meta: {
      hideInBreadcrumb: true,
      hideInMenu: true,
      hideInTab: true,
      ignoreAccess: true,
      title: 'page.public.marketDocs.title',
    },
  },
  {
    component: AuthPageLayout,
    meta: {
      hideInTab: true,
      title: 'OAuth',
    },
    name: 'OAuthFlow',
    path: '/oauth',
    redirect: '/oauth/callback',
    children: [
      {
        name: 'OAuthCallback',
        path: 'callback',
        component: () => import('#/views/_core/authentication/oauth-callback.vue'),
        meta: {
          title: 'oauth.callback.title',
        },
      },
      {
        name: 'OAuthComplete',
        path: 'complete',
        component: () => import('#/views/_core/authentication/oauth-complete.vue'),
        meta: {
          title: 'oauth.complete.title',
        },
      },
    ],
  },
  {
    component: AuthPageLayout,
    meta: {
      hideInTab: true,
      title: 'Authentication',
    },
    name: 'Authentication',
    path: '/auth',
    redirect: LOGIN_PATH,
    children: [
      {
        name: 'Login',
        path: 'login',
        component: () => import('#/views/_core/authentication/login.vue'),
        meta: {
          title: 'page.auth.login',
        },
      },
      {
        name: 'ForgetPassword',
        path: 'forget-password',
        component: () =>
          import('#/views/_core/authentication/forget-password.vue'),
        meta: {
          title: 'page.auth.forgetPassword',
        },
      },
      {
        name: 'Register',
        path: 'register',
        component: () => import('#/views/_core/authentication/register.vue'),
        meta: {
          title: 'page.auth.register',
        },
      },
    ],
  },
];

export { coreRoutes, fallbackNotFoundRoute };
