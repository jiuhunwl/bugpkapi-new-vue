<script lang="ts" setup>
import type { RoleActionPermissions } from './data';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { SystemRoleApi } from '#/api';

import { computed } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { useAccessStore, useUserStore } from '@vben/stores';

import { Button, message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteRole, getRoleList, updateRoleStatus } from '#/api';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const accessStore = useAccessStore();
const userStore = useUserStore();
const isAdmin = computed(() => userStore.userRoles.includes('admin'));
const hasCode = (code: string) => isAdmin.value || accessStore.accessCodes.includes(code);
const canCreate = computed(() => hasCode('system:role:create'));
const actionPermissions = computed<RoleActionPermissions>(() => ({
  delete: hasCode('system:role:delete'),
  update: hasCode('system:role:update'),
}));

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const pendingRoleIds = new Set<number | string>();

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    fieldMappingTime: [['createTime', ['startTime', 'endTime']]],
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(onActionClick, actionPermissions.value, onStatusChange),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          return await getRoleList({
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
  } as VxeTableGridOptions<SystemRoleApi.SystemRole>,
});

function onActionClick(e: OnActionClickParams<SystemRoleApi.SystemRole>) {
  switch (e.code) {
    case 'delete': {
      onDelete(e.row);
      break;
    }
    case 'edit': {
      onEdit(e.row);
      break;
    }
  }
}

/**
 * 将Antd的Modal.confirm封装为promise，方便在异步函数中调用。
 * @param content 提示内容
 * @param title 提示标题
 */
function confirmAction(content: string, title: string) {
  return new Promise<boolean>((resolve) => {
    Modal.confirm({
      cancelText: $t('common.cancel'),
      content,
      onCancel() {
        resolve(false);
      },
      onOk() {
        resolve(true);
      },
      okText: $t('common.confirm'),
      title,
    });
  });
}

/**
 * 状态开关即将改变
 * @param newStatus 期望改变的状态值
 * @param row 行数据
 * @returns 返回false则中止改变，返回其他值（undefined、true）则允许改变
 */
async function onStatusChange(
  newStatus: number,
  row: SystemRoleApi.SystemRole,
) {
  if (!actionPermissions.value.update) return false;
  const nextStatus = newStatus === 1 ? 1 : 0;
  if (pendingRoleIds.has(row.id)) return false;
  if (nextStatus === 0 && row.roleKey === 'admin') {
    message.warning($t('roleAdmin.adminCannotDisable'));
    return false;
  }
  if (nextStatus === 0 && row.defaultRegisterRole) {
    message.warning($t('roleAdmin.defaultRoleCannotDisable'));
    return false;
  }
  const statusText =
    nextStatus === 1 ? $t('common.enabled') : $t('common.disabled');
  try {
    const confirmed = await confirmAction(
      $t('roleAdmin.statusConfirmDescription', [row.name, statusText]),
      $t('roleAdmin.statusConfirmTitle'),
    );
    if (!confirmed) return false;
    pendingRoleIds.add(row.id);
    await updateRoleStatus(row.id, nextStatus);
    message.success($t('roleAdmin.statusUpdated'));
    return true;
  } catch {
    return false;
  } finally {
    pendingRoleIds.delete(row.id);
  }
}

function onEdit(row: SystemRoleApi.SystemRole) {
  if (!actionPermissions.value.update) return;
  formDrawerApi.setData(row).open();
}

async function onDelete(row: SystemRoleApi.SystemRole) {
  if (!actionPermissions.value.delete) return;
  if (pendingRoleIds.has(row.id)) return;
  if (row.builtin) {
    message.warning($t('roleAdmin.builtinCannotDelete'));
    return;
  }
  if (row.defaultRegisterRole) {
    message.warning($t('roleAdmin.defaultRoleCannotDelete'));
    return;
  }
  const confirmed = await confirmAction(
    $t('roleAdmin.deleteDescription', [row.name]),
    $t('roleAdmin.deleteTitle'),
  );
  if (!confirmed) return;
  pendingRoleIds.add(row.id);
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.name]),
    duration: 0,
    key: 'action_process_msg',
  });
  try {
    await deleteRole(row.id);
    message.success({
      content: $t('ui.actionMessage.deleteSuccess', [row.name]),
      key: 'action_process_msg',
    });
    await gridApi.query();
  } catch {
    hideLoading();
  } finally {
    pendingRoleIds.delete(row.id);
  }
}

function onRefresh() {
  gridApi.query();
}

function onCreate() {
  if (!canCreate.value) return;
  formDrawerApi.setData({}).open();
}
</script>
<template>
  <Page auto-content-height>
    <FormDrawer @success="onRefresh" />
    <Grid :table-title="$t('system.role.list')">
      <template #toolbar-tools>
        <Button v-if="canCreate" type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('system.role.name')]) }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
