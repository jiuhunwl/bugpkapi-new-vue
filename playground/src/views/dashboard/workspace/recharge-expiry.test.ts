import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ts from 'typescript';
import { ref } from 'vue';

import workspaceSource from './index.vue?raw';

// Exercise the component's actual payment functions without mounting its
// unrelated charts, advertisements, drawers and dashboard network requests.
function paymentHarness() {
  const names = [
    'stopRechargePolling', 'stopRechargeCountdown', 'rechargeRemainingSeconds',
    'startRechargeCountdown', 'startRechargePolling', 'syncCurrentRechargeOrder',
    'submitTrc20Payment',
  ];
  const source = workspaceSource.split('<script lang="ts" setup>')[1]!.split('</script>')[0]!;
  const parsed = ts.createSourceFile('workspace.ts', source, ts.ScriptTarget.Latest, true);
  const functions = parsed.statements.filter((node) =>
    ts.isFunctionDeclaration(node) && names.includes(node.name?.text ?? ''),
  ).map((node) => node.getText(parsed)).join('\n');
  const state = {
    rechargeOrder: ref<any>({ orderNo: 'trc20-order', payChannel: 'TRC20', status: 'CREATED', remainingSeconds: 1 }),
    rechargeCountdownSeconds: ref(0), rechargeExpired: ref(false), rechargePaid: ref(false),
    rechargeSyncLoading: ref(false), trc20Submitting: ref(false), trc20Txid: ref('a'.repeat(64)),
    syncRechargeOrder: vi.fn(), submitTrc20TxID: vi.fn(), refreshWorkbenchStats: vi.fn(),
    message: { success: vi.fn(), warning: vi.fn(), info: vi.fn() }, $t: (key: string) => key,
    isChainDepositChannel: (channel: string | undefined) =>
      ['TRC20', 'BEP20'].includes(String(channel ?? '').toUpperCase()),
  };
  const compiled = ts.transpileModule(functions, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const methods = new Function(...Object.keys(state), 'window', `let rechargeTimer, rechargeCountdownTimer; ${compiled}; return {${names.join(',')}};`)(...Object.values(state), window);
  return { ...state, ...methods };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe('recharge payment expiry', () => {
  it.each(['poll', 'txid'])('keeps a confirmed payment paid after its old deadline (%s)', async (method) => {
    const h = paymentHarness();
    const paid = { ...h.rechargeOrder.value, status: 'PAID', remainingSeconds: 0 };
    h.syncRechargeOrder.mockResolvedValue(paid);
    h.submitTrc20TxID.mockResolvedValue(paid);
    h.startRechargeCountdown(h.rechargeOrder.value);
    if (method === 'poll') await h.syncCurrentRechargeOrder();
    else await h.submitTrc20Payment();
    await vi.advanceTimersByTimeAsync(2000);
    expect(h.rechargeOrder.value.status).toBe('PAID');
    expect(h.rechargeExpired.value).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps checking a TRC20 receipt after the payment deadline and accepts late confirmation', async () => {
    const h = paymentHarness();
    const expired = { ...h.rechargeOrder.value, status: 'EXPIRED', remainingSeconds: 0 };
    h.syncRechargeOrder.mockResolvedValueOnce(expired).mockResolvedValueOnce({ ...expired, status: 'PAID' });
    h.startRechargeCountdown(h.rechargeOrder.value);
    h.startRechargePolling(h.rechargeOrder.value.orderNo);
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.rechargeOrder.value.status).toBe('CREATED');
    expect(h.rechargeExpired.value).toBe(true);
    await vi.advanceTimersByTimeAsync(5000);
    expect(h.syncRechargeOrder).toHaveBeenCalledTimes(2);
    expect(h.rechargeOrder.value.status).toBe('PAID');
    expect(h.rechargeExpired.value).toBe(false);
  });
});
