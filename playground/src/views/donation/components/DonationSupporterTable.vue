<script setup lang="ts">
import type { TableColumnsType } from 'ant-design-vue';

import type { DonationApi } from '#/api/donation';

import { computed } from 'vue';

import { Avatar, Pagination, Table } from 'ant-design-vue';

import { $t } from '#/locales';

import { formatDonationAmount } from '../model';

const props = defineProps<{
  items: readonly DonationApi.Supporter[];
  loading: boolean;
  page: { current: number; pageSize: number; total: number };
}>();

const emit = defineEmits<{
  pageChange: [page: number, pageSize: number];
}>();

const dataSource = computed(() => [...props.items]);
const columns = computed<TableColumnsType>(() => [
  {
    dataIndex: 'nickname',
    key: 'supporter',
    title: $t('donationSettings.supporters.table.supporter'),
    width: 220,
  },
  {
    dataIndex: 'amount',
    key: 'amount',
    title: $t('donationSettings.supporters.table.amount'),
    width: 120,
  },
  {
    dataIndex: 'message',
    key: 'message',
    title: $t('donationSettings.supporters.table.message'),
  },
  {
    dataIndex: 'donatedAt',
    key: 'donatedAt',
    title: $t('donationSettings.supporters.table.donatedAt'),
    width: 180,
  },
  {
    dataIndex: 'creatorName',
    key: 'creatorName',
    title: $t('donationSettings.supporters.table.creator'),
    width: 140,
  },
]);

function supporterInitial(nickname: string) {
  return Array.from(nickname.trim())[0]?.toLocaleUpperCase() || '?';
}
</script>

<template>
  <div class="supporter-table-wrap">
    <Table
      :columns="columns"
      :data-source="dataSource"
      :loading="props.loading"
      :locale="{ emptyText: $t('donationSettings.supporters.table.empty') }"
      :pagination="false"
      row-key="id"
      :scroll="{ x: 920 }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'supporter'">
          <div class="supporter-cell">
            <Avatar :size="38" :src="record.avatarUrl || undefined">
              {{ supporterInitial(record.nickname) }}
            </Avatar>
            <strong>{{ record.nickname }}</strong>
          </div>
        </template>
        <template v-else-if="column.key === 'amount'">
          <span class="supporter-table-amount">
            {{ formatDonationAmount(record.amount) }}
          </span>
        </template>
        <template v-else-if="column.key === 'message'">
          <span class="supporter-table-message">{{ record.message || '-' }}</span>
        </template>
        <template v-else-if="column.key === 'creatorName'">
          {{ record.creatorName || '-' }}
        </template>
      </template>
    </Table>

    <Pagination
      class="supporter-pagination"
      :current="props.page.current"
      :page-size="props.page.pageSize"
      :show-size-changer="true"
      :show-total="
        (total: number) => $t('donationSettings.supporters.table.total', [total])
      "
      :total="props.page.total"
      @change="(page, pageSize) => emit('pageChange', page, pageSize)"
    />
  </div>
</template>

<style scoped>
.supporter-table-wrap {
  min-width: 0;
}

.supporter-cell {
  display: flex;
  gap: 10px;
  align-items: center;
}

.supporter-cell strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.supporter-table-amount {
  font-weight: 800;
  color: hsl(var(--primary));
}

.supporter-table-message {
  display: -webkit-box;
  overflow: hidden;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.supporter-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
