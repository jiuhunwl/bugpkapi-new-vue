<script setup lang="ts">
import type { TicketApi } from '#/api/ticket';

import { computed, nextTick, onBeforeUnmount, shallowRef, useTemplateRef, watch } from 'vue';

import { IconifyIcon, RotateCw } from '@vben/icons';

import {
  Button,
  Empty,
  Popconfirm,
  Select,
  Spin,
  Tooltip,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { $t } from '#/locales';

import TicketActivityTimeline from './TicketActivityTimeline.vue';
import TicketAttachmentPanel from './TicketAttachmentPanel.vue';
import TicketComposer from './TicketComposer.vue';
import TicketMessageTimeline from './TicketMessageTimeline.vue';
import TicketUserCard from './TicketUserCard.vue';

type ComposerMode = 'note' | 'reply';
type ResourceTab = 'activity' | 'attachments';

interface AssigneeOption {
  label: string;
  value: string;
}

interface Props {
  assigneeLoading: boolean;
  assigneeOptions: AssigneeOption[];
  attachmentLoading: boolean;
  canClose: boolean;
  canDeleteAttachment: boolean;
  canInternalNote: boolean;
  canManageQuickReplies: boolean;
  canReply: boolean;
  canUpdate: boolean;
  canUploadAttachment: boolean;
  currentUserId?: string;
  detail?: TicketApi.Detail;
  error?: string;
  imageUploadLoading?: boolean;
  isAdmin: boolean;
  loading: boolean;
  pendingImages?: TicketApi.Attachment[];
  quickReplies: TicketApi.QuickReply[];
  quickRepliesLoading: boolean;
  replyLoading: boolean;
  showBack: boolean;
  tagsLoading: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  imageUploadLoading: false,
  pendingImages: () => [],
});
const emit = defineEmits<{
  assign: [userId: string];
  attachmentDelete: [attachment: TicketApi.Attachment];
  attachmentDownload: [attachment: TicketApi.Attachment];
  attachmentUpload: [files: File[]];
  back: [];
  close: [];
  imageRemove: [attachment: TicketApi.Attachment];
  imageUpload: [files: File[]];
  manageQuickReplies: [];
  refresh: [];
  reply: [mode: ComposerMode];
  statusChange: [status: TicketApi.Status];
  tagsChange: [tags: string[]];
}>();
const draft = defineModel<string>('draft', { default: '' });
const composerMode = defineModel<ComposerMode>('composerMode', {
  default: 'reply',
});

const tagsDraft = shallowRef<string[]>([]);
// 资源区页签：附件 / 动态（对话线程常驻主栏，不再与资源互斥）
const resourcesTab = shallowRef<ResourceTab>('attachments');
// 管理区默认折叠（管理员可展开调整状态/负责人/标签）
const adminBarOpen = shallowRef(false);

const threadEl = useTemplateRef<HTMLElement>('threadEl');

const workflowStatuses: TicketApi.Status[] = [
  'OPEN',
  'PROCESSING',
  'WAITING_USER',
  'RESOLVED',
  'CLOSED',
];

const statusOptions = computed(() =>
  workflowStatuses.map((value) => ({
    label: $t(`ticket.status.${value}`),
    value,
  })),
);

const selectedAssigneeOptions = computed(() => {
  const ticket = props.detail?.ticket;
  if (
    !ticket?.assignedTo ||
    props.assigneeOptions.some((item) => item.value === ticket.assignedTo)
  ) {
    return props.assigneeOptions;
  }
  return [
    {
      label: ticket.assigneeName || `#${ticket.assignedTo}`,
      value: ticket.assignedTo,
    },
    ...props.assigneeOptions,
  ];
});

const canClaim = computed(
  () =>
    props.canUpdate &&
    !!props.currentUserId &&
    props.detail?.ticket.assignedTo !== props.currentUserId,
);

const closed = computed(() => props.detail?.ticket.status === 'CLOSED');

const tagsDirty = computed(() => {
  const current = props.detail?.ticket.tags ?? [];
  return JSON.stringify(tagsDraft.value) !== JSON.stringify(current);
});

