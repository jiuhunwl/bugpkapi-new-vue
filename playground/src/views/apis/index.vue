<script lang="ts" setup>
import type { MarketApi } from '#/api/market';

import { onMounted, reactive, ref } from 'vue';

import { ResponsiveGrid } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { getMarketApis } from '#/api/market';
import PublicSiteFooter from '#/components/public-site-footer.vue';
import PublicSiteHeader from '#/components/public-site-header.vue';
import { usePublicSiteTheme } from '#/composables/use-public-site-theme';
import { useSettlementCurrency } from '#/composables/use-settlement-currency';
import { $t } from '#/locales';
import { isMarketPriceFree } from '#/utils/market-price';

const { siteThemeVars } = usePublicSiteTheme();
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
  // 后端 priceLabel 是 "1.0000元/次" 原始格式；前端统一格式化，
  // 与首页价格口径一致（免费 / ¥1/次 / 10 点/次）。
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

function loadMore() {
  pagination.page += 1;
  void query(pagination.page);
}

onMounted(() => {
  void query(1);
});
</script>

<template>
  <main class="market-page" :style="siteThemeVars">
    <PublicSiteHeader active-key="apis" />

    <section class="market-shell">
      <section class="api-list">
        <div class="list-head">
          <div>
            <span>{{ $t('page.public.market.eyebrow') }}</span>
            <h2>{{ $t('page.public.nav.apiList') }}</h2>
          </div>
          <small v-if="pagination.total > 0">
            {{
              $t('page.public.market.totalCount', [
                String(pagination.total),
              ])
            }}
          </small>
        </div>

        <ResponsiveGrid
          v-if="items.length > 0"
          :columns="3"
          :gap="14"
          :mobile-columns="1"
          :tablet-columns="2"
        >
          <RouterLink
            v-for="item in items"
            :key="item.id"
            class="api-card"
            :to="{ name: 'ApiDocs', params: { id: item.id } }"
          >
            <div class="api-card-top">
              <span class="api-icon">
                <img
                  v-if="item.avatarUrl"
                  :alt="item.name"
                  :src="item.avatarUrl"
                />
                <IconifyIcon v-else icon="lucide:boxes" />
              </span>
              <div class="api-tags">
                <span v-if="Number(item.isTop) === 1">
                  {{ $t('page.public.market.tags.top') }}
                </span>
                <span v-if="Number(item.isFeatured) === 1">
                  {{ $t('page.public.market.tags.featured') }}
                </span>
              </div>
              <span class="method-badge">{{
                methodLabel(item.requestMethod)
              }}</span>
            </div>

            <div class="api-card-body">
              <h3>{{ item.name }}</h3>
              <p>
                {{
                  item.description || $t('page.public.market.emptyDescription')
                }}
              </p>
            </div>

            <div class="api-card-foot">
              <div class="api-meta">
                <em :class="priceClass(item)">{{ priceText(item) }}</em>
                <span>
                  {{
                    $t('page.public.market.callCount', [
                      compactNumber(item.callCount),
                    ])
                  }}
                </span>
              </div>
              <span class="api-card-action">
                {{ $t('page.public.market.viewDocs') }}
                <IconifyIcon icon="lucide:arrow-right" />
              </span>
            </div>
          </RouterLink>
        </ResponsiveGrid>
        <div v-else class="empty-state">
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
          class="load-more"
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
    </section>

    <PublicSiteFooter />
  </main>
</template>

<style scoped>
.market-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding-top: 72px;
  font-family:
    'HarmonyOS Sans SC', MiSans, 'Microsoft YaHei UI', 'PingFang SC', sans-serif;
  color: var(--home-text);
  background:
    linear-gradient(90deg, var(--home-grid-line) 1px, transparent 1px),
    linear-gradient(180deg, var(--home-grid-line) 1px, transparent 1px),
    var(--home-background);
  background-size: 72px 72px;
}

.api-meta,
.api-tags {
  display: flex;
  align-items: center;
}

.list-head span {
  font-size: 12px;
  font-weight: 950;
  color: var(--home-primary);
  letter-spacing: 0.08em;
}

.api-card-body p,
.list-head small {
  font-size: 14px;
  font-weight: 700;
  line-height: 1.8;
  color: var(--home-subtle);
}

.load-more {
  width: 100%;
  height: 40px;
  margin-top: 18px;
  font-weight: 850;
  color: var(--home-text);
  cursor: pointer;
  background: var(--home-surface-strong);
  border: 1px solid var(--home-border);
  border-radius: 8px;
}

.market-shell {
  flex: 1 0 auto;
  width: min(100% - 40px, 1320px);
  padding-bottom: 56px;
  margin: 0 auto;
}

.api-card,
.empty-state {
  background: var(--home-surface);
  border: 1px solid var(--home-border);
  border-radius: 8px;
  box-shadow: 0 18px 42px var(--home-shadow);
}

.list-head {
  display: flex;
  gap: 18px;
  align-items: end;
  justify-content: space-between;
  margin-bottom: 16px;
}

.list-head h2 {
  margin: 6px 0 0;
  font-size: 30px;
  font-weight: 950;
}

