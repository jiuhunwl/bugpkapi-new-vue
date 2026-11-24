<script lang="ts" setup>
import type { MarketApi } from '#/api/market';

import { onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { getMarketApis } from '#/api/market';
import { useSettlementCurrency } from '#/composables/use-settlement-currency';
import { $t } from '#/locales';
import { isMarketPriceFree } from '#/utils/market-price';

const {
  fromCNY: marketFromCNY,
  symbol: marketSymbol,
} = useSettlementCurrency();

function formatMarketPrice(value: number | string) {
  const converted = marketFromCNY(value, 4);
  if (!Number.isFinite(converted)) {
    return `${marketSymbol.value}0`;
  }
  return `${marketSymbol.value}${converted.toLocaleString('zh-CN', {
    maximumFractionDigits: 4,
  })}`;
}

const items = ref<MarketApi.ApiItem[]>([]);
const loading = ref(false);
const canLoadMore = ref(false);
const keyword = ref('');
const pagination = reactive({ page: 1, pageSize: 24, total: 0 });

function methodLabel(method: string) {
  return method === 'GET_POST' ? 'GET/POST' : method;
}

function compactNumber(value: number | string | undefined) {
  const number = Number(value || 0);
  if (number >= 10_000) {
    return `${(number / 10_000).toFixed(number >= 100_000 ? 0 : 1)}w`;
  }
  if (number >= 1000) {
    return `${(number / 1000).toFixed(number >= 10_000 ? 0 : 1)}k`;
  }
  return String(number);
}

function priceClass(item: MarketApi.ApiItem) {
  if (isMarketPriceFree(item.price, item.pointPrice)) {
    return 'free';
  }
  return Number(item.pointPrice || 0) > 0 ? 'point' : 'paid';
}

function priceText(item: MarketApi.ApiItem) {
  // 与市场列表页同口径：免费 / ¥1/次 / 10 点/次，替换后端原始 priceLabel。
  if (isMarketPriceFree(item.price, item.pointPrice)) {
    return $t('page.public.market.free');
  }
  const points = Number(item.pointPrice || 0);
  if (Number.isFinite(points) && points > 0) {
    return $t('page.public.market.pricePoints', [points]);
  }
  return $t('page.public.market.priceBalance', [
    formatMarketPrice(item.price),
  ]);
}

async function query(page = 1) {
  loading.value = true;
  try {
    const result = await getMarketApis({
      keyword: keyword.value.trim() || undefined,
      page,
      pageSize: pagination.pageSize,
    });
    items.value = page === 1 ? result.items : [...items.value, ...result.items];
    pagination.total = result.total;
    canLoadMore.value = items.value.length < result.total;
  } finally {
    loading.value = false;
  }
}

function submitSearch() {
  void query(1);
}

function clearSearch() {
  keyword.value = '';
  void query(1);
}

function loadMore() {
  pagination.page += 1;
  void query(pagination.page);
}

onMounted(() => {
  void query(1);
});
</script>

<template>
  <Page auto-content-height>
    <section class="console-apis">
      <header class="console-apis__head">
        <div>
          <span class="console-apis__eyebrow">{{
            $t('page.public.market.eyebrow')
          }}</span>
          <h2 class="console-apis__title">
            {{ $t('page.public.nav.apiList') }}
          </h2>
        </div>
        <small v-if="pagination.total > 0" class="console-apis__count">
          {{
            $t('page.public.market.totalCount', [
              String(pagination.total),
            ])
          }}
        </small>
      </header>

      <form class="console-apis__search" @submit.prevent="submitSearch">
        <IconifyIcon
          class="console-apis__search-icon"
          icon="lucide:search"
        />
        <input
          v-model="keyword"
          :placeholder="$t('page.public.market.searchPlaceholder')"
          class="console-apis__search-input"
          type="search"
        />
        <button
          v-if="keyword"
          :aria-label="$t('page.public.market.clearSearch')"
          class="console-apis__search-clear"
          type="button"
          @click="clearSearch"
        >
          <IconifyIcon icon="lucide:x" />
        </button>
        <button
          :aria-label="$t('page.public.market.searchAria')"
          class="console-apis__search-submit"
          type="submit"
        >
          {{ $t('page.public.market.search') }}
        </button>
      </form>

      <div v-if="items.length > 0" class="console-apis__grid">
        <RouterLink
          v-for="item in items"
          :key="item.id"
          class="console-api-card"
          :to="{ name: 'ApiDocs', params: { id: item.id } }"
        >
          <div class="console-api-card__top">
            <span class="console-api-card__icon">
              <img
                v-if="item.avatarUrl"
                :alt="item.name"
                :src="item.avatarUrl"
              />
              <IconifyIcon v-else icon="lucide:boxes" />
            </span>
            <span class="console-api-card__method">{{
              methodLabel(item.requestMethod)
            }}</span>
          </div>

          <div class="console-api-card__body">
            <div class="console-api-card__tags">
              <span v-if="Number(item.isTop) === 1">
                {{ $t('page.public.market.tags.top') }}
              </span>
              <span v-if="Number(item.isFeatured) === 1">
                {{ $t('page.public.market.tags.featured') }}
              </span>
            </div>
            <h3>{{ item.name }}</h3>
            <p>
              {{
                item.description ||
                $t('page.public.market.emptyDescription')
              }}
            </p>
          </div>

          <div class="console-api-card__foot">
            <div class="console-api-card__meta">
              <em :class="priceClass(item)">{{ priceText(item) }}</em>
              <span>
                {{
                  $t('page.public.market.callCount', [
                    compactNumber(item.callCount),
                  ])
                }}
              </span>
            </div>
            <span class="console-api-card__action">
              {{ $t('page.public.market.viewDocs') }}
              <IconifyIcon icon="lucide:arrow-right" />
            </span>
          </div>
        </RouterLink>
      </div>

      <div v-else class="console-apis__empty">
        <IconifyIcon icon="lucide:search-x" />
        <span>
          {{
            loading
              ? $t('page.public.market.loading')
              : $t('page.public.market.empty')
          }}
        </span>
      </div>

      <button
        v-if="canLoadMore"
        class="console-apis__load-more"
        :disabled="loading"
        type="button"
        @click="loadMore"
      >
        {{
          loading
            ? $t('page.public.market.loadingMore')
            : $t('page.public.market.loadMore')
        }}
      </button>
    </section>
  </Page>
</template>

<style scoped>
.console-apis {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.console-apis__head {
  display: flex;
  gap: 18px;
  align-items: flex-end;
  justify-content: space-between;
  padding: 4px 2px;
}

.console-apis__eyebrow {
  font-size: 12px;
  font-weight: 950;
  letter-spacing: 0.08em;
  color: hsl(var(--primary));
}

.console-apis__title {
  margin: 6px 0 0;
  font-size: 26px;
  font-weight: 950;
  line-height: 1.3;
  color: hsl(var(--foreground));
}

.console-apis__count {
  font-size: 14px;
  font-weight: 700;
  color: hsl(var(--muted-foreground));
}

.console-apis__search {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  gap: 8px;
  align-items: center;
  padding: 6px 8px 6px 14px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 999px;
  transition: border-color 0.2s ease;
}

.console-apis__search:focus-within {
  border-color: hsl(var(--primary) / 50%);
}

.console-apis__search-icon {
  font-size: 16px;
  color: hsl(var(--muted-foreground));
}

.console-apis__search-input {
  min-width: 0;
  font-size: 14px;
  color: hsl(var(--foreground));
  background: transparent;
  border: 0;
  outline: none;
}

.console-apis__search-clear {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  font-size: 14px;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background: hsl(var(--muted));
  border: 0;
  border-radius: 50%;
}

.console-apis__search-submit {
  height: 30px;
  padding: 0 16px;
  font-size: 13px;
  font-weight: 900;
  color: hsl(var(--primary-foreground));
  cursor: pointer;
  background: hsl(var(--primary));
  border: 0;
  border-radius: 999px;
}

.console-apis__search-submit:active {
  transform: scale(0.97);
}

@media (max-width: 560px) {
  .console-apis__search {
    grid-template-columns: auto 1fr auto;
  }

  .console-apis__search-submit {
    display: none;
  }
}

.console-apis__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.console-api-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 250px;
  padding: 20px;
  overflow: hidden;
  color: hsl(var(--foreground));
  text-decoration: none;
  cursor: pointer;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  box-shadow: 0 10px 30px rgb(0 0 0 / 4%);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.console-api-card::before {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: 3px;
  content: '';
  background: linear-gradient(
    90deg,
    hsl(var(--primary)),
    hsl(var(--primary) / 10%)
  );
  opacity: 0;
  transition: opacity 0.2s ease;
}

.console-api-card:hover {
  border-color: hsl(var(--primary) / 40%);
  box-shadow: 0 18px 44px hsl(var(--primary) / 12%);
  transform: translateY(-2px);
}

.console-api-card:hover::before {
  opacity: 1;
}

.console-api-card__top {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 16px;
  align-items: center;
}

.console-api-card__icon {
  display: inline-grid;
  flex: 0 0 auto;
  place-items: center;
  width: 54px;
  height: 54px;
  font-size: 25px;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
  border: 1px solid hsl(var(--primary) / 16%);
  border-radius: 12px;
}

.console-api-card__icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 12px;
}

.console-api-card__method {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  justify-self: end;
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 950;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
  background: hsl(var(--muted));
  border-radius: 999px;
}

.console-api-card__body {
  min-width: 0;
}

.console-api-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 22px;
  margin-bottom: 8px;
}

