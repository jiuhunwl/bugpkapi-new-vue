<script setup lang="ts">
import type { TicketApi } from '#/api/ticket';

import { computed, ref, watch } from 'vue';

import { IconifyIcon, RotateCw } from '@vben/icons';

import {
  Badge,
  Button,
  Empty,
  Input,
  Pagination,
  Select,
  Spin,
  Tooltip,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { $t } from '#/locales';

interface Props {
  canCreate: boolean;
  error?: string;
  isAdmin: boolean;
  loading: boolean;
  page: number;
  pageSize: number;
  selectedId?: string;
  summary: TicketApi.Summary;
  tickets: TicketApi.Ticket[];
  total: number;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  create: [];
  filterChange: [];
  pageChange: [page: number, pageSize: number];
  refresh: [];
  search: [];
  select: [ticketId: string];
}>();

const keyword = defineModel<string>('keyword', { default: '' });
const status = defineModel<'' | TicketApi.Status>('status', { default: '' });
const priority = defineModel<'' | TicketApi.Priority>('priority', {
  default: '',
});
const category = defineModel<'' | TicketApi.Category>('category', {
  default: '',
});
const unreadOnly = defineModel<boolean>('unreadOnly', { default: false });

/* 筛选区默认收起：380px 宽的左栏里，展开的筛选器会吃掉 214px，
 * 把列表可视高度压到 240px（实测）。收起后列表拿到几乎全部高度。
 * 存在生效中的筛选条件时自动展开，避免「有筛选但看不见」的困惑。 */
const filtersOpen = ref(false);
const filtersActive = computed(
  () =>
    keyword.value.trim() !== '' ||
    status.value !== '' ||
    priority.value !== '' ||
    category.value !== '',
);
watch(filtersActive, (active) => {
  if (active) filtersOpen.value = true;
});

const statusOptions = computed(() =>
  (['OPEN', 'PROCESSING', 'WAITING_USER', 'RESOLVED', 'CLOSED'] as const).map(
    (value) => ({ label: $t(`ticket.status.${value}`), value }),
  ),
);

const priorityOptions = computed(() =>
  (['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const).map((value) => ({
    label: $t(`ticket.priority.${value}`),
    value,
  })),
);

const categoryOptions = computed(() =>
  (['GENERAL', 'API', 'BILLING', 'ACCOUNT', 'BUG', 'OTHER'] as const).map(
    (value) => ({ label: $t(`ticket.category.${value}`), value }),
  ),
);

const summaryItems = computed(() => [
  {
    key: 'all',
    label: $t('ticket.summary.all'),
    status: '' as const,
    value: props.summary.all,
  },
  {
    key: 'open',
    label: $t('ticket.summary.open'),
    status: 'OPEN' as const,
    value: props.summary.open,
  },
  {
    key: 'processing',
    label: $t('ticket.summary.processing'),
    status: 'PROCESSING' as const,
    value: props.summary.processing,
  },
  {
    key: 'waitingUser',
    label: $t('ticket.summary.waitingUser'),
    status: 'WAITING_USER' as const,
    value: props.summary.waitingUser,
  },
  {
    key: 'resolved',
    label: $t('ticket.summary.resolved'),
    status: 'RESOLVED' as const,
    value: props.summary.resolved,
  },
  {
    key: 'closed',
    label: $t('ticket.summary.closed'),
    status: 'CLOSED' as const,
    value: props.summary.closed,
  },
  {
    key: 'unread',
    label: $t('ticket.summary.unread'),
    status: '' as const,
    unread: true,
    value: props.summary.unread,
  },
]);

const activeSummaryKey = computed(() => {
  if (unreadOnly.value) return 'unread';
  return (
    summaryItems.value.find(
      (item) => !item.unread && item.status === status.value,
    )?.key ?? 'all'
  );
});

function selectSummary(key: number | string) {
  const item = summaryItems.value.find(
    (summary) => summary.key === String(key),
  );
  if (!item) return;
  unreadOnly.value = item.unread === true;
  status.value = item.status;
  emit('filterChange');
}

function changeStatus(value: unknown) {
  unreadOnly.value = false;
  status.value = (value || '') as '' | TicketApi.Status;
  emit('filterChange');
}

