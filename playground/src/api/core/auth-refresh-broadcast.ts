import { onAuthSessionInvalidated } from '#/utils/auth-session-lifecycle';
import { readAuthTokenClaims } from '#/utils/jwt-claims';

/**
 * 多标签页刷新协调（尽力而为）：
 * - Web Locks 让同一浏览器的标签页排队刷新，避免同时消费同一个 refresh token；
 * - BroadcastChannel 把刚拿到的 access token 分享给其他标签页，等待者直接复用；
 * - 两者都不可用时退回单标签页刷新，后端轮换宽限窗口兜底。
 *
 * 这里不持久化 access token（只在本内存与同源 BroadcastChannel 中传递），
 * 不改变「access token 不落 localStorage」的既有安全约束。
 */
const CHANNEL_NAME = 'bugpk:auth-refresh';
const LOCK_NAME = 'bugpk:auth-refresh';
const SHARED_TOKEN_MAX_AGE_MS = 60_000;
export const LOCK_SETTLE_MS = 100;
const POLL_INTERVAL_MS = 20;

interface SharedToken {
  at: number;
  token: string;
  uid?: string;
}

interface LockManagerLike {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
}

let channel: BroadcastChannel | null = null;
let sharedToken: null | SharedToken = null;

function getChannel(): BroadcastChannel | null {
  if (channel) {
    return channel;
  }
  if (typeof BroadcastChannel === 'undefined') {
    return null;
  }
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent) => {
      const data = event.data as
        | null
        | undefined
        | { token?: unknown; type?: unknown; uid?: unknown };
      if (
        data?.type !== 'auth-refresh-token' ||
        typeof data.token !== 'string' ||
        !data.token
      ) {
        return;
      }
      sharedToken = {
        at: Date.now(),
        token: data.token,
        uid: typeof data.uid === 'string' ? data.uid : undefined,
      };
    };
    // Node（测试环境）下的 BroadcastChannel 会持有事件循环。
    (channel as BroadcastChannel & { unref?: () => void }).unref?.();
  } catch {
    channel = null;
  }
  return channel;
}

/** 提前订阅，空闲标签页也能收到其他标签页的刷新结果。 */
export function startAuthRefreshChannel() {
  getChannel();
}

function isSameUser(
  currentToken: null | string,
  candidateUid: string | undefined,
) {
  if (!currentToken || !candidateUid) {
    return false;
  }
  const currentUid = readAuthTokenClaims(currentToken)?.uid;
  return Boolean(currentUid && currentUid === candidateUid);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 取最近一次其他标签页刷新得到的 access token。只接受同一 uid 的令牌，
 * 避免同源不同账号的标签页互相串号；waitMs 用于等待锁切换瞬间的在途广播。
 */
export async function takeSharedRefreshToken(
  currentToken: null | string,
  waitMs = 0,
): Promise<null | string> {
  startAuthRefreshChannel();
  const deadline = Date.now() + Math.max(waitMs, 0);
  for (;;) {
    if (
      sharedToken &&
      Date.now() - sharedToken.at <= SHARED_TOKEN_MAX_AGE_MS &&
      isSameUser(currentToken, sharedToken.uid)
    ) {
      return sharedToken.token;
    }
    if (Date.now() >= deadline) {
      return null;
    }
    await sleep(POLL_INTERVAL_MS);
  }
}

export function publishRefreshToken(token: string) {
  if (!token) {
    return;
  }
  const uid = readAuthTokenClaims(token)?.uid;
  sharedToken = { at: Date.now(), token, uid };
  getChannel()?.postMessage({ type: 'auth-refresh-token', token, uid });
}

export async function withCrossTabRefreshLock<T>(
  task: (serialized: boolean) => Promise<T>,
): Promise<T> {
  const locks =
    typeof navigator === 'undefined'
      ? undefined
      : (navigator as unknown as { locks?: LockManagerLike }).locks;
  if (!locks || typeof locks.request !== 'function') {
    return task(false);
  }
  let started = false;
  try {
    return await locks.request(LOCK_NAME, async () => {
      started = true;
      return task(true);
    });
  } catch (error) {
    if (started) {
      throw error;
    }
    return task(false);
  }
}

const stopInvalidation = onAuthSessionInvalidated(() => {
  sharedToken = null;
});
import.meta.hot?.dispose(() => {
  stopInvalidation();
  channel?.close();
  channel = null;
  sharedToken = null;
});
