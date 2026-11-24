import { beforeEach, describe, expect, it, vi } from 'vitest';

import { advanceAuthSession } from '#/utils/auth-session-lifecycle';

import {
  publishRefreshToken,
  takeSharedRefreshToken,
  withCrossTabRefreshLock,
} from './auth-refresh-broadcast';

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

function makeToken(payload: Record<string, unknown>) {
  return `${encodeSegment({ alg: 'HS256', typ: 'JWT' })}.${encodeSegment(payload)}.signature`;
}

function currentToken(uid: number, expiresInSeconds = 3600) {
  return makeToken({ exp: Math.floor(Date.now() / 1000) + expiresInSeconds, uid });
}

describe('auth refresh broadcast', () => {
  beforeEach(() => {
    // Session change clears the module-level shared token between tests.
    advanceAuthSession();
  });

  it('shares a refreshed token between tabs of the same user only', async () => {
    const token = currentToken(7);
    publishRefreshToken(token);

    await expect(takeSharedRefreshToken(currentToken(7, -60))).resolves.toBe(token);
    await expect(takeSharedRefreshToken(currentToken(8))).resolves.toBeNull();
    await expect(takeSharedRefreshToken(null)).resolves.toBeNull();
  });

  it('does not treat the current token as a renewal', async () => {
    const token = currentToken(7);
    publishRefreshToken(token);
    await expect(takeSharedRefreshToken(token)).resolves.toBeNull();
  });

  it('does not replace a newer token with a delayed older broadcast', async () => {
    publishRefreshToken(currentToken(7, 600));
    await expect(takeSharedRefreshToken(currentToken(7, 3600))).resolves.toBeNull();
  });

  it('rejects a freshly received but already expired shared token', async () => {
    publishRefreshToken(currentToken(7, -1));
    await expect(takeSharedRefreshToken(currentToken(7, -60))).resolves.toBeNull();
  });

  it('rejects shared tokens without an expiry', async () => {
    publishRefreshToken(makeToken({ uid: 7 }));
    await expect(takeSharedRefreshToken(currentToken(7, -60))).resolves.toBeNull();
  });

  it('ignores the shared token after the session changes', async () => {
    publishRefreshToken(currentToken(7));
    advanceAuthSession();

    await expect(takeSharedRefreshToken(currentToken(7, -60))).resolves.toBeNull();
  });

  it('expires shared tokens after a minute', async () => {
    vi.useFakeTimers();
    try {
      publishRefreshToken(currentToken(7));
      vi.setSystemTime(Date.now() + 61_000);
      await expect(takeSharedRefreshToken(currentToken(7, -60))).resolves.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('serializes refreshes through web locks when available', async () => {
    const events: string[] = [];
    let active = 0;
    let maxActive = 0;
    const locks = {
      async request<T>(_name: string, callback: () => Promise<T>): Promise<T> {
        while (active > 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        active += 1;
        maxActive = Math.max(maxActive, active);
        try {
          return await callback();
        } finally {
          active -= 1;
        }
      },
    };
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: locks,
    });
    try {
      const task = (label: string, delay: number) =>
        withCrossTabRefreshLock(async (serialized) => {
          expect(serialized).toBe(true);
          events.push(`${label}-start`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          events.push(`${label}-end`);
          return label;
        });

      const results = await Promise.all([
        task('first', 10),
        task('second', 1),
      ]);
      expect(results).toEqual(['first', 'second']);
      expect(maxActive).toBe(1);
      expect(events).toEqual([
        'first-start',
        'first-end',
        'second-start',
        'second-end',
      ]);
    } finally {
      Reflect.deleteProperty(navigator, 'locks');
    }
  });

  it('falls back to direct execution without web locks', async () => {
    const value = await withCrossTabRefreshLock(async (serialized) => {
      expect(serialized).toBe(false);
      return 'direct';
    });
    expect(value).toBe('direct');
  });
});
