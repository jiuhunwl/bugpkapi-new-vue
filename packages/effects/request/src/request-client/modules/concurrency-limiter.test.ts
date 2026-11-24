import { describe, expect, it, vi } from 'vitest';

import {
  GlobalConcurrencyLimiter,
  RequestDisposedError,
} from './concurrency-limiter';

describe('concurrency-limiter', () => {
  it('limits the maximum number of simultaneous acquirers', async () => {
    const limiter = new GlobalConcurrencyLimiter({ max: 2 });
    const release1 = await limiter.acquire();
    const release2 = await limiter.acquire();
    expect(limiter.activeCountValue).toBe(2);

    // 第三个 acquire 排队
    const pendingAcquire = limiter.acquire();
    expect(limiter.pendingCount).toBe(1);

    release1();
    await vi.waitFor(() => expect(limiter.pendingCount).toBe(0));
    const release3 = await pendingAcquire;
    expect(limiter.activeCountValue).toBe(2);

    release2();
    release3();
    expect(limiter.activeCountValue).toBe(0);
  });

  it('releases only once per acquire', async () => {
    const limiter = new GlobalConcurrencyLimiter({ max: 1 });
    const release = await limiter.acquire();
    release();
    release(); // 重复释放应被忽略
    const next = await limiter.acquire();
    next();
    expect(limiter.activeCountValue).toBe(0);
  });

  it('rejects queued waiters after maxWaitMs', async () => {
    vi.useFakeTimers();
    const limiter = new GlobalConcurrencyLimiter({ max: 1, maxWaitMs: 100 });
    const release = await limiter.acquire();
    const pending = limiter.acquire();
    // 先挂载断言，避免推进 fake timers 期间 Promise 先拒绝而产生未处理拒绝
    const rejection = expect(pending).rejects.toMatchObject({
      code: 'CONCURRENCY_TIMEOUT',
      name: 'RequestConcurrencyTimeoutError',
    });

    await vi.advanceTimersByTimeAsync(101);
    await rejection;
    release();
    vi.useRealTimers();
  });

  it('supports bypass detection', () => {
    expect(GlobalConcurrencyLimiter.isBypassed({ skipConcurrency: true })).toBe(
      true,
    );
    expect(
      GlobalConcurrencyLimiter.isBypassed({ skipConcurrency: false }),
    ).toBe(false);
  });

  it('dispose rejects all pending waiters', async () => {
    const limiter = new GlobalConcurrencyLimiter({ max: 1 });
    const release = await limiter.acquire();
    const pending = limiter.acquire();
    limiter.dispose();
    await expect(pending).rejects.toBeInstanceOf(RequestDisposedError);
    release();
    expect(limiter.isDisposed).toBe(true);
  });
});