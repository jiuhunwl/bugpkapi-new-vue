<script lang="ts" setup>
import type { InterfaceActionPermissions } from './data';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { InterfaceApi } from '#/api/interface';

import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  shallowRef,
  watch,
} from 'vue';
import { useRouter } from 'vue-router';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { IconifyIcon, Plus } from '@vben/icons';
import { useAccessStore, useUserStore } from '@vben/stores';

import { useMediaQuery } from '@vueuse/core';
import {
  Button,
  Empty,
  Input,
  message,
  Modal,
  Pagination,
  Select,
  Spin,
  Tag,
} from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  batchDeleteInterfaces,
  batchUpdateInterfaceStatus,
  deleteInterface,
  getInterfaceList,
} from '#/api/interface';
import { getMarketApis } from '#/api/market';
import { formatSettlementPrice } from '#/composables/use-settlement-currency';
import { $t } from '#/locales';

import { requestMethodOptions, useColumns, useGridFormSchema } from './data';
import { resolveMarketPrice } from './market-price';
import BillingRule from './modules/billing-rule.vue';
import Degrade from './modules/degrade.vue';
import DeliveryPolicy from './modules/delivery-policy.vue';
import DocConfig from './modules/doc.vue';
import Form from './modules/form.vue';
import InterfaceResponsiveList from './modules/InterfaceResponsiveList.vue';
import PollingConfig from './modules/polling.vue';
import Quota from './modules/quota.vue';
import RequestValidation from './modules/request-validation.vue';

const userStore = useUserStore();
const accessStore = useAccessStore();
const router = useRouter();
const isAdmin = computed(() => userStore.userRoles.includes('admin'));
const hasCode = (code: string) =>
  isAdmin.value || accessStore.accessCodes.includes(code);
const canList = computed(() => hasCode('interface:list'));
const canCreate = computed(() => hasCode('interface:create'));
const compactAdminViewport = useMediaQuery('(max-width: 1199px)');
const actionPermissions = computed<InterfaceActionPermissions>(() => ({
  billing: hasCode('interface:billing'),
  degrade: hasCode('interface:update'),
  delete: hasCode('interface:delete'),
  deliveryPolicy: hasCode('interface:delivery-policy'),
  doc: hasCode('interface:doc'),
  polling: hasCode('interface:polling'),
  quota: hasCode('interface:update'),
  requestValidation: hasCode('interface:request-validation'),
  update: hasCode('interface:update'),
}));
const cardLoading = ref(false);
const deletingIds = ref(new Set<string>());
const interfaceCards = ref<InterfaceApi.InterfaceItem[]>([]);
// 桌面端表格的错误态：替代"无限 Spin"——失败时显示错误提示与重试按钮
const gridLoadingError = ref('');
// 当前列表请求的 AbortController：切换筛选/分页/卸载时取消在途请求，避免并发叠加把后端打满
let gridQueryAbort: AbortController | undefined;
const cardFilters = reactive<{
  keyword: string;
  requestMethod?: InterfaceApi.RequestMethod;
}>({
  keyword: '',
  requestMethod: undefined,
});
const cardPagination = reactive({
  current: 1,
  pageSize: 18,
  total: 0,
});
const adminCompactLoading = shallowRef(false);
const adminCompactItems = ref<InterfaceApi.InterfaceItem[]>([]);
const adminCompactFilters = reactive<{
  isFeatured?: 0 | 1;
  keyword: string;
  requestMethod?: InterfaceApi.RequestMethod;
  status?: 0 | 1;
}>({
  isFeatured: undefined,
  keyword: '',
  requestMethod: undefined,
  status: undefined,
});
const adminCompactPagination = reactive({
  current: 1,
  pageSize: 12,
  total: 0,
});

interface FormSuccessPayload {
  mode: 'create' | 'update';
  record?: InterfaceApi.InterfaceItem;
}

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [BillingRuleDrawer, billingRuleDrawerApi] = useVbenDrawer({
  connectedComponent: BillingRule,
  destroyOnClose: true,
});

