import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick } from 'vue';

import ContinuePayModal from './continue-pay-modal.vue';

const api = vi.hoisted(() => ({ continue: vi.fn(), sync: vi.fn(), submit: vi.fn() }));
vi.mock('#/api/payment', () => ({ continuePaymentOrder: api.continue, syncRechargeOrder: api.sync, submitTrc20TxID: api.submit }));
vi.mock('#/locales', () => ({ $t: (key: string) => key }));
vi.mock('#/utils/alipay-form', () => ({ submitAlipayForm: vi.fn() }));
vi.mock('../data', () => ({ formatOrderMoney: (value: string) => value, statusColor: {}, statusLabel: (value: string) => value }));
vi.mock('ant-design-vue', async () => {
  const { defineComponent, h } = await import('vue');
  const block = defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) });
  return { Modal: block, Spin: block, Tag: block, QRCode: block,
    Button: defineComponent({ setup: (_, { slots, attrs }) => () => h('button', attrs, slots.default?.()) }),
    Input: defineComponent({ props: ['value'], emits: ['update:value'], setup: (props, { emit }) => () => h('input', { value: props.value, onInput: (e: Event) => emit('update:value', (e.target as HTMLInputElement).value) }) }),
    message: { success: vi.fn(), error: vi.fn() },
  };
});

let unmount: (() => void) | undefined;
const pending = { orderNo: 'trc20-order', payChannel: 'TRC20', status: 'CREATED', chainAddress: 'T-test-receiving-address', chainAmount: '10.030000', remainingSeconds: 1 };
async function open() {
  const container = document.createElement('div');
  document.body.append(container);
  const app = createApp(ContinuePayModal);
  app.config.globalProperties.$t = (key: string) => key;
  const component = app.mount(container) as unknown as { open: (row: any) => Promise<void> };
  unmount = () => app.unmount();
  await component.open(pending);
  await nextTick();
  return container;
}
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); api.continue.mockResolvedValue({ ...pending }); });
afterEach(() => { unmount?.(); unmount = undefined; document.body.innerHTML = ''; vi.clearAllTimers(); vi.useRealTimers(); });

describe('TRC20 receipt checks after expiry', () => {
  it('hides transfer instructions but keeps the TxID form and polls until payment is confirmed', async () => {
    api.sync.mockResolvedValueOnce({ ...pending, status: 'EXPIRED', remainingSeconds: 0 })
      .mockResolvedValueOnce({ ...pending, status: 'PAID', remainingSeconds: 0 });
    const container = await open();
    expect(container.textContent).toContain(pending.chainAddress);
    await vi.advanceTimersByTimeAsync(1000);
    await nextTick();
    expect(container.textContent).not.toContain(pending.chainAddress);
    expect(container.textContent).not.toContain(pending.chainAmount);
    expect(container.querySelector('input')).not.toBeNull();
    await vi.advanceTimersByTimeAsync(5000);
    expect(api.sync).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('paymentOrder.continuePay.paidTip');
  });

  it('reopens an expired order for TxID verification without showing transfer instructions', async () => {
    api.continue.mockResolvedValue({ ...pending, status: 'EXPIRED', remainingSeconds: 0 });
    api.submit.mockResolvedValue({ ...pending, status: 'PAID' });
    const container = await open();
    expect(container.textContent).not.toContain(pending.chainAddress);
    const input = container.querySelector('input')!;
    expect(input).not.toBeNull();
    input.value = 'a'.repeat(64);
    input.dispatchEvent(new Event('input'));
    await nextTick();
    [...container.querySelectorAll('button')].find((button) => button.textContent === 'paymentOrder.continuePay.trc20Submit')!.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(api.submit).toHaveBeenCalledWith(pending.orderNo, 'a'.repeat(64));
    expect(container.textContent).toContain('paymentOrder.continuePay.paidTip');
  });
});
