import { describe, expect, it } from 'vitest';

import { resolveOfficialQqAuthorizeUrl } from './qq-oauth-url';

describe('resolveOfficialQqAuthorizeUrl', () => {
  it('accepts official HTTPS OAuth endpoints', () => {
    expect(
      resolveOfficialQqAuthorizeUrl(
        'https://graph.qq.com/oauth2.0/authorize?client_id=123&state=abc',
      ),
    ).toBe(
      'https://graph.qq.com/oauth2.0/authorize?client_id=123&state=abc',
    );
  });

  it.each([
    'javascript:alert(1)',
    'http://graph.qq.com/oauth2.0/authorize',
    'https://graph.qq.com.evil.example/oauth2.0/authorize',
    'https://user:pass@graph.qq.com/oauth2.0/authorize',
    'https://graph.qq.com/oauth2.0/authorize#payload',
  ])('rejects unsafe authorization URL %s', (url) => {
    expect(resolveOfficialQqAuthorizeUrl(url)).toBeNull();
  });
});
