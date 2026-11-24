import type { Recordable } from '@vben/types';

import { useAppConfig } from '@vben/hooks';

import { requestClient } from '#/api/request';

import { localeRequestHeaders } from './locale';

interface ApiEnvelope<T> {
  code?: number;
  data?: T;
  error?: string;
  message?: string;
}

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);

function publicApiUrl(path: string) {
  return `${String(apiURL || '').replace(/\/$/, '')}${path}`;
}

export namespace MarketApi {
  export type RequestMethod = 'GET' | 'GET_POST' | 'POST';
  export type PriceType = 'FREE' | 'PAID' | 'POINT';

  export interface ApiItem {
    apiCode?: string;
    avatarUrl?: string;
    callCount: number | string;
    description: string;
    id: string;
    isFeatured: 0 | 1;
    isTop: 0 | 1;
    name: string;
    pointPrice: number | string;
    price: number | string;
    priceLabel: string;
    requestMethod: RequestMethod;
    updateTime?: string;
  }

  export interface ApiParameter {
    description: string;
    exampleValue?: string;
    location: 'Body' | 'Header' | 'Path' | 'Query';
    name: string;
    placeholder?: string;
    required: boolean;
    type: string;
  }

  export interface ApiStatusCode {
    code: number | string;
    description: string;
  }

  export interface ApiResponseField {
    description: string;
    name: string;
    type: string;
  }

  export interface ApiTrendItem {
    date: string;
    label: string;
    value: number | string;
  }

  export interface ApiPricing {
    description: string;
    label: string;
    pointPrice: number | string;
    price: number | string;
  }

  export interface ApiDocResponseFormat {
    example?: string;
    type: string;
  }

  export interface ApiDetail extends ApiItem {
    auth: {
      description: string;
      location: string;
      name: string;
      type: string;
    };
    callTrend7d: ApiTrendItem[];
    gatewayPath: string;
    gatewayUrlTemplate: string;
    notice?: string;
    parameters: ApiParameter[];
    preferredMethod: 'GET' | 'POST' | RequestMethod;
    pricing: ApiPricing;
    responseExample?: string;
    responseFields: ApiResponseField[];
    responseFormats?: ApiDocResponseFormat[];
    responseType: 'FILE' | 'HTML' | 'JSON' | 'SSE' | 'TEXT' | 'XML';
    statusCodes: ApiStatusCode[];
    templateParameters: string[];
  }

  export interface ApiTestKey {
    hasKey: boolean;
    keyScope: '' | 'GLOBAL' | 'INTERFACE';
    keys: ApiTestKeyOption[];
    maskedKey?: string;
    message: string;
  }

  export interface ApiTestKeyOption {
    expiresAt?: string;
    id: string;
    keyScope: 'GLOBAL' | 'INTERFACE';
    maskedKey: string;
    name: string;
    secretAvailable: boolean;
  }

  export interface ApiListParams extends Recordable<any> {
    featuredOnly?: 0 | 1;
    keyword?: string;
    page?: number;
    pageSize?: number;
    priceType?: PriceType;
    requestMethod?: RequestMethod;
  }
}

async function getMarketApis(params: MarketApi.ApiListParams) {
  return requestClient.get<{
    items: MarketApi.ApiItem[];
    total: number;
  }>('/market/apis', { params });
}

async function getMarketApiDetail(id: number | string) {
  const { acceptLanguage, appLocale } = localeRequestHeaders();
  const response = await fetch(
    publicApiUrl(`/market/apis/${encodeURIComponent(String(id))}`),
    {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Accept-Language': acceptLanguage,
        'X-App-Locale': appLocale,
      },
    },
  );
  let envelope: ApiEnvelope<MarketApi.ApiDetail> | undefined;
  try {
    envelope = (await response.json()) as ApiEnvelope<MarketApi.ApiDetail>;
  } catch {
    // The caller renders the public error state; keep the HTTP status below.
  }
  if (!response.ok || Number(envelope?.code ?? -1) !== 0 || !envelope?.data) {
    throw Object.assign(
      new Error(
        envelope?.error ||
          envelope?.message ||
          `Market detail request failed with ${response.status}.`,
      ),
      { status: response.status },
    );
  }
  return envelope.data;
}

async function getMarketApiTestKey(id: number | string) {
  return requestClient.get<MarketApi.ApiTestKey>(`/market/apis/${id}/test-key`);
}

export { getMarketApiDetail, getMarketApis, getMarketApiTestKey };
