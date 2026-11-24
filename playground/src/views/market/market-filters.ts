import type { MarketApi } from '#/api/market';

export interface MarketFilterState {
  featuredOnly: boolean;
  keyword: string;
  priceType: '' | MarketApi.PriceType;
  requestMethod: '' | MarketApi.RequestMethod;
}

function firstQuery(value: unknown) {
  return String((Array.isArray(value) ? value[0] : value) ?? '').trim();
}

export function parseMarketFilters(query: Record<string, unknown>): MarketFilterState {
  const method = firstQuery(query.requestMethod);
  const price = firstQuery(query.priceType).toUpperCase();
  return {
    featuredOnly: firstQuery(query.featuredOnly) === '1',
    keyword: firstQuery(query.keyword),
    priceType: price === 'FREE' || price === 'PAID' || price === 'POINT' ? price : '',
    requestMethod: method === 'GET' || method === 'POST' || method === 'GET_POST' ? method : '',
  };
}

export function serializeMarketFilters(filters: MarketFilterState) {
  const query: Record<string, string> = {};
  if (filters.keyword.trim()) query.keyword = filters.keyword.trim();
  if (filters.requestMethod) query.requestMethod = filters.requestMethod;
  if (filters.priceType) query.priceType = filters.priceType;
  if (filters.featuredOnly) query.featuredOnly = '1';
  return query;
}

export function isCanonicalMarketQuery(query: Record<string, unknown>, canonical: Record<string, string>) {
  return Object.keys(query).length === Object.keys(canonical).length &&
    Object.entries(canonical).every(([key, value]) => query[key] === value);
}
