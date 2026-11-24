import { describe, expect, it } from 'vitest';

import { resolveMarketPrice } from './market-price';

describe('resolveMarketPrice', () => {
  it('only treats an interface as free when both billing channels are zero', () => {
    expect(resolveMarketPrice(0, 0).free).toBe(true);
    expect(resolveMarketPrice(0, 10).free).toBe(false);
    expect(resolveMarketPrice(0.01, 0).free).toBe(false);
  });

  it('does not label malformed or negative prices as free', () => {
    expect(resolveMarketPrice('invalid', -1)).toEqual({
      free: false,
      moneyPrice: 0,
      pointPrice: 0,
    });
    expect(resolveMarketPrice(undefined, undefined).free).toBe(false);
  });

  it('accepts only canonical non-negative decimal price strings', () => {
    expect(resolveMarketPrice('0.0000', '0').free).toBe(true);

    for (const malformedZero of ['-0', '0x0', '0.', '.0', '00', '1e-1']) {
      expect(resolveMarketPrice(malformedZero, '0').free).toBe(false);
    }
    expect(resolveMarketPrice(-0, 0).free).toBe(false);
  });
});
