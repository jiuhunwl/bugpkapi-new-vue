import { useAccessStore } from '@vben/stores';

import { refreshTokenApi } from '#/api/core/auth';
import { isSessionDefinitivelyInvalid } from '#/utils/auth-error';
import {
  clearAuthSessionHint,
  hasAuthSessionHint,
  markAuthSessionActive,
} from '#/utils/auth-session-hint';
import {
  getAuthSessionGeneration,
  isAuthSessionCurrent,
} from '#/utils/auth-session-lifecycle';

export async function restoreAccessTokenFromCookie() {
  const accessStore = useAccessStore();
  if (accessStore.accessToken) {
    markAuthSessionActive();
    return true;
  }
  if (!hasAuthSessionHint()) {
    return false;
  }

  const generation = getAuthSessionGeneration();
  return refreshTokenApi(accessStore.accessToken)
    .then((resp) => {
      const token = resp.data;
      if (!token || !isAuthSessionCurrent(generation)) {
        return false;
      }
      accessStore.setAccessToken(token);
      accessStore.setLoginExpired(false);
      markAuthSessionActive();
      return true;
    })
    .catch((error: unknown) => {
      // 只有刷新接口明确判定 refresh token 失效（401）才丢弃会话标记。
      // 后端重启、网关 5xx、网络中断时保留标记，下次导航/刷新还能自愈，
      // 不再把一次抖动放大成「被踢回登录页」。
      if (
        isAuthSessionCurrent(generation) &&
        isSessionDefinitivelyInvalid(error)
      ) {
        clearAuthSessionHint();
      }
      return false;
    });
}

export async function restoreHintedAccessTokenFromCookie() {
  if (!hasAuthSessionHint()) {
    return false;
  }
  return restoreAccessTokenFromCookie();
}
