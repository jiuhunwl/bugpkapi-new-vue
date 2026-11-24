import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAccessStore } from '@vben/stores';

import { advanceAuthSession } from '#/utils/auth-session-lifecycle';

import { setupProactiveAuthRefresh } from './use-proactive-auth-refresh';

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock('#/api/core/auth', () => ({ refreshTokenApi: mocks.refresh }));
vi.mock('@vben/preferences', () => ({
  preferences: { app: { enableRefreshToken: false } },
}));

function encodeSegment(value: Record<string, unknown>) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

function makeToken(expiresAtMs: number, uid = 7) {
  return `${encodeSegment({ alg: 'HS256', typ: 'JWT' })}.${encodeSegment({
    exp: Math.floor(expiresAtMs / 1000),
    uid,
  })}.signature`;
}

function setVisibility(value: 'hidden' | 'visible') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value,
  });
}

describe('proactive auth refresh', () => {
  let teardown: (() => void) | undefined;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-04T00:00:00Z'));
    mocks.refresh.mockReset();
    setVisibility('visible');
    teardown = undefined;
  });

  afterEach(() => {
    teardown?.();
    vi.useRealTimers();
  });

  it('refreshes shortly before the access token expires', async () => {
    const now = Date.now();
    const token = makeToken(now + 30 * 60_000);
    const renewed = makeToken(now + 60 * 60_000);
    mocks.refresh.mockResolvedValue({ data: renewed, status: 200 });
    useAccessStore().setAccessToken(token);
    teardown = setupProactiveAuthRefresh();

    await vi.advanceTimersByTimeAsync(28 * 60_000 - 1_000);
    expect(mocks.refresh).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2_000);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(mocks.refresh).toHaveBeenCalledWith(token);
    expect(useAccessStore().accessToken).toBe(renewed);
  });

  it('defers hidden-tab refreshes until the tab becomes visible again', async () => {
    const now = Date.now();
    useAccessStore().setAccessToken(makeToken(now + 30 * 60_000));
    mocks.refresh.mockResolvedValue({
      data: makeToken(now + 60 * 60_000),
      status: 200,
    });
    setVisibility('hidden');
    teardown = setupProactiveAuthRefresh();

    await vi.advanceTimersByTimeAsync(29 * 60_000);
    expect(mocks.refresh).not.toHaveBeenCalled();

    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it('stops the timer when the session is invalidated', async () => {
    useAccessStore().setAccessToken(makeToken(Date.now() + 30 * 60_000));
    teardown = setupProactiveAuthRefresh();

    advanceAuthSession();
    await vi.advanceTimersByTimeAsync(30 * 60_000);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
