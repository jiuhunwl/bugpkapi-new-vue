import { describe, expect, it } from 'vitest';

import {
  buildOnlineOrderPayload,
  enabledOnlinePaymentMethods,
  findRechargePresetId,
  supportsPayProductSelection,
} from './payment-routing';

describe('online payment routing', () => {
  it('uses native QR payment for desktop WeChat channels', () => {
    expect(
      buildOnlineOrderPayload('WECHAT', 'DESKTOP', 'AUTO'),
    ).toMatchObject({
      payChannel: 'WECHAT',
      product: 'NATIVE',
      tradeType: 'NATIVE',
    });
    expect(
      buildOnlineOrderPayload('HUPIJIAO_WECHAT', 'DESKTOP', 'AUTO'),
    ).toMatchObject({
      payChannel: 'HUPIJIAO_WECHAT',
      product: 'NATIVE',
      tradeType: 'NATIVE',
    });
  });

  it('uses H5 payment for mobile WeChat channels', () => {
    expect(
      buildOnlineOrderPayload('WECHAT', 'MOBILE', 'AUTO'),
    ).toMatchObject({
      payChannel: 'WECHAT',
      product: 'H5',
      tradeType: 'H5',
    });
    expect(
      buildOnlineOrderPayload('HUPIJIAO_WECHAT', 'MOBILE', 'WAP'),
    ).toMatchObject({
      payChannel: 'HUPIJIAO_WECHAT',
      product: 'H5',
      tradeType: 'H5',
    });
  });

  it('keeps Alipay product selection without adding a WeChat trade type', () => {
    expect(
      buildOnlineOrderPayload('ALIPAY', 'MOBILE', 'AUTO'),
    ).toEqual({
      payChannel: 'ALIPAY',
      product: 'WAP',
    });
    expect(
      buildOnlineOrderPayload('HUPIJIAO_ALIPAY', 'DESKTOP', 'PAGE'),
    ).toEqual({
      payChannel: 'HUPIJIAO_ALIPAY',
      product: 'PAGE',
    });
  });

  it('keeps only enabled online methods in configured order', () => {
    expect(
      enabledOnlinePaymentMethods([
        { code: 'HUPIJIAO_WECHAT', enabled: true, sortOrder: 40 },
        { code: 'BALANCE', enabled: true, sortOrder: 10 },
        { code: 'WECHAT', enabled: false, sortOrder: 20 },
        { code: 'HUPIJIAO_ALIPAY', enabled: true, sortOrder: 30 },
      ]),
    ).toEqual([
      { code: 'HUPIJIAO_ALIPAY', enabled: true, sortOrder: 30 },
      { code: 'HUPIJIAO_WECHAT', enabled: true, sortOrder: 40 },
    ]);
  });

  it('finds the recharge preset by its two-decimal money value', () => {
    const presets = [
      { amount: '10.00', giftAmount: '0', id: '11' },
      { amount: '50.0000', giftAmount: '5', id: '12' },
    ];

    expect(findRechargePresetId(presets, 50)).toBe('12');
    expect(findRechargePresetId(presets, '10.0')).toBe('11');
    expect(findRechargePresetId(presets, 20)).toBeUndefined();
  });

  it('shows product selection only for the official Alipay channel', () => {
    expect(supportsPayProductSelection('ALIPAY')).toBe(true);
    expect(supportsPayProductSelection('WECHAT')).toBe(false);
    expect(supportsPayProductSelection('HUPIJIAO_ALIPAY')).toBe(false);
    expect(supportsPayProductSelection('HUPIJIAO_WECHAT')).toBe(false);
  });
});
