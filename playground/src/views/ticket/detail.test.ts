import type { App } from 'vue';
import { createApp, nextTick, reactive, shallowRef } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DetailPage from './detail.vue';

const api = vi.hoisted(() => ({
  addTicketInternalNote: vi.fn(),
  closeTicket: vi.fn(),
  createTicketQuickReply: vi.fn(),
  deleteTicketAttachment: vi.fn(),
  deleteTicketQuickReply: vi.fn(),
  downloadTicketAttachment: vi.fn(),
  getTicketDetail: vi.fn(),
  getTicketQuickReplies: vi.fn(),
  markTicketRead: vi.fn(),
  replyTicket: vi.fn(),
  updateTicket: vi.fn(),
  updateTicketQuickReply: vi.fn(),
  uploadTicketAttachment: vi.fn(),
}));
const access = vi.hoisted(() => ({ accessCodes: [] as string[] }));
const realtime = vi.hoisted(() => ({
  event: undefined as undefined | ((event: { ticketId: string }) => void),
}));
const route = reactive({
  params: { id: 'ticket-1' },
  query: { keyword: 'billing', page: '3', pageSize: '50' },
});
const push = vi.fn();
vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({ push }),
}));
vi.mock('#/api/ticket', () => api);
vi.mock('#/api/system/user', () => ({ getUserList: vi.fn() }));
vi.mock('#/locales', () => ({ $t: (key: string) => key }));
vi.mock('@vben/stores', () => ({
  useAccessStore: () => access,
  useUserStore: () => ({ userInfo: { id: '7' }, userRoles: ['user'] }),
}));
vi.mock('@vben/common-ui', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    Page: defineComponent({
      setup(_, { slots }) {
        return () => h('main', [slots.extra?.(), slots.default?.()]);
      },
    }),
  };
});
vi.mock('ant-design-vue', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    message: { success: vi.fn() },
    Result: defineComponent({
      setup() {
        return () => h('div', 'Forbidden');
      },
    }),
  };
});
vi.mock('./composables/use-ticket-realtime', () => ({
  useTicketRealtime: (options: {
    onEvent: (event: { ticketId: string }) => void;
  }) => {
    realtime.event = options.onEvent;
    return { status: shallowRef('connected') };
  },
}));
vi.mock('./components/TicketDetail.vue', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    default: defineComponent({
      props: ['detail', 'draft'],
      emits: ['back', 'reply', 'update:draft', 'attachment-delete'],
      setup(props, { emit }) {
        return () =>
          h('section', [
            h(
              'output',
              { 'data-unread': '' },
              String(props.detail?.ticket.unreadCount ?? ''),
            ),
            h(
              'button',
              {
                'data-delete': '',
                onClick: () =>
                  emit('attachment-delete', { id: 'attachment-1' }),
              },
              'Delete',
            ),
            h('textarea', {
              value: props.draft,
              onInput: (event: Event) =>
                emit(
                  'update:draft',
                  (event.target as HTMLTextAreaElement).value,
                ),
            }),
            h(
              'button',
              { 'data-reply': '', onClick: () => emit('reply', 'reply') },
              'Reply',
            ),
            h(
              'button',
              { 'data-back': '', onClick: () => emit('back') },
              'Back',
            ),
          ]);
      },
    }),
  };
});
vi.mock('./components/TicketQuickReplyManager.vue', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    default: defineComponent({
      emits: ['save'],
      setup(_, { emit }) {
        return () =>
          h(
            'button',
            {
              'data-create-quick': '',
              onClick: () => emit('save', undefined, { title: 'Fixture' }),
            },
            'Create quick reply',
          );
      },
    }),
  };
});
const apps: Array<{ app: App; container: HTMLDivElement }> = [];
function mount(mode: 'user' | 'admin' = 'user') {
  const container = document.createElement('div');
  document.body.append(container);
  const app = createApp(DetailPage, { mode });
  app.mount(container);
  const item = { app, container };
  apps.push(item);
  return item;
}
async function flush() {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
    await nextTick();
  }
}
function detail(id = 'ticket-1', count = 1) {
  return {
    ticket: {
      id,
      ticketNo: 'T-1',
      subject: 'Fixture',
      status: 'OPEN',
      unreadCount: count,
      messageCount: count,
      lastMessageAt: '2026-10-01 00:00:0' + count,
    },
    messages: [],
    attachments: [],
    activities: [],
  };
}

