<script setup lang="ts">
import type { TicketApi } from '#/api/ticket';

import { computed, onBeforeUnmount, onMounted, shallowRef } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { useAccessStore, useUserStore } from '@vben/stores';

import { Button, message } from 'ant-design-vue';

import { getUserList } from '#/api/system/user';
import {
  addTicketInternalNote,
  closeTicket,
  createTicket,
  createTicketQuickReply,
  deleteTicketAttachment,
  deleteTicketQuickReply,
  downloadTicketAttachment,
  getTicketDetail,
  getTicketList,
  getTicketQuickReplies,
  markTicketRead,
  replyTicket,
  updateTicket,
  updateTicketQuickReply,
  uploadTicketAttachment,
} from '#/api/ticket';
import { $t } from '#/locales';

import CreateTicketModal from './components/CreateTicketModal.vue';
import TicketDetail from './components/TicketDetail.vue';
import TicketListPanel from './components/TicketListPanel.vue';
import TicketQuickReplyManager from './components/TicketQuickReplyManager.vue';
import { useTicketRealtime } from './composables/use-ticket-realtime';

type ComposerMode = 'note' | 'reply';
type MobilePane = 'detail' | 'list';

interface AssigneeOption {
  label: string;
  value: string;
}

interface Props {
  mode: 'admin' | 'user';
}

const props = defineProps<Props>();

const accessStore = useAccessStore();
const userStore = useUserStore();

const tickets = shallowRef<TicketApi.Ticket[]>([]);
const summary = shallowRef<TicketApi.Summary>(emptySummary());
const total = shallowRef(0);
const page = shallowRef(1);
const pageSize = shallowRef(20);
const keyword = shallowRef('');
const status = shallowRef<'' | TicketApi.Status>('');
const priority = shallowRef<'' | TicketApi.Priority>('');
const category = shallowRef<'' | TicketApi.Category>('');
const unreadOnly = shallowRef(false);
const selectedId = shallowRef<string>();
const detail = shallowRef<TicketApi.Detail>();
const listLoading = shallowRef(false);
const detailLoading = shallowRef(false);
const replyLoading = shallowRef(false);
const adminUpdating = shallowRef(false);
const closeLoading = shallowRef(false);
const attachmentLoading = shallowRef(false);
const createOpen = shallowRef(false);
const createSaving = shallowRef(false);
const replyDraft = shallowRef('');
const composerMode = shallowRef<ComposerMode>('reply');
const listError = shallowRef('');
const detailError = shallowRef('');
const assigneeLoading = shallowRef(false);
const assigneeOptions = shallowRef<AssigneeOption[]>([]);
const mobilePane = shallowRef<MobilePane>('list');
const detailReadActive = shallowRef(false);

const quickReplies = shallowRef<TicketApi.QuickReply[]>([]);
const quickRepliesLoading = shallowRef(false);
const quickReplySaving = shallowRef(false);
const quickReplyOpen = shallowRef(false);

