import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn } from '#/adapter/vxe-table';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { PaymentOrderApi } from '#/api/system/payment';

import { isChainDepositChannel } from '#/api/payment-routing';
import { formatSettlementPrice, settlementDisplayName } from '#/composables/use-settlement-currency';
import { $t } from '#/locales';
// 注意：label 需要 $t 动态求值，必须导出工厂函数而非模块级常量，
// 否则语言切换后（组件重挂载）仍会读到首次加载时固化的文案。
export const orderTypeTabs: () => Array<{ label: string; value: 'ALL' | PaymentOrderApi.OrderType }> = () => [{ label: $t('paymentOrder.types.all'), value: 'ALL' }, { label: $t('paymentOrder.types.recharge'), value: 'RECHARGE' }, { label: $t('paymentOrder.types.global'), value: 'GLOBAL_PACKAGE' }, { label: $t('paymentOrder.types.interface'), value: 'INTERFACE_PACKAGE' }, { label: $t('paymentOrder.types.point'), value: 'POINT_PACKAGE' }];
export const orderTypeOptions = () => orderTypeTabs().filter((item) => item.value !== 'ALL');
export const statusOptions = () => [{ label: $t('paymentOrder.status.created'), value: 'CREATED' }, { label: $t('paymentOrder.status.paying'), value: 'PAYING' }, { label: $t('paymentOrder.status.paid'), value: 'PAID' }, { label: $t('paymentOrder.status.failed'), value: 'FAILED' }, { label: $t('paymentOrder.status.closed'), value: 'CLOSED' }, { label: $t('paymentOrder.status.expired'), value: 'EXPIRED' }, { label: $t('paymentOrder.status.cancelled'), value: 'CANCELLED' }];
export const orderTypeColor: Record<PaymentOrderApi.OrderType, string> = { GLOBAL_PACKAGE: 'blue', INTERFACE_PACKAGE: 'processing', POINT_PACKAGE: 'cyan', RECHARGE: 'green' };
export const statusColor: Record<PaymentOrderApi.OrderStatus, string> = { CANCELLED: 'default', CLOSED: 'default', CREATED: 'warning', EXPIRED: 'default', FAILED: 'error', PAID: 'success', PAYING: 'processing' };
export function orderTypeLabel(value?: string) { return orderTypeOptions().find((item) => item.value === value)?.label || $t('paymentOrder.order'); }
export function statusLabel(value?: string) { return statusOptions().find((item) => item.value === value)?.label || $t('paymentOrder.unknown'); }
// 已结束订单在渠道侧不会再产出新的支付结果，同步对它们没有意义（后端同样按 409 拒绝）。
// CANCELLED 例外：取消只是本地动作，虎皮椒/微信的旧支付串仍然可用，管理员需要能查单确认。
const syncableOrderStatuses = new Set<PaymentOrderApi.OrderStatus>(['CANCELLED', 'CREATED', 'EXPIRED', 'PAYING']);
export function isSyncableOrder(status?: PaymentOrderApi.OrderStatus) { return !!status && syncableOrderStatuses.has(status); }
// 可继续支付：后端只对 CREATED/PAYING 返回支付载荷（过期会先置 EXPIRED 再报 409）。
export function isContinuableOrder(row: PaymentOrderApi.PaymentOrder) { return row.status === 'CREATED' || row.status === 'PAYING'; }
// 可核验到账：链上充值订单过期后仍可凭交易哈希继续核对，后端 ContinueOrder 对这两种链放行。
export function isReceiptVerifiableOrder(row: PaymentOrderApi.PaymentOrder) { return row.status === 'EXPIRED' && isChainDepositChannel(row.payChannel); }
// 可取消：链上充值靠精确金额在链上认单，取消会让金额复用规则变模糊，后端直接拒绝。
export function isCancellableOrder(row: PaymentOrderApi.PaymentOrder) { return isContinuableOrder(row) && !isChainDepositChannel(row.payChannel); }
// 可删除：与后端 SoftDeleteOrder 的状态白名单一致；已支付的是资金凭证，不可删。
const deletableOrderStatuses = new Set<PaymentOrderApi.OrderStatus>(['CANCELLED', 'CLOSED', 'EXPIRED', 'FAILED']);
export function isDeletableOrder(status?: PaymentOrderApi.OrderStatus) { return !!status && deletableOrderStatuses.has(status); }
// 订单金额按本单落库的结算货币显示；存量订单无 currency 字段时按 CNY 兜底。
// 后台配置了货币展示名称时，订单金额也统一改用该名称（真实数值不变）。
const ORDER_CURRENCY_SYMBOLS: Record<string, string> = { CNY: '¥', USD: '$' };
export function formatOrderMoney(value?: number | string, currency?: string) {
  const amount = Number(value ?? 0).toFixed(2);
  const displayName = settlementDisplayName();
  if (displayName) {
    return `${amount} ${displayName}`;
  }
  const symbol = ORDER_CURRENCY_SYMBOLS[String(currency ?? 'CNY').toUpperCase()] ?? '¥';
  return `${symbol}${amount}`;
}
export function useOrderGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: { placeholder: $t('paymentOrder.searchPlaceholder') },
      fieldName: 'keyword',
      label: $t('paymentOrder.fields.keyword'),
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: statusOptions() },
      fieldName: 'status',
      label: $t('paymentOrder.fields.status'),
    },
    {
      component: 'DatePicker',
      componentProps: {
        allowClear: true,
        class: 'w-full',
        placeholder: $t('paymentOrder.filters.dateFrom'),
        valueFormat: 'YYYY-MM-DD',
      },
      fieldName: 'paidFrom',
      label: $t('paymentOrder.fields.paidTime'),
    },
    {
      component: 'DatePicker',
      componentProps: {
        allowClear: true,
        class: 'w-full',
        placeholder: $t('paymentOrder.filters.dateTo'),
        valueFormat: 'YYYY-MM-DD',
      },
      fieldName: 'paidTo',
      label: $t('paymentOrder.fields.paidTime'),
    },
    {
      component: 'InputNumber',
      componentProps: {
        min: 0,
        placeholder: $t('paymentOrder.filters.minAmount'),
        precision: 2,
      },
      fieldName: 'minAmount',
      label: $t('paymentOrder.fields.amount'),
    },
    {
      component: 'InputNumber',
      componentProps: {
        min: 0,
        placeholder: $t('paymentOrder.filters.maxAmount'),
        precision: 2,
      },
      fieldName: 'maxAmount',
      label: $t('paymentOrder.fields.amount'),
    },
  ];
}
export interface PaymentOrderActionPermissions {
  cancel: boolean;
  continue: boolean;
  delete: boolean;
  detail: boolean;
  sync: boolean;
}
const hiddenActions: PaymentOrderActionPermissions = { cancel: false, continue: false, delete: false, detail: false, sync: false };
export function useOrderColumns(
  showUser: boolean,
  permissions: Partial<PaymentOrderActionPermissions> = hiddenActions,
  onActionClick?: OnActionClickFn<PaymentOrderApi.PaymentOrder>,
): VxeTableGridColumns<PaymentOrderApi.PaymentOrder> {
  const actions = { ...hiddenActions, ...permissions };
  const columns: VxeTableGridColumns<PaymentOrderApi.PaymentOrder> = [{ field: 'orderNo', minWidth: 210, title: $t('paymentOrder.fields.orderNo') }];
  if (showUser) columns.push({ field: 'username', minWidth: 140, title: $t('paymentOrder.fields.user') });
  columns.push({ field: 'orderType', slots: { default: 'orderType' }, title: $t('paymentOrder.fields.type'), width: 120 }, { field: 'subject', minWidth: 190, title: $t('paymentOrder.fields.subject') }, { field: 'payAmount', formatter: ({ cellValue, row }) => formatOrderMoney(cellValue, row.currency), sortable: true, title: $t('paymentOrder.fields.amount'), width: 120 }, { field: 'giftAmount', formatter: ({ cellValue, row }) => row.orderType === 'RECHARGE' && Number(cellValue ?? 0) > 0 ? formatSettlementPrice(cellValue) : '-', title: $t('paymentOrder.fields.gift'), width: 120 }, { field: 'status', slots: { default: 'status' }, sortable: true, title: $t('paymentOrder.fields.status'), width: 110 }, { field: 'alipayTradeNo', minWidth: 180, title: $t('paymentOrder.fields.tradeNo') }, { field: 'chainTxid', minWidth: 180, title: $t('paymentOrder.fields.chainTxid') }, { field: 'paidTime', sortable: true, title: $t('paymentOrder.fields.paidTime'), width: 180 }, { field: 'createTime', sortable: true, title: $t('paymentOrder.fields.createTime'), width: 180 });
  if ((actions.detail || actions.sync || actions.continue || actions.cancel || actions.delete) && onActionClick) {
    // 单元格操作按行动态显隐：同一时刻最多两到三个按钮，列宽按授予的动作数给。
    const actionCount = [actions.detail, actions.sync, actions.continue, actions.cancel, actions.delete].filter(Boolean).length;
    columns.push({
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'orderNo',
          nameTitle: $t('paymentOrder.fields.orderNo'),
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: [
          { code: 'detail', show: actions.detail, text: $t('system.interface.viewDetail') },
          { code: 'continue', show: (row: PaymentOrderApi.PaymentOrder) => actions.continue && (isContinuableOrder(row) || isReceiptVerifiableOrder(row)), text: (row: PaymentOrderApi.PaymentOrder) => isReceiptVerifiableOrder(row) ? $t('paymentOrder.action.verifyTxid') : $t('paymentOrder.action.continue') },
          { code: 'sync', show: (row: PaymentOrderApi.PaymentOrder) => actions.sync && isSyncableOrder(row.status), text: $t('paymentOrder.action.sync') },
          { code: 'cancel', show: (row: PaymentOrderApi.PaymentOrder) => actions.cancel && isCancellableOrder(row), text: $t('paymentOrder.action.cancel') },
          { code: 'delete', show: (row: PaymentOrderApi.PaymentOrder) => actions.delete && isDeletableOrder(row.status), text: $t('paymentOrder.action.delete') },
        ],
      },
      field: 'operation',
      fixed: 'right',
      title: $t('system.key.operation'),
      width: 40 + actionCount * 60,
    });
  }
  return columns;
}
