<script lang="ts" setup>
import type { PackageApi } from '#/api/package';

import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { Button, Empty, message, Spin } from 'ant-design-vue';

import {
  getMallInterfacePackageDetail,
} from '#/api/package';
import { useSettlementCurrency } from '#/composables/use-settlement-currency';
import { $t } from '#/locales';

import PackagePayModal from '../components/package-pay-modal.vue';

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const detail = ref<PackageApi.MallInterfacePackage>();
const selectedSpecId = ref<string>();
const payModalRef = ref<InstanceType<typeof PackagePayModal>>();

const selectedSpec = computed(() => {
  return detail.value?.specs.find((item) => item.id === selectedSpecId.value);
});

function parseSaleTime(value?: string) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value.replace(' ', 'T'));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function stockRemaining(spec?: PackageApi.MallInterfacePackageSpec) {
  const limit = Number(spec?.stockLimit ?? 0);
  if (limit <= 0) {
    return null;
  }
  return Math.max(limit - Number(spec?.stockUsed ?? 0), 0);
}

function isSpecOffSale(spec?: PackageApi.MallInterfacePackageSpec) {
  if (!spec) {
    return false;
  }
  const now = Date.now();
  const start = parseSaleTime(spec.saleStartAt);
  const end = parseSaleTime(spec.saleEndAt);
  return Boolean(
    (start && now < start.getTime()) || (end && now >= end.getTime()),
  );
}

function isSpecSoldOut(spec?: PackageApi.MallInterfacePackageSpec) {
  const remaining = stockRemaining(spec);
  return remaining !== null && remaining <= 0;
}

function specSaleLabel(spec?: PackageApi.MallInterfacePackageSpec) {
  if (isSpecSoldOut(spec)) {
    return $t('system.package.soldOut');
  }
  if (isSpecOffSale(spec)) {
    return $t('system.package.offSale');
  }
  const remaining = stockRemaining(spec);
  return remaining === null
    ? ''
    : $t('system.package.stockRemainingText', [
        remaining.toLocaleString('zh-CN'),
      ]);
}

const groupBlocked = computed(() => detail.value?.canPurchase === false);

const selectedAvailable = computed(() => {
  const spec = selectedSpec.value;
  return (
    Boolean(spec) &&
    !isSpecSoldOut(spec) &&
    !isSpecOffSale(spec) &&
    !groupBlocked.value
  );
});

const selectedPackageType = computed(() => {
  const specName = selectedSpec.value?.specName?.trim();
  if (specName) {
    return specName;
  }
  return packageTypeText(selectedSpec.value?.validDays);
});

async function loadDetail() {
  const id = String(route.params.id ?? '');
  if (!id) {
    return;
  }
  loading.value = true;
  try {
    const result = await getMallInterfacePackageDetail(id);
    detail.value = result;
    selectedSpecId.value = result.specs?.[0]?.id;
  } finally {
    loading.value = false;
  }
}

function goBack() {
  if (window.history.length > 1) {
    router.back();
    return;
  }
  router.push('/purchase/interface');
}

function selectSpec(spec: PackageApi.MallInterfacePackageSpec) {
  selectedSpecId.value = spec.id;
}

// 价格展示走站点货币：CNY 原样，USD 按汇率换算；配置了货币展示名称时改用「金额 名称」。
const { priceText: formatPrice } = useSettlementCurrency();

function priceText(value?: number | string) {
  return Number(value ?? 0) === 0
    ? $t('system.package.free')
    : formatPrice(value);
}

function dailyLimitText(value?: number) {
  return Number(value ?? 0) === 0
    ? $t('system.package.dailyUnlimitedCalls')
    : $t('system.package.dailyCallLimit', [
        Number(value).toLocaleString('zh-CN'),
      ]);
}

function qpsLimitText(value?: number) {
  return Number(value ?? 0) === 0
    ? $t('system.package.qpsUnlimited')
    : $t('system.package.qpsLimitText', [Number(value).toLocaleString('zh-CN')]);
}

function validDaysText(value?: number) {
  return $t('system.package.validDaysText', [Number(value ?? 30).toLocaleString('zh-CN')]);
}

function packageTypeText(value?: number) {
  const days = Number(value ?? 30);
  if (days <= 31) {
    return $t('system.package.monthlyPackage');
  }
  if (days <= 93) {
    return $t('system.package.quarterlyPackage');
  }
  if (days <= 186) {
    return $t('system.package.halfYearPackage');
  }
  if (days <= 366) {
    return $t('system.package.yearlyPackage');
  }
  return $t('system.package.customDaysPackage', [days.toLocaleString('zh-CN')]);
}

