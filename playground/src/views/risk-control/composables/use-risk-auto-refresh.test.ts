// @vitest-environment jsdom

import { createApp, defineComponent } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useRiskAutoRefresh } from './use-risk-auto-refresh';

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

function mountRiskAutoRefresh(refresh: () => Promise<void>) {
  let refreshNow: (() => Promise<void>) | undefined;
  const host = document.createElement('div');
  const app = createApp(
    defineComponent({
      setup() {
        ({ refreshNow } = useRiskAutoRefresh(refresh, { intervalMs: 1000 }));
        return () => null;
      },
    }),
  );
  app.mount(host);
  return {
    app,
    refreshNow() {
      return refreshNow!();
    },
  };
}

describe('useRiskAutoRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces concurrent triggers into one trailing refresh', async () => {
    const resolvers: Array<() => void> = [];
    const refresh = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const { app, refreshNow } = mountRiskAutoRefresh(refresh);
    await flushPromises();
    expect(refresh).toHaveBeenCalledTimes(1);

    const firstManual = refreshNow();
    const secondManual = refreshNow();
    expect(firstManual).toBe(secondManual);
    await vi.advanceTimersByTimeAsync(5000);
    expect(refresh).toHaveBeenCalledTimes(1);

    resolvers.shift()?.();
    await flushPromises();
    expect(refresh).toHaveBeenCalledTimes(2);

    let settled = false;
    void firstManual.then(() => {
      settled = true;
    });
    await flushPromises();
    expect(settled).toBe(false);

    resolvers.shift()?.();
    await firstManual;
    expect(settled).toBe(true);

    app.unmount();
    await vi.advanceTimersByTimeAsync(5000);
    await refreshNow();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('does not run a queued refresh after unmount', async () => {
    let resolveRefresh: (() => void) | undefined;
    const refresh = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    const { app, refreshNow } = mountRiskAutoRefresh(refresh);
    await flushPromises();
    const active = refreshNow();
    expect(refresh).toHaveBeenCalledTimes(1);

    app.unmount();
    resolveRefresh?.();
    await active;
    await vi.advanceTimersByTimeAsync(5000);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