const [DocDrawer, docDrawerApi] = useVbenDrawer({
  connectedComponent: DocConfig,
  destroyOnClose: true,
});

const [DeliveryPolicyDrawer, deliveryPolicyDrawerApi] = useVbenDrawer({
  connectedComponent: DeliveryPolicy,
  destroyOnClose: true,
});

const [PollingDrawer, pollingDrawerApi] = useVbenDrawer({
  connectedComponent: PollingConfig,
  destroyOnClose: true,
});

const [RequestValidationDrawer, requestValidationDrawerApi] = useVbenDrawer({
  connectedComponent: RequestValidation,
  destroyOnClose: true,
});

const [QuotaDrawer, quotaDrawerApi] = useVbenDrawer({
  connectedComponent: Quota,
  destroyOnClose: true,
});

const [DegradeDrawer, degradeDrawerApi] = useVbenDrawer({
  connectedComponent: Degrade,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(canList.value),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(onActionClick, actionPermissions.value),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      // 改为函数：避免 setup 期权限码未就绪导致永不加载；
      // 实际触发由下方 watch([canList]) 显式调用 gridApi.query() 控制
      autoLoad: false,
      ajax: {
        query: async ({ page }, formValues) => {
          if (!canList.value) {
            return { items: [], total: 0 };
          }
          // 取消上一次在途请求，避免叠加
          gridQueryAbort?.abort();
          gridQueryAbort = new AbortController();
          gridLoadingError.value = '';
          try {
            return await getInterfaceList(
              {
                page: page.currentPage,
                pageSize: page.pageSize,
                ...formValues,
              },
              gridQueryAbort.signal,
            );
          } catch (error: any) {
            // 被取消的请求不作为错误展示（用户已发起新请求或离开页面）
            if (
              error?.name === 'CanceledError' ||
              error?.code === 'ERR_CANCELED'
            ) {
              return { items: [], total: 0 };
            }
            // 失败时给出明确错误态，替代无限 Spin
            const backendMsg =
              error?.response?.data?.message ?? error?.message ?? '';
            gridLoadingError.value =
              backendMsg || $t('system.interface.loadFailed');
            // 返回空结果让 vxe-grid 停止 loading 态
            return { items: [], total: 0 };
          }
        },
      },
    },
    rowConfig: {
      keyField: 'id',
    },
    checkboxConfig: {
      reserve: true,
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<InterfaceApi.InterfaceItem>,
});

function onActionClick({
  code,
  row,
}: OnActionClickParams<InterfaceApi.InterfaceItem>) {
  switch (code) {
    case 'billingRule': {
      onBillingRule(row);
      break;
    }
    case 'delete': {
      onDelete(row);
      break;
    }
    case 'degrade': {
      onDegrade(row);
      break;
    }
    case 'deliveryPolicy': {
      onDeliveryPolicy(row);
      break;
    }
    case 'doc': {
      onDocConfig(row);
      break;
    }
    case 'edit': {
      onEdit(row);
      break;
    }
    case 'polling': {
      onPollingConfig(row);
      break;
    }
    case 'quota': {
      onQuota(row);
      break;
    }
    case 'requestValidation': {
      onRequestValidation(row);
      break;
    }
  }
}

function onCreate() {
  if (!canCreate.value) return;
  formDrawerApi.setData({}).open();
}

function onEdit(row: InterfaceApi.InterfaceItem) {
  if (!actionPermissions.value.update) return;
  formDrawerApi.setData(row).open();
}

function onBillingRule(row: InterfaceApi.InterfaceItem) {
  if (!actionPermissions.value.billing) return;
  billingRuleDrawerApi.setData(row).open();
}

function onDocConfig(row: InterfaceApi.InterfaceItem) {
  if (!actionPermissions.value.doc) return;
  docDrawerApi.setData(row).open();
}

function onDeliveryPolicy(row: InterfaceApi.InterfaceItem) {
  if (!actionPermissions.value.deliveryPolicy) return;
  deliveryPolicyDrawerApi.setData(row).open();
}