.console-api-card__tags span {
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 800;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
  border-radius: 999px;
}

.console-api-card__body h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 950;
  line-height: 1.35;
  color: hsl(var(--foreground));
}

.console-api-card__body p {
  display: -webkit-box;
  min-height: 48px;
  margin: 10px 0 0;
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.7;
  color: hsl(var(--muted-foreground));
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.console-api-card__foot {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
}

.console-api-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.console-api-card__meta em,
.console-api-card__meta span {
  padding: 4px 9px;
  font-size: 12px;
  font-weight: 800;
  font-style: normal;
  border-radius: 999px;
}

.console-api-card__meta em.free {
  color: #16a34a;
  background: rgb(22 163 74 / 12%);
}

.console-api-card__meta em.point {
  color: #f59e0b;
  background: rgb(245 158 11 / 14%);
}

.console-api-card__meta em.paid {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
}

.console-api-card__meta span {
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
}

.console-api-card__action {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 6px;
  align-items: center;
  font-size: 13px;
  font-weight: 950;
  color: hsl(var(--primary));
}

.console-api-card__action svg {
  font-size: 15px;
  transition: transform 0.2s ease;
}

.console-api-card:hover .console-api-card__action svg {
  transform: translateX(3px);
}

.console-apis__empty {
  display: grid;
  gap: 10px;
  place-items: center;
  min-height: 260px;
  font-weight: 800;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.console-apis__empty svg {
  font-size: 34px;
}

.console-apis__load-more {
  width: 100%;
  height: 40px;
  font-weight: 850;
  color: hsl(var(--foreground));
  cursor: pointer;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.console-apis__load-more:disabled {
  cursor: wait;
  opacity: 0.7;
}

@media (max-width: 1180px) {
  .console-apis__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .console-apis__grid {
    grid-template-columns: 1fr;
  }

  .console-apis__title {
    font-size: 22px;
  }

  .console-api-card {
    min-height: 0;
    padding: 16px;
  }
}
</style>
