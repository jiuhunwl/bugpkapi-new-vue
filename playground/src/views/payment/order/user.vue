<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { PaymentOrderApi } from '#/api/system/payment';

import { shallowRef } from 'vue';

import { Page } from '@vben/common-ui';

import { message, Modal, TabPane, Tabs, Tag } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  cancelPaymentOrder,
  deleteMyPaymentOrder,
  getMyPaymentOrderList,
} from '#/api/payment';
import { $t } from '#/locales';
import { readGridSort } from '#/utils/grid-sort';

import {
  orderTypeColor,
  orderTypeLabel,
  orderTypeTabs,
  statusColor,
  statusLabel,
  useOrderColumns,
  useOrderGridFormSchema,
} from './data';
import ContinuePayModal from './modules/continue-pay-modal.vue';

const activeType = shallowRef<'ALL' | PaymentOrderApi.OrderType>('ALL');
const continuePayModalRef = shallowRef<InstanceType<typeof ContinuePayModal>>();

// 用户端不给同步：查单是运维动作，普通用户只需要「继续支付/取消/删除」。
const userActions = { cancel: true, continue: true, delete: true };

// 表格列 → 服务端排序字段（后端白名单校验），与管理端保持一致。
const columnSortFields: Record<string, PaymentOrderApi.OrderListParams['sortBy']> = {
  createTime: 'created_at',
  paidTime: 'paid_at',
  payAmount: 'pay_amount',
  status: 'status',
};

async function onActionClick({ code, row }: OnActionClickParams<PaymentOrderApi.PaymentOrder>) {
  if (code === 'continue') {
    await continuePayModalRef.value?.open(row);
    return;
  }
  if (code === 'cancel') {
    Modal.confirm({
      content: $t('paymentOrder.confirm.cancelDesc'),
      onOk: async () => {
        await cancelPaymentOrder(row.orderNo);
        message.success($t('paymentOrder.confirm.cancelSuccess'));
        await gridApi.query();
      },
      title: $t('paymentOrder.confirm.cancelTitle'),
    });
    return;
  }
  if (code === 'delete') {
    // 删除已由操作列的 Popconfirm 二次确认，这里只执行。
    await deleteMyPaymentOrder(row.orderNo);
    message.success($t('paymentOrder.confirm.deleteSuccess'));
    await gridApi.query();
  }
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useOrderGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useOrderColumns(false, userActions, onActionClick),
    height: 'auto',
    keepSource: true,
    sortConfig: {
      remote: true,
      trigger: 'cell',
    },
    proxyConfig: {
      ajax: {
        query: async ({ page, sort }, formValues) => {
          const { sortBy, sortOrder } = readGridSort(sort, columnSortFields);
          return await getMyPaymentOrderList({
            page: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
            orderType: activeType.value === 'ALL' ? undefined : activeType.value,
            sortBy,
            sortOrder,
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
  } as VxeTableGridOptions<PaymentOrderApi.PaymentOrder>,
});

function onTabChange(key: number | string) {
  activeType.value = String(key) as 'ALL' | PaymentOrderApi.OrderType;
  gridApi.query();
}
</script>

<template>
  <Page auto-content-height>
    <div class="payment-order-page">
      <Tabs
        v-model:active-key="activeType"
        class="payment-order-tabs"
        @change="onTabChange"
      >
        <TabPane
          v-for="item in orderTypeTabs()"
          :key="item.value"
          :tab="item.label"
        />
      </Tabs>

      <Grid class="payment-order-grid" :table-title="$t('paymentOrder.userTitle')">
        <template #orderType="{ row }">
          <Tag :color="orderTypeColor[row.orderType] || 'default'">
            {{ orderTypeLabel(row.orderType) }}
          </Tag>
        </template>
        <template #status="{ row }">
          <Tag :color="statusColor[row.status] || 'default'">
            {{ statusLabel(row.status) }}
          </Tag>
        </template>
      </Grid>

      <ContinuePayModal ref="continuePayModalRef" @refresh="gridApi.query()" />
    </div>
  </Page>
</template>

<style scoped>
.payment-order-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;
}

.payment-order-grid {
  flex: 1;
  min-height: 0;
}

.payment-order-tabs {
  padding: 0 16px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.payment-order-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 0;
}
</style>