function onGlobalDeliveryPolicy() {
  if (!actionPermissions.value.deliveryPolicy) return;
  deliveryPolicyDrawerApi
    .setData({ scope: 'GLOBAL', name: $t('deliveryPolicy.globalName') })
    .open();
}

function onPollingConfig(row: InterfaceApi.InterfaceItem) {
  if (!actionPermissions.value.polling) return;
  pollingDrawerApi.setData(row).open();
}

function onRequestValidation(row: InterfaceApi.InterfaceItem) {
  if (!actionPermissions.value.requestValidation) return;
  requestValidationDrawerApi.setData(row).open();
}

function onQuota(row: InterfaceApi.InterfaceItem) {
  if (!actionPermissions.value.quota) return;
  quotaDrawerApi.setData(row).open();
}

function onDegrade(row: InterfaceApi.InterfaceItem) {
  if (!actionPermissions.value.degrade) return;
  degradeDrawerApi.setData(row).open();
}

function onDelete(row: InterfaceApi.InterfaceItem) {
  if (!actionPermissions.value.delete) return;
  Modal.confirm({
    title: $t('interfaceList.delete.title'),
    content: $t('interfaceList.delete.description', [row.name]),
    okText: $t('interfaceList.delete.action'),
    okType: 'danger',
    onOk: async () => {
      if (deletingIds.value.has(row.id)) return;
      deletingIds.value.add(row.id);
      try {
        await deleteInterface(row.id);
        message.success($t('ui.actionMessage.deleteSuccess', [row.name]));
        await onRefresh();
      } finally {
        deletingIds.value.delete(row.id);
      }
    },
  });
}

function selectedGridRows() {
  return ((gridApi.grid as any)?.getCheckboxRecords?.() ??
    []) as InterfaceApi.InterfaceItem[];
}

function clearGridSelection() {
  (gridApi.grid as any)?.clearCheckboxRow?.();
  (gridApi.grid as any)?.clearCheckboxReserve?.();
}

function onBatchStatus(status: 0 | 1) {
  if (!actionPermissions.value.update) return;
  const ids = selectedGridRows().map((row) => String(row.id));
  if (!ids.length) {
    message.warning($t('system.interface.batchSelectFirst'));
    return;
  }
  Modal.confirm({
    content: $t(
      status === 1
        ? 'system.interface.batchEnableConfirm'
        : 'system.interface.batchDisableConfirm',
      [ids.length],
    ),
    onOk: async () => {
      await batchUpdateInterfaceStatus(ids, status);
      clearGridSelection();
      message.success($t('system.interface.batchStatusSuccess'));
      await onRefresh();
    },
    title: $t('system.interface.batchStatusTitle'),
  });
}

function onBatchDelete() {
  if (!actionPermissions.value.delete) return;
  const rows = selectedGridRows();
  const ids = rows.map((row) => String(row.id));
  if (!ids.length) {
    message.warning($t('system.interface.batchSelectFirst'));
    return;
  }
  Modal.confirm({
    content: $t('system.interface.batchDeleteConfirm', [ids.length]),
    okType: 'danger',
    onOk: async () => {
      await batchDeleteInterfaces(ids);
      clearGridSelection();
      message.success($t('system.interface.batchDeleteSuccess'));
      await onRefresh();
    },
    title: $t('system.interface.batchDeleteTitle'),
  });
}

async function onRefresh() {
  if (canList.value) {
    if (compactAdminViewport.value) {
      await queryAdminCompact(adminCompactPagination.current);
    } else {
      gridLoadingError.value = '';
      await gridApi.query();
    }
    return;
  }
  await queryCards(cardPagination.current);
}

/** 手动重试：清掉错误态再触发查询 */
async function onRetryGrid() {
  gridLoadingError.value = '';
  await gridApi.query();
}