const firstResponseSla = computed(() => {
  const ticket = props.detail?.ticket;
  if (!ticket) {
    return undefined;
  }
  if (!ticket.firstRespondedAt && !ticket.firstResponseDueAt) return undefined;
  if (ticket.firstRespondedAt) {
    return {
      icon: 'lucide:circle-check-big',
      label: $t('ticket.sla.responded'),
      tone: 'met',
      value: formatTime(ticket.firstRespondedAt),
    };
  }
  return {
    icon: ticket.firstResponseOverdue ? 'lucide:circle-alert' : 'lucide:timer',
    label: $t(
      ticket.firstResponseOverdue ? 'ticket.sla.overdue' : 'ticket.sla.pending',
    ),
    tone: ticket.firstResponseOverdue ? 'overdue' : 'pending',
    value: formatTime(ticket.firstResponseDueAt || ''),
  };
});

const resolutionSla = computed(() => {
  const ticket = props.detail?.ticket;
  if (!ticket) {
    return undefined;
  }
  if (!ticket.resolvedAt && !ticket.closedAt && !ticket.resolutionDueAt)
    return undefined;
  if (ticket.resolvedAt || ticket.closedAt) {
    return {
      icon: 'lucide:badge-check',
      label: $t('ticket.sla.completed'),
      tone: 'met',
      value: formatTime(ticket.resolvedAt || ticket.closedAt || ''),
    };
  }
  return {
    icon: ticket.resolutionOverdue
      ? 'lucide:triangle-alert'
      : 'lucide:alarm-clock',
    label: $t(
      ticket.resolutionOverdue ? 'ticket.sla.overdue' : 'ticket.sla.pending',
    ),
    tone: ticket.resolutionOverdue ? 'overdue' : 'pending',
    value: formatTime(ticket.resolutionDueAt || ''),
  };
});

function peerAvatarText(value: string) {
  const chars = Array.from(value.trim());
  if (chars.length === 0) {
    return '?';
  }
  return /^\d/.test(chars[0]!)
    ? chars.slice(0, 2).join('')
    : (chars[0]?.toUpperCase() ?? '?');
}

function peerAvatarHue(value: string) {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 360;
  }
  return hash;
}

const peerName = computed(() => {
  const ticket = props.detail?.ticket;
  if (!ticket) {
    return '';
  }
  if (props.isAdmin) {
    return ticket.displayName || ticket.username || `#${ticket.userId}`;
  }
  return ticket.assigneeName || $t('ticket.messages.staff');
});

const peerRole = computed(() =>
  props.isAdmin ? $t('ticket.messages.user') : $t('ticket.messages.staff'),
);

const peerInitial = computed(() => peerAvatarText(peerName.value));

const peerAvatarStyle = computed(() =>
  props.isAdmin
    ? {
        background: `hsl(${peerAvatarHue(peerName.value)} 62% 52%)`,
      }
    : undefined,
);

const messageSignature = computed(() =>
  (props.detail?.messages ?? []).map((message) => message.id).join('|'),
);

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

let threadContentObserver: ResizeObserver | undefined;
let settledScrollTimer: ReturnType<typeof setTimeout> | undefined;
let threadStickToBottom = true;

function onThreadScroll() {
  const thread = threadEl.value;
  if (!thread) return;
  threadStickToBottom =
    thread.scrollHeight - thread.scrollTop - thread.clientHeight <= 80;
}

function observeThreadContent() {
  threadContentObserver?.disconnect();
  if (typeof ResizeObserver === 'undefined') return;
  const content = threadEl.value?.firstElementChild;
  if (!content) return;
  threadContentObserver = new ResizeObserver(() => {
    const thread = threadEl.value;
    if (!thread) return;
    // 图片加载会撑高内容；只有用户原本就在底部附近时才跟随。
    if (threadStickToBottom) {
      thread.scrollTop = thread.scrollHeight;
    }
  });
  threadContentObserver.observe(content);
}

/** 线程是唯一滚动区：换票立即回底，追加消息平滑回底，发送框永不移动。 */
function scrollThreadToBottom(behavior: ScrollBehavior) {
  threadStickToBottom = true;
  void nextTick(() => {
    const scroll = () => {
      threadEl.value?.scrollTo({
        top: threadEl.value.scrollHeight,
        behavior: prefersReducedMotion ? 'auto' : behavior,
      });
    };
    scroll();
    observeThreadContent();
    // 首帧后懒加载图片还会撑高内容，稍后再贴底一次。
    if (settledScrollTimer) clearTimeout(settledScrollTimer);
    settledScrollTimer = setTimeout(() => {
      scroll();
      observeThreadContent();
    }, 350);
  });
}

