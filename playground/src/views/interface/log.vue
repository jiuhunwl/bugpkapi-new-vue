<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { InterfaceApi } from '#/api/interface';

import { computed, onBeforeUnmount, shallowRef } from 'vue';
import { useRoute } from 'vue-router';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { IconifyIcon, RotateCw } from '@vben/icons';
import { useAccessStore, useUserStore } from '@vben/stores';

import { Button, message, Modal, Switch, Tag, Tooltip } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  exportInterfaceCallLogs,
  getInterfaceCallLogList,
} from '#/api/interface';
import { $t } from '#/locales';

import {
  chargeTypeOptions,
  isBillingRecordsRoute,
  normalizeCallLogFilters,
  useCallLogColumns,
  useCallLogGridFormSchema,
} from './log-data';
import {
  downloadCallLogExportBlob,
  getCallLogExportErrorMessage,
} from './log-export';
import { useCallLogQuery } from './use-call-log-query';
import CallLogDetail from './modules/call-log-detail.vue';
import CallLogRequestId from './modules/CallLogRequestId.vue';
import CallLogQueryFooter from './modules/CallLogQueryFooter.vue';

const userStore = useUserStore();
const accessStore = useAccessStore();
const route = useRoute();
const isAdmin = computed(() => userStore.userRoles.includes('admin'));
const hasCode = (code: string) =>
  isAdmin.value || accessStore.accessCodes.includes(code);
const canManageLogs = computed(() => hasCode('log:call:list'));
// 后台“计费记录”菜单与“调用日志”复用同一页面组件。计费记录视图必须遵循
// 接口的计费总开关与计费日志开关，否则关闭开关后仍会看到该接口的扣费记录。
const isBillingRecordsView = computed(() => isBillingRecordsRoute(route));
const pageTitle = computed(() =>
  isBillingRecordsView.value
    ? $t('system.package.billingRecordTitle')
    : $t('system.interface.callLogTitle'),
);
const canExportLogs = computed(() => hasCode('log:call:export'));
const canViewDetail = computed(
  () => !canManageLogs.value || hasCode('log:call:detail'),
);
const showUnmaskedSensitive = shallowRef(false);
const exporting = shallowRef(false);
const currentFilters = shallowRef<InterfaceApi.CallLogListParams>({});
const logQuery = useCallLogQuery(getInterfaceCallLogList);
const {
  fastMode,
  currentPage,
  pageSize,
  hasNext,
  hasLoaded,
  loading,
  countLoading,
  countError,
  total,
} = logQuery;

onBeforeUnmount(() => logQuery.cancel());

const chargeTypeColor: Record<InterfaceApi.ChargeType, string> = {
  ADMIN: 'purple',
  BALANCE: 'gold',
  FREE: 'default',
  GLOBAL_PACKAGE: 'blue',
  INTERFACE_PACKAGE: 'cyan',
  MEMBER: 'blue',
  NO_CHARGE: 'default',
  OPEN_PENDING: 'orange',
  POINT: 'green',
  POINTS: 'green',
};

function isSuccess(value: boolean | number) {
  return value === true || value === 1;
}

function chargeTypeLabel(value: InterfaceApi.ChargeType) {
  return (
    chargeTypeOptions().find((item) => item.value === value)?.label ||
    $t('system.interface.chargeFree')
  );
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
    collapsedRows: 1,
    schema: useCallLogGridFormSchema(canManageLogs.value).sort(
      (a, b) =>
        Number(b.fieldName === 'timeRange') -
        Number(a.fieldName === 'timeRange'),
    ),
    submitOnChange: false,
  },
  gridOptions: {
    columns: useCallLogColumns(
      canManageLogs.value,
      canViewDetail.value || !canManageLogs.value,
    ),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      // With the numbered pager disabled, VXE uses list rather than result.
      response: { list: 'items' },
      ajax: {
        query: async ({ page }, formValues) => {
          const filters = {
            ...normalizeCallLogFilters(formValues),
            ...(isBillingRecordsView.value ? { billingOnly: 1 as const } : {}),
          };
          currentFilters.value = filters;
          const result = await logQuery.query(
            { currentPage: page.currentPage, pageSize: page.pageSize },
            {
              ...filters,
              unmasked:
                isAdmin.value && showUnmaskedSensitive.value ? 1 : undefined,
            },
            !canManageLogs.value,
          );
          return result;
        },
      },
    },
    rowConfig: {
      keyField: 'id',
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: false,
      search: true,
      zoom: true,
    },
    pagerConfig: {
      enabled: false,
      pageSize: 20,
      pageSizes: [20, 50, 100, 200],
    },
  } as VxeTableGridOptions<InterfaceApi.CallLogViewItem>,
});

const [DetailDrawer, detailDrawerApi] = useVbenDrawer({
  connectedComponent: CallLogDetail,
  destroyOnClose: true,
});

function openDetail(row: InterfaceApi.CallLogViewItem) {
  detailDrawerApi
    .setData({
      id: row.id,
      unmasked: isAdmin.value && showUnmaskedSensitive.value,
      userScope: !canManageLogs.value,
    })
    .open();
}

