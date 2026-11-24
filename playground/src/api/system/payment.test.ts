import { expect, it, vi } from 'vitest';
import { getRechargeAmountList } from './payment';
const get = vi.hoisted(() => vi.fn());
vi.mock('#/api/request', () => ({ requestClient: { get } }));
it('refreshes the derived credited amount when a preset changes', async () => {
  get.mockResolvedValueOnce({
    items: [
      { id: '7', amount: '20.00', giftAmount: '2.00', sortOrder: 1, status: 1 },
    ],
    total: 1,
  });
  get.mockResolvedValueOnce({
    items: [
      { id: '7', amount: '20.00', giftAmount: '5.00', sortOrder: 1, status: 1 },
    ],
    total: 1,
  });
  const before = await getRechargeAmountList({});
  const after = await getRechargeAmountList({});
  expect(before.items[0]?.creditAmount).toBe(22);
  expect(after.items[0]?.creditAmount).toBe(25);
  expect(after.items[0]?.sortNo).toBe(1);
});
