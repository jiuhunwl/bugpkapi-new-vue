<script lang="ts" setup>
import type { PackageApi } from '#/api/package';

import { onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { Button, Empty, message, Pagination, Spin } from 'ant-design-vue';

import { getMallGlobalPackageList } from '#/api/package';
import { useSettlementCurrency } from '#/composables/use-settlement-currency';
import { $t } from '#/locales';

import PackagePayModal from '../components/package-pay-modal.vue';

const loading = ref(false);
const payModalRef = ref<InstanceType<typeof PackagePayModal>>();
const packages = ref<PackageApi.MallGlobalPackage[]>([]);
const pagination = reactive({
  current: 1,
  pageSize: 12,
  total: 0,
});

async function queryPackages(page = 1) {
  loading.value = true;
  try {
    const result = await getMallGlobalPackageList({
      page,
      pageSize: pagination.pageSize,
    });
    packages.value = result.items;
    pagination.current = page;
    pagination.total = result.total;
  } finally {
    loading.value = false;
  }
}

function onPageChange(page: number, pageSize: number) {
  pagination.pageSize = pageSize;
  queryPackages(page);
}

// 价格展示走站点货币：CNY 原样，USD 按汇率换算；配置了货币展示名称时改用「金额 名称」。
const { priceText: formatPrice } = useSettlementCurrency();

function isFreePrice(value: number | string) {
  return Number(value ?? 0) === 0;
}

function priceText(value: number | string) {
  return isFreePrice(value)
    ? $t('system.package.free')
    : formatPrice(value);
}

// 赞助档的每日调用量按「服务测试额度」表述：额度保留，但不随档位增减，也不是内容授权。
function serviceTestQuotaText(value: number) {
  return Number(value ?? 0) === 0
    ? $t('system.package.serviceTestQuotaUnlimited')
    : $t('system.package.serviceTestQuotaLimit', [
        Number(value).toLocaleString(),
      ]);
}

function qpsLimitText(value: number) {
  return Number(value ?? 0) === 0
    ? $t('system.package.qpsUnlimited')
    : $t('system.package.qpsLimitText', [Number(value).toLocaleString()]);
}

function validDaysText(value?: number) {
  return $t('system.package.validDaysText', [Number(value ?? 30).toLocaleString()]);
}

function packageTip(item: PackageApi.MallGlobalPackage) {
  return item.remark?.trim() || $t('system.package.globalPackageTip');
}

// 名称形如「服务测试基础版（月卡）」：只在档位与时长之间允许换行，
// 避免卡片宽度不足时把「（月卡）」拆成两行。
function packageTitle(name: string) {
  return name.replace('（', '\u200B（');
}

function parseSaleTime(value?: string) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value.replace(' ', 'T'));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function stockRemaining(item: PackageApi.MallGlobalPackage) {
  const limit = Number(item.stockLimit ?? 0);
  if (limit <= 0) {
    return null;
  }
  return Math.max(limit - Number(item.stockUsed ?? 0), 0);
}

function isOffSale(item: PackageApi.MallGlobalPackage) {
  const now = Date.now();
  const start = parseSaleTime(item.saleStartAt);
  const end = parseSaleTime(item.saleEndAt);
  return Boolean(
    (start && now < start.getTime()) || (end && now >= end.getTime()),
  );
}

function isSoldOut(item: PackageApi.MallGlobalPackage) {
  const remaining = stockRemaining(item);
  return remaining !== null && remaining <= 0;
}

function isGroupBlocked(item: PackageApi.MallGlobalPackage) {
  return item.canPurchase === false;
}

function isBuyable(item: PackageApi.MallGlobalPackage) {
  return !isSoldOut(item) && !isOffSale(item) && !isGroupBlocked(item);
}

function saleBadge(item: PackageApi.MallGlobalPackage) {
  if (isSoldOut(item)) {
    return $t('system.package.soldOut');
  }
  if (isOffSale(item)) {
    return $t('system.package.offSale');
  }
  if (isGroupBlocked(item)) {
    return $t('system.package.groupRestricted');
  }
  return '';
}

