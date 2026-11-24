<script lang="ts" setup>
import type { NoticeApi } from '#/api/notice';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { Empty, Spin, Tag } from 'ant-design-vue';

import { getAdminNoticeDetail } from '#/api/notice';
import RichTextPreview from '#/components/rich-text-preview/index.vue';
import { $t } from '#/locales';

const loading = ref(false);
const notice = ref<NoticeApi.NoticeItem>();
const [Drawer, drawerApi] = useVbenDrawer({ async onOpenChange(open) { if (!open) return; notice.value = undefined; const data = drawerApi.getData<NoticeApi.NoticeItem>(); if (!data?.id) return; loading.value = true; try { notice.value = await getAdminNoticeDetail(data.id); } finally { loading.value = false; } } });
const previewContent = computed(() => notice.value?.contentHtml ?? '');
</script>
<template><Drawer :title="$t('noticeAdmin.preview.title')"><Spin :spinning="loading"><article v-if="notice" class="text-foreground"><header class="flex items-start justify-between gap-4 border-b border-border pb-4"><div><h2 class="text-xl font-bold">{{ notice.title }}</h2><p class="mt-2 text-sm text-muted-foreground">{{ notice.publishTime }}</p></div><div class="flex gap-2"><Tag v-if="notice.isTop === 1" color="blue">{{ $t('noticeAdmin.top') }}</Tag><Tag :color="notice.status === 1 ? 'success' : 'default'">{{ notice.status === 1 ? $t('noticeAdmin.published') : $t('noticeAdmin.hidden') }}</Tag></div></header><div class="min-h-80 pt-5"><RichTextPreview :content="previewContent" /></div></article><Empty v-else :description="$t('noticeAdmin.preview.empty')" /></Spin></Drawer></template>
