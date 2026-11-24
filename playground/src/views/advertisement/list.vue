<script setup lang="ts">
import type { AdvertisementActionPermissions } from './data';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { AdvertisementApi } from '#/api/advertisement';

import { computed, ref } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { useAccessStore, useUserStore } from '@vben/stores';

import { Button, message, Modal, Tag } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteAdvertisement,
  getAdminAdvertisementList,
} from '#/api/advertisement';
import { $t } from '#/locales';

import {
  placementText,
  useColumns,
  useGridFormSchema,
} from './data';
import Form from './modules/form.vue';

const accessStore = useAccessStore();
const userStore = useUserStore();
const deletingIds = ref(new Set<string>());
const isAdmin = computed(() => userStore.userRoles.includes('admin'));
const hasCode = (code: string) =>
  isAdmin.value || accessStore.accessCodes.includes(code);
const canCreate = computed(() => hasCode('advertisement:create'));
const actionPermissions = computed<AdvertisementActionPermissions>(() => ({
  delete: hasCode('advertisement:delete'),
  update: hasCode('advertisement:update'),
}));

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(onActionClick, actionPermissions.value),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: ({ page }, formValues) =>
          getAdminAdvertisementList({
            page: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          }),
      },
    },
    rowConfig: { keyField: 'id' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<AdvertisementApi.Advertisement>,
});

function onActionClick({
  code,
  row,
}: OnActionClickParams<AdvertisementApi.Advertisement>) {
  if (code === 'edit' && actionPermissions.value.update) {
    formDrawerApi.setData(row).open();
  }
  if (code === 'delete' && actionPermissions.value.delete) {
    confirmDelete(row);
  }
}

function openCreate() {
  if (canCreate.value) formDrawerApi.setData({}).open();
}

function confirmDelete(row: AdvertisementApi.Advertisement) {
  Modal.confirm({
    content: $t('advertisementAdmin.delete.description', [row.name]),
    okText: $t('advertisementAdmin.delete.action'),
    okType: 'danger',
    title: $t('advertisementAdmin.delete.title'),
    onOk: async () => {
      if (deletingIds.value.has(row.id)) return;
      deletingIds.value.add(row.id);
      try {
        await deleteAdvertisement(row.id);
        message.success(
          $t('advertisementAdmin.messages.deleted', [row.name]),
        );
        await gridApi.query();
      } finally {
        deletingIds.value.delete(row.id);
      }
    },
  });
}

function placementColor(placement: AdvertisementApi.Placement) {
  if (placement === 'HOME') return 'blue';
  if (placement === 'CONSOLE') return 'cyan';
  if (placement === 'NOTICE') return 'purple';
  if (placement === 'SERVICE_PROVIDER') return 'green';
  return 'gold';
}
</script>

<template>
  <Page auto-content-height>
    <FormDrawer @success="gridApi.query()" />
    <Grid :table-title="$t('advertisementAdmin.title')">
      <template #toolbar-tools>
        <Button v-if="canCreate" type="primary" @click="openCreate">
          <Plus class="size-5" />
          {{ $t('advertisementAdmin.create') }}
        </Button>
      </template>
      <template #image="{ row }">
        <img
          v-if="row.imageUrl"
          :alt="row.title"
          class="h-11 w-16 rounded-md border border-border object-cover"
          loading="lazy"
          :src="row.imageUrl"
        />
        <span
          v-else
          class="grid h-11 w-16 place-items-center rounded-md border border-dashed border-border bg-muted text-xs text-muted-foreground"
        >
          AD
        </span>
      </template>
      <template #placement="{ row }">
        <Tag :color="placementColor(row.placement)">
          {{ placementText(row.placement) }}
        </Tag>
      </template>
      <template #status="{ row }">
        <Tag :color="row.status === 1 ? 'success' : 'default'">
          {{
            row.status === 1
              ? $t('advertisementAdmin.status.enabled')
              : $t('advertisementAdmin.status.disabled')
          }}
        </Tag>
      </template>
    </Grid>
  </Page>
</template>
