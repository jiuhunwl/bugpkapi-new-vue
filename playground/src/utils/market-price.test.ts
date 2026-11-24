import { describe, expect, it } from 'vitest';

import { formatMarketMoney, isMarketPriceFree } from './market-price';

describe('isMarketPriceFree', () => {
  it('requires both money and point prices to be zero', () => {
    expect(isMarketPriceFree(0, 0)).toBe(true);
    expect(isMarketPriceFree('0.0000', '0')).toBe(true);
    expect(isMarketPriceFree(0, 10)).toBe(false);
    expect(isMarketPriceFree(0.01, 0)).toBe(false);
  });

  it('does not treat missing or malformed prices as free', () => {
    expect(isMarketPriceFree(undefined, undefined)).toBe(false);
    expect(isMarketPriceFree('invalid', 0)).toBe(false);
    expect(isMarketPriceFree('-0', '0')).toBe(false);
  });

  it('treats a null or missing point price as no point billing when money is zero', () => {
    // 首页热门接口后端把可空的 point_price 直接下发为 null
    expect(isMarketPriceFree('0.0000', null)).toBe(true);
    expect(isMarketPriceFree(0, null)).toBe(true);
    expect(isMarketPriceFree(0, undefined)).toBe(true);
    expect(isMarketPriceFree(0, 'invalid')).toBe(true);
    expect(isMarketPriceFree(0, 1)).toBe(false);
    expect(isMarketPriceFree('invalid', null)).toBe(false);
  });
});

describe('formatMarketMoney', () => {
  it('trims trailing zeros from decimal(12,4) money strings', () => {
    expect(formatMarketMoney('0.0000')).toBe('0');
    expect(formatMarketMoney('1.0000')).toBe('1');
    expect(formatMarketMoney('1.5000')).toBe('1.5');
    expect(formatMarketMoney('12.3456')).toBe('12.3456');
    expect(formatMarketMoney(2)).toBe('2');
  });

  it('groups thousands and passes malformed values through untouched', () => {
    expect(formatMarketMoney('12345.6789')).toBe('12,345.6789');
    expect(formatMarketMoney(undefined)).toBe('');
    expect(formatMarketMoney('invalid')).toBe('invalid');
  });
});