async function queryAdminCompact(page = 1) {
  if (!canList.value || !compactAdminViewport.value) return;
  adminCompactLoading.value = true;
  try {
    const result = await getInterfaceList({
      isFeatured: adminCompactFilters.isFeatured,
      keyword: adminCompactFilters.keyword,
      page,
      pageSize: adminCompactPagination.pageSize,
      requestMethod: adminCompactFilters.requestMethod,
      status: adminCompactFilters.status,
    });
    adminCompactItems.value = result.items ?? [];
    adminCompactPagination.current = page;
    adminCompactPagination.total = Number(result.total) || 0;
  } finally {
    adminCompactLoading.value = false;
  }
}

function onAdminCompactSearch() {
  queryAdminCompact(1);
}

function onAdminCompactReset() {
  adminCompactFilters.keyword = '';
  adminCompactFilters.requestMethod = undefined;
  adminCompactFilters.isFeatured = undefined;
  adminCompactFilters.status = undefined;
  queryAdminCompact(1);
}

function onAdminCompactPageChange(page: number, pageSize: number) {
  adminCompactPagination.pageSize = pageSize;
  queryAdminCompact(page);
}

function onAdminCompactAction(code: string, row: InterfaceApi.InterfaceItem) {
  onActionClick({ code, row });
}

function onAdminCompactBatch(
  operation: 'delete' | 'disable' | 'enable',
  ids: string[],
) {
  const status = operation === 'enable' ? 1 : 0;
  if (operation !== 'delete' && !actionPermissions.value.update) return;
  if (operation === 'delete' && !actionPermissions.value.delete) return;
  Modal.confirm({
    content:
      operation === 'delete'
        ? $t('system.interface.batchDeleteSimpleConfirm', [ids.length])
        : $t(
            status === 1
              ? 'system.interface.batchEnableConfirm'
              : 'system.interface.batchDisableConfirm',
            [ids.length],
          ),
    okType: operation === 'delete' ? 'danger' : 'primary',
    onOk: async () => {
      if (operation === 'delete') {
        await batchDeleteInterfaces(ids);
      } else {
        await batchUpdateInterfaceStatus(ids, status);
      }
      message.success($t('system.interface.batchOperationSuccess'));
      await onRefresh();
    },
    title:
      operation === 'delete'
        ? $t('system.interface.batchDeleteTitle')
        : $t('system.interface.batchStatusTitle'),
  });
}

function onFormSuccess(payload?: FormSuccessPayload) {
  onRefresh();
  const record = payload?.record;
  if (payload?.mode !== 'create' || !record?.id) return;
  if (!actionPermissions.value.billing) return;

  Modal.confirm({
    cancelText: $t('interfaceList.billingPrompt.cancel'),
    content: $t('interfaceList.billingPrompt.description'),
    okText: $t('interfaceList.billingPrompt.action'),
    onOk: () => {
      billingRuleDrawerApi.setData(record).open();
    },
    title: $t('interfaceList.billingPrompt.title'),
  });
}

async function queryCards(page = 1) {
  cardLoading.value = true;
  try {
    const result = await getMarketApis({
      keyword: cardFilters.keyword,
      page,
      pageSize: cardPagination.pageSize,
      requestMethod: cardFilters.requestMethod,
    });
    interfaceCards.value = result.items.map((item) => ({
      ...item,
      apiCode: item.apiCode ?? '',
      remark: item.description,
      requestUrl: '',
      status: 1,
    }));
    cardPagination.current = page;
    cardPagination.total = result.total;
  } finally {
    cardLoading.value = false;
  }
}

function goDoc(item: InterfaceApi.InterfaceItem) {
  router.push({ name: 'ApiDocs', params: { id: item.id } });
}

function onCardSearch() {
  queryCards(1);
}

function onCardReset() {
  cardFilters.keyword = '';
  cardFilters.requestMethod = undefined;
  queryCards(1);
}

function onCardPageChange(page: number, pageSize: number) {
  cardPagination.pageSize = pageSize;
  queryCards(page);
}

function methodText(method: InterfaceApi.RequestMethod) {
  return method === 'GET_POST' ? 'GET/POST' : method;
}

function priceText(item: InterfaceApi.InterfaceItem) {
  return resolveMarketPrice(item.price, item.pointPrice).free
    ? $t('system.interface.free')
    : $t('system.interface.paid');
}

