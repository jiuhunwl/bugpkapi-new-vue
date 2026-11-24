<script setup lang="ts">
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { TicketApi } from '#/api/ticket';

import { computed, onBeforeUnmount, onMounted, shallowRef } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { useAccessStore, useUserStore } from '@vben/stores';

import { Button, message, Result } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getUser, getUserList } from '#/api/system/user';
import { createTicket, getTicketList } from '#/api/ticket';
import { $t } from '#/locales';
import { readGridSort } from '#/utils/grid-sort';
import { createLatestRequestRunner } from '#/views/interface/log-request';
import SystemUserDetail from '#/views/system/user/modules/detail.vue';

import CreateTicketModal from './components/CreateTicketModal.vue';
import TicketSummary from './components/TicketSummary.vue';
import TicketUserCard from './components/TicketUserCard.vue';
import { useTicketRealtime } from './composables/use-ticket-realtime';
import {
  formatTicketTime,
  ticketOwnerLabel,
  useColumns,
  useGridFormSchema,
} from './data';
import { readTicketListState, ticketListQuery } from './list-state';

interface Props {
  /** 当前页面身份：决定权限码、详情路由、是否显示"提交人"列与"新建工单"按钮 */
  mode: 'admin' | 'user';
}

const props = defineProps<Props>();

const router = useRouter();
const route = useRoute();
const accessStore = useAccessStore();
const hasCode = (code: string) => accessStore.accessCodes.includes(code);
const canRead = computed(() =>
  hasCode(props.mode === 'admin' ? 'ticket:admin:list' : 'ticket:user:list'),
);
const initialState = readTicketListState(route.query);
const listState = shallowRef(initialState);
const listRunner = createLatestRequestRunner(
  (params: TicketApi.ListParams, signal: AbortSignal) =>
    getTicketList(params, signal),
);
let disposed = false;
let requestId = 0;
const userStore = useUserStore();

const isAdminRole = computed(() => userStore.userRoles.includes('admin'));

const isAdmin = computed(() => props.mode === 'admin');
const canCreate = computed(
  () =>
    props.mode === 'user' &&
    !isAdminRole.value &&
    hasCode('ticket:user:create'),
);
const canListUsers = computed(
  () => isAdmin.value && hasCode('system:user:list'),
);
const assigneeOptions = shallowRef<Array<{ label: string; value: number }>>([]);

// 表格列 → 服务端排序字段（白名单在 readTicketListState 里再校验一次）。
const columnSortFields: Record<string, TicketApi.ListSortBy> = {
  createdAt: 'created_at',
  lastMessageAt: 'last_message_at',
  priority: 'priority',
  status: 'status',
  updatedAt: 'updated_at',
};
const sortColumnByField: Record<string, string> = {
  created_at: 'createdAt',
  last_message_at: 'lastMessageAt',
  priority: 'priority',
  status: 'status',
  updated_at: 'updatedAt',
};
const initialSort =
  initialState.sortBy && sortColumnByField[initialState.sortBy]
    ? {
        field: sortColumnByField[initialState.sortBy]!,
        order: initialState.sortOrder ?? 'desc',
      }
    : undefined;

/** 列表数据：vxe-grid 的 proxyConfig 由 ajax.query 直接返回接口结构即可。 */
const summary = shallowRef<TicketApi.Summary>();
const listLoading = shallowRef(true);
const listError = shallowRef('');
const createOpen = shallowRef(false);
const createSaving = shallowRef(false);

let realtimeRefreshTimer: ReturnType<typeof setTimeout> | undefined;

const { status: realtimeStatus } = useTicketRealtime({
  enabled: () => canRead.value,
  onEvent() {
    scheduleRealtimeRefresh();
  },
});

const realtimeLabel = computed(() =>
  $t(`ticket.realtime.${realtimeStatus.value}`),
);

const detailRouteName = computed(() =>
  isAdmin.value ? 'AdminTicketDetail' : 'UserTicketDetail',
);

const [UserDetailDrawer, userDetailDrawerApi] = useVbenDrawer({
  connectedComponent: SystemUserDetail,
  destroyOnClose: true,
});

