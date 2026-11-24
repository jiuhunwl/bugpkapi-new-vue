<script setup lang="ts">
import type { TableColumnsType } from 'ant-design-vue';

import type { PackageApi } from '#/api/package';

import { computed } from 'vue';

import { Card, Pagination, Table, Tag } from 'ant-design-vue';

import { useSettlementCurrency } from '#/composables/use-settlement-currency';
import { $t } from '#/locales';

const props = defineProps<{
  items: readonly PackageApi.WalletTransaction[];
  loading: boolean;
  page: { current: number; pageSize: number; total: number };
}>();

const emit = defineEmits<{
  pageChange: [page: number, pageSize: number];
}>();

const { priceText } = useSettlementCurrency();

const dataSource = computed(() => [...props.items]);

const columns = computed<TableColumnsType>(() => [
  { dataIndex: 'bizType', key: 'bizType', title: $t('system.package.assets.bizType') },
  { dataIndex: 'amount', key: 'amount', title: $t('system.package.assets.amount') },
  { dataIndex: 'points', key: 'points', title: $t('system.package.assets.points') },
  { dataIndex: 'balanceAfter', key: 'balanceAfter', title: $t('system.package.assets.balanceAfter') },
  { dataIndex: 'pointsAfter', key: 'pointsAfter', title: $t('system.package.assets.pointsAfter') },
  { dataIndex: 'remark', key: 'remark', title: $t('system.package.assets.remark') },
  { dataIndex: 'createTime', key: 'createTime', title: $t('system.package.assets.createTime') },
]);

const bizTypeKeys: Record<string, string> = {
  ADMIN_BALANCE_ADJUST: 'adminBalanceAdjust',
  ADMIN_USER_ASSET_ADJUST: 'adminAdjust',
  ADMIN_USER_INITIAL_ASSET: 'adminInitial',
  ALIPAY_POINT_PACKAGE: 'alipayPointPackage',
  ALIPAY_RECHARGE: 'alipayRecharge',
  OPEN_CALL_BALANCE: 'openCallBalance',
  OPEN_CALL_BALANCE_REFUND: 'openCallBalanceRefund',
  OPEN_CALL_POINTS: 'openCallPoints',
  OPEN_CALL_POINTS_REFUND: 'openCallPointsRefund',
  POINTS_GRANT: 'pointsGrant',
  PURCHASE_GLOBAL_PACKAGE: 'purchaseGlobal',
  PURCHASE_INTERFACE_PACKAGE: 'purchaseInterface',
  PURCHASE_POINT_PACKAGE: 'purchasePoint',
};

function bizTypeText(value: string) {
  const key = bizTypeKeys[value];
  return key ? $t(`system.package.assets.bizTypes.${key}`) : value;
}

function signedValue(value: number | string) {
  const number = Number(value);
  if (!Number.isFinite(number) || number === 0) {
    return String(value ?? 0);
  }
  return `${number > 0 ? '+' : ''}${number.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
}

// 钱包金额按人民币基数记账，展示时统一换算成站点货币。
function signedMoney(value: number | string) {
  const number = Number(value);
  if (!Number.isFinite(number) || number === 0) {
    return priceText(value);
  }
  return `${number > 0 ? '+' : '-'}${priceText(Math.abs(number))}`;
}

function valueClass(value: number | string) {
  const number = Number(value);
  return number > 0 ? 'is-positive' : number < 0 ? 'is-negative' : '';
}
</script>

<template>
  <Card class="asset-panel" :title="$t('system.package.assets.wallet')">
    <Table
      :columns="columns"
      :data-source="dataSource"
      :loading="loading"
      :pagination="false"
      row-key="id"
      :scroll="{ x: 1040 }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'bizType'">
          <Tag>{{ bizTypeText(record.bizType) }}</Tag>
        </template>
        <template v-else-if="column.key === 'amount'">
          <span :class="valueClass(record.amount)">{{ signedMoney(record.amount) }}</span>
        </template>
        <template v-else-if="column.key === 'balanceAfter'">
          <span>{{ priceText(record.balanceAfter) }}</span>
        </template>
        <template v-else-if="column.key === 'points'">
          <span :class="valueClass(record.points)">{{ signedValue(record.points) }}</span>
        </template>
        <template v-else-if="column.key === 'remark'">
          {{ record.remark || '-' }}
        </template>
      </template>
    </Table>
    <Pagination
      class="asset-pagination"
      :current="props.page.current"
      :page-size="props.page.pageSize"
      :total="props.page.total"
      :show-size-changer="true"
      :show-total="(total: number) => $t('system.package.assets.total', [total])"
      @change="(page, pageSize) => emit('pageChange', page, pageSize)"
    />
  </Card>
</template>

<style scoped>
.asset-panel {
  background: hsl(var(--card));
  border-color: hsl(var(--border));
  border-radius: 8px;
}

.asset-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.is-positive {
  font-weight: 700;
  color: #16a34a;
}

.is-negative {
  font-weight: 700;
  color: #dc2626;
}

html.dark .is-positive {
  color: #4ade80;
}

html.dark .is-negative {
  color: #f87171;
}
</style>
