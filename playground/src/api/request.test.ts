import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAccessStore } from '@vben/stores';

import { refreshTokenApi } from '#/api/core/auth';
import { publishRefreshToken } from '#/api/core/auth-refresh-broadcast';
import { restoreAccessTokenFromCookie } from '#/composables/use-auth-session';
import {
  clearAuthSessionHint,
  hasAuthSessionHint,
  markAuthSessionActive,
} from '#/utils/auth-session-hint';
import { advanceAuthSession } from '#/utils/auth-session-lifecycle';

import { baseRequestClient, requestClient } from './request';

const mocks = vi.hoisted(() => ({
  // Request imports precede initPreferences in the application.
  app: { enableRefreshToken: false, locale: 'zh-CN', loginExpiredMode: 'modal' },
  banned: vi.fn(),
  error: vi.fn(),
  logout: vi.fn(),
  notification: vi.fn(),
}));
vi.mock('@vben/hooks', () => ({ useAppConfig: () => ({ apiURL: '/api' }) }));
vi.mock('@vben/preferences', () => ({ preferences: { app: mocks.app } }));
vi.mock('#/locales', () => ({ $t: (key: string) => key }));
vi.mock('#/store', () => ({
  useAuthStore: () => ({
    logout: mocks.logout,
    terminateBannedSession: mocks.banned,
  }),
}));
vi.mock('ant-design-vue', () => ({
  message: { error: mocks.error },
  notification: { error: mocks.notification },
}));

function accessToken(expiresInSeconds: number) {
  const payload = btoa(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    uid: 7,
  })).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  return 'eyJhbGciOiJIUzI1NiJ9.' + payload + '.signature';
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function mockTransport(client: typeof requestClient) {
  const original = client.instance.defaults.adapter;
  const history = { get: [] as any[], post: [] as any[] };
  const reply =
    vi.fn<(config: any) => [number, unknown?] | Promise<[number, unknown?]>>();
  client.instance.defaults.adapter = async (config) => {
    history[config.method === 'post' ? 'post' : 'get'].push(config);
    const [status, data] = await reply(config);
    const response = { config, data, headers: {}, status, statusText: '' };
    if (status >= 400) {
      throw Object.assign(new Error(`HTTP ${status}`), { config, response });
    }
    return response;
  };
  return {
    history,
    reply,
    restore: () => {
      client.instance.defaults.adapter = original;
    },
  };
}

