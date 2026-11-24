<script setup lang="ts">
import type { TableColumnsType } from 'ant-design-vue';

import type { PackageApi } from '#/api/package';

import { computed } from 'vue';

import { Card, Pagination, Table, Tag } from 'ant-design-vue';

import { $t } from '#/locales';

const props = defineProps<{
  items: readonly PackageApi.BillingRecord[];
  loading: boolean;
  page: { current: number; pageSize: number; total: number };
}>();

const emit = defineEmits<{
  pageChange: [page: number, pageSize: number];
}>();

const dataSource = computed(() => [...props.items]);

const columns = computed<TableColumnsType>(() => [
  { dataIndex: 'apiCode', key: 'apiCode', title: $t('system.package.assets.apiCode') },
  { dataIndex: 'chargeType', key: 'chargeType', title: $t('system.package.assets.chargeType') },
  { dataIndex: 'chargeAmount', key: 'chargeAmount', title: $t('system.package.assets.chargeAmount') },
  { dataIndex: 'pointAmount', key: 'pointAmount', title: $t('system.package.assets.pointAmount') },
  { dataIndex: 'status', key: 'status', title: $t('system.package.assets.billingStatus') },
  { dataIndex: 'reason', key: 'reason', title: $t('system.package.assets.reason') },
  { dataIndex: 'createTime', key: 'createTime', title: $t('system.package.assets.createTime') },
]);

const chargeTypeKeys: Record<string, string> = {
  BALANCE: 'balance',
  FREE: 'free',
  GLOBAL_PACKAGE: 'globalPackage',
  INTERFACE_PACKAGE: 'interfacePackage',
  NO_CHARGE: 'noCharge',
  POINTS: 'points',
};

function chargeTypeText(value: string) {
  const key = chargeTypeKeys[value];
  return key ? $t(`system.package.assets.chargeTypes.${key}`) : value;
}

function statusColor(value: string) {
  if (value === 'CONFIRMED') return 'green';
  if (value === 'RESERVED') return 'blue';
  if (value === 'RELEASED') return 'default';
  return 'red';
}

function statusText(value: string) {
  const normalized = value.toLowerCase();
  const known = ['confirmed', 'failed', 'released', 'reserved'].includes(normalized);
  return known ? $t(`system.package.assets.billingStatuses.${normalized}`) : value;
}
</script>

<template>
  <Card class="asset-panel" :title="$t('system.package.assets.billing')">
    <Table
      :columns="columns"
      :data-source="dataSource"
      :loading="loading"
      :pagination="false"
      row-key="id"
      :scroll="{ x: 980 }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'apiCode'">
          <code class="api-code">{{ record.apiCode }}</code>
        </template>
        <template v-else-if="column.key === 'chargeType'">
          <Tag>{{ chargeTypeText(record.chargeType) }}</Tag>
        </template>
        <template v-else-if="column.key === 'status'">
          <Tag :color="statusColor(record.status)">{{ statusText(record.status) }}</Tag>
        </template>
        <template v-else-if="column.key === 'reason'">
          {{ record.reason || '-' }}
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

.api-code {
  padding: 2px 6px;
  color: hsl(var(--foreground));
  background: hsl(var(--muted));
  border-radius: 4px;
}
</style>
