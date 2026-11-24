import type { InjectionKey, Ref } from 'vue';

import type { TicketApi } from '#/api/ticket';

export interface TicketAttachmentPolicyContext {
  retry: () => Promise<void>;
  state: Readonly<
    Ref<{
      error: boolean;
      loading: boolean;
      policy: TicketApi.AttachmentPolicy | undefined;
      revision: number;
    }>
  >;
}

// The route owns the policy; the nested panel only reads it and requests retries.
export const ticketAttachmentPolicyKey: InjectionKey<TicketAttachmentPolicyContext> =
  Symbol('ticket-attachment-policy');

export function parseAttachmentPolicy(
  value: unknown,
): TicketApi.AttachmentPolicy | undefined {
  if (!value || typeof value !== 'object') return;
  const raw = value as Record<string, unknown>;
  if (
    typeof raw.maxBytes !== 'number' ||
    !Number.isSafeInteger(raw.maxBytes) ||
    raw.maxBytes < 0 ||
    !Array.isArray(raw.allowedExtensions)
  )
    return;

  const allowedExtensions: string[] = [];
  for (const extension of raw.allowedExtensions) {
    if (
      typeof extension !== 'string' ||
      !/^\.?[a-z0-9]+$/i.test(extension.trim())
    )
      return;
    const normalized = extension.trim().toLowerCase();
    allowedExtensions.push(
      normalized.startsWith('.') ? normalized : '.' + normalized,
    );
  }
  return {
    maxBytes: raw.maxBytes,
    allowedExtensions: [...new Set(allowedExtensions)],
  };
}

export function formatAttachmentLimit(maxBytes: number) {
  // No rounding up: every displayed MiB limit represents the exact byte limit.
  return String(maxBytes / (1024 * 1024)) + ' MiB';
}

export const TICKET_IMAGE_EXTENSIONS = ['.gif', '.jpeg', '.jpg', '.png', '.webp'];

export function validateTicketImageFile(
  file: Pick<File, 'name' | 'size'>,
  policy: TicketApi.AttachmentPolicy | undefined,
): undefined | { key: string; params: string[] } {
  const error = validateAttachmentFile(file, policy);
  if (error) return error;
  const dot = file.name.lastIndexOf('.');
  const extension = dot < 0 ? '' : file.name.slice(dot).toLowerCase();
  if (!TICKET_IMAGE_EXTENSIONS.includes(extension)) {
    return { key: 'ticket.attachments.imageOnly', params: [] };
  }
}

export function validateAttachmentFile(
  file: Pick<File, 'name' | 'size'>,
  policy: TicketApi.AttachmentPolicy | undefined,
): undefined | { key: string; params: string[] } {
  if (!policy)
    return { key: 'ticket.attachments.policyUnavailable', params: [] };
  if (policy.maxBytes === 0 || policy.allowedExtensions.length === 0) {
    return { key: 'ticket.attachments.uploadUnavailable', params: [] };
  }
  if (!Number.isSafeInteger(file.size) || file.size <= 0) {
    return { key: 'ticket.attachments.emptyFile', params: [file.name] };
  }
  if (file.size > policy.maxBytes) {
    return {
      key: 'ticket.attachments.tooLarge',
      params: [file.name, formatAttachmentLimit(policy.maxBytes)],
    };
  }
  const dot = file.name.lastIndexOf('.');
  const extension = dot < 0 ? '' : file.name.slice(dot).toLowerCase();
  if (!policy.allowedExtensions.includes(extension)) {
    return {
      key: 'ticket.attachments.typeNotAllowed',
      params: [file.name, policy.allowedExtensions.join(', ')],
    };
  }
}
