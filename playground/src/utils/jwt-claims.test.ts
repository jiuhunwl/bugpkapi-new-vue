import { describe, expect, it } from 'vitest';

import { accessTokenExpiresAt, readAuthTokenClaims } from './jwt-claims';

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

describe('jwt claims', () => {
  it('reads exp/uid/sub from a JWT payload', () => {
    const claims = readAuthTokenClaims(
      makeToken({ exp: 1_800_000_000, sub: 'alice', uid: 42 }),
    );
    expect(claims).toEqual({ exp: 1_800_000_000, sub: 'alice', uid: '42' });
    expect(accessTokenExpiresAt(makeToken({ exp: 1_800_000_000 }))).toBe(
      1_800_000_000_000,
    );
  });

  it('supports base64url payloads without padding', () => {
    const token = makeToken({ exp: 1_900_000_001, sub: '中文用户', uid: 7 });
    expect(token.split('.')[1]).not.toContain('=');
    expect(readAuthTokenClaims(token)?.sub).toBe('中文用户');
  });

  it('returns null for opaque or malformed tokens', () => {
    expect(readAuthTokenClaims(null)).toBeNull();
    expect(readAuthTokenClaims('')).toBeNull();
    expect(readAuthTokenClaims('opaque-token')).toBeNull();
    expect(readAuthTokenClaims('a.%%%.c')).toBeNull();
    expect(accessTokenExpiresAt('opaque-token')).toBeNull();
  });
});
