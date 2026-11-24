/**
 * 登录页验证码「拉取失败」的重试策略。
 *
 * 背景：登录页挂载时会先请求 GET /auth/captcha 拿挑战。这个请求一旦失败
 * （服务端 5xx / Redis 抖动 / 网关 429 / 会话切换打断），页面会停在
 * 「验证组件加载失败，请重试」的提示上，而提交按钮又被「必须完成验证」挡住，
 * 用户只能手动刷新页面 —— 登录过期被踢回登录页时，这会把一次可恢复的
 * 抖动放大成「登录不进去」。
 *
 * 这里只负责「值不值得再试一次、隔多久再试」的纯逻辑，方便单测；
 * 真正发请求、更新 UI 由登录页完成。
 */

/** 第 1、2、3 次重试前的等待时间（毫秒）。总计最多 4 次尝试。 */
export const CAPTCHA_RETRY_DELAYS_MS = [600, 1800, 4000];

/** 服务端 Retry-After 再大也不让用户干等超过这个时长。 */
export const CAPTCHA_MAX_RETRY_DELAY_MS = 5000;

interface ErrorWithResponse {
  response?: { headers?: Record<string, unknown>; status?: number };
  status?: number;
}

function statusOf(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  const candidate = error as ErrorWithResponse;
  const status = candidate.response?.status ?? candidate.status;
  return typeof status === 'number' ? status : undefined;
}

function retryAfterOf(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  const headers = (error as ErrorWithResponse).response?.headers;
  const raw = headers?.['retry-after'] ?? headers?.['Retry-After'];
  if (typeof raw !== 'string' && typeof raw !== 'number') {
    return undefined;
  }
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return undefined;
  }
  return seconds * 1000;
}

/**
 * 判断这次失败是否值得重试。
 *
 * - 没有 HTTP 状态码（网络中断、请求被上一轮会话清理打断、跨域失败）→ 重试；
 * - 408 / 425 / 429 与 5xx（网关、Redis、上游验证码服务抖动）→ 重试；
 * - 其它 4xx（参数错、配置错、封禁）重试也没用，直接失败，避免白白消耗
 *   服务端每秒 30 次的验证码签发额度。
 */
export function isRetryableCaptchaError(error: unknown) {
  const status = statusOf(error);
  if (status === undefined) {
    return true;
  }
  if (status === 408 || status === 425 || status === 429) {
    return true;
  }
  return status >= 500;
}

/**
 * 第 attempt 次重试（从 0 开始）前应等待的时长。
 * 服务端给了 Retry-After 时优先听服务端的，但不无限等待。
 */
export function captchaRetryDelay(error: unknown, attempt: number) {
  const fallback =
    CAPTCHA_RETRY_DELAYS_MS[
      Math.min(Math.max(attempt, 0), CAPTCHA_RETRY_DELAYS_MS.length - 1)
    ] ?? 0;
  const retryAfter = retryAfterOf(error);
  if (retryAfter === undefined) {
    return fallback;
  }
  return Math.min(Math.max(retryAfter, fallback), CAPTCHA_MAX_RETRY_DELAY_MS);
}

export interface CaptchaRetryOptions {
  /** 每次失败后、决定重试前的回调（可用于更新 UI 文案）。 */
  onRetryScheduled?: (error: unknown, attempt: number, delayMs: number) => void;
  /** 等待函数，测试可注入。 */
  sleep?: (ms: number) => Promise<void>;
}

function defaultSleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * 拉取验证码挑战，遇到可重试的失败按退避重试；不可重试或重试用尽时抛出
 * 最后一次的错误。
 */
export async function loadWithCaptchaRetry<T>(
  load: () => Promise<T>,
  options: CaptchaRetryOptions = {},
): Promise<T> {
  const sleep = options.sleep ?? defaultSleep;
  const maxAttempts = CAPTCHA_RETRY_DELAYS_MS.length + 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      const delay = captchaRetryDelay(lastError, attempt - 1);
      options.onRetryScheduled?.(lastError, attempt, delay);
      await sleep(delay);
    }
    try {
      return await load();
    } catch (error) {
      lastError = error;
      if (!isRetryableCaptchaError(error) || attempt === maxAttempts - 1) {
        throw error;
      }
    }
  }

  throw lastError;
}
