import { describe, expect, it } from 'vitest';

import type { PaymentConfigApi } from '#/api/system/payment';

import {
  buildWechatConfigPayload,
  createWechatConfigForm,
} from './wechat-config-form';

describe('wechat payment configuration form', () => {
  it('normalizes server values without losing the masked secret markers', () => {
    const form = createWechatConfigForm({
      appId: ' wx-app ',
      apiV3Key: '******',
      enabled: true,
      mchid: ' mch-1 ',
      mode: 'PRODUCTION',
      privateKey: '******',
      serialNo: ' serial-1 ',
    } as unknown as PaymentConfigApi.WechatConfig);

    expect(form).toMatchObject({
      apiV3Key: '******',
      appId: 'wx-app',
      enabled: true,
      mchid: 'mch-1',
      mode: 'PRODUCTION',
      privateKey: '******',
      serialNo: 'serial-1',
    });
  });

  it('builds a trimmed payload with boolean enabled state', () => {
    const payload = buildWechatConfigPayload({
      appId: ' wx-app ',
      apiV3Key: ' key ',
      enabled: 1,
      mchid: ' mch-1 ',
      mode: 'SANDBOX',
      privateKey: ' pem ',
      serialNo: ' serial-1 ',
    } as unknown as PaymentConfigApi.WechatConfig);

    expect(payload).toMatchObject({
      apiV3Key: 'key',
      appId: 'wx-app',
      enabled: true,
      mchid: 'mch-1',
      mode: 'SANDBOX',
      privateKey: 'pem',
      serialNo: 'serial-1',
    });
  });
});
