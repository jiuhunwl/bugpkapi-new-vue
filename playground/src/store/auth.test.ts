import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAccessStore, useUserStore } from '@vben/stores';

import {
  hasAuthSessionHint,
  markAuthSessionActive,
} from '#/utils/auth-session-hint';
import {
  advanceAuthSession,
  getAuthSessionGeneration,
} from '#/utils/auth-session-lifecycle';

import { useAuthStore } from './auth';

const mocks = vi.hoisted(() => ({
  codes: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
  user: vi.fn(),
  success: vi.fn(),
}));
vi.mock('#/api', () => ({
  getAccessCodesApi: mocks.codes,
  getUserInfoApi: mocks.user,
  loginApi: mocks.login,
  logoutApi: mocks.logout,
  registerApi: mocks.register,
}));
vi.mock('#/locales', () => ({ $t: (key: string) => key }));
vi.mock('@vben/preferences', () => ({
  preferences: { app: { defaultHomePath: '/home' } },
}));
vi.mock('ant-design-vue', () => ({ notification: { success: mocks.success } }));
vi.mock('vue-router', () => ({
  useRouter: () => ({
    currentRoute: { value: { fullPath: '/private', path: '/private' } },
    push: mocks.push,
    replace: mocks.replace,
  }),
}));
vi.mock('@vben/stores', async () => {
  const { getActivePinia } = await import('pinia');
  const { useAccessStore } =
    await import('../../../packages/stores/src/modules/access');
  const { useUserStore } =
    await import('../../../packages/stores/src/modules/user');
  return {
    useAccessStore,
    useUserStore,
    resetAllStores: () => {
      useAccessStore().$reset();
      useUserStore().$reset();
      const auth = (getActivePinia() as any)?._s.get('auth');
      auth?.$reset();
    },
  };
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, reject, resolve };
}

describe('auth store session ownership', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    advanceAuthSession();
    localStorage.clear();
    vi.resetAllMocks();
    mocks.codes.mockResolvedValue(['read']);
    mocks.user.mockResolvedValue({
      avatar: '',
      realName: 'New user',
      userId: '2',
      username: 'new',
      homePath: '/home',
    });
    mocks.login.mockResolvedValue({ accessToken: 'new-login' });
    mocks.register.mockResolvedValue({ accessToken: 'new-login' });
    useAccessStore().setAccessToken('old-login');
    markAuthSessionActive();
  });

  it.each(['success', 'failure'])(
    'clears state before the logout endpoint completes with %s',
    async (outcome) => {
      const endpoint = deferred<void>();
      mocks.logout.mockReturnValue(endpoint.promise);
      const generation = getAuthSessionGeneration();
      const logout = useAuthStore().logout();
      expect(useAccessStore().accessToken).toBeNull();
      expect(hasAuthSessionHint()).toBe(false);
      expect(getAuthSessionGeneration()).toBeGreaterThan(generation);
      await useAuthStore().logout();
      expect(mocks.logout).toHaveBeenCalledTimes(1);
      if (outcome === 'success') endpoint.resolve();
      else endpoint.reject(new Error('offline'));
      await logout;
      expect(useAccessStore().accessToken).toBeNull();
      expect(mocks.replace).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['success', 'failure'])(
    'old logout %s cannot clear or redirect a new login',
    async (outcome) => {
      const endpoint = deferred<void>();
      mocks.logout.mockReturnValue(endpoint.promise);
      const logout = useAuthStore().logout();
      await useAuthStore().authLogin({});
      if (outcome === 'success') endpoint.resolve();
      else endpoint.reject(new Error('offline'));
      await logout;
      expect(useAccessStore().accessToken).toBe('new-login');
      expect(hasAuthSessionHint()).toBe(true);
      expect(mocks.replace).not.toHaveBeenCalled();
    },
  );

  it('allows a newer session to log out while an old logout is pending', async () => {
    const oldEndpoint = deferred<void>();
    const newEndpoint = deferred<void>();
    mocks.logout
      .mockReturnValueOnce(oldEndpoint.promise)
      .mockReturnValueOnce(newEndpoint.promise);
    const oldLogout = useAuthStore().logout();
    await useAuthStore().authLogin({});
    const newLogout = useAuthStore().logout();
    oldEndpoint.resolve();
    await oldLogout;
    await useAuthStore().logout();
    expect(mocks.logout).toHaveBeenCalledTimes(2);
    newEndpoint.resolve();
    await newLogout;
    expect(useAccessStore().accessToken).toBeNull();
    expect(mocks.replace).toHaveBeenCalledTimes(1);
  });

  it('invalidates a banned session immediately', async () => {
    const generation = getAuthSessionGeneration();
    await useAuthStore().terminateBannedSession();
    expect(getAuthSessionGeneration()).toBeGreaterThan(generation);
    expect(useAccessStore().accessToken).toBeNull();
    expect(hasAuthSessionHint()).toBe(false);
  });

  it.each(['login', 'register'])(
    'rejects a late %s response after logout',
    async (method) => {
      const response = deferred<unknown>();
      if (method === 'login') {
        mocks.login.mockReturnValue(response.promise);
      } else {
        mocks.register.mockReturnValue(response.promise);
      }
      const auth = useAuthStore();
      const result = (
        method === 'login' ? auth.authLogin({}) : auth.authRegister({})
      ).catch((error) => error);
      await auth.logout();
      response.resolve({ accessToken: 'too-late' });
      await expect(result).resolves.toMatchObject({
        code: 'AUTH_SESSION_INVALIDATED',
      });
      expect(useAccessStore().accessToken).toBeNull();
      expect(hasAuthSessionHint()).toBe(false);
    },
  );

  it.each(['login', 'register', 'access-token'])(
    'late %s bootstrap cannot repopulate stores after logout',
    async (method) => {
      const user = deferred<unknown>();
      mocks.user.mockReturnValue(user.promise);
      const auth = useAuthStore();
      const pending =
        method === 'login'
          ? auth.authLogin({})
          : method === 'register'
            ? auth.authRegister({})
            : auth.authLoginByAccessToken('qq-token');
      const result = pending.catch((error) => error);
      await vi.waitFor(() => expect(mocks.user).toHaveBeenCalledTimes(1));
      await auth.logout();
      user.resolve({
        avatar: '',
        realName: 'Old user',
        userId: '1',
        username: 'old',
      });
      await expect(result).resolves.toMatchObject({
        code: 'AUTH_SESSION_INVALIDATED',
      });
      expect(useUserStore().userInfo).toBeNull();
      expect(useAccessStore().accessCodes).toEqual([]);
      expect(mocks.push).not.toHaveBeenCalled();
      expect(mocks.success).not.toHaveBeenCalled();
    },
  );
});
