import { baseRequestClient, requestClient } from '#/api/request';
import {
  assertAuthSessionCurrent,
  AuthSessionInvalidatedError,
  getAuthSessionGeneration,
  onAuthSessionInvalidated,
} from '#/utils/auth-session-lifecycle';

import {
  LOCK_SETTLE_MS,
  publishRefreshToken,
  takeSharedRefreshToken,
  withCrossTabRefreshLock,
} from './auth-refresh-broadcast';
import { createRegisterPayload } from './register-payload';

export namespace AuthApi {
  /** 登录接口参数 */
  export interface LoginParams {
    captchaId?: string;
    password?: string;
    username?: string;
  }

  export interface CaptchaResult {
    captchaId: string;
    challenge: string;
    difficulty: number;
    enabled?: boolean;
    meta?: Record<string, unknown>;
    provider?: CaptchaProvider;
    scene?: CaptchaScene;
  }

  export type CaptchaProvider = 'cloudflare' | 'geetest4' | 'pow';

  export type CaptchaScene =
    | 'change_password'
    | 'friend_link_apply'
    | 'login'
    | 'password_reset'
    | 'register'
    | 'register_email'
    | 'register_mobile';

  export interface CaptchaVerifyPayload {
    captcha_output?: string;
    gen_time?: string;
    lot_number?: string;
    pass_token?: string;
    proof?: string;
    time?: string;
    token?: string;
  }

  export interface RegisterParams {
    captchaId?: string;
    confirmPassword?: string;
    email?: string;
    emailCode?: string;
    mobile?: string;
    mobileCode?: string;
    password?: string;
    username?: string;
    /**
     * Honeypot field: never rendered visibly by the real client. Automated
     * scripts that blindly fill every input trip the server-side guard.
     */
    website?: string;
  }

  export interface RegisterConfig {
    captchaProviders?: CaptchaProvider[];
    emailRegisterEnabled: boolean;
    emailServiceEnabled?: boolean;
    mobileRegisterEnabled: boolean;
    registerEnabled: boolean;
  }

  /** 登录接口返回值 */
  export interface LoginResult {
    accessToken: string;
    challengeToken?: string;
    expiresIn?: number;
    /**
     * twoFARequired=true 表示密码已通过、需要第二因子：
     * 拿 challengeToken 调 POST /auth/2fa/login 换正式令牌。
     */
    twoFARequired?: boolean;
  }

  export interface TwoFAStatusResult {
    confirmedAt?: string;
    enabled: boolean;
    recoveryCodesRemaining: number;
  }

  export interface TwoFASetupResult {
    otpauthUrl: string;
    secret: string;
  }

  export interface TwoFAEnableResult {
    recoveryCodes: string[];
  }

  export interface PasswordResetAccountResult {
    maskedEmail: string;
  }

  export interface PasswordResetVerifyResult {
    resetToken: string;
  }

  export interface RefreshTokenResult {
    data: string;
    status: number;
  }
}

let refreshTokenRequest: null | {
  cancel: () => void;
  promise: Promise<AuthApi.RefreshTokenResult>;
} = null;

const stopRefreshInvalidation = onAuthSessionInvalidated(() => {
  const pending = refreshTokenRequest;
  refreshTokenRequest = null;
  pending?.cancel();
});
import.meta.hot?.dispose(stopRefreshInvalidation);

/**
 * 获取登录滑块验证码ID
 */
export async function getCaptchaApi(scene: AuthApi.CaptchaScene = 'login') {
  return requestClient.get<AuthApi.CaptchaResult>('/auth/captcha', {
    params: { scene },
  });
}

/**
 * 滑块完成后通知服务端验证
 */
export async function verifyCaptchaApi(
  captcha: AuthApi.CaptchaResult,
  solution: AuthApi.CaptchaVerifyPayload | string,
) {
  if (captcha.enabled === false) {
    return true;
  }
  const payload = await createCaptchaProof(captcha, solution);
  return requestClient.post<boolean>(
    `/auth/captcha/${captcha.captchaId}/verify`,
    payload,
  );
}

export function isCaptchaEnabled(
  captcha: AuthApi.CaptchaResult | null | undefined,
) {
  return captcha?.enabled !== false;
}

