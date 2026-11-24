<script setup lang="ts">
import type { MarketApi } from '#/api/market';
import type { MarketFilterState } from './market-filters';

import { computed, onBeforeUnmount, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { getMarketApis } from '#/api/market';
import PublicPageState from '#/components/public-page-state.vue';
import PublicSiteShell from '#/components/public-site-shell.vue';
import { $t } from '#/locales';

import MarketApiLedger from './components/MarketApiLedger.vue';
import MarketFilterBar from './components/MarketFilterBar.vue';
import { isCanonicalMarketQuery, parseMarketFilters, serializeMarketFilters } from './market-filters';

const route = useRoute();
const router = useRouter();
const filters = computed({
  get: () => parseMarketFilters(route.query),
  set: (value: MarketFilterState) => {
    const query = serializeMarketFilters(value);
    if (!isCanonicalMarketQuery(route.query, query)) {
      void router.replace({ path: '/apilist', query, hash: route.hash });
    }
  },
});

const items = shallowRef<MarketApi.ApiItem[]>([]);
const loading = shallowRef(false);
const failed = shallowRef(false);
const page = shallowRef(0);
const total = shallowRef<null | number>(null);
const totalLabel = computed(() => $t('page.public.market.totalCount', [total.value ?? '—']));
const canLoadMore = computed(() => total.value !== null && items.value.length < total.value);
let requestSequence = 0;

async function loadApis(reset = true) {
  if (!reset && (loading.value || !canLoadMore.value)) return;
  const sequence = ++requestSequence;
  const nextPage = reset ? 1 : page.value + 1;
  const selected = filters.value;
  if (reset) {
    items.value = [];
    total.value = null;
    page.value = 0;
  }
  loading.value = true;
  failed.value = false;
  try {
    const result = await getMarketApis({
      featuredOnly: selected.featuredOnly ? 1 : undefined,
      keyword: selected.keyword || undefined,
      page: nextPage,
      pageSize: 12,
      priceType: selected.priceType || undefined,
      requestMethod: selected.requestMethod || undefined,
    });
    if (sequence !== requestSequence) return;
    const nextItems = result.items ?? [];
    items.value = reset ? nextItems : [...items.value, ...nextItems];
    total.value = result.total;
    // Advance only after success so retry cannot skip a failed page.
    page.value = nextPage;
  } catch {
    if (sequence === requestSequence) failed.value = true;
  } finally {
    if (sequence === requestSequence) loading.value = false;
  }
}

// 筛选条把「输入框里的草稿关键词」随 submit 一起带上来。这里必须先写回
// filters（进而同步到 URL query），再让 query watcher 去触发请求；
// 旧实现丢掉了这个参数，直接 loadApis()，导致关键词永远进不了地址栏。
function submitSearch(next?: MarketFilterState) {
  // 不能因为「有请求在飞」就拒绝新搜索：旧请求可能卡在慢上游上，
  // 用户改了条件必须立刻生效。loadApis 里的 requestSequence already
  // 保证过期响应会被丢弃，所以这里放行即可。
  if (next) {
    const canonical = serializeMarketFilters(next);
    if (!isCanonicalMarketQuery(route.query, canonical)) {
      // query 变化会被 watcher 捕获并发起请求，这里不重复调用
      filters.value = next;
      return;
    }
  }
  void loadApis();
}

function removeFilter(key: keyof MarketFilterState) {
  filters.value = { ...filters.value, [key]: key === 'featuredOnly' ? false : '' };
}

watch(
  () => route.query,
  (query) => {
    const canonical = serializeMarketFilters(parseMarketFilters(query));
    if (!isCanonicalMarketQuery(query, canonical)) {
      void router.replace({ path: '/apilist', query: canonical, hash: route.hash });
      return;
    }
    void loadApis();
  },
  { immediate: true },
);
onBeforeUnmount(() => { requestSequence += 1; });
</script>

<template>
  <PublicSiteShell active-key="market" class="market-page" main-id="market-main">
    <header class="page-head">
      <div class="ph-copy">
        <span class="eyebrow">{{ $t('page.public.market.eyebrow') }}</span>
        <h1 class="page-title">{{ $t('page.public.market.allApis') }}</h1>
        <p class="page-description">{{ $t('page.public.market.publicFieldNotice') }}</p>
      </div>
      <span class="count-badge" data-testid="market-total" aria-live="polite">{{ totalLabel }}</span>
    </header>

    <div class="market-body">
      <MarketFilterBar v-model="filters" :result-label="totalLabel" @submit="submitSearch" @remove-filter="removeFilter" />
      <div id="catalog" class="market-results" :aria-busy="loading">
        <MarketApiLedger v-if="items.length" :items="items" />
        <PublicPageState v-else-if="loading" data-testid="market-loading" icon="lucide:loader-circle" :title="$t('page.public.market.loading')" />
        <PublicPageState v-else-if="!failed" data-testid="market-empty" icon="lucide:search-x" :title="$t('page.public.market.empty')" />
        <div v-if="failed" class="market-error" data-testid="market-error" role="alert">
          <PublicPageState icon="lucide:cloud-off" tone="danger" :title="$t('page.public.market.error')" :description="$t('page.public.market.errorDescription')">
            <template #action>
              <button class="retry-button" data-testid="market-retry" type="button" @click="loadApis(page === 0)">{{ $t('page.public.market.retry') }}</button>
            </template>
          </PublicPageState>
        </div>
        <button v-if="canLoadMore && !failed" class="load-more" data-testid="market-load-more" :disabled="loading" type="button" @click="loadApis(false)">
          {{ loading ? $t('page.public.market.loadingMore') : $t('page.public.market.loadMore') }}
        </button>
      </div>
    </div>
  </PublicSiteShell>
</template>

<style scoped>
.page-head { display: flex; align-items: end; justify-content: space-between; gap: 16px; padding: 44px 0 6px; }
.ph-copy { min-width: 0; }
.eyebrow { display: inline-block; margin-bottom: 9px; font-family: var(--font-mono, monospace); font-size: 12px; font-weight: 700; letter-spacing: .14em; color: var(--ps-primary); }
.page-title { font-size: clamp(26px, 3.4vw, 40px); font-weight: 800; letter-spacing: -.4px; }
.page-description { max-width: 70ch; margin-top: 8px; font-size: 13.5px; color: var(--ps-muted); overflow-wrap: anywhere; }
.count-badge { flex: none; padding: 8px 16px; font-family: var(--font-mono, monospace); font-size: 12.5px; font-weight: 700; color: var(--ps-primary); background: rgb(var(--ps-primary-rgb) / 10%); border: 1px solid rgb(var(--ps-primary-rgb) / 30%); border-radius: 999px; }
.market-body { padding: 18px 0 40px; }
.market-results { margin-top: 20px; scroll-margin-top: 84px; }
.market-error { margin-top: 16px; }
.load-more, .retry-button { min-height: 44px; padding: 10px 20px; color: var(--ps-text); cursor: pointer; background: var(--ps-bg-elevated); border: 1px solid var(--ps-border); border-radius: 10px; }
.load-more { width: 100%; min-height: 50px; margin-top: 18px; font-weight: 700; }
.load-more:hover, .retry-button:hover { color: var(--ps-primary); border-color: var(--ps-primary); }
.load-more:disabled { cursor: wait; opacity: .6; }
.load-more:focus-visible, .retry-button:focus-visible { outline: 2px solid var(--ps-primary); outline-offset: 3px; }
@media (max-width: 640px) {
  .page-head { flex-direction: column; align-items: flex-start; padding-top: 34px; }
}
</style>