.api-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.api-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 270px;
  padding: 20px;
  overflow: hidden;
  color: inherit;
  text-decoration: none;
  cursor: pointer;
  background:
    linear-gradient(180deg, var(--home-surface-strong), var(--home-surface)),
    linear-gradient(135deg, rgb(var(--home-primary-rgb) / 9%), transparent 42%);
  border-color: rgb(var(--home-primary-rgb) / 10%);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.api-card::before {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: 3px;
  content: '';
  background: linear-gradient(
    90deg,
    var(--home-primary),
    rgb(var(--home-primary-rgb) / 8%)
  );
  opacity: 0;
  transition: opacity 0.2s ease;
}

.api-card:hover {
  border-color: rgb(var(--home-primary-rgb) / 38%);
  box-shadow:
    0 24px 56px rgb(var(--home-primary-rgb) / 13%),
    0 8px 22px var(--home-shadow-soft);
  transform: translateY(-2px);
}

.api-card:hover::before {
  opacity: 1;
}

.api-card:focus-visible {
  outline: 3px solid rgb(var(--home-primary-rgb) / 28%);
  outline-offset: 3px;
}

.api-card-top {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 16px;
  align-items: center;
}

.api-icon {
  display: inline-grid;
  flex: 0 0 auto;
  place-items: center;
  width: 58px;
  height: 58px;
  font-size: 27px;
  color: var(--home-primary);
  background:
    linear-gradient(
      145deg,
      var(--home-surface-subtle),
      rgb(var(--home-primary-rgb) / 8%)
    ),
    var(--home-primary-soft);
  border: 1px solid rgb(var(--home-primary-rgb) / 16%);
  border-radius: 12px;
  box-shadow:
    inset 0 1px 0 var(--home-inset-highlight),
    0 12px 24px rgb(var(--home-primary-rgb) / 8%);
}

.api-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 12px;
}

.method-badge {
  display: inline-flex;
  flex: 0 0 auto;
  grid-column: 3;
  align-items: center;
  justify-content: center;
  justify-self: end;
  width: max-content;
  height: 30px;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 950;
  color: var(--home-muted);
  white-space: nowrap;
  background: var(--home-chip-background);
  border: 1px solid rgb(var(--home-primary-rgb) / 10%);
  border-radius: 999px;
}

.api-card-body {
  min-width: 0;
}

.api-card-body h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 950;
  line-height: 1.35;
  color: var(--home-heading);
}

.api-card-body p {
  display: -webkit-box;
  min-height: 52px;
  margin: 12px 0 0;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.api-meta,
.api-tags {
  flex-wrap: wrap;
  gap: 8px;
}

.api-card-foot {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
}

.api-card-action {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 6px;
  align-items: center;
  font-size: 13px;
  font-weight: 950;
  color: var(--home-primary);
}

.api-card-action svg {
  font-size: 15px;
  transition: transform 0.2s ease;
}

.api-card:hover .api-card-action svg {
  transform: translateX(3px);
}

.api-meta em,
.api-meta span,
.api-tags span {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 6px 10px;
  font-size: 12px;
  font-style: normal;
  font-weight: 900;
  border-radius: 8px;
}

.api-meta em.free {
  color: var(--home-success);
  background: var(--home-success-soft);
}

.api-meta em.point {
  color: var(--home-warning);
  background: var(--home-warning-soft);
}

.api-meta em.paid {
  color: var(--home-danger);
  background: var(--home-danger-soft);
}

.api-meta span,
.api-tags span {
  color: var(--home-muted);
  background: var(--home-chip-background);
}

.empty-state {
  display: grid;
  place-items: center;
  min-height: 220px;
  padding: 24px;
  font-weight: 850;
  color: var(--home-subtle);
}

.empty-state svg {
  font-size: 34px;
  color: var(--home-text-faint);
}

@media (max-width: 1180px) {
  .api-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .api-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .market-shell {
    padding-bottom: 32px;
  }

  .list-head {
    display: block;
    margin: 0 0 12px;
  }

  .list-head span,
  .list-head small {
    display: none;
  }

  .list-head h2 {
    margin: 0;
    font-size: 20px;
  }

  .api-grid {
    gap: 12px;
  }

  .api-card {
    display: grid;
    grid-template-areas:
      'top body'
      'foot foot';
    grid-template-columns: 48px minmax(0, 1fr);
    gap: 14px;
    min-height: 0;
    padding: 16px;
    border-radius: 12px;
  }

  .api-card::before {
    display: none;
  }

  .api-card-top {
    display: block;
    grid-area: top;
    align-items: start;
  }

  .api-card-top .api-tags {
    display: none;
  }

  .api-icon {
    width: 48px;
    height: 48px;
    font-size: 22px;
    border-radius: 10px;
  }

  .method-badge {
    position: absolute;
    right: 16px;
    bottom: 16px;
    height: 24px;
    padding: 0 8px;
    font-size: 11px;
  }

  .api-card-body {
    grid-area: body;
    padding-right: 0;
  }

  .api-card-body h3 {
    padding-right: 0;
    font-size: 17px;
  }

  .api-card-body p {
    min-height: 0;
    margin-top: 6px;
    font-size: 13px;
    line-height: 1.6;
  }

  .api-card-foot {
    flex-direction: column;
    grid-area: foot;
    gap: 10px;
    align-items: flex-start;
    padding-right: 70px;
    margin-top: 0;
  }

  .api-meta em,
  .api-meta span,
  .api-tags span {
    min-height: 26px;
    padding: 5px 9px;
    font-size: 11px;
    border-radius: 999px;
  }

  .empty-state {
    min-height: 180px;
    border-radius: 12px;
  }
}
</style>
