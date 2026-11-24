/* eslint-disable vue/one-component-per-file -- Isolated mock components exercise the route and attachment panel together. */
import type { App } from 'vue';

import { setImmediate } from 'node:timers/promises';

import { createApp, nextTick, reactive } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { advanceAuthSession } from '#/utils/auth-session-lifecycle';

import DetailPage from './detail.vue';

const api = vi.hoisted(() => ({
  addTicketInternalNote: vi.fn(),
  closeTicket: vi.fn(),
  createTicketQuickReply: vi.fn(),
  deleteTicketAttachment: vi.fn(),
  deleteTicketQuickReply: vi.fn(),
  downloadTicketAttachment: vi.fn(),
  getTicketAttachmentPolicy: vi.fn(),
  getTicketDetail: vi.fn(),
  getTicketQuickReplies: vi.fn(),
  markTicketRead: vi.fn(),
  replyTicket: vi.fn(),
  updateTicket: vi.fn(),
  updateTicketQuickReply: vi.fn(),
  uploadTicketAttachment: vi.fn(),
}));
const notices = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
const route = reactive({ params: { id: 'ticket-1' }, query: {} });
const access = reactive({
  accessToken: 'session-a',
  accessCodes: ['ticket:user:list', 'ticket:user:attachment'],
});
const user = reactive<{ userInfo: null | { id?: string; userId?: string } }>({
  userInfo: { userId: '7' },
});
let submittedFiles: File[] = [];

vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@vben/stores', () => ({
  useAccessStore: () => access,
  useUserStore: () => user,
}));
vi.mock('#/api/ticket', () => api);
vi.mock('#/api/system/user', () => ({ getUserList: vi.fn() }));
vi.mock('#/locales', () => ({
  $t: (key: string, params: unknown[] = []) => key + ' ' + params.join(' | '),
}));
vi.mock('./composables/use-ticket-realtime', () => ({
  useTicketRealtime: vi.fn(),
}));
vi.mock('@vben/icons', async () => {
  const { defineComponent, h } = await import('vue');
  return { IconifyIcon: defineComponent({ setup: () => () => h('i') }) };
});
vi.mock('@vben/common-ui', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    Page: defineComponent({
      setup:
        (_, { slots }) =>
        () =>
          h('main', slots.default?.()),
    }),
  };
});
vi.mock('ant-design-vue', async () => {
  const { defineComponent, h } = await import('vue');
  const box = defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('div', slots.default?.()),
  });
  return {
    message: notices,
    Button: defineComponent({
      props: { disabled: Boolean, loading: Boolean },
      setup:
        (props, { slots }) =>
        () =>
          h(
            'button',
            { disabled: props.disabled, 'aria-busy': props.loading },
            slots.default?.(),
          ),
    }),
    Empty: box,
    Popconfirm: box,
    Result: box,
    Spin: box,
    Tag: box,
    Tooltip: box,
  };
});
vi.mock('./components/TicketQuickReplyManager.vue', async () => {
  const { defineComponent, h } = await import('vue');
  return { default: defineComponent({ setup: () => () => h('div') }) };
});
vi.mock('./components/TicketDetail.vue', async () => {
  const { defineComponent, h, inject } = await import('vue');
  const { default: Panel } =
    await import('./components/TicketAttachmentPanel.vue');
  const { ticketAttachmentPolicyKey } = await import('./attachment-policy');
  return {
    default: defineComponent({
      props: {
        detail: { type: Object, default: undefined },
        attachmentLoading: Boolean,
        canUploadAttachment: Boolean,
        canDeleteAttachment: Boolean,
        currentUserId: { type: String, default: '' },
        isAdmin: Boolean,
      },
      emits: ['attachment-upload', 'attachment-delete', 'attachment-download', 'refresh'],
      setup(props, { emit }) {
        const policy = inject(ticketAttachmentPolicyKey)!;
        return () =>
          h('section', [
            h(
              'output',
              { 'data-detail': '' },
              props.detail?.ticket.subject ?? '',
            ),
            h(
              'button',
              {
                'data-submit': '',
                onClick: () => emit('attachment-upload', submittedFiles),
              },
              'Submit directly',
            ),
            h(
              'button',
              { 'data-reload-policy': '', onClick: () => policy.retry() },
              'Reload policy',
            ),
            h('button', { 'data-refresh-detail': '', onClick: () => emit('refresh') }, 'Refresh detail'),
            h(Panel, {
              attachments: props.detail?.attachments ?? [],
              canUpload:
                props.canUploadAttachment &&
                !!props.detail &&
                props.detail.ticket.status !== 'CLOSED',
              canDelete: props.canDeleteAttachment,
              currentUserId: props.currentUserId,
              isAdmin: props.isAdmin,
              loading: props.attachmentLoading,
              onUpload: (files: File[]) => emit('attachment-upload', files),
            }),
          ]);
      },
    }),
  };
});

