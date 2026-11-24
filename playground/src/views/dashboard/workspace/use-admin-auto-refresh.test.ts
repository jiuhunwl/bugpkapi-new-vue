// @vitest-environment jsdom

import { createApp, defineComponent, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ADMIN_AUTO_REFRESH_STORAGE_KEY,
  useAdminAutoRefresh,
} from './use-admin-auto-refresh';

function setDocumentVisibility(value: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

function mountAutoRefresh(refresh: () => Promise<void>) {
  let controls:
    | ReturnType<typeof useAdminAutoRefresh>
    | undefined;
  const host = document.createElement('div');
  const app = createApp(
    defineComponent({
      setup() {
        controls = useAdminAutoRefresh(refresh);
        return () => null;
      },
    }),
  );
  app.mount(host);
  return {
    app,
    controls: controls!,
  };
}

describe('useAdminAutoRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    setDocumentVisibility('visible');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses the saved interval and persists page changes', async () => {
    localStorage.setItem(ADMIN_AUTO_REFRESH_STORAGE_KEY, '10');
    const refresh = vi.fn(async () => {});
    const { app, controls } = mountAutoRefresh(refresh);

    expect(controls.intervalSeconds.value).toBe(10);
    await vi.advanceTimersByTimeAsync(9999);
    expect(refresh).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledTimes(1);

    controls.setIntervalSeconds(17);
    await nextTick();
    expect(localStorage.getItem(ADMIN_AUTO_REFRESH_STORAGE_KEY)).toBe('17');
    await vi.advanceTimersByTimeAsync(16_999);
    expect(refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledTimes(2);

    app.unmount();
  });

  it('supports disabling refresh and pauses while the page is hidden', async () => {
    const refresh = vi.fn(async () => {});
    const { app, controls } = mountAutoRefresh(refresh);

    setDocumentVisibility('hidden');
    await nextTick();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(refresh).not.toHaveBeenCalled();

    setDocumentVisibility('visible');
    await nextTick();
    await vi.advanceTimersByTimeAsync(5000);
    expect(refresh).toHaveBeenCalledTimes(1);

    controls.setIntervalSeconds(0);
    await nextTick();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(refresh).toHaveBeenCalledTimes(1);

    app.unmount();
  });

  it('normalizes custom intervals to safe page bounds', async () => {
    const refresh = vi.fn(async () => {});
    const { app, controls } = mountAutoRefresh(refresh);

    controls.setIntervalSeconds(1);
    await nextTick();
    expect(controls.intervalSeconds.value).toBe(5);
    expect(localStorage.getItem(ADMIN_AUTO_REFRESH_STORAGE_KEY)).toBe('5');

    controls.setIntervalSeconds(9999);
    await nextTick();
    expect(controls.intervalSeconds.value).toBe(3600);

    app.unmount();
  });
});