/**
 * 管理员排查工单时，第一个要确认的就是这个账号的余额、套餐与状态。
 * 复用用户管理的详情抽屉（而不是另写一份），两端口径才不会分叉。
 * 取用户失败只提示，不影响列表本身。
 */
async function openUserInfo(row: TicketApi.Ticket) {
  if (!isAdmin.value || !row.userId) return;
  try {
    const user = await getUser(String(row.userId));
    userDetailDrawerApi.setData(user).open();
  } catch {
    message.error($t('ticket.errors.userDetailFailed'));
  }
}

function ownerInitial(row: TicketApi.Ticket) {
  const chars = Array.from(ticketOwnerLabel(row).trim());
  if (chars.length === 0) return '?';
  return /^\d/.test(chars[0]!)
    ? chars.slice(0, 2).join('')
    : (chars[0]?.toUpperCase() ?? '?');
}

function ownerAvatarStyle(row: TicketApi.Ticket) {
  let hash = 0;
  for (const char of ticketOwnerLabel(row)) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 360;
  }
  return { background: `hsl(${hash} 58% 48%)` };
}

const [Grid, gridApi] = useVbenVxeGrid({
  gridEvents: { cellClick: onCellClick },
  separator: false,
  formOptions: {
    // Keep the first screen list-oriented, but reveal restored advanced filters.
    collapsed:
      !initialState.status &&
      !initialState.priority &&
      !initialState.category &&
      !initialState.unread &&
      !initialState.overdue &&
      !initialState.assignedTo &&
      !initialState.createdFrom &&
      !initialState.createdTo &&
      !initialState.updatedFrom &&
      !initialState.updatedTo,
    collapsedRows: 1,
    schema: useGridFormSchema(isAdmin.value).map((field) => ({
      ...field,
      defaultValue: initialState[field.fieldName as keyof typeof initialState],
    })),
    submitOnChange: false,
  },
  gridOptions: {
    columns: useColumns<TicketApi.Ticket>(isAdmin.value),
    height: 'auto',
    cellConfig: { height: 68 },
    keepSource: true,
    pagerConfig: {
      currentPage: initialState.page,
      pageSize: initialState.pageSize,
      pageSizes: [10, 20, 50],
    },
    sortConfig: {
      defaultSort: initialSort,
      remote: true,
      trigger: 'cell',
    },
    proxyConfig: {
      ajax: {
        query: async ({ page, sort }, formValues) => {
          const version = ++requestId;
          const { sortBy, sortOrder } = readGridSort(sort, columnSortFields);
          const state = readTicketListState({
            ...formValues,
            page: page.currentPage,
            pageSize: page.pageSize,
            sortBy,
            sortOrder,
          });
          listState.value = state;
          void router.replace({ query: ticketListQuery(state) });
          listLoading.value = true;
          listError.value = '';
          try {
            const result = await listRunner.run(state);
            if (!disposed && version === requestId)
              summary.value = result.summary;
            return { items: result.items ?? [], total: result.total ?? 0 };
          } catch (error) {
            if (!disposed && version === requestId) {
              summary.value = undefined;
              listError.value = $t('ticket.layout.loadError');
            }
            throw error;
          } finally {
            if (!disposed && version === requestId) listLoading.value = false;
          }
        },
      },
      autoLoad: true,
    },
    rowConfig: {
      keyField: 'id',
      isHover: true,
      trigger: 'row',
    },
    toolbarConfig: {
      custom: false,
      export: false,
      refresh: { code: 'query' },
      search: false,
      zoom: false,
    },
  } as VxeTableGridOptions<TicketApi.Ticket>,
});

onMounted(async () => {
  if (!canListUsers.value) return;
  try {
    const result = await getUserList({ page: 1, pageSize: 100, status: 1 });
    assigneeOptions.value = result.items.map((user) => ({
      label: `${user.realName || user.username} · ${user.username} (#${user.id})`,
      value: Number(user.id),
    }));
    gridApi.formApi.updateSchema([
      {
        fieldName: 'assignedTo',
        componentProps: { options: assigneeOptions.value },
      },
    ]);
  } catch {
    // 处理人下拉加载失败不影响列表本身。
  }
});

