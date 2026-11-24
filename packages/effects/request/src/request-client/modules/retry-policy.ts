import type { RetriableError } from '../types';

import axios from 'axios';

import {
  BACKOFF_BASE_MS,
  BACKOFF_MAX_MS,
  JITTER_RATIO,
  MAX_RETRY,
} from '../constants';
import { CircuitOpenError, RequestConcurrencyTimeoutError } from '../errors';

/**
 * 判断错误是否由主动取消（abort）产生。
 * 取消不被视为失败：不计数、不重试、不计熔断。
 */
export function isCancelError(error: unknown): boolean {
  if (typeof axios.isCancel === 'function' && axios.isCancel(error)) {
    return true;
  }
  if (axios.isAxiosError(error)) {
    return error.code === 'ERR_CANCELED';
  }
  return false;
}

/**
 * 错误分类：将未知错误归类为可重试类型。
 * - network / timeout：可重试
 * - http5xx / http522：默认不重试（防风暴），但会作为熔断失败计数
 * - 取消 / 4xx / 未知：null（不重试）
 */
export function classifyError(error: unknown): RetriableError | null {
  if (isCancelError(error)) {
    return null;
  }
  if (error instanceof RequestConcurrencyTimeoutError) {
    return 'timeout';
  }
  if (error instanceof CircuitOpenError) {
    return null;
  }
  if (axios.isAxiosError(error)) {
    const code = error.code;
    const status = error.response?.status;
    if (code === 'ECONNABORTED') {
      return 'timeout';
    }
    if (code === 'ERR_NETWORK' || error.message === 'Network Error') {
      return 'network';
    }
    if (status === 522) {
      return 'http522';
    }
    if (typeof status === 'number' && status >= 500) {
      return 'http5xx';
    }
    return null;
  }
  return null;
}

export interface CreateRetryPolicyOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterRatio?: number;
  /** 调用方自定义错误分类 fallback（RequestClientConfig.isRetriableError） */
  isRetriableError?: (error: unknown) => boolean;
}

/**
 * 创建重试策略（纯函数工厂），默认值来自 constants.ts：
 * maxRetries=1、baseDelayMs=300、maxDelayMs=2000、jitterRatio=0.3。
 * 规则：GET/HEAD 幂等且 network/timeout 可重试；HTTP 5xx/522 默认不重试但计熔断；
 * abort/取消不重试。
 */
export function createRetryPolicy(
  options: CreateRetryPolicyOptions = {},
): RetryPolicyImpl {
  const policy: RetryPolicyImpl = {
    maxRetries: options.maxRetries ?? MAX_RETRY,
    baseDelayMs: options.baseDelayMs ?? BACKOFF_BASE_MS,
    maxDelayMs: options.maxDelayMs ?? BACKOFF_MAX_MS,
    jitterRatio: options.jitterRatio ?? JITTER_RATIO,
    shouldRetry(error, method) {
      if (typeof options.isRetriableError === 'function') {
        return options.isRetriableError(error);
      }
      if (isCancelError(error)) {
        return false;
      }
      if (error instanceof CircuitOpenError) {
        return false;
      }
      const upperMethod = String(method || 'GET').toUpperCase();
      // 非幂等方法默认不重试
      if (upperMethod !== 'GET' && upperMethod !== 'HEAD') {
        return false;
      }
      const kind = classifyError(error);
      // 仅 network/timeout 在 GET 幂等下可重试；5xx/522 默认不重试（防重试风暴）
      return kind === 'network' || kind === 'timeout';
    },
    delayForAttempt(attempt) {
      const base =
        this.baseDelayMs * 2 ** Math.max(0, Math.min(attempt, 12) - 1);
      const jitter = base * Math.random() * this.jitterRatio;
      return Math.min(this.maxDelayMs, base + jitter);
    },
  };
  return policy;
}

/** 默认重试策略实例（模块级单例，可复用） */
export const defaultRetryPolicy = createRetryPolicy();

/**
 * 延迟等待（供指数退避使用）
 * @param ms 等待毫秒数
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type { RetriableError };

type RetryPolicyImpl = {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number;
  shouldRetry(error: unknown, method: string): boolean;
  delayForAttempt(attempt: number): number;
};