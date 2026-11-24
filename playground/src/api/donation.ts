import { useAppConfig } from '@vben/hooks';

import { requestClient } from '#/api/request';

import { localeRequestHeaders } from './locale';

export namespace DonationApi {
  export type SwitchValue = 0 | 1;

  export interface Method {
    color: string;
    enabled: SwitchValue;
    icon: string;
    key: string;
    name: string;
    qrCodeUrl: string;
    sortNo: number;
    tip: string;
  }

  export interface Config {
    description: string;
    enabled: SwitchValue;
    eyebrow: string;
    id?: number | string;
    methods: Method[];
    scanDescription: string;
    scanTitle: string;
    thanks: string;
    title: string;
    updateTime?: null | string;
  }

  export type SavePayload = Omit<Config, 'id' | 'updateTime'>;

  export interface Supporter {
    amount: string;
    avatarUrl?: string;
    createTime?: string;
    creatorName?: string;
    donatedAt: string;
    id: string;
    message?: string;
    nickname: string;
  }

  export interface CreateSupporterPayload {
    amount: string;
    avatarUrl: string;
    donatedAt: string;
    message: string;
    nickname: string;
  }

  export interface SupporterListParams {
    keyword?: string;
    page: number;
    pageSize: number;
  }

  export interface PageResult<T> {
    items: T[];
    total: number;
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

async function getDonationConfig() {
  return requestClient.get<DonationApi.Config>('/donation/admin/config');
}

async function getDonationSupporters(
  params: DonationApi.SupporterListParams,
) {
  return requestClient.get<DonationApi.PageResult<DonationApi.Supporter>>(
    '/donation/admin/supporters',
    { params },
  );
}

async function createDonationSupporter(
  data: DonationApi.CreateSupporterPayload,
) {
  return requestClient.post<DonationApi.Supporter>(
    '/donation/admin/supporters',
    data,
  );
}

async function updateDonationConfig(data: DonationApi.SavePayload) {
  return requestClient.put('/donation/admin/config', data);
}

async function uploadDonationQRCode(file: File) {
  const result = await requestClient.upload<{ url: string }>(
    '/upload/donation-qr',
    { file },
  );
  return result.url;
}

async function getPublicDonationConfig(signal?: AbortSignal) {
  const { acceptLanguage, appLocale } = localeRequestHeaders();
  const response = await fetch(publicApiUrl('/donation/config'), {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Accept-Language': acceptLanguage,
      'X-App-Locale': appLocale,
    },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Donation request failed with ${response.status}.`);
  }
  const envelope = (await response.json()) as ApiEnvelope<DonationApi.Config>;
  if (Number(envelope.code ?? -1) !== 0 || !envelope.data) {
    throw new Error(envelope.message || 'Donation response is invalid.');
  }
  return envelope.data;
}

async function getPublicDonationSupporters(
  params: DonationApi.SupporterListParams,
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  if (params.keyword?.trim()) query.set('keyword', params.keyword.trim());
  const response = await fetch(
    publicApiUrl(`/donation/supporters?${query.toString()}`),
    {
      credentials: 'include',
      headers: { Accept: 'application/json' },
      signal,
    },
  );
  if (!response.ok) {
    throw new Error(`Donation supporters request failed with ${response.status}.`);
  }
  const envelope = (await response.json()) as ApiEnvelope<
    DonationApi.PageResult<DonationApi.Supporter>
  >;
  if (Number(envelope.code ?? -1) !== 0 || !envelope.data) {
    throw new Error(envelope.message || 'Donation supporters response is invalid.');
  }
  return {
    items: envelope.data.items ?? [],
    total: Number(envelope.data.total ?? 0),
  };
}

export {
  createDonationSupporter,
  getDonationConfig,
  getDonationSupporters,
  getPublicDonationConfig,
  getPublicDonationSupporters,
  updateDonationConfig,
  uploadDonationQRCode,
};
