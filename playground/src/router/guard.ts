import type { Router } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { preferences } from '@vben/preferences';
import { useAccessStore, useUserStore } from '@vben/stores';
import { startProgress, stopProgress } from '@vben/utils';

import { getAccessCodesApi } from '#/api';
import { restoreAccessTokenFromCookie } from '#/composables/use-auth-session';
import { accessRoutes, coreRouteNames } from '#/router/routes';
import { useAuthStore } from '#/store';
import { safeInternalRedirect } from '#/utils/safe-internal-redirect';

import { generateAccess } from './access';

/**
 * 通用守卫配置
 * @param router
 */
function setupCommonGuard(router: Router) {
  // 记录已经加载的页面
  const loadedPaths = new Set<string>();

  router.beforeEach((to) => {
    to.meta.loaded = loadedPaths.has(to.path);

    // 页面加载进度条
    if (!to.meta.loaded && preferences.transition.progress) {
      startProgress();
    }
    return true;
  });

  router.afterEach((to) => {
    // 记录页面是否加载,如果已经加载，后续的页面切换动画等效果不在重复执行
    loadedPaths.add(to.path);

    // 关闭页面加载进度条
    if (preferences.transition.progress) {
      stopProgress();
    }
  });
}

/**
 * 权限访问守卫配置
 * @param router
 */
function setupAccessGuard(router: Router) {
  router.beforeEach(async (to, from) => {
    const accessStore = useAccessStore();
    const userStore = useUserStore();
    const authStore = useAuthStore();
    // 基本路由，这些路由不需要进入权限拦截
    if (coreRouteNames.includes(to.name as string)) {
      if (to.path.startsWith('/auth') && !accessStore.accessToken) {
        await restoreAccessTokenFromCookie();
      }
      if (to.path.startsWith('/auth') && accessStore.accessToken) {
        return safeInternalRedirect(
          to.query?.redirect || userStore.userInfo?.homePath,
          preferences.app.defaultHomePath,
        );
      }
      return true;
    }

    // 整页刷新时动态路由尚未注册，受保护路径会先命中 catch-all 404 兜底。
    // 若存在登录会话提示，先恢复访问令牌并继续走动态路由生成流程，
    // 否则刷新任何受保护页面都会被 404 兜底错误接管。
    if (
      to.name === 'FallbackNotFound' &&
      !accessStore.isAccessChecked &&
      accessStore.accessToken
    ) {
      // 令牌已在内存中（同会话内重复进入），等待动态路由生成后重定向。
    } else if (
      to.name === 'FallbackNotFound' &&
      !accessStore.isAccessChecked &&
      (await restoreAccessTokenFromCookie())
    ) {
      // 通过刷新 cookie 恢复了令牌，继续走动态路由生成流程。
    } else {
      // accessToken 检查
      if (!accessStore.accessToken) {
        // 明确声明忽略权限访问权限，则可以访问
        if (to.meta.ignoreAccess) {
          return true;
        }

        if (!(await restoreAccessTokenFromCookie())) {
          // 没有访问权限，跳转登录页面
          if (to.fullPath !== LOGIN_PATH) {
            return {
              path: LOGIN_PATH,
              // 如不需要，直接删除 query
              query:
                to.fullPath === preferences.app.defaultHomePath
                  ? {}
                  : { redirect: encodeURIComponent(to.fullPath) },
              // 携带当前跳转的页面，登录后重新跳转该页面
              replace: true,
            };
          }
          return to;
        }
      }
    }

    // 是否已经生成过动态路由
    if (accessStore.isAccessChecked) {
      return true;
    }

    // 生成路由表
    // 当前登录用户拥有的角色标识列表
    const [userInfo, accessCodes] = await Promise.all([
      userStore.userInfo
        ? Promise.resolve(userStore.userInfo)
        : authStore.fetchUserInfo(),
      getAccessCodesApi(),
    ]);
    accessStore.setAccessCodes(accessCodes);
    const userRoles = userInfo.roles ?? [];

    // 生成菜单和路由
    const { accessibleMenus, accessibleRoutes } = await generateAccess({
      roles: userRoles,
      router,
      // 则会在菜单中显示，但是访问会被重定向到403
      routes: accessRoutes,
    });

    // 保存菜单信息和路由信息
    accessStore.setAccessMenus(accessibleMenus);
    accessStore.setAccessRoutes(accessibleRoutes);
    accessStore.setIsAccessChecked(true);
    let redirectPath: string;
    if (from.query.redirect) {
      redirectPath = from.query.redirect as string;
    } else if (to.fullPath === preferences.app.defaultHomePath) {
      redirectPath = preferences.app.defaultHomePath;
    } else if (userInfo.homePath && to.fullPath === userInfo.homePath) {
      redirectPath = userInfo.homePath;
    } else {
      redirectPath = to.fullPath;
    }
    return {
      ...router.resolve(
        safeInternalRedirect(redirectPath, preferences.app.defaultHomePath),
      ),
      replace: true,
    };
  });
}

/**
 * 项目守卫配置
 * @param router
 */
function createRouterGuard(router: Router) {
  /** 通用 */
  setupCommonGuard(router);
  /** 权限访问 */
  setupAccessGuard(router);
}

export { createRouterGuard };
