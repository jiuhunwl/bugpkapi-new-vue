import { createApp, nextTick, reactive, shallowRef } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTicketRealtime } from './use-ticket-realtime';

const access = reactive({ accessToken: 'fixture-token' });
vi.mock('@vben/hooks', () => ({
  useAppConfig: () => ({ apiURL: '/system-api' }),
}));
vi.mock('@vben/stores', () => ({ useAccessStore: () => access }));
vi.mock('@vben/preferences', () => ({
  preferences: { app: { locale: 'zh-CN' } },
}));
afterEach(() => vi.unstubAllGlobals());

describe('ticket subscription lifecycle', () => {
  it('does not subscribe without permission and stops on permission removal/unmount', async () => {
    const signals: AbortSignal[] = [];
    const fetch = vi.fn(
      (_url: unknown, options: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          signals.push(options.signal);
          options.signal.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );
    vi.stubGlobal('fetch', fetch);
    const enabled = shallowRef(false);
    let subscription!: ReturnType<typeof useTicketRealtime>;
    const root = document.createElement('div');
    const app = createApp({
      setup() {
        subscription = useTicketRealtime({
          enabled: () => enabled.value,
          onEvent: () => {},
        });
        return () => null;
      },
    });
    try {
      app.mount(root);
      await nextTick();
      expect(fetch).not.toHaveBeenCalled();
      expect(subscription.status.value).toBe('offline');
      enabled.value = true;
      await nextTick();
      expect(fetch).toHaveBeenCalledTimes(1);
      enabled.value = false;
      await nextTick();
      expect(signals[0]?.aborted).toBe(true);
      enabled.value = true;
      await nextTick();
      expect(fetch).toHaveBeenCalledTimes(2);
    } finally {
      app.unmount();
    }
    expect(signals.at(-1)?.aborted).toBe(true);
  });
});