async function createCaptchaProof(
  captcha: AuthApi.CaptchaResult,
  solution: AuthApi.CaptchaVerifyPayload | string,
): Promise<AuthApi.CaptchaVerifyPayload> {
  const input: AuthApi.CaptchaVerifyPayload =
    typeof solution === 'string' ? { time: solution } : solution;
  const provider = captcha.provider || 'pow';
  if (provider === 'geetest4') {
    if (
      !input.lot_number ||
      !input.captcha_output ||
      !input.pass_token ||
      !input.gen_time
    ) {
      throw new Error('CAPTCHA_RESPONSE_INCOMPLETE:geetest4');
    }
    return {
      lot_number: input.lot_number,
      captcha_output: input.captcha_output,
      pass_token: input.pass_token,
      gen_time: input.gen_time,
    };
  }
  if (provider === 'cloudflare') {
    if (!input.token) {
      throw new Error('CAPTCHA_RESPONSE_INCOMPLETE:cloudflare');
    }
    return { token: input.token };
  }
  const time = input.time ?? '';
  if (input.proof) {
    return { proof: input.proof, time };
  }
  const prefix = '0'.repeat(captcha.difficulty);
  for (let nonce = 0; nonce < 500_000; nonce++) {
    const proof = nonce.toString(36);
    const hash = await sha256Hex(
      `${captcha.captchaId}:${captcha.challenge}:${time}:${proof}`,
    );
    if (hash.startsWith(prefix)) {
      return { proof, time };
    }
  }
  throw new Error('Captcha proof timeout');
}

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    return sha256HexFallback(data);
  }
  try {
    const digest = await subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)]
      .map((item) => item.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return sha256HexFallback(data);
  }
}

const SHA_256_INITIAL_HASH = [
  0x6a_09_e6_67, 0xbb_67_ae_85, 0x3c_6e_f3_72, 0xa5_4f_f5_3a, 0x51_0e_52_7f,
  0x9b_05_68_8c, 0x1f_83_d9_ab, 0x5b_e0_cd_19,
];

const SHA_256_K = [
  0x42_8a_2f_98, 0x71_37_44_91, 0xb5_c0_fb_cf, 0xe9_b5_db_a5, 0x39_56_c2_5b,
  0x59_f1_11_f1, 0x92_3f_82_a4, 0xab_1c_5e_d5, 0xd8_07_aa_98, 0x12_83_5b_01,
  0x24_31_85_be, 0x55_0c_7d_c3, 0x72_be_5d_74, 0x80_de_b1_fe, 0x9b_dc_06_a7,
  0xc1_9b_f1_74, 0xe4_9b_69_c1, 0xef_be_47_86, 0x0f_c1_9d_c6, 0x24_0c_a1_cc,
  0x2d_e9_2c_6f, 0x4a_74_84_aa, 0x5c_b0_a9_dc, 0x76_f9_88_da, 0x98_3e_51_52,
  0xa8_31_c6_6d, 0xb0_03_27_c8, 0xbf_59_7f_c7, 0xc6_e0_0b_f3, 0xd5_a7_91_47,
  0x06_ca_63_51, 0x14_29_29_67, 0x27_b7_0a_85, 0x2e_1b_21_38, 0x4d_2c_6d_fc,
  0x53_38_0d_13, 0x65_0a_73_54, 0x76_6a_0a_bb, 0x81_c2_c9_2e, 0x92_72_2c_85,
  0xa2_bf_e8_a1, 0xa8_1a_66_4b, 0xc2_4b_8b_70, 0xc7_6c_51_a3, 0xd1_92_e8_19,
  0xd6_99_06_24, 0xf4_0e_35_85, 0x10_6a_a0_70, 0x19_a4_c1_16, 0x1e_37_6c_08,
  0x27_48_77_4c, 0x34_b0_bc_b5, 0x39_1c_0c_b3, 0x4e_d8_aa_4a, 0x5b_9c_ca_4f,
  0x68_2e_6f_f3, 0x74_8f_82_ee, 0x78_a5_63_6f, 0x84_c8_78_14, 0x8c_c7_02_08,
  0x90_be_ff_fa, 0xa4_50_6c_eb, 0xbe_f9_a3_f7, 0xc6_71_78_f2,
];

