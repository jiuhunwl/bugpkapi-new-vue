<script setup lang="ts">
import type { InterfaceActionPermissions } from '../data';

import type { InterfaceApi } from '#/api/interface';

import { computed, shallowRef } from 'vue';

import { IconifyIcon, Plus } from '@vben/icons';

import {
  Button,
  Dropdown,
  Empty,
  Input,
  Menu,
  MenuItem,
  Pagination,
  Select,
  Spin,
  Tag,
} from 'ant-design-vue';

import { formatSettlementPrice } from '#/composables/use-settlement-currency';
import { $t } from '#/locales';

import { pollingModeText, requestMethodOptions } from '../data';
import { resolveMarketPrice } from '../market-price';

interface Props {
  canCreate: boolean;
  items: InterfaceApi.InterfaceItem[];
  loading: boolean;
  page: number;
  pageSize: number;
  permissions: InterfaceActionPermissions;
  total: number;
}

interface ActionItem {
  code: string;
  danger?: boolean;
  label: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  action: [code: string, item: InterfaceApi.InterfaceItem];
  batch: [operation: 'delete' | 'disable' | 'enable', ids: string[]];
  create: [];
  globalDeliveryPolicy: [];
  pageChange: [page: number, pageSize: number];
  reset: [];
  search: [];
}>();

const keyword = defineModel<string>('keyword', { default: '' });
const requestMethod = defineModel<InterfaceApi.RequestMethod | undefined>(
  'requestMethod',
);
const featured = defineModel<0 | 1 | undefined>('featured');
const status = defineModel<0 | 1 | undefined>('status');
const selectedIds = shallowRef(new Set<string>());

const featuredOptions = computed(() => [
  { label: $t('system.interface.featuredAction'), value: 1 },
  { label: $t('system.interface.unfeaturedAction'), value: 0 },
]);

const statusOptions = computed(() => [
  { label: $t('common.enabled'), value: 1 },
  { label: $t('common.disabled'), value: 0 },
]);

const actionItems = computed<ActionItem[]>(() =>
  [
    {
      code: 'billingRule',
      label: $t('system.interface.billingRule'),
      show: props.permissions.billing,
    },
    {
      code: 'polling',
      label: $t('interfaceSchema.polling.action'),
      show: props.permissions.polling,
    },
    {
      code: 'quota',
      label: $t('interfaceQuota.title'),
      show: props.permissions.quota,
    },
    {
      code: 'degrade',
      label: $t('interfaceDegrade.action'),
      show: props.permissions.degrade,
    },
    {
      code: 'requestValidation',
      label: $t('requestValidation.action'),
      show: props.permissions.requestValidation,
    },
    {
      code: 'doc',
      label: $t('interfaceSchema.doc.action'),
      show: props.permissions.doc,
    },
    {
      code: 'deliveryPolicy',
      label: $t('deliveryPolicy.title'),
      show: props.permissions.deliveryPolicy,
    },
    {
      code: 'edit',
      label: $t('common.edit'),
      show: props.permissions.update,
    },
    {
      code: 'delete',
      danger: true,
      label: $t('common.delete'),
      show: props.permissions.delete,
    },
  ]
    .filter((item) => item.show)
    .map(({ code, danger, label }) => ({ code, danger, label })),
);

function methodText(method: InterfaceApi.RequestMethod) {
  return method === 'GET_POST' ? 'GET/POST' : method;
}

function interfaceAvailable(item: InterfaceApi.InterfaceItem) {
  return Number(item.status) === 1;
}

function statusText(item: InterfaceApi.InterfaceItem) {
  return interfaceAvailable(item)
    ? $t('system.interface.statusNormal')
    : $t('system.interface.statusMaintenance');
}

function qpsText(item: InterfaceApi.InterfaceItem) {
  const value = Number(item.qpsLimit ?? 0);
  return value > 0 ? value.toLocaleString() : $t('system.interface.qpsUnlimited');
}

function pointText(value: number | string) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed.toLocaleString() : '0';
}

function marketPriceText(item: InterfaceApi.InterfaceItem) {
  const marketPrice = resolveMarketPrice(item.price, item.pointPrice);
  return marketPrice.free
    ? $t('system.interface.free')
    : formatSettlementPrice(marketPrice.moneyPrice, 4);
}

