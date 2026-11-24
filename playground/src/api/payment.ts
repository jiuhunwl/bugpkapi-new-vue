import type { PaymentOrderApi } from '#/api/system/payment';

import { requestClient } from '#/api/request';

import { buildOnlineOrderPayload } from './payment-routing';
import { purchaseRequestConfig } from './purchase-idempotency';

export namespace RechargeApi {
  export type ClientType = 'AUTO' | 'DESKTOP' | 'MOBILE';
  export type PayProduct = 'AUTO' | 'FACE' | 'NATIVE' | 'PAGE' | 'WAP';
  export type PayChannel =
    | 'ALIPAY'
    | 'BALANCE'
    | 'BEP20'
    | 'HUPIJIAO_ALIPAY'
    | 'HUPIJIAO_WECHAT'
    | 'TRC20'
    | 'WECHAT';

  export interface PaymentMethod {
    code: PayChannel;
    enabled: boolean;
    sortOrder: number;
  }
  export type RechargeStatus =
    | 'CANCELLED'
    | 'CLOSED'
    | 'CREATED'
    | 'EXPIRED'
    | 'FAILED'
    | 'PAID'
    | 'PAYING'
    | 'PENDING';

  export interface RechargeAmountOption {
    amount: number | string;
    giftAmount: number | string;
    id: string;
    name?: string;
    sortNo?: number;
  }

  export interface Capabilities {
    alipayEnabled?: boolean;
    amountOptions?: RechargeAmountOption[];
    // 站点结算货币（后台货币设置），CNY 缺省。
    currency?: 'CNY' | 'USD';
    /** 用户端货币展示名称（如积分、赞助额度）；空=按结算货币显示 ¥/$。 */
    displayName?: string;
    defaultPayChannel?: Exclude<PayChannel, 'BALANCE'>;
    desktopDefault: Exclude<PayProduct, 'AUTO'>;
    enabled: boolean;
    facePayEnabled: boolean;
    methods?: PaymentMethod[];
    mobileDefault: Exclude<PayProduct, 'AUTO'>;
    presets?: RechargeAmountOption[];
    products?: string[];
    // TRC20/USDT 链上充值（海外站）：未启用时前端不展示该方式。
    trc20Address?: string;
    trc20Confirmations?: number;
    trc20Enabled?: boolean;
    trc20MaxAmount?: string;
    trc20MinAmount?: string;
    trc20Network?: string;
    // BEP20/USDT 链上充值（BSC），与 TRC20 并列。
    bep20Address?: string;
    bep20Confirmations?: number;
    bep20Enabled?: boolean;
    bep20MaxAmount?: string;
    bep20MinAmount?: string;
    bep20Network?: string;
    // 美元结算时的汇率（1 USD = X CNY），展示换算用。
    usdCnyRate?: string;
    wapPayEnabled: boolean;
    websitePayEnabled: boolean;
    wechatEnabled?: boolean;
    wechatNativePayEnabled?: boolean;
  }

  export interface CreateOrderPayload {
    amount?: number | string;
    clientType?: ClientType;
    forceNew?: boolean;
    payChannel?: Exclude<PayChannel, 'BALANCE'>;
    preferredProduct?: PayProduct;
    presetId?: number | string;
  }

  export interface RechargeOrder {
    amount?: number | string;
    /** 链上收款信息（TRC20/BEP20）。 */
    chainAddress?: string;
    chainAmount?: number | string;
    chainConfirmCount?: number;
    chainTxid?: string;
    creditAmount?: number | string;
    /** 本单结算货币；存量订单无该字段时按 CNY。 */
    currency?: 'CNY' | 'USD';
    expireTime?: string;
    formActionUrl?: string;
    formHtml?: null | string;
    formParams?: Record<string, string>;
    gatewayUrl?: string;
    giftAmount?: number | string;
    orderNo: string;
    /** USD 结算时的人民币原价（余额按人民币口径入账）。 */
    originAmount?: number | string;
    paidTime?: string;
    payAmount?: number | string;
    payChannel: Exclude<PayChannel, 'BALANCE'>;
    payForm?: null | string;
    paymentUrl?: null | string;
    payProduct: Exclude<PayProduct, 'AUTO'>;
    product?: string;
    qrCode?: null | string;
    remainingSeconds?: number;
    status: RechargeStatus;
    tradeNo?: string;
  }

  export interface PackageOrderPayload {
    clientType?: ClientType;
    forceNew?: boolean;
    payChannel: PayChannel;
    preferredProduct?: PayProduct;
    specId?: string;
  }

  export type PendingOrderType =
    | 'GLOBAL_PACKAGE'
    | 'INTERFACE_PACKAGE'
    | 'POINT_PACKAGE'
    | 'RECHARGE';

  export interface PendingOrderQuery {
    orderType: PendingOrderType;
    targetId: number | string;
  }

  export interface PackagePaymentOrder extends Omit<RechargeOrder, 'payChannel' | 'payProduct'> {
    opened?: boolean;
    payChannel: PayChannel;
    payProduct: 'BALANCE' | Exclude<PayProduct, 'AUTO'>;
  }
}

