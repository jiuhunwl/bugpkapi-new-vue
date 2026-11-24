import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick } from 'vue';
import AdminRefreshControl from './admin-refresh-control.vue';

vi.mock('@vben/icons', () => ({
  IconifyIcon: { render: () => null },
  RotateCw: { render: () => null },
}));
vi.mock('ant-design-vue', () => ({
  Button: { render: () => null },
  Select: { render: () => null },
  Tooltip: { render: () => null },
}));
vi.mock('#/locales', () => ({ $t: (key: string) => key }));

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
  unmount = undefined;
  document.body.innerHTML = '';
  vi.useRealTimers();
});
describe('overview refresh clock', () => {
  it('advances elapsed time without another HTTP refresh', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-08T00:00:00Z'));
    const target = document.createElement('div');
    document.body.append(target);
    const app = createApp(AdminRefreshControl, {
      intervalSeconds: 0,
      refreshing: false,
      lastSuccessAt: Date.now(),
    });
    app.mount(target);
    unmount = () => app.unmount();
    expect(target.textContent).toContain('0s');
    await vi.advanceTimersByTimeAsync(12_000);
    await nextTick();
    expect(target.textContent).toContain('12s');
  });
  it('does not display a success age before successful overview data', () => {
    const target = document.createElement('div');
    document.body.append(target);
    const app = createApp(AdminRefreshControl, {
      intervalSeconds: 0,
      refreshing: false,
      lastSuccessAt: null,
    });
    app.mount(target);
    unmount = () => app.unmount();
    expect(target.textContent).toContain('autoRefresh.never');
    expect(target.textContent).not.toContain('0s');
  });
});