function sha256HexFallback(data: Uint8Array) {
  const h = [...SHA_256_INITIAL_HASH];
  const length = data.length;
  const paddedLength = Math.trunc((length + 9 + 63) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(data);
  padded[length] = 0x80;
  const bitLengthHigh = Math.floor((length * 8) / 0x1_00_00_00_00);
  const bitLengthLow = (length * 8) >>> 0;
  padded[paddedLength - 8] = bitLengthHigh >>> 24;
  padded[paddedLength - 7] = bitLengthHigh >>> 16;
  padded[paddedLength - 6] = bitLengthHigh >>> 8;
  padded[paddedLength - 5] = bitLengthHigh;
  padded[paddedLength - 4] = bitLengthLow >>> 24;
  padded[paddedLength - 3] = bitLengthLow >>> 16;
  padded[paddedLength - 2] = bitLengthLow >>> 8;
  padded[paddedLength - 1] = bitLengthLow;

  const w = new Uint32Array(64);
  const paddedAt = (index: number) => padded[index] ?? 0;
  const wordAt = (index: number) => w[index] ?? 0;
  const hashAt = (index: number) => h[index] ?? 0;

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i++) {
      const index = offset + i * 4;
      w[i] =
        ((paddedAt(index) << 24) |
          (paddedAt(index + 1) << 16) |
          (paddedAt(index + 2) << 8) |
          paddedAt(index + 3)) >>>
        0;
    }
    for (let i = 16; i < 64; i++) {
      const word2 = wordAt(i - 2);
      const word7 = wordAt(i - 7);
      const word15 = wordAt(i - 15);
      const word16 = wordAt(i - 16);
      const s0 =
        rightRotate(word15, 7) ^ rightRotate(word15, 18) ^ (word15 >>> 3);
      const s1 =
        rightRotate(word2, 17) ^ rightRotate(word2, 19) ^ (word2 >>> 10);
      w[i] = (word16 + s0 + word7 + s1) >>> 0;
    }

    let a = hashAt(0);
    let b = hashAt(1);
    let c = hashAt(2);
    let d = hashAt(3);
    let e = hashAt(4);
    let f = hashAt(5);
    let g = hashAt(6);
    let hash = hashAt(7);
    for (let i = 0; i < 64; i++) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hash + s1 + ch + (SHA_256_K[i] ?? 0) + wordAt(i)) >>> 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;

      hash = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h[0] = (hashAt(0) + a) >>> 0;
    h[1] = (hashAt(1) + b) >>> 0;
    h[2] = (hashAt(2) + c) >>> 0;
    h[3] = (hashAt(3) + d) >>> 0;
    h[4] = (hashAt(4) + e) >>> 0;
    h[5] = (hashAt(5) + f) >>> 0;
    h[6] = (hashAt(6) + g) >>> 0;
    h[7] = (hashAt(7) + hash) >>> 0;
  }

  return h.map((item) => item.toString(16).padStart(8, '0')).join('');
}

function rightRotate(value: number, bits: number) {
  return (value >>> bits) | (value << (32 - bits));
}

/**
 * 登录
 */
export async function loginApi(data: AuthApi.LoginParams) {
  return requestClient.post<AuthApi.LoginResult>('/auth/login', data, {
    withCredentials: true,
  });
}

/**
 * 2FA 登录第二步：challenge token + 验证码（或恢复码）换正式令牌
 */
export async function loginTwoFAApi(challengeToken: string, code: string) {
  return requestClient.post<AuthApi.LoginResult>('/auth/2fa/login', {
    challengeToken,
    code,
  }, {
    withCredentials: true,
  });
}

/**
 * 2FA 状态（需要已登录的 access token）
 */
export async function getTwoFAStatusApi() {
  return requestClient.get<AuthApi.TwoFAStatusResult>('/auth/2fa/status');
}

/**
 * 开始绑定 2FA：生成密钥与 otpauth 绑定链接（前端渲染二维码）
 */
export async function setupTwoFAApi() {
  return requestClient.post<AuthApi.TwoFASetupResult>('/auth/2fa/setup');
}

/**
 * 确认绑定 2FA：提交认证器当前 6 位验证码，返回一次性恢复码
 */
export async function enableTwoFAApi(code: string) {
  return requestClient.post<AuthApi.TwoFAEnableResult>('/auth/2fa/enable', {
    code,
  });
}

/**
 * 关闭 2FA：需要当前密码 + 验证码双确认
 */
export async function disableTwoFAApi(password: string, code: string) {
  return requestClient.post<boolean>('/auth/2fa/disable', {
    code,
    password,
  });
}

/**
 * 重新生成恢复码：旧的立即作废，需要当前密码 + 验证码
 */
export async function regenerateTwoFARecoveryCodesApi(
  password: string,
  code: string,
) {
  return requestClient.post<AuthApi.TwoFAEnableResult>(
    '/auth/2fa/recovery-codes',
    { code, password },
  );
}

/**
 * 注册
 */
export async function registerApi(data: AuthApi.RegisterParams) {
  return requestClient.post<AuthApi.LoginResult>(
    '/auth/register',
    createRegisterPayload(data),
    {
      withCredentials: true,
    },
  );
}