function onBuy(item: PackageApi.MallGlobalPackage) {
  if (!isBuyable(item)) {
    message.warning(saleBadge(item));
    return;
  }
  payModalRef.value?.open({
    description: packageTip(item),
    id: item.id,
    price: item.price,
    subtitle: validDaysText(item.validDays),
    title: item.name,
    type: 'GLOBAL',
  });
}

function onPurchaseSuccess() {
  queryPackages(pagination.current);
}

onMounted(() => {
  queryPackages();
});
</script>

<template>
  <Page auto-content-height content-class="purchase-page">
    <PackagePayModal ref="payModalRef" @success="onPurchaseSuccess" />
    <Spin :spinning="loading">
      <div v-if="packages.length > 0" class="package-card-grid">
        <article
          v-for="item in packages"
          :key="item.id"
          class="package-card package-card--global"
        >
          <div class="package-card__top">
            <div class="package-card__title-wrap">
              <div class="package-card__icon">
                <IconifyIcon class="size-8" icon="lucide:globe-2" />
              </div>
              <div class="package-card__title">
                <span>{{ $t('system.package.allSiteAccess') }}</span>
                <h3>{{ packageTitle(item.name) }}</h3>
              </div>
            </div>
            <span
              class="package-card__badge"
              :class="{ 'is-sale-ended': !isBuyable(item) }"
            >
              {{ saleBadge(item) || $t('system.package.buyGlobalTitle') }}
            </span>
          </div>

          <p class="package-card__desc">{{ packageTip(item) }}</p>

          <div class="package-card__price">
            <span v-if="!isFreePrice(item.price)">
              {{ $t('system.package.lowestPrice') }}
            </span>
            <strong :class="{ 'is-free': isFreePrice(item.price) }">
              {{ priceText(item.price) }}
            </strong>
            <span>/ {{ validDaysText(item.validDays) }}</span>
          </div>

          <div class="package-card__limits">
            <div class="package-card__limit">
              <IconifyIcon class="size-5" icon="lucide:layers-3" />
              <span>{{ $t('system.package.coverage') }}</span>
              <strong>{{ $t('system.package.allInterfaces') }}</strong>
            </div>
            <div class="package-card__limit">
              <IconifyIcon class="size-5" icon="lucide:calendar-days" />
              <span>{{ $t('system.package.validPeriod') }}</span>
              <strong>{{ validDaysText(item.validDays) }}</strong>
            </div>
            <div class="package-card__limit">
              <IconifyIcon class="size-5" icon="lucide:calendar-check" />
              <span>{{ $t('system.package.serviceTestQuota') }}</span>
              <strong>{{ serviceTestQuotaText(item.dailyLimit) }}</strong>
            </div>
            <div class="package-card__limit">
              <IconifyIcon class="size-5" icon="lucide:gauge" />
              <span>{{ $t('system.package.qpsQuota') }}</span>
              <strong>{{ qpsLimitText(item.qpsLimit) }}</strong>
            </div>
            <div
              v-if="stockRemaining(item) !== null"
              class="package-card__limit"
            >
              <IconifyIcon class="size-5" icon="lucide:package-check" />
              <span>{{ $t('system.package.stockLimit') }}</span>
              <strong>
                {{
                  $t('system.package.stockRemainingText', [
                    stockRemaining(item)?.toLocaleString('zh-CN'),
                  ])
                }}
              </strong>
            </div>
            <div
              v-if="Number(item.perUserLimit ?? 0) > 0"
              class="package-card__limit"
            >
              <IconifyIcon class="size-5" icon="lucide:user-check" />
              <span>{{ $t('system.package.perUserLimit') }}</span>
              <strong>
                {{
                  $t('system.package.perUserLimitText', [
                    Number(item.perUserLimit),
                  ])
                }}
              </strong>
            </div>
          </div>

          <div class="package-card__actions">
            <Button
              type="primary"
              :disabled="!isBuyable(item)"
              @click="onBuy(item)"
            >
              {{ saleBadge(item) || $t('system.package.buyNow') }}
            </Button>
          </div>
        </article>
      </div>
      <div v-else class="purchase-empty">
        <Empty />
      </div>
    </Spin>

    <div class="purchase-pagination">
      <Pagination
        :current="pagination.current"
        :page-size="pagination.pageSize"
        :page-size-options="['12', '24', '36']"
        show-size-changer
        :total="pagination.total"
        @change="onPageChange"
        @show-size-change="onPageChange"
      />
    </div>
  </Page>
