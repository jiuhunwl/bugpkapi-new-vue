/**
 * 该文件可自行根据业务逻辑进行调整
 */
import type {
  AxiosResponseHeaders,
  RequestClientConfig,
  RequestClientOptions,
} from '@vben/request';

import { useAppConfig } from '@vben/hooks';
import { preferences } from '@vben/preferences';
import {
  authenticateResponseInterceptor,
  CircuitOpenError,
  defaultResponseInterceptor,
  errorMessageResponseInterceptor,
  RequestClient,
} from '@vben/request';
import { useAccessStore } from '@vben/stores';
import { cloneDeep } from '@vben/utils';

import { message, notification } from 'ant-design-vue';
import JSONBigInt from 'json-bigint';

import { $t } from '#/locales';
import { useAuthStore } from '#/store';
import {
  accountBanDescription,
  parseAccountBanDetails,
} from '#/utils/account-ban';
import {
  clearAuthSessionHint,
  hasAuthSessionHint,
} from '#/utils/auth-session-hint';
import {
  advanceAuthSession,
  assertAuthSessionCurrent,
  AuthSessionInvalidatedError,
  getAuthSessionGeneration,
  onAuthSessionInvalidated,
} from '#/utils/auth-session-lifecycle';

import { refreshTokenApi } from './core/auth';
import { localeRequestHeaders } from './locale';

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);

const ERROR_MESSAGE_DEDUPE_MS = 1000;
let lastErrorMessage = '';
let lastErrorMessageTime = 0;
let sessionTerminationPromise: null | Promise<void> = null;

function showErrorMessage(content: string) {
  const now = Date.now();
  if (
    content === lastErrorMessage &&
    now - lastErrorMessageTime < ERROR_MESSAGE_DEDUPE_MS
  ) {
    return;
  }
  lastErrorMessage = content;
  lastErrorMessageTime = now;
  message.error(content);
}

