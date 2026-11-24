import { describe, expect, it, vi } from 'vitest';

import {
  classifyError,
  createRetryPolicy,
  isCancelError,
  sleep,
} from './retry-policy';

describe('retry-policy', () => {
  describe('classifyError', () => {
    it('classifies axios network errors as retriable', () => {
      const error = new Error('Network Error');
      Object.assign(error, { isAxiosError: true, code: 'ERR_NETWORK' });
      expect(classifyError(error)).toBe('network');
    });

    it('classifies timeout errors (ECONNABORTED) as retriable', () => {
      const error = new Error('timeout of 8000ms exceeded');
      Object.assign(error, { isAxiosError: true, code: 'ECONNABORTED' });
      expect(classifyError(error)).toBe('timeout');
    });

    it('classifies HTTP 5xx as http5xx (not retried by default)', () => {
      const error = new Error('Request failed with status code 500');
      Object.assign(error, { isAxiosError: true, response: { status: 500 } });
      expect(classifyError(error)).toBe('http5xx');
    });

    it('classifies HTTP 522 separately', () => {
      const error = new Error('Request failed with status code 522');
      Object.assign(error, { isAxiosError: true, response: { status: 522 } });
      expect(classifyError(error)).toBe('http522');
    });

    it('does not classify cancelled errors', () => {
      const error = new Error('canceled');
      Object.assign(error, { isAxiosError: true, code: 'ERR_CANCELED' });
      expect(classifyError(error)).toBeNull();
      expect(isCancelError(error)).toBe(true);
    });

    it('does not classify unknown errors', () => {
      expect(classifyError(new Error('boom'))).toBeNull();
    });
  });

  describe('createRetryPolicy', () => {
    it('uses default maxRetries=1', () => {
      const policy = createRetryPolicy();
      expect(policy.maxRetries).toBe(1);
      expect(policy.baseDelayMs).toBe(300);
      expect(policy.maxDelayMs).toBe(2000);
      expect(policy.jitterRatio).toBe(0.3);
    });

    it('retries GET network/timeout errors only', () => {
      const policy = createRetryPolicy();
      const networkError = new Error('Network Error');
      Object.assign(networkError, { isAxiosError: true, code: 'ERR_NETWORK' });
      const timeoutError = new Error('timeout exceeded');
      Object.assign(timeoutError, { isAxiosError: true, code: 'ECONNABORTED' });
      const http500 = new Error('500');
      Object.assign(http500, { isAxiosError: true, response: { status: 500 } });

      expect(policy.shouldRetry(networkError, 'GET')).toBe(true);
      expect(policy.shouldRetry(timeoutError, 'GET')).toBe(true);
      expect(policy.shouldRetry(http500, 'GET')).toBe(false);
    });

    it('does not retry non-idempotent methods', () => {
      const policy = createRetryPolicy();
      const networkError = new Error('Network Error');
      Object.assign(networkError, { isAxiosError: true, code: 'ERR_NETWORK' });
      expect(policy.shouldRetry(networkError, 'POST')).toBe(false);
      expect(policy.shouldRetry(networkError, 'PUT')).toBe(false);
      expect(policy.shouldRetry(networkError, 'DELETE')).toBe(false);
    });

    it('respects custom isRetriableError fallback', () => {
      const policy = createRetryPolicy({
        isRetriableError: () => true,
      });
      expect(policy.shouldRetry(new Error('anything'), 'POST')).toBe(true);
    });

    it('computes backoff within bounds with jitter', () => {
      const policy = createRetryPolicy({ baseDelayMs: 300, maxDelayMs: 2000 });
      vi.spyOn(Math, 'random').mockReturnValue(0);
      expect(policy.delayForAttempt(1)).toBe(300);
      expect(policy.delayForAttempt(2)).toBe(600);
      expect(policy.delayForAttempt(3)).toBe(1200);
      vi.restoreAllMocks();
    });

    it('caps the backoff at maxDelayMs', () => {
      const policy = createRetryPolicy({ baseDelayMs: 300, maxDelayMs: 2000 });
      vi.spyOn(Math, 'random').mockReturnValue(0);
      expect(policy.delayForAttempt(10)).toBeLessThanOrEqual(2000);
      vi.restoreAllMocks();
    });
  });

  describe('sleep', () => {
    it('resolves after the delay', async () => {
      vi.useFakeTimers();
      const promise = sleep(300);
      const assertion = expect(promise).resolves.toBeUndefined();
      await vi.advanceTimersByTimeAsync(300);
      await assertion;
      vi.useRealTimers();
    });
  });
});