import type { App } from 'vue';

import { createApp, nextTick, shallowRef } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import TicketPage from './index.vue';

const ticketApi = vi.hoisted(() => ({
  addTicketInternalNote: vi.fn(),
  closeTicket: vi.fn(),
  createTicket: vi.fn(),
  createTicketQuickReply: vi.fn(),
  deleteTicketAttachment: vi.fn(),
  deleteTicketQuickReply: vi.fn(),
  downloadTicketAttachment: vi.fn(),
  getTicketDetail: vi.fn(),
  getTicketList: vi.fn(),
  getTicketQuickReplies: vi.fn(),
  markTicketRead: vi.fn(),
  replyTicket: vi.fn(),
  updateTicket: vi.fn(),
  updateTicketQuickReply: vi.fn(),
  uploadTicketAttachment: vi.fn(),
}));

const realtime = vi.hoisted(() => ({
  onEvent: undefined as
    | ((event: { ticketId: string; type: string }) => Promise<void> | void)
    | undefined,
}));

vi.mock('#/api/ticket', () => ticketApi);
vi.mock('#/api/system/user', () => ({ getUserList: vi.fn() }));
vi.mock('#/locales', () => ({ $t: (key: string) => key }));
vi.mock('@vben/stores', () => ({
  useAccessStore: () => ({
    accessCodes: [
      'ticket:user:attachment',
      'ticket:user:close',
      'ticket:user:create',
      'ticket:user:reply',
    ],
    accessToken: 'test-token',
  }),
  useUserStore: () => ({
    userInfo: { id: '7', username: 'tester' },
    userRoles: ['user'],
  }),
}));
vi.mock('@vben/common-ui', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    Page: defineComponent({
      name: 'Page',
      setup(_props, { slots }) {
        return () => h('main', [slots.extra?.(), slots.default?.()]);
      },
    }),
  };
});
vi.mock('@vben/icons', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    IconifyIcon: defineComponent({
      name: 'IconifyIcon',
      setup() {
        return () => h('i');
      },
    }),
  };
});
vi.mock('ant-design-vue', async () => {
  const { defineComponent, h } = await import('vue');
  const passthrough = (name: string) =>
    defineComponent({
      name,
      setup(_props, { slots }) {
        return () => h('div', slots.default?.());
      },
    });
  return {
    Button: passthrough('Button'),
    message: { success: vi.fn() },
    Tag: passthrough('Tag'),
  };
});
vi.mock('./composables/use-ticket-realtime', () => ({
  useTicketRealtime: vi.fn(
    (options: {
      onEvent: (event: { ticketId: string; type: string }) => void;
    }) => {
      realtime.onEvent = options.onEvent;
      return {
        error: shallowRef(''),
        lastEventAt: shallowRef(),
        restart: vi.fn(),
        status: shallowRef('connected'),
        stop: vi.fn(),
      };
    },
  ),
}));
vi.mock('./components/TicketListPanel.vue', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    default: defineComponent({
      name: 'TicketListPanel',
      props: {
        tickets: { type: Array, default: () => [] },
      },
      emits: ['filter-change', 'select'],
      setup(props, { emit }) {
        return () =>
          h('section', [
            h(
              'button',
              {
                'data-testid': 'select-ticket',
                onClick: () => emit('select', 'ticket-1'),
              },
              'select',
            ),
            h(
              'button',
              {
                'data-testid': 'apply-filter',
                onClick: () => emit('filter-change'),
              },
              'filter',
            ),
            h(
              'output',
              { 'data-testid': 'list-unread' },
              String(
                (props.tickets[0] as { unreadCount?: number })?.unreadCount ??
                  '',
              ),
            ),
          ]);
      },
    }),
  };
});
vi.mock('./components/TicketDetail.vue', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    default: defineComponent({
      name: 'TicketDetail',
      props: {
        detail: { type: Object, default: undefined },
      },
      emits: ['back'],
      setup(props, { emit }) {
        return () =>
          h('section', { 'data-testid': 'ticket-detail' }, [
            h(
              'button',
              {
                'data-testid': 'back-to-list',
                onClick: () => emit('back'),
              },
              'back',
            ),
            h(
              'output',
              { 'data-testid': 'detail-unread' },
              String(
                (
                  props.detail as
                    | { ticket?: { unreadCount?: number } }
                    | undefined
                )?.ticket?.unreadCount ?? '',
              ),
            ),
          ]);
      },
    }),
  };
});
vi.mock('./components/CreateTicketModal.vue', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    default: defineComponent({
      setup() {
        return () => h('div');
      },
    }),
  };
});
vi.mock('./components/TicketQuickReplyManager.vue', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    default: defineComponent({
      setup() {
        return () => h('div');
      },
    }),
  };
});

function emptySummary() {
  return {
    all: 0,
    closed: 0,
    open: 0,
    processing: 0,
    resolved: 0,
    unread: 0,
    waitingUser: 0,
  };
}

function ticket(
  unreadCount = 1,
  lastMessageAt = '2026-08-15 10:00:00',
  messageCount = 1,
) {
  return {
    id: 'ticket-1',
    lastMessageAt,
    messageCount,
    unreadCount,
  };
}

