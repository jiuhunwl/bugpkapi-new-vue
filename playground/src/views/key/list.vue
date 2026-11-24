<script lang="ts" setup>
import type { KeyActionPermissions } from './data';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { KeyApi } from '#/api/key';

import { computed, h, shallowRef, watch } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { useAccessStore, useUserStore } from '@vben/stores';

import { Button, Input, message, Modal, Select } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteKey,
  getKeyInterfaceOptions,
  getKeyInterfaces,
  getKeyIpWhitelist,
  getKeyList,
  updateKeyInterfaces,
  updateKeyIpWhitelist,
  updateKeyStatus,
} from '#/api/key';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import DetailDrawer from './modules/detail.vue';
import Form from './modules/form.vue';
import OwnerTabs from './modules/owner-tabs.vue';
import SecretCell from './modules/secret-cell.vue';

const accessStore = useAccessStore();
const userStore = useUserStore();
const isAdmin = computed(() => userStore.userRoles.includes('admin'));
const hasCode = (code: string) =>
  isAdmin.value || accessStore.accessCodes.includes(code);
const canCreate = computed(() => hasCode('key:create'));
const actionPermissions = computed<KeyActionPermissions>(() => ({
  delete: hasCode('key:delete'),
  detail: hasCode('key:list'),
  interface: hasCode('key:interface'),
  ipWhitelist: hasCode('key:ip-whitelist'),
  status: hasCode('key:status'),
}));
const activeOwnerScope = shallowRef<KeyApi.KeyOwnerScope>(
  isAdmin.value ? 'all' : 'mine',
);
const listTitle = computed(() =>
  activeOwnerScope.value === 'all' && isAdmin.value
    ? $t('system.key.userKeys')
    : $t('system.key.myKeys'),
);

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [DetailDrawerComponent, detailDrawerApi] = useVbenDrawer({
  connectedComponent: DetailDrawer,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(
      onActionClick,
      actionPermissions.value,
      onStatusChange,
      isAdmin.value,
    ),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          return await getKeyList({
            page: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
            scope: activeOwnerScope.value,
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
  } as VxeTableGridOptions<KeyApi.KeyItem>,
});

// User information is normally loaded before this route is mounted. Keep the
// initial scope correct as well when the store is hydrated asynchronously.
watch(isAdmin, (admin, previous) => {
  if (admin === previous) return;
  const nextScope: KeyApi.KeyOwnerScope = admin ? 'all' : 'mine';
  if (activeOwnerScope.value === nextScope) return;
  activeOwnerScope.value = nextScope;
  gridApi.query();
});

function onActionClick({ code, row }: OnActionClickParams<KeyApi.KeyItem>) {
  switch (code) {
    case 'delete': {
      onDelete(row);
      break;
    }
    case 'detail': {
      onDetail(row);
      break;
    }
    case 'interfaces': {
      onEditInterfaces(row);
      break;
    }
    case 'ipWhitelist': {
      onEditIpWhitelist(row);
      break;
    }
  }
}

async function onStatusChange(newStatus: 0 | 1, row: KeyApi.KeyItem) {
  if (!actionPermissions.value.status) return false;
  // 账号封禁是账号级开关：是否允许启用由后端按 bp_user 的有效状态统一裁决，
  // 这里不能拿 Key 自身的 suspendedByBan 推断账号状态。该字段只是封禁动作
  // 留下的投影，解封时由解封动作清零；用它做前置拦截会让「账号已解封、
  // 但仍带作废标记的历史 Key」永久无法重新启用（提示语还会误报账号被封禁）。
  try {
    await updateKeyStatus(row.id, newStatus);
    message.success($t('system.key.statusSuccess'));
    return true;
  } catch {
    return false;
  }
}

function onCreate() {
  if (!canCreate.value) return;
  formDrawerApi.setData({}).open();
}

function onDetail(row: KeyApi.KeyItem) {
  if (!actionPermissions.value.detail) return;
  detailDrawerApi.setData(row).open();
}

async function onEditInterfaces(row: KeyApi.KeyItem) {
  if (!actionPermissions.value.interface) return;
  if (row.keyScope === 'GLOBAL') {
    message.info($t('system.key.scopeGlobal'));
    return;
  }
  const [selected, options] = await Promise.all([
    getKeyInterfaces(row.id),
    getKeyInterfaceOptions(),
  ]);
  let interfaceIds = selected;
  Modal.confirm({
    content: h(Select as any, {
      class: 'w-full',
      mode: 'multiple',
      options: options.map((item) => ({ label: item.label, value: item.id })),
      placeholder: $t('system.key.interfacePlaceholder'),
      value: interfaceIds,
      'onUpdate:value': (value: string[]) => {
        interfaceIds = value;
      },
    }),
    onOk: async () => {
      if (interfaceIds.length === 0) {
        message.warning($t('system.key.interfacePlaceholder'));
        return Promise.reject(new Error('at least one interface is required'));
      }
      await updateKeyInterfaces(row.id, interfaceIds);
      message.success($t('system.key.statusSuccess'));
      onRefresh();
    },
    title: $t('system.key.interfaceName'),
    width: 620,
  });
}

async function onEditIpWhitelist(row: KeyApi.KeyItem) {
  if (!actionPermissions.value.ipWhitelist) return;
  let whitelistValue = (await getKeyIpWhitelist(row.id)).join('\n');
  Modal.confirm({
    content: h('div', [
      h(
        'div',
        { class: 'mb-2 text-[13px] text-[var(--vben-text-secondary-color)]' },
        $t('system.key.ipWhitelistHint'),
      ),
      h(Input.TextArea, {
        autoSize: { maxRows: 8, minRows: 6 },
        defaultValue: whitelistValue,
        'onUpdate:value': (value: string) => {
          whitelistValue = value;
        },
        placeholder: $t('system.key.ipWhitelistPlaceholder'),
      }),
    ]),
    onOk: async () => {
      await updateKeyIpWhitelist(row.id, whitelistValue);
      message.success($t('system.key.ipWhitelistSaveSuccess'));
      onRefresh();
    },
    title: $t('system.key.ipWhitelistManage'),
  });
}

function onDelete(row: KeyApi.KeyItem) {
  if (!actionPermissions.value.delete) return;
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.interfaceName]),
    duration: 0,
    key: 'action_process_msg',
  });
  deleteKey(row.id)
    .then(() => {
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.interfaceName]),
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

function onOwnerScopeChange(scope: KeyApi.KeyOwnerScope) {
  if (!isAdmin.value && scope === 'all') {
    activeOwnerScope.value = 'mine';
    return;
  }
  activeOwnerScope.value = scope;
  gridApi.query();
}
</script>

<template>
  <Page auto-content-height>
    <FormDrawer @success="onRefresh" />
    <DetailDrawerComponent />
    <OwnerTabs
      v-model="activeOwnerScope"
      :show-all="isAdmin"
      @change="onOwnerScopeChange"
    />
    <Grid :table-title="listTitle">
      <template #toolbar-tools>
        <Button v-if="canCreate" type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('system.key.createTitle') }}
        </Button>
      </template>
      <template #secretKey="{ row }">
        <SecretCell
          :key="row.id"
          :key-id="row.id"
          :masked-key="row.maskedKey"
          :secret-available="row.secretAvailable"
        />
      </template>
    </Grid>
  </Page>
</template>
