<script setup lang="ts">
import type { MarketFilterState } from '../market-filters';

import { computed, shallowRef, watch } from 'vue';

import { $t } from '#/locales';

const props = defineProps<{
  modelValue: MarketFilterState;
  resultLabel: string;
}>();

const emit = defineEmits<{
  'remove-filter': [key: keyof MarketFilterState];
  submit: [value: MarketFilterState];
  'update:modelValue': [value: MarketFilterState];
}>();

const keywordDraft = shallowRef(props.modelValue.keyword);

const requestMethod = computed({
  get: () => props.modelValue.requestMethod,
  set: (value: MarketFilterState['requestMethod']) =>
    updateFilter('requestMethod', value),
});

const priceType = computed({
  get: () => props.modelValue.priceType,
  set: (value: MarketFilterState['priceType']) =>
    updateFilter('priceType', value),
});

const featuredOnly = computed({
  get: () => props.modelValue.featuredOnly,
  set: (value: boolean) => updateFilter('featuredOnly', value),
});

const activeFilters = computed(() => {
  const filters: Array<{
    key: keyof MarketFilterState;
    label: string;
    value: string;
  }> = [];
  if (props.modelValue.keyword) {
    filters.push({
      key: 'keyword',
      label: $t('page.public.market.search'),
      value: props.modelValue.keyword,
    });
  }
  if (props.modelValue.requestMethod) {
    filters.push({
      key: 'requestMethod',
      label: $t('page.public.market.filters.chipMethod'),
      value: props.modelValue.requestMethod,
    });
  }
  if (props.modelValue.priceType) {
    filters.push({
      key: 'priceType',
      label: $t('page.public.market.filters.chipPrice'),
      value: priceTypeLabel(props.modelValue.priceType),
    });
  }
  if (props.modelValue.featuredOnly) {
    filters.push({
      key: 'featuredOnly',
      label: $t('page.public.market.filters.featured'),
      value: $t('page.public.market.tags.featured'),
    });
  }
  return filters;
});

watch(
  () => props.modelValue.keyword,
  (keyword) => {
    keywordDraft.value = keyword;
  },
);

function updateFilter<Key extends keyof MarketFilterState>(
  key: Key,
  value: MarketFilterState[Key],
) {
  emit('update:modelValue', { ...props.modelValue, [key]: value });
}

function priceTypeLabel(value: MarketFilterState['priceType']) {
  if (value === 'FREE') return $t('page.public.market.filters.priceFree');
  if (value === 'PAID') return $t('page.public.market.filters.pricePaid');
  if (value === 'POINT') return $t('page.public.market.filters.pricePoint');
  return $t('page.public.market.filters.all');
}

function submit() {
  emit('submit', {
    ...props.modelValue,
    keyword: keywordDraft.value.trim(),
  });
}
</script>

<template>
  <section class="market-filter-bar" :aria-label="$t('page.public.market.filters.label')">
    <form class="search-box" role="search" @submit.prevent="submit">
      <input
        v-model="keywordDraft"
        class="search-input"
        type="search"
        :aria-label="$t('page.public.market.searchAria')"
        :placeholder="$t('page.public.market.searchPlaceholder')"
      />
      <button class="search-button" type="submit">
        {{ $t('page.public.market.searchAria') }}
      </button>
    </form>

    <div class="filter-row">
      <label class="filter-control">
        <span>{{ $t('page.public.market.filters.methodLabel') }}</span>
        <select v-model="requestMethod" data-testid="market-filter-method">
          <option value="">{{ $t('page.public.market.filters.all') }}</option>
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="GET_POST">GET / POST</option>
        </select>
      </label>

      <label class="filter-control">
        <span>{{ $t('page.public.market.filters.priceLabel') }}</span>
        <select v-model="priceType" data-testid="market-filter-price">
          <option value="">{{ $t('page.public.market.filters.all') }}</option>
          <option value="FREE">{{ $t('page.public.market.filters.priceFree') }}</option>
          <option value="PAID">{{ $t('page.public.market.filters.pricePaid') }}</option>
          <option value="POINT">{{ $t('page.public.market.filters.pricePoint') }}</option>
        </select>
      </label>

      <label class="featured-control" data-testid="market-filter-featured">
        <input v-model="featuredOnly" type="checkbox" />
        <span>{{ $t('page.public.market.filters.featured') }}</span>
      </label>

      <span class="result-label">{{ props.resultLabel }}</span>
    </div>

    <div
      v-if="activeFilters.length"
      class="active-filters"
      data-testid="market-active-filters"
      :aria-label="$t('page.public.market.filters.active')"
    >
      <span v-for="filter in activeFilters" :key="filter.key" class="filter-chip">
        <span>{{ filter.label }}: {{ filter.value }}</span>
        <button
          :data-testid="`market-remove-${filter.key}`"
          type="button"
          :aria-label="$t('page.public.market.filters.remove', [filter.value])"
          @click="emit('remove-filter', filter.key)"
        >
          ×
        </button>
      </span>
    </div>
  </section>