function priceTagColor(item: InterfaceApi.InterfaceItem) {
  return resolveMarketPrice(item.price, item.pointPrice).free
    ? 'green'
    : 'gold';
}

function singleCallPriceText(price: number | string) {
  return $t('system.interface.singleCallPrice', [
    formatSettlementPrice(price, 4),
  ]);
}

function pointText(pointPrice: number | string) {
  return $t('system.interface.singleCallPoint', [
    Number(pointPrice ?? 0).toLocaleString(),
  ]);
}

function singleCallCostText(item: InterfaceApi.InterfaceItem) {
  const price = resolveMarketPrice(item.price, item.pointPrice);
  if (price.free) {
    return $t('system.interface.free');
  }
  const costs: string[] = [];
  if (price.moneyPrice > 0) {
    costs.push(singleCallPriceText(price.moneyPrice));
  }
  if (price.pointPrice > 0) {
    costs.push(pointText(price.pointPrice));
  }
  return costs.join(' / ');
}

function interfaceAvailable(item: InterfaceApi.InterfaceItem) {
  return Number(item.status) === 1;
}

function interfaceStatusText(item: InterfaceApi.InterfaceItem) {
  return interfaceAvailable(item)
    ? $t('system.interface.statusNormal')
    : $t('system.interface.statusMaintenance');
}

onMounted(() => {
  if (canList.value && !compactAdminViewport.value) {
    // 桌面表格：显式触发首次查询（autoLoad 已改为 false）
    gridApi.query();
  } else if (!canList.value) {
    queryCards();
  }
});

onBeforeUnmount(() => {
  // 离开页面时取消在途请求，防 stale 回写与后端叠加
  gridQueryAbort?.abort();
});

watch(
  [canList, compactAdminViewport],
  ([allowed, compact]) => {
    if (allowed && compact && adminCompactItems.value.length === 0) {
      queryAdminCompact();
    } else if (allowed && !compact && !gridApi.grid) {
      // 桌面表格尚未挂载时，等下个 tick 再触发；已挂载则由 vxe-grid 自身处理
      gridApi.query();
    } else if (!allowed && interfaceCards.value.length === 0) {
      queryCards();
    }
  },
  { immediate: true },
);
</script>

