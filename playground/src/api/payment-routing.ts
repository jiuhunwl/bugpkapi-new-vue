import type { RechargeApi } from './payment';

export type OnlinePayChannel = Exclude<RechargeApi.PayChannel, 'BALANCE'>;

export type PaymentMethod = RechargeApi.PaymentMethod;
export type OnlinePaymentMethod = Omit<PaymentMethod, 'code'> & {
  code: OnlinePayChannel;
};

export interface OnlineOrderPayload {
  payChannel: OnlinePayChannel;
  product: string;
  tradeType?: 'H5' | 'NATIVE';
}

function moneyCents(value: number | string | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

export function enabledOnlinePaymentMethods(
  methods: readonly PaymentMethod[] | undefined,
): OnlinePaymentMethod[] {
  return (methods ?? [])
    .filter((method) => method.enabled && method.code !== 'BALANCE')
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }
      return left.code.localeCompare(right.code);
    }) as OnlinePaymentMethod[];
}

export function findRechargePresetId(
  presets: readonly RechargeApi.RechargeAmountOption[] | undefined,
  amount: number | string | undefined,
) {
  const target = moneyCents(amount);
  if (target <= 0) {
    return undefined;
  }
  return presets?.find((preset) => moneyCents(preset.amount) === target)?.id;
}

export function supportsPayProductSelection(channel: OnlinePayChannel) {
  return channel === 'ALIPAY';
}

/** 链上充值通道：没有第三方收银台，过期后仍需继续核验到账。 */
export function isChainDepositChannel(channel: string | undefined) {
  const normalized = String(channel ?? '').toUpperCase();
  return normalized === 'TRC20' || normalized === 'BEP20';
}

export function chainDepositNetworkLabel(channel: string | undefined) {
  return String(channel ?? '').toUpperCase() === 'BEP20'
    ? 'BSC (BEP20)'
    : 'TRON (TRC20)';
}

function selectedProduct(
  clientType: RechargeApi.ClientType,
  preferredProduct: RechargeApi.PayProduct,
) {
  if (preferredProduct !== 'AUTO') {
    return preferredProduct;
  }
  return clientType === 'MOBILE' ? 'WAP' : 'PAGE';
}

export function buildOnlineOrderPayload(
  payChannel: OnlinePayChannel,
  clientType: RechargeApi.ClientType,
  preferredProduct: RechargeApi.PayProduct = 'AUTO',
): OnlineOrderPayload {
  if (payChannel === 'WECHAT' || payChannel === 'HUPIJIAO_WECHAT') {
    const tradeType = clientType === 'MOBILE' ? 'H5' : 'NATIVE';
    return {
      payChannel,
      product: tradeType,
      tradeType,
    };
  }
  return {
    payChannel,
    product: selectedProduct(clientType, preferredProduct),
  };
}
