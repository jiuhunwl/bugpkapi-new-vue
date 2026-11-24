import { createApp, defineComponent, h, nextTick } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import TicketSummary from './TicketSummary.vue';
vi.mock('#/locales', () => ({ $t: (key: string) => key }));
vi.mock('@vben/icons', () => ({
  IconifyIcon: defineComponent({ setup: () => () => h('i') }),
}));

describe('ticket overview values', () => {
  it('uses only server counts and shows placeholders during loading or missing summary', async () => {
    const el = document.createElement('div');
    const summary = {
      all: 20,
      open: 3,
      processing: 4,
      waitingUser: 2,
      resolved: 6,
      closed: 5,
      unread: 8,
    };
    for (const [props, values] of [
      [{ summary, loading: false }, ['20', '9', '8', '11']],
      [{ summary, loading: true }, ['—', '—', '—', '—']],
      [{ loading: false }, ['—', '—', '—', '—']],
      [
        {
          summary: {
            ...summary,
            all: 0,
            open: 0,
            processing: 0,
            waitingUser: 0,
            resolved: 0,
            closed: 0,
            unread: 0,
          },
          loading: false,
        },
        ['0', '0', '0', '0'],
      ],
    ] as const) {
      const app = createApp(TicketSummary, props);
      app.mount(el);
      await nextTick();
      expect(
        [...el.querySelectorAll('strong')].map((n) => n.textContent),
      ).toEqual(values);
      app.unmount();
    }
  });
});