function detailLocation(id: string) {
  return {
    name: detailRouteName.value,
    params: { id },
    query: ticketListQuery(listState.value),
  };
}

function onCellClick({
  row,
  $event,
}: {
  $event?: MouseEvent;
  row: TicketApi.Ticket;
}) {
  if (
    !row?.id ||
    ($event?.target instanceof Element &&
      $event.target.closest('a,button,input,select,textarea'))
  )
    return;
  void router.push(detailLocation(row.id));
}

async function submitCreate(payload: TicketApi.CreateRequest) {
  if (!canCreate.value || createSaving.value) return;
  createSaving.value = true;
  try {
    const result = await createTicket(payload);
    createOpen.value = false;
    message.success($t('ticket.create.success'));
    await router.push(detailLocation(result.ticket.id));
  } finally {
    createSaving.value = false;
  }
}

function scheduleRealtimeRefresh() {
  if (disposed || !canRead.value) return;
  if (realtimeRefreshTimer) clearTimeout(realtimeRefreshTimer);
  realtimeRefreshTimer = setTimeout(() => {
    realtimeRefreshTimer = undefined;
    void gridApi.query();
  }, 240);
}

onBeforeUnmount(() => {
  disposed = true;
  requestId++;
  listRunner.cancel();
  if (realtimeRefreshTimer) clearTimeout(realtimeRefreshTimer);
});

const pageTitle = computed(() =>
  $t(isAdmin.value ? 'ticket.adminTitle' : 'ticket.title'),
);
const pageSubtitle = computed(() =>
  $t(isAdmin.value ? 'ticket.adminSubtitle' : 'ticket.subtitle'),
);
</script>

<template>
  <Page
    auto-content-height
    class="ticket-list-route"
    content-class="flex min-h-0 flex-col overflow-hidden"
    :description="pageSubtitle"
    :title="pageTitle"
  >
    <template #extra>
      <div class="ticket-list-toolbar">
        <span
          class="ticket-list-toolbar__realtime"
          :class="`is-${realtimeStatus}`"
        >
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

    <section v-if="canRead" class="ticket-list-page">
      <TicketSummary :summary="summary" :loading="listLoading" />
      <div v-if="listError" class="ticket-list-error" role="alert">
        <IconifyIcon icon="lucide:circle-alert" />
        <span>{{ listError }}</span>
        <Button size="small" @click="gridApi.query()">
          {{ $t('ticket.actions.refresh') }}
        </Button>
      </div>
      <Grid class="ticket-list-page__grid">
        <template #toolbar-tools>
          <span class="ticket-list-hint">{{ $t('ticket.layout.openHint') }}</span>
        </template>
        <template #subject="{ row }">
          <div class="ticket-subject">
            <IconifyIcon class="ticket-subject-icon" icon="lucide:ticket" />
            <div class="ticket-subject-body">
              <RouterLink
                :to="detailLocation(row.id)"
                class="ticket-subject-link"
                @click.stop
              >
                {{ row.subject }}
              </RouterLink>
              <div class="ticket-subject-meta">
                <code>{{ row.ticketNo }}</code>
                <span :title="row.lastMessagePreview">
                  {{ row.lastMessagePreview || '—' }}
                </span>
              </div>
            </div>
          </div>
        </template>
        <template #owner="{ row }">
          <div class="ticket-owner-cell">
            <TicketUserCard
              :fallback-name="ticketOwnerLabel(row)"
              :user-id="row.userId"
            >
              <span
                :style="ownerAvatarStyle(row)"
                :title="$t('ticket.userCard.clickHint')"
                class="ticket-owner-avatar"
              >
                {{ ownerInitial(row) }}
              </span>
            </TicketUserCard>
            <Button
              class="ticket-owner"
              size="small"
              type="link"
              @click.stop="openUserInfo(row)"
            >
              <span class="ticket-owner__name">{{ ticketOwnerLabel(row) }}</span>
            </Button>
          </div>
        </template>
        <template #latest="{ row }">
          <div class="ticket-latest">
            <span>{{
              formatTicketTime(row.lastMessageAt || row.updatedAt)
            }}</span>
            <span v-if="row.unreadCount > 0" class="ticket-unread">{{
              $t('ticket.layout.unreadCount', [row.unreadCount])
            }}</span>
            <span v-else class="ticket-message-count">{{
              $t('ticket.layout.messages', [row.messageCount || 0])
            }}</span>
          </div>
        </template>
      </Grid>
    </section>
    <Result v-else status="403" :title="$t('ticket.errors.forbidden')" />

    <UserDetailDrawer />
    <CreateTicketModal
      v-if="canCreate"
      v-model:open="createOpen"
      :saving="createSaving"
      @submit="submitCreate"
    />
  </Page>
