<script lang="ts" setup>
import type { RedeemTypeActionPermissions } from './data';

import type { OnActionClickParams, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { RedeemApi } from '#/api/redeem';

import { computed } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { useAccessStore, useUserStore } from '@vben/stores';

import { Button, message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getTypeList, updateTypeStatus } from '#/api/redeem';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';
import Generate from './modules/generate.vue';

const accessStore = useAccessStore();
const userStore = useUserStore();
const isAdmin = computed(() => userStore.userRoles.includes('admin'));
const hasCode = (code: string) =>
  isAdmin.value || accessStore.accessCodes.includes(code);
const canCreate = computed(() => hasCode('redeem:type:create'));
const actionPermissions = computed<RedeemTypeActionPermissions>(() => ({
  create: hasCode('redeem:type:create'),
  generate: hasCode('redeem:code:generate'),
  update: hasCode('redeem:type:update'),
}));

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [GenerateDrawer, generateDrawerApi] = useVbenDrawer({
  connectedComponent: Generate,
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
        query: async ({ page }, formValues) => {
          return await getTypeList({
            page: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          });
        },
      },
    },
    rowConfig: {
      keyField: 'id',
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<RedeemApi.CodeType>,
});

function onActionClick({
  code,
  row,
}: OnActionClickParams<RedeemApi.CodeType>) {
  switch (code) {
    case 'edit': {
      if (actionPermissions.value.update) onEdit(row);
      break;
    }
    case 'generate': {
      if (actionPermissions.value.generate) onGenerate(row);
      break;
    }
    case 'toggleStatus': {
      if (actionPermissions.value.update) onToggleStatus(row);
      break;
    }
  }
}

function onCreate() {
  if (!canCreate.value) return;
  formDrawerApi.setData({}).open();
}

function onEdit(row: RedeemApi.CodeType) {
  if (!actionPermissions.value.update) return;
  formDrawerApi.setData(row).open();
}

function onGenerate(row: RedeemApi.CodeType) {
  if (!actionPermissions.value.generate) return;
  generateDrawerApi.setData(row).open();
}

function onToggleStatus(row: RedeemApi.CodeType) {
  if (!actionPermissions.value.update) return;
  const nextStatus: 0 | 1 = row.status === 1 ? 0 : 1;
  const titleKey =
    nextStatus === 1
      ? 'system.redeem.type.statusEnableConfirmTitle'
      : 'system.redeem.type.statusDisableConfirmTitle';
  const contentKey =
    nextStatus === 1
      ? 'system.redeem.type.statusEnableConfirmContent'
      : 'system.redeem.type.statusDisableConfirmContent';
  Modal.confirm({
    content: $t(contentKey, [row.name]),
    onOk: async () => {
      await updateTypeStatus(row.id, nextStatus);
      message.success($t('system.redeem.type.statusUpdateSuccess'));
      onRefresh();
    },
    title: $t(titleKey),
  });
}

function onRefresh() {
  gridApi.query();
}
</script>

<template>
  <Page auto-content-height>
    <FormDrawer @success="onRefresh" />
    <GenerateDrawer @success="onRefresh" />
    <Grid :table-title="$t('system.redeem.type.title')">
      <template #toolbar-tools>
        <Button v-if="canCreate" type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('system.redeem.type.title')]) }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
