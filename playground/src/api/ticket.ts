import { requestClient } from './request';

export namespace TicketApi {
  export type Category =
    | 'ACCOUNT'
    | 'API'
    | 'BILLING'
    | 'BUG'
    | 'GENERAL'
    | 'OTHER';

  export type Priority = 'HIGH' | 'LOW' | 'NORMAL' | 'URGENT';

  export type Status =
    | 'CLOSED'
    | 'OPEN'
    | 'PROCESSING'
    | 'RESOLVED'
    | 'WAITING_USER';

  export type SenderType = 'STAFF' | 'USER';

  export type SLAStatus =
    | 'BREACHED'
    | 'FIRST_RESPONSE_PENDING'
    | 'MET'
    | 'RESOLUTION_PENDING';

  export interface Ticket {
    assignedTo?: string;
    assigneeName?: string;
    category: Category;
    closedAt?: string;
    createdAt: string;
    displayName?: string;
    firstRespondedAt?: string;
    firstResponseDueAt?: string;
    firstResponseOverdue: boolean;
    id: string;
    language: 'en' | 'zh';
    lastMessageAt: string;
    lastMessagePreview: string;
    lastReplyBy: SenderType;
    messageCount: number;
    priority: Priority;
    resolutionDueAt?: string;
    resolutionOverdue: boolean;
    resolvedAt?: string;
    slaStatus: SLAStatus;
    status: Status;
    subject: string;
    tags: string[];
    ticketNo: string;
    unreadCount: number;
    updatedAt: string;
    userId: string;
    username?: string;
  }

  export interface Message {
    content: string;
    createdAt: string;
    id: string;
    internalNote: boolean;
    senderId: string;
    senderName: string;
    senderType: SenderType;
  }

  export interface Detail {
    activities: Activity[];
    attachments: Attachment[];
    messages: Message[];
    ticket: Ticket;
  }

  export interface Summary {
    all: number;
    closed: number;
    open: number;
    processing: number;
    resolved: number;
    unread: number;
    waitingUser: number;
  }

  export interface PageResult {
    items: Ticket[];
    summary: Summary;
    total: number;
  }

  export type ListSortBy =
    | 'created_at'
    | 'last_message_at'
    | 'priority'
    | 'sla_due'
    | 'status'
    | 'updated_at';

  export interface ListParams {
    assignedTo?: number;
    category?: '' | Category;
    createdFrom?: string;
    createdTo?: string;
    keyword?: string;
    overdue?: 0 | 1;
    page?: number;
    pageSize?: number;
    priority?: '' | Priority;
    sortBy?: ListSortBy;
    sortOrder?: 'asc' | 'desc';
    status?: '' | Status;
    unread?: 0 | 1;
    updatedFrom?: string;
    updatedTo?: string;
  }

  export interface CreateRequest {
    category: Category;
    content: string;
    language: 'en' | 'zh';
    priority: Priority;
    subject: string;
  }

  export interface UpdateRequest {
    assignedTo?: string;
    status?: Status;
    tags?: string[];
  }

  export interface MarkReadRequest {
    lastMessageAt: string;
    messageCount: number;
  }

  export interface AttachmentPolicy {
    allowedExtensions: string[];
    maxBytes: number;
  }

  export interface Attachment {
    contentType: string;
    createdAt: string;
    downloadUrl: string;
    id: string;
    messageId?: string;
    originalName: string;
    sizeBytes: number;
    storage?: string;
    uploaderId: string;
    uploaderName: string;
    url?: string;
  }

  export interface Activity {
    action: string;
    actorId: string;
    actorName: string;
    actorType: 'STAFF' | 'SYSTEM' | 'USER';
    createdAt: string;
    detail: Record<string, unknown>;
    id: string;
    visibility: 'INTERNAL' | 'PUBLIC';
  }

  export interface QuickReply {
    category: Category;
    contentEn: string;
    contentZh: string;
    id: string;
    sortNo: number;
    status: 0 | 1;
    title: string;
  }