function detail(
  unreadCount = 1,
  lastMessageAt = '2026-08-15 10:00:00',
  messageCount = 1,
) {
  return {
    activities: [],
    attachments: [],
    messages: [],
    ticket: ticket(unreadCount, lastMessageAt, messageCount),
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

const mountedApps: Array<{ app: App; container: HTMLDivElement }> = [];

function mountPage() {
  const container = document.createElement('div');
  document.body.append(container);
  const app = createApp(TicketPage, { mode: 'user' });
  app.mount(container);
  mountedApps.push({ app, container });
  return container;
}

async function flushUpdates() {
  for (let index = 0; index < 4; index += 1) {
    await Promise.resolve();
    await nextTick();
  }
}

async function click(container: HTMLElement, selector: string) {
  const element = container.querySelector<HTMLElement>(selector);
  expect(element).not.toBeNull();
  element?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await flushUpdates();
}

describe('ticket page read state', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    realtime.onEvent = undefined;
    ticketApi.getTicketList.mockResolvedValue({
      items: [ticket()],
      summary: { ...emptySummary(), all: 1, open: 1, unread: 1 },
      total: 1,
    });
    ticketApi.getTicketDetail.mockResolvedValue(detail());
    ticketApi.markTicketRead.mockResolvedValue(true);
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
  });

  afterEach(() => {
    for (const { app, container } of mountedApps.splice(0)) {
      app.unmount();
      container.remove();
    }
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('does not clear unread during SSE refresh after returning to the list', async () => {
    const container = mountPage();
    await flushUpdates();

    await click(container, '[data-testid="select-ticket"]');
    expect(ticketApi.markTicketRead).toHaveBeenCalledTimes(1);

    await click(container, '[data-testid="back-to-list"]');
    ticketApi.getTicketDetail.mockResolvedValue(detail(2));
    realtime.onEvent?.({ ticketId: 'ticket-1', type: 'ticket.message' });
    await vi.advanceTimersByTimeAsync(220);
    await flushUpdates();

    expect(ticketApi.markTicketRead).toHaveBeenCalledTimes(1);
  });

  it('does not clear unread while the browser page is hidden', async () => {
    const container = mountPage();
    await flushUpdates();

    await click(container, '[data-testid="select-ticket"]');
    expect(ticketApi.markTicketRead).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    ticketApi.getTicketDetail.mockResolvedValue(detail(2));
    realtime.onEvent?.({ ticketId: 'ticket-1', type: 'ticket.message' });
    await vi.advanceTimersByTimeAsync(220);
    await flushUpdates();

    expect(ticketApi.markTicketRead).toHaveBeenCalledTimes(1);
  });

  it('does not apply a read response after the user returns to the list', async () => {
    const readRequest = deferred<boolean>();
    ticketApi.markTicketRead.mockReturnValueOnce(readRequest.promise);
    const container = mountPage();
    await flushUpdates();

    await click(container, '[data-testid="select-ticket"]');
    expect(ticketApi.markTicketRead).toHaveBeenCalledWith('ticket-1', {
      lastMessageAt: '2026-08-15 10:00:00',
      messageCount: 1,
    });

    await click(container, '[data-testid="back-to-list"]');
    readRequest.resolve(true);
    await flushUpdates();

    expect(
      container.querySelector('[data-testid="list-unread"]')?.textContent,
    ).toBe('1');
  });

  it('does not let an older read response clear a same-second SSE message', async () => {
    const readRequest = deferred<boolean>();
    ticketApi.markTicketRead.mockReturnValueOnce(readRequest.promise);
    const container = mountPage();
    await flushUpdates();

    await click(container, '[data-testid="select-ticket"]');
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    ticketApi.getTicketList.mockResolvedValue({
      items: [ticket(2, '2026-08-15 10:00:00', 2)],
      summary: { ...emptySummary(), all: 1, open: 1, unread: 2 },
      total: 1,
    });
    ticketApi.getTicketDetail.mockResolvedValue(
      detail(2, '2026-08-15 10:00:00', 2),
    );
    realtime.onEvent?.({ ticketId: 'ticket-1', type: 'ticket.message' });
    await vi.advanceTimersByTimeAsync(220);
    await flushUpdates();
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });

    readRequest.resolve(true);
    await flushUpdates();

    expect(
      container.querySelector('[data-testid="detail-unread"]')?.textContent,
    ).toBe('2');
  });
});

describe('ticket page empty state', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    realtime.onEvent = undefined;
    ticketApi.getTicketList.mockResolvedValue({
      items: [],
      summary: emptySummary(),
      total: 0,
    });
  });

  afterEach(() => {
    for (const { app, container } of mountedApps.splice(0)) {
      app.unmount();
      container.remove();
    }
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('renders only the list empty state when there are no tickets', async () => {
    const container = mountPage();
    await flushUpdates();

    expect(
      container.querySelector('[data-testid="select-ticket"]'),
    ).not.toBeNull();
    expect(container.querySelector('[data-testid="ticket-detail"]')).toBeNull();
  });

  it('removes a pending detail pane when filtering produces no tickets', async () => {
    const detailRequest = deferred<ReturnType<typeof detail>>();
    ticketApi.getTicketList
      .mockResolvedValueOnce({
        items: [ticket()],
        summary: { ...emptySummary(), all: 1, open: 1, unread: 1 },
        total: 1,
      })
      .mockResolvedValueOnce({
        items: [],
        summary: emptySummary(),
        total: 0,
      });
    ticketApi.getTicketDetail.mockReturnValueOnce(detailRequest.promise);
    const container = mountPage();
    await flushUpdates();

    await click(container, '[data-testid="select-ticket"]');
    expect(
      container.querySelector('[data-testid="ticket-detail"]'),
    ).not.toBeNull();

    await click(container, '[data-testid="apply-filter"]');
    expect(container.querySelector('[data-testid="ticket-detail"]')).toBeNull();

    detailRequest.resolve(detail());
    await flushUpdates();
    expect(container.querySelector('[data-testid="ticket-detail"]')).toBeNull();
  });
});
