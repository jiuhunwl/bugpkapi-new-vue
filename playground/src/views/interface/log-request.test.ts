import { describe, expect, it, vi } from 'vitest';

import { createLatestRequestRunner } from './log-request';
import logViewSource from './log.vue?raw';
import logQuerySource from './use-call-log-query.ts?raw';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe('latest call-log request runner', () => {
  it('routes VXE page queries through the cursor pager', () => {
    expect(logViewSource).toContain('logQuery.query');
    expect(logQuerySource).toContain('createCallLogCursorPager');
    expect(logQuerySource).toContain('pager.start');
    expect(logQuerySource).toContain('pager.accept');
  });

  it('maps the API envelope when the numbered grid pager is disabled', () => {
    expect(logViewSource).toContain("list: 'items'");
  });

  it('resets the cursor chain before a manual refresh', () => {
    expect(logViewSource).toContain('logQuery.reset();');
    expect(logQuerySource).toContain('pager.reset();');
    expect(logViewSource).toContain('gridApi.reload();');
  });

  it('uses explicit Vben form submission instead of querying on every field change', () => {
    expect(logViewSource).toContain('submitOnChange: false');
    expect(logViewSource).not.toContain('submitOnChange: true');
  });

  it('aborts an obsolete request and lets every waiter receive the latest result', async () => {
    const requests = [deferred<string>(), deferred<string>()];
    const signals: AbortSignal[] = [];
    let index = 0;
    const runner = createLatestRequestRunner(
      (_value: string, signal: AbortSignal) => {
        const current = requests[index++];
        if (!current) throw new Error('unexpected request');
        signals.push(signal);
        signal.addEventListener('abort', () => {
          const error = new Error('canceled');
          error.name = 'CanceledError';
          current.reject(error);
        });
        return current.promise;
      },
    );

    const first = runner.run('old');
    const second = runner.run('latest');

    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);

    requests[1]?.resolve('latest-result');
    await expect(second).resolves.toBe('latest-result');
    await expect(first).resolves.toBe('latest-result');
  });

  it('keeps the replacement result after it finishes before the aborted request settles', async () => {
    const obsolete = deferred<string>();
    let requestIndex = 0;
    const runner = createLatestRequestRunner(
      (_value: string, _signal: AbortSignal) => {
        requestIndex += 1;
        return requestIndex === 1
          ? obsolete.promise
          : Promise.resolve('latest-result');
      },
    );

    const first = runner.run('old');
    const second = runner.run('latest');
    await expect(second).resolves.toBe('latest-result');

    const canceled = new Error('canceled');
    canceled.name = 'CanceledError';
    obsolete.reject(canceled);

    await expect(first).resolves.toBe('latest-result');
  });

  it('retargets an older canceled waiter when another request starts after its first replacement settles', async () => {
    const obsolete = deferred<string>();
    const newest = deferred<string>();
    let requestIndex = 0;
    const runner = createLatestRequestRunner(
      (_value: string, _signal: AbortSignal) => {
        requestIndex += 1;
        if (requestIndex === 1) return obsolete.promise;
        if (requestIndex === 2) return Promise.resolve('intermediate-result');
        return newest.promise;
      },
    );

    const first = runner.run('old');
    await expect(runner.run('intermediate')).resolves.toBe(
      'intermediate-result',
    );
    const latest = runner.run('latest');

    const canceled = new Error('canceled');
    canceled.name = 'CanceledError';
    obsolete.reject(canceled);
    newest.resolve('latest-result');

    await expect(latest).resolves.toBe('latest-result');
    await expect(first).resolves.toBe('latest-result');
  });

  it('aborts the active request when the page is disposed', async () => {
    const request = deferred<string>();
    const onAbort = vi.fn(() => {
      const error = new Error('canceled');
      error.name = 'CanceledError';
      request.reject(error);
    });
    const runner = createLatestRequestRunner(
      (_value: string, signal: AbortSignal) => {
        signal.addEventListener('abort', onAbort);
        return request.promise;
      },
    );

    const result = runner.run('active');
    runner.cancel();

    expect(onAbort).toHaveBeenCalledOnce();
    await expect(result).rejects.toMatchObject({ name: 'CanceledError' });
  });
});
