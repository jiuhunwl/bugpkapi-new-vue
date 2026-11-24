import MockAdapter from 'axios-mock-adapter';
import { describe, expect, it, vi } from 'vitest';

import { authenticateResponseInterceptor } from './preset-interceptors';
import { RequestClient } from './request-client';

function deferred<T>() {
  let reject!: (reason?: any) => void;
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, reject, resolve };
}

function authenticatedClient(refresh: () => Promise<string>) {
  const client = new RequestClient();
  const reauthenticate = vi.fn(async () => {});
  client.addResponseInterceptor(
    authenticateResponseInterceptor({
      client,
      doReAuthenticate: reauthenticate,
      doRefreshToken: refresh,
      enableRefreshToken: true,
      formatToken: (token) => (token ? `Bearer ${token}` : null),
    }),
  );
  return { client, reauthenticate };
}

function authenticatedClientWithRefreshGuard(
  refresh: () => Promise<string>,
  shouldRefreshToken: (error: any) => boolean,
) {
  const client = new RequestClient();
  const reauthenticate = vi.fn(async () => {});
  client.addResponseInterceptor(
    authenticateResponseInterceptor({
      client,
      doReAuthenticate: reauthenticate,
      doRefreshToken: refresh,
      enableRefreshToken: true,
      formatToken: (token) => (token ? `Bearer ${token}` : null),
      shouldRefreshToken,
    }),
  );
  return { client, reauthenticate };
}