function description() {
  return (
    detail.value?.remark ||
    detail.value?.interfaceRemark ||
    $t('system.package.interfacePackageTip')
  );
}

function onOrder() {
  if (!detail.value?.id || !selectedSpec.value?.id) {
    message.warning($t('system.package.specRequired'));
    return;
  }
  if (!selectedAvailable.value) {
    message.warning(
      groupBlocked.value
        ? $t('system.package.groupRestricted')
        : isSpecSoldOut(selectedSpec.value)
          ? $t('system.package.soldOut')
          : $t('system.package.offSale'),
    );
    return;
  }
  payModalRef.value?.open({
    description: description(),
    id: detail.value.id,
    interfaceId: detail.value.interfaceId,
    price: selectedSpec.value.price,
    specId: selectedSpec.value.id,
    subtitle: `${detail.value.interfaceName} / ${selectedSpec.value.specName}`,
    title: detail.value.name,
    type: 'INTERFACE',
  });
}

function onDocument() {
  const interfaceId = String(detail.value?.interfaceId || '').trim();
  if (!interfaceId) {
    message.warning($t('system.package.documentNotReady'));
    return;
  }
  router.push({ name: 'ApiDocs', params: { id: interfaceId } });
}

function onPurchaseSuccess() {
  loadDetail();
}

onMounted(() => {
  loadDetail();
});
</script>