describe('application request session ownership', () => {
  let transport: ReturnType<typeof mockTransport>;
  let authTransport: ReturnType<typeof mockTransport>;

  beforeEach(() => {
    setActivePinia(createPinia());
    advanceAuthSession();
    localStorage.clear();
    vi.clearAllMocks();
    mocks.app.enableRefreshToken = true;
    mocks.app.loginExpiredMode = 'modal';
    const invalidate = async () => {
      advanceAuthSession();
      useAccessStore().$reset();
      clearAuthSessionHint();
    };
    mocks.logout.mockImplementation(invalidate);
    mocks.banned.mockImplementation(invalidate);
    useAccessStore().setAccessToken('original');
    useAccessStore().setIsAccessChecked(true);
    markAuthSessionActive();
    transport = mockTransport(requestClient);
    authTransport = mockTransport(baseRequestClient);
  });

  afterEach(() => {
    advanceAuthSession();
    transport.restore();
    authTransport.restore();
  });

  it('one refresh replays each current-session 401 once', async () => {
    const refresh = deferred<[number, unknown]>();
    authTransport.reply.mockImplementation(() => refresh.promise);
    transport.reply.mockImplementation((config) =>
      config.headers?.Authorization === 'Bearer renewed'
        ? [200, { code: 0, data: config.url }]
        : [401],
    );
    const first = requestClient.get('/first');
    const second = requestClient.get('/second');
    await vi.waitFor(() =>
      expect(requestClient.refreshTokenQueue).toHaveLength(1),
    );
    expect(authTransport.history.post).toHaveLength(1);
    refresh.resolve([200, { data: 'renewed' }]);
    await expect(Promise.all([first, second])).resolves.toEqual([
      '/first',
      '/second',
    ]);
    expect(useAccessStore().accessToken).toBe('renewed');
    expect(transport.history.get).toHaveLength(4);
  });

  it('renews even when a legacy UI preference disables refresh', async () => {
    mocks.app.enableRefreshToken = false;
    authTransport.reply.mockReturnValue([200, 'renewed']);
    transport.reply.mockImplementation((config) =>
      config.headers?.Authorization === 'Bearer renewed'
        ? [200, { code: 0, data: 'recovered' }]
        : [401],
    );
    await expect(requestClient.get('/legacy-preference')).resolves.toBe('recovered');
    expect(useAccessStore().accessToken).toBe('renewed');
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it('does not replay a rejected token from the recent refresh cache', async () => {
    const rejected = accessToken(30);
    const renewed = accessToken(3600);
    useAccessStore().setAccessToken(rejected);
    publishRefreshToken(rejected);
    authTransport.reply.mockReturnValue([200, renewed]);
    transport.reply.mockImplementation((config) =>
      config.headers?.Authorization === 'Bearer ' + renewed
        ? [200, { code: 0, data: 'recovered' }]
        : [401, { error: 'Unauthorized Exception' }],
    );

    await expect(requestClient.get('/rejected-cached-token')).resolves.toBe('recovered');
    expect(authTransport.history.post).toHaveLength(1);
    expect(useAccessStore().accessToken).toBe(renewed);
    expect(hasAuthSessionHint()).toBe(true);
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it('ignores an expired token delivered by a resumed background tab', async () => {
    useAccessStore().setAccessToken(accessToken(-300));
    publishRefreshToken(accessToken(-60));
    const renewed = accessToken(3600);
    authTransport.reply.mockReturnValue([200, renewed]);
    transport.reply.mockImplementation((config) =>
      config.headers?.Authorization === 'Bearer ' + renewed
        ? [200, { code: 0, data: 'recovered' }]
        : [401, { error: 'Unauthorized Exception' }],
    );

    await expect(requestClient.get('/resumed-tab')).resolves.toBe('recovered');
    expect(authTransport.history.post).toHaveLength(1);
    expect(useAccessStore().accessToken).toBe(renewed);
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it('replays a late old-token 401 with the already renewed token', async () => {
    const oldResponse = deferred<[number, unknown]>();
    useAccessStore().setAccessToken(accessToken(-60));
    transport.reply.mockImplementationOnce(() => oldResponse.promise);
    transport.reply.mockReturnValue([200, { code: 0, data: 'recovered' }]);
    const result = requestClient.get('/late-expiry');
    await vi.waitFor(() => expect(transport.history.get).toHaveLength(1));
    const renewed = accessToken(3600);
    useAccessStore().setAccessToken(renewed);
    authTransport.reply.mockReturnValue([503, { error: 'unavailable' }]);
    oldResponse.resolve([401, { error: 'Unauthorized Exception' }]);

    await expect(result).resolves.toBe('recovered');
    expect(authTransport.history.post).toHaveLength(0);
    expect(transport.history.get).toHaveLength(2);
    expect(transport.history.get[1].headers.Authorization).toBe('Bearer ' + renewed);
    expect(useAccessStore().accessToken).toBe(renewed);
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it('reports definitive refresh rejection once without the raw unauthorized exception', async () => {
    authTransport.reply.mockReturnValue([401, { error: 'Unauthorized Exception' }]);
    transport.reply.mockReturnValue([401, { error: 'Unauthorized Exception' }]);

    await Promise.allSettled([requestClient.get('/expired-session')]);

    expect(useAccessStore().accessToken).toBeNull();
    expect(useAccessStore().loginExpired).toBe(true);
    expect(hasAuthSessionHint()).toBe(false);
    expect(mocks.error).toHaveBeenCalledTimes(1);
    expect(mocks.error).toHaveBeenCalledWith('登录状态已失效，请重新登录');
  });

  it('logout rejects refresh waiters, clears the queue and never replays old requests', async () => {
    const refresh = deferred<[number, unknown]>();
    authTransport.reply.mockImplementation(() => refresh.promise);
    transport.reply.mockReturnValue([401]);
    const results = Promise.allSettled([
      requestClient.get('/first'),
      requestClient.get('/second'),
    ]);
    await vi.waitFor(() =>
      expect(requestClient.refreshTokenQueue).toHaveLength(1),
    );
    await mocks.logout();
    expect(requestClient.isRefreshing).toBe(false);
    expect(requestClient.refreshTokenQueue).toHaveLength(0);
    expect(
      (await results).every(
        (item) =>
          item.status === 'rejected' &&
          item.reason.code === 'AUTH_SESSION_INVALIDATED',
      ),
    ).toBe(true);
    refresh.resolve([200, { data: 'old-token' }]);
    await Promise.resolve();
    expect(useAccessStore().accessToken).toBeNull();
    expect(hasAuthSessionHint()).toBe(false);
    expect(transport.history.get).toHaveLength(2);
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it('new session requests for the same URL do not reuse old pending work', async () => {
    const oldResponse = deferred<[number, unknown]>();
    transport.reply.mockImplementationOnce(() => oldResponse.promise);
    transport.reply.mockReturnValue([200, { code: 0, data: 'new-result' }]);
    const oldResult = requestClient.get('/same').catch((error) => error);
    await vi.waitFor(() => expect(transport.history.get).toHaveLength(1));
    advanceAuthSession();
    useAccessStore().setAccessToken('new-login');
    markAuthSessionActive();
    await expect(requestClient.get('/same')).resolves.toBe('new-result');
    oldResponse.resolve([200, { code: 0, data: 'old-result' }]);
    await expect(oldResult).resolves.toMatchObject({
      code: 'AUTH_SESSION_INVALIDATED',
    });
    expect(useAccessStore().accessToken).toBe('new-login');
    expect(transport.history.get).toHaveLength(2);
  });

  it.each([401, 403])(
    'late old HTTP %s does not terminate the new login',
    async (status) => {
      const oldResponse = deferred<[number, unknown]>();
      transport.reply.mockImplementation(() => oldResponse.promise);
      const oldResult = requestClient.get('/old').catch((error) => error);
      await vi.waitFor(() => expect(transport.history.get).toHaveLength(1));
      advanceAuthSession();
      useAccessStore().setAccessToken('new-login');
      oldResponse.resolve([
        status,
        {
          data: {
            tag: 'ACCOUNT_BANNED',
            accountStatus: 'BANNED',
            resourceAccess: 'DENIED',
            banType: 'PERMANENT',
            permanent: true,
            banReason: 'old ban',
          },
        },
      ]);
      await expect(oldResult).resolves.toMatchObject({
        code: 'AUTH_SESSION_INVALIDATED',
      });
      expect(useAccessStore().accessToken).toBe('new-login');
      expect(mocks.logout).not.toHaveBeenCalled();
      expect(mocks.banned).not.toHaveBeenCalled();
      expect(mocks.notification).not.toHaveBeenCalled();
    },
  );

  it.each(['expiry', 'ban'])(
    '%s cancels real cookie restoration before a late refresh arrives',
    async (termination) => {
      useAccessStore().setAccessToken(null);
      const refresh = deferred<[number, unknown]>();
      authTransport.reply.mockImplementation(() => refresh.promise);
      const restoration = restoreAccessTokenFromCookie();
      await vi.waitFor(() =>
        expect(authTransport.history.post).toHaveLength(1),
      );
      if (termination === 'expiry') {
        transport.reply.mockReturnValue([401]);
        await Promise.allSettled([
          requestClient.get('/expired', { __isRetryRequest: true } as any),
        ]);
        expect(useAccessStore().loginExpired).toBe(true);
      } else {
        transport.reply.mockReturnValue([
          403,
          {
            data: {
              tag: 'ACCOUNT_BANNED',
              accountStatus: 'BANNED',
              resourceAccess: 'DENIED',
              banType: 'PERMANENT',
              permanent: true,
              banReason: 'banned',
            },
          },
        ]);
        await Promise.allSettled([requestClient.get('/banned')]);
        expect(mocks.banned).toHaveBeenCalledTimes(1);
      }
      await expect(restoration).resolves.toBe(false);
      expect(hasAuthSessionHint()).toBe(false);
      refresh.resolve([200, { data: 'late-token' }]);
      await Promise.resolve();
      expect(useAccessStore().accessToken).toBeNull();
    },
  );

  it('a transient refresh 503 preserves the current session', async () => {
    authTransport.reply.mockReturnValue([503, { error: 'unavailable' }]);
    transport.reply.mockReturnValue([401]);
    await Promise.allSettled([requestClient.get('/protected')]);
    expect(useAccessStore().accessToken).toBe('original');
    expect(hasAuthSessionHint()).toBe(true);
    expect(useAccessStore().loginExpired).toBe(false);
    expect(mocks.logout).not.toHaveBeenCalled();
  });

  it('does not automatically refresh without a token or hint', async () => {
    useAccessStore().$reset();
    clearAuthSessionHint();
    transport.reply.mockReturnValue([401]);
    await Promise.allSettled([requestClient.get('/anonymous')]);
    expect(authTransport.history.post).toHaveLength(0);
  });

  it('detaches an old refresh so a new session can refresh immediately', async () => {
    const oldResponse = deferred<[number, unknown]>();
    const newResponse = deferred<[number, unknown]>();
    authTransport.reply.mockImplementationOnce(() => oldResponse.promise);
    authTransport.reply.mockImplementation(() => newResponse.promise);
    const oldResult = refreshTokenApi().catch((error) => error);
    await vi.waitFor(() => expect(authTransport.history.post).toHaveLength(1));
    advanceAuthSession();
    useAccessStore().setAccessToken('new-login');
    const next = refreshTokenApi();
    await vi.waitFor(() => expect(authTransport.history.post).toHaveLength(2));
    oldResponse.resolve([200, { data: 'old-token' }]);
    await expect(oldResult).resolves.toMatchObject({
      code: 'AUTH_SESSION_INVALIDATED',
    });
    newResponse.resolve([200, { data: 'new-token' }]);
    await expect(next).resolves.toEqual({ data: 'new-token', status: 200 });
  });
});
