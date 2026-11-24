import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';
import { $t } from '#/locales';

export namespace KeyApi {
  export type KeyScope = 'GLOBAL' | 'INTERFACE';
  export type KeyOwnerScope = 'all' | 'mine';

  export interface KeyItem {
    createTime?: string;
    expiresAt?: string;
    id: string;
    interfaceCount?: number | string;
    interfaceIds?: Array<number | string>;
    interfaceName: string;
    ipWhitelist?: string;
    keyPrefix?: string;
    keyScope: KeyScope;
    keyType?: KeyScope;
    lastUsedAt?: string;
    maskedKey: string;
    name: string;
    secretAvailable: boolean;
    status: 0 | 1;
    /**
     * 账号封禁联动标记，仅用于展示 Key 停用的来源：
     * 0=未暂停 1=临时封禁暂停 2=永久封禁作废。
     * 两种标记都会在账号解封时一并清零并恢复启用。
     *
     * 不要用这个字段推断账号当前是否被封禁：它只是封禁动作在 Key 上的历史
     * 投影，账号是否可用由后端按 bp_user 统一判定（封禁即 403 并附带原因）。
     */
    suspendedByBan?: 0 | 1 | 2;
    updateTime?: string;
    username?: string;
    whitelistCount?: number | string;
  }

  export interface CreatedKey extends KeyItem {
    secretKey: string;
  }

  export interface InterfaceOption {
    apiCode: string;
    id: string;
    label: string;
    name: string;
    pointPrice: number | string;
    price: number | string;
    requestMethod: 'GET' | 'GET_POST' | 'POST';
  }

  export interface KeyListParams extends Recordable<any> {
    keyType?: KeyScope;
    keyword?: string;
    page?: number;
    pageSize?: number;
    /** Which account's keys to list; omitted keeps the backend default. */
    scope?: KeyOwnerScope;
    status?: 0 | 1;
  }
}

interface BackendKeyItem {
  createTime?: string;
  id: string;
  interfaceCount?: number | string;
  interfaceIds?: Array<number | string>;
  ipWhitelist?: string[];
  keyPrefix?: string;
  keySuffix?: string;
  keyType: KeyApi.KeyScope;
  lastUsedAt?: string;
  maskedKey?: string;
  name: string;
  secretAvailable?: boolean;
  secretKey?: string;
  status: 0 | 1;
  updateTime?: string;
  username?: string;
  whitelistCount?: number | string;
}

function normalizeKey(row: BackendKeyItem): KeyApi.KeyItem {
  const keyScope = row.keyType || 'INTERFACE';
  return {
    ...row,
    interfaceName:
      keyScope === 'GLOBAL'
        ? $t('system.key.interfaceScopeAllEnabled')
        : $t('system.key.interfaceScopeBound', [row.interfaceCount ?? 0]),
    ipWhitelist: (row.ipWhitelist ?? []).join('\n'),
    keyScope,
    keyType: keyScope,
    maskedKey: row.maskedKey || '',
    secretAvailable: Boolean(row.secretAvailable),
  };
}

