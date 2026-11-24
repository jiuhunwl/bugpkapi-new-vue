<script lang="ts" setup>
import type { RedeemCodeActionPermissions } from './data';

import type { OnActionClickParams, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { RedeemApi } from '#/api/redeem';

import { computed, shallowRef } from 'vue';

import { Page } from '@vben/common-ui';
import { Download } from '@vben/icons';
import { useAccessStore, useUserStore } from '@vben/stores';

import { Button, message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { exportCodes, getCodeList, voidCode } from '#/api/redeem';
import { $t } from '#/locales';

import {
  downloadCallLogExportBlob,
  getCallLogExportErrorMessage,
} from '#/views/interface/log-export';

import { useColumns, useGridFormSchema } from './data';

const accessStore = useAccessStore();
const userStore = useUserStore();
const isAdmin = computed(() => userStore.userRoles.includes('admin'));
const hasCode = (code: string) =>
  isAdmin.value || accessStore.accessCodes.includes(code);
const actionPermissions = computed<RedeemCodeActionPermissions>(() => ({
  export: hasCode('redeem:code:export'),
  void: hasCode('redeem:code:void'),
}));

const exporting = shallowRef(false);
const currentFilters = shallowRef<RedeemApi.ListParams>({});

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
          const params = {
            page: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          };
          currentFilters.value = params;
          return await getCodeList(params);
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
  } as VxeTableGridOptions<RedeemApi.Code>,
});

function onActionClick({ code, row }: OnActionClickParams<RedeemApi.Code>) {
  switch (code) {
    case 'void': {
      if (actionPermissions.value.void) onVoid(row);
      break;
    }
  }
}

function onVoid(row: RedeemApi.Code) {
  if (!actionPermissions.value.void || row.status !== 1) return;
  Modal.confirm({
    content: $t('system.redeem.code.voidConfirmContent', [row.codeMask]),
    onOk: async () => {
      await voidCode(row.id);
      message.success($t('system.redeem.code.voidSuccess'));
      onRefresh();
    },
    title: $t('system.redeem.code.voidConfirmTitle'),
  });
}

async function onExport() {
  if (!actionPermissions.value.export || exporting.value) return;
  const typeId = currentFilters.value?.type_id;
  if (!typeId) {
    message.warning($t('system.redeem.code.exportNeedType'));
    return;
  }
  exporting.value = true;
  try {
    const blob = await exportCodes(typeId);
    const timestamp = new Date()
      .toISOString()
      .replaceAll(/[-:TZ.]/g, '')
      .slice(0, 14);
    await downloadCallLogExportBlob(
      blob,
      `redeem-codes-${typeId}-${timestamp}.xlsx`,
    );
    message.success($t('system.redeem.code.exportSuccess'));
  } catch (error) {
    const reason = await getCallLogExportErrorMessage(error);
    message.error(reason || $t('ui.fallback.http.internalServerError'));
  } finally {
    exporting.value = false;
  }
}

function onRefresh() {
  gridApi.query();
}
</script>

<template>
  <Page auto-content-height>
    <Grid :table-title="$t('system.redeem.code.title')">
      <template #toolbar-tools>
        <Button
          v-if="actionPermissions.export"
          :loading="exporting"
          @click="onExport"
        >
          <Download class="size-5" />
          {{ $t('system.redeem.code.export') }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