function changePriority(value: unknown) {
  priority.value = (value || '') as '' | TicketApi.Priority;
  emit('filterChange');
}

function changeCategory(value: unknown) {
  category.value = (value || '') as '' | TicketApi.Category;
  emit('filterChange');
}

function resetFilters() {
  keyword.value = '';
  status.value = '';
  priority.value = '';
  category.value = '';
  unreadOnly.value = false;
  emit('filterChange');
}

function formatUpdated(value: string) {
  return dayjs(value).format('MM-DD HH:mm');
}

function ownerName(ticket: TicketApi.Ticket) {
  return ticket.displayName || ticket.username || `#${ticket.userId}`;
}

function isSlaOverdue(ticket: TicketApi.Ticket) {
  return ticket.firstResponseOverdue || ticket.resolutionOverdue;
}

function visibleTicketTags(ticket: TicketApi.Ticket) {
  return ticket.tags.slice(0, 2);
}

function slaDeadline(ticket: TicketApi.Ticket) {
  const value = ticket.firstRespondedAt
    ? ticket.resolutionDueAt
    : ticket.firstResponseDueAt;
  return value ? dayjs(value).format('MM-DD HH:mm') : '';
}
</script>

<template>
  <section class="ticket-list-panel">
    <header class="ticket-list-panel__header">
      <div>
        <span class="ticket-list-panel__eyebrow">
          {{ isAdmin ? $t('ticket.list.adminTitle') : $t('ticket.list.title') }}
        </span>
        <strong>{{ $t('ticket.list.total', [total]) }}</strong>
      </div>
      <div class="ticket-list-panel__actions">
        <Tooltip :title="$t('ticket.actions.refresh')">
          <Button :loading="loading" shape="circle" @click="emit('refresh')">
            <template #icon>
              <RotateCw class="size-4" />
            </template>
          </Button>
        </Tooltip>
      </div>
    </header>

    <div class="ticket-summary-tabs" role="tablist">
      <button
        v-for="item in summaryItems"
        :key="item.key"
        class="ticket-summary-tab"
        :class="{
          'is-active': item.key === activeSummaryKey,
          'is-unread': item.unread,
        }"
        type="button"
        @click="selectSummary(item.key)"
      >
        <span class="ticket-summary-tab__label">{{ item.label }}</span>
        <span
          class="ticket-summary-tab__count"
          :class="{ 'is-unread': item.unread && item.value > 0 }"
        >
          {{ item.value }}
        </span>
      </button>
    </div>

    <div class="ticket-filters" :class="{ 'is-collapsed': !filtersOpen }">
      <div class="ticket-filters__bar">
        <Input.Search
          v-model:value="keyword"
          :placeholder="$t('ticket.filters.keyword')"
          allow-clear
          @search="emit('search')"
        />
        <button
          class="ticket-filters__toggle"
          :class="{ 'is-active': filtersActive }"
          type="button"
          :aria-expanded="filtersOpen"
          @click="filtersOpen = !filtersOpen"
        >
          <IconifyIcon icon="lucide:sliders-horizontal" />
          <span>{{ $t('ticket.filters.title') }}</span>
          <IconifyIcon
            :icon="filtersOpen ? 'lucide:chevron-up' : 'lucide:chevron-down'"
          />
        </button>
      </div>
      <div v-show="filtersOpen" class="ticket-filters__row">
        <Select
          :options="statusOptions"
          :placeholder="$t('ticket.filters.status')"
          :value="status || undefined"
          allow-clear
          @change="changeStatus"
        />
        <Select
          :options="priorityOptions"
          :placeholder="$t('ticket.filters.priority')"
          :value="priority || undefined"
          allow-clear
          @change="changePriority"
        />
        <Select
          :options="categoryOptions"
          :placeholder="$t('ticket.filters.category')"
          :value="category || undefined"
          allow-clear
          @change="changeCategory"
        />
        <Tooltip :title="$t('ticket.filters.reset')">
          <Button class="ticket-filters__reset" @click="resetFilters">
            <template #icon>
              <IconifyIcon icon="lucide:filter-x" />
            </template>
          </Button>
        </Tooltip>
      </div>
    </div>

    <div v-if="error" class="ticket-list-panel__error">
      <IconifyIcon icon="lucide:circle-alert" />
      <span>{{ error }}</span>
      <Button size="small" type="link" @click="emit('refresh')">
        <template #icon><RotateCw class="size-4" /></template>
        {{ $t('ticket.actions.refresh') }}
      </Button>
    </div>

    <div class="ticket-list-panel__body">
      <Spin :spinning="loading" class="ticket-list-panel__spin">
        <div v-if="tickets.length > 0" class="ticket-queue">
        <button
          v-for="ticket in tickets"
          :key="ticket.id"
          class="ticket-card"
          :class="[
            `priority-${ticket.priority.toLowerCase()}`,
            {
              'is-overdue': isSlaOverdue(ticket),
              'is-selected': selectedId === ticket.id,
            },
          ]"
          type="button"
          @click="emit('select', ticket.id)"
        >
          <span class="ticket-card__rail" aria-hidden="true"></span>
          <span class="ticket-card__topline">
            <code>{{ ticket.ticketNo }}</code>
            <Badge
              v-if="ticket.unreadCount > 0"
              :count="ticket.unreadCount"
              :overflow-count="99"
            />
          </span>
          <strong class="ticket-card__subject">{{ ticket.subject }}</strong>
          <span v-if="isAdmin" class="ticket-card__owner">
            <IconifyIcon icon="lucide:user-round" />
            {{ $t('ticket.list.owner') }}：{{ ownerName(ticket) }}
            <small>#{{ ticket.userId }}</small>
          </span>
          <span class="ticket-card__preview">
            {{ ticket.lastMessagePreview || '-' }}
          </span>
          <span class="ticket-card__tags">
            <span class="tchip" :class="`t-${ticket.status.toLowerCase()}`">
              <i aria-hidden="true"></i>{{ $t(`ticket.status.${ticket.status}`) }}
            </span>
            <span class="tchip t-plain">
              {{ $t(`ticket.category.${ticket.category}`) }}
            </span>
            <span
              v-if="ticket.priority !== 'NORMAL'"
              class="tchip"
              :class="`t-${ticket.priority.toLowerCase()}`"
            >
              {{ $t(`ticket.priority.${ticket.priority}`) }}
            </span>
            <span v-if="isSlaOverdue(ticket)" class="tchip t-overdue">
              {{ $t('ticket.sla.overdue') }}
            </span>
            <span
              v-for="item in visibleTicketTags(ticket)"
              :key="item"
              class="tchip t-plain"
            >
              {{ item }}
            </span>
            <span v-if="ticket.tags.length > 2" class="tchip t-plain">
              +{{ ticket.tags.length - 2 }}
            </span>
          </span>
          <span class="ticket-card__footer">
            <span>
              <IconifyIcon icon="lucide:message-circle-more" />
              {{ $t('ticket.list.messages', [ticket.messageCount]) }}
            </span>
            <time v-if="isSlaOverdue(ticket)" class="is-overdue">
              {{ $t('ticket.sla.deadline', [slaDeadline(ticket)]) }}
            </time>
            <time v-else>
              {{
                $t('ticket.list.updated', [formatUpdated(ticket.lastMessageAt)])
              }}
            </time>
          </span>
        </button>
      </div>
      <Empty
        v-else
        :description="
          isAdmin
            ? $t('ticket.list.adminEmptyDescription')
            : $t('ticket.list.emptyDescription')
        "
        class="ticket-list-panel__empty"
      >
        <template #image>
          <span class="ticket-list-panel__empty-icon">
            <IconifyIcon icon="lucide:inbox" />
          </span>
        </template>
        <Button v-if="canCreate" type="primary" @click="emit('create')">
          {{ $t('ticket.create.button') }}
        </Button>
      </Empty>
      </Spin>
    </div>

    <Pagination
      v-if="total > pageSize"
      :current="page"
      :page-size="pageSize"
      :page-size-options="['10', '20', '50']"
      :total="total"
      class="ticket-list-panel__pagination"
      show-size-changer
      @change="(nextPage, nextSize) => emit('pageChange', nextPage, nextSize)"
    />
  </section>
