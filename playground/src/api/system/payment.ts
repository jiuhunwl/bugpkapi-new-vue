import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';
import { settlementDisplayName } from '#/composables/use-settlement-currency';
import { $t } from '#/locales';

export namespace PaymentConfigApi {
  export interface AlipayConfig {
    alipayPublicKey: string;
    appId: string;
    appPrivateKey?: string;
    enabled: 0 | 1 | boolean;
    gatewayUrl: string;
    mode: 'PRODUCTION' | 'SANDBOX';
    notifyUrl: string;
    returnUrl?: string;
    sellerId?: string;
  }

  export type HupijiaoMethod = 'ALIPAY' | 'WECHAT';

  export interface HupijiaoChannelConfig {
    appId: string;
    appSecret?: string;
    callbackUrl?: string;
    createUrl: string;
    enabled: boolean;
    method: HupijiaoMethod;
    notifyUrl?: string;
    queryUrl: string;
    returnUrl?: string;
    wapName?: string;
    wapUrl?: string;
  }

  export interface HupijiaoConfig {
    alipay: HupijiaoChannelConfig;
    wechat: HupijiaoChannelConfig;
  }

  export interface WechatConfig {
    apiV3Key?: string;
    appAppId?: string;
    appId: string;
    enabled: boolean;
    mchid: string;
    miniAppId?: string;
    mode: 'PRODUCTION' | 'SANDBOX';
    notifyUrl?: string;
    oaAppId?: string;
    platformPublicKey?: string;
    platformPublicKeyId?: string;
    privateKey?: string;
    serialNo?: string;
    spAppId?: string;
    spMchid?: string;
    subAppId?: string;
    subMchid?: string;
  }

  export type PaymentMethodCode =
    | 'ALIPAY'
    | 'BALANCE'
    | 'BEP20'
    | 'HUPIJIAO_ALIPAY'
    | 'HUPIJIAO_WECHAT'
    | 'TRC20'
    | 'WECHAT';

  export interface PaymentMethod {
    code: PaymentMethodCode;
    enabled: boolean;
    sortOrder: number;
  }

  export type SettlementCurrency = 'CNY' | 'USD';

  export interface CurrencyConfig {
    currency: SettlementCurrency;
    /** 用户端货币展示名称（如积分、赞助额度）；空=按结算货币显示 ¥/$。 */
    displayName?: string;
    /** 1 USD = X CNY，美元结算时的换算汇率。 */
    usdCnyRate?: string;
    /** 发给支付渠道的商品名；留空则沿用订单明细名。 */
    goodsName?: string;
  }

  export interface SponsorRoleConfig {
    enabled: boolean;
    roleId: number;
    roleName?: string;
  }

  export interface SaveSponsorRoleConfig {
    enabled: boolean;
    roleId: number;
  }

  export interface Trc20Config {
    address: string;
    apiKeyConfigured: boolean;
    confirmations: number;
    contractAddress: string;
    enabled: boolean;
    maxAmount: string;
    minAmount: string;
    network: string;
  }

  export interface SaveTrc20Config {
    address: string;
    /** 留空表示不修改已保存的 API Key。 */
    apiKey?: string;
    confirmations: number;
    enabled: boolean;
    maxAmount: number | string;
    minAmount: number | string;
  }

  export interface Bep20Config {
    address: string;
    confirmations: number;
    contractAddress: string;
    enabled: boolean;
    maxAmount: string;
    minAmount: string;
    network: string;
    rpcUrl: string;
  }

  export interface SaveBep20Config {
    address: string;
    confirmations: number;
    enabled: boolean;
    maxAmount: number | string;
    minAmount: number | string;
    rpcUrl: string;
  }
}

export namespace PaymentOrderApi {
  export type OrderStatus =
    | 'CANCELLED'
    | 'CLOSED'
    | 'CREATED'
    | 'EXPIRED'
    | 'FAILED'
    | 'PAID'
    | 'PAYING';
  export type OrderType =
    | 'GLOBAL_PACKAGE'
    | 'INTERFACE_PACKAGE'
    | 'POINT_PACKAGE'
    | 'RECHARGE';
  export type PayChannel = PaymentConfigApi.PaymentMethodCode;