</template>

<style scoped>
.ticket-list-page {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
}

.ticket-list-page__grid {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.ticket-list-page__grid :deep(.vxe-body--row) {
  cursor: pointer;
}

.ticket-list-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.ticket-list-toolbar__realtime {
  display: inline-flex;
  gap: 7px;
  align-items: center;
  padding: 5px 11px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 999px;
}

.ticket-list-toolbar__realtime i {
  width: 6px;
  height: 6px;
  background: hsl(var(--muted-foreground));
  border-radius: 50%;
}

.ticket-list-toolbar__realtime.is-connected {
  color: hsl(var(--foreground));
}

.ticket-list-toolbar__realtime.is-connected i {
  background: hsl(var(--success));
  box-shadow: 0 0 0 3px hsl(var(--success) / 14%);
}

.ticket-list-toolbar__realtime.is-reconnecting i {
  background: hsl(var(--warning));
}

.ticket-subject {
  display: flex;
  gap: 12px;
  align-items: center;
  min-width: 0;
  text-align: left;
}

.ticket-subject-icon {
  flex: none;
  width: 30px;
  height: 30px;
  padding: 7px;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
  border-radius: 6px;
}

.ticket-subject-body {
  flex: 1;
  min-width: 0;
}

.ticket-subject-link {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
  font-weight: 500;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.ticket-subject-link:hover {
  color: hsl(var(--primary));
}

.ticket-subject-link:focus-visible {
  outline: 2px solid hsl(var(--primary));
  outline-offset: 2px;
}

.ticket-subject-meta {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-top: 5px;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
}

.ticket-subject-meta code {
  flex: none;
  font-variant-numeric: tabular-nums;
}

.ticket-subject-meta span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ticket-latest {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-start;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--muted-foreground));
}

/* 提交人：头像弹出 QQ 式信息卡，姓名链接继续打开完整用户详情抽屉。 */
.ticket-owner-cell {
  display: flex;
  gap: 7px;
  align-items: center;
  min-width: 0;
}

.ticket-owner-avatar {
  display: grid;
  flex: 0 0 24px;
  place-items: center;
  width: 24px;
  height: 24px;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  cursor: pointer;
  border-radius: 50%;
  transition:
    box-shadow 160ms ease,
    transform 160ms ease;
}

.ticket-owner-avatar:hover {
  box-shadow: 0 0 0 3px hsl(var(--primary) / 20%);
  transform: translateY(-1px);
}

.ticket-owner {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  max-width: 100%;
  height: auto;
  padding: 0;
}

.ticket-owner__icon {
  flex: none;
  font-size: 13px;
  opacity: 0.65;
}

.ticket-owner__name {
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ticket-owner:hover .ticket-owner__name {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.ticket-unread {
  padding: 1px 6px;
  font-size: 11px;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
  border-radius: 4px;
}

.ticket-message-count {
  font-size: 11px;
}

.ticket-list-hint {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.ticket-list-error {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 10px 12px;
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 6%);
  border: 1px solid hsl(var(--destructive) / 25%);
  border-radius: 10px;
}

.ticket-list-error span {
  flex: 1;
}

@media (max-width: 640px) {
  .ticket-list-page {
    gap: 10px;
  }

  .ticket-list-toolbar__realtime {
    font-size: 11px;
  }

  .ticket-list-hint {
    display: none;
  }

  .ticket-subject-icon {
    display: none;
  }

  .ticket-owner__icon {
    display: none;
  }
}

.ticket-list-page__grid :deep(.vxe-toolbar) {
  height: 40px;
  padding: 4px 14px;
}
</style>