describe('authenticateResponseInterceptor', () => {
  it('does not refresh or reauthenticate on transient 503 errors', async () => {
    const doRefreshToken = vi.fn(async () => 'renewed');
    const { client, reauthenticate } = authenticatedClient(doRefreshToken);
    const mock = new MockAdapter(client.instance);
    mock.onGet('/protected').reply(503, {
      code: -1,
      error: '认证服务暂时不可用',
      message: '认证服务暂时不可用',
    });

    await expect(client.get('/protected')).rejects.toBeDefined();
    expect(doRefreshToken).not.toHaveBeenCalled();
    expect(reauthenticate).not.toHaveBeenCalled();
    expect(mock.history.get).toHaveLength(1);
  });

  it('preserves the session when queued refresh fails transiently', async () => {
    const refresh = deferred<string>();
    const doRefreshToken = vi.fn(() => refresh.promise);
    const { client, reauthenticate } = authenticatedClient(doRefreshToken);
    const mock = new MockAdapter(client.instance);
    mock.onGet('/first').reply(401);
    mock.onGet('/second').reply(401);

    const first = client.get('/first');
    const second = client.get('/second');
    await vi.waitFor(() => expect(doRefreshToken).toHaveBeenCalledTimes(1));
    refresh.reject({ response: { status: 503 } });

    const results = await Promise.allSettled([first, second]);
    expect(results.every((result) => result.status === 'rejected')).toBe(true);
    expect(mock.history.get).toHaveLength(2);
    expect(reauthenticate).not.toHaveBeenCalled();
  });

  it('reauthenticates after a terminal refresh rejection', async () => {
    const refresh = deferred<string>();
    const doRefreshToken = vi.fn(() => refresh.promise);
    const { client, reauthenticate } = authenticatedClient(doRefreshToken);
    const mock = new MockAdapter(client.instance);
    mock.onGet('/protected').reply(401);

    const request = client.get('/protected');
    await vi.waitFor(() => expect(doRefreshToken).toHaveBeenCalledTimes(1));
    refresh.reject({ response: { status: 401 } });

    const [result] = await Promise.allSettled([request]);
    expect(result?.status).toBe('rejected');
    expect(reauthenticate).toHaveBeenCalledTimes(1);
  });

  it('replays queued requests once with the refreshed token', async () => {
    const refresh = deferred<string>();
    const doRefreshToken = vi.fn(() => refresh.promise);
    const { client, reauthenticate } = authenticatedClient(doRefreshToken);
    const mock = new MockAdapter(client.instance);
    mock
      .onGet(/\/(first|second)/)
      .reply((config) =>
        config.headers?.Authorization === 'Bearer renewed'
          ? [200, { ok: true }]
          : [401],
      );

    const first = client.get('/first');
    const second = client.get('/second');
    await vi.waitFor(() => expect(doRefreshToken).toHaveBeenCalledTimes(1));
    refresh.resolve('renewed');

    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(mock.history.get).toHaveLength(4);
    expect(reauthenticate).not.toHaveBeenCalled();
  });

  it('does not call refresh when the session guard rejects it', async () => {
    const doRefreshToken = vi.fn(async () => 'renewed');
    const { client, reauthenticate } = authenticatedClientWithRefreshGuard(
      doRefreshToken,
      () => false,
    );
    const mock = new MockAdapter(client.instance);
    mock.onGet('/anonymous').reply(401);

    await expect(client.get('/anonymous')).rejects.toBeUndefined();
    expect(doRefreshToken).not.toHaveBeenCalled();
    expect(reauthenticate).toHaveBeenCalledTimes(1);
  });

  it('terminates a concurrent failed session only once', async () => {
    const doRefreshToken = vi.fn(async () => 'renewed');
    const { client, reauthenticate } = authenticatedClientWithRefreshGuard(
      doRefreshToken,
      () => false,
    );
    const mock = new MockAdapter(client.instance);
    mock.onGet(/\/expired-(first|second)/).reply(401);

    await Promise.allSettled([
      client.get('/expired-first'),
      client.get('/expired-second'),
    ]);

    expect(doRefreshToken).not.toHaveBeenCalled();
    expect(reauthenticate).toHaveBeenCalledTimes(1);
  });

  it('old refresh failure cannot reject or clear a newer refresh queue', async () => {
    const oldRefresh = deferred<string>();
    const newRefresh = deferred<string>();
    const doRefreshToken = vi
      .fn()
      .mockReturnValueOnce(oldRefresh.promise)
      .mockReturnValueOnce(newRefresh.promise);
    const { client, reauthenticate } = authenticatedClient(doRefreshToken);
    const mock = new MockAdapter(client.instance);
    mock.onGet('/old').reply(401);
    mock
      .onGet(/\/new-(first|second)/)
      .reply((config) =>
        config.headers?.Authorization === 'Bearer new-token' ? [200] : [401],
      );
    const oldResult = client.get('/old').catch((error) => error);
    await vi.waitFor(() => expect(doRefreshToken).toHaveBeenCalledTimes(1));
    client.refreshTokenQueue = [];
    client.isRefreshing = false;
    const newer = Promise.all([
      client.get('/new-first'),
      client.get('/new-second'),
    ]);
    await vi.waitFor(() => expect(client.refreshTokenQueue).toHaveLength(1));
    oldRefresh.reject({ response: { status: 401 } });
    await oldResult;
    expect(client.isRefreshing).toBe(true);
    expect(client.refreshTokenQueue).toHaveLength(1);
    expect(reauthenticate).not.toHaveBeenCalled();
    newRefresh.resolve('new-token');
    await expect(newer).resolves.toHaveLength(2);
  });

  it('new generation can reauthenticate while old logout is pending', async () => {
    let generation = 0;
    const oldLogout = deferred<void>();
    const reauthenticate = vi
      .fn()
      .mockReturnValueOnce(oldLogout.promise)
      .mockResolvedValue(undefined);
    const client = new RequestClient();
    client.addResponseInterceptor(
      authenticateResponseInterceptor({
        client,
        doReAuthenticate: reauthenticate,
        doRefreshToken: vi.fn(),
        enableRefreshToken: false,
        formatToken: (token) => token,
        getSessionGeneration: () => generation,
      }),
    );
    const mock = new MockAdapter(client.instance);
    mock.onGet(/\/(old|new)/).reply(401);
    const oldResult = client.get('/old').catch((error) => error);
    await vi.waitFor(() => expect(reauthenticate).toHaveBeenCalledTimes(1));
    generation++;
    await Promise.allSettled([client.get('/new')]);
    expect(reauthenticate).toHaveBeenCalledTimes(2);
    oldLogout.resolve();
    await oldResult;
  });
});
