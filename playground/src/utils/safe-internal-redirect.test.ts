import { describe, expect, it } from 'vitest';

import { safeInternalRedirect } from './safe-internal-redirect';

describe('safeInternalRedirect', () => {
  it.each([
    ['/console/workspace', '/console/workspace'],
    ['/console/workspace?tab=usage#today', '/console/workspace?tab=usage#today'],
    ['%2Fconsole%2Fworkspace', '/console/workspace'],
    ['%252Fconsole%252Fworkspace', '/console/workspace'],
  ])('accepts internal path %s', (input, expected) => {
    expect(safeInternalRedirect(input, '/fallback')).toBe(expected);
  });

  it.each([
    'https://evil.example',
    '//evil.example/path',
    '%2F%2Fevil.example/path',
    '%252F%252Fevil.example/path',
    'javascript:alert(1)',
    '/\\evil.example/path',
    '%2F%5Cevil.example/path',
    '/console/\u0000workspace',
    '/console/\u001fworkspace',
    '/console/\u007fworkspace',
    '%',
  ])('rejects unsafe redirect %s', (input) => {
    expect(safeInternalRedirect(input, '/fallback')).toBe('/fallback');
  });

  it('uses a known-safe root when the fallback is also unsafe', () => {
    expect(safeInternalRedirect('//evil.example', 'https://evil.example')).toBe(
      '/',
    );
  });
});