function normalizeCapabilities(item: RechargeApi.Capabilities) {
  const products = item.products ?? [];
  const presets = item.presets ?? item.amountOptions ?? [];
  const hasConfiguredMethods = Array.isArray(item.methods);
  const methods = hasConfiguredMethods
    ? (item.methods ?? [])
        .filter((method) => method.enabled)
        .sort((left, right) => left.sortOrder - right.sortOrder)
    : [];
  const defaultOnlineMethod = methods.find(
    (method): method is RechargeApi.PaymentMethod & {
      code: Exclude<RechargeApi.PayChannel, 'BALANCE'>;
    } => method.code !== 'BALANCE',
  );
  const onlineEnabled = hasConfiguredMethods
    ? methods.some((method) => method.code !== 'BALANCE')
    : Boolean(item.alipayEnabled || item.wechatEnabled);
  return {
    ...item,
    amountOptions: presets.map((preset) => ({
      ...preset,
      sortNo: preset.sortNo ?? 0,
    })),
    defaultPayChannel:
      defaultOnlineMethod?.code ??
      item.defaultPayChannel ??
      (item.alipayEnabled ? 'ALIPAY' : undefined),
    desktopDefault: products.includes('PAGE') ? 'PAGE' : 'FACE',
    enabled: onlineEnabled,
    facePayEnabled: products.includes('FACE'),
    mobileDefault: products.includes('WAP') ? 'WAP' : 'PAGE',
    wapPayEnabled: products.includes('WAP'),
    websitePayEnabled: products.includes('PAGE'),
    methods: hasConfiguredMethods ? methods : undefined,
    wechatEnabled: hasConfiguredMethods
      ? methods.some(
          (method) =>
            method.code === 'WECHAT' || method.code === 'HUPIJIAO_WECHAT',
        )
      : item.wechatEnabled,
    wechatNativePayEnabled: hasConfiguredMethods
      ? methods.some(
          (method) =>
            method.code === 'WECHAT' || method.code === 'HUPIJIAO_WECHAT',
        )
      : item.wechatNativePayEnabled,
  } satisfies RechargeApi.Capabilities;
}

function normalizeOrder(
  item: Partial<RechargeApi.PackagePaymentOrder> & { payUrl?: null | string },
): RechargeApi.PackagePaymentOrder {
  const product = (item.product || item.payProduct || 'PAGE') as Exclude<
    RechargeApi.PayProduct,
    'AUTO'
  >;
  const currency =
    String(item.currency ?? 'CNY').toUpperCase() === 'USD' ? 'USD' : 'CNY';
  const payAmount = item.payAmount ?? item.amount ?? '0';
  // 余额按人民币口径记账：USD 订单的实付是换算后的美元，到账金额要用
  // 下单时留档的 originAmount（人民币原价）+ 人民币赠金。
  const creditBase =
    currency === 'USD' ? (item.originAmount ?? payAmount) : payAmount;
  return {
    ...item,
    orderNo: item.orderNo || '',
    amount: item.amount ?? payAmount,
    creditAmount:
      item.creditAmount ?? Number(creditBase) + Number(item.giftAmount ?? 0),
    currency,
    formActionUrl: item.formActionUrl ?? item.gatewayUrl ?? '',
    formParams: item.formParams ?? {},
    gatewayUrl: item.gatewayUrl ?? '',
    payAmount,
    payChannel: item.payChannel || 'ALIPAY',
    payForm: item.payForm ?? item.formHtml ?? null,
    payProduct: product,
    paymentUrl: item.paymentUrl ?? item.payUrl ?? null,
    product,
    qrCode: item.qrCode ?? null,
    remainingSeconds: item.remainingSeconds ?? 0,
    status: item.status || 'CREATED',
  };
}

export interface SiteCurrencyConfig {
  currency: 'CNY' | 'USD';
  /** 用户端货币展示名称（如积分、赞助额度）；空=按结算货币显示 ¥/$。 */
  displayName?: string;
  usdCnyRate?: string;
}

/** 公开只读的站点货币与汇率（未登录页面也可用）。 */
async function getSiteCurrency() {
  return requestClient.get<SiteCurrencyConfig>('/payment/currency');
}

function paidBalancePurchase(): RechargeApi.PackagePaymentOrder {
  return {
    orderNo: '',
    payAmount: '0',
    payChannel: 'BALANCE',
    payProduct: 'BALANCE',
    status: 'PAID',
  };
}

async function getRechargeCapabilities() {
  const result = await requestClient.get<RechargeApi.Capabilities>(
    '/payment/recharge/capabilities',
  );
  return normalizeCapabilities(result);
}

async function createRechargeOrder(data: RechargeApi.CreateOrderPayload) {
  const payChannel = data.payChannel ?? 'ALIPAY';
  const result = await requestClient.post<RechargeApi.RechargeOrder>(
    '/payment/recharge/orders',
    {
      forceNew: Boolean(data.forceNew),
      presetId: Number(data.presetId ?? 0),
      ...buildOnlineOrderPayload(
        payChannel,
        data.clientType ?? 'AUTO',
        data.preferredProduct ?? 'AUTO',
      ),
    },
  );
  return normalizeOrder(result) as RechargeApi.RechargeOrder;
}

