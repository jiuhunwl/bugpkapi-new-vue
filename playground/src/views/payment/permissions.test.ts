import { describe, expect, it, vi } from 'vitest';

import { useColumns as usePresetColumns } from './amount/data';
import { useOrderColumns } from './order/data';
import adminOrderPage from './order/index.vue?raw';
import userOrderPage from './order/user.vue?raw';

// 操作列的 show 既可能是布尔（按权限），也可能是按行的函数（按状态/渠道），
// 断言可见动作时必须按具体订单求值，否则函数恒为真值会把隐藏的动作也算进去。
function visibleOrderActions(columns: any[], row: Record<string, any>) {
  const operation = columns.find((column) => column?.field === 'operation');
  return (((operation?.cellRender?.options ?? []) as any[])).filter((option) => {
    const { show } = option;
    return typeof show === 'function' ? Boolean(show(row)) : Boolean(show);
  }).map((option) => option.code);
}

const cancelledOrder = { payChannel: 'HUPIJIAO_WECHAT', status: 'CANCELLED' };
const endedOrder = { payChannel: 'ALIPAY', status: 'EXPIRED' };
const payableOrder = { payChannel: 'ALIPAY', status: 'CREATED' };

describe('payment management permissions', () => {
  it('removes recharge preset actions without update or delete permission', () => {
    const columns =
      usePresetColumns(vi.fn(), { delete: false, update: false }) ?? [];
    expect(columns.some((column) => column?.field === 'operation')).toBe(false);
  });

  it('shows only the granted recharge preset action', () => {
    const columns =
      usePresetColumns(vi.fn(), { delete: true, update: false }) ?? [];
    const operation = columns.find((column) => column?.field === 'operation');
    const visible = ((operation as any)?.cellRender?.options ?? [])
      .filter((option: any) => option.show)
      .map((option: any) => option.code);
    expect(visible).toEqual(['delete']);
  });

  it('does not add administrator order actions without permission', () => {
    const columns =
      useOrderColumns(
        true,
        { detail: false, sync: false },
        vi.fn(),
      ) ?? [];
    expect(columns.some((column) => column?.field === 'operation')).toBe(false);
  });

  it('separates order detail and synchronization permissions', () => {
    const columns =
      useOrderColumns(
        true,
        { detail: true, sync: false },
        vi.fn(),
      ) ?? [];
    expect(visibleOrderActions(columns, payableOrder)).toEqual(['detail']);
  });

  it('keeps user order pages free from administrator operations', () => {
    const columns = useOrderColumns(false) ?? [];
    expect(columns.some((column) => column?.field === 'operation')).toBe(false);
  });

  it('gives users payment actions without exposing synchronization', () => {
    const columns =
      useOrderColumns(
        false,
        { cancel: true, continue: true, delete: true },
        vi.fn(),
      ) ?? [];
    // 待支付：可继续、可取消；已结束：只剩删除。任何一行都不应出现同步/详情。
    expect(visibleOrderActions(columns, payableOrder)).toEqual([
      'continue',
      'cancel',
    ]);
    expect(visibleOrderActions(columns, endedOrder)).toEqual(['delete']);
  });

  it('blocks cancelling USDT orders because on-chain matching relies on the amount', () => {
    const columns =
      useOrderColumns(
        false,
        { cancel: true, continue: true, delete: true },
        vi.fn(),
      ) ?? [];
    expect(visibleOrderActions(columns, { ...payableOrder, payChannel: 'TRC20' })).toEqual([
      'continue',
    ]);
  });

  it('keeps expired TRC20 receipt verification available without reopening other channels', () => {
    const columns = useOrderColumns(false, { cancel: true, continue: true, delete: true }, vi.fn()) ?? [];
    const expiredTrc20 = { ...endedOrder, payChannel: 'TRC20' };
    expect(visibleOrderActions(columns, expiredTrc20)).toEqual(['continue', 'delete']);
    expect(visibleOrderActions(columns, endedOrder)).toEqual(['delete']);
    const operation = columns.find((column) => column?.field === 'operation');
    const action = ((operation as any)?.cellRender?.options ?? []).find((option: any) => option.code === 'continue');
    expect(typeof action.text).toBe('function');
    expect(action.text(expiredTrc20)).not.toBe(action.text(payableOrder));
  });

  it('keeps synchronization for administrators and adds deletion', () => {
    const columns =
      useOrderColumns(
        true,
        { delete: true, sync: true },
        vi.fn(),
      ) ?? [];
    // 已取消的订单渠道侧支付串仍可用，管理员必须还能查单。
    expect(visibleOrderActions(columns, cancelledOrder)).toEqual([
      'sync',
      'delete',
    ]);
    expect(visibleOrderActions(columns, endedOrder)).toEqual(['sync', 'delete']);
  });

  it('reports order sync with payment wording instead of Alipay config wording', () => {
    // 「支付宝配置校验通过」是支付配置页的文案，订单同步借用它会让运维误判。
    expect(adminOrderPage).not.toContain('system.payment.validateSuccess');
    expect(adminOrderPage).toContain('paymentOrder.confirm.syncSuccess');
    expect(userOrderPage).not.toContain('syncPaymentOrder');
  });
});
