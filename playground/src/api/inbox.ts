import { requestClient } from '#/api/request';

export namespace InboxApi {
  export interface InboxItem {
    id: number;
    title: string;
    body: string;
    kind: string;
    isRead: boolean;
    readAt: string;
    createdAt: string;
  }

  export interface InboxPage {
    items: InboxItem[];
    total: number;
    unread: number;
    page: number;
    pageSize: number;
  }

  export interface BroadcastResult {
    recipients: number;
    emails: number;
  }

  export interface BroadcastRequest {
    title: string;
    body: string;
    sendEmail?: boolean;
    userId?: number;
  }
}

/**
 * 用户端：我的站内消息（分页，unreadOnly 仅未读）。
 */
export function getMyInboxMessages(params: {
  page?: number;
  pageSize?: number;
  unread?: boolean;
}) {
  return requestClient.get<InboxApi.InboxPage>('/user/inbox', { params });
}

/**
 * 用户端：未读消息数（工作台徽标轮询用）。
 */
export function getMyInboxUnreadCount() {
  return requestClient.get<{ unread: number }>('/user/inbox/unread-count');
}

/**
 * 用户端：标记消息已读；ids 为空表示全部已读。
 */
export function markInboxMessagesRead(ids?: number[]) {
  return requestClient.post<{ updated: number }>('/user/inbox/read', {
    ids: ids ?? [],
  });
}

/**
 * 管理端：发送全站/定向通知，可选同时发送邮件副本。
 */
export function broadcastInboxMessage(data: InboxApi.BroadcastRequest) {
  return requestClient.post<InboxApi.BroadcastResult>('/inbox/broadcast', data);
}