async function getRechargeOrder(orderNo: string) {
  const result = await requestClient.get<RechargeApi.RechargeOrder>(
    `/payment/recharge/orders/${orderNo}`,
  );
  return normalizeOrder(result) as RechargeApi.RechargeOrder;
}

async function syncRechargeOrder(orderNo: string) {
  const result = await requestClient.post<RechargeApi.RechargeOrder>(
    `/payment/recharge/orders/${orderNo}/sync`,
    {},
  );
  return normalizeOrder(result) as RechargeApi.RechargeOrder;
}

async function findPendingPaymentOrder(params: RechargeApi.PendingOrderQuery) {
  const result = await requestClient.get<null | RechargeApi.PackagePaymentOrder>(
    '/payment/orders/pending',
    { params },
  );
  return result?.orderNo ? normalizeOrder(result) : null;
}

async function continuePaymentOrder(orderNo: string) {
  const result = await requestClient.post<RechargeApi.PackagePaymentOrder>(
    `/payment/orders/${orderNo}/continue`,
    {},
  );
  return normalizeOrder(result);
}

async function cancelPaymentOrder(orderNo: string) {
  const result = await requestClient.post<RechargeApi.RechargeOrder>(
    `/payment/recharge/orders/${orderNo}/cancel`,
    {},
  );
  return normalizeOrder(result) as RechargeApi.RechargeOrder;
}

async function deleteMyPaymentOrder(orderNo: string) {
  return requestClient.delete(
    `/payment/recharge/orders/${encodeURIComponent(orderNo)}`,
  );
}

async function submitTrc20TxID(
  orderNo: string,
  txid: string,
): Promise<RechargeApi.RechargeOrder> {
  const result = await requestClient.post<RechargeApi.RechargeOrder>(
    `/payment/recharge/orders/${encodeURIComponent(orderNo)}/txid`,
    { txid },
  );
  return normalizeOrder(result) as RechargeApi.RechargeOrder;
}

async function getMyPaymentOrderList(params: PaymentOrderApi.OrderListParams) {
  return requestClient.get<{
    items: PaymentOrderApi.PaymentOrder[];
    total: number;
  }>('/payment/orders/my', { params });
}

async function createGlobalPackagePaymentOrder(
  id: string,
  data: RechargeApi.PackageOrderPayload,
) {
  if (data.payChannel === 'BALANCE') {
    await requestClient.post(
      `/package/mall/global/${id}/purchase`,
      {},
      purchaseRequestConfig(),
    );
    return paidBalancePurchase();
  }
  const result = await requestClient.post<RechargeApi.PackagePaymentOrder>(
    `/payment/package/global/${id}/orders`,
    {
      forceNew: Boolean(data.forceNew),
      ...buildOnlineOrderPayload(
        data.payChannel,
        data.clientType ?? 'AUTO',
        data.preferredProduct ?? 'AUTO',
      ),
    },
  );
  return normalizeOrder(result);
}

async function createInterfacePackagePaymentOrder(
  id: string,
  data: RechargeApi.PackageOrderPayload,
) {
  const specId = data.specId || id;
  if (data.payChannel === 'BALANCE') {
    await requestClient.post(
      `/package/mall/interface/${specId}/purchase`,
      {},
      purchaseRequestConfig(),
    );
    return paidBalancePurchase();
  }
  const result = await requestClient.post<RechargeApi.PackagePaymentOrder>(
    `/payment/package/interface/${specId}/orders`,
    {
      forceNew: Boolean(data.forceNew),
      ...buildOnlineOrderPayload(
        data.payChannel,
        data.clientType ?? 'AUTO',
        data.preferredProduct ?? 'AUTO',
      ),
    },
  );
  return normalizeOrder(result);
}

async function createPointPackagePaymentOrder(
  id: string,
  data: RechargeApi.PackageOrderPayload,
) {
  if (data.payChannel === 'BALANCE') {
    await requestClient.post(
      `/package/mall/point/${id}/purchase`,
      {},
      purchaseRequestConfig(),
    );
    return paidBalancePurchase();
  }
  const result = await requestClient.post<RechargeApi.PackagePaymentOrder>(
    `/payment/package/point/${id}/orders`,
    {
      forceNew: Boolean(data.forceNew),
      ...buildOnlineOrderPayload(
        data.payChannel,
        data.clientType ?? 'AUTO',
        data.preferredProduct ?? 'AUTO',
      ),
    },
  );
  return normalizeOrder(result);
}

export {
  cancelPaymentOrder,
  continuePaymentOrder,
  createGlobalPackagePaymentOrder,
  createInterfacePackagePaymentOrder,
  createPointPackagePaymentOrder,
  createRechargeOrder,
  deleteMyPaymentOrder,
  findPendingPaymentOrder,
  getMyPaymentOrderList,
  getRechargeCapabilities,
  getRechargeOrder,
  getSiteCurrency,
  submitTrc20TxID,
  syncRechargeOrder,
};
