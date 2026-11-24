<script setup lang="ts">
import type { TableColumnsType } from 'ant-design-vue';

import type { PackageApi } from '#/api/package';
import type { QuotaApi } from '#/api/quota';

import { computed } from 'vue';

import { Button, Card, Table, Tag } from 'ant-design-vue';

import { useSettlementCurrency } from '#/composables/use-settlement-currency';
import { $t } from '#/locales';

const props = defineProps<{
  items: readonly PackageApi.UserPackage[];
  loading: boolean;
  paid?: QuotaApi.PaidUsage;
}>();

const emit = defineEmits<{
  (
    event: 'set-primary',
    scope: PackageApi.UserPackage['scope'],
    id: number,
  ): void;
}>();

const dataSource = computed(() => [...props.items]);

const columns = computed<TableColumnsType>(() => [
  { dataIndex: 'name', key: 'name', title: $t('system.package.assets.packageName') },
  { dataIndex: 'scope', key: 'scope', title: $t('system.package.assets.scope') },
  { dataIndex: 'dailyLimit', key: 'dailyLimit', title: $t('system.package.assets.dailyUsage') },
  { dataIndex: 'totalUsage', key: 'totalUsage', title: $t('system.package.assets.totalUsage') },
  { dataIndex: 'remaining', key: 'remaining', title: $t('system.package.assets.packageRemaining') },
  { dataIndex: 'qpsLimit', key: 'qpsLimit', title: $t('system.package.assets.qps') },
  { dataIndex: 'remainDays', key: 'remainDays', title: $t('system.package.assets.remainDays'), width: 120 },
  { dataIndex: 'endAt', key: 'endAt', title: $t('system.package.assets.endAt') },
  {
    dataIndex: 'isPrimary',
    key: 'primary',
    title: $t('system.package.assets.primary'),
    width: 160,
  },
]);

// 剩余额度取「日剩余与总剩余中更紧的」：任一上限打满即不可再扣，
// 与网关的裁决一致。两边都不限时（-1）才显示「不限」。
function remainingText(item: Record<string, any>) {
  const dailyLeft =
    item.dailyLimit > 0 ? Math.max(0, item.dailyLimit - item.usedToday) : null;
  const totalLimit = Number(item.totalLimit ?? 0);
  const totalLeft =
    totalLimit > 0
      ? Math.max(0, totalLimit - Number(item.totalUsed ?? 0))
      : null;
  if (dailyLeft === null && totalLeft === null) {
    return $t('system.package.unlimited');
  }
  if (dailyLeft === null) {
    return (totalLeft as number).toLocaleString();
  }
  if (totalLeft === null) {
    return dailyLeft.toLocaleString();
  }
  return Math.min(dailyLeft, totalLeft).toLocaleString();
}

function remainingExhausted(item: Record<string, any>) {
  const dailyOut = item.dailyLimit > 0 && item.usedToday >= item.dailyLimit;
  const totalLimit = Number(item.totalLimit ?? 0);
  const totalOut = totalLimit > 0 && Number(item.totalUsed ?? 0) >= totalLimit;
  return dailyOut || totalOut;
}

// 余额为人民币基数，USD 站点按汇率换算展示（与商城价格口径一致）。
const { fromCNY, symbol } = useSettlementCurrency();

function balanceText() {
  const value = fromCNY(Number(props.paid?.balance ?? 0));
  return Number.isFinite(value) ? value.toFixed(2) : '0.00';
}

function quotaText(item: Record<string, any>) {
  if (item.dailyLimit === 0) {
    return $t('system.package.unlimited');
  }
  return `${item.usedToday.toLocaleString()} / ${item.dailyLimit.toLocaleString()}`;
}

function totalUsageText(item: Record<string, any>) {
  const totalLimit = Number(item.totalLimit ?? 0);
  if (totalLimit === 0) {
    return $t('system.package.unlimited');
  }
  return `${Number(item.totalUsed ?? 0).toLocaleString()} / ${totalLimit.toLocaleString()}`;
}

