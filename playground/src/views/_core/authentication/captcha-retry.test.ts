import { describe, expect, it, vi } from 'vitest';

import {
  CAPTCHA_MAX_RETRY_DELAY_MS,
  CAPTCHA_RETRY_DELAYS_MS,
  captchaRetryDelay,
  isRetryableCaptchaError,
  loadWithCaptchaRetry,
} from './captcha-retry';

function httpError(status: number, headers?: Record<string, string>) {
  return Object.assign(new Error(`HTTP ${status}`), {
    response: { headers, status },
  });
}

function networkError() {
  return new Error('Network Error');
}

describe('isRetryableCaptchaError', () => {
  it('retries transient gateway and server failures', () => {
    expect(isRetryableCaptchaError(httpError(429))).toBe(true);
    expect(isRetryableCaptchaError(httpError(408))).toBe(true);
    expect(isRetryableCaptchaError(httpError(502))).toBe(true);
    expect(isRetryableCaptchaError(httpError(503))).toBe(true);
  });

  it('retries failures without an HTTP response', () => {
    expect(isRetryableCaptchaError(networkError())).toBe(true);
    expect(isRetryableCaptchaError(undefined)).toBe(true);
  });

  it('does not retry deterministic client errors', () => {
    expect(isRetryableCaptchaError(httpError(400))).toBe(false);
    expect(isRetryableCaptchaError(httpError(401))).toBe(false);
    expect(isRetryableCaptchaError(httpError(403))).toBe(false);
    expect(isRetryableCaptchaError(httpError(404))).toBe(false);
  });
});

describe('captchaRetryDelay', () => {
  it('uses the built-in backoff schedule', () => {
    expect(captchaRetryDelay(undefined, 0)).toBe(CAPTCHA_RETRY_DELAYS_MS[0]);
    expect(captchaRetryDelay(undefined, 1)).toBe(CAPTCHA_RETRY_DELAYS_MS[1]);
    expect(captchaRetryDelay(undefined, 99)).toBe(
      CAPTCHA_RETRY_DELAYS_MS.at(-1),
    );
  });

  it('honours Retry-After but never waits forever', () => {
    expect(captchaRetryDelay(httpError(429, { 'retry-after': '2' }), 0)).toBe(
      2000,
    );
    expect(captchaRetryDelay(httpError(429, { 'retry-after': '600' }), 0)).toBe(
      CAPTCHA_MAX_RETRY_DELAY_MS,
    );
  });
});

describe('loadWithCaptchaRetry', () => {
  it('returns the first successful response without sleeping', async () => {
    const load = vi.fn().mockResolvedValue({ captchaId: 'c1' });
    const sleep = vi.fn();

    await expect(loadWithCaptchaRetry(load, { sleep })).resolves.toEqual({
      captchaId: 'c1',
    });
    expect(load).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('recovers when a transient failure is followed by success', async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(httpError(503))
      .mockRejectedValueOnce(networkError())
      .mockResolvedValue({ captchaId: 'c2' });
    const sleep = vi.fn().mockResolvedValue(undefined);
    const onRetryScheduled = vi.fn();

    await expect(
      loadWithCaptchaRetry(load, { onRetryScheduled, sleep }),
    ).resolves.toEqual({ captchaId: 'c2' });
    expect(load).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(onRetryScheduled).toHaveBeenCalledTimes(2);
  });

  it('stops immediately on a non-retryable error', async () => {
    const error = httpError(400);
    const load = vi.fn().mockRejectedValue(error);
    const sleep = vi.fn();

    await expect(loadWithCaptchaRetry(load, { sleep })).rejects.toBe(error);
    expect(load).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('gives up after the configured attempts', async () => {
    const error = httpError(503);
    const load = vi.fn().mockRejectedValue(error);
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(loadWithCaptchaRetry(load, { sleep })).rejects.toBe(error);
    expect(load).toHaveBeenCalledTimes(CAPTCHA_RETRY_DELAYS_MS.length + 1);
  });
});
