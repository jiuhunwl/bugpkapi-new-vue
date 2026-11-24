<script lang="ts" setup>
import type { PackageApi } from '#/api/package';

import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { Button, Empty, message, Pagination, Spin } from 'ant-design-vue';

import { getMallInterfacePackageList } from '#/api/package';
import { useSettlementCurrency } from '#/composables/use-settlement-currency';
import { $t } from '#/locales';

const router = useRouter();
const loading = ref(false);
const packages = ref<PackageApi.MallInterfacePackage[]>([]);
const pagination = reactive({
  current: 1,
  pageSize: 12,
  total: 0,
});

async function queryPackages(page = 1) {
  loading.value = true;
  try {
    const result = await getMallInterfacePackageList({
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

function goDetail(item: PackageApi.MallInterfacePackage) {
  router.push(`/purchase/interface/detail/${item.id}`);
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

function primarySpec(item: PackageApi.MallInterfacePackage) {
  return item.specs?.[0];
}

function priceValue(item: PackageApi.MallInterfacePackage) {
  return item.minPrice ?? primarySpec(item)?.price ?? 0;
}

function description(item: PackageApi.MallInterfacePackage) {
  return item.remark || item.interfaceRemark || $t('system.package.interfacePackageTip');
}

function specCountText(item: PackageApi.MallInterfacePackage) {
  return $t('system.package.specCount', [Number(item.specCount ?? item.specs?.length ?? 0)]);
}

function onDocument(item: PackageApi.MallInterfacePackage) {
  const interfaceId = String(item.interfaceId || '').trim();
  if (!interfaceId) {
    message.warning($t('system.package.documentNotReady'));
    return;
  }
  router.push({ name: 'ApiDocs', params: { id: interfaceId } });
}

onMounted(() => {
  queryPackages();
});
</script>

<template>
  <Page auto-content-height content-class="purchase-page">
    <Spin :spinning="loading">
      <div v-if="packages.length > 0" class="package-card-grid">
        <article
          v-for="item in packages"
          :key="item.id"
          class="package-card package-card--interface"
          role="button"
          tabindex="0"
          @click="goDetail(item)"
          @keydown.enter="goDetail(item)"
        >
          <div class="package-card__top">
            <div v-if="item.avatarUrl" class="package-card__avatar">
              <img :alt="item.interfaceName" :src="item.avatarUrl" />
            </div>
            <div v-else class="package-card__avatar package-card__avatar--empty">
              <IconifyIcon class="size-8" icon="lucide:package-open" />
            </div>
            <div class="package-card__title">
              <span>{{ item.interfaceName }}</span>
              <h3>{{ item.name }}</h3>
            </div>
          </div>

          <p class="package-card__desc">{{ description(item) }}</p>

          <div class="package-card__meta">
            <span>
              <IconifyIcon class="size-4" icon="lucide:layers-3" />
              {{ specCountText(item) }}
            </span>
            <span v-if="item.canPurchase === false" class="is-group-restricted">
              <IconifyIcon class="size-4" icon="lucide:lock" />
              {{ $t('system.package.groupRestricted') }}
            </span>
            <span v-else>{{ $t('system.package.viewQuotaInDetail') }}</span>
          </div>

          <div class="package-card__footer">
            <div class="package-card__price">
              <span v-if="!isFreePrice(priceValue(item))">
                {{ $t('system.package.lowestPrice') }}
              </span>
              <strong :class="{ 'is-free': isFreePrice(priceValue(item)) }">
                {{ priceText(priceValue(item)) }}
              </strong>
              <span>/ {{ primarySpec(item)?.specName || $t('system.package.monthlyPackage') }}</span>
            </div>

            <div class="package-card__actions">
              <Button type="primary" @click.stop="goDetail(item)">
                {{ $t('system.package.buyNow') }}
              </Button>
              <Button @click.stop="onDocument(item)">
                {{ $t('system.package.apiDocument') }}
              </Button>
            </div>
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
  display: flex;
  flex-direction: column;
  min-height: 248px;
  padding: 18px;
  overflow: hidden;
  text-align: left;
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

.package-card:hover,
.package-card:focus-visible {
  outline: none;
  border-color: hsl(var(--primary) / 50%);
  box-shadow: 0 14px 32px hsl(var(--foreground) / 8%);
  transform: translateY(-2px);
}

.package-card__top {
  display: flex;
  gap: 12px;
  align-items: center;
  min-width: 0;
}

.package-card__avatar {
  display: flex;
  flex: 0 0 58px;
  align-items: center;
  justify-content: center;
  width: 58px;
  height: 58px;
  overflow: hidden;
  background: hsl(var(--muted));
  border-radius: 8px;
}

.package-card__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.package-card__avatar--empty {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
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
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 18px;
  font-weight: 800;
  line-height: 26px;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.package-card__desc {
  display: -webkit-box;
  min-height: 44px;
  margin: 16px 0 0;
  overflow: hidden;
  -webkit-line-clamp: 2;
  font-size: 14px;
  line-height: 22px;
  color: hsl(var(--muted-foreground));
  -webkit-box-orient: vertical;
}

.package-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.package-card__meta span {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
  line-height: 1;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 72%);
  border-radius: 6px;
}

.package-card__meta span:first-child {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
}

.package-card__meta span.is-group-restricted {
  color: hsl(var(--warning));
  background: hsl(var(--warning) / 12%);
}

.package-card__footer {
  padding-top: 18px;
  margin-top: auto;
}

.package-card__price {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: baseline;
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

.package-card__actions {
  display: flex;
  gap: 10px;
  padding-top: 14px;
}

.package-card__actions :deep(.ant-btn) {
  min-width: 92px;
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