function onRefresh() {
  logQuery.reset();
  gridApi.reload();
}

function onFastModeChange(value: boolean | number | string) {
  fastMode.value = value === true;
  gridApi.setGridOptions({ pagerConfig: { enabled: !fastMode.value } });
  onRefresh();
}

function onFastPage(delta: number) {
  if (
    loading.value ||
    !hasLoaded.value ||
    (delta > 0 ? !hasNext.value : currentPage.value <= 1)
  )
    return;
  currentPage.value += delta;
  gridApi.query();
}

function onFastPageSize(value: unknown) {
  pageSize.value = Number(value);
  onRefresh();
}

async function onLoadTotal() {
  try {
    await logQuery.loadTotal();
  } catch {
    message.error($t('system.interface.fastQueryCountFailed'));
  }
}

async function onExport() {
  if (exporting.value) return;
  exporting.value = true;
  try {
    const blob = await exportInterfaceCallLogs(currentFilters.value);
    const timestamp = new Date()
      .toISOString()
      .replaceAll(/[-:TZ.]/g, '')
      .slice(0, 14);
    await downloadCallLogExportBlob(
      blob,
      `bugpk-api-call-logs-${timestamp}.csv`,
    );
    message.success($t('system.interface.exportSuccess'));
  } catch (error) {
    const reason = await getCallLogExportErrorMessage(error);
    message.error(reason || $t('ui.fallback.http.internalServerError'));
  } finally {
    exporting.value = false;
  }
}

function onSensitiveToggleChange(value: boolean | number | string) {
  const enabled = value === true || value === 1 || value === '1';
  if (!enabled) {
    showUnmaskedSensitive.value = false;
    onRefresh();
    return;
  }

  Modal.confirm({
    content: $t('system.interface.rawSensitiveConfirmContent'),
    okText: $t('system.interface.rawSensitiveConfirmAction'),
    okType: 'danger',
    title: $t('system.interface.rawSensitiveConfirmTitle'),
    onOk: () => {
      showUnmaskedSensitive.value = true;
      onRefresh();
    },
  });
}
</script>

<template>
  <Page auto-content-height class="call-log-page">
    <DetailDrawer />
    <Grid class="call-log-standard-grid" :table-title="pageTitle">
      <template #toolbar-actions>
        <div class="ml-4 flex flex-wrap items-center gap-4">
          <Tooltip :title="$t('system.interface.fastQueryHint')">
            <label
              class="text-muted-foreground inline-flex items-center gap-2 text-sm"
            >
              <Switch
                size="small"
                :checked="fastMode"
                :aria-label="$t('system.interface.fastQueryMode')"
                @change="onFastModeChange"
              />
              <span>{{ $t('system.interface.fastQueryMode') }}</span>
            </label>
          </Tooltip>
          <label
            v-if="isAdmin"
            class="text-muted-foreground inline-flex items-center gap-2 text-sm"
          >
            <Switch
              size="small"
              :checked="showUnmaskedSensitive"
              :aria-label="$t('system.interface.rawSensitiveLabel')"
              @change="onSensitiveToggleChange"
            />
            <span>{{ $t('system.interface.rawSensitiveLabel') }}</span>
          </label>
          <Tag v-else>{{ $t('system.interface.callLogMasked') }}</Tag>
        </div>
      </template>
      <template #toolbar-tools>
        <Button :loading="loading" @click="onRefresh">
          <template #icon><RotateCw class="size-4" /></template>
          {{ $t('system.interface.fastQueryRefresh') }}
        </Button>
        <Button
          v-if="canExportLogs"
          type="primary"
          :loading="exporting"
          @click="onExport"
        >
          <template #icon
            ><IconifyIcon icon="lucide:download" class="size-4"
          /></template>
          {{ $t('system.interface.exportCallLogs') }}
        </Button>
      </template>
      <template #traceId="{ row }"
        ><CallLogRequestId :id="row.traceId"
      /></template>
      <template #success="{ row }"
        ><Tag :color="isSuccess(row.success) ? 'success' : 'error'">{{
          isSuccess(row.success)
            ? $t('system.interface.callSuccess')
            : $t('system.interface.callFailed')
        }}</Tag></template
      >
      <template #chargeType="{ row }"
        ><Tag :color="chargeTypeColor[row.chargeType] || 'default'">{{
          chargeTypeLabel(row.chargeType)
        }}</Tag></template
      >
      <template #action="{ row }"
        ><Button
          v-if="canViewDetail"
          type="link"
          size="small"
          @click="openDetail(row)"
          >{{ $t('system.interface.viewDetail') }}</Button
        ></template
      >
      <template #bottom>
        <CallLogQueryFooter
          :fast-mode="fastMode"
          :count-error="countError"
          :total="total"
          :count-loading="countLoading"
          :loading="loading"
          :has-loaded="hasLoaded"
          :current-page="currentPage"
          :page-size="pageSize"
          :has-next="hasNext"
          @count="onLoadTotal"
          @page="onFastPage"
          @page-size="onFastPageSize"
        />
      </template>
    </Grid>
  </Page>
</template>
