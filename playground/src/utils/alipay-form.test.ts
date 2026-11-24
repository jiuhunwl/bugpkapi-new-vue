// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { resolveAlipaySubmission } from './alipay-form';

describe('resolveAlipaySubmission', () => {
  it('accepts structured parameters for the official production gateway', () => {
    expect(
      resolveAlipaySubmission({
        formActionUrl: 'https://openapi.alipay.com/gateway.do',
        formParams: { app_id: '123', sign: 'signed-value' },
      }),
    ).toEqual({
      action: 'https://openapi.alipay.com/gateway.do',
      params: { app_id: '123', sign: 'signed-value' },
    });
  });

  it('extracts the backend generated form without executing its script', () => {
    const result = resolveAlipaySubmission({
      payForm:
        '<form action="https://openapi-sandbox.dl.alipaydev.com/gateway.do" method="post"><input type="hidden" name="app_id" value="123"><input type="hidden" name="sign" value="abc"></form><script>window.hacked=true</script>',
    });
    expect(result).toEqual({
      action: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
      params: { app_id: '123', sign: 'abc' },
    });
    expect((window as unknown as { hacked?: boolean }).hacked).toBeUndefined();
  });

  it.each([
    'https://evil.example/gateway.do',
    'https://openapi.alipay.com.evil.example/gateway.do',
    'https://user:pass@openapi.alipay.com/gateway.do',
    'https://openapi.alipay.com/gateway.do?next=evil',
    'javascript:alert(1)',
  ])('rejects an untrusted form action %s', (action) => {
    expect(
      resolveAlipaySubmission({
        formActionUrl: action,
        formParams: { app_id: '123', sign: 'abc' },
      }),
    ).toBeNull();
  });

  it('rejects duplicate fields and active form controls', () => {
    expect(
      resolveAlipaySubmission({
        payForm:
          '<form action="https://openapi.alipay.com/gateway.do" method="post"><input type="hidden" name="sign" value="a"><input type="hidden" name="sign" value="b"></form>',
      }),
    ).toBeNull();
    expect(
      resolveAlipaySubmission({
        payForm:
          '<form action="https://openapi.alipay.com/gateway.do" method="post"><input type="text" name="sign" value="a"></form>',
      }),
    ).toBeNull();
  });
});