const MiB = 1024 * 1024;
const policy = { maxBytes: 3 * MiB, allowedExtensions: ['.txt', '.png'] };
const apps: Array<{ app: App; container: HTMLDivElement }> = [];

function ticket(id = route.params.id, subject = 'Current ticket') {
  return {
    ticket: { id, subject, status: 'OPEN', unreadCount: 0 },
    messages: [],
    attachments: [],
    activities: [],
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function file(name = 'proof.txt', size = 1) {
  return new File([new Uint8Array(size)], name);
}
function mount() {
  const container = document.createElement('div');
  document.body.append(container);
  const app = createApp(DetailPage, { mode: 'user' });
  app.mount(container);
  const item = { app, container };
  apps.push(item);
  return item;
}
async function flush() {
  await setImmediate();
  await nextTick();
}
function uploadButton(container: HTMLElement) {
  return [...container.querySelectorAll('button')].find(
    (button) => button.textContent?.trim() === 'ticket.attachments.upload',
  )!;
}
async function select(container: HTMLElement, files: File[]) {
  uploadButton(container).click();
  const input =
    container.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, 'files', { configurable: true, value: files });
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await flush();
}
async function submit(container: HTMLElement, files: File[]) {
  submittedFiles = files;
  container.querySelector<HTMLButtonElement>('[data-submit]')!.click();
  await flush();
}

beforeEach(() => {
  vi.resetAllMocks();
  route.params.id = 'ticket-1';
  access.accessToken = 'session-a';
  access.accessCodes = ['ticket:user:list', 'ticket:user:attachment'];
  user.userInfo = { userId: '7' };
  submittedFiles = [];
  api.getTicketDetail.mockImplementation(async (id: string) => ticket(id));
  api.getTicketAttachmentPolicy.mockResolvedValue(policy);
  api.uploadTicketAttachment.mockResolvedValue({ id: 'uploaded-1' });
  api.markTicketRead.mockResolvedValue(true);
  api.getTicketQuickReplies.mockResolvedValue([]);
});
afterEach(() => {
  for (const item of apps.splice(0)) {
    item.app.unmount();
    item.container.remove();
  }
});

describe('ticket attachment policy UI and send guards', () => {
  it('disables selection and submission until the authenticated policy arrives and shows its actual cap/types', async () => {
    const pending = deferred<typeof policy>();
    api.getTicketAttachmentPolicy.mockReturnValueOnce(pending.promise);
    const { container } = mount();
    await flush();
    expect(api.getTicketAttachmentPolicy).toHaveBeenCalledTimes(1);
    expect(uploadButton(container).disabled).toBe(true);
    expect(container.textContent).toContain('ticket.attachments.policyLoading');
    expect(container.querySelector<HTMLInputElement>('input')!.disabled).toBe(
      true,
    );
    await submit(container, [file()]);
    expect(api.uploadTicketAttachment).not.toHaveBeenCalled();
    pending.resolve(policy);
    await flush();
    expect(uploadButton(container).disabled).toBe(false);
    expect(container.textContent).toContain('3 MiB');
    expect(container.textContent).toContain('.txt, .png');
    expect(container.querySelector('input')!.getAttribute('accept')).toBe(
      '.txt,.png',
    );
  });

  it('shows retry after failure, keeps selection blocked during retry, and recovers', async () => {
    api.getTicketAttachmentPolicy.mockRejectedValueOnce(new Error('network'));
    const { container } = mount();
    await flush();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'ticket.attachments.policyUnavailable',
    );
    const next = deferred<typeof policy>();
    api.getTicketAttachmentPolicy.mockReturnValueOnce(next.promise);
    [...container.querySelectorAll('button')]
      .find((button) =>
        button.textContent?.includes('ticket.attachments.retryPolicy'),
      )!
      .click();
    await flush();
    expect(uploadButton(container).disabled).toBe(true);
    expect(container.querySelector('[role="alert"]')).toBeNull();
    next.resolve({ ...policy, maxBytes: MiB });
    await flush();
    expect(container.textContent).toContain('1 MiB');
    expect(uploadButton(container).disabled).toBe(false);
    await select(container, [file()]);
    expect(api.uploadTicketAttachment).toHaveBeenCalledWith(
      'ticket-1',
      expect.any(File),
    );
    expect(api.getTicketDetail).toHaveBeenCalledTimes(2);
  });

  it('fails closed on malformed policy and never substitutes a limit', async () => {
    api.getTicketAttachmentPolicy.mockResolvedValueOnce({
      maxBytes: '3145728',
      allowedExtensions: ['.txt'],
    });
    const { container } = mount();
    await flush();
    expect(uploadButton(container).disabled).toBe(true);
    expect(container.textContent).toContain(
      'ticket.attachments.policyUnavailable',
    );
    expect(container.textContent).not.toContain('MiB');
    await submit(container, [file()]);
    expect(api.uploadTicketAttachment).not.toHaveBeenCalled();
  });

  it.each([
    { ...policy, maxBytes: 0 },
    { ...policy, allowedExtensions: [] },
  ])(
    'renders valid but unavailable policy %j without enabling upload',
    async (value) => {
      api.getTicketAttachmentPolicy.mockResolvedValueOnce(value);
      const { container } = mount();
      await flush();
      expect(uploadButton(container).disabled).toBe(true);
      expect(container.textContent).toContain(
        'ticket.attachments.uploadUnavailable',
      );
      expect(container.querySelector('[role="alert"]')).toBeNull();
      if (value.maxBytes === 0)
        expect(container.textContent).toContain('0 MiB');
      await submit(container, [file()]);
      expect(api.uploadTicketAttachment).not.toHaveBeenCalled();
    },
  );

  it('uses the userId returned by the backend user-info endpoint', async () => {
    user.userInfo = { userId: '7' };
    const { container } = mount();
    await flush();
    expect(api.getTicketAttachmentPolicy).toHaveBeenCalledTimes(1);
    expect(uploadButton(container).disabled).toBe(false);
    await select(container, [file('backend-identity.txt')]);
    expect(api.uploadTicketAttachment).toHaveBeenCalledWith('ticket-1', expect.any(File));
  });

  it('does not request policy or submit uploads while logged out', async () => {
    access.accessToken = '';
    const { container } = mount();
    await flush();
    expect(api.getTicketAttachmentPolicy).not.toHaveBeenCalled();
    await submit(container, [file()]);
    expect(api.uploadTicketAttachment).not.toHaveBeenCalled();
    container.querySelector<HTMLButtonElement>('[data-reload-policy]')!.click();
    await flush();
    expect(api.getTicketAttachmentPolicy).not.toHaveBeenCalled();
  });

  it.each([
    ['empty.txt', 0, 'emptyFile'],
    ['big.txt', 3 * MiB + 1, 'tooLarge'],
    ['payload.png.exe', 1, 'typeNotAllowed'],
  ])(
    'rejects %s both on selection and on a direct final-send event',
    async (name, size, key) => {
      const { container } = mount();
      await flush();
      const invalid = file(name, size);
      await select(container, [file(), invalid]);
      expect(api.uploadTicketAttachment).not.toHaveBeenCalled();
      expect(notices.error).toHaveBeenLastCalledWith(
        expect.stringContaining('ticket.attachments.' + key),
      );
      await submit(container, [invalid]);
      expect(api.uploadTicketAttachment).not.toHaveBeenCalled();
      expect(notices.error).toHaveBeenCalledTimes(2);
    },
  );

  it('accepts mixed-case extensions at the exact effective limit', async () => {
    const { container } = mount();
    await flush();
    const boundary = file('photo.PNG', 3 * MiB);
    await select(container, [boundary]);
    expect(api.uploadTicketAttachment).toHaveBeenCalledWith(
      'ticket-1',
      boundary,
    );
    expect(notices.error).not.toHaveBeenCalled();
  });

  it('revalidates queued files after awaiting an earlier upload', async () => {
    const first = deferred<{ id: string }>();
    api.uploadTicketAttachment.mockReturnValueOnce(first.promise);
    const { container } = mount();
    await flush();
    await select(container, [file('first.txt'), file('second.txt', 2 * MiB)]);
    api.getTicketAttachmentPolicy.mockResolvedValueOnce({
      ...policy,
      maxBytes: MiB,
    });
    container.querySelector<HTMLButtonElement>('[data-reload-policy]')!.click();
    await flush();
    first.resolve({ id: 'first' });
    await flush();
    expect(api.uploadTicketAttachment).toHaveBeenCalledTimes(1);
    expect(notices.error).toHaveBeenCalledWith(
      expect.stringContaining('ticket.attachments.tooLarge second.txt | 1 MiB'),
    );
    expect(api.getTicketDetail).toHaveBeenCalledTimes(2);
    expect(uploadButton(container).disabled).toBe(false);
  });

  it('stops queued uploads when the ticket closes during the first upload', async () => {
    const first = deferred<{ id: string }>();
    api.uploadTicketAttachment.mockReturnValueOnce(first.promise);
    const { container } = mount();
    await flush();
    await select(container, [file('first.txt'), file('second.txt')]);
    const closed = { ...ticket(), ticket: { ...ticket().ticket, status: 'CLOSED' } };
    api.getTicketDetail.mockResolvedValue(closed);
    container.querySelector<HTMLButtonElement>('[data-refresh-detail]')!.click();
    await flush();
    first.resolve({ id: 'first' });
    await flush();
    expect(api.uploadTicketAttachment).toHaveBeenCalledTimes(1);
    expect(notices.success).not.toHaveBeenCalled();
    expect(uploadButton(container)).toBeUndefined();
  });

  it('refreshes successful attachments when a later upload fails', async () => {
    api.uploadTicketAttachment
      .mockResolvedValueOnce({ id: 'first' })
      .mockRejectedValueOnce(new Error('upload failed'));
    api.getTicketDetail.mockResolvedValueOnce(ticket()).mockResolvedValueOnce({
      ...ticket(),
      attachments: [
        {
          id: 'first',
          originalName: 'first.txt',
          sizeBytes: 1,
          contentType: 'text/plain',
          uploaderName: 'User',
          uploaderId: '7',
        },
      ],
    });
    const { container } = mount();
    await flush();
    await select(container, [
      file('first.txt'),
      file('second.txt'),
      file('third.txt'),
    ]);
    expect(api.uploadTicketAttachment).toHaveBeenCalledTimes(2);
    expect(api.getTicketDetail).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('first.txt');
    expect(notices.success).not.toHaveBeenCalled();
    expect(uploadButton(container).disabled).toBe(false);
  });
});

