<script lang="ts" setup>
import type { InboxApi } from '#/api/inbox';

import { onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Badge,
  Button,
  Card,
  List,
  ListItem,
  ListItemMeta,
  message,
  Pagination,
  TabPane,
  Tabs,
  Tag,
} from 'ant-design-vue';

import {
  getMyInboxMessages,
  markInboxMessagesRead,
} from '#/api/inbox';
import { $t } from '#/locales';

const state = reactive({
  loading: false,
  page: 1,
  pageSize: 20,
  total: 0,
  unread: 0,
});
const items = ref<InboxApi.InboxItem[]>([]);
const activeTab = ref<'all' | 'unread'>('all');

async function load() {
  state.loading = true;
  try {
    const result = await getMyInboxMessages({
      page: state.page,
      pageSize: state.pageSize,
      unread: activeTab.value === 'unread',
    });
    items.value = result.items;
    state.total = result.total;
    state.unread = result.unread;
  } finally {
    state.loading = false;
  }
}

function switchTab() {
  state.page = 1;
  load();
}

function changePage(page: number, pageSize: number) {
  state.page = page;
  state.pageSize = pageSize;
  load();
}

async function markRead(item: InboxApi.InboxItem) {
  if (item.isRead) return;
  await markInboxMessagesRead([item.id]);
  item.isRead = true;
  state.unread = Math.max(0, state.unread - 1);
  load();
}

async function markAllRead() {
  if (state.unread === 0) return;
  await markInboxMessagesRead([]);
  message.success($t('inbox.markAllDone'));
  load();
}

onMounted(load);
</script>

<template>
  <Page>
    <Card :title="$t('inbox.userTitle')">
      <template #extra>
        <Badge :count="state.unread" :offset="[0, -2]" />
        <Button
          size="small"
          :disabled="state.unread === 0"
          @click="markAllRead"
        >
          {{ $t('inbox.markAllRead') }}
        </Button>
      </template>

      <Tabs v-model:active-key="activeTab" @tab-click="switchTab">
        <TabPane key="all" :tab="$t('inbox.tabAll')" />
        <TabPane key="unread">
          <template #tab>
            <Badge :count="state.unread" :number-style="{ boxShadow: 'none' }">
              {{ $t('inbox.tabUnread') }}
            </Badge>
          </template>
        </TabPane>
      </Tabs>

      <List :loading="state.loading" :data-source="items">
        <template #renderItem="{ item }">
          <ListItem :class="{ 'inbox-item--unread': !item.isRead }">
            <ListItemMeta>
              <template #title>
                <span class="inbox-item__title">
                  <Tag v-if="!item.isRead" color="processing">
                    {{ $t('inbox.unreadTag') }}
                  </Tag>
                  {{ item.title }}
                </span>
              </template>
              <template #description>
                <div class="inbox-item__body">{{ item.body }}</div>
                <div class="inbox-item__time">{{ item.createdAt }}</div>
              </template>
            </ListItemMeta>
            <template #actions>
              <Button
                v-if="!item.isRead"
                size="small"
                type="link"
                @click="markRead(item)"
              >
                {{ $t('inbox.markRead') }}
              </Button>
            </template>
          </ListItem>
        </template>
      </List>

      <div class="inbox-page__footer">
        <Pagination
          :current="state.page"
          :page-size="state.pageSize"
          :total="state.total"
          :show-size-changer="false"
          @change="changePage"
        />
      </div>
    </Card>
  </Page>
</template>

<style scoped>
.inbox-item--unread {
  background: hsl(var(--primary) / 4%);
}

.inbox-item__title {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  font-weight: 500;
}

.inbox-item__body {
  white-space: pre-wrap;
  word-break: break-word;
}

.inbox-item__time {
  margin-top: 4px;
  font-size: 12px;
  color: rgb(100 116 139);
}

.inbox-page__footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>
