import { requestClient } from '#/api/request';

export namespace CaptchaConfigApi {
  export interface ProviderOption {
    description: string;
    key: string;
    name: string;
  }

  export interface SceneConfig {
    action?: string;
    apiKey?: string;
    captchaId?: string;
    cdata?: string;
    difficulty: number;
    enabled: number;
    failurePolicy?: string;
    hostname?: string;
    // 该场景没有独立配置、当前沿用默认场景的 Provider 时置 true
    inherited?: boolean;
    language?: string;
    product?: 'bind' | 'float' | 'popup';
    provider: string;
    scene: string;
    secretKey?: string;
    siteKey?: string;
    timeoutMs?: number;
  }

  export interface ConfigResult {
    configs: Record<string, SceneConfig>;
    enabledScenes?: string[];
    globalEnabled: boolean;
    providers: ProviderOption[];
    scenes: string[];
  }

  export interface SaveScenesParams {
    scenes: string[];
  }

  export interface SaveGlobalParams {
    enabled: boolean;
  }

  export interface SaveParams {
    action?: string;
    apiKey?: string;
    captchaId?: string;
    cdata?: string;
    difficulty: number;
    enabled: number;
    failurePolicy?: string;
    hostname?: string;
    language?: string;
    product?: 'bind' | 'float' | 'popup';
    provider: string;
    scene: string;
    secretKey?: string;
    siteKey?: string;
    timeoutMs?: number;
  }
}

/** 获取验证码 Provider 配置（全部场景） */
export async function getCaptchaConfigApi() {
  return requestClient.get<CaptchaConfigApi.ConfigResult>('/system/captcha-config');
}

/** 保存指定场景的验证码 Provider 配置 */
export async function updateCaptchaConfigApi(data: CaptchaConfigApi.SaveParams) {
  return requestClient.put<boolean>('/system/captcha-config', data);
}

/** 保存验证码全局总开关，关闭后所有验证码场景直接放行。 */
export async function updateCaptchaGlobalApi(
  data: CaptchaConfigApi.SaveGlobalParams,
) {
  return requestClient.put<boolean>('/system/captcha-config/global', data);
}

/** 批量保存需要验证码的业务场景，不修改各场景 Provider 与密钥 */
export async function updateCaptchaScenesApi(
  data: CaptchaConfigApi.SaveScenesParams,
) {
  return requestClient.put<boolean>('/system/captcha-config/scenes', data);
}
