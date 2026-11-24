import type { Recordable, UserInfo } from '@vben/types';

import type { AuthApi } from '#/api';

import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { preferences } from '@vben/preferences';
import { resetAllStores, useAccessStore, useUserStore } from '@vben/stores';

import { notification } from 'ant-design-vue';
import { defineStore } from 'pinia';

import {
  getAccessCodesApi,
  getUserInfoApi,
  loginApi,
  logoutApi,
  registerApi,
} from '#/api';
import { $t } from '#/locales';
import {
  clearAuthSessionHint,
  markAuthSessionActive,
} from '#/utils/auth-session-hint';
import {
  advanceAuthSession,
  assertAuthSessionCurrent,
  getAuthSessionGeneration,
  isAuthSessionCurrent,
} from '#/utils/auth-session-lifecycle';
import { safeInternalRedirect } from '#/utils/safe-internal-redirect';

export const useAuthStore = defineStore('auth', () => {
  const accessStore = useAccessStore();
  const userStore = useUserStore();
  const router = useRouter();

  const loginLoading = ref(false);

  /**
   * 异步处理登录操作
   * Asynchronously handle the login process
   * @param params 登录表单数据
   * @param onSuccess 成功之后的回调函数
   */
  async function authLogin(
    params: Recordable<any>,
    onSuccess?: () => Promise<void> | void,
  ) {
    // 异步处理用户登录操作并获取 accessToken
    let userInfo: null | UserInfo = null;
    let generation = getAuthSessionGeneration();
    try {
      loginLoading.value = true;
      const { accessToken } = await loginApi(params);
      assertAuthSessionCurrent(generation);

      // 如果成功获取到 accessToken
      if (accessToken) {
        generation = advanceAuthSession();
        accessStore.setAccessToken(accessToken);
        markAuthSessionActive();

        // 获取用户信息并存储到 accessStore 中
        const [fetchUserInfoResult, accessCodes] = await Promise.all([
          fetchUserInfo(),
          getAccessCodesApi(),
        ]);
        assertAuthSessionCurrent(generation);

        userInfo = fetchUserInfoResult;

        userStore.setUserInfo(userInfo);
        accessStore.setAccessCodes(accessCodes);

        if (accessStore.loginExpired) {
          accessStore.setLoginExpired(false);
        } else {
          onSuccess
            ? await onSuccess?.()
            : await router.push(
                safeInternalRedirect(
                  userInfo.homePath,
                  preferences.app.defaultHomePath,
                ),
              );
        }

        assertAuthSessionCurrent(generation);
        if (userInfo?.realName) {
          notification.success({
            description: `${$t('authentication.loginSuccessDesc')}:${userInfo?.realName}`,
            duration: 3,
            message: $t('authentication.loginSuccess'),
          });
        }
      }
    } finally {
      if (isAuthSessionCurrent(generation)) {
        loginLoading.value = false;
      }
    }

    return {
      userInfo,
    };
  }

  async function authRegister(params: AuthApi.RegisterParams) {
    let userInfo: null | UserInfo = null;
    let generation = getAuthSessionGeneration();
    try {
      loginLoading.value = true;
      const { accessToken } = await registerApi(params);
      assertAuthSessionCurrent(generation);

      if (accessToken) {
        generation = advanceAuthSession();
        accessStore.setAccessToken(accessToken);
        markAuthSessionActive();

        const [fetchUserInfoResult, accessCodes] = await Promise.all([
          fetchUserInfo(),
          getAccessCodesApi(),
        ]);
        assertAuthSessionCurrent(generation);

        userInfo = fetchUserInfoResult;
        userStore.setUserInfo(userInfo);
        accessStore.setAccessCodes(accessCodes);
        await router.push(
          safeInternalRedirect(
            userInfo.homePath,
            preferences.app.defaultHomePath,
          ),
        );

        assertAuthSessionCurrent(generation);
        notification.success({
          description: `${$t('authentication.loginSuccessDesc')}:${userInfo?.realName || params.username}`,
          duration: 3,
          message: $t('authentication.loginSuccess'),
        });
      }
    } finally {
      if (isAuthSessionCurrent(generation)) {
        loginLoading.value = false;
      }
    }

    return { userInfo };
  }

  async function authLoginByAccessToken(accessToken: string, redirect?: string) {
    let userInfo: null | UserInfo = null;
    let generation = getAuthSessionGeneration();
    try {
      loginLoading.value = true;
      if (accessToken) {
        generation = advanceAuthSession();
        accessStore.setAccessToken(accessToken);
        markAuthSessionActive();

        const [fetchUserInfoResult, accessCodes] = await Promise.all([
          fetchUserInfo(),
          getAccessCodesApi(),
        ]);
        assertAuthSessionCurrent(generation);

        userInfo = fetchUserInfoResult;
        userStore.setUserInfo(userInfo);
        accessStore.setAccessCodes(accessCodes);
        accessStore.setLoginExpired(false);

        await router.push(
          safeInternalRedirect(
            redirect || userInfo.homePath,
            preferences.app.defaultHomePath,
          ),
        );

        assertAuthSessionCurrent(generation);
        notification.success({
          description: `${$t('authentication.loginSuccessDesc')}:${userInfo?.realName || userInfo?.username || $t('authentication.thirdPartyUser')}`,
          duration: 3,
          message: $t('authentication.loginSuccess'),
        });
      }
    } finally {
      if (isAuthSessionCurrent(generation)) {
        loginLoading.value = false;
      }
    }

    return { userInfo };
  }

  let logoutGeneration: null | number = null;
  const isTerminatingBannedSession = ref(false);

  async function terminateBannedSession() {
    if (isTerminatingBannedSession.value) return;
    isTerminatingBannedSession.value = true;

    try {
      advanceAuthSession();
      resetAllStores();
      accessStore.setLoginExpired(false);
      clearAuthSessionHint();
      if (router.currentRoute.value.path !== LOGIN_PATH) {
        await router.replace({ path: LOGIN_PATH });
      }
    } finally {
      isTerminatingBannedSession.value = false;
    }
  }

  async function logout(redirect: boolean = true) {
    if (logoutGeneration === getAuthSessionGeneration()) return;
    const generation = advanceAuthSession();
    logoutGeneration = generation;
    resetAllStores();
    accessStore.setLoginExpired(false);
    clearAuthSessionHint();

    try {
      await logoutApi();
    } catch {
      // 不做任何处理
    } finally {
      if (logoutGeneration === generation) {
        logoutGeneration = null;
      }
    }

    if (!isAuthSessionCurrent(generation)) return;

    // 回登录页带上当前路由地址
    await router.replace({
      path: LOGIN_PATH,
      query: redirect
        ? {
            redirect: encodeURIComponent(router.currentRoute.value.fullPath),
          }
        : {},
    });
  }

  async function fetchUserInfo() {
    const generation = getAuthSessionGeneration();
    const userInfo = await getUserInfoApi();
    assertAuthSessionCurrent(generation);
    userStore.setUserInfo(userInfo);
    return userInfo;
  }

  function $reset() {
    loginLoading.value = false;
  }

  return {
    $reset,
    authLogin,
    authLoginByAccessToken,
    authRegister,
    fetchUserInfo,
    loginLoading,
    logout,
    terminateBannedSession,
  };
});