  export interface OrderListParams extends Recordable<any> {
    keyword?: string;
    maxAmount?: number | string;
    minAmount?: number | string;
    orderType?: 'ALL' | OrderType;
    page?: number;
    pageSize?: number;
    paidFrom?: string;
    paidTo?: string;
    sortBy?: 'created_at' | 'paid_at' | 'pay_amount' | 'status';
    sortOrder?: 'asc' | 'desc';
    status?: OrderStatus;
  }

  export interface PaymentOrder {
    alipayTradeNo?: string;
    buyerId?: string;
    chainAddress?: string;
    chainAmount?: string;
    chainConfirmCount?: number;
    chainTxid?: string;
    createTime?: string;
    // 本单结算货币；USD 时 payAmount 已按汇率换算，originAmount 为人民币原价。
    currency?: 'CNY' | 'USD';
    expireTime?: string;
    giftAmount?: number | string;
    grantPoints?: number | string;
    id: string;
    orderNo: string;
    orderType: OrderType;
    originAmount?: string;
    paidTime?: string;
    payAmount: number | string;
    payChannel: PayChannel;
    product?: string;
    status: OrderStatus;
    subject: string;
    targetId?: string;
    userId: string;
    username?: string;
  }

  export type AssetRecordBizType =
    | 'ADMIN_BALANCE_ADJUST'
    | 'ADMIN_USER_ASSET_ADJUST'
    | 'ADMIN_USER_INITIAL_ASSET'
    | 'ALIPAY_POINT_PACKAGE'
    | 'ALIPAY_RECHARGE'
    | 'POINTS_GRANT'
    | 'PURCHASE_GLOBAL_PACKAGE'
    | 'PURCHASE_INTERFACE_PACKAGE'
    | 'PURCHASE_POINT_PACKAGE'
    | 'REDEEM_CODE';

  export interface AssetRecord {
    amount: string;
    balanceAfter: string;
    bizId?: string;
    bizType: AssetRecordBizType;
    createTime: string;
    displayName?: string;
    id: string;
    operatorName?: string;
    points: number;
    pointsAfter: number;
    remark: string;
    userId: string;
    username: string;
  }

  export interface AssetRecordListParams extends Recordable<any> {
    bizType?: '' | AssetRecordBizType;
    dateFrom?: string;
    dateTo?: string;
    keyword?: string;
    page?: number;
    pageSize?: number;
  }
}

export namespace RechargeAmountApi {
  export interface RechargeAmount {
    amount: number | string;
    createTime?: string;
    creditAmount?: number;
    giftAmount: number | string;
    id: string;
    name?: string;
    sortNo: number;
    sortOrder?: number;
    status: 0 | 1;
    updateTime?: string;
  }

  export interface ListParams extends Recordable<any> {
    keyword?: string;
    page?: number;
    pageSize?: number;
    status?: 0 | 1;
  }

  export interface SaveRechargeAmount {
    amount: number | string;
    giftAmount: number | string;
    name?: string;
    sortNo?: number;
    status?: 0 | 1;
  }
}

function flag(value: boolean | number | undefined) {
  return value === true || value === 1;
}

const ALIPAY_PRIVATE_KEY_MASK = '******';
const ALIPAY_PRODUCTION_GATEWAY = 'https://openapi.alipay.com/gateway.do';
const ALIPAY_SANDBOX_GATEWAY =
  'https://openapi-sandbox.dl.alipaydev.com/gateway.do';

function normalizeAlipayConfig(
  item: PaymentConfigApi.AlipayConfig,
): PaymentConfigApi.AlipayConfig {
  return {
    ...item,
    enabled: flag(item.enabled) ? 1 : 0,
    appPrivateKey:
      String(item.appPrivateKey ?? '').trim() === ALIPAY_PRIVATE_KEY_MASK
        ? ''
        : String(item.appPrivateKey ?? '').trim(),
    mode: item.mode === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX',
  };
}

