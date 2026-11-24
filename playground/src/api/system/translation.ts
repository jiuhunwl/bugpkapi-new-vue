import { requestClient } from '#/api/request';

export namespace TranslationApi {
  export interface Locale {
    code: string;
    fallbackCode?: string;
    enabled: boolean;
    isDefault: boolean;
    label: string;
    sortNo: number;
  }

  export interface FieldInfo {
    html: boolean;
    labelKey: string;
    maxBytes: number;
    name: string;
  }

  export interface ResourceTypeInfo {
    /** 源表条目总数；旧后端不返回该字段。 */
    count?: number;
    fields: FieldInfo[];
    labelKey: string;
    type: string;
  }

  export interface Completeness {
    total: number;
    translated: number;
  }

  export interface ResourceItem {
    baseLocale: string;
    completeness: Record<string, Completeness>;
    displayName: string;
    fields: string[];
    resourceKey: string;
    resourceType: string;
    staleFields?: Record<string, string[]>;
    translations: Record<string, Record<string, string>>;
    values: Record<string, string>;
  }

  export interface ResourceList {
    items: ResourceItem[];
    total: number;
  }

  export interface ResourceListParams {
    keyword?: string;
    page?: number;
    pageSize?: number;
    resourceType: string;
  }

  export interface SaveTranslationsPayload {
    translations: Record<string, Record<string, string>>;
  }

  export interface SaveTranslationsResult {
    deleted: number;
    saved: number;
  }
}

async function getTranslationLocales() {
  return requestClient.get<TranslationApi.Locale[]>('/i18n/locales');
}

async function getTranslationResourceTypes() {
  return requestClient.get<TranslationApi.ResourceTypeInfo[]>(
    '/i18n/resource-types',
  );
}

async function getTranslationResources(
  params: TranslationApi.ResourceListParams,
) {
  return requestClient.get<TranslationApi.ResourceList>('/i18n/resources', {
    params,
  });
}

async function getTranslationResource(resourceType: string, resourceKey: string) {
  return requestClient.get<TranslationApi.ResourceItem>(
    `/i18n/resources/${encodeURIComponent(resourceType)}/${encodeURIComponent(resourceKey)}`,
  );
}

async function saveTranslationResource(
  resourceType: string,
  resourceKey: string,
  data: TranslationApi.SaveTranslationsPayload,
) {
  return requestClient.put<TranslationApi.SaveTranslationsResult>(
    `/i18n/resources/${encodeURIComponent(resourceType)}/${encodeURIComponent(resourceKey)}`,
    data,
  );
}

async function saveTranslationLocales(locales: TranslationApi.Locale[]) {
  return requestClient.put<TranslationApi.Locale[]>('/i18n/locales', {
    locales,
  });
}

export {
  getTranslationLocales,
  getTranslationResource,
  getTranslationResources,
  getTranslationResourceTypes,
  saveTranslationLocales,
  saveTranslationResource,
};
