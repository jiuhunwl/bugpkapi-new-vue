<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { PaymentOrderApi } from '#/api/system/payment';

import { Tag } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getAssetRecordList } from '#/api/system/payment';
import { formatSettlementPrice } from '#/composables/use-settlement-currency';
import { $t } from '#/locales';

const bizTypes = [
  'ADMIN_BALANCE_ADJUST',
  'ADMIN_USER_ASSET_ADJUST',
  'ADMIN_USER_INITIAL_ASSET',
  'ALIPAY_RECHARGE',
  'ALIPAY_POINT_PACKAGE',
  'REDEEM_CODE',
  'POINTS_GRANT',
  'PURCHASE_GLOBAL_PACKAGE',
  'PURCHASE_INTERFACE_PACKAGE',
  'PURCHASE_POINT_PACKAGE',
] as const;

const bizTypeColors: Record<string, string> = {
  ADMIN_BALANCE_ADJUST: 'orange',
  ADMIN_USER_ASSET_ADJUST: 'gold',
  ADMIN_USER_INITIAL_ASSET: 'default',
  ALIPAY_POINT_PACKAGE: 'cyan',
  ALIPAY_RECHARGE: 'green',
  POINTS_GRANT: 'cyan',
  PURCHASE_GLOBAL_PACKAGE: 'blue',
  PURCHASE_INTERFACE_PACKAGE: 'processing',
  PURCHASE_POINT_PACKAGE: 'purple',
  REDEEM_CODE: 'magenta',
};

function bizTypeLabel(value?: string) {
  if (!value) return '-';
  const key = `paymentOrder.assetRecords.types.${value}`;
  const label = $t(key);
  return label === key ? value : label;
}

function signedMoney(value?: string) {
  const amount = Number(value ?? 0);
  const text = formatSettlementPrice(Math.abs(amount), 4);
  if (amount > 0) return `+${text}`;
  if (amount < 0) return `-${text}`;
  return text;
}

function signedPoints(value?: number) {
  const points = Number(value ?? 0);
  if (points > 0) return `+${points.toLocaleString()}`;
  if (points < 0) return `-${Math.abs(points).toLocaleString()}`;
  return '0';
}

function numericClass(value?: number | string) {
  const amount = Number(value ?? 0);
  if (amount > 0) return 'is-positive';
  if (amount < 0) return 'is-negative';
  return '';
}

function useAssetRecordFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('paymentOrder.assetRecords.searchPlaceholder'),
      },
      fieldName: 'keyword',
      label: $t('paymentOrder.fields.keyword'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: bizTypes.map((value) => ({
          label: bizTypeLabel(value),
          value,
        })),
      },
      fieldName: 'bizType',
      label: $t('paymentOrder.assetRecords.fields.bizType'),
    },
    {
      component: 'DatePicker',
      componentProps: {
        allowClear: true,
        class: 'w-full',
        valueFormat: 'YYYY-MM-DD',
      },
      fieldName: 'dateFrom',
      label: $t('paymentOrder.assetRecords.fields.dateFrom'),
    },
    {
      component: 'DatePicker',
      componentProps: {
        allowClear: true,
        class: 'w-full',
        valueFormat: 'YYYY-MM-DD',
      },
      fieldName: 'dateTo',
      label: $t('paymentOrder.assetRecords.fields.dateTo'),
    },
  ];
}

const [Grid] = useVbenVxeGrid({
  formOptions: {
    schema: useAssetRecordFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: [
      {
        field: 'createTime',
        title: $t('paymentOrder.assetRecords.fields.createTime'),
        width: 172,
      },
      {
        field: 'username',
        minWidth: 180,
        slots: { default: 'user' },
        title: $t('paymentOrder.assetRecords.fields.user'),
      },
      {
        field: 'bizType',
        slots: { default: 'bizType' },
        title: $t('paymentOrder.assetRecords.fields.bizType'),
        width: 138,
      },
      {
        align: 'right',
        field: 'amount',
        slots: { default: 'amount' },
        title: $t('paymentOrder.assetRecords.fields.amount'),
        width: 132,
      },
      {
        align: 'right',
        field: 'points',
        slots: { default: 'points' },
        title: $t('paymentOrder.assetRecords.fields.points'),
        width: 116,
      },
      {
        align: 'right',
        field: 'balanceAfter',
        formatter: ({ cellValue }) =>
          formatSettlementPrice(cellValue, 4),
        title: $t('paymentOrder.assetRecords.fields.balanceAfter'),
        width: 136,
      },
      {
        align: 'right',
        field: 'pointsAfter',
        formatter: ({ cellValue }) =>
          Number(cellValue ?? 0).toLocaleString(),
        title: $t('paymentOrder.assetRecords.fields.pointsAfter'),
        width: 126,
      },
      {
        field: 'operatorName',
        formatter: ({ cellValue }) => cellValue || '-',
        minWidth: 120,
        title: $t('paymentOrder.assetRecords.fields.operator'),
      },
      {
        field: 'remark',
        minWidth: 220,
        title: $t('paymentOrder.assetRecords.fields.remark'),
      },
    ],
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) =>
          await getAssetRecordList({
            page: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          }),
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
  } as VxeTableGridOptions<PaymentOrderApi.AssetRecord>,
});
</script>

<template>
  <Grid
    class="asset-record-grid"
    :table-title="$t('paymentOrder.assetRecords.title')"
  >
    <template #user="{ row }">
      <div class="asset-record-user">
        <span class="asset-record-user__name">
          {{ row.displayName || row.username || `#${row.userId}` }}
        </span>
        <small>#{{ row.userId }}</small>
      </div>
    </template>
    <template #bizType="{ row }">
      <Tag :color="bizTypeColors[row.bizType] || 'default'">
        {{ bizTypeLabel(row.bizType) }}
      </Tag>
    </template>
    <template #amount="{ row }">
      <span class="asset-record-number" :class="numericClass(row.amount)">
        {{ signedMoney(row.amount) }}
      </span>
    </template>
    <template #points="{ row }">
      <span class="asset-record-number" :class="numericClass(row.points)">
        {{ signedPoints(row.points) }}
      </span>
    </template>
  </Grid>
</template>

<style scoped>
.asset-record-grid {
  flex: 1;
  min-height: 0;
}

.asset-record-user {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.35;
}

.asset-record-user__name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 600;
  white-space: nowrap;
}

.asset-record-user small {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 10.5px;
  color: hsl(var(--muted-foreground));
}

.asset-record-number {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-variant-numeric: tabular-nums;
}

.asset-record-number.is-positive {
  color: hsl(var(--success));
}

.asset-record-number.is-negative {
  color: hsl(var(--destructive));
}
</style>