onBeforeUnmount(() => {
  if (settledScrollTimer) clearTimeout(settledScrollTimer);
  threadContentObserver?.disconnect();
});

watch(
  () => [props.detail?.ticket.id, messageSignature.value] as const,
  ([ticketId], [prevTicketId]) => {
    if (!ticketId) return;
    scrollThreadToBottom(ticketId === prevTicketId ? 'smooth' : 'auto');
  },
  { flush: 'post' },
);

function changeAssignee(value: unknown) {
  emit('assign', String(value || ''));
}

function changeStatus(value: unknown) {
  if (typeof value === 'string') {
    emit('statusChange', value as TicketApi.Status);
  }
}

function changeTags(value: unknown) {
  if (!Array.isArray(value)) {
    tagsDraft.value = [];
    return;
  }
  tagsDraft.value = value
    .map((item) => String(item).trim().slice(0, 24))
    .filter((item, index, values) => item && values.indexOf(item) === index)
    .slice(0, 8);
}

function saveTags() {
  if (tagsDirty.value && !props.tagsLoading) {
    emit('tagsChange', tagsDraft.value);
  }
}

function formatTime(value: string) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-';
}

watch(
  () => [props.detail?.ticket.id, props.detail?.ticket.tags] as const,
  ([, tags]) => {
    tagsDraft.value = [...(tags ?? [])];
  },
  { immediate: true },
);
</script>

