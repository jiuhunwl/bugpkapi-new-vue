import type { PaymentConfigApi } from '#/api/system/payment';

const WECHAT_SECRET_MASK = '******';

function text(value: unknown) {
  return String(value ?? '').trim();
}

export function createWechatConfigForm(
  value?: Partial<PaymentConfigApi.WechatConfig>,
): PaymentConfigApi.WechatConfig {
  return {
    apiV3Key: text(value?.apiV3Key),
    appAppId: text(value?.appAppId),
    appId: text(value?.appId),
    enabled: value?.enabled === true || (value?.enabled as unknown) === 1,
    mchid: text(value?.mchid),
    miniAppId: text(value?.miniAppId),
    mode: value?.mode === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX',
    notifyUrl: text(value?.notifyUrl),
    oaAppId: text(value?.oaAppId),
    platformPublicKey: text(value?.platformPublicKey),
    platformPublicKeyId: text(value?.platformPublicKeyId),
    privateKey: text(value?.privateKey),
    serialNo: text(value?.serialNo),
    spAppId: text(value?.spAppId),
    spMchid: text(value?.spMchid),
    subAppId: text(value?.subAppId),
    subMchid: text(value?.subMchid),
  };
}

export function buildWechatConfigPayload(
  value: PaymentConfigApi.WechatConfig,
): PaymentConfigApi.WechatConfig {
  const payload = createWechatConfigForm(value);
  return {
    ...payload,
    apiV3Key: payload.apiV3Key || undefined,
    platformPublicKey: payload.platformPublicKey || undefined,
    privateKey: payload.privateKey || undefined,
  };
}

export function hasStoredWechatSecret(value?: string) {
  return text(value) === WECHAT_SECRET_MASK;
}
