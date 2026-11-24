<script lang="ts" setup>
import type { PackageActionPermissions } from '../permissions';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { PackageApi } from '#/api/package';

import { computed } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { useAccessStore, useUserStore } from '@vben/stores';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteUserEntitlement, getUserEntitlementList } from '#/api/package';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import GrantDrawer from './grant.vue';
import UserEditDrawer from './edit.vue';

const accessStore = useAccessStore();
const userStore = useUserStore();
const isAdmin = computed(() => userStore.userRoles.includes('admin'));
const hasCode = (code: string) =>
  isAdmin.value || accessStore.accessCodes.includes(code);
const actionPermissions = computed<PackageActionPermissions>(() => ({
  delete: hasCode('package:user:delete'),
  grant: hasCode('package:user:grant'),
  update: hasCode('package:user:update'),
}));

const [EditDrawer, editDrawerApi] = useVbenDrawer({
  connectedComponent: UserEditDrawer,
  destroyOnClose: true,
});

const [GrantUserDrawer, grantDrawerApi] = useVbenDrawer({
  connectedComponent: GrantDrawer,
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
          return await getUserEntitlementList({
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
  } as VxeTableGridOptions<PackageApi.UserEntitlement>,
});

function onActionClick({
  code,
  row,
}: OnActionClickParams<PackageApi.UserEntitlement>) {
  switch (code) {
    case 'delete': {
      onDelete(row);
      break;
    }
    case 'edit': {
      if (!actionPermissions.value.update) return;
      editDrawerApi.setData(row).open();
      break;
    }
  }
}

function onDelete(row: PackageApi.UserEntitlement) {
  if (!actionPermissions.value.delete) return;
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.packageName]),
    duration: 0,
    key: 'action_process_msg',
  });
  deleteUserEntitlement(row.id, row.scope)
    .then(() => {
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.packageName]),
        key: 'action_process_msg',
      });
      onRefresh();
    })
    .catch(() => {
      hideLoading();
    });
}

function onRefresh() {
  gridApi.query();
}
</script>

<template>
  <Page auto-content-height>
    <EditDrawer @success="onRefresh" />
    <GrantUserDrawer @success="onRefresh" />
    <Grid :table-title="$t('system.package.userTitle')">
      <template #toolbar-tools>
        <Button
          v-if="actionPermissions.grant"
          type="primary"
          @click="grantDrawerApi.open()"
        >
          {{ $t('system.package.grantAction') }}
        </Button>
      </template>
      <template #packageName="{ row }">
        <div class="min-w-0">
          <div class="truncate">{{ row.packageName }}</div>
          <div
            v-if="row.scope === 'INTERFACE'"
            class="text-muted-foreground truncate text-xs"
          >
            {{
              [row.specName, row.interfaceName].filter(Boolean).join(' · ') ||
              '—'
            }}
          </div>
        </div>
      </template>
    </Grid>
  </Page>
</template>