<template>
  <section class="ticket-detail">
    <div class="ticket-detail__spin">
      <div class="ticket-detail__spin-component">
        <Spin :spinning="loading">
          <div v-if="detail" class="ticket-detail__frame">
            <header class="ticket-detail__header">
              <div class="ticket-detail__identity">
                <div class="ticket-detail__topline">
                  <Button
                    v-if="showBack"
                    class="ticket-detail__back"
                    size="small"
                    type="text"
                    @click="emit('back')"
                  >
                    <template #icon>
                      <IconifyIcon icon="lucide:arrow-left" />
                    </template>
                    {{ $t('ticket.detail.backToList') }}
                  </Button>
                  <span class="ticket-detail__ticket-no">
                    <IconifyIcon icon="lucide:hash" />
                    <code>{{ detail.ticket.ticketNo }}</code>
                  </span>
                  <span class="ticket-detail__created">
                    {{ formatTime(detail.ticket.createdAt) }}
                  </span>
                </div>

                <div class="ticket-detail__peer">
                  <TicketUserCard
                    :enabled="isAdmin"
                    :fallback-name="peerName"
                    :user-id="detail.ticket.userId"
                  >
                    <span
                      :aria-label="peerName"
                      :style="peerAvatarStyle"
                      :title="isAdmin ? $t('ticket.userCard.clickHint') : undefined"
                      class="ticket-detail__peer-avatar"
                      :class="{ 'is-clickable': isAdmin }"
                      role="img"
                    >
                      <b>{{ peerInitial }}</b>
                      <em
                        v-if="!isAdmin"
                        aria-hidden="true"
                        class="ticket-detail__peer-badge"
                      >
                        <IconifyIcon icon="lucide:headset" />
                      </em>
                      <i
                        v-else
                        aria-hidden="true"
                        class="ticket-detail__peer-online"
                      />
                    </span>
                  </TicketUserCard>
                  <div class="ticket-detail__peer-main">
                    <div class="ticket-detail__peer-line">
                      <strong>{{ peerName }}</strong>
                      <span>{{ peerRole }}</span>
                    </div>
                    <h2>{{ detail.ticket.subject }}</h2>
                    <div class="ticket-detail__tags">
                      <span
                        class="tchip"
                        :class="`t-${detail.ticket.status.toLowerCase()}`"
                      >
                        <i aria-hidden="true"></i>
                        {{ $t(`ticket.status.${detail.ticket.status}`) }}
                      </span>
                      <span class="tchip t-plain">
                        {{ $t(`ticket.category.${detail.ticket.category}`) }}
                      </span>
                      <span
                        v-if="detail.ticket.priority !== 'NORMAL'"
                        class="tchip"
                        :class="`t-${detail.ticket.priority.toLowerCase()}`"
                      >
                        {{ $t(`ticket.priority.${detail.ticket.priority}`) }}
                      </span>
                      <span
                        v-for="item in detail.ticket.tags"
                        :key="item"
                        class="tchip t-plain"
                      >
                        {{ item }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div class="ticket-detail__header-actions">
                <Popconfirm
                  v-if="canClose && !closed && !isAdmin"
                  :cancel-text="$t('common.cancel')"
                  :ok-text="$t('common.confirm')"
                  :title="$t('ticket.detail.closeConfirm')"
                  @confirm="emit('close')"
                >
                  <Button danger>
                    <template #icon>
                      <IconifyIcon icon="lucide:archive" />
                    </template>
                    {{ $t('ticket.detail.close') }}
                  </Button>
                </Popconfirm>
                <Tooltip :title="$t('ticket.detail.refresh')">
                  <Button
                    :loading="loading"
                    shape="circle"
                    @click="emit('refresh')"
                  >
                    <template #icon>
                      <RotateCw class="size-4" />
                    </template>
                  </Button>
                </Tooltip>
              </div>
            </header>

            <div v-if="error" class="ticket-detail__error">
              <IconifyIcon icon="lucide:circle-alert" />
              <span>{{ error }}</span>
              <Button size="small" type="link" @click="emit('refresh')">
                <template #icon><RotateCw class="size-4" /></template>
                {{ $t('ticket.actions.refresh') }}
              </Button>
            </div>

            <div class="ticket-detail__main">
              <div class="ticket-detail__dialog">
                <div
                  ref="threadEl"
                  class="ticket-detail__thread"
                  data-testid="ticket-detail-scroll-region"
                  :aria-label="$t('ticket.messages.title')"
                  tabindex="0"
                  @scroll.passive="onThreadScroll"
                >
                  <TicketMessageTimeline
                    :attachments="detail.attachments"
                    :is-admin="isAdmin"
                    :messages="detail.messages"
                    :ticket-id="detail.ticket.id"
                  />
                </div>
                <div class="ticket-detail__composer">
                  <TicketComposer
                    v-model="draft"
                    v-model:mode="composerMode"
                    :can-manage-quick-replies="canManageQuickReplies"
                    :can-upload-files="canUploadAttachment"
                    :can-upload-images="canUploadAttachment"
                    :category="detail.ticket.category"
                    :closed="closed"
                    :file-upload-loading="attachmentLoading"
                    :image-upload-loading="imageUploadLoading"
                    :images="pendingImages"
                    :is-admin="isAdmin"
                    :language="detail.ticket.language"
                    :loading="replyLoading"
                    :note-permitted="canInternalNote"
                    :permitted="canReply"
                    :quick-replies="quickReplies"
                    :quick-replies-loading="quickRepliesLoading"
                    :ticket-id="detail.ticket.id"
                    @file-upload="emit('attachmentUpload', $event)"
                    @image-remove="emit('imageRemove', $event)"
                    @image-upload="emit('imageUpload', $event)"
                    @manage-quick-replies="emit('manageQuickReplies')"
                    @submit="emit('reply', $event)"
                  />
                </div>
              </div>

              <aside class="ticket-detail__rail">
                <section class="ticket-rail-card">
                  <header class="ticket-rail-card__header">
                    <h3>{{ $t('ticket.layout.details') }}</h3>
                    <button
                      v-if="isAdmin && canUpdate"
                      class="ticket-rail-card__admin-toggle"
                      :aria-expanded="adminBarOpen"
                      type="button"
                      @click="adminBarOpen = !adminBarOpen"
                    >
                      <IconifyIcon icon="lucide:settings-2" />
                      {{
                        adminBarOpen
                          ? $t('ticket.detail.adminCollapse')
                          : $t('ticket.detail.adminExpand')
                      }}
                    </button>
                  </header>
                  <dl class="ticket-rail-facts">
                    <div v-if="isAdmin">
                      <dt>{{ $t('ticket.detail.owner') }}</dt>
                      <dd>
                        {{
                          detail.ticket.displayName ||
                          detail.ticket.username ||
                          `#${detail.ticket.userId}`
                        }}
                      </dd>
                    </div>
                    <div>
                      <dt>{{ $t('ticket.detail.createdAt') }}</dt>
                      <dd>{{ formatTime(detail.ticket.createdAt) }}</dd>
                    </div>
                    <div>
                      <dt>{{ $t('ticket.detail.lastReply') }}</dt>
                      <dd>
                        {{ $t(`ticket.lastReply.${detail.ticket.lastReplyBy}`) }}
                      </dd>
                    </div>
                    <div v-if="isAdmin">
                      <dt>{{ $t('ticket.detail.assignee') }}</dt>
                      <dd>
                        {{
                          detail.ticket.assigneeName ||
                          $t('ticket.detail.unassigned')
                        }}
                      </dd>
                    </div>
                  </dl>
                  <div
                    v-if="firstResponseSla || resolutionSla"
                    class="ticket-rail-sla"
                  >
                    <span
                      v-if="firstResponseSla"
                      :class="`is-${firstResponseSla.tone}`"
                      :title="$t('ticket.sla.firstResponse')"
                    >
                      <IconifyIcon :icon="firstResponseSla.icon" />
                      <i>{{ firstResponseSla.label }}</i>
                      <b>{{ firstResponseSla.value }}</b>
                    </span>
                    <span
                      v-if="resolutionSla"
                      :class="`is-${resolutionSla.tone}`"
                      :title="$t('ticket.sla.resolution')"
                    >
                      <IconifyIcon :icon="resolutionSla.icon" />
                      <i>{{ resolutionSla.label }}</i>
                      <b>{{ resolutionSla.value }}</b>
                    </span>
                  </div>
                  <div
                    v-if="isAdmin && canUpdate && adminBarOpen"
                    class="ticket-rail-admin"
                  >
                    <label>
                      <span>{{ $t('ticket.detail.status') }}</span>
                      <Select
                        :options="statusOptions"
                        :value="detail.ticket.status"
                        @change="changeStatus"
                      />
                    </label>
                    <label>
                      <span>{{ $t('ticket.detail.assignee') }}</span>
                      <Select
                        :loading="assigneeLoading"
                        :options="selectedAssigneeOptions"
                        :placeholder="$t('ticket.detail.unassigned')"
                        :value="detail.ticket.assignedTo || undefined"
                        allow-clear
                        show-search
                        option-filter-prop="label"
                        @change="changeAssignee"
                      />
                    </label>
                    <label>
                      <span>{{ $t('ticket.detail.tags') }}</span>
                      <Select
                        :max-tag-count="3"
                        :placeholder="$t('ticket.detail.tagsPlaceholder')"
                        :token-separators="[',', '，']"
                        :value="tagsDraft"
                        mode="tags"
                        @change="changeTags"
                      />
                    </label>
                    <div class="ticket-rail-admin__actions">
                      <Button
                        v-if="tagsDirty"
                        :loading="tagsLoading"
                        size="small"
                        type="primary"
                        @click="saveTags"
                      >
                        {{ $t('ticket.detail.saveTags') }}
                      </Button>
                      <Button
                        v-if="canClaim"
                        size="small"
                        @click="emit('assign', currentUserId || '')"
                      >
                        <template #icon>
                          <IconifyIcon icon="lucide:hand" />
                        </template>
                        {{ $t('ticket.detail.claim') }}
                      </Button>
                      <Button
                        v-if="detail.ticket.assignedTo"
                        danger
                        size="small"
                        type="text"
                        @click="emit('assign', '')"
                      >
                        {{ $t('ticket.detail.unassign') }}
                      </Button>
                    </div>
                  </div>
                </section>

                <section class="ticket-rail-card">
                  <div
                    class="ticket-rail-tabs"
                    role="group"
                    :aria-label="$t('ticket.attachments.title')"
                  >
                    <button
                      :aria-pressed="resourcesTab === 'attachments'"
                      :class="{ 'is-active': resourcesTab === 'attachments' }"
                      type="button"
                      @click="resourcesTab = 'attachments'"
                    >
                      <IconifyIcon icon="lucide:paperclip" />
                      {{ $t('ticket.attachments.title') }}
                      <em>{{ detail.attachments.length }}</em>
                    </button>
                    <button
                      :aria-pressed="resourcesTab === 'activity'"
                      :class="{ 'is-active': resourcesTab === 'activity' }"
                      type="button"
                      @click="resourcesTab = 'activity'"
                    >
                      <IconifyIcon icon="lucide:history" />
                      {{ $t('ticket.activity.title') }}
                      <em>{{ detail.activities.length }}</em>
                    </button>
                  </div>
                  <div
                    v-show="resourcesTab === 'attachments'"
                    class="ticket-rail-panel"
                  >
                    <TicketAttachmentPanel
                      :attachments="detail.attachments"
                      :can-delete="canDeleteAttachment && !closed"
                      :can-upload="canUploadAttachment && !closed"
                      :current-user-id="currentUserId"
                      :is-admin="isAdmin"
                      :loading="attachmentLoading"
                      @delete="emit('attachmentDelete', $event)"
                      @download="emit('attachmentDownload', $event)"
                      @upload="emit('attachmentUpload', $event)"
                    />
                  </div>
                  <div
                    v-show="resourcesTab === 'activity'"
                    class="ticket-rail-panel"
                  >
                    <TicketActivityTimeline :activities="detail.activities" />
                  </div>
                </section>
              </aside>
            </div>
          </div>
          <div v-else-if="error" class="ticket-detail__error" role="alert">
            <Button v-if="showBack" @click="emit('back')">
{{
              $t('ticket.detail.backToList')
            }}
</Button>
            <span>{{ error }}</span>
            <Button @click="emit('refresh')">
              <template #icon><RotateCw class="size-4" /></template>
{{
              $t('ticket.actions.refresh')
            }}
</Button>
          </div>
          <Empty
            v-else
            :description="$t('ticket.detail.emptyDescription')"
            class="ticket-detail__empty"
          >
            <template #image>
              <span class="ticket-detail__empty-icon">
                <IconifyIcon icon="lucide:message-square-dashed" />
              </span>
            </template>
          </Empty>
        </Spin>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ticket-detail {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  container-name: ticket-detail;
  container-type: inline-size;
  overflow: hidden;
}

.ticket-detail__spin,
.ticket-detail__spin-component {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.ticket-detail__spin-component :deep(.ant-spin-nested-loading) {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.ticket-detail__spin-component :deep(.ant-spin-container) {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

/* 整页高度一次性切分：头部固定 → 主区占满剩余空间 → 线程内部滚动。
 * 历史缺陷：旧版整页共用一个滚动区，消息一多发送框就被推出可视区。 */
.ticket-detail__frame {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  width: 100%;
  min-height: 0;
  padding: 4px 0 12px;
  overflow: hidden;
}

.ticket-detail__header {
  display: flex;
  flex: none;
  gap: 20px;
  align-items: flex-start;
  justify-content: space-between;
  padding-bottom: 14px;
  margin-bottom: 14px;
  border-bottom: 1px solid hsl(var(--border));
}

.ticket-detail__identity {
  flex: 1 1 auto;
  min-width: 0;
}

.ticket-detail__topline {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  align-items: center;
  min-width: 0;
}

.ticket-detail__back {
  display: inline-flex;
  padding-inline: 0;
  color: hsl(var(--muted-foreground));
}

.ticket-detail__ticket-no {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  padding: 3px 9px;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 999px;
}

.ticket-detail__ticket-no svg {
  width: 11px;
  height: 11px;
}

.ticket-detail__ticket-no code {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.ticket-detail__created {
  font-size: 11px;
  color: hsl(var(--muted-foreground));
}

.ticket-detail__peer {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  min-width: 0;
  margin-top: 10px;
}

.ticket-detail__peer-avatar {
  position: relative;
  display: grid;
  flex: 0 0 40px;
  place-items: center;
  width: 40px;
  height: 40px;
  margin-top: 2px;
  color: white;
  background: hsl(var(--primary));
  border: 2px solid hsl(var(--card));
  border-radius: 50%;
  box-shadow: 0 3px 12px hsl(var(--primary) / 18%);
  transition:
    box-shadow 160ms ease,
    transform 160ms ease;
}

.ticket-detail__peer-avatar.is-clickable {
  cursor: pointer;
}

.ticket-detail__peer-avatar.is-clickable:hover,
.ticket-detail__peer-avatar.is-clickable:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px hsl(var(--primary) / 22%);
  transform: translateY(-1px);
}

.ticket-detail__peer-avatar b {
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
}

.ticket-detail__peer-badge {
  position: absolute;
  right: -4px;
  bottom: -3px;
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 50%;
}

.ticket-detail__peer-badge svg {
  width: 10px;
  height: 10px;
}

.ticket-detail__peer-online {
  position: absolute;
  right: -2px;
  bottom: 0;
  width: 10px;
  height: 10px;
  background: hsl(var(--success));
  border: 2px solid hsl(var(--card));
  border-radius: 50%;
}

.ticket-detail__peer-main {
  flex: 1 1 auto;
  min-width: 0;
}

.ticket-detail__peer-line {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  align-items: center;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.ticket-detail__peer-line strong {
  font-weight: 600;
  color: hsl(var(--foreground));
}

.ticket-detail__peer-line span {
  padding: 1px 6px;
  font-size: 10px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 50%);
  border-radius: 999px;
}

.ticket-detail__peer-main h2 {
  margin: 3px 0 9px;
  font-size: clamp(19px, 1.65vw, 24px);
  font-weight: 600;
  line-height: 1.35;
  color: hsl(var(--foreground));
  overflow-wrap: anywhere;
}

.ticket-detail__tags,
.ticket-detail__header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.ticket-detail__header-actions {
  flex: none;
  padding-top: 0;
}

.tchip {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  padding: 3px 8px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 5px;
}

.tchip i {
  width: 5px;
  height: 5px;
  background: currentcolor;
  border-radius: 50%;
}

.t-processing {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
  border-color: hsl(var(--primary) / 20%);
}

.t-open,
.t-high {
  color: hsl(var(--warning));
  border-color: hsl(var(--warning) / 25%);
}

.t-resolved {
  color: hsl(var(--success));
  border-color: hsl(var(--success) / 25%);
}

.t-urgent {
  color: hsl(var(--destructive));
}

.ticket-detail__error {
  display: flex;
  flex: none;
  gap: 10px;
  align-items: center;
  padding: 12px;
  margin-bottom: 12px;
  color: hsl(var(--destructive));
  border: 1px solid hsl(var(--destructive) / 25%);
  border-radius: 6px;
}

.ticket-detail__error span {
  flex: 1;
}

/* 主区双栏：左侧对话卡片（线程 + 钉底发送框），右侧信息栏各自滚动 */
.ticket-detail__main {
  display: grid;
  flex: 1 1 auto;
  grid-template: 'dialog rail' minmax(0, 1fr) / minmax(0, 1fr) clamp(
      264px,
      24vw,
      316px
    );
  gap: 0 14px;
  min-height: 0;
  overflow: hidden;
}

.ticket-detail__dialog {
  display: flex;
  flex-direction: column;
  grid-area: dialog;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 16px;
  box-shadow: 0 16px 42px hsl(var(--foreground) / 6%);
}

/* 线程：对话区内唯一的滚动 owner，发送框固定在它下方 */
.ticket-detail__thread {
  flex: 1 1 auto;
  min-height: 0;
  padding: 18px 18px 8px;
  overflow: hidden auto;
  overscroll-behavior: contain;
  background-color: hsl(var(--muted) / 18%);
  background-image: radial-gradient(
    circle at 1px 1px,
    hsl(var(--muted-foreground) / 12%) 1px,
    transparent 0
  );
  background-size: 22px 22px;
}

.ticket-detail__thread:focus-visible {
  outline: 2px solid hsl(var(--primary) / 60%);
  outline-offset: -2px;
}

.ticket-detail__composer {
  flex: none;
  padding: 10px 14px 12px;
  background: hsl(var(--card));
  border-top: 1px solid hsl(var(--border));
}

.ticket-detail__rail {
  display: flex;
  flex-direction: column;
  grid-area: rail;
  gap: 14px;
  min-width: 0;
  min-height: 0;
  padding-right: 2px;
  overflow: hidden auto;
  overscroll-behavior: contain;
}

.ticket-rail-card {
  flex: none;
  padding: 14px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.ticket-rail-card__header {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.ticket-rail-card__header h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.ticket-rail-card__admin-toggle {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  padding: 4px 9px;
  font-size: 11px;
  color: hsl(var(--primary));
  cursor: pointer;
  background: hsl(var(--primary) / 6%);
  border: 1px solid hsl(var(--primary) / 24%);
  border-radius: 6px;
}

.ticket-rail-card__admin-toggle svg {
  width: 13px;
  height: 13px;
}

.ticket-rail-facts {
  display: grid;
  gap: 10px;
  margin: 0;
}

.ticket-rail-facts div {
  display: grid;
  gap: 3px;
}

.ticket-rail-facts dt {
  font-size: 11px;
  color: hsl(var(--muted-foreground));
}

.ticket-rail-facts dd {
  margin: 0;
  font-size: 12.5px;
  font-weight: 500;
  color: hsl(var(--foreground));
  overflow-wrap: anywhere;
}

.ticket-rail-sla {
  display: grid;
  gap: 8px;
  padding-top: 12px;
  margin-top: 12px;
  border-top: 1px dashed hsl(var(--border));
}

.ticket-rail-sla span {
  display: flex;
  gap: 6px;
  align-items: baseline;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
}

.ticket-rail-sla span svg {
  flex: 0 0 auto;
  width: 13px;
  height: 13px;
  transform: translateY(2px);
}

.ticket-rail-sla span i {
  flex: 1;
  min-width: 0;
  font-style: normal;
}

.ticket-rail-sla span b {
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--foreground));
}

.ticket-rail-sla span.is-overdue {
  color: hsl(var(--destructive));
}

.ticket-rail-sla span.is-overdue b {
  color: hsl(var(--destructive));
}

.ticket-rail-sla span.is-met {
  color: hsl(var(--success));
}

.ticket-rail-sla span.is-met b {
  color: hsl(var(--success));
}

.ticket-rail-admin {
  display: grid;
  gap: 10px;
  padding: 12px;
  margin-top: 12px;
  background: hsl(var(--muted) / 30%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.ticket-rail-admin label {
  display: grid;
  gap: 5px;
  min-width: 0;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
}

.ticket-rail-admin__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ticket-rail-tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
}

.ticket-rail-tabs button {
  display: inline-flex;
  flex: 1 1 0;
  gap: 6px;
  align-items: center;
  justify-content: center;
  min-width: 0;
  padding: 7px 8px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  transition:
    color 0.15s ease,
    border-color 0.15s ease,
    background 0.15s ease;
}

.ticket-rail-tabs button.is-active {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
  border-color: hsl(var(--primary) / 35%);
}

.ticket-rail-tabs svg {
  width: 14px;
  height: 14px;
}

.ticket-rail-tabs em {
  padding: 1px 5px;
  font-size: 10px;
  font-style: normal;
  background: hsl(var(--muted));
  border-radius: 4px;
}

.ticket-rail-panel {
  min-width: 0;
}

.ticket-detail__empty {
  padding: 70px 20px;
}

.ticket-detail__empty-icon {
  display: inline-flex;
  font-size: 35px;
  color: hsl(var(--muted-foreground));
}

@container ticket-detail (max-width: 980px) {
  .ticket-detail__frame {
    padding-bottom: 10px;
  }

  .ticket-detail__header {
    flex-direction: column;
    gap: 10px;
  }

  .ticket-detail__header-actions {
    padding-top: 0;
  }

  .ticket-detail__peer-avatar {
    flex-basis: 36px;
    width: 36px;
    height: 36px;
  }

  .ticket-detail__peer-avatar b {
    font-size: 13px;
  }

  .ticket-detail__peer-main h2 {
    font-size: 18px;
  }

  .ticket-detail__created {
    display: none;
  }

  /* 窄屏：对话、信息栏随主区滚动，发送框 sticky 钉在可视底部 */
  .ticket-detail__main {
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .ticket-detail__dialog {
    flex: none;
    overflow: visible;
  }

  .ticket-detail__thread {
    flex: none;
    max-height: 56vh;
  }

  .ticket-detail__composer {
    position: sticky;
    bottom: 0;
    z-index: 3;
    border-radius: 0 0 12px 12px;
  }

  .ticket-detail__rail {
    flex: none;
    overflow: visible;
  }
}
</style>