<template>
  <Page
    auto-content-height
    content-class="interface-list-page"
    :title="canList ? undefined : $t('system.interface.listTitle')"
  >
    <FormDrawer @success="onFormSuccess" />
    <BillingRuleDrawer @success="onRefresh" />
    <DocDrawer @success="onRefresh" />
    <DeliveryPolicyDrawer @success="onRefresh" />
    <PollingDrawer @success="onRefresh" />
    <RequestValidationDrawer @success="onRefresh" />
    <QuotaDrawer @success="onRefresh" />
    <DegradeDrawer @success="onRefresh" />
    <InterfaceResponsiveList
      v-if="canList && compactAdminViewport"
      v-model:featured="adminCompactFilters.isFeatured"
      v-model:keyword="adminCompactFilters.keyword"
      v-model:request-method="adminCompactFilters.requestMethod"
      v-model:status="adminCompactFilters.status"
      :can-create="canCreate"
      :items="adminCompactItems"
      :loading="adminCompactLoading"
      :page="adminCompactPagination.current"
      :page-size="adminCompactPagination.pageSize"
      :permissions="actionPermissions"
      :total="adminCompactPagination.total"
      @action="onAdminCompactAction"
      @batch="onAdminCompactBatch"
      @create="onCreate"
      @global-delivery-policy="onGlobalDeliveryPolicy"
      @page-change="onAdminCompactPageChange"
      @reset="onAdminCompactReset"
      @search="onAdminCompactSearch"
    />
    <Grid v-else-if="canList" :table-title="$t('system.interface.listTitle')">
      <template #toolbar-tools>
        <Button v-if="actionPermissions.update" @click="onBatchStatus(1)">
          {{ $t('system.interface.batchEnableSelected') }}
        </Button>
        <Button v-if="actionPermissions.update" @click="onBatchStatus(0)">
          {{ $t('system.interface.batchDisableSelected') }}
        </Button>
        <Button v-if="actionPermissions.delete" danger @click="onBatchDelete">
          {{ $t('system.interface.batchDeleteTitle') }}
        </Button>
        <Button
          v-if="actionPermissions.deliveryPolicy"
          @click="onGlobalDeliveryPolicy"
        >
          <IconifyIcon class="size-5" icon="lucide:globe-2" />
          {{ $t('deliveryPolicy.globalAction') }}
        </Button>
        <Button v-if="canCreate" type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('system.interface.name')]) }}
        </Button>
      </template>
    </Grid>
    <div
      v-if="canList && !compactAdminViewport && gridLoadingError"
      class="interface-list-error"
      role="alert"
    >
      <IconifyIcon class="size-4" icon="lucide:alert-triangle" />
      <span>{{ gridLoadingError }}</span>
      <Button size="small" type="primary" @click="onRetryGrid">
        {{ $t('system.interface.retry') }}
      </Button>
    </div>
    <div v-if="!canList" class="interface-market">
      <div class="interface-market__filter">
        <div class="interface-market__filter-item">
          <span>{{ $t('system.interface.keyword') }}</span>
          <Input
            v-model:value="cardFilters.keyword"
            allow-clear
            :placeholder="$t('system.interface.keywordPlaceholder')"
            @press-enter="onCardSearch"
          />
        </div>
        <div class="interface-market__filter-item">
          <span>{{ $t('system.interface.requestMethod') }}</span>
          <Select
            v-model:value="cardFilters.requestMethod"
            allow-clear
            :options="requestMethodOptions"
            :placeholder="$t('ui.placeholder.select')"
          />
        </div>
        <div class="interface-market__filter-actions">
          <!-- eslint-disable vue/multiline-html-element-content-newline -->
          <Button @click="onCardReset">{{
            $t('system.interface.reset')
          }}</Button>
          <!-- eslint-enable vue/multiline-html-element-content-newline -->
          <Button type="primary" @click="onCardSearch">
            {{ $t('system.interface.search') }}
          </Button>
        </div>
      </div>

      <Spin :spinning="cardLoading">
        <div v-if="interfaceCards.length > 0" class="interface-card-grid">
          <div
            v-for="item in interfaceCards"
            :key="item.id"
            class="interface-card"
            @click="goDoc(item)"
          >
            <span
              class="interface-card__status"
              :class="{ 'is-maintenance': !interfaceAvailable(item) }"
              :title="interfaceStatusText(item)"
              :aria-label="interfaceStatusText(item)"
            ></span>
            <div class="interface-card__tags">
              <Tag v-if="Number(item.isTop) === 1" color="processing">
                {{ $t('system.interface.topAction') }}
              </Tag>
              <Tag v-if="Number(item.isFeatured) === 1" color="success">
                {{ $t('system.interface.featuredAction') }}
              </Tag>
              <Tag :color="priceTagColor(item)">
                {{ priceText(item) }}
              </Tag>
            </div>

            <div class="interface-card__body">
              <div v-if="item.avatarUrl" class="interface-card__avatar">
                <img :alt="item.name" :src="item.avatarUrl" />
              </div>
              <div class="interface-card__content">
                <div class="interface-card__name">{{ item.name }}</div>
                <div class="interface-card__desc">
                  {{ item.remark || '' }}
                </div>
              </div>
            </div>

            <div class="interface-card__footer">
              <span class="interface-card__price">
                <IconifyIcon class="size-4" icon="lucide:coins" />
                {{ singleCallCostText(item) }}
              </span>
              <span class="interface-card__method">
                {{ methodText(item.requestMethod) }}
              </span>
            </div>
          </div>
        </div>
        <div v-else class="interface-market__empty">
          <Empty />
        </div>
      </Spin>

      <div class="interface-market__pagination">
        <Pagination
          :current="cardPagination.current"
          :page-size="cardPagination.pageSize"
          :page-size-options="['12', '18', '24', '36']"
          show-size-changer
          :total="cardPagination.total"
          @change="onCardPageChange"
          @show-size-change="onCardPageChange"
        />
      </div>
    </div>
  </Page>
