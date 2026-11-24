<script setup lang="ts">
import { Button, Select, Spin, Tooltip } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';
import { $t } from '#/locales';

const props = defineProps<{
  total: number | null;
  fastMode: boolean;
  countError: boolean;
  countLoading: boolean;
  loading: boolean;
  hasLoaded: boolean;
  currentPage: number;
  pageSize: number;
  hasNext: boolean;
}>();
const emit = defineEmits<{
  count: [];
  page: [delta: number];
  pageSize: [size: number];
}>();
const pageSizeOptions = [20, 50, 100, 200].map((value) => ({
  value,
  label: String(value),
}));
function requestCount() {
  if (!props.loading && props.hasLoaded && !props.countLoading) emit('count');
}
function requestPage(delta: number) {
  if (
    props.loading ||
    !props.hasLoaded ||
    (delta < 0 ? props.currentPage <= 1 : !props.hasNext)
  )
    return;
  emit('page', delta);
}
function changePageSize(value: unknown) {
  const size = Number(value);
  if (
    !props.loading &&
    pageSizeOptions.some((option) => option.value === size) &&
    size !== props.pageSize
  )
    emit('pageSize', size);
}
</script>

<template>
  <div
    class="fast-query-controls"
    :aria-label="$t('system.interface.fastQueryFooterLabel')"
  >
    <div class="query-summary">
      <span
        data-testid="call-log-total"
        class="query-summary__value"
        role="status"
        aria-live="polite"
        :aria-busy="loading || countLoading"
      >
        <span v-if="loading || countLoading" class="query-summary__pending"
          ><Spin size="small" />{{
            $t('system.interface.fastQueryCounting')
          }}</span
        >
        <span v-else-if="countError" role="alert">{{
          $t('system.interface.fastQueryCountFailed')
        }}</span>
        <span v-else-if="total === null">{{
          $t('system.interface.fastQueryTotalUnknown')
        }}</span>
        <span v-else
          >{{ $t('system.interface.fastQueryTotalLabel') }}：<strong>{{
            total.toLocaleString('en-US')
          }}</strong>
          {{ $t('system.interface.fastQueryTotalUnit') }}</span
        >
      </span>
      <Tooltip
        :trigger="['hover', 'focus', 'click']"
        :title="$t('system.interface.fastQueryHint')"
        ><Button
          type="text"
          size="middle"
          class="query-summary__help"
          :aria-label="$t('system.interface.fastQueryHelp')"
          ><template #icon><IconifyIcon icon="lucide:info" /></template></Button
      ></Tooltip>
      <Button
        v-if="countError || (hasLoaded && total === null && !countLoading)"
        class="query-summary__action"
        type="link"
        size="middle"
        :aria-label="$t('system.interface.fastQueryExactAction')"
        :loading="countLoading"
        :disabled="loading || !hasLoaded || countLoading"
        @click="requestCount"
        >{{ $t('system.interface.fastQueryExactAction') }}</Button
      >
    </div>
    <nav
      v-if="fastMode"
      class="query-pagination"
      :aria-label="$t('system.interface.fastQueryPagination')"
    >
      <Select
        size="middle"
        :value="pageSize"
        :disabled="loading"
        :aria-label="$t('system.interface.fastQueryPageSize')"
        :options="pageSizeOptions"
        @change="changePageSize"
      />
      <Button
        size="middle"
        :aria-label="$t('system.interface.fastQueryPrevious')"
        :disabled="loading || !hasLoaded || currentPage <= 1"
        @click="requestPage(-1)"
        ><template #icon><IconifyIcon icon="lucide:chevron-left" /></template
      ></Button>
      <span class="query-pagination__current" aria-current="page">{{
        $t('system.interface.fastQueryPage', [currentPage])
      }}</span>
      <Button
        size="middle"
        :aria-label="$t('system.interface.fastQueryNext')"
        :disabled="loading || !hasLoaded || !hasNext"
        @click="requestPage(1)"
        ><template #icon><IconifyIcon icon="lucide:chevron-right" /></template
      ></Button>
    </nav>
  </div>
</template>

<style scoped>
.fast-query-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 16px;
  padding: 12px 0 0;
  color: hsl(var(--muted-foreground));
  font-size: 14px;
}
.query-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.query-summary__value {
  font-variant-numeric: tabular-nums;
  line-height: 28px;
}
.query-summary__value strong {
  color: hsl(var(--foreground));
  font-weight: 500;
}
.query-summary__pending {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.query-summary__help {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  width: 24px;
  height: 24px;
  padding: 4px;
  color: hsl(var(--muted-foreground));
}
.query-summary__help svg,
.query-pagination svg {
  width: 14px;
  height: 14px;
  display: inline-block;
  vertical-align: middle;
}
.query-pagination {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  white-space: nowrap;
}
.query-pagination :deep(.ant-select) {
  width: 78px;
}
.query-pagination__current {
  min-width: 54px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
@media (max-width: 640px) {
  .query-summary {
    width: 100%;
  }
  .query-pagination {
    width: 100%;
    justify-content: flex-end;
  }
  .query-pagination :deep(.ant-select) {
    margin-right: auto;
  }
  .query-pagination :deep(.ant-btn) {
    min-width: 32px;
    min-height: 32px;
  }
}
</style>