function alipayPayload(data: PaymentConfigApi.AlipayConfig) {
  const mode = data.mode === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX';
  const submittedGateway = String(data.gatewayUrl ?? '').trim();
  const gatewayUrl =
    !submittedGateway ||
    submittedGateway === ALIPAY_PRODUCTION_GATEWAY ||
    submittedGateway === ALIPAY_SANDBOX_GATEWAY
      ? mode === 'PRODUCTION'
        ? ALIPAY_PRODUCTION_GATEWAY
        : ALIPAY_SANDBOX_GATEWAY
      : submittedGateway;
  return {
    alipayPublicKey: String(data.alipayPublicKey ?? '').trim(),
    appId: String(data.appId ?? '').trim(),
    appPrivateKey: String(data.appPrivateKey ?? '').trim(),
    enabled: flag(data.enabled),
    gatewayUrl,
    mode,
    notifyUrl: String(data.notifyUrl ?? '').trim(),
    returnUrl: String(data.returnUrl ?? '').trim(),
    sellerId: String(data.sellerId ?? '').trim(),
  };
}

function normalizePreset(
  item: RechargeAmountApi.RechargeAmount,
): RechargeAmountApi.RechargeAmount {
  return {
    ...item,
    creditAmount: Number(item.amount) + Number(item.giftAmount ?? 0),
    sortNo: Number(item.sortNo ?? item.sortOrder ?? 0),
  };
}

async function getAlipayConfig() {
  const result = await requestClient.get<PaymentConfigApi.AlipayConfig>(
    '/payment/alipay/config',
  );
  return normalizeAlipayConfig(result);
}

async function updateAlipayConfig(data: PaymentConfigApi.AlipayConfig) {
  return requestClient.put('/payment/alipay/config', alipayPayload(data));
}

async function validateAlipayConfig(data: PaymentConfigApi.AlipayConfig) {
  return requestClient.post(
    '/payment/alipay/config/validate',
    alipayPayload(data),
  );
}

function normalizeWechatConfig(
  item: PaymentConfigApi.WechatConfig,
): PaymentConfigApi.WechatConfig {
  return {
    ...item,
    apiV3Key: String(item.apiV3Key ?? '').trim(),
    appAppId: String(item.appAppId ?? '').trim(),
    appId: String(item.appId ?? '').trim(),
    enabled: flag(item.enabled),
    mchid: String(item.mchid ?? '').trim(),
    miniAppId: String(item.miniAppId ?? '').trim(),
    mode: item.mode === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX',
    notifyUrl: String(item.notifyUrl ?? '').trim(),
    oaAppId: String(item.oaAppId ?? '').trim(),
    platformPublicKey: String(item.platformPublicKey ?? '').trim(),
    platformPublicKeyId: String(item.platformPublicKeyId ?? '').trim(),
    privateKey: String(item.privateKey ?? '').trim(),
    serialNo: String(item.serialNo ?? '').trim(),
    spAppId: String(item.spAppId ?? '').trim(),
    spMchid: String(item.spMchid ?? '').trim(),
    subAppId: String(item.subAppId ?? '').trim(),
    subMchid: String(item.subMchid ?? '').trim(),
  };
}

async function getWechatConfig() {
  const result = await requestClient.get<PaymentConfigApi.WechatConfig>(
    '/payment/wechat/config',
  );
  return normalizeWechatConfig(result);
}

async function updateWechatConfig(data: PaymentConfigApi.WechatConfig) {
  return requestClient.put(
    '/payment/wechat/config',
    normalizeWechatConfig(data),
  );
}

async function validateWechatConfig(data: PaymentConfigApi.WechatConfig) {
  return requestClient.post(
    '/payment/wechat/config/validate',
    normalizeWechatConfig(data),
  );
}

function normalizeHupijiaoChannel(
  item: PaymentConfigApi.HupijiaoChannelConfig,
): PaymentConfigApi.HupijiaoChannelConfig {
  return {
    ...item,
    appId: String(item.appId ?? '').trim(),
    appSecret: String(item.appSecret ?? '').trim(),
    callbackUrl: String(item.callbackUrl ?? '').trim(),
    createUrl: String(item.createUrl ?? '').trim(),
    enabled: flag(item.enabled),
    notifyUrl: String(item.notifyUrl ?? '').trim(),
    queryUrl: String(item.queryUrl ?? '').trim(),
    returnUrl: String(item.returnUrl ?? '').trim(),
    wapName: String(item.wapName ?? '').trim(),
    wapUrl: String(item.wapUrl ?? '').trim(),
  };
}

