<script lang="ts" setup>
import type { InboxApi } from '#/api/inbox';

import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { IconifyIcon } from '@vben/icons';

import {
  VbenButton,
  VbenIconButton,
  VbenPopover,
  VbenScrollbar,
} from '@vben-core/shadcn-ui';

import { message } from 'ant-design-vue';

import {
  getMyInboxMessages,
  getMyInboxUnreadCount,
  markInboxMessagesRead,
} from '#/api/inbox';
import { $t } from '#/locales';

/** 顶栏未读数轮询间隔；页面不可见时跳过本轮，回到前台立即补一次。 */
const POLL_INTERVAL_MS = 60_000;
const PREVIEW_SIZE = 5;
const UNREAD_CAP = 99;

const router = useRouter();
const open = ref(false);
const loading = ref(false);
const unread = ref(0);
const items = ref<InboxApi.InboxItem[]>([]);
// 消息中心页面由后端菜单下发；菜单未注册（或角色无权限）时铃铛无处可跳，直接不渲染。
const visible = ref(false);

async function refreshUnread() {
  try {
    const result = await getMyInboxUnreadCount();
    unread.value = result?.unread ?? 0;
  } catch {
    // 后台轮询失败保留上一次计数，不打扰用户
  }
}

async function loadPreview() {
  loading.value = true;
  try {
    const page = await getMyInboxMessages({ page: 1, pageSize: PREVIEW_SIZE });
    items.value = page.items;
    unread.value = page.unread;
  } finally {
    loading.value = false;
  }
}

async function handleMarkRead(item: InboxApi.InboxItem) {
  if (item.isRead) return;
  await markInboxMessagesRead([item.id]);
  item.isRead = true;
  unread.value = Math.max(0, unread.value - 1);
}

async function handleMarkAllRead() {
  if (unread.value === 0) return;
  await markInboxMessagesRead([]);
  message.success($t('inbox.markAllDone'));
  await loadPreview();
}

function handleViewItem(item: InboxApi.InboxItem) {
  void handleMarkRead(item);
  open.value = false;
  router.push({ name: 'UserInbox' });
}

function handleViewAll() {
  open.value = false;
  router.push({ name: 'UserInbox' });
}

let timer: ReturnType<typeof setInterval> | undefined;

function stopPolling() {
  if (timer) {
    clearInterval(timer);
    timer = undefined;
  }
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    void refreshUnread();
  }
}

watch(open, (value) => {
  if (value) {
    void loadPreview();
  }
});

onMounted(() => {
  visible.value = router.hasRoute('UserInbox');
  if (!visible.value) return;
  void refreshUnread();
  timer = setInterval(() => {
    if (document.visibilityState === 'visible') {
      void refreshUnread();
    }
  }, POLL_INTERVAL_MS);
  document.addEventListener('visibilitychange', handleVisibilityChange);
});

onBeforeUnmount(() => {
  stopPolling();
  document.removeEventListener('visibilitychange', handleVisibilityChange);
});
</script>

<template>
  <VbenPopover
    v-if="visible"
    v-model:open="open"
    :content-props="{ align: 'end', side: 'bottom', sideOffset: 8 }"
    content-class="message-bell__panel w-90 max-w-[calc(100vw-1rem)] p-0"
  >
    <template #trigger>
      <div class="mr-1 flex-center h-full">
        <VbenIconButton
          class="message-bell relative rounded-md"
          :tooltip="$t('inbox.userTitle')"
        >
          <IconifyIcon class="size-4" icon="lucide:bell" />
          <span v-if="unread > 0" class="message-bell__badge">
            {{ unread > UNREAD_CAP ? `${UNREAD_CAP}+` : unread }}
          </span>
        </VbenIconButton>
      </div>
    </template>

    <div class="message-bell__header">
      <span class="text-sm font-semibold text-foreground">
        {{ $t('inbox.userTitle') }}
      </span>
      <VbenIconButton
        v-if="unread > 0"
        size="xs"
        variant="ghost"
        :tooltip="$t('inbox.markAllRead')"
        @click="handleMarkAllRead"
      >
        <IconifyIcon class="size-4" icon="lucide:check-check" />
      </VbenIconButton>
    </div>

    <div v-if="loading && items.length === 0" class="message-bell__state">
      <IconifyIcon class="size-4 animate-spin" icon="lucide:loader-circle" />
    </div>

    <VbenScrollbar v-else-if="items.length > 0">
      <ul class="message-bell__list">
        <li
          v-for="item in items"
          :key="item.id"
          class="message-bell__item"
          :class="{ 'message-bell__item--unread': !item.isRead }"
          @click="handleViewItem(item)"
        >
          <span
            class="message-bell__dot"
            :class="{ 'message-bell__dot--muted': item.isRead }"
            aria-hidden="true"
          ></span>
          <div class="message-bell__content">
            <p class="message-bell__title">{{ item.title }}</p>
            <p class="message-bell__body">{{ item.body }}</p>
            <p class="message-bell__time">{{ item.createdAt }}</p>
          </div>
          <VbenIconButton
            v-if="!item.isRead"
            size="xs"
            variant="ghost"
            :tooltip="$t('inbox.markRead')"
            @click.stop="handleMarkRead(item)"
          >
            <IconifyIcon class="size-4" icon="lucide:check" />
          </VbenIconButton>
        </li>
      </ul>
    </VbenScrollbar>

    <div v-else class="message-bell__state text-muted-foreground">
      {{ $t('inbox.empty') }}
    </div>

    <div class="message-bell__footer">
      <span v-if="unread > 0" class="text-xs text-muted-foreground">
        {{ $t('inbox.unreadSummary', [unread]) }}
      </span>
      <span v-else></span>
      <VbenButton size="sm" @click="handleViewAll">
        {{ $t('inbox.viewAll') }}
      </VbenButton>
    </div>
  </VbenPopover>
</template>

<style scoped>
.message-bell__badge {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  font-size: 10px;
  line-height: 16px;
  font-weight: 600;
  text-align: center;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  pointer-events: none;
}

.message-bell__header,
.message-bell__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid hsl(var(--border));
}

.message-bell__footer {
  border-bottom: none;
  border-top: 1px solid hsl(var(--border));
}

.message-bell__state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  gap: 8px;
  font-size: 13px;
}

.message-bell__list {
  display: flex;
  flex-direction: column;
  max-height: 360px;
}

.message-bell__item {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 16px;
  cursor: pointer;
  border-top: 1px solid hsl(var(--border));
}

.message-bell__item:hover {
  background: hsl(var(--accent));
}

.message-bell__dot {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  margin-top: 7px;
  border-radius: 50%;
  background: hsl(var(--primary));
}

/* 已读行保留圆点占位，避免标题左右错位 */
.message-bell__dot--muted {
  background: transparent;
}

.message-bell__content {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.message-bell__title {
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
  color: hsl(var(--foreground));
  text-overflow: ellipsis;
  white-space: nowrap;
}

.message-bell__item--unread .message-bell__title {
  padding-right: 20px;
}

.message-bell__body {
  display: -webkit-box;
  overflow: hidden;
  font-size: 12px;
  line-height: 18px;
  color: hsl(var(--muted-foreground));
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
  white-space: pre-wrap;
}

.message-bell__time {
  font-size: 11px;
  color: hsl(var(--muted-foreground));
}

@media (max-width: 640px) {
  .message-bell__header,
  .message-bell__footer {
    padding: 10px 12px;
  }

  .message-bell__item {
    padding: 10px 12px;
  }
}
</style>