function splitWhitelist(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(value ?? '')
    .split(/[,;\n\r]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function getKeyList(params: KeyApi.KeyListParams, signal?: AbortSignal) {
  const { scope, ...rest } = params;
  const result = await requestClient.get<{
    items: BackendKeyItem[];
    total: number;
  }>('/key/list', {
    params: {
      ...rest,
      ...(scope ? { scope } : {}),
    },
    signal,
  });
  return {
    items: (result.items ?? []).map(normalizeKey),
    total: result.total,
  };
}

async function getAllKeyOptions(scope: KeyApi.KeyOwnerScope) {
  const items: Array<{ id: string; label: string }> = [];
  const pageSize = 100;
  let page = 1;
  let total = Number.POSITIVE_INFINITY;
  while (items.length < total) {
    const result = await getKeyList({ page, pageSize, scope });
    total = Number(result.total) || 0;
    for (const key of result.items ?? []) {
      const prefix = String(key.keyPrefix || key.maskedKey || '').trim();
      items.push({
        id: String(key.id),
        label: `#${key.id} · ${key.name}${prefix ? ` (${prefix})` : ''}`,
      });
    }
    if (!result.items?.length || result.items.length < pageSize) break;
    page += 1;
  }
  return items;
}

async function getKeyDetail(id: string) {
  const result = await requestClient.get<BackendKeyItem>(`/key/${id}`);
  return normalizeKey(result);
}

async function getKeySecret(id: string) {
  return requestClient.get<{ secretKey: string }>(`/key/${id}/secret`);
}

async function getKeyInterfaceOptions() {
  type MarketInterface = {
    apiCode: string;
    id: number | string;
    name: string;
    pointPrice: number | string;
    price: number | string;
    requestMethod: KeyApi.InterfaceOption['requestMethod'];
  };

  // The market endpoint is user-accessible and only exposes enabled APIs.
  const items: MarketInterface[] = [];
  const seenIds = new Set<string>();
  const pageSize = 100;
  let fetched = 0;
  let page = 1;
  let total = Number.POSITIVE_INFINITY;
  while (fetched < total) {
    const result = await requestClient.get<{
      items: MarketInterface[];
      total: number;
    }>('/market/apis', {
      params: { page, pageSize },
    });
    const pageItems = result.items ?? [];
    total = Math.max(0, Number(result.total) || 0);
    fetched += pageItems.length;
    for (const item of pageItems) {
      const id = String(item.id);
      if (!seenIds.has(id)) {
        seenIds.add(id);
        items.push(item);
      }
    }
    if (pageItems.length === 0 || pageItems.length < pageSize) break;
    page += 1;
  }

  return items.map((item) => {
    const apiCode = String(item.apiCode ?? '').trim();
    return {
      apiCode,
      id: String(item.id),
      label: apiCode ? `${item.name} (${apiCode})` : item.name,
      name: item.name,
      pointPrice: item.pointPrice,
      price: item.price,
      requestMethod: item.requestMethod,
    } satisfies KeyApi.InterfaceOption;
  });
}

async function createKey(data: {
  interfaceIds?: Array<number | string>;
  keyScope: KeyApi.KeyScope;
  name?: string;
}): Promise<KeyApi.CreatedKey> {
  const interfaceIds =
    data.keyScope === 'GLOBAL'
      ? []
      : (data.interfaceIds ?? []).filter(Boolean).map((item) => Number(item));
  const result = await requestClient.post<BackendKeyItem>('/key', {
    interfaceIds,
    ipWhitelist: [],
    keyType: data.keyScope,
    name:
      data.name ||
      $t(
        data.keyScope === 'GLOBAL'
          ? 'system.key.defaultGlobalKeyName'
          : 'system.key.defaultInterfaceKeyName',
      ),
    status: 1,
  });
  return {
    ...normalizeKey(result),
    secretKey: String(result.secretKey || '').trim(),
  };
}

async function getKeyInterfaces(id: string) {
  const result = await requestClient.get<{
    interfaceIds: Array<number | string>;
  }>(`/key/${id}/interfaces`);
  return (result.interfaceIds ?? []).map((item) => String(item));
}

async function updateKeyInterfaces(
  id: string,
  interfaceIds: Array<number | string>,
) {
  return requestClient.put(`/key/${id}/interfaces`, {
    interfaceIds: interfaceIds.map((item) => Number(item)),
  });
}

async function getKeyIpWhitelist(id: string) {
  const result = await requestClient.get<{ ipWhitelist: string[] }>(
    `/key/${id}/ip-whitelist`,
  );
  return result.ipWhitelist ?? [];
}

async function updateKey(
  id: string,
  data: {
    expiresAt?: string;
    interfaceIds?: Array<number | string>;
    ipWhitelist?: string[];
    keyType?: KeyApi.KeyScope;
    name: string;
    status?: 0 | 1;
  },
) {
  return requestClient.put(`/key/${id}`, {
    ...data,
    ...(data.interfaceIds
      ? { interfaceIds: data.interfaceIds.map((item) => Number(item)) }
      : {}),
  });
}

async function updateKeyStatus(id: string, status: 0 | 1) {
  return requestClient.put(`/key/${id}/status`, { status });
}

async function updateKeyIpWhitelist(id: string, ipWhitelist: string) {
  return requestClient.put(`/key/${id}/ip-whitelist`, {
    ipWhitelist: splitWhitelist(ipWhitelist),
  });
}

async function deleteKey(id: string) {
  return requestClient.delete(`/key/${id}`);
}

/** 按关键字搜索 API Key 选项（单页、服务端搜索）。 */
async function searchKeyOptions(
  scope: KeyApi.KeyOwnerScope,
  keyword: string,
  signal?: AbortSignal,
) {
  const result = await getKeyList(
    { keyword: keyword || undefined, page: 1, pageSize: 20, scope },
    signal,
  );
  return (result.items ?? []).map((key) => {
    const prefix = String(key.keyPrefix || key.maskedKey || '').trim();
    return {
      id: String(key.id),
      label: `#${key.id} · ${key.name}${prefix ? ` (${prefix})` : ''}`,
    };
  });
}

export {
  createKey,
  deleteKey,
  getAllKeyOptions,
  getKeyDetail,
  getKeyInterfaceOptions,
  getKeyInterfaces,
  getKeyIpWhitelist,
  getKeyList,
  getKeySecret,
  searchKeyOptions,
  updateKey,
  updateKeyInterfaces,
  updateKeyIpWhitelist,
  updateKeyStatus,
};