function createRequestClient(baseURL: string, options?: RequestClientOptions) {
  const client = new RequestClient({
    ...options,
    // 默认超时 8000ms：与后端服务 8s 限时对齐，避免前端等后端恢复造成 3s 空等
    timeout: 8000,
    baseURL,
    transformResponse: (data: any, header: AxiosResponseHeaders) => {
      // storeAsString指示将BigInt存储为字符串，设为false则会存储为内置的BigInt类型
      if (
        header.getContentType()?.toString().includes('application/json') &&
        typeof data === 'string'
      ) {
        return cloneDeep(
          JSONBigInt({ storeAsString: true, strict: true }).parse(data),
        );
      }
      return data;
    },
  });

  // Capture ownership before request deduplication or concurrency waiting.
  const request = client.request;
  client.request = async <T>(url: string, config: RequestClientConfig) => {
    const generation =
      config.__authSessionGeneration ?? getAuthSessionGeneration();
    assertAuthSessionCurrent(generation);
    return request<T>(url, {
      ...config,
      __authSessionGeneration: generation,
    });
  };

  const stopInvalidation = onAuthSessionInvalidated(() => {
    const queue = client.refreshTokenQueue;
    client.refreshTokenQueue = [];
    client.isRefreshing = false;
    sessionTerminationPromise = null;
    const error = new AuthSessionInvalidatedError();
    queue.splice(0).forEach((queued) => queued.reject(error));
  });
  import.meta.hot?.dispose(stopInvalidation);

  /**
   * 重新认证逻辑
   */
  async function doReAuthenticate() {
    if (sessionTerminationPromise) {
      return sessionTerminationPromise;
    }

    const accessStore = useAccessStore();
    const authStore = useAuthStore();
    const pending = (async () => {
      const hadSession = Boolean(
        accessStore.accessToken || hasAuthSessionHint(),
      );
      if (!hadSession && accessStore.loginExpired) {
        return;
      }
      advanceAuthSession();
      accessStore.setAccessToken(null);
      clearAuthSessionHint();
      if (hadSession) {
        showErrorMessage(
          '\u767b\u5f55\u72b6\u6001\u5df2\u5931\u6548\uff0c\u8bf7\u91cd\u65b0\u767b\u5f55',
        );
      }
      if (
        preferences.app.loginExpiredMode === 'modal' &&
        accessStore.isAccessChecked
      ) {
        accessStore.setLoginExpired(true);
      } else if (hadSession || accessStore.isAccessChecked) {
        await authStore.logout();
      }
    })().finally(() => {
      if (sessionTerminationPromise === pending) {
        sessionTerminationPromise = null;
      }
    });

    sessionTerminationPromise = pending;
    return pending;
  }

  /**
   * 刷新token逻辑
   */
  async function doRefreshToken() {
    const accessStore = useAccessStore();
    if (!accessStore.accessToken && !hasAuthSessionHint()) {
      const error = new Error('No active session is available for refresh.');
      Object.assign(error, { code: 'AUTH_SESSION_MISSING' });
      throw error;
    }

    const generation = getAuthSessionGeneration();
    const resp = await refreshTokenApi(accessStore.accessToken);
    assertAuthSessionCurrent(generation);
    const newToken = resp.data;
    if (!newToken) {
      throw new Error('Refresh token response missing access token.');
    }
    accessStore.setAccessToken(newToken);
    return newToken;
  }

  function formatToken(token: null | string) {
    return token ? `Bearer ${token}` : null;
  }

  // 请求头处理
  client.addRequestInterceptor({
    fulfilled: async (config) => {
      if (config.__authSessionGeneration !== undefined) {
        assertAuthSessionCurrent(config.__authSessionGeneration);
      }
      const accessStore = useAccessStore();
      const { acceptLanguage, appLocale } = localeRequestHeaders();
      config.headers.Authorization = formatToken(accessStore.accessToken);
      config.headers['Accept-Language'] = acceptLanguage;
      config.headers['X-App-Locale'] = appLocale;
      return config;
    },
  });

  // Run before payload unwrapping, expiry handling and account-ban handling.
  client.addResponseInterceptor({
    fulfilled: (response) => {
      if (response.config.__authSessionGeneration !== undefined) {
        assertAuthSessionCurrent(response.config.__authSessionGeneration);
      }
      return response;
    },
    rejected: (error) => {
      const generation = error?.config?.__authSessionGeneration;
      if (generation !== undefined) {
        assertAuthSessionCurrent(generation);
      }
      return Promise.reject(error);
    },
  });

  // 处理返回的响应数据格式
  client.addResponseInterceptor(
    defaultResponseInterceptor({
      codeField: 'code',
      dataField: 'data',
      successCode: 0,
    }),
  );

  // token过期的处理
  client.addResponseInterceptor(
    authenticateResponseInterceptor({
      client,
      doReAuthenticate,
      doRefreshToken,
      // Session renewal is part of the backend auth contract, not a cached UI preference.
      // This module can load before initPreferences applies the app overrides.
      enableRefreshToken: true,
      formatToken,
      getSessionGeneration: getAuthSessionGeneration,
      shouldRefreshToken(error) {
        const accessStore = useAccessStore();
        const requestUrl = String(error?.config?.url || '');
        return (
          !requestUrl.includes('/auth/refresh') &&
          Boolean(accessStore.accessToken || hasAuthSessionHint())
        );
      },
    }),
  );

  client.addResponseInterceptor({
    rejected: async (error) => {
      const details = parseAccountBanDetails(error?.response?.data?.data);
      if (!details) {
        return Promise.reject(error);
      }

      notification.error({
        description: accountBanDescription(details),
        duration: 0,
        key: 'account-banned',
        message: $t('page.auth.accountBan.title'),
      });
      await useAuthStore().terminateBannedSession();
      return Promise.reject(error);
    },
  });

  // 通用的错误处理,如果没有进入上面的错误处理逻辑，就会进入这里
  client.addResponseInterceptor(
    errorMessageResponseInterceptor((msg: string, error) => {
      if (parseAccountBanDetails(error?.response?.data?.data)) {
        return;
      }
      // 熔断 OPEN 期间的错误为降级信号：不弹窗刷屏，由组合层保留旧数据并聚合提示
      if (error instanceof CircuitOpenError) {
        return;
      }
      // 静默轮询接口的失败属于降级信号：不弹窗刷屏
      const silentPollPaths = ['/home/overview', '/user/inbox/unread-count'];
      if (
        silentPollPaths.some((path) =>
          String(error?.config?.url || '').includes(path),
        )
      ) {
        return;
      }
      // 这里可以根据业务进行定制,你可以拿到 error 内的信息进行定制化处理，根据不同的 code 做不同的提示，而不是直接使用 message.error 提示 msg
      // 当前mock接口返回的错误字段是 error 或者 message
      const responseData = error?.response?.data ?? {};
      const errorMessage = responseData?.error ?? responseData?.message ?? '';
      // 如果没有错误信息，则会根据状态码进行提示
      showErrorMessage(errorMessage || msg);
    }),
  );

  return client;
}

export const requestClient = createRequestClient(apiURL, {
  responseReturn: 'data',
});

export const baseRequestClient = new RequestClient({ baseURL: apiURL });

export interface PageFetchParams {
  [key: string]: any;
  pageNo?: number;
  pageSize?: number;
}
