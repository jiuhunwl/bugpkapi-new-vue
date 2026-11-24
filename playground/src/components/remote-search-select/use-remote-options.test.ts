import { describe, expect, it, vi } from 'vitest';

import { useRemoteOptions } from './use-remote-options';

function cancelError(): Error {
  const error = new Error('canceled');
  (error as any).code = 'ERR_CANCELED';
  (error as any).name = 'CanceledError';
  return error;
}

describe('useRemoteOptions', () => {
  it('debounces rapid input into one request', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockResolvedValue([]);
    const { search } = useRemoteOptions(fetcher as any, 300);
    search('a');
    search('ab');
    search('abc');
    expect(fetcher).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(300);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith('abc', expect.any(AbortSignal));
    vi.useRealTimers();
  });

  it('stale responses never overwrite the latest result', async () => {
    const first = new Promise<Array<{ label: string; value: string }>>(() => {});
    const fetcher = vi
      .fn()
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce([{ label: 'new', value: '2' }]);
    const { load, options } = useRemoteOptions(fetcher as any);
    load('a');
    load('ab');
    await vi.waitFor(() => expect(options.value).toEqual([{ label: 'new', value: '2' }]));
  });

  it('aborted requests keep previous options and clear loading', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce([{ label: 'old', value: '1' }])
      .mockImplementationOnce(() => Promise.reject(cancelError()));
    const { load, options, loading } = useRemoteOptions(fetcher as any);
    await load('a');
    expect(options.value).toEqual([{ label: 'old', value: '1' }]);
    const pending = load('ab');
    await pending;
    expect(options.value).toEqual([{ label: 'old', value: '1' }]);
    expect(loading.value).toBe(false);
  });

  it('dispose aborts in-flight request', async () => {
    let captured: AbortSignal | undefined;
    const fetcher = vi.fn().mockImplementation((_kw: string, signal: AbortSignal) => {
      captured = signal;
      return new Promise(() => {});
    });
    const { load, dispose } = useRemoteOptions(fetcher as any);
    load('a');
    dispose();
    expect(captured?.aborted).toBe(true);
  });
});