</template>

<style scoped>
.interface-list-page {
  height: 100%;
}

.interface-list-error {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 10px 14px;
  margin: 8px 0;
  color: #b91c1c;
  background: rgb(239 68 68 / 8%);
  border: 1px solid rgb(239 68 68 / 18%);
  border-radius: 9px;
}

.interface-list-error span {
  flex: 1;
  font-size: 13px;
}

.interface-market {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 1440px;
  min-height: 100%;
  margin: 0 auto;
}

.interface-market__filter {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(180px, 280px) auto;
  gap: 16px;
  align-items: end;
  padding: 20px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 9px;
}

.interface-market__filter-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: hsl(var(--foreground));
}

.interface-market__filter-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.interface-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 18px;
}

.interface-card {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 210px;
  padding: 18px;
  overflow: hidden;
  color: inherit;
  text-align: left;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 9px;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.interface-card:hover {
  border-color: hsl(var(--primary) / 45%);
  box-shadow: 0 10px 26px hsl(var(--foreground) / 8%);
  transform: translateY(-2px);
}

.interface-card__status {
  position: absolute;
  top: 18px;
  right: 18px;
  z-index: 1;
  width: 10px;
  height: 10px;
  background: #22c55e;
  border-radius: 999px;
  box-shadow: 0 0 0 6px rgb(34 197 94 / 14%);
}

.interface-card__status::after {
  position: absolute;
  inset: -7px;
  content: '';
  background: rgb(34 197 94 / 22%);
  border-radius: inherit;
  animation: interface-status-pulse 1.8s ease-out infinite;
}

.interface-card__status.is-maintenance {
  background: #f59e0b;
  box-shadow: 0 0 0 6px rgb(245 158 11 / 16%);
}

.interface-card__status.is-maintenance::after {
  background: rgb(245 158 11 / 24%);
}

.interface-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 28px;
  padding-right: 26px;
}

.interface-card__tags :deep(.ant-tag) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 50px;
  height: 28px;
  padding: 0 10px;
  margin-inline-end: 0;
  font-size: 13px;
  line-height: 1;
  border-radius: 7px;
}

.interface-card__body {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  padding: 12px 0 18px;
}

.interface-card__avatar {
  display: flex;
  flex: 0 0 64px;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  overflow: hidden;
  background: hsl(var(--muted));
  border-radius: 8px;
}

.interface-card__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.interface-card__content {
  min-width: 0;
}

.interface-card__name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 16px;
  font-weight: 700;
  line-height: 24px;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.interface-card__desc {
  display: -webkit-box;
  min-height: 44px;
  margin-top: 8px;
  overflow: hidden;
  -webkit-line-clamp: 2;
  font-size: 14px;
  line-height: 22px;
  color: hsl(var(--muted-foreground));
  -webkit-box-orient: vertical;
}

.interface-card__footer {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  padding-top: 14px;
  border-top: 1px solid hsl(var(--border));
}

.interface-card__price {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  font-size: 13px;
  font-weight: 700;
  color: #f45d66;
}

.interface-card__method {
  flex: 0 0 auto;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 700;
  line-height: 24px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
  border-radius: 5px;
}

.interface-market__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 360px;
  background: hsl(var(--background));
  border-radius: 6px;
}

.interface-market__pagination {
  display: flex;
  justify-content: flex-end;
  padding: 4px 0 12px;
}

@keyframes interface-status-pulse {
  0% {
    opacity: 0.9;
    transform: scale(0.72);
  }

  70% {
    opacity: 0;
    transform: scale(1.55);
  }

  100% {
    opacity: 0;
    transform: scale(1.55);
  }
}

@media (max-width: 768px) {
  .interface-market__filter {
    grid-template-columns: 1fr;
  }

  .interface-market__filter-actions {
    justify-content: flex-start;
  }
}
</style>