// 后端返回的 id 形如 "GLOBAL:12"，提交主套餐只需要数字主键。
function numericId(item: Record<string, any>) {
  const value = Number(String(item.id ?? '').split(':')[1] ?? 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function togglePrimary(item: Record<string, any>) {
  const id = numericId(item);
  if (id === 0) {
    return;
  }
  // 已设为主套餐则传 0 取消，回到「快到期的、高配的」默认扣减顺序。
  emit('set-primary', item.scope, item.isPrimary ? 0 : id);
}

// 剩余天数由后端算好（向上取整），这里只负责展示；老接口没这个字段时回退到
// 用 endAt 估算，避免刷新瞬间显示空白。
function remainDaysText(item: Record<string, any>) {
  const days = Number(item.remainDays ?? 0);
  if (Number.isFinite(days) && days > 0) {
    return days === 1
      ? $t('system.package.assets.remainOneDay')
      : `${days} ${$t('system.package.assets.remainDaysUnit')}`;
  }
  return $t('system.package.assets.remainExpired');
}

const EXPIRING_THRESHOLD_DAYS = 7;

// 到期前 7 天内提示续费；renewal_enabled=0 的套餐续费也是新建一条，
// 不该被催「续费」，所以这里一并要求 renewable。
function isExpiring(item: Record<string, any>) {
  const days = Number(item.remainDays ?? 0);
  return (
    item.renewable === true &&
    Number.isFinite(days) &&
    days > 0 &&
    days <= EXPIRING_THRESHOLD_DAYS
  );
}
</script>

<template>
  <Card class="asset-panel">
    <template #title>
      {{ $t('system.package.assets.paidQuotaTitle') }}
    </template>
    <template #extra>
      <div v-if="paid" class="asset-panel__wallet">
        <span>
          {{ $t('system.package.assets.paidPoints') }} ·
          {{ paid.points.toLocaleString() }}
        </span>
        <span>
          {{ $t('system.package.assets.paidBalance') }} · {{ symbol }}{{ balanceText() }}
        </span>
        <Tag :color="paid.available ? 'green' : 'default'">
          {{
            paid.available
              ? $t('system.package.assets.paidAvailable')
              : $t('system.package.assets.paidUnavailable')
          }}
        </Tag>
      </div>
    </template>
    <p class="asset-panel__hint">
      {{ $t('system.package.assets.paidQuotaHint') }}
    </p>
    <p class="asset-panel__hint">
      {{ $t('system.package.assets.primaryHint') }}
    </p>
    <Table
      :columns="columns"
      :data-source="dataSource"
      :loading="loading"
      :pagination="false"
      row-key="id"
      :scroll="{ x: 880 }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'scope'">
          <Tag :color="record.scope === 'GLOBAL' ? 'blue' : 'cyan'">
            {{
              record.scope === 'GLOBAL'
                ? $t('system.package.assets.globalScope')
                : $t('system.package.assets.interfaceScope')
            }}
          </Tag>
        </template>
        <template v-else-if="column.key === 'dailyLimit'">
          {{ quotaText(record) }}
        </template>
        <template v-else-if="column.key === 'totalUsage'">
          {{ totalUsageText(record) }}
        </template>
        <template v-else-if="column.key === 'remaining'">
          <span :class="{ 'asset-panel__exhausted': remainingExhausted(record) }">
            {{ remainingText(record) }}
          </span>
          <Tag
            v-if="remainingExhausted(record)"
            class="asset-panel__exhausted-tag"
            color="red"
          >
            {{ $t('system.package.assets.packageExhausted') }}
          </Tag>
        </template>
        <template v-else-if="column.key === 'qpsLimit'">
          {{
            record.qpsLimit === 0
              ? $t('system.package.unlimited')
              : record.qpsLimit.toLocaleString()
          }}
        </template>
        <template v-else-if="column.key === 'remainDays'">
          <!-- 剩 7 天内标红提示：这是续费的唯一触发点，用户在到期前后才想起来。 -->
          <span :class="{ 'asset-panel__expiring': isExpiring(record) }">
            {{ remainDaysText(record) }}
          </span>
          <Tag v-if="isExpiring(record)" color="orange">
            {{ $t('system.package.assets.expiringSoon') }}
          </Tag>
        </template>
        <template v-else-if="column.key === 'primary'">
          <div class="asset-panel__primary">
            <Tag v-if="record.isPrimary" color="gold">
              {{ $t('system.package.assets.primaryBadge') }}
            </Tag>
            <Button
              size="small"
              type="link"
              :disabled="numericId(record) === 0"
              @click="togglePrimary(record)"
            >
              {{
                record.isPrimary
                  ? $t('system.package.assets.clearPrimary')
                  : $t('system.package.assets.setPrimary')
              }}
            </Button>
          </div>
        </template>
      </template>
    </Table>
  </Card>
</template>

<style scoped>
.asset-panel {
  background: hsl(var(--card));
  border-color: hsl(var(--border));
  border-radius: 8px;
}

.asset-panel__hint {
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 1.6;
  color: hsl(var(--muted-foreground));
}

.asset-panel__primary {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.asset-panel__wallet {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  font-size: 12px;
  font-weight: 400;
  color: hsl(var(--muted-foreground));
}

.asset-panel__exhausted {
  color: hsl(var(--destructive));
}

.asset-panel__exhausted-tag {
  margin-left: 6px;
}

/* 临期用警示色而非错误色：权益还在生效，只是该续了。 */
.asset-panel__expiring {
  font-weight: 600;
  color: hsl(var(--primary));
}
</style>