async function getHupijiaoConfig() {
  const result = await requestClient.get<PaymentConfigApi.HupijiaoConfig>(
    '/payment/hupijiao/config',
  );
  return {
    alipay: normalizeHupijiaoChannel(result.alipay),
    wechat: normalizeHupijiaoChannel(result.wechat),
  } satisfies PaymentConfigApi.HupijiaoConfig;
}

async function updateHupijiaoConfig(
  data: PaymentConfigApi.HupijiaoChannelConfig,
) {
  return requestClient.put(
    '/payment/hupijiao/config',
    normalizeHupijiaoChannel(data),
  );
}

async function validateHupijiaoConfig(
  data: PaymentConfigApi.HupijiaoChannelConfig,
) {
  return requestClient.post(
    '/payment/hupijiao/config/validate',
    normalizeHupijiaoChannel(data),
  );
}

async function getPaymentMethods() {
  return requestClient.get<PaymentConfigApi.PaymentMethod[]>(
    '/payment/methods',
  );
}

async function updatePaymentMethods(methods: PaymentConfigApi.PaymentMethod[]) {
  return requestClient.put('/payment/methods', { methods });
}

async function getPaymentCurrency() {
  return requestClient.get<PaymentConfigApi.CurrencyConfig>(
    '/payment/currency/config',
  );
}

async function updatePaymentCurrency(
  data: PaymentConfigApi.CurrencyConfig,
): Promise<PaymentConfigApi.CurrencyConfig> {
  const currency =
    data.currency === 'USD'
      ? 'USD'
      : ('CNY' as PaymentConfigApi.SettlementCurrency);
  const usdCnyRate =
    currency === 'USD' ? String(data.usdCnyRate ?? '').trim() : undefined;
  const goodsName = String(data.goodsName ?? '').trim();
  const displayName = String(data.displayName ?? '').trim();
  await requestClient.put('/payment/currency/config', {
    currency,
    displayName,
    goodsName,
    usdCnyRate,
  });
  return { currency, displayName, goodsName, usdCnyRate };
}

async function getSponsorRoleConfig() {
  const result = await requestClient.get<PaymentConfigApi.SponsorRoleConfig>(
    '/payment/sponsor/config',
  );
  return {
    enabled: result.enabled === true || (result.enabled as unknown as number) === 1,
    roleId: Number(result.roleId ?? 0),
    roleName: String(result.roleName ?? ''),
  } satisfies PaymentConfigApi.SponsorRoleConfig;
}

async function updateSponsorRoleConfig(
  data: PaymentConfigApi.SaveSponsorRoleConfig,
) {
  await requestClient.put('/payment/sponsor/config', {
    enabled: data.enabled,
    roleId: data.enabled ? Number(data.roleId) || 0 : 0,
  });
}

async function getTrc20Config() {
  const result = await requestClient.get<PaymentConfigApi.Trc20Config>(
    '/payment/trc20/config',
  );
  return {
    address: String(result.address ?? ''),
    apiKeyConfigured: result.apiKeyConfigured === true,
    confirmations: Number(result.confirmations ?? 1),
    contractAddress: String(result.contractAddress ?? ''),
    enabled: result.enabled === true || (result.enabled as unknown as number) === 1,
    maxAmount: String(result.maxAmount ?? ''),
    minAmount: String(result.minAmount ?? ''),
    network: String(result.network ?? 'TRON'),
  } satisfies PaymentConfigApi.Trc20Config;
}

async function updateTrc20Config(data: PaymentConfigApi.SaveTrc20Config) {
  await requestClient.put('/payment/trc20/config', {
    address: data.address.trim(),
    apiKey: data.apiKey?.trim() || undefined,
    confirmations: Number(data.confirmations) || 1,
    enabled: data.enabled,
    maxAmount: String(data.maxAmount).trim(),
    minAmount: String(data.minAmount).trim(),
  });
}

async function getBep20Config() {
  const result = await requestClient.get<PaymentConfigApi.Bep20Config>(
    '/payment/bep20/config',
  );
  return {
    address: String(result.address ?? ''),
    confirmations: Number(result.confirmations ?? 15),
    contractAddress: String(result.contractAddress ?? ''),
    enabled: result.enabled === true || (result.enabled as unknown as number) === 1,
    maxAmount: String(result.maxAmount ?? ''),
    minAmount: String(result.minAmount ?? ''),
    network: String(result.network ?? 'BSC'),
    rpcUrl: String(result.rpcUrl ?? ''),
  } satisfies PaymentConfigApi.Bep20Config;
}

