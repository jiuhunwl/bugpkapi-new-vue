import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAccessStore } from '@vben/stores';

import {
  hasAuthSessionHint,
  markAuthSessionActive,
} from '#/utils/auth-session-hint';
import { advanceAuthSession } from '#/utils/auth-session-lifecycle';

import { restoreAccessTokenFromCookie } from './use-auth-session';

const { refresh, app } = vi.hoisted(() => ({
  // Legacy UI preferences do not control the server session policy.
  app: { enableRefreshToken: false },
  refresh: vi.fn(),
}));
vi.mock('#/api/core/auth', () => ({ refreshTokenApi: refresh }));
vi.mock('@vben/preferences', () => ({ preferences: { app } }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, reject, resolve };
}

describe('cookie restoration session ownership', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    advanceAuthSession();
    localStorage.clear();
    refresh.mockReset();
  });

  it('does not refresh without a local session hint', async () => {
    await expect(restoreAccessTokenFromCookie()).resolves.toBe(false);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('restores a current hinted session despite a cached refresh opt-out', async () => {
    markAuthSessionActive();
    refresh.mockResolvedValue({ data: 'restored' });
    await expect(restoreAccessTokenFromCookie()).resolves.toBe(true);
    expect(useAccessStore().accessToken).toBe('restored');
    expect(hasAuthSessionHint()).toBe(true);
  });

  it('does not restore a terminated session from a late response', async () => {
    const response = deferred<unknown>();
    markAuthSessionActive();
    refresh.mockReturnValue(response.promise);
    const restoration = restoreAccessTokenFromCookie();
    advanceAuthSession();
    localStorage.clear();
    response.resolve({ data: 'old-token' });

    await expect(restoration).resolves.toBe(false);
    expect(useAccessStore().accessToken).toBeNull();
    expect(hasAuthSessionHint()).toBe(false);
  });

  it.each(['success', 'failure'])(
    'old %s cannot alter a newer login',
    async (outcome) => {
      const response = deferred<unknown>();
      markAuthSessionActive();
      refresh.mockReturnValue(response.promise);
      const restoration = restoreAccessTokenFromCookie();
      advanceAuthSession();
      useAccessStore().setAccessToken('new-login');
      markAuthSessionActive();
      if (outcome === 'success') response.resolve({ data: 'old-token' });
      else response.reject(new Error('expired'));

      await expect(restoration).resolves.toBe(false);
      expect(useAccessStore().accessToken).toBe('new-login');
      expect(hasAuthSessionHint()).toBe(true);
    },
  );

  it('keeps the session hint when the refresh fails transiently', async () => {
    markAuthSessionActive();
    refresh.mockRejectedValue(
      Object.assign(new Error('gateway unavailable'), {
        response: { status: 503 },
      }),
    );

    await expect(restoreAccessTokenFromCookie()).resolves.toBe(false);
    // 后端重启/网关抖动不该把还在有效期内的会话抹掉，下一次导航还能自愈。
    expect(hasAuthSessionHint()).toBe(true);
  });

  it('clears the session hint when the refresh token is rejected', async () => {
    markAuthSessionActive();
    refresh.mockRejectedValue(
      Object.assign(new Error('unauthorized'), { response: { status: 401 } }),
    );

    await expect(restoreAccessTokenFromCookie()).resolves.toBe(false);
    expect(hasAuthSessionHint()).toBe(false);
  });
});