describe('attachment request ownership', () => {
  it.each(['ticket', 'account'] as const)(
    'ignores late policy and detail from an old %s',
    async (change) => {
      const oldPolicy = deferred<typeof policy>();
      const oldDetail = deferred<ReturnType<typeof ticket>>();
      api.getTicketAttachmentPolicy.mockReturnValueOnce(oldPolicy.promise);
      api.getTicketDetail.mockReturnValueOnce(oldDetail.promise);
      const { container } = mount();
      await flush();
      const oldSignal = api.getTicketAttachmentPolicy.mock
        .calls[0]![0] as AbortSignal;
      api.getTicketAttachmentPolicy.mockResolvedValueOnce({
        maxBytes: MiB,
        allowedExtensions: ['.pdf'],
      });
      if (change === 'ticket') route.params.id = 'ticket-2';
      else user.userInfo = { userId: '8' };
      await flush();
      expect(oldSignal.aborted).toBe(true);
      oldPolicy.resolve(policy);
      oldDetail.resolve(ticket('ticket-1', 'Stale detail'));
      await flush();
      expect(container.textContent).toContain('1 MiB');
      expect(container.textContent).not.toContain('3 MiB');
      expect(container.textContent).not.toContain('Stale detail');
      expect(container.querySelector('input')!.getAttribute('accept')).toBe(
        '.pdf',
      );
    },
  );

  it('does not let an old policy error end the next request loading state', async () => {
    const old = deferred<typeof policy>();
    const next = deferred<typeof policy>();
    api.getTicketAttachmentPolicy
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(next.promise);
    const { container } = mount();
    await flush();
    route.params.id = 'ticket-2';
    await flush();
    old.reject(new Error('old failure'));
    await flush();
    expect(container.textContent).toContain('ticket.attachments.policyLoading');
    expect(container.querySelector('[role="alert"]')).toBeNull();
    next.resolve(policy);
    await flush();
    expect(uploadButton(container).disabled).toBe(false);
  });

  it('rejects pre-logout responses even when the same account and ticket return', async () => {
    const old = deferred<typeof policy>();
    api.getTicketAttachmentPolicy.mockReturnValueOnce(old.promise);
    const { container } = mount();
    await flush();
    advanceAuthSession();
    access.accessToken = '';
    await flush();
    expect(api.getTicketAttachmentPolicy).toHaveBeenCalledTimes(1);
    api.getTicketAttachmentPolicy.mockResolvedValueOnce({
      ...policy,
      maxBytes: MiB,
    });
    advanceAuthSession();
    access.accessToken = 'session-b';
    await flush();
    old.resolve(policy);
    await flush();
    expect(api.getTicketAttachmentPolicy).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('1 MiB');
    expect(container.textContent).not.toContain('3 MiB');
  });

  it.each(['ticket', 'account'] as const)(
    'stops the old upload batch on a %s switch without clearing a new upload or refreshing its detail',
    async (change) => {
      const old = deferred<{ id: string }>();
      const next = deferred<{ id: string }>();
      api.uploadTicketAttachment
        .mockReturnValueOnce(old.promise)
        .mockReturnValueOnce(next.promise);
      const { container } = mount();
      await flush();
      await select(container, [file('old-first.txt'), file('old-second.txt')]);
      if (change === 'ticket') route.params.id = 'ticket-2';
      else user.userInfo = { userId: '8' };
      await flush();
      await select(container, [file('new.txt')]);
      old.resolve({ id: 'old' });
      await flush();
      expect(api.uploadTicketAttachment).toHaveBeenCalledTimes(2);
      expect(api.getTicketDetail).toHaveBeenCalledTimes(2);
      expect(uploadButton(container).disabled).toBe(true);
      next.resolve({ id: 'new' });
      await flush();
      expect(api.getTicketDetail).toHaveBeenCalledTimes(3);
      expect(uploadButton(container).disabled).toBe(false);
    },
  );

  it('preserves the current policy and batch across an ordinary access-token refresh', async () => {
    const first = deferred<{ id: string }>();
    api.uploadTicketAttachment.mockReturnValueOnce(first.promise);
    const { container } = mount();
    await flush();
    await select(container, [file('first.txt'), file('second.txt')]);
    access.accessToken = 'refreshed-token-same-session';
    await flush();
    first.resolve({ id: 'first' });
    await flush();
    expect(api.getTicketAttachmentPolicy).toHaveBeenCalledTimes(1);
    expect(api.uploadTicketAttachment).toHaveBeenCalledTimes(2);
  });

  it('aborts policy on unmount and ignores later results', async () => {
    const pending = deferred<typeof policy>();
    api.getTicketAttachmentPolicy.mockReturnValueOnce(pending.promise);
    const item = mount();
    await flush();
    const signal = api.getTicketAttachmentPolicy.mock
      .calls[0]![0] as AbortSignal;
    item.app.unmount();
    item.container.remove();
    apps.splice(apps.indexOf(item), 1);
    pending.resolve(policy);
    await flush();
    expect(signal.aborted).toBe(true);
    expect(api.uploadTicketAttachment).not.toHaveBeenCalled();
    expect(notices.error).not.toHaveBeenCalled();
  });
});