<template>
  <Page auto-content-height content-class="package-detail-page">
    <PackagePayModal ref="payModalRef" @success="onPurchaseSuccess" />
    <Spin :spinning="loading">
      <div v-if="detail" class="detail-shell">
        <section class="detail-main">
          <Button class="detail-back" type="link" @click="goBack">
            <IconifyIcon class="size-4" icon="lucide:chevron-left" />
            {{ $t('system.package.back') }}
          </Button>

          <div class="detail-product">
            <div v-if="detail.avatarUrl" class="detail-product__avatar">
              <img :alt="detail.interfaceName" :src="detail.avatarUrl" />
            </div>
            <div
              v-else
              class="detail-product__avatar detail-product__avatar--empty"
            >
              <IconifyIcon class="size-9" icon="lucide:database" />
            </div>

            <div class="detail-product__info">
              <div class="detail-product__tags">
                <span>{{ $t('system.package.buyInterfaceTitle') }}</span>
                <span>{{ detail.interfaceName }}</span>
              </div>
              <h2>{{ detail.name }}</h2>
              <p>{{ description() }}</p>
            </div>
          </div>

          <div class="detail-section">
            <div class="detail-section__title">
              <h3>{{ $t('system.package.selectPackage') }}</h3>
              <span>{{ $t('system.package.viewQuotaInDetail') }}</span>
            </div>

            <div class="spec-grid">
              <button
                v-for="spec in detail.specs"
                :key="spec.id"
                class="spec-card"
                :class="{ 'is-active': selectedSpecId === spec.id }"
                type="button"
                @click="selectSpec(spec)"
              >
                <div class="spec-card__head">
                  <span class="spec-card__name">{{ spec.specName }}</span>
                  <IconifyIcon
                    v-if="selectedSpecId === spec.id"
                    class="size-5"
                    icon="lucide:check-circle-2"
                  />
                </div>
                <strong>{{ priceText(spec.price) }}</strong>
                <div class="spec-card__meta">
                  <span>{{ validDaysText(spec.validDays) }}</span>
                  <span>{{ dailyLimitText(spec.dailyLimit) }}</span>
                  <span>{{ qpsLimitText(spec.qpsLimit) }}</span>
                  <span
                    v-if="specSaleLabel(spec)"
                    class="spec-card__stock"
                    :class="{
                      'is-sold-out': isSpecSoldOut(spec),
                      'is-off-sale': !isSpecSoldOut(spec) && isSpecOffSale(spec),
                    }"
                  >
                    {{ specSaleLabel(spec) }}
                  </span>
                </div>
              </button>
            </div>
          </div>

          <div class="detail-section">
            <div class="detail-section__title">
              <h3>{{ $t('system.package.packageDetail') }}</h3>
            </div>

            <div class="detail-info-grid">
              <div class="detail-info-card">
                <IconifyIcon class="size-5" icon="lucide:file-text" />
                <div>
                  <span>{{ $t('system.package.applicableInterface') }}</span>
                  <strong>{{ detail.interfaceName }}</strong>
                </div>
              </div>
              <div class="detail-info-card">
                  <IconifyIcon class="size-5" icon="lucide:calendar-days" />
                <div>
                  <span>{{ $t('system.package.validPeriod') }}</span>
                  <strong>{{ validDaysText(selectedSpec?.validDays) }}</strong>
                </div>
              </div>
              <div class="detail-info-card">
                <IconifyIcon class="size-5" icon="lucide:bar-chart-3" />
                <div>
                  <span>{{ $t('system.package.dailyLimit') }}</span>
                  <strong>{{ dailyLimitText(selectedSpec?.dailyLimit) }}</strong>
                </div>
              </div>
              <div class="detail-info-card">
                <IconifyIcon class="size-5" icon="lucide:gauge" />
                <div>
                  <span>{{ $t('system.package.qpsLimit') }}</span>
                  <strong>{{ qpsLimitText(selectedSpec?.qpsLimit) }}</strong>
                </div>
              </div>
              <div class="detail-info-card">
                <IconifyIcon class="size-5" icon="lucide:layers" />
                <div>
                  <span>{{ $t('system.package.packageType') }}</span>
                  <strong>{{ selectedPackageType }}</strong>
                </div>
              </div>
              <div
                v-if="stockRemaining(selectedSpec) !== null"
                class="detail-info-card"
              >
                <IconifyIcon class="size-5" icon="lucide:package-check" />
                <div>
                  <span>{{ $t('system.package.stockLimit') }}</span>
                  <strong>
                    {{
                      $t('system.package.stockRemainingText', [
                        stockRemaining(selectedSpec)?.toLocaleString('zh-CN'),
                      ])
                    }}
                  </strong>
                </div>
              </div>
              <div
                v-if="Number(selectedSpec?.perUserLimit ?? 0) > 0"
                class="detail-info-card"
              >
                <IconifyIcon class="size-5" icon="lucide:user-check" />
                <div>
                  <span>{{ $t('system.package.perUserLimit') }}</span>
                  <strong>
                    {{
                      $t('system.package.perUserLimitText', [
                        Number(selectedSpec?.perUserLimit),
                      ])
                    }}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside class="order-summary">
          <div class="order-summary__head">
            <span>{{ $t('system.package.orderSummary') }}</span>
            <strong>{{ priceText(selectedSpec?.price) }}</strong>
            <p>{{ detail.interfaceName }} / {{ selectedSpec?.specName || detail.name }}</p>
          </div>

          <div class="coupon-box">
            <span>{{ $t('system.package.couponNotReady') }}</span>
            <p>{{ $t('system.package.couponDescription') }}</p>
          </div>

          <div class="summary-lines">
            <div>
              <span>{{ $t('system.package.packageName') }}</span>
              <strong>{{ selectedSpec?.specName || detail.name }}</strong>
            </div>
            <div>
              <span>{{ $t('system.package.applicableInterface') }}</span>
              <strong>{{ detail.interfaceName }}</strong>
            </div>
            <div>
              <span>{{ $t('system.package.packageOriginalPrice') }}</span>
              <strong>{{ priceText(selectedSpec?.price) }}</strong>
            </div>
          </div>

          <div class="summary-total">
            <span>{{ $t('system.package.payAmount') }}</span>
            <strong>{{ priceText(selectedSpec?.price) }}</strong>
          </div>

          <Button
            block
            size="large"
            type="primary"
            :disabled="!selectedAvailable"
            @click="onOrder"
          >
            {{
              groupBlocked
                ? $t('system.package.groupRestricted')
                : isSpecSoldOut(selectedSpec)
                  ? $t('system.package.soldOut')
                  : isSpecOffSale(selectedSpec)
                    ? $t('system.package.offSale')
                    : $t('system.package.buyNow')
            }}
          </Button>
          <Button
            block
            class="order-summary__doc"
            size="large"
            @click="onDocument"
          >
            {{ $t('system.package.apiDocument') }}
          </Button>
        </aside>
      </div>
      <div v-else class="detail-empty">
        <Empty />
      </div>
    </Spin>
  </Page>
</template>

<style scoped>
.package-detail-page {
  min-height: 100%;
}

.detail-shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 18px;
}

.detail-main,
.order-summary {
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  box-shadow: 0 10px 28px hsl(var(--foreground) / 4%);
}

.detail-main {
  padding: 24px;
}

.detail-back {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  padding: 0;
  margin-bottom: 18px;
  font-weight: 700;
}

.detail-product {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 18px;
  align-items: center;
  padding-bottom: 24px;
  border-bottom: 1px solid hsl(var(--border));
}

.detail-product__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  overflow: hidden;
  color: hsl(var(--primary));
  background: hsl(var(--muted));
  border-radius: 8px;
}

.detail-product__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.detail-product__avatar--empty {
  background: hsl(var(--primary) / 8%);
}

.detail-product__info {
  min-width: 0;
}

.detail-product__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.detail-product__tags span {
  display: inline-flex;
  align-items: center;
  height: 26px;
  padding: 0 10px;
  font-size: 12px;
  line-height: 1;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 76%);
  border-radius: 6px;
}

