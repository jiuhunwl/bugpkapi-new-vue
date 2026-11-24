import { describe, expect, it } from 'vitest';

import type { PaymentConfigApi } from '#/api/system/payment';

import {
  normalizePaymentMethodsForSave,
  sortPaymentMethods,
} from './payment-methods';

describe('payment method ordering', () => {
  it('sorts methods by sortOrder and uses code as a stable tie breaker', () => {
    const methods: PaymentConfigApi.PaymentMethod[] = [
      { code: 'WECHAT', enabled: true, sortOrder: 20 },
      { code: 'ALIPAY', enabled: true, sortOrder: 10 },
      { code: 'BALANCE', enabled: true, sortOrder: 10 },
    ];

    expect(sortPaymentMethods(methods).map((item) => item.code)).toEqual([
      'ALIPAY',
      'BALANCE',
      'WECHAT',
    ]);
    expect(methods.map((item) => item.code)).toEqual([
      'WECHAT',
      'ALIPAY',
      'BALANCE',
    ]);
  });

  it('normalizes editable sort values without mutating the form state', () => {
    const methods = [
      { code: 'ALIPAY' as const, enabled: true, sortOrder: 12.9 },
      { code: 'WECHAT' as const, enabled: false, sortOrder: -4 },
      { code: 'BALANCE' as const, enabled: true, sortOrder: 2_000_001 },
    ];

    expect(normalizePaymentMethodsForSave(methods)).toEqual([
      { code: 'ALIPAY', enabled: true, sortOrder: 12 },
      { code: 'WECHAT', enabled: false, sortOrder: 0 },
      { code: 'BALANCE', enabled: true, sortOrder: 1_000_000 },
    ]);
    expect(methods[0]!.sortOrder).toBe(12.9);
  });
});
