<script lang="ts" setup>
import type { MarketApi } from '#/api/market';

import { computed } from 'vue';
import { RouterLink } from 'vue-router';

import { formatSettlementPrice } from '#/composables/use-settlement-currency';
import { $t } from '#/locales';
import { isMarketPriceFree } from '#/utils/market-price';

/**
 * 接口市场卡片列表。
 *
 * 整卡即链接（不再额外放按钮），hover 统一「上移 2px + 描边提亮」，
 * 与首页精选接口卡保持一致。
 *
 * 契约由 __tests__/e2e/public-market.spec.ts 固定：
 *   - 列表容器 data-testid="market-ledger"
 *   - 每张卡 data-testid="market-api-item"，且 href 为 /docs/<id>
 *   - 卡内需出现 id、描述、请求方式与调用次数（千分位）
 */
const props = defineProps<{
  items: MarketApi.ApiItem[];
}>();

/** 平台首字标记：用接口名首个字符，避免为每个平台维护图标表 */
function initial(name: string) {
  return String(name || '').trim().slice(0, 1) || '#';
}

/** GET_POST 是后端枚举，界面写成 GET / POST */
function methodLabel(method: MarketApi.RequestMethod) {
  return method === 'GET_POST' ? 'GET / POST' : method;
}

/** 调用次数千分位；后端可能返回字符串，非数字时原样展示 */
function callLabel(value: MarketApi.ApiItem['callCount']) {
  const num = Number(value);
  return Number.isFinite(num) ? num.toLocaleString('en-US') : String(value ?? '');
}

/** 价格跟随站点货币；后端 priceLabel 是固定的人民币文案，不能直接展示。 */
function priceText(item: MarketApi.ApiItem) {
  if (isMarketPriceFree(item.price, item.pointPrice)) {
    return $t('page.public.market.free');
  }
  const points = Number(item.pointPrice ?? 0);
  if (Number.isFinite(points) && points > 0) {
    return $t('page.public.market.pricePoints', [points]);
  }
  return $t('page.public.market.priceBalance', [
    formatSettlementPrice(item.price, 4),
  ]);
}

const cards = computed(() =>
  props.items.map((item) => ({
    ...item,
    calls: callLabel(item.callCount),
    initial: initial(item.name),
    method: methodLabel(item.requestMethod),
  })),
);
</script>

<template>
  <div class="api-grid" data-testid="market-ledger">
    <RouterLink
      v-for="item in cards"
      :key="item.id"
      class="api-card"
      data-testid="market-api-item"
      :to="`/docs/${item.id}`"
    >
      <span class="go" aria-hidden="true">→</span>

      <div class="top">
        <span v-if="item.avatarUrl" class="plat plat--img">
          <img :alt="item.name" loading="lazy" referrerpolicy="no-referrer" :src="item.avatarUrl" />
        </span>
        <span v-else class="plat" aria-hidden="true">{{ item.initial }}</span>
        <div class="top-tx">
          <h3>{{ item.name }}</h3>
          <span class="code">{{ item.apiCode || item.id }}</span>
        </div>
      </div>

      <p class="desc">
        {{ item.description || $t('page.public.market.emptyDescription') }}
      </p>

      <div class="foot">
        <span class="tag tag--method">{{ item.method }}</span>
        <span class="tag tag--price">
          {{ priceText(item) }}
        </span>
        <span v-if="item.isFeatured === 1" class="tag tag--hot">
          {{ $t('page.public.market.tags.featured') }}
        </span>
        <span v-if="item.isTop === 1" class="tag tag--top">
          {{ $t('page.public.market.tags.top') }}
        </span>
        <span class="calls">{{ $t('page.public.market.callCount', [item.calls]) }}</span>
      </div>
    </RouterLink>
  </div>
</template>

<style scoped>
.api-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-top: 18px;
}

@media (max-width: 1024px) {
  .api-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 620px) {
  .api-grid { grid-template-columns: 1fr; gap: 12px; }
}

.api-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  padding: 18px;
  color: inherit;
  text-decoration: none;
  background: var(--home-surface-strong);
  border: 1px solid var(--home-border);
  border-radius: 18px;
  box-shadow: var(--home-card-shadow);
  transition:
    border-color 0.18s cubic-bezier(0.22, 0.61, 0.36, 1),
    box-shadow 0.18s cubic-bezier(0.22, 0.61, 0.36, 1),
    transform 0.18s cubic-bezier(0.22, 0.61, 0.36, 1);
}

/* 与首页精选接口卡一致：上移 2px + 描边提亮 */
.api-card:hover {
  border-color: rgb(var(--home-primary-rgb) / 45%);
  box-shadow: 0 14px 34px var(--home-shadow);
  transform: translateY(-2px);
}

@media (max-width: 920px) {
  .api-card:hover { transform: none; }
}

.go {
  position: absolute;
  top: 16px;
  right: 16px;
  font-size: 15px;
  color: var(--home-text-faint);
  opacity: 0;
  transition:
    opacity 0.18s ease,
    color 0.18s ease;
}

.api-card:hover .go,
.api-card:focus-visible .go {
  color: var(--home-primary);
  opacity: 1;
}

.top {
  display: flex;
  gap: 12px;
  align-items: center;
  min-width: 0;
  padding-right: 26px;
}

.plat {
  display: grid;
  flex: none;
  place-items: center;
  width: 38px;
  height: 38px;
  overflow: hidden;
  font-size: 15px;
  font-weight: 800;
  color: #fff;
  background: var(--home-grad);
  border-radius: 12px;
}

.plat--img { background: var(--home-surface); }

.plat img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.top-tx { min-width: 0; }

.top-tx h3 {
  margin: 0;
  font-size: 15.5px;
  font-weight: 700;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.code {
  display: block;
  margin-top: 2px;
  font-family: var(--font-mono, monospace);
  font-size: 11.5px;
  color: var(--home-text-faint);
  overflow-wrap: anywhere;
}

.desc {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  font-size: 13px;
  line-height: 1.75;
  color: var(--home-muted);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.foot {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  align-items: center;
  margin-top: auto;
}

.tag {
  padding: 4px 10px;
  font-family: var(--font-mono, monospace);
  font-size: 11.5px;
  font-weight: 700;
  border-radius: 999px;
}

.tag--method {
  color: var(--home-primary);
  background: var(--home-grad-soft);
}

.tag--price {
  color: var(--home-success);
  background: rgb(52 211 153 / 13%);
}

.tag--hot {
  color: #fbbf24;
  background: rgb(251 191 36 / 14%);
}

.tag--top {
  color: var(--home-muted);
  background: var(--home-surface);
  border: 1px solid var(--home-border);
}

.calls {
  margin-left: auto;
  font-family: var(--font-mono, monospace);
  font-size: 11.5px;
  color: var(--home-text-faint);
  white-space: nowrap;
}
</style>
