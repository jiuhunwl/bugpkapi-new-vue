import type { Recordable } from '@vben/types';

import { useAppConfig } from '@vben/hooks';

import { requestClient } from '#/api/request';

import { localeRequestHeaders } from './locale';

export namespace AdvertisementApi {
  export type Placement =
    | 'API_RESPONSE'
    | 'CONSOLE'
    | 'HOME'
    | 'NOTICE'
    | 'SERVICE_PROVIDER';
  export type PublicPlacement = Exclude<Placement, 'API_RESPONSE'>;

  export interface PublicAdvertisement {
    description?: string;
    id: string;
    imageUrl?: string;
    linkTarget: '_blank' | '_self';
    linkUrl?: string;
    placement: Placement;
    title: string;
  }

  export interface Advertisement extends PublicAdvertisement {
    createTime?: string;
    endTime?: string;
    name: string;
    payload?: Record<string, unknown>;
    sortNo: number;
    startTime?: string;
    status: 0 | 1;
    updateTime?: string;
  }

  export interface ListParams extends Recordable<any> {
    keyword?: string;
    page?: number;
    pageSize?: number;
    placement?: Placement;
    status?: 0 | 1;
  }

  export interface SavePayload {
    description: string;
    endTime: string;
    imageUrl: string;
    linkTarget: '_blank' | '_self';
    linkUrl: string;
    name: string;
    payload: Record<string, unknown>;
    placement: Placement;
    sortNo: number;
    startTime: string;
    status: 0 | 1;
    title: string;
  }
}

interface ApiEnvelope<T> {
  code?: number;
  data?: T;
  message?: string;
}

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);

function publicApiUrl(path: string) {
  return `${String(apiURL || '').replace(/\/$/, '')}${path}`;
}

async function getPublicAdvertisements(
  placement: AdvertisementApi.PublicPlacement,
  signal?: AbortSignal,
) {
  const { acceptLanguage, appLocale } = localeRequestHeaders();
  const response = await fetch(
    publicApiUrl(
      `/advertisement/public?placement=${encodeURIComponent(placement)}`,
    ),
    {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Accept-Language': acceptLanguage,
        'X-App-Locale': appLocale,
      },
      signal,
    },
  );
  if (!response.ok) {
    throw new Error(`Advertisement request failed with ${response.status}.`);
  }
  const envelope = (await response.json()) as ApiEnvelope<
    AdvertisementApi.PublicAdvertisement[]
  >;
  if (Number(envelope.code ?? -1) !== 0 || !Array.isArray(envelope.data)) {
    throw new Error(envelope.message || 'Advertisement response is invalid.');
  }
  return envelope.data;
}

async function getAdminAdvertisementList(
  params: AdvertisementApi.ListParams,
) {
  return requestClient.get<{
    items: AdvertisementApi.Advertisement[];
    total: number;
  }>('/advertisement/admin/list', { params });
}

async function getAdminAdvertisementDetail(id: string) {
  return requestClient.get<AdvertisementApi.Advertisement>(
    `/advertisement/admin/${id}`,
  );
}

async function createAdvertisement(data: AdvertisementApi.SavePayload) {
  return requestClient.post<AdvertisementApi.Advertisement>(
    '/advertisement/admin',
    data,
  );
}

async function updateAdvertisement(
  id: string,
  data: AdvertisementApi.SavePayload,
) {
  return requestClient.put(`/advertisement/admin/${id}`, data);
}

async function deleteAdvertisement(id: string) {
  return requestClient.delete(`/advertisement/admin/${id}`);
}

export {
  createAdvertisement,
  deleteAdvertisement,
  getAdminAdvertisementDetail,
  getAdminAdvertisementList,
  getPublicAdvertisements,
  updateAdvertisement,
};
