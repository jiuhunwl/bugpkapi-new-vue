import type { App } from 'vue';

import { createApp, defineComponent, h, nextTick } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import TicketDetail from './TicketDetail.vue';

vi.mock('#/locales', () => ({ $t: (key: string) => key }));
vi.mock('@vben/icons', () => ({
  IconifyIcon: defineComponent({
    name: 'IconifyIcon',
    setup() {
      return () => h('i');
    },
  }),
  RotateCw: defineComponent({
    name: 'RotateCw',
    setup() {
      return () => h('i');
    },
  }),
}));

vi.mock('ant-design-vue', () => {
  const passthrough = (name: string) =>
    defineComponent({
      name,
      setup(_props, { slots }) {
        return () => h('div', slots.default?.());
      },
    });
  return {
    Button: passthrough('Button'),
    Empty: passthrough('Empty'),
    Popconfirm: passthrough('Popconfirm'),
    Select: passthrough('Select'),
    Spin: passthrough('Spin'),
    Tag: passthrough('Tag'),
    Tooltip: passthrough('Tooltip'),
  };
});

vi.mock('./TicketActivityTimeline.vue', () => ({
  default: defineComponent({
    name: 'TicketActivityTimeline',
    setup() {
      return () => h('div', { 'data-testid': 'ticket-activities' });
    },
  }),
}));
vi.mock('./TicketAttachmentPanel.vue', () => ({
  default: defineComponent({
    name: 'TicketAttachmentPanel',
    setup() {
      return () => h('div', { 'data-testid': 'ticket-attachments' });
    },
  }),
}));
vi.mock('./TicketComposer.vue', () => ({
  default: defineComponent({
    name: 'TicketComposer',
    setup() {
      return () => h('div', { 'data-testid': 'ticket-composer' });
    },
  }),
}));
vi.mock('./TicketMessageTimeline.vue', () => ({
  default: defineComponent({
    name: 'TicketMessageTimeline',
    setup() {
      return () => h('div', { 'data-testid': 'ticket-message-timeline' });
    },
  }),
}));

const mountedApps: Array<{ app: App; container: HTMLDivElement }> = [];

function mountDetail() {
  const container = document.createElement('div');
  document.body.append(container);
  const app = createApp(TicketDetail, {
    assigneeLoading: false,
    assigneeOptions: [],
    attachmentLoading: false,
    canClose: true,
    canDeleteAttachment: true,
    canInternalNote: false,
    canManageQuickReplies: false,
    canReply: true,
    canUpdate: false,
    canUploadAttachment: true,
    currentUserId: '7',
    detail: {
      activities: [],
      attachments: [],
      messages: [
        {
          content: 'hello',
          createdAt: '2026-08-15 10:00:00',
          id: 'message-1',
          internalNote: false,
          senderId: '7',
          senderName: 'tester',
          senderType: 'USER',
        },
      ],
      ticket: {
        assignedTo: '',
        assigneeName: '',
        category: 'OTHER',
        createdAt: '2026-08-15 09:00:00',
        displayName: 'tester',
        firstResponseOverdue: false,
        id: 'ticket-1',
        language: 'zh-CN',
        lastMessageAt: '2026-08-15 10:00:00',
        lastReplyBy: 'USER',
        messageCount: 1,
        priority: 'NORMAL',
        resolutionOverdue: false,
        status: 'OPEN',
        subject: 'Need help',
        tags: [],
        ticketNo: 'TK-1',
        unreadCount: 0,
        userId: '7',
        username: 'tester',
      },
    },
    isAdmin: false,
    loading: false,
    quickReplies: [],
    quickRepliesLoading: false,
    replyLoading: false,
    showBack: false,
    tagsLoading: false,
  });
  app.mount(container);
  mountedApps.push({ app, container });
  return container;
}

afterEach(() => {
  for (const { app, container } of mountedApps.splice(0)) {
    app.unmount();
    container.remove();
  }
});

describe('ticket detail scrolling', () => {
  it('keeps the conversation in its own scroll region with the composer pinned outside it', async () => {
    const container = mountDetail();
    await nextTick();

    const scrollRegion = container.querySelector(
      '[data-testid="ticket-detail-scroll-region"]',
    );
    expect(scrollRegion).not.toBeNull();
    expect(
      scrollRegion?.querySelector('[data-testid="ticket-message-timeline"]'),
    ).not.toBeNull();
    // 发送框必须钉在滚动区之外：消息再多也不能把它挤出可视区。
    const composer = container.querySelector('[data-testid="ticket-composer"]');
    expect(composer).not.toBeNull();
    expect(scrollRegion?.contains(composer as Node)).toBe(false);
  });
});
