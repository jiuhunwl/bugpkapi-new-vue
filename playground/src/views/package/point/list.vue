<script lang="ts" setup>
import type { PackageActionPermissions } from '../permissions';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { PackageApi } from '#/api/package';

import { computed } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { useAccessStore, useUserStore } from '@vben/stores';

import { Button } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deletePointPackage, getPointPackageList } from '#/api/package';
import { $t } from '#/locales';

import { deletePackageWithForce } from '../force-delete';
import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const accessStore = useAccessStore();
const userStore = useUserStore();
const isAdmin = computed(() => userStore.userRoles.includes('admin'));
const hasCode = (code: string) => isAdmin.value || accessStore.accessCodes.includes(code);
const canCreate = computed(() => hasCode('package:point:create'));
const actionPermissions = computed<PackageActionPermissions>(() => ({
  delete: hasCode('package:point:delete'),
  grant: false,
  update: hasCode('package:point:update'),
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
        query: async ({ page }, formValues) => {
          return await getPointPackageList({
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
  } as VxeTableGridOptions<PackageApi.PointPackage>,
});

function onActionClick({
  code,
  row,
}: OnActionClickParams<PackageApi.PointPackage>) {
  switch (code) {
    case 'delete': {
      onDelete(row);
      break;
    }
    case 'edit': {
      onEdit(row);
      break;
    }
  }
}

function onCreate() {
  if (!canCreate.value) return;
  formDrawerApi.setData({}).open();
}

function onEdit(row: PackageApi.PointPackage) {
  if (!actionPermissions.value.update) return;
  formDrawerApi.setData(row).open();
}

function onDelete(row: PackageApi.PointPackage) {
  if (!actionPermissions.value.delete) return;
  deletePackageWithForce({
    name: row.name,
    refresh: onRefresh,
    remove: (force) => deletePointPackage(row.id, force),
  });
}

function onRefresh() {
  gridApi.query();
}
</script>

<template>
  <Page auto-content-height>
    <FormDrawer @success="onRefresh" />
    <Grid :table-title="$t('system.package.pointTitle')">
      <template #toolbar-tools>
        <Button v-if="canCreate" type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('system.package.pointTitle')]) }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