</template>

<style scoped>
.purchase-page {
  min-height: 100%;
}

.package-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 360px));
  gap: 16px;
  align-items: start;
}

.package-card {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 300px;
  padding: 18px;
  overflow: hidden;
  background:
    linear-gradient(180deg, hsl(var(--background)), hsl(var(--background))),
    radial-gradient(circle at 92% 0%, hsl(var(--primary) / 10%), transparent 34%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  box-shadow: 0 8px 24px hsl(var(--foreground) / 4%);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.package-card:hover {
  border-color: hsl(var(--primary) / 48%);
  box-shadow: 0 14px 32px hsl(var(--foreground) / 8%);
  transform: translateY(-2px);
}

.package-card__top {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.package-card__title-wrap {
  display: flex;
  gap: 12px;
  align-items: center;
  min-width: 0;
}

.package-card__icon {
  display: flex;
  flex: 0 0 58px;
  align-items: center;
  justify-content: center;
  width: 58px;
  height: 58px;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
  border-radius: 8px;
}

.package-card__title {
  min-width: 0;
}

.package-card__title span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  font-weight: 600;
  line-height: 17px;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.package-card__title h3 {
  margin: 4px 0 0;
  font-size: 18px;
  font-weight: 800;
  line-height: 26px;
  color: hsl(var(--foreground));
  word-break: keep-all;
}

.package-card__badge {
  flex: 0 0 auto;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 700;
  line-height: 28px;
  color: hsl(var(--warning));
  background: hsl(var(--warning) / 12%);
  border: 1px solid hsl(var(--warning) / 24%);
  border-radius: 6px;
}

.package-card__badge.is-sale-ended {
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 10%);
  border-color: hsl(var(--destructive) / 24%);
}

.package-card__desc {
  position: relative;
  z-index: 1;
  min-height: 44px;
  margin: 16px 0 0;
  font-size: 14px;
  line-height: 22px;
  color: hsl(var(--muted-foreground));
}

.package-card__price {
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: baseline;
  margin-top: 16px;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.package-card__price strong {
  font-size: 26px;
  font-weight: 900;
  line-height: 1;
  color: #f45d66;
}

/* 免费套餐用成功色强调「白送」语义，避免红色误读为促销价 */
.package-card__price strong.is-free {
  color: hsl(var(--success));
}

.package-card__price small {
  margin-right: 2px;
  font-size: 15px;
  font-weight: 800;
}

.package-card__limits {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 14px;
}

.package-card__limit {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  min-height: 54px;
  padding: 10px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 38%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.package-card__limit:first-child {
  grid-column: 1 / -1;
}

.package-card__limit :deep(svg) {
  grid-row: 1 / 3;
  color: hsl(var(--primary));
}

.package-card__limit span {
  display: block;
  grid-column: 2;
  font-size: 12px;
  line-height: 16px;
}

.package-card__limit strong {
  display: block;
  grid-column: 2;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  font-weight: 800;
  line-height: 18px;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.package-card__actions {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 10px;
  padding-top: 16px;
  margin-top: auto;
}

.package-card__actions :deep(.ant-btn) {
  min-width: 96px;
  height: 34px;
  font-weight: 700;
  border-radius: 6px;
}

.purchase-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 360px;
  background: hsl(var(--background));
  border-radius: 6px;
}

.purchase-pagination {
  display: flex;
  justify-content: flex-end;
  padding: 16px 0 4px;
}

@media (max-width: 768px) {
  .package-card-grid {
    grid-template-columns: 1fr;
  }
}
</style>