const isAdminRole = computed(() => userStore.userRoles.includes('admin'));
const currentUserId = computed(() =>
  String(userStore.userInfo?.id || '').trim(),
);
const hasCode = (code: string) => accessStore.accessCodes.includes(code);
const isAdmin = computed(
  () => props.mode === 'admin' && hasCode('ticket:admin:list'),
);
const canCreate = computed(
  () =>
    props.mode === 'user' &&
    !isAdminRole.value &&
    hasCode('ticket:user:create'),
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
const pageTitle = computed(() =>
  $t(props.mode === 'admin' ? 'ticket.adminTitle' : 'ticket.title'),
);
const pageSubtitle = computed(() =>
  $t(props.mode === 'admin' ? 'ticket.adminSubtitle' : 'ticket.subtitle'),
);
const hasDetailPane = computed(
  () => !!selectedId.value || !!detail.value || detailLoading.value,
);
const showDetailPane = computed(
  () => hasDetailPane.value || tickets.value.length > 0 || total.value > 0,
);

let listRequestId = 0;
let detailRequestId = 0;
let realtimeRefreshTimer: ReturnType<typeof setTimeout> | undefined;
let realtimeDetailId = '';

const { status: realtimeStatus } = useTicketRealtime({
  onEvent(event) {
    realtimeDetailId = event.ticketId;
    scheduleRealtimeRefresh();
  },
});

const realtimeLabel = computed(() =>
  $t(`ticket.realtime.${realtimeStatus.value}`),
);

async function loadList(options: { ensureSelection?: boolean } = {}) {
  const requestId = ++listRequestId;
  listLoading.value = true;
  try {
    const result = await getTicketList({
      category: category.value,
      keyword: keyword.value.trim(),
      page: page.value,
      pageSize: pageSize.value,
      priority: priority.value,
      status: status.value,
      unread: unreadOnly.value ? 1 : 0,
    });
    if (requestId !== listRequestId) {
      return;
    }
    tickets.value = result.items ?? [];
    summary.value = result.summary ?? emptySummary();
    total.value = Number(result.total ?? 0);
    listError.value = '';

    const selectionVisible = tickets.value.some(
      (ticket) => ticket.id === selectedId.value,
    );
    if (options.ensureSelection && selectedId.value && !selectionVisible) {
      clearDetailSelection();
    }
  } catch {
    if (requestId === listRequestId) {
      listError.value = $t('ticket.errors.list');
    }
  } finally {
    if (requestId === listRequestId) {
      listLoading.value = false;
    }
  }
}

async function selectTicket(
  ticketId: string,
  options: { openDetail?: boolean } = {},
) {
  if (!ticketId) {
    return;
  }
  selectedId.value = ticketId;
  replyDraft.value = '';
  composerMode.value = 'reply';
  if (options.openDetail !== false) {
    mobilePane.value = 'detail';
    detailReadActive.value = true;
  }
  await loadDetail(ticketId);
}

async function loadDetail(ticketId = selectedId.value) {
  if (!ticketId) {
    detail.value = undefined;
    return;
  }
  const requestId = ++detailRequestId;
  detailLoading.value = true;
  try {
    const result = await getTicketDetail(ticketId);
    if (requestId !== detailRequestId || selectedId.value !== ticketId) {
      return;
    }
    detail.value = result;
    detailError.value = '';
    applyTicketToList(result.ticket);
    if (canMarkDetailRead()) {
      await markDetailRead(result);
    }
  } catch {
    if (requestId === detailRequestId) {
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
    detailReadActive.value &&
    (typeof document === 'undefined' || document.visibilityState === 'visible')
  );
}

async function markDetailRead(result: TicketApi.Detail) {
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
    const currentListTicket = tickets.value.find(
      (ticket) => ticket.id === result.ticket.id,
    );
    if (
      !updated ||
      !canMarkDetailRead() ||
      !currentDetail ||
      currentTicket?.id !== result.ticket.id ||
      currentTicket.lastMessageAt !== snapshot ||
      currentTicket.messageCount !== messageCount ||
      (currentListTicket &&
        (currentListTicket.lastMessageAt !== snapshot ||
          currentListTicket.messageCount !== messageCount))
    ) {
      return;
    }
    detail.value = {
      ...currentDetail,
      ticket: { ...currentTicket, unreadCount: 0 },
    };
    tickets.value = tickets.value.map((ticket) =>
      ticket.id === result.ticket.id ? { ...ticket, unreadCount: 0 } : ticket,
    );
    summary.value = {
      ...summary.value,
      unread: Math.max(0, Number(summary.value.unread) - unreadCount),
    };
  } catch {
    // The conversation is still usable. A later refresh retries the marker.
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
  if (quickReplySaving.value) {
    return;
  }
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
  if (quickReplySaving.value) {
    return;
  }
  quickReplySaving.value = true;
  try {
    await deleteTicketQuickReply(id);
    message.success($t('ticket.quickReplies.deleted'));
    await loadQuickReplies();
  } finally {
    quickReplySaving.value = false;
  }
}

async function submitCreate(payload: TicketApi.CreateRequest) {
  if (createSaving.value) {
    return;
  }
  createSaving.value = true;
  try {
    const result = await createTicket(payload);
    createOpen.value = false;
    message.success($t('ticket.create.success'));
    page.value = 1;
    status.value = '';
    await loadList();
    await selectTicket(result.ticket.id);
  } finally {
    createSaving.value = false;
  }
}

async function submitMessage(mode: ComposerMode) {
  const ticketId = selectedId.value;
  const content = replyDraft.value.trim();
  if (!ticketId || !content || replyLoading.value) {
    return;
  }
  replyLoading.value = true;
  try {
    const result =
      mode === 'note'
        ? await addTicketInternalNote(ticketId, content)
        : await replyTicket(ticketId, content);
    if (selectedId.value === ticketId) {
      detail.value = result;
      replyDraft.value = '';
      composerMode.value = 'reply';
      applyTicketToList(result.ticket);
    }
    message.success(
      $t(
        mode === 'note' ? 'ticket.composer.noteAdded' : 'ticket.composer.sent',
      ),
    );
    await loadList();
  } finally {
    replyLoading.value = false;
  }
}

async function closeCurrentTicket() {
  const ticketId = selectedId.value;
  if (!ticketId || !canClose.value || closeLoading.value) {
    return;
  }
  closeLoading.value = true;
  try {
    const result = await closeTicket(ticketId);
    if (selectedId.value === ticketId) {
      detail.value = result;
      applyTicketToList(result.ticket);
    }
    message.success($t('ticket.detail.closed'));
    await loadList();
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
  if (!canUpdate.value || adminUpdating.value) {
    return;
  }
  await updateCurrentTicket({ tags });
}

async function updateCurrentTicket(payload: TicketApi.UpdateRequest) {
  const ticketId = selectedId.value;
  if (!ticketId) {
    return;
  }
  adminUpdating.value = true;
  try {
    const result = await updateTicket(ticketId, payload);
    if (selectedId.value === ticketId) {
      detail.value = result;
      applyTicketToList(result.ticket);
    }
    message.success($t('ticket.detail.updated'));
    await loadList();
  } finally {
    adminUpdating.value = false;
  }
}

async function uploadAttachments(files: File[]) {
  const ticketId = selectedId.value;
  if (
    !ticketId ||
    !canUseAttachments.value ||
    attachmentLoading.value ||
    files.length === 0
  ) {
    return;
  }
  attachmentLoading.value = true;
  let uploaded = 0;
  try {
    for (const file of files) {
      await uploadTicketAttachment(ticketId, file);
      uploaded += 1;
    }
    message.success($t('ticket.attachments.uploaded', [uploaded]));
  } finally {
    if (uploaded > 0 && selectedId.value === ticketId) {
      await loadDetail(ticketId);
    }
    attachmentLoading.value = false;
  }
}

async function removeAttachment(attachment: TicketApi.Attachment) {
  const ticketId = selectedId.value;
  if (!ticketId || !canUseAttachments.value || attachmentLoading.value) {
    return;
  }
  attachmentLoading.value = true;
  try {
    await deleteTicketAttachment(ticketId, attachment.id);
    message.success($t('ticket.attachments.deleted'));
    await loadDetail(ticketId);
  } finally {
    attachmentLoading.value = false;
  }
}

async function downloadAttachment(attachment: TicketApi.Attachment) {
  const ticketId = selectedId.value;
  if (!ticketId) {
    return;
  }
  const blob = await downloadTicketAttachment(ticketId, attachment.id);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = attachment.originalName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function applyTicketToList(ticket: TicketApi.Ticket) {
  tickets.value = tickets.value.map((item) =>
    item.id === ticket.id ? { ...item, ...ticket } : item,
  );
}

function clearDetailSelection() {
  detailRequestId += 1;
  selectedId.value = undefined;
  detail.value = undefined;
  detailLoading.value = false;
  detailError.value = '';
  mobilePane.value = 'list';
  detailReadActive.value = false;
}

async function applyFilters() {
  page.value = 1;
  mobilePane.value = 'list';
  detailReadActive.value = false;
  await loadList({ ensureSelection: true });
}

async function changePage(nextPage: number, nextPageSize: number) {
  page.value = nextPageSize === pageSize.value ? nextPage : 1;
  pageSize.value = nextPageSize;
  mobilePane.value = 'list';
  detailReadActive.value = false;
  await loadList({ ensureSelection: true });
}

async function refreshTickets() {
  await loadList();
}

function backToList() {
  mobilePane.value = 'list';
  detailReadActive.value = false;
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
  if (!currentUserId.value) {
    return [];
  }
  const info = userStore.userInfo;
  return [
    {
      label: `${info?.realName || info?.username || currentUserId.value} (#${currentUserId.value})`,
      value: currentUserId.value,
    },
  ];
}

function scheduleRealtimeRefresh() {
  if (realtimeRefreshTimer) {
    clearTimeout(realtimeRefreshTimer);
  }
  realtimeRefreshTimer = setTimeout(async () => {
    realtimeRefreshTimer = undefined;
    const changedTicketId = realtimeDetailId;
    realtimeDetailId = '';
    await loadList();
    if (changedTicketId && changedTicketId === selectedId.value) {
      await loadDetail(changedTicketId);
    }
  }, 220);
}

function emptySummary(): TicketApi.Summary {
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

onMounted(async () => {
  await Promise.all([
    loadAssignees(),
    loadList({ ensureSelection: true }),
    loadQuickReplies(),
  ]);
});

onBeforeUnmount(() => {
  if (realtimeRefreshTimer) {
    clearTimeout(realtimeRefreshTimer);
  }
});
</script>

<template>
  <Page
    auto-content-height
    class="ticket-page-shell"
    content-class="flex min-h-0 flex-col overflow-hidden"
    :description="pageSubtitle"
    :title="pageTitle"
  >
    <template #extra>
      <div class="ticket-page__header-actions">
        <span class="ticket-page__realtime" :class="`is-${realtimeStatus}`">
          <i aria-hidden="true"></i>
          {{ realtimeLabel }}
        </span>
        <Button v-if="canCreate" type="primary" @click="createOpen = true">
          <template #icon>
            <IconifyIcon icon="lucide:plus" />
          </template>
          {{ $t('ticket.create.button') }}
        </Button>
      </div>
    </template>

    <div class="ticket-page">
      <main
        class="ticket-page__workspace"
        :class="{ 'is-list-only': !showDetailPane }"
      >
        <div
          class="ticket-page__list-pane"
          :class="{
            'is-mobile-hidden': mobilePane === 'detail' && hasDetailPane,
          }"
        >
          <TicketListPanel
            v-model:category="category"
            v-model:keyword="keyword"
            v-model:priority="priority"
            v-model:status="status"
            v-model:unread-only="unreadOnly"
            :can-create="canCreate"
            :error="listError"
            :is-admin="isAdmin"
            :loading="listLoading"
            :page="page"
            :page-size="pageSize"
            :selected-id="selectedId"
            :summary="summary"
            :tickets="tickets"
            :total="total"
            @create="createOpen = true"
            @filter-change="applyFilters"
            @page-change="changePage"
            @refresh="refreshTickets"
            @search="applyFilters"
            @select="selectTicket"
          />
        </div>
        <div
          v-if="showDetailPane"
          class="ticket-page__detail-pane"
          :class="{ 'is-mobile-hidden': mobilePane === 'list' }"
        >
          <TicketDetail
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
            :is-admin="isAdmin"
            :loading="detailLoading || closeLoading"
            :quick-replies="quickReplies"
            :quick-replies-loading="quickRepliesLoading"
            :reply-loading="replyLoading"
            :show-back="mobilePane === 'detail'"
            :tags-loading="adminUpdating"
            @assign="assignTicket"
            @attachment-delete="removeAttachment"
            @attachment-download="downloadAttachment"
            @attachment-upload="uploadAttachments"
            @back="backToList"
            @close="closeCurrentTicket"
            @manage-quick-replies="quickReplyOpen = true"
            @refresh="loadDetail()"
            @reply="submitMessage"
            @status-change="changeStatus"
            @tags-change="changeTags"
          />
        </div>
      </main>
    </div>

    <CreateTicketModal
      v-if="canCreate"
      v-model:open="createOpen"
      :saving="createSaving"
      @submit="submitCreate"
    />

    <TicketQuickReplyManager
      v-if="canManageQuickReplies"
      v-model:open="quickReplyOpen"
      :quick-replies="quickReplies"
      :saving="quickReplySaving"
      @delete="removeQuickReply"
      @save="saveQuickReply"
    />
  </Page>
</template>

<style scoped>
.ticket-page-shell {
  container-name: ticket-page;
  container-type: inline-size;
}

.ticket-page {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  overflow: hidden;
}

.ticket-page__header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.ticket-page__realtime {
  display: inline-flex;
  gap: 7px;
  align-items: center;
  max-width: 240px;
  min-height: 30px;
  padding: 5px 9px;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--background) / 75%);
  border: 1px solid hsl(var(--border));
  border-radius: 999px;
}

.ticket-page__realtime i {
  flex: 0 0 7px;
  width: 7px;
  height: 7px;
  background: #94a3b8;
  border-radius: 999px;
}

.ticket-page__realtime.is-connected i {
  background: #22c55e;
  box-shadow: 0 0 0 4px rgb(34 197 94 / 12%);
}

.ticket-page__realtime.is-connecting i,
.ticket-page__realtime.is-reconnecting i {
  background: #f59e0b;
  animation: ticket-signal-pulse 1.4s ease-in-out infinite;
}

.ticket-page__realtime.is-offline i {
  background: #ef4444;
}

.ticket-page__workspace {
  display: grid;
  flex: 1;
  grid-template-rows: minmax(0, 1fr);

  /* 关键修复：显式设定 grid 行高为容器高度（minmax(0, 1fr)），而非默认的 auto（跟随内容）。
   * 修复前 grid 行高 = 内容高度，导致列表内容多时行被撑高、内部 overflow-y:auto 永不触发
   * → "列表无法滚动"；右列对话区同样被拉成内容高度、被 workspace 的 overflow:hidden 裁切
   * → "对话区域被挤压"。设 1fr 后行高固定为容器高度，子面板各自内部滚动。 */
  grid-template-columns: minmax(320px, 380px) minmax(0, 1fr);
  gap: 12px;
  min-height: 0;
  overflow: hidden;
}

.ticket-page__workspace.is-list-only {
  grid-template-columns: minmax(0, 1fr);
}

.ticket-page__list-pane,
.ticket-page__detail-pane {
  display: flex;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

@keyframes ticket-signal-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgb(245 158 11 / 22%);
  }

  50% {
    box-shadow: 0 0 0 5px rgb(245 158 11 / 5%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ticket-page__realtime i {
    animation: none !important;
  }
}

@container ticket-page (max-width: 1180px) {
  .ticket-page__workspace {
    grid-template-rows: minmax(0, 1fr);
    grid-template-columns: minmax(300px, 360px) minmax(0, 1fr);
  }
}

@container ticket-page (max-width: 980px) {
  .ticket-page__workspace {
    display: grid;
    grid-template-rows: minmax(0, 1fr);
    grid-template-columns: 1fr;
  }

  .ticket-page__workspace .is-mobile-hidden {
    display: none;
  }
}

@container ticket-page (max-width: 620px) {
  .ticket-page__header-actions {
    align-items: stretch;
    width: 100%;
  }

  .ticket-page__realtime {
    max-width: none;
  }

  .ticket-page__list-pane,
  .ticket-page__detail-pane {
    min-height: 0;
  }
}
</style>