</template>

<style scoped>
.market-filter-bar {
  padding: 18px;
  background: var(--ps-bg-elevated);
  border: 1px solid var(--ps-border);
  border-radius: 16px;
  box-shadow: 0 14px 36px var(--ps-shadow);
}

/* public-theme.spec.ts 用 .search-box 作为市场页的内容外壳并断言它是
   「可见的深色表面」，所以这里必须有真实底色，不能只当栅格容器用。 */
.search-box {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  padding: 10px;
  background: var(--ps-surface);
  border: 1px solid var(--ps-border);
  border-radius: 12px;
}

.search-input,
.filter-control select,
.search-button {
  min-height: 44px;
  border-radius: 10px;
}

.search-input,
.filter-control select {
  min-width: 0;
  color: var(--ps-text);
  background: var(--ps-surface);
  border: 1px solid var(--ps-border);
}

.search-input {
  width: 100%;
  padding: 0 14px;
}

.search-button {
  min-width: 112px;
  padding: 0 20px;
  font-weight: 700;
  color: #fff;
  cursor: pointer;
  background: var(--ps-primary);
  border: 0;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: end;
  margin-top: 14px;
}

.filter-control {
  display: grid;
  gap: 6px;
  min-width: 156px;
  font-size: 12px;
  color: var(--ps-muted);
}

.filter-control select {
  padding: 0 36px 0 12px;
  font-size: 13px;
}

.featured-control {
  display: inline-flex;
  gap: 9px;
  align-items: center;
  min-height: 44px;
  padding: 0 14px;
  font-size: 13px;
  font-weight: 650;
  color: var(--ps-text);
  cursor: pointer;
  background: var(--ps-surface);
  border: 1px solid var(--ps-border);
  border-radius: 10px;
}

.featured-control input {
  width: 18px;
  height: 18px;
  accent-color: var(--ps-primary);
}

.result-label {
  margin: 0 0 12px auto;
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  color: var(--ps-muted);
}

.active-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding-left: 12px;
  overflow: hidden;
  font-size: 12px;
  font-weight: 650;
  color: var(--ps-primary);
  background: rgb(var(--ps-primary-rgb) / 10%);
  border: 1px solid rgb(var(--ps-primary-rgb) / 30%);
  border-radius: 999px;
}

.filter-chip > span {
  overflow-wrap: anywhere;
}

.filter-chip button {
  display: grid;
  flex: none;
  width: 44px;
  height: 44px;
  padding: 0;
  color: inherit;
  cursor: pointer;
  background: transparent;
  border: 0;
  place-items: center;
}

:is(.search-input, .filter-control select, .featured-control, .search-button, .filter-chip button):focus-visible {
  outline: 2px solid var(--ps-primary);
  outline-offset: 2px;
}

@media (max-width: 640px) {
  .market-filter-bar {
    padding: 14px;
  }

  .search-box {
    grid-template-columns: 1fr;
  }

  .search-button {
    width: 100%;
  }

  .filter-row {
    display: grid;
    grid-template-columns: 1fr;
  }

  .filter-control,
  .featured-control {
    width: 100%;
  }

  .result-label {
    margin: 0;
  }
}
</style>
