<script lang="ts" setup>
import type { NoticeActionPermissions } from '../data';

import type { OnActionClickParams, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { NoticeApi } from '#/api/notice';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { useAccessStore, useUserStore } from '@vben/stores';

import { Button, message, Modal, Tag } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteNotice, getAdminNoticeList, updateNoticePopup, updateNoticeStatus, updateNoticeTop } from '#/api/notice';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from '../data';
import Form from './form.vue';
import Preview from './preview.vue';

const actingIds = ref(new Set<string>());
const accessStore = useAccessStore();
const userStore = useUserStore();
const isAdmin = computed(() => userStore.userRoles.includes('admin'));
const hasCode = (code: string) => isAdmin.value || accessStore.accessCodes.includes(code);
const canCreate = computed(() => hasCode('notice:create'));
const actionPermissions = computed<NoticeActionPermissions>(() => ({
  delete: hasCode('notice:delete'),
  popup: hasCode('notice:popup'),
  status: hasCode('notice:status'),
  top: hasCode('notice:top'),
  update: hasCode('notice:update'),
}));
const [FormDrawer, formDrawerApi] = useVbenDrawer({ connectedComponent: Form, destroyOnClose: true });
const [PreviewDrawer, previewDrawerApi] = useVbenDrawer({ connectedComponent: Preview, destroyOnClose: true });
const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: { schema: useGridFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(onActionClick, actionPermissions.value), height: 'auto', keepSource: true,
    proxyConfig: { ajax: { query: ({ page }, formValues) => getAdminNoticeList({ page: page.currentPage, pageSize: page.pageSize, ...formValues }) } },
    rowConfig: { keyField: 'id' },
    toolbarConfig: { custom: true, export: false, refresh: true, search: true, zoom: true },
  } as VxeTableGridOptions<NoticeApi.NoticeItem>,
});

function onActionClick({ code, row }: OnActionClickParams<NoticeApi.NoticeItem>) {
  if (code === 'delete' && actionPermissions.value.delete) confirmDelete(row);
  if (code === 'edit' && actionPermissions.value.update) openEditor(row);
  if (code === 'preview') openPreview(row);
  if (code === 'popup' && actionPermissions.value.popup) void toggle(row, 'popup');
  if (code === 'status' && actionPermissions.value.status) void toggle(row, 'status');
  if (code === 'top' && actionPermissions.value.top) void toggle(row, 'top');
}

function openCreate() { if (canCreate.value) openEditor({}); }

function openEditor(data: Partial<NoticeApi.NoticeItem>) {
  formDrawerApi.setState({ class: 'w-[92vw] max-w-[1080px]' });
  formDrawerApi.setData(data).open();
}

function openPreview(row: NoticeApi.NoticeItem) {
  previewDrawerApi.setState({ class: 'w-[90vw] max-w-[960px]' });
  previewDrawerApi.setData(row).open();
}

async function withAction(row: NoticeApi.NoticeItem, action: () => Promise<unknown>) {
  if (actingIds.value.has(row.id)) return false;
  actingIds.value.add(row.id);
  try { await action(); await gridApi.query(); return true; }
  finally { actingIds.value.delete(row.id); }
}

async function toggle(row: NoticeApi.NoticeItem, type: 'popup' | 'status' | 'top') {
  const next = type === 'status' ? (row.status === 1 ? 0 : 1) : type === 'top' ? (row.isTop === 1 ? 0 : 1) : (row.isPopup === 1 ? 0 : 1);
  const done = await withAction(row, () => type === 'status' ? updateNoticeStatus(row.id, next) : type === 'top' ? updateNoticeTop(row.id, next) : updateNoticePopup(row.id, next));
  if (done) message.success($t(`noticeAdmin.messages.${type}${next ? 'On' : 'Off'}`));
}

function confirmDelete(row: NoticeApi.NoticeItem) {
  if (!actionPermissions.value.delete) return;
  Modal.confirm({
    title: $t('noticeAdmin.delete.title'), content: $t('noticeAdmin.delete.description', [row.title]),
    okText: $t('noticeAdmin.delete.action'), okType: 'danger',
    onOk: async () => {
      const done = await withAction(row, () => deleteNotice(row.id));
      if (done) message.success($t('noticeAdmin.messages.deleted', [row.title]));
    },
  });
}

defineExpose({ reload: () => gridApi.query() });
</script>

<template>
  <FormDrawer @success="gridApi.query()" />
  <PreviewDrawer />
  <Grid :table-title="$t('noticeAdmin.title')">
    <template #toolbar-tools><Button v-if="canCreate" type="primary" @click="openCreate"><Plus class="size-5" />{{ $t('noticeAdmin.create') }}</Button></template>
    <!-- 投放位：置顶 / 每日弹窗 / 首页滚动位 合并为一组标签，一列看清全部投放状态 -->
    <template #placement="{ row }">
      <div class="flex flex-wrap items-center gap-1">
        <Tag v-if="row.isTop === 1" color="processing">{{ $t('noticeAdmin.top') }}</Tag>
        <Tag v-if="row.isPopup === 1" color="warning">{{ $t('noticeAdmin.popup') }}</Tag>
        <Tag v-if="row.isHomeTicker === 1" color="success">{{ $t('noticeAdmin.homeTicker') }}</Tag>
        <span v-if="row.isTop !== 1 && row.isPopup !== 1 && row.isHomeTicker !== 1" class="text-xs text-muted-foreground">—</span>
      </div>
    </template>
    <template #status="{ row }"><Tag :color="row.status === 1 ? 'success' : 'default'">{{ row.status === 1 ? $t('noticeAdmin.published') : $t('noticeAdmin.hidden') }}</Tag></template>
  </Grid>
</template>