function marketPointText(item: InterfaceApi.InterfaceItem) {
  const marketPrice = resolveMarketPrice(item.price, item.pointPrice);
  return pointText(marketPrice.pointPrice);
}

function callCountText(value?: number | string) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed.toLocaleString() : '0';
}

function pollingText(item: InterfaceApi.InterfaceItem) {
  return Number(item.pollingEnabled ?? 0) === 1
    ? pollingModeText(item.pollingMode)
    : $t('common.disabled');
}

function onMenuClick(
  info: { key: number | string },
  item: InterfaceApi.InterfaceItem,
) {
  emit('action', String(info.key), item);
}

function toggleSelected(id: string, checked: boolean) {
  const next = new Set(selectedIds.value);
  if (checked) next.add(id);
  else next.delete(id);
  selectedIds.value = next;
}

function onCheckboxChange(id: string, event: Event) {
  toggleSelected(id, (event.target as HTMLInputElement).checked);
}

function emitBatch(operation: 'delete' | 'disable' | 'enable') {
  if (selectedIds.value.size === 0) return;
  emit('batch', operation, [...selectedIds.value]);
  selectedIds.value = new Set();
}
</script>

<template>
  <section class="responsive-interface-list" data-testid="interface-responsive-list">
    <header class="responsive-interface-list__header">
      <h1>{{ $t('system.interface.listTitle') }}</h1>
      <div class="responsive-interface-list__header-actions">
        <Button
          v-if="permissions.deliveryPolicy"
          @click="emit('globalDeliveryPolicy')"
        >
          <template #icon>
            <IconifyIcon icon="lucide:globe-2" />
          </template>
          {{ $t('deliveryPolicy.globalAction') }}
        </Button>
        <Button v-if="canCreate" type="primary" @click="emit('create')">
          <template #icon><Plus /></template>
          {{ $t('ui.actionTitle.create', [$t('system.interface.name')]) }}
        </Button>
        <template v-if="selectedIds.size > 0">
          <Button v-if="permissions.update" @click="emitBatch('enable')">
            {{ $t('system.interface.batchEnableSelected') }} ({{ selectedIds.size }})
          </Button>
          <Button v-if="permissions.update" @click="emitBatch('disable')">
            {{ $t('system.interface.batchDisableSelected') }} ({{ selectedIds.size }})
          </Button>
          <Button v-if="permissions.delete" danger @click="emitBatch('delete')">
            {{ $t('system.interface.batchDeleteSelected') }} ({{ selectedIds.size }})
          </Button>
        </template>
      </div>
    </header>

    <div class="responsive-interface-list__filters">
      <label class="responsive-interface-list__filter">
        <span>{{ $t('system.interface.keyword') }}</span>
        <Input
          v-model:value="keyword"
          allow-clear
          :placeholder="$t('system.interface.keywordPlaceholder')"
          @press-enter="emit('search')"
        />
      </label>
      <label class="responsive-interface-list__filter">
        <span>{{ $t('system.interface.requestMethod') }}</span>
        <Select
          v-model:value="requestMethod"
          allow-clear
          :options="requestMethodOptions"
          :placeholder="$t('ui.placeholder.select')"
        />
      </label>
      <label class="responsive-interface-list__filter">
        <span>{{ $t('system.interface.isFeatured') }}</span>
        <Select
          v-model:value="featured"
          allow-clear
          :options="featuredOptions"
          :placeholder="$t('ui.placeholder.select')"
        />
      </label>
      <label class="responsive-interface-list__filter">
        <span>{{ $t('system.interface.status') }}</span>
        <Select
          v-model:value="status"
          allow-clear
          :options="statusOptions"
          :placeholder="$t('ui.placeholder.select')"
        />
      </label>
      <div class="responsive-interface-list__filter-actions">
        <Button @click="emit('reset')">{{ $t('system.interface.reset') }}</Button>
        <Button type="primary" @click="emit('search')">
          {{ $t('system.interface.search') }}
        </Button>
      </div>
    </div>

    <Spin :spinning="loading">
      <div v-if="items.length > 0" class="responsive-interface-list__items">
        <article
          v-for="item in items"
          :key="item.id"
          class="responsive-interface-item"
          :class="{ 'is-maintenance': !interfaceAvailable(item) }"
          data-testid="interface-responsive-item"
        >
          <div class="responsive-interface-item__lead">
            <label
              class="responsive-interface-item__select"
              :title="$t('system.interface.selectInterfaceTitle', [item.id])"
            >
              <input
                type="checkbox"
                :checked="selectedIds.has(item.id)"
                @change="onCheckboxChange(item.id, $event)"
              />
            </label>
            <div class="responsive-interface-item__avatar">
              <img v-if="item.avatarUrl" :alt="item.name" :src="item.avatarUrl" />
              <IconifyIcon v-else icon="lucide:plug" />
            </div>
            <div class="responsive-interface-item__identity">
              <div class="responsive-interface-item__title-line">
                <h2 :title="item.name">{{ item.name }}</h2>
                <Tag :color="interfaceAvailable(item) ? 'success' : 'warning'">
                  {{ statusText(item) }}
                </Tag>
              </div>
              <span class="responsive-interface-item__id">ID {{ item.id }}</span>
              <code :title="item.apiCode">{{ item.apiCode }}</code>
            </div>
            <Dropdown v-if="actionItems.length > 0" :trigger="['click']">
              <Button
                :aria-label="$t('system.interface.operation')"
                :title="$t('system.interface.operation')"
                shape="circle"
                type="text"
              >
                <IconifyIcon icon="lucide:ellipsis" />
              </Button>
              <template #overlay>
                <Menu @click="onMenuClick($event, item)">
                  <MenuItem
                    v-for="action in actionItems"
                    :key="action.code"
                    :danger="action.danger"
                  >
                    {{ action.label }}
                  </MenuItem>
                </Menu>
              </template>
            </Dropdown>
          </div>

          <p class="responsive-interface-item__description">
            {{ item.remark || '-' }}
          </p>

          <div class="responsive-interface-item__endpoint">
            <span>{{ $t('system.interface.requestUrl') }}</span>
            <code :title="item.requestUrl">{{ item.requestUrl || '-' }}</code>
          </div>

          <dl class="responsive-interface-item__facts">
            <div>
              <dt>{{ $t('system.interface.requestMethod') }}</dt>
              <dd class="is-method">{{ methodText(item.requestMethod) }}</dd>
            </div>
            <div>
              <dt>{{ $t('system.interface.price') }}</dt>
              <dd>{{ marketPriceText(item) }}</dd>
            </div>
            <div>
              <dt>{{ $t('system.interface.pointPrice') }}</dt>
              <dd>{{ marketPointText(item) }}</dd>
            </div>
            <div>
              <dt>{{ $t('system.interface.qpsLimit') }}</dt>
              <dd>{{ qpsText(item) }}</dd>
            </div>
          </dl>

          <footer class="responsive-interface-item__footer">
            <div class="responsive-interface-item__tags">
              <Tag v-if="Number(item.isTop) === 1" color="processing">
                {{ $t('system.interface.topAction') }}
              </Tag>
              <Tag v-if="Number(item.isFeatured) === 1" color="success">
                {{ $t('system.interface.featuredAction') }}
              </Tag>
              <Tag>{{ pollingText(item) }}</Tag>
            </div>
            <span class="responsive-interface-item__calls">
              <IconifyIcon icon="lucide:activity" />
              {{ callCountText(item.callCount) }} {{ $t('system.interface.callUnit') }}
            </span>
          </footer>
        </article>
      </div>
      <div v-else class="responsive-interface-list__empty">
        <Empty />
      </div>
    </Spin>

    <div class="responsive-interface-list__pagination">
      <Pagination
        :current="page"
        :page-size="pageSize"
        :page-size-options="['8', '12', '20', '40']"
        show-size-changer
        :total="total"
        @change="(current, size) => emit('pageChange', current, size)"
        @show-size-change="(current, size) => emit('pageChange', current, size)"
      />
    </div>
  </section>
