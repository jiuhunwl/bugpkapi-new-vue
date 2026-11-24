<script lang="ts" setup>
import type { NoticeApi } from '#/api/notice';

import { computed, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Empty,
  Input,
  Modal,
  Pagination,
  Spin,
  Tag,
} from 'ant-design-vue';

import { getUserNoticeDetail, getUserNoticeList } from '#/api/notice';
import AdvertisementSlot from '#/components/advertisement/AdvertisementSlot.vue';
import RichTextPreview from '#/components/rich-text-preview/index.vue';
import { $t } from '#/locales';

const loading = ref(false);
const detailLoading = ref(false);
const detailVisible = ref(false);
const notices = ref<NoticeApi.NoticeItem[]>([]);
const currentNotice = ref<NoticeApi.NoticeItem>();
const keyword = ref('');
const pagination = reactive({ current: 1, pageSize: 10, total: 0 });
const previewContent = computed(() => currentNotice.value?.contentHtml ?? '');

let listRequestSequence = 0;
let detailRequestSequence = 0;

async function queryNotices(page = 1) {
  const sequence = ++listRequestSequence;
  loading.value = true;
  try {
    const result = await getUserNoticeList({
      keyword: keyword.value.trim(),
      page,
      pageSize: pagination.pageSize,
    });
    if (sequence !== listRequestSequence) return;
    notices.value = result.items ?? [];
    pagination.current = page;
    pagination.total = Number(result.total ?? 0);
  } finally {
    if (sequence === listRequestSequence) loading.value = false;
  }
}

async function openNotice(row: NoticeApi.NoticeItem) {
  const sequence = ++detailRequestSequence;
  detailVisible.value = true;
  detailLoading.value = true;
  currentNotice.value = row;
  try {
    const result = await getUserNoticeDetail(row.id);
    if (sequence === detailRequestSequence) currentNotice.value = result;
  } finally {
    if (sequence === detailRequestSequence) detailLoading.value = false;
  }
}

function resetSearch() {
  keyword.value = '';
  void queryNotices(1);
}

function onPageChange(page: number, pageSize: number) {
  pagination.pageSize = pageSize;
  void queryNotices(page);
}

onMounted(() => void queryNotices());
</script>

<template>
  <Page auto-content-height class="notice-page">
    <div class="notice-shell">
      <header class="notice-hero">
        <div class="notice-hero__icon">
          <IconifyIcon icon="lucide:megaphone" />
        </div>
        <div>
          <span>{{ $t('noticeUser.eyebrow') }}</span>
          <h1>{{ $t('noticeUser.title') }}</h1>
          <p>{{ $t('noticeUser.description') }}</p>
        </div>
        <strong>{{ $t('noticeUser.total', [pagination.total]) }}</strong>
      </header>

      <section class="notice-toolbar">
        <Input
          v-model:value="keyword"
          allow-clear
          :placeholder="$t('noticeUser.searchPlaceholder')"
          @press-enter="queryNotices(1)"
        >
          <template #prefix>
            <IconifyIcon icon="lucide:search" />
          </template>
        </Input>
        <Button type="primary" @click="queryNotices(1)">
          {{ $t('noticeUser.search') }}
        </Button>
        <Button @click="resetSearch">{{ $t('noticeUser.reset') }}</Button>
      </section>

      <AdvertisementSlot :limit="2" placement="NOTICE" variant="inline" />

      <section class="notice-list-panel">
        <Spin :spinning="loading">
          <div v-if="notices.length" class="notice-list">
            <button
              v-for="item in notices"
              :key="item.id"
              class="notice-item"
              type="button"
              @click="openNotice(item)"
            >
              <span class="notice-item__marker">
                <IconifyIcon icon="lucide:file-text" />
              </span>
              <span class="notice-item__main">
                <span class="notice-item__title-row">
                  <strong>{{ item.title }}</strong>
                  <Tag v-if="item.isTop === 1" color="blue">
                    {{ $t('noticeUser.top') }}
                  </Tag>
                  <Tag v-if="item.isPopup === 1" color="warning">
                    {{ $t('noticeUser.popup') }}
                  </Tag>
                </span>
                <small>{{
                  item.summary || $t('noticeUser.noSummary')
                }}</small>
              </span>
              <time>{{ item.publishTime }}</time>
              <IconifyIcon class="notice-item__arrow" icon="lucide:chevron-right" />
            </button>
          </div>
          <Empty v-else :description="$t('noticeUser.empty')" />
        </Spin>

        <Pagination
          v-if="pagination.total > pagination.pageSize"
          v-model:current="pagination.current"
          :page-size="pagination.pageSize"
          :total="pagination.total"
          class="notice-pagination"
          simple
          @change="onPageChange"
        />
      </section>

      <Modal
        v-model:open="detailVisible"
        centered
        :destroy-on-close="true"
        :footer="null"
        :width="860"
        @after-close="currentNotice = undefined"
      >
        <Spin :spinning="detailLoading">
          <article v-if="currentNotice" class="notice-detail">
            <header>
              <div>
                <h1>{{ currentNotice.title }}</h1>
                <p>{{ currentNotice.publishTime }}</p>
              </div>
              <div>
                <Tag v-if="currentNotice.isTop === 1" color="blue">
                  {{ $t('noticeUser.top') }}
                </Tag>
                <Tag v-if="currentNotice.isPopup === 1" color="warning">
                  {{ $t('noticeUser.popup') }}
                </Tag>
              </div>
            </header>
            <div class="notice-detail__body">
              <RichTextPreview :content="previewContent" />
            </div>
          </article>
        </Spin>
      </Modal>
    </div>
  </Page>