</template>

<style scoped>
.ticket-list-panel {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  container-name: ticket-list;
  container-type: inline-size;
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 16px;
}

.ticket-list-panel__header {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 12px;
}

.ticket-list-panel__header > div:first-child {
  min-width: 0;
}

.ticket-list-panel__eyebrow {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 11px;
  font-weight: 800;
  color: hsl(var(--primary));
  text-transform: uppercase;
  letter-spacing: 0.08em;
  white-space: nowrap;
}

.ticket-list-panel__header strong {
  display: block;
  margin-top: 3px;
  font-size: 17px;
}

.ticket-list-panel__actions {
  display: flex;
  flex: 0 0 auto;
  gap: 8px;
}

/* 汇总页签：4 列网格自动换行，绝不挤压（QQ 会话列表式） */
.ticket-summary-tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  padding: 10px 14px;
  border-bottom: 1px solid hsl(var(--border));
}

@container ticket-list (max-width: 560px) {
  .ticket-summary-tabs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.ticket-summary-tab {
  display: flex;
  gap: 7px;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  padding: 7px 10px;
  overflow: hidden;
  font-size: 12px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 9px;
  transition:
    color 0.16s ease,
    border-color 0.16s ease,
    background 0.16s ease;
}

.ticket-summary-tab:hover {
  color: hsl(var(--primary));
  border-color: hsl(var(--primary) / 45%);
}

.ticket-summary-tab.is-active {
  font-weight: 700;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
  border-color: hsl(var(--primary) / 35%);
}

.ticket-summary-tab__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ticket-summary-tab__count {
  display: grid;
  flex: none;
  place-items: center;
  min-width: 19px;
  height: 18px;
  padding: 0 5px;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 10.5px;
  font-weight: 800;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
  border-radius: 999px;
}

.ticket-summary-tab.is-active .ticket-summary-tab__count {
  color: #fff;
  background: hsl(var(--primary));
}

.ticket-summary-tab__count.is-unread {
  color: #fff;
  background: linear-gradient(120deg, #4f8cff, #8b5cf6 52%, #22d3ee);
}

.ticket-filters {
  display: grid;
  gap: 8px;
  padding: 10px 16px 12px;
  border-bottom: 1px solid hsl(var(--border));
}

.ticket-filters__bar {
  display: flex;
  gap: 7px;
  align-items: center;
}

.ticket-filters__bar > :deep(.ant-input-search) {
  flex: 1 1 auto;
  min-width: 0;
}

/* 收起/展开筛选：左栏只有 380px，展开的 4 个下拉会吃掉 214px 高度 */
.ticket-filters__toggle {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 5px;
  align-items: center;
  height: 32px;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  transition:
    color 0.16s ease,
    border-color 0.16s ease;
}

.ticket-filters__toggle:hover {
  color: hsl(var(--primary));
  border-color: hsl(var(--primary) / 45%);
}

.ticket-filters__toggle.is-active {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
  border-color: hsl(var(--primary) / 40%);
}

.ticket-filters__toggle svg {
  width: 14px;
  height: 14px;
}

.ticket-filters__row {
  display: grid;
  grid-template-columns: repeat(2, minmax(120px, 1fr));
  gap: 7px;
}

.ticket-filters__row > * {
  min-width: 0;
}

.ticket-filters__reset {
  width: 100%;
  padding-inline: 0;
}

.ticket-list-panel__error {
  display: flex;
  gap: 7px;
  align-items: center;
  padding: 9px 14px;
  margin: 10px 16px 0;
  font-size: 12px;
  color: #b91c1c;
  background: rgb(239 68 68 / 8%);
  border: 1px solid rgb(239 68 68 / 18%);
  border-radius: 9px;
}

.ticket-list-panel__error span {
  flex: 1;
}

/* 滚动层必须由我们自己控制的 div 承担。
 * 踩坑：Ant 的 Spin 会把 attrs 里的 class 落在一个「外层包装 div」上，
 * 真正的 .ant-spin-nested-loading 是它的兄弟/子级，所以给 <Spin class="x">
 * 写 .x :deep(.ant-spin-nested-loading) 是永远选不中的——那层 wrapper
 * 会保留 flex:0 1 auto / min-height:auto，跟随内容长到 1217px，
 * 面板 overflow:hidden 直接把它裁掉，看起来就是「列表无法上下滚动」。
 * 现在改为外层自建 .ticket-list-panel__body 作为唯一的滚动 owner。 */
.ticket-list-panel__body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.ticket-list-panel__spin {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.ticket-list-panel__body :deep(.ant-spin-nested-loading) {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}

.ticket-list-panel__body :deep(.ant-spin-container) {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden auto;
}

.ticket-queue {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
}

.ticket-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  padding: 13px 13px 12px 17px;
  overflow: hidden;
  color: inherit;
  text-align: left;
  cursor: pointer;
  outline: none;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    transform 160ms ease;
}

.ticket-card:hover {
  border-color: hsl(var(--primary) / 42%);
  transform: translateY(-1px);
}

.ticket-card.is-selected {
  background: hsl(var(--primary) / 6%);
  border-color: hsl(var(--primary) / 56%);
  box-shadow: 0 10px 28px hsl(var(--primary) / 10%);
}

/* 选中态：左侧 rail 变品牌渐变并点亮 */
.ticket-card.is-selected .ticket-card__rail {
  width: 4px;
  background: linear-gradient(180deg, #4f8cff, #8b5cf6 52%, #22d3ee);
  box-shadow: 0 0 10px hsl(var(--primary) / 45%);
}

.ticket-card.is-overdue:not(.is-selected) {
  border-color: rgb(220 38 38 / 28%);
}

.ticket-card:focus-visible {
  box-shadow: 0 0 0 2px hsl(var(--ring));
}

.ticket-card__rail {
  position: absolute;
  top: 11px;
  bottom: 11px;
  left: 5px;
  width: 3px;
  background: #94a3b8;
  border-radius: 999px;
}

.ticket-card.priority-high .ticket-card__rail {
  background: #f97316;
}

.ticket-card.priority-urgent .ticket-card__rail {
  background: #ef4444;
  box-shadow: 0 0 12px rgb(239 68 68 / 45%);
}

.ticket-card.priority-low .ticket-card__rail {
  background: #22c55e;
}

.ticket-card__topline,
.ticket-card__footer,
.ticket-card__owner,
.ticket-card__tags {
  display: flex;
  align-items: center;
  min-width: 0;
}

.ticket-card__topline {
  justify-content: space-between;
}

.ticket-card__topline code {
  font-size: 11px;
  font-weight: 800;
  color: hsl(var(--muted-foreground));
  letter-spacing: 0.03em;
}

.ticket-card__subject {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 15px;
  line-height: 21px;
  white-space: nowrap;
}

.ticket-card__owner {
  gap: 5px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.ticket-card__owner svg {
  flex: 0 0 auto;
  width: 13px;
  height: 13px;
}

.ticket-card__owner small {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}

.ticket-card__preview {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  font-size: 12px;
  line-height: 19px;
  color: hsl(var(--muted-foreground));
  -webkit-box-orient: vertical;
}

.ticket-card__tags {
  flex-wrap: wrap;
  gap: 4px;
}

.ticket-card__footer {
  gap: 8px;
  justify-content: space-between;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
}

.ticket-card__footer span {
  display: inline-flex;
  gap: 4px;
  align-items: center;
}

.ticket-card__footer svg {
  width: 13px;
  height: 13px;
}

.ticket-card__footer time {
  font-variant-numeric: tabular-nums;
}

.ticket-card__footer time.is-overdue {
  color: #dc2626;
}

.ticket-list-panel__empty {
  padding: 70px 24px;
}

.ticket-list-panel__empty-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 74px;
  height: 74px;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
  border: 1px solid hsl(var(--primary) / 14%);
  border-radius: 24px;
}

.ticket-list-panel__empty-icon svg {
  width: 32px;
  height: 32px;
}

.ticket-list-panel__pagination {
  display: flex;
  justify-content: flex-end;
  padding: 10px 14px 14px;
  border-top: 1px solid hsl(var(--border));
}

@container ticket-list (max-width: 420px) {
  .ticket-summary-tabs {
    padding: 0;
    margin-inline: 12px;
  }

  .ticket-filters__row {
    grid-template-columns: minmax(0, 1fr);
  }
}

@container ticket-list (max-width: 620px) {
  .ticket-list-panel {
    max-height: none;
  }

  .ticket-list-panel__header {
    align-items: flex-start;
  }

  .ticket-filters__row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