</template>

<style scoped>
.responsive-interface-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.responsive-interface-list__header {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
}

.responsive-interface-list__header h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  line-height: 28px;
  color: hsl(var(--foreground));
}

.responsive-interface-list__header-actions,
.responsive-interface-list__filter-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.responsive-interface-list__filters {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding: 16px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.responsive-interface-list__filter {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 0;
}

.responsive-interface-list__filter > span {
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
}

.responsive-interface-list__filter :deep(.ant-select) {
  width: 100%;
}

.responsive-interface-list__filter-actions {
  grid-column: 1 / -1;
  justify-content: flex-end;
}

.responsive-interface-list__items {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.responsive-interface-item {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  min-height: 330px;
  padding: 16px 16px 14px 18px;
  overflow: hidden;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.responsive-interface-item::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  content: '';
  background: #22c55e;
}

.responsive-interface-item.is-maintenance::before {
  background: #f59e0b;
}

.responsive-interface-item__lead {
  display: grid;
  grid-template-columns: 22px 48px minmax(0, 1fr) 32px;
  gap: 12px;
  align-items: center;
  min-width: 0;
}

.responsive-interface-item__select {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.responsive-interface-item__select input {
  width: 16px;
  height: 16px;
  accent-color: hsl(var(--primary));
}

.responsive-interface-item__avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  overflow: hidden;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
  border-radius: 8px;
}

.responsive-interface-item__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.responsive-interface-item__avatar svg {
  width: 22px;
  height: 22px;
}

.responsive-interface-item__identity,
.responsive-interface-item__title-line {
  min-width: 0;
}

.responsive-interface-item__title-line {
  display: flex;
  gap: 8px;
  align-items: center;
}

.responsive-interface-item__title-line h2 {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 16px;
  font-weight: 750;
  line-height: 23px;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.responsive-interface-item__title-line :deep(.ant-tag) {
  flex: 0 0 auto;
  margin-inline-end: 0;
}

.responsive-interface-item__identity > code {
  display: block;
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.responsive-interface-item__id {
  display: inline-block;
  margin-top: 4px;
  color: hsl(var(--muted-foreground));
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
}

.responsive-interface-item__id + code {
  margin-top: 2px;
}

.responsive-interface-item__description {
  display: -webkit-box;
  min-height: 42px;
  margin: 0;
  overflow: hidden;
  -webkit-line-clamp: 2;
  font-size: 13px;
  line-height: 21px;
  color: hsl(var(--muted-foreground));
  -webkit-box-orient: vertical;
}

.responsive-interface-item__endpoint {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding: 10px 12px;
  background: hsl(var(--muted) / 55%);
  border-radius: 6px;
}

.responsive-interface-item__endpoint span {
  font-size: 11px;
  font-weight: 700;
  color: hsl(var(--muted-foreground));
  text-transform: uppercase;
}

.responsive-interface-item__endpoint code {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.responsive-interface-item__facts {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
  margin: 0;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.responsive-interface-item__facts > div {
  min-width: 0;
  padding: 9px 8px;
  border-right: 1px solid hsl(var(--border));
}

.responsive-interface-item__facts > div:last-child {
  border-right: 0;
}

.responsive-interface-item__facts dt {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.responsive-interface-item__facts dd {
  margin: 4px 0 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  font-weight: 700;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.responsive-interface-item__facts dd.is-method {
  color: #2563eb;
}

.responsive-interface-item__footer {
  display: flex;
  gap: 10px;
  align-items: flex-end;
  justify-content: space-between;
  min-width: 0;
  margin-top: auto;
}

.responsive-interface-item__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}

.responsive-interface-item__tags :deep(.ant-tag) {
  margin-inline-end: 0;
}

.responsive-interface-item__calls {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 5px;
  align-items: center;
  font-size: 12px;
  font-weight: 700;
  color: hsl(var(--muted-foreground));
}

.responsive-interface-list__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 320px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.responsive-interface-list__pagination {
  display: flex;
  justify-content: flex-end;
  padding: 2px 0 8px;
}

@media (max-width: 760px) {
  .responsive-interface-list__header {
    align-items: flex-start;
  }

  .responsive-interface-list__header-actions {
    justify-content: flex-end;
  }

  .responsive-interface-list__filters,
  .responsive-interface-list__items {
    grid-template-columns: minmax(0, 1fr);
  }

  .responsive-interface-list__filter-actions {
    grid-column: auto;
  }
}

@media (max-width: 520px) {
  .responsive-interface-list__header {
    flex-direction: column;
  }

  .responsive-interface-list__header-actions,
  .responsive-interface-list__header-actions :deep(.ant-btn) {
    width: 100%;
  }

  .responsive-interface-list__filter-actions :deep(.ant-btn) {
    flex: 1 1 0;
  }

  .responsive-interface-item__facts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .responsive-interface-item__facts > div:nth-child(2) {
    border-right: 0;
  }

  .responsive-interface-item__facts > div:nth-child(-n + 2) {
    border-bottom: 1px solid hsl(var(--border));
  }

  .responsive-interface-item__footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