describe('standalone ticket detail lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    route.params.id = 'ticket-1';
    access.accessCodes = ['ticket:user:list', 'ticket:user:reply'];
    api.getTicketDetail.mockResolvedValue(detail());
    api.markTicketRead.mockResolvedValue(true);
    api.getTicketQuickReplies.mockResolvedValue([]);
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
  });
  afterEach(() => {
    for (const x of apps.splice(0)) {
      x.app.unmount();
      x.container.remove();
    }
    vi.useRealTimers();
  });
  it('loads once and returns to the same list filters and page', async () => {
    const { container } = mount();
    await flush();
    expect(api.getTicketDetail).toHaveBeenCalledTimes(1);
    expect(api.markTicketRead).toHaveBeenCalledTimes(1);
    container.querySelector<HTMLElement>('[data-back]')!.click();
    expect(push).toHaveBeenCalledWith({
      name: 'UserTicketCenter',
      query: { keyword: 'billing', page: '3', pageSize: '50' },
    });
  });
  it('does not mark a late response read after the detail page unmounts', async () => {
    let resolve!: (value: unknown) => void;
    api.getTicketDetail.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const item = mount();
    await flush();
    const signal = api.getTicketDetail.mock.calls[0]?.[1] as AbortSignal;
    item.app.unmount();
    item.container.remove();
    apps.splice(apps.indexOf(item), 1);
    resolve(detail());
    await flush();
    expect(signal.aborted).toBe(true);
    expect(api.markTicketRead).not.toHaveBeenCalled();
  });
  it('clears the draft on another ticket and rejects reply events without permission', async () => {
    access.accessCodes = ['ticket:user:list'];
    const { container } = mount();
    await flush();
    const input = container.querySelector('textarea')!;
    input.value = 'Do not leak this draft';
    input.dispatchEvent(new Event('input'));
    await flush();
    container.querySelector<HTMLElement>('[data-reply]')!.click();
    expect(api.replyTicket).not.toHaveBeenCalled();
    api.getTicketDetail.mockResolvedValue(detail('ticket-2'));
    route.params.id = 'ticket-2';
    await flush();
    expect(input.value).toBe('');
  });
  it('keeps newer unread metadata when an older read acknowledgement arrives', async () => {
    let resolve!: (value: boolean) => void;
    api.markTicketRead
      .mockImplementationOnce(
        () =>
          new Promise((r) => {
            resolve = r;
          }),
      )
      .mockResolvedValue(false);
    const { container } = mount();
    await flush();
    api.getTicketDetail.mockResolvedValue(detail('ticket-1', 2));
    realtime.event?.({ ticketId: 'ticket-1' });
    await vi.advanceTimersByTimeAsync(250);
    await flush();
    resolve(true);
    await flush();
    expect(container.querySelector('[data-unread]')?.textContent).toBe('2');
  });
  it('does not let an old attachment operation cancel the next ticket load', async () => {
    access.accessCodes.push('ticket:user:attachment');
    let finishDelete!: (value: boolean) => void;
    api.deleteTicketAttachment.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          finishDelete = resolve;
        }),
    );
    const { container } = mount();
    await flush();
    container.querySelector<HTMLElement>('[data-delete]')!.click();
    let finishNext!: (value: ReturnType<typeof detail>) => void;
    api.getTicketDetail.mockImplementationOnce(
      () =>
        new Promise<ReturnType<typeof detail>>((resolve) => {
          finishNext = resolve;
        }),
    );
    route.params.id = 'ticket-2';
    await flush();
    const nextSignal = api.getTicketDetail.mock.calls[1]?.[1] as AbortSignal;
    finishDelete(true);
    await flush();
    expect(api.getTicketDetail).toHaveBeenCalledTimes(2);
    expect(nextSignal.aborted).toBe(false);
    finishNext(detail('ticket-2'));
    await flush();
  });

  it('allows authorized staff to create quick replies', async () => {
    access.accessCodes = ['ticket:admin:list', 'ticket:admin:quick-reply'];
    const { container } = mount('admin');
    await flush();
    container.querySelector<HTMLElement>('[data-create-quick]')!.click();
    await flush();
    expect(api.createTicketQuickReply).toHaveBeenCalledWith({
      title: 'Fixture',
    });
  });
});