/**
 * 获取注册配置
 */
export async function getRegisterConfigApi() {
  return requestClient.get<AuthApi.RegisterConfig>('/auth/register/config');
}

/**
 * 发送注册邮箱验证码
 */
export async function sendRegisterEmailCodeApi(
  email: string,
  captchaId: string,
) {
  return requestClient.post<boolean>('/auth/register/email-code', {
    captchaId,
    email,
  });
}

/**
 * 发送注册短信验证码
 */
export async function sendRegisterMobileCodeApi(
  mobile: string,
  captchaId: string,
) {
  return requestClient.post<boolean>('/auth/register/mobile-code', {
    captchaId,
    mobile,
  });
}

/**
 * 校验找回密码账号并返回脱敏邮箱
 */
export async function checkPasswordResetAccountApi(account: string) {
  return requestClient.post<AuthApi.PasswordResetAccountResult>(
    '/auth/password-reset/account',
    { account },
  );
}

/**
 * 发送找回密码邮箱验证码
 */
export async function sendPasswordResetEmailCodeApi(
  account: string,
  captchaId: string,
) {
  return requestClient.post<boolean>('/auth/password-reset/email-code', {
    account,
    captchaId,
  });
}

/**
 * 校验找回密码邮箱验证码
 */
export async function verifyPasswordResetCodeApi(
  account: string,
  code: string,
  totpCode?: string,
) {
  return requestClient.post<AuthApi.PasswordResetVerifyResult>(
    '/auth/password-reset/verify',
    { account, code, totpCode },
  );
}

/**
 * 重置普通用户密码
 */
export async function resetPasswordApi(
  resetToken: string,
  password: string,
  confirmPassword: string,
) {
  return requestClient.post<boolean>('/auth/password-reset', {
    confirmPassword,
    password,
    resetToken,
  });
}

/**
 * 刷新accessToken
 *
 * currentAccessToken 仅用于跨标签页复用时校验「同一个用户」；没有它也能
 * 正常刷新，只是不采纳其他标签页广播来的令牌。
 */
export async function refreshTokenApi(
  currentAccessToken: null | string = null,
) {
  if (refreshTokenRequest) {
    return refreshTokenRequest.promise;
  }

  const generation = getAuthSessionGeneration();
  const controller = new AbortController();
  let cancel!: () => void;
  const invalidated = new Promise<never>((_resolve, reject) => {
    cancel = () => {
      controller.abort();
      reject(new AuthSessionInvalidatedError());
    };
  });
  const refresh = (async (): Promise<AuthApi.RefreshTokenResult> => {
    const shared = await takeSharedRefreshToken(currentAccessToken);
    if (shared) {
      assertAuthSessionCurrent(generation);
      return { data: shared, status: 200 };
    }
    return withCrossTabRefreshLock(async (serialized) => {
      assertAuthSessionCurrent(generation);
      // 刚拿到锁时，上一个标签页的广播可能还在路上；稍等片刻再决定
      // 是否真的要发一次刷新请求。
      const lateShared = await takeSharedRefreshToken(
        currentAccessToken,
        serialized ? LOCK_SETTLE_MS : 0,
      );
      if (lateShared) {
        return { data: lateShared, status: 200 };
      }
      const resp = await baseRequestClient.instance.post('/auth/refresh', null, {
        signal: controller.signal,
        withCredentials: true,
      });
      assertAuthSessionCurrent(generation);
      const body = resp?.data;
      const token = typeof body === 'string' ? body : body?.data;
      const result = {
        data: typeof token === 'string' ? token : '',
        status: resp?.status ?? 0,
      } satisfies AuthApi.RefreshTokenResult;
      if (result.data) {
        publishRefreshToken(result.data);
      }
      return result;
    });
  })();
  const pending = {
    cancel,
    promise: Promise.race([refresh, invalidated])
      .catch((error) => {
        assertAuthSessionCurrent(generation);
        throw error;
      })
      .finally(() => {
        if (refreshTokenRequest === pending) {
          refreshTokenRequest = null;
        }
      }),
  };
  refreshTokenRequest = pending;
  return pending.promise;
}

/**
 * 退出登录
 */
export async function logoutApi() {
  return baseRequestClient.post('/auth/logout', null, {
    withCredentials: true,
  });
}

/**
 * 获取用户权限码
 */
export async function getAccessCodesApi() {
  return requestClient.get<string[]>('/auth/codes');
}
