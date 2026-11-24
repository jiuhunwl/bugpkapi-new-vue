<script setup lang="ts">
import type { TicketApi } from '#/api/ticket';

import {
  computed,
  onBeforeUnmount,
  onMounted,
  provide,
  shallowRef,
  watch,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';
import { useAccessStore, useUserStore } from '@vben/stores';

import { message, Result } from 'ant-design-vue';

import { getUserList } from '#/api/system/user';
import {
  addTicketInternalNote,
  closeTicket,
  createTicketQuickReply,
  deleteTicketAttachment,
  deleteTicketQuickReply,
  downloadTicketAttachment,
  getTicketAttachmentPolicy,
  getTicketDetail,
  getTicketQuickReplies,
  markTicketRead,
  replyTicket,
  updateTicket,
  updateTicketQuickReply,
  uploadTicketAttachment,
} from '#/api/ticket';
import { $t } from '#/locales';
import {
  getAuthSessionGeneration,
  onAuthSessionInvalidated,
} from '#/utils/auth-session-lifecycle';

import {
  parseAttachmentPolicy,
  ticketAttachmentPolicyKey,
  validateAttachmentFile,
  validateTicketImageFile,
} from './attachment-policy';
import TicketDetail from './components/TicketDetail.vue';
import TicketQuickReplyManager from './components/TicketQuickReplyManager.vue';
import { useTicketRealtime } from './composables/use-ticket-realtime';
import { readTicketListState, ticketListQuery } from './list-state';

type ComposerMode = 'note' | 'reply';

interface AssigneeOption {
  label: string;
  value: string;
}

interface Props {
  /** 页面身份：决定权限码与"提交人/处理人"信息是否展示 */
  mode: 'admin' | 'user';
}

const props = defineProps<Props>();

const route = useRoute();
const router = useRouter();

const accessStore = useAccessStore();
const userStore = useUserStore();

const ticketId = computed(() => String(route.params.id ?? ''));

const detail = shallowRef<TicketApi.Detail>();
const detailLoading = shallowRef(false);
const detailError = shallowRef('');
const replyLoading = shallowRef(false);
const adminUpdating = shallowRef(false);
const closeLoading = shallowRef(false);
const attachmentLoading = shallowRef(false);
const imageUploadLoading = shallowRef(false);
const pendingImages = shallowRef<TicketApi.Attachment[]>([]);
const attachmentPolicy = shallowRef<TicketApi.AttachmentPolicy>();
const attachmentPolicyLoading = shallowRef(false);
const attachmentPolicyError = shallowRef(false);
const contextRevision = shallowRef(0);
const authSessionGeneration = shallowRef(getAuthSessionGeneration());

provide(ticketAttachmentPolicyKey, {
  retry: loadAttachmentPolicy,
  state: computed(() => ({
    error: attachmentPolicyError.value,
    loading: attachmentPolicyLoading.value,
    policy: attachmentPolicy.value,
    revision: contextRevision.value,
  })),
});
const replyDraft = shallowRef('');
const composerMode = shallowRef<ComposerMode>('reply');
const assigneeLoading = shallowRef(false);
const assigneeOptions = shallowRef<AssigneeOption[]>([]);
const detailReadActive = shallowRef(false);

const quickReplies = shallowRef<TicketApi.QuickReply[]>([]);
const quickRepliesLoading = shallowRef(false);
const quickReplySaving = shallowRef(false);
const quickReplyOpen = shallowRef(false);

const currentUserId = computed(() =>
  String(userStore.userInfo?.userId ?? userStore.userInfo?.id ?? '').trim(),
);
const hasCode = (code: string) => accessStore.accessCodes.includes(code);
const canRead = computed(() =>
  hasCode(props.mode === 'admin' ? 'ticket:admin:list' : 'ticket:user:list'),
);
const isAdmin = computed(
  () => props.mode === 'admin' && hasCode('ticket:admin:list'),
);
const canReply = computed(() =>
  props.mode === 'admin'
    ? hasCode('ticket:admin:reply')
    : hasCode('ticket:user:reply'),
);
const canUpdate = computed(
  () => props.mode === 'admin' && hasCode('ticket:admin:update'),
);
const canInternalNote = computed(
  () => props.mode === 'admin' && hasCode('ticket:admin:note'),
);
const canManageQuickReplies = computed(
  () => props.mode === 'admin' && hasCode('ticket:admin:quick-reply'),
);
const canUseAttachments = computed(() =>
  props.mode === 'admin'
    ? hasCode('ticket:admin:attachment')
    : hasCode('ticket:user:attachment'),
);
const canClose = computed(
  () =>
    (props.mode === 'admin' && canUpdate.value) ||
    (props.mode === 'user' && hasCode('ticket:user:close')),
);
const canListUsers = computed(() => hasCode('system:user:list'));

const listRouteName = computed(() =>
  props.mode === 'admin' ? 'AdminTicketManagement' : 'UserTicketCenter',
);

let attachmentPolicyRequestId = 0;
let attachmentOperationId = 0;
let imageOperationId = 0;
let attachmentPolicyController: AbortController | undefined;
let detailRequestId = 0;
let disposed = false;
let detailController: AbortController | undefined;
let realtimeRefreshTimer: ReturnType<typeof setTimeout> | undefined;

useTicketRealtime({
  enabled: () => canRead.value,
  ticketId: () => ticketId.value,
  onEvent(event) {
    if (event.ticketId === ticketId.value) {
      scheduleRealtimeRefresh();
    }
  },
});

async function loadAttachmentPolicy() {
  const requestId = ++attachmentPolicyRequestId;
  attachmentPolicyController?.abort();
  attachmentPolicy.value = undefined;
  attachmentPolicyError.value = false;
  attachmentPolicyLoading.value = false;
  if (
    disposed ||
    !accessStore.accessToken ||
    !currentUserId.value ||
    !ticketId.value ||
    !canRead.value
  )
    return;

  const revision = contextRevision.value;
  const session = getAuthSessionGeneration();
  const controller = new AbortController();
  attachmentPolicyController = controller;
  const isCurrent = () =>
    !disposed &&
    !controller.signal.aborted &&
    requestId === attachmentPolicyRequestId &&
    revision === contextRevision.value &&
    session === getAuthSessionGeneration();
  attachmentPolicyLoading.value = true;
  try {
    const result = await getTicketAttachmentPolicy(controller.signal);
    if (!isCurrent()) return;
    attachmentPolicy.value = parseAttachmentPolicy(result);
    attachmentPolicyError.value = !attachmentPolicy.value;
  } catch {
    if (isCurrent()) attachmentPolicyError.value = true;
  } finally {
    if (isCurrent()) attachmentPolicyLoading.value = false;
  }
}

async function loadDetail(id = ticketId.value) {
  // A late completion from another ticket must not abort the current load.
  if (id !== ticketId.value) return;
  if (!id || disposed || !canRead.value) {
    detail.value = undefined;
    return;
  }
  const requestId = ++detailRequestId;
  detailController?.abort();
  const controller = new AbortController();
  detailController = controller;
  detailLoading.value = true;
  detailReadActive.value = false;
  try {
    const result = await getTicketDetail(id, controller.signal);
    if (
      disposed ||
      requestId !== detailRequestId ||
      ticketId.value !== id ||
      !canRead.value
    )
      return;
    detail.value = result;
    detailError.value = '';
    detailReadActive.value = true;
    if (canMarkDetailRead()) {
      await markDetailRead(result);
    }
  } catch {
    if (!controller.signal.aborted && requestId === detailRequestId) {
      detailError.value = $t('ticket.errors.detail');
    }
  } finally {
    if (requestId === detailRequestId) {
      detailLoading.value = false;
    }
  }
}

function canMarkDetailRead() {
  return (
    !disposed &&
    canRead.value &&
    detail.value?.ticket.id === ticketId.value &&
    detailReadActive.value &&
    (typeof document === 'undefined' || document.visibilityState === 'visible')
  );
}

async function markDetailRead(result: TicketApi.Detail) {
  const revision = contextRevision.value;
  const unreadCount = Number(result.ticket.unreadCount ?? 0);
  const snapshot = String(result.ticket.lastMessageAt || '').trim();
  const messageCount = Number(result.ticket.messageCount ?? 0);
  if (
    unreadCount <= 0 ||
    !snapshot ||
    !Number.isSafeInteger(messageCount) ||
    messageCount <= 0
  ) {
    return;
  }
  try {
    const updated = await markTicketRead(result.ticket.id, {
      lastMessageAt: snapshot,
      messageCount,
    });
    const currentDetail = detail.value;
    const currentTicket = currentDetail?.ticket;
    if (
      !updated ||
      revision !== contextRevision.value ||
      !canMarkDetailRead() ||
      !currentDetail ||
      currentTicket?.id !== result.ticket.id ||
      currentTicket.lastMessageAt !== snapshot ||
      currentTicket.messageCount !== messageCount
    ) {
      return;
    }
    detail.value = {
      ...currentDetail,
      ticket: { ...currentTicket, unreadCount: 0 },
    };
  } catch {
    /* 仍允许查看，下次刷新会重试标记 */
  }
}

async function loadQuickReplies() {
  if (!canManageQuickReplies.value) {
    quickReplies.value = [];
    return;
  }
  quickRepliesLoading.value = true;
  try {
    quickReplies.value = await getTicketQuickReplies();
  } finally {
    quickRepliesLoading.value = false;
  }
}

async function saveQuickReply(
  id: string | undefined,
  payload: TicketApi.SaveQuickReplyRequest,
) {
  if (!canManageQuickReplies.value || quickReplySaving.value) return;
  quickReplySaving.value = true;
  try {
    await (id
      ? updateTicketQuickReply(id, payload)
      : createTicketQuickReply(payload));
    message.success($t('ticket.quickReplies.saved'));
    await loadQuickReplies();
  } finally {
    quickReplySaving.value = false;
  }
}

async function removeQuickReply(id: string) {
  if (quickReplySaving.value) return;
  quickReplySaving.value = true;
  try {
    await deleteTicketQuickReply(id);
    message.success($t('ticket.quickReplies.deleted'));
    await loadQuickReplies();
  } finally {
    quickReplySaving.value = false;
  }
}

async function submitMessage(mode: ComposerMode) {
  const id = ticketId.value;
  const content = replyDraft.value.trim();
  const images = pendingImages.value;
  if (
    !id ||
    (!content && images.length === 0) ||
    replyLoading.value ||
    imageUploadLoading.value ||
    !canRead.value ||
    detail.value?.ticket.id !== id ||
    detail.value.ticket.status === 'CLOSED' ||
    (mode === 'note' ? !canInternalNote.value : !canReply.value)
  )
    return;
  replyLoading.value = true;
  try {
    const attachmentIds = images.map((image) => image.id);
    const result =
      mode === 'note'
        ? await addTicketInternalNote(id, content, attachmentIds)
        : await replyTicket(id, content, attachmentIds);
    if (ticketId.value === id) {
      detail.value = result;
      replyDraft.value = '';
      pendingImages.value = [];
      composerMode.value = 'reply';
    }
    message.success(
      $t(
        mode === 'note' ? 'ticket.composer.noteAdded' : 'ticket.composer.sent',
      ),
    );
  } finally {
    replyLoading.value = false;
  }
}

async function closeCurrentTicket() {
  const id = ticketId.value;
  if (!id || !canClose.value || closeLoading.value) return;
  closeLoading.value = true;
  try {
    const result = await closeTicket(id);
    if (ticketId.value === id) detail.value = result;
    message.success($t('ticket.detail.closed'));
  } finally {
    closeLoading.value = false;
  }
}

async function changeStatus(nextStatus: TicketApi.Status) {
  const ticket = detail.value?.ticket;
  if (
    !ticket ||
    !canUpdate.value ||
    adminUpdating.value ||
    ticket.status === nextStatus
  ) {
    return;
  }
  await updateCurrentTicket({ status: nextStatus });
}

async function assignTicket(userId: string) {
  const ticket = detail.value?.ticket;
  if (
    !ticket ||
    !canUpdate.value ||
    adminUpdating.value ||
    (ticket.assignedTo || '') === userId
  ) {
    return;
  }
  await updateCurrentTicket({ assignedTo: userId });
  if (userId && userId === currentUserId.value) {
    message.success($t('ticket.detail.claimed'));
  }
}

async function changeTags(tags: string[]) {
  if (!canUpdate.value || adminUpdating.value) return;
  await updateCurrentTicket({ tags });
}

async function updateCurrentTicket(payload: TicketApi.UpdateRequest) {
  const id = ticketId.value;
  if (!id || !canUpdate.value) return;
  adminUpdating.value = true;
  try {
    const result = await updateTicket(id, payload);
    if (ticketId.value === id) detail.value = result;
    message.success($t('ticket.detail.updated'));
  } finally {
    adminUpdating.value = false;
  }
}

// Re-read reactive detail on every invocation, including after an awaited upload.
function ticketAcceptsAttachments(id: string) {
  const current = detail.value?.ticket;
  return current?.id === id && current.status !== 'CLOSED';
}

async function uploadAttachments(files: File[]) {
  const id = ticketId.value;
  if (
    !id ||
    !accessStore.accessToken ||
    !currentUserId.value ||
    !canRead.value ||
    !canUseAttachments.value ||
    disposed ||
    !ticketAcceptsAttachments(id) ||
    attachmentLoading.value ||
    attachmentPolicyLoading.value ||
    files.length === 0
  )
    return;

  const revision = contextRevision.value;
  const operationId = ++attachmentOperationId;
  const isCurrent = () =>
    !disposed &&
    revision === contextRevision.value &&
    operationId === attachmentOperationId;
  attachmentLoading.value = true;
  let uploaded = 0;
  try {
    for (const file of files) {
      if (
        !isCurrent() ||
        !canUseAttachments.value ||
        !canRead.value ||
        !ticketAcceptsAttachments(id)
      )
        return;
      // Revalidate every file immediately before sending, including after an awaited upload.
      const error = validateAttachmentFile(file, attachmentPolicy.value);
      if (error) {
        message.error($t(error.key, error.params));
        return;
      }
      await uploadTicketAttachment(id, file);
      uploaded += 1;
    }
    if (isCurrent())
      message.success($t('ticket.attachments.uploaded', [uploaded]));
  } catch {
    // requestClient already reports upload errors; keep successful files visible below.
  } finally {
    try {
      if (uploaded > 0 && isCurrent()) await loadDetail(id);
    } finally {
      if (isCurrent()) attachmentLoading.value = false;
    }
  }
}

async function uploadImages(files: File[]) {
  const id = ticketId.value;
  if (
    !id ||
    !accessStore.accessToken ||
    !currentUserId.value ||
    !canRead.value ||
    !canUseAttachments.value ||
    disposed ||
    !ticketAcceptsAttachments(id) ||
    imageUploadLoading.value ||
    replyLoading.value ||
    attachmentPolicyLoading.value ||
    files.length === 0
  )
    return;
  if (pendingImages.value.length + files.length > 10) {
    message.error($t('ticket.composer.imageLimit'));
    return;
  }

  const revision = contextRevision.value;
  const operationId = ++imageOperationId;
  const isCurrent = () =>
    !disposed &&
    revision === contextRevision.value &&
    operationId === imageOperationId;
  imageUploadLoading.value = true;
  let uploaded = 0;
  try {
    for (const file of files) {
      if (!isCurrent() || !ticketAcceptsAttachments(id)) return;
      const error = validateTicketImageFile(file, attachmentPolicy.value);
      if (error) {
        message.error($t(error.key, error.params));
        return;
      }
      const attachment = await uploadTicketAttachment(id, file);
      if (!isCurrent()) return;
      pendingImages.value = [...pendingImages.value, attachment];
      uploaded += 1;
    }
    if (isCurrent() && uploaded > 0) {
      message.success($t('ticket.composer.imageUploaded', [uploaded]));
    }
  } catch {
    // requestClient already reports upload errors; successful images stay listed.
  } finally {
    if (isCurrent()) imageUploadLoading.value = false;
  }
}

async function removePendingImage(attachment: TicketApi.Attachment) {
  const id = ticketId.value;
  if (
    !id ||
    !canUseAttachments.value ||
    imageUploadLoading.value ||
    replyLoading.value
  )
    return;
  const revision = contextRevision.value;
  const operationId = ++imageOperationId;
  const isCurrent = () =>
    !disposed &&
    revision === contextRevision.value &&
    operationId === imageOperationId;
  imageUploadLoading.value = true;
  try {
    await deleteTicketAttachment(id, attachment.id);
    if (!isCurrent()) return;
    pendingImages.value = pendingImages.value.filter(
      (item) => item.id !== attachment.id,
    );
  } finally {
    if (isCurrent()) imageUploadLoading.value = false;
  }
}

async function removeAttachment(attachment: TicketApi.Attachment) {
  const id = ticketId.value;
  if (!id || !canUseAttachments.value || attachmentLoading.value) return;
  const revision = contextRevision.value;
  const operationId = ++attachmentOperationId;
  const isCurrent = () =>
    !disposed &&
    revision === contextRevision.value &&
    operationId === attachmentOperationId;
  attachmentLoading.value = true;
  try {
    await deleteTicketAttachment(id, attachment.id);
    if (!isCurrent()) return;
    message.success($t('ticket.attachments.deleted'));
    await loadDetail(id);
  } finally {
    if (isCurrent()) attachmentLoading.value = false;
  }
}

async function downloadAttachment(attachment: TicketApi.Attachment) {
  const id = ticketId.value;
  if (!id) return;
  if (attachment.url) {
    window.open(attachment.url, '_blank', 'noopener,noreferrer');
    return;
  }
  const blob = await downloadTicketAttachment(id, attachment.id);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = attachment.originalName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function loadAssignees() {
  if (!isAdmin.value || !canUpdate.value || !canListUsers.value) {
    assigneeOptions.value = currentUserOption();
    return;
  }
  assigneeLoading.value = true;
  try {
    const result = await getUserList({ page: 1, pageSize: 100, status: 1 });
    assigneeOptions.value = result.items.map((user) => ({
      label: `${user.realName || user.username} · ${user.username} (#${user.id})`,
      value: user.id,
    }));
  } catch {
    assigneeOptions.value = currentUserOption();
  } finally {
    assigneeLoading.value = false;
  }
}

function currentUserOption(): AssigneeOption[] {
  if (!currentUserId.value) return [];
  const info = userStore.userInfo;
  return [
    {
      label: `${info?.realName || info?.username || currentUserId.value} (#${currentUserId.value})`,
      value: currentUserId.value,
    },
  ];
}

function scheduleRealtimeRefresh() {
  if (disposed || !canRead.value) return;
  if (realtimeRefreshTimer) clearTimeout(realtimeRefreshTimer);
  realtimeRefreshTimer = setTimeout(() => {
    realtimeRefreshTimer = undefined;
    void loadDetail();
  }, 240);
}

function backToList() {
  void router.push({
    name: listRouteName.value,
    query: ticketListQuery(readTicketListState(route.query)),
  });
}

function resetDetailContext() {
  contextRevision.value++;
  detailReadActive.value = false;
  detailRequestId++;
  detailController?.abort();
  detailLoading.value = false;
  attachmentPolicyRequestId++;
  attachmentPolicyController?.abort();
  attachmentOperationId++;
  imageOperationId++;
  attachmentPolicy.value = undefined;
  attachmentPolicyLoading.value = false;
  attachmentPolicyError.value = false;
  attachmentLoading.value = false;
  imageUploadLoading.value = false;
  pendingImages.value = [];
  replyDraft.value = '';  composerMode.value = 'reply';
  detail.value = undefined;
  detailError.value = '';
  if (realtimeRefreshTimer) clearTimeout(realtimeRefreshTimer);
}

const stopSessionInvalidation = onAuthSessionInvalidated(() => {
  authSessionGeneration.value = getAuthSessionGeneration();
});

watch(
  [
    ticketId,
    currentUserId,
    () => !!accessStore.accessToken,
    () => props.mode,
    canRead,
    () => authSessionGeneration.value,
  ],
  () => {
    resetDetailContext();
    const revision = contextRevision.value;
    // Invalidate synchronously, then wait for token/user store updates from login/logout.
    void Promise.resolve().then(() => {
      if (disposed || revision !== contextRevision.value) return;
      void loadDetail();
      void loadAttachmentPolicy();
    });
  },
  { flush: 'sync' },
);

onMounted(async () => {
  await Promise.all([
    loadAssignees(),
    loadAttachmentPolicy(),
    loadDetail(ticketId.value),
    loadQuickReplies(),
  ]);
});

onBeforeUnmount(() => {
  disposed = true;
  stopSessionInvalidation();
  resetDetailContext();
});
</script>

<template>
  <Page
    auto-content-height
    class="ticket-detail-route"
    content-class="flex min-h-0 flex-col overflow-hidden"
  >
    <TicketDetail
      v-if="canRead"
      v-model:composer-mode="composerMode"
      v-model:draft="replyDraft"
      :assignee-loading="assigneeLoading || adminUpdating"
      :assignee-options="assigneeOptions"
      :attachment-loading="attachmentLoading"
      :can-close="canClose"
      :can-delete-attachment="canUseAttachments"
      :can-internal-note="canInternalNote"
      :can-manage-quick-replies="canManageQuickReplies"
      :can-reply="canReply"
      :can-update="canUpdate"
      :can-upload-attachment="canUseAttachments"
      :current-user-id="currentUserId"
      :detail="detail"
      :error="detailError"
      :image-upload-loading="imageUploadLoading"
      :is-admin="isAdmin"
      :loading="detailLoading || closeLoading"
      :pending-images="pendingImages"
      :quick-replies="quickReplies"
      :quick-replies-loading="quickRepliesLoading"
      :reply-loading="replyLoading"
      :show-back="true"
      :tags-loading="adminUpdating"
      @assign="assignTicket"
      @attachment-delete="removeAttachment"
      @attachment-download="downloadAttachment"
      @attachment-upload="uploadAttachments"
      @back="backToList"
      @close="closeCurrentTicket"
      @image-remove="removePendingImage"
      @image-upload="uploadImages"
      @manage-quick-replies="quickReplyOpen = true"
      @refresh="loadDetail()"
      @reply="submitMessage"
      @status-change="changeStatus"
      @tags-change="changeTags"
    />

    <Result v-else status="403" :title="$t('ticket.errors.forbidden')" />

    <TicketQuickReplyManager
      v-if="canRead && canManageQuickReplies"
      v-model:open="quickReplyOpen"
      :quick-replies="quickReplies"
      :saving="quickReplySaving"
      @delete="removeQuickReply"
      @save="saveQuickReply"
    />
  </Page>
</template>