async function updateBep20Config(data: PaymentConfigApi.SaveBep20Config) {
  await requestClient.put('/payment/bep20/config', {
    address: data.address.trim(),
    confirmations: Number(data.confirmations) || 15,
    enabled: data.enabled,
    maxAmount: String(data.maxAmount).trim(),
    minAmount: String(data.minAmount).trim(),
    rpcUrl: data.rpcUrl.trim(),
  });
}

async function getPaymentOrderList(params: PaymentOrderApi.OrderListParams) {  const normalized = {
    ...params,
    orderType: params.orderType === 'ALL' ? undefined : params.orderType,
  };
  return requestClient.get<{
    items: PaymentOrderApi.PaymentOrder[];
    total: number;
  }>('/payment/orders/list', { params: normalized });
}

async function getAssetRecordList(params: PaymentOrderApi.AssetRecordListParams) {
  return requestClient.get<{
    items: PaymentOrderApi.AssetRecord[];
    total: number;
  }>('/payment/asset-records', {
    params: { ...params, bizType: params.bizType || undefined },
  });
}

async function getPaymentOrder(orderNo: string) {
  return requestClient.get<PaymentOrderApi.PaymentOrder>(
    `/payment/orders/${encodeURIComponent(orderNo)}`,
  );
}

async function syncPaymentOrder(orderNo: string) {
  return requestClient.post<PaymentOrderApi.PaymentOrder>(
    `/payment/orders/${encodeURIComponent(orderNo)}/sync`,
    {},
  );
}

async function deletePaymentOrder(orderNo: string) {
  return requestClient.delete(
    `/payment/orders/${encodeURIComponent(orderNo)}`,
  );
}

async function getRechargeAmountList(params: RechargeAmountApi.ListParams) {
  const result = await requestClient.get<{
    items: RechargeAmountApi.RechargeAmount[];
    total: number;
  }>('/payment/recharge/presets', { params });
  return {
    items: (result.items ?? []).map(normalizePreset),
    total: result.total,
  };
}

// 充值档位默认名称跟随货币展示名称：未配置时仍为「{0} 元充值额度」。
function defaultRechargeAmountName(amount: unknown) {
  const displayName = settlementDisplayName();
  return displayName
    ? $t('system.payment.amountNameDisplay', [amount, displayName])
    : $t('system.payment.amountNameYuan', [amount]);
}

async function createRechargeAmount(
  data: RechargeAmountApi.SaveRechargeAmount,
) {
  return requestClient.post('/payment/recharge/presets', {
    amount: data.amount,
    giftAmount: data.giftAmount,
    name: data.name || defaultRechargeAmountName(data.amount),
    sortOrder: data.sortNo ?? 0,
    status: data.status ?? 1,
  });
}

async function updateRechargeAmount(
  id: string,
  data: RechargeAmountApi.SaveRechargeAmount,
) {
  return requestClient.put(`/payment/recharge/presets/${id}`, {
    amount: data.amount,
    giftAmount: data.giftAmount,
    name: data.name || defaultRechargeAmountName(data.amount),
    sortOrder: data.sortNo ?? 0,
    status: data.status ?? 1,
  });
}

async function deleteRechargeAmount(id: string) {
  return requestClient.delete(`/payment/recharge/presets/${id}`);
}

export {
  createRechargeAmount,
  deletePaymentOrder,
  deleteRechargeAmount,
  getAlipayConfig,
  getAssetRecordList,
  getBep20Config,
  getHupijiaoConfig,
  getPaymentCurrency,
  getPaymentMethods,
  getPaymentOrder,
  getPaymentOrderList,
  getRechargeAmountList,
  getSponsorRoleConfig,
  getTrc20Config,
  getWechatConfig,
  syncPaymentOrder,
  updateAlipayConfig,
  updateBep20Config,
  updateHupijiaoConfig,
  updatePaymentCurrency,
  updatePaymentMethods,
  updateRechargeAmount,
  updateSponsorRoleConfig,
  updateTrc20Config,
  updateWechatConfig,
  validateAlipayConfig,
  validateHupijiaoConfig,
  validateWechatConfig,
};