</template>

<style scoped>
.notice-shell {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 100%;
}

.notice-hero,
.notice-toolbar,
.notice-list-panel {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.notice-hero {
  display: flex;
  gap: 16px;
  align-items: center;
  min-height: 116px;
  padding: 20px 22px;
}

.notice-hero__icon,
.notice-item__marker {
  display: grid;
  flex: 0 0 auto;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 9%);
  border: 1px solid hsl(var(--primary) / 16%);
  place-items: center;
}

.notice-hero__icon {
  width: 48px;
  height: 48px;
  font-size: 23px;
  border-radius: 10px;
}

.notice-hero > div:nth-child(2) {
  flex: 1;
  min-width: 0;
}

.notice-hero span {
  font-size: 11px;
  font-weight: 800;
  color: hsl(var(--primary));
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.notice-hero h1 {
  margin: 4px 0 0;
  font-size: 22px;
  line-height: 30px;
  color: hsl(var(--foreground));
}

.notice-hero p {
  margin: 5px 0 0;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.notice-hero > strong {
  flex: 0 0 auto;
  font-size: 13px;
  font-weight: 650;
  color: hsl(var(--muted-foreground));
}

.notice-toolbar {
  display: grid;
  grid-template-columns: minmax(240px, 1fr) auto auto;
  gap: 8px;
  padding: 14px;
}

.notice-list-panel {
  min-height: 360px;
  padding: 8px;
}

.notice-list {
  display: flex;
  flex-direction: column;
}

.notice-item {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) 170px 18px;
  gap: 12px;
  align-items: center;
  min-height: 76px;
  padding: 12px 14px;
  color: inherit;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-bottom: 1px solid hsl(var(--border));
  transition: background 160ms ease;
}

.notice-item:last-child {
  border-bottom: 0;
}

.notice-item:hover {
  background: hsl(var(--muted) / 38%);
}

.notice-item__marker {
  width: 38px;
  height: 38px;
  border-radius: 8px;
}

.notice-item__main {
  min-width: 0;
}

.notice-item__title-row {
  display: flex;
  gap: 6px;
  align-items: center;
  min-width: 0;
}

.notice-item__title-row strong {
  overflow: hidden;
  font-size: 14px;
  color: hsl(var(--foreground));
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notice-item__title-row :deep(.ant-tag) {
  flex: 0 0 auto;
  margin-inline-end: 0;
}

.notice-item__main small {
  display: block;
  margin-top: 5px;
  overflow: hidden;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notice-item time {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  text-align: right;
}

.notice-item__arrow {
  color: hsl(var(--muted-foreground));
}

.notice-pagination {
  display: flex;
  justify-content: flex-end;
  padding: 14px 8px 8px;
}

.notice-detail header {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
  padding-bottom: 16px;
  border-bottom: 1px solid hsl(var(--border));
}

.notice-detail h1 {
  margin: 0;
  font-size: 24px;
  line-height: 1.35;
  color: hsl(var(--foreground));
}

.notice-detail p {
  margin: 7px 0 0;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.notice-detail__body {
  max-height: 62vh;
  padding-top: 18px;
  overflow: auto;
}

@media (max-width: 720px) {
  .notice-hero {
    align-items: flex-start;
    padding: 16px;
  }

  .notice-hero > strong {
    display: none;
  }

  .notice-toolbar {
    grid-template-columns: 1fr 1fr;
  }

  .notice-toolbar :deep(.ant-input-affix-wrapper) {
    grid-column: 1 / -1;
  }

  .notice-item {
    grid-template-columns: 38px minmax(0, 1fr) 18px;
  }

  .notice-item time {
    display: none;
  }
}
</style>