.detail-product__tags span:first-child {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 9%);
}

.detail-product__info h2 {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 24px;
  font-weight: 800;
  line-height: 32px;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.detail-product__info p {
  display: -webkit-box;
  max-width: 820px;
  margin: 8px 0 0;
  overflow: hidden;
  -webkit-line-clamp: 2;
  font-size: 14px;
  line-height: 22px;
  color: hsl(var(--muted-foreground));
  -webkit-box-orient: vertical;
}

.detail-section {
  margin-top: 24px;
}

.detail-section__title {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.detail-section__title h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 800;
  color: hsl(var(--foreground));
}

.detail-section__title span {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.spec-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 280px));
  gap: 12px;
}

.spec-card {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 126px;
  padding: 16px;
  overflow: hidden;
  color: hsl(var(--foreground));
  text-align: left;
  cursor: pointer;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.spec-card:hover,
.spec-card.is-active {
  border-color: hsl(var(--primary) / 72%);
  box-shadow: 0 12px 28px hsl(var(--primary) / 10%);
}

.spec-card:hover {
  transform: translateY(-1px);
}

.spec-card.is-active::before {
  position: absolute;
  inset: 0 0 auto;
  height: 3px;
  content: '';
  background: hsl(var(--primary));
}

.spec-card__head {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
}

.spec-card__head :deep(svg) {
  color: hsl(var(--primary));
}

.spec-card__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 15px;
  font-weight: 800;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.spec-card strong {
  font-size: 24px;
  font-weight: 900;
  line-height: 1;
  color: #f45d66;
}

.spec-card small {
  margin-right: 2px;
  font-size: 14px;
}

.spec-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.spec-card__meta span {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 8px;
  font-size: 12px;
  line-height: 1;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 72%);
  border-radius: 6px;
}

.spec-card__meta span.is-sold-out,
.spec-card__meta span.is-off-sale {
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 10%);
}

.detail-info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.detail-info-card {
  display: flex;
  gap: 12px;
  align-items: center;
  min-height: 76px;
  padding: 14px;
  background: hsl(var(--muted) / 38%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.detail-info-card > svg,
.detail-info-card :deep(svg) {
  flex: 0 0 auto;
  color: hsl(var(--primary));
}

.detail-info-card div {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.detail-info-card span {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.detail-info-card strong {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
  font-weight: 800;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.order-summary {
  align-self: start;
  padding: 22px;
}

.order-summary__doc {
  margin-top: 10px;
}

.order-summary__head {
  padding-bottom: 18px;
  border-bottom: 1px solid hsl(var(--border));
}

.order-summary__head > span {
  font-size: 16px;
  font-weight: 800;
  color: hsl(var(--foreground));
}

.order-summary__head > strong {
  display: block;
  margin-top: 16px;
  font-size: 30px;
  font-weight: 900;
  line-height: 1;
  color: hsl(var(--foreground));
}

.order-summary__head small {
  margin-right: 4px;
  font-size: 18px;
}

.order-summary__head p {
  margin: 10px 0 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  line-height: 20px;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.coupon-box {
  padding: 14px;
  margin-top: 18px;
  color: #a66a19;
  background: #fffaf0;
  border: 1px solid #fed79a;
  border-radius: 8px;
}

.coupon-box span {
  display: block;
  font-size: 13px;
  font-weight: 800;
}

.coupon-box p {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 20px;
}

.summary-lines {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 18px;
  margin-top: 18px;
  border-bottom: 1px solid hsl(var(--border));
}

.summary-lines div,
.summary-total {
  display: flex;
  gap: 18px;
  align-items: center;
  justify-content: space-between;
}

.summary-lines span,
.summary-total span {
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.summary-lines strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  font-weight: 800;
  color: hsl(var(--foreground));
  text-align: right;
  white-space: nowrap;
}

.summary-total {
  margin: 22px 0 18px;
}

.summary-total strong {
  font-size: 28px;
  font-weight: 900;
  color: #f45d66;
}

.detail-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 360px;
  background: hsl(var(--background));
  border-radius: 6px;
}

@media (max-width: 1180px) {
  .detail-shell {
    grid-template-columns: 1fr;
  }

  .order-summary {
    align-self: stretch;
  }
}

@media (max-width: 768px) {
  .detail-main {
    padding: 18px;
  }

  .detail-product {
    grid-template-columns: 1fr;
  }

  .detail-product__info h2 {
    white-space: normal;
  }

  .detail-section__title {
    flex-direction: column;
    gap: 6px;
    align-items: flex-start;
  }

  .spec-grid,
  .detail-info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
