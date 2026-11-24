import { describe, expect, it, vi } from 'vitest';

import {
  refreshSettlementCurrency,
  useSettlementCurrency,
} from './use-settlement-currency';

const mocks = vi.hoisted(() => ({
  getRechargeCapabilities: vi.fn(),
  getSiteCurrency: vi.fn(),
}));

vi.mock('#/api/payment', () => ({
  getRechargeCapabilities: mocks.getRechargeCapabilities,
  getSiteCurrency: mocks.getSiteCurrency,
}));

describe('settlement currency', () => {
  it('converts CNY-base amounts with the configured rate', async () => {
    mocks.getSiteCurrency.mockResolvedValue({
      currency: 'USD',
      usdCnyRate: '7.2000',
    });
    await refreshSettlementCurrency();

    const { fromCNY, priceText, symbol, toCNY } = useSettlementCurrency();
    expect(symbol.value).toBe('$');
    expect(fromCNY(72)).toBe(10);
    expect(fromCNY(0.72, 4)).toBe(0.1);
    expect(toCNY(10)).toBe(72);
    expect(priceText(72)).toBe('$10');
  });

  it('picks up a changed rate on refresh (dynamic rate)', async () => {
    mocks.getSiteCurrency.mockResolvedValue({
      currency: 'USD',
      usdCnyRate: '7.0000',
    });
    await refreshSettlementCurrency();

    expect(useSettlementCurrency().fromCNY(70)).toBe(10);
  });

  it('falls back to the authenticated capabilities endpoint for older backends', async () => {
    mocks.getSiteCurrency.mockRejectedValue(new Error('404'));
    mocks.getRechargeCapabilities.mockResolvedValue({
      currency: 'CNY',
      displayName: '积分',
      usdCnyRate: '7.2000',
    });
    await refreshSettlementCurrency();

    const { currency, symbol } = useSettlementCurrency();
    expect(currency.value).toBe('CNY');
    expect(symbol.value).toBe('¥');
    expect(useSettlementCurrency().priceText(50)).toBe('50 积分');
  });

  it('renames the currency globally without changing the amount', async () => {
    mocks.getSiteCurrency.mockResolvedValue({
      currency: 'CNY',
      displayName: ' 赞助额度 ',
    });
    await refreshSettlementCurrency();

    const { name, priceText, symbol } = useSettlementCurrency();
    expect(name.value).toBe('赞助额度');
    // 展示名称只换称呼，符号仍代表真实货币（支付实付等场景继续使用）。
    expect(symbol.value).toBe('¥');
    expect(priceText(50)).toBe('50 赞助额度');
    expect(priceText(0.5)).toBe('0.50 赞助额度');
  });

  it('clears the display name when the config omits it', async () => {
    mocks.getSiteCurrency.mockResolvedValue({ currency: 'CNY' });
    await refreshSettlementCurrency();

    expect(useSettlementCurrency().priceText(50)).toBe('¥50');
  });
});