  export interface SaveQuickReplyRequest {
    category: Category;
    contentEn: string;
    contentZh: string;
    sortNo: number;
    status: 0 | 1;
    title: string;
  }

  export interface Event {
    actorId: string;
    id: string;
    messageId?: string;
    ticketId: string;
    timestamp: string;
    type:
      | 'ticket.attachment'
      | 'ticket.closed'
      | 'ticket.created'
      | 'ticket.message'
      | 'ticket.note'
      | 'ticket.updated';
    userId: string;
  }

  /** 管理员在工单中点击头像时展示的账号卡片（联系方式已脱敏）。 */
  export interface UserProfile {
    avatar?: string;
    balance: string;
    createTime?: string;
    displayName?: string;
    email?: string;
    id: string;
    lastLoginTime?: string;
    mobile?: string;
    points: number;
    roles: string[];
    status: 0 | 1;
    username: string;
  }
}

export function getTicketList(
  params?: TicketApi.ListParams,
  signal?: AbortSignal,
) {
  return requestClient.get<TicketApi.PageResult>('/tickets', {
    params,
    signal,
  });
}

export function createTicket(data: TicketApi.CreateRequest) {
  return requestClient.post<TicketApi.Detail>('/tickets', data);
}

export function getTicketDetail(id: string, signal?: AbortSignal) {
  return requestClient.get<TicketApi.Detail>(`/tickets/${id}`, { signal });
}

export function getTicketUserProfile(userId: string) {
  return requestClient.get<TicketApi.UserProfile>(
    `/tickets/users/${encodeURIComponent(userId)}`,
  );
}

export function replyTicket(
  id: string,
  content: string,
  attachmentIds: string[] = [],
) {
  return requestClient.post<TicketApi.Detail>(`/tickets/${id}/messages`, {
    attachmentIds,
    content,
  });
}

export function updateTicket(id: string, data: TicketApi.UpdateRequest) {
  return requestClient.put<TicketApi.Detail>(`/tickets/${id}`, data);
}

export function markTicketRead(id: string, data: TicketApi.MarkReadRequest) {
  return requestClient.post<boolean>(`/tickets/${id}/read`, data);
}

export function addTicketInternalNote(
  id: string,
  content: string,
  attachmentIds: string[] = [],
) {
  return requestClient.post<TicketApi.Detail>(`/tickets/${id}/notes`, {
    attachmentIds,
    content,
  });
}

export function closeTicket(id: string) {
  return requestClient.post<TicketApi.Detail>(`/tickets/${id}/close`);
}

export function getTicketQuickReplies() {
  return requestClient.get<TicketApi.QuickReply[]>('/tickets/quick-replies');
}

export function createTicketQuickReply(data: TicketApi.SaveQuickReplyRequest) {
  return requestClient.post<TicketApi.QuickReply>(
    '/tickets/quick-replies',
    data,
  );
}

export function updateTicketQuickReply(
  id: string,
  data: TicketApi.SaveQuickReplyRequest,
) {
  return requestClient.put<TicketApi.QuickReply>(
    `/tickets/quick-replies/${id}`,
    data,
  );
}

export function deleteTicketQuickReply(id: string) {
  return requestClient.delete<boolean>(`/tickets/quick-replies/${id}`);
}

export function getTicketAttachmentPolicy(signal?: AbortSignal) {
  return requestClient.get<TicketApi.AttachmentPolicy>(
    '/tickets/attachment-policy',
    { signal },
  );
}

export function uploadTicketAttachment(id: string, file: File) {
  return requestClient.upload<TicketApi.Attachment>(
    `/tickets/${id}/attachments`,
    { file },
    { timeout: 30_000 },
  );
}

export function downloadTicketAttachment(id: string, attachmentId: string) {
  return requestClient.get<Blob>(`/tickets/${id}/attachments/${attachmentId}`, {
    responseReturn: 'body',
    responseType: 'blob',
  });
}

export function deleteTicketAttachment(id: string, attachmentId: string) {
  return requestClient.delete<boolean>(
    `/tickets/${id}/attachments/${attachmentId}`,
  );
}
