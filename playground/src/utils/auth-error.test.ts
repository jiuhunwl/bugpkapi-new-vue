import { describe, expect, it } from 'vitest';

import { isSessionDefinitivelyInvalid } from './auth-error';

function withStatus(status: number) {
  return Object.assign(new Error(`HTTP ${status}`), {
    response: { status },
  });
}

describe('isSessionDefinitivelyInvalid', () => {
  it('treats an explicit 401 from the refresh endpoint as a dead session', () => {
    expect(isSessionDefinitivelyInvalid(withStatus(401))).toBe(true);
  });

  it('keeps the session through transient transport and gateway failures', () => {
    expect(isSessionDefinitivelyInvalid(new Error('Network Error'))).toBe(
      false,
    );
    expect(isSessionDefinitivelyInvalid(undefined)).toBe(false);
    expect(isSessionDefinitivelyInvalid(withStatus(403))).toBe(false);
    expect(isSessionDefinitivelyInvalid(withStatus(429))).toBe(false);
    expect(isSessionDefinitivelyInvalid(withStatus(500))).toBe(false);
    expect(isSessionDefinitivelyInvalid(withStatus(502))).toBe(false);
    expect(isSessionDefinitivelyInvalid(withStatus(503))).toBe(false);
  });
});
