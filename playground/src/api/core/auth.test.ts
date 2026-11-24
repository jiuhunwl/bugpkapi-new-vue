import { beforeEach, describe, expect, it, vi } from 'vitest';

import { advanceAuthSession } from '#/utils/auth-session-lifecycle';

import { refreshTokenApi } from './auth';

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('#/api/request', () => ({
  baseRequestClient: { instance: { post } },
  requestClient: {},
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, reject, resolve };
}

describe('refreshTokenApi session ownership', () => {
  beforeEach(() => {
    advanceAuthSession();
    post.mockReset();
  });

  it.each(['token', { code: 0, data: 'token' }])(
    'deduplicates refresh and retains the Cookie contract for %j',
    async (data) => {
      const response = deferred<{ data: unknown; status: number }>();
      post.mockReturnValue(response.promise);
      const first = refreshTokenApi();
      const second = refreshTokenApi();

      await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));
      expect(post).toHaveBeenCalledWith('/auth/refresh', null, {
        signal: expect.any(AbortSignal),
        withCredentials: true,
      });
      response.resolve({ data, status: 200 });
      await expect(Promise.all([first, second])).resolves.toEqual([
        { data: 'token', status: 200 },
        { data: 'token', status: 200 },
      ]);
    },
  );

  it('immediately rejects all waiters and aborts even if transport ignores abort', async () => {
    const response = deferred<unknown>();
    post.mockReturnValue(response.promise);
    const first = refreshTokenApi();
    const second = refreshTokenApi();
    const results = Promise.allSettled([first, second]);
    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const signal = post.mock.calls[0]![2].signal;

    advanceAuthSession();

    expect(signal.aborted).toBe(true);
    expect(await results).toEqual([
      {
        reason: expect.objectContaining({ code: 'AUTH_SESSION_INVALIDATED' }),
        status: 'rejected',
      },
      {
        reason: expect.objectContaining({ code: 'AUTH_SESSION_INVALIDATED' }),
        status: 'rejected',
      },
    ]);
    response.resolve({ data: 'old-token', status: 200 });
  });

  it('old cleanup and late failure cannot detach a newer pending refresh', async () => {
    const oldResponse = deferred<unknown>();
    const newResponse = deferred<unknown>();
    post
      .mockReturnValueOnce(oldResponse.promise)
      .mockReturnValueOnce(newResponse.promise);
    const oldResult = refreshTokenApi().catch((error) => error);
    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    advanceAuthSession();
    const next = refreshTokenApi();

    await expect(oldResult).resolves.toMatchObject({
      code: 'AUTH_SESSION_INVALIDATED',
    });
    oldResponse.reject({ response: { status: 401 } });
    const shared = refreshTokenApi();
    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    newResponse.resolve({ data: { data: 'new-token' }, status: 200 });
    await expect(Promise.all([next, shared])).resolves.toEqual([
      { data: 'new-token', status: 200 },
      { data: 'new-token', status: 200 },
    ]);
  });
});
