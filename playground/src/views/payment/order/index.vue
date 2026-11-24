<script lang="ts" setup>
import type { PaymentOrderActionPermissions } from './data';

import type { OnActionClickParams, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { PaymentOrderApi } from '#/api/system/payment';

import { computed, h, shallowRef } from 'vue';

import { Page } from '@vben/common-ui';
import { useAccessStore, useUserStore } from '@vben/stores';

import { message, Modal, TabPane, Tabs, Tag } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deletePaymentOrder,
  getPaymentOrder,
  getPaymentOrderList,
  syncPaymentOrder,
} from '#/api/system/payment';
import { $t } from '#/locales';
import { readGridSort } from '#/utils/grid-sort';

import {
  formatOrderMoney,
  orderTypeColor,
  orderTypeLabel,
  orderTypeTabs,
  statusColor,
  statusLabel,
  useOrderColumns,
  useOrderGridFormSchema,
} from './data';
import AssetRecordPanel from './asset-record-panel.vue';

const activePanel = shallowRef<'assets' | 'orders'>('orders');
const activeType = shallowRef<'ALL' | PaymentOrderApi.OrderType>('ALL');
const accessStore = useAccessStore();
const userStore = useUserStore();
const isAdmin = computed(() => userStore.userRoles.includes('admin'));
const hasCode = (code: string) => isAdmin.value || accessStore.accessCodes.includes(code);
// 管理端只授予详情/同步/删除；继续支付与取消是用户侧动作，保持缺省隐藏。
const actionPermissions = computed<Partial<PaymentOrderActionPermissions>>(
  () => ({
    delete: hasCode('payment:order:delete'),
    detail: hasCode('payment:order:detail'),
    sync: hasCode('payment:order:sync'),
  }),
);

// 表格列 → 服务端排序字段（后端白名单校验）。
const columnSortFields: Record<string, PaymentOrderApi.OrderListParams['sortBy']> = {
  createTime: 'created_at',
  paidTime: 'paid_at',
  payAmount: 'pay_amount',
  status: 'status',
};

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useOrderGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useOrderColumns(true, actionPermissions.value, onActionClick),
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
          return await getPaymentOrderList({
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

function detailContent(order: PaymentOrderApi.PaymentOrder) {
  const fields: Array<[string, unknown]> = [
    [$t('paymentOrder.fields.orderNo'), order.orderNo],
    [$t('paymentOrder.fields.user'), order.username || order.userId],
    [$t('paymentOrder.fields.type'), orderTypeLabel(order.orderType)],
    [$t('paymentOrder.fields.subject'), order.subject],
    [$t('paymentOrder.fields.amount'), formatOrderMoney(order.payAmount, order.currency)],
    [$t('paymentOrder.fields.status'), statusLabel(order.status)],
    [$t('paymentOrder.fields.tradeNo'), order.alipayTradeNo || '-'],
    [$t('paymentOrder.fields.paidTime'), order.paidTime || '-'],
    [$t('paymentOrder.fields.createTime'), order.createTime || '-'],
  ];
  return h('div', { class: 'space-y-2' }, fields.map(([label, value]) =>
    h('div', { class: 'grid grid-cols-[140px_1fr] gap-3' }, [
      h('strong', String(label)),
      h('span', { class: 'break-all' }, String(value ?? '-')),
    ]),
  ));
}

async function onActionClick({ code, row }: OnActionClickParams<PaymentOrderApi.PaymentOrder>) {
  if (code === 'detail') {
    if (!actionPermissions.value.detail) return;
    const order = await getPaymentOrder(row.orderNo);
    Modal.info({ content: detailContent(order), title: order.orderNo, width: 680 });
    return;
  }
  if (code === 'delete') {
    // 删除按钮由 CellOperation 的 Popconfirm 二次确认，这里只负责执行。
    if (!actionPermissions.value.delete) return;
    await deletePaymentOrder(row.orderNo);
    message.success($t('paymentOrder.confirm.deleteSuccess'));
    await gridApi.query();
    return;
  }
  if (code === 'sync') {
    if (!actionPermissions.value.sync) return;
    // 同步只是「向渠道查一次单」，结果要如实回显当前状态；
    // 早先复用支付配置的「支付宝校验通过」文案，会让人以为在验配置。
    const latest = await syncPaymentOrder(row.orderNo);
    message.success(
      $t('paymentOrder.confirm.syncSuccess', { status: statusLabel(latest.status) }),
    );
    await gridApi.query();
  }
}
</script>

<template>
  <Page auto-content-height>
    <div class="payment-order-page">
      <Tabs
        v-model:active-key="activePanel"
        class="payment-panel-tabs"
      >
        <TabPane key="orders" :tab="$t('paymentOrder.panels.orders')" />
        <TabPane key="assets" :tab="$t('paymentOrder.panels.assets')" />
      </Tabs>

      <template v-if="activePanel === 'orders'">
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

        <Grid class="payment-order-grid" :table-title="$t('paymentOrder.title')">
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
      </template>
      <AssetRecordPanel v-else />
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

.payment-panel-tabs {
  padding: 0 16px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.payment-panel-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 0;
}
</style>
