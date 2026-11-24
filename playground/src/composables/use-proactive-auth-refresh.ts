import { watch } from 'vue';

import { useAccessStore } from '@vben/stores';

import { refreshTokenApi } from '#/api/core/auth';
import { startAuthRefreshChannel } from '#/api/core/auth-refresh-broadcast';
import {
  getAuthSessionGeneration,
  isAuthSessionCurrent,
  onAuthSessionInvalidated,
} from '#/utils/auth-session-lifecycle';
import { accessTokenExpiresAt } from '#/utils/jwt-claims';

/**
 * access token 主动预刷：
 * - 到期前 2 分钟（短寿命令牌按 20% 寿命）提前续期，避免挂在后台的页面
 *   在真正发请求时才被动刷新；
 * - 标签页从后台恢复时补一次检查，覆盖浏览器节流导致的定时器延迟；
 * - 标签页隐藏时不做后台续期，保持「7 天不活动自然过期」的既有语义。
 * 刷新本身走 refreshTokenApi，已带同标签页去重与跨标签页协调。
 */
const REFRESH_LEAD_MS = 2 * 60 * 1000;
const MIN_DELAY_MS = 5_000;
const RETRY_DELAY_MS = 60_000;
const MAX_RETRIES = 2;

let installed = false;
let timer: null | ReturnType<typeof setTimeout> = null;
let retries = 0;

function clearTimer() {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}

function scheduleAt(delay: number) {
  clearTimer();
  timer = setTimeout(() => {
    void refreshNow();
  }, Math.max(delay, MIN_DELAY_MS));
}

function schedule(token: null | string) {
  clearTimer();
  retries = 0;
  if (!token) {
    return;
  }
  const expiresAt = accessTokenExpiresAt(token);
  if (expiresAt === null) {
    return;
  }
  const remaining = expiresAt - Date.now();
  if (remaining <= 0) {
    // 已经过期就交给被动 401 链路，避免和用户操作抢刷新。
    return;
  }
  const lead = Math.min(
    REFRESH_LEAD_MS,
    Math.max(remaining * 0.2, MIN_DELAY_MS),
  );
  scheduleAt(Math.max(remaining - lead, MIN_DELAY_MS));
}

async function refreshNow() {
  timer = null;
  if (
    typeof document !== 'undefined' &&
    document.visibilityState === 'hidden'
  ) {
    // 后台不续期；恢复可见时由 visibilitychange/focus 重新调度。
    return;
  }
  const accessStore = useAccessStore();
  const token = accessStore.accessToken;
  if (!token) {
    return;
  }
  const expiresAt = accessTokenExpiresAt(token);
  if (expiresAt !== null && expiresAt - Date.now() > REFRESH_LEAD_MS * 2) {
    // 定时器受系统休眠/校时影响提前触发时，重新按真实剩余寿命调度。
    schedule(token);
    return;
  }
  const generation = getAuthSessionGeneration();
  try {
    const result = await refreshTokenApi(token);
    if (!isAuthSessionCurrent(generation)) {
      return;
    }
    if (result.data) {
      accessStore.setAccessToken(result.data);
      schedule(result.data);
    }
  } catch {
    if (!isAuthSessionCurrent(generation)) {
      return;
    }
    if (retries >= MAX_RETRIES) {
      // 连续失败就停止主动预刷，下次用户操作仍走被动 401 → 刷新链路。
      return;
    }
    retries += 1;
    scheduleAt(RETRY_DELAY_MS);
  }
}

function wake() {
  if (document.visibilityState === 'hidden') {
    return;
  }
  const token = useAccessStore().accessToken;
  if (!token) {
    return;
  }
  const expiresAt = accessTokenExpiresAt(token);
  if (expiresAt === null) {
    return;
  }
  if (expiresAt - Date.now() <= REFRESH_LEAD_MS) {
    void refreshNow();
  } else if (timer === null) {
    schedule(token);
  }
}

export function setupProactiveAuthRefresh() {
  if (installed) {
    return;
  }
  installed = true;
  startAuthRefreshChannel();

  const accessStore = useAccessStore();
  const stopWatch = watch(
    () => accessStore.accessToken,
    (token) => schedule(token),
    { immediate: true },
  );

  document.addEventListener('visibilitychange', wake);
  window.addEventListener('focus', wake);

  const stopInvalidation = onAuthSessionInvalidated(() => {
    clearTimer();
    retries = 0;
  });

  const teardown = () => {
    stopWatch();
    document.removeEventListener('visibilitychange', wake);
    window.removeEventListener('focus', wake);
    stopInvalidation();
    clearTimer();
    installed = false;
  };
  import.meta.hot?.dispose(teardown);
  return teardown;
}
