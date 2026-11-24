import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace OpenApiConsole {
  /**
   * 端点 code 目录（稳定标识，禁止在前端手拼路径）。仅
   * `openapi:redeem-code:generate` 是管理员作用域端点。
   */
  export type EndpointCode =
    | 'openapi:account:read'
    | 'openapi:package:read'
    | 'openapi:api-key:write'
    | 'openapi:api-key:read'
    | 'openapi:order:create'
    | 'openapi:redeem:write'
    | 'openapi:redeem-code:generate';

  export const ENDPOINT_CODES: EndpointCode[] = [
    'openapi:account:read',
    'openapi:package:read',
    'openapi:api-key:write',
    'openapi:api-key:read',
    'openapi:order:create',
    'openapi:redeem:write',
    'openapi:redeem-code:generate',
  ];

  export interface OpenAPIKey {
    createTime: string;
    /** 到期时间已过但数据库状态仍为启用；由后端派生，与鉴权链同源 */
    expired: boolean;
    expiresAt: string;
    id: string;
    /** 掩码：opk_/opka_ + 前4 + **** + 后4 */
    isAdminScope: boolean;
    ipWhitelist: string[];
    lastUsedAt?: string;
    maskedKey: string;
    name: string;
    revokedAt?: string;
    scopes: EndpointCode[];
    /** 数据库原始状态：1=启用 0=已吊销（不随到期翻转，判可用性要看 expired） */
    status: 0 | 1;
    userId: string;
    username?: string;
  }

  export interface IssuedKey extends OpenAPIKey {
    /** 明文只在签发/重置响应中出现一次 */
    secretKey: string;
  }

  export interface IssueKeyRequest {
    expiresInDays?: number;
    ipWhitelist?: string[];
    name?: string;
    /** 仅管理端为他人签发时使用 */
    userId?: number;
    scopes?: EndpointCode[];
  }

  export interface ScopeOption {
    code: EndpointCode;
    granted: boolean;
    label: string;
    /** 仅管理员作用域端点 */
    adminOnly: boolean;
  }

  export interface Config {
    adminKeyExpireDays: number;
    enabled: boolean;
    ipWhitelistMax: number;
    keyDefaultExpireDays: number;
    rateLimitAdmin: number;
    rateLimitNormal: number;
  }

  export interface ConfigRequest {
    adminKeyExpireDays?: number;
    enabled?: boolean;
    ipWhitelistMax?: number;
    keyDefaultExpireDays?: number;
    rateLimitAdmin?: number;
    rateLimitNormal?: number;
  }

  export interface KeyListParams extends Recordable<any> {
    keyword?: string;
    page?: number;
    pageSize?: number;
    /** admin 跨账号列表固定 all */
    scope?: 'all';
  }

  /** 本账号开放 API 的三层开关读视图（页面初始状态唯一来源） */
  export interface SwitchStatus {
    /** 管理员强制禁用（优先级最高） */
    adminDisabled: boolean;
    /** 用户自助开关 */
    enabled: boolean;
    /** 平台全局开关，关闭时连签发都不可用 */
    globalEnabled: boolean;
  }
}

// ---------------------------------------------------------------- 自助面

async function getMyKeys(params: OpenApiConsole.KeyListParams, signal?: AbortSignal) {
  return requestClient.get<{
    items: OpenApiConsole.OpenAPIKey[];
    total: number;
  }>('/user/open-api-keys', { params, signal });
}

async function issueMyKey(payload: OpenApiConsole.IssueKeyRequest) {
  return requestClient.post<OpenApiConsole.IssuedKey>(
    '/user/open-api-keys',
    payload,
  );
}

/** scope 选项（granted=持有账号当前角色是否具备，作为默认勾选） */
async function getScopeOptions(userId?: number) {
  return requestClient.post<OpenApiConsole.ScopeOption[]>(
    '/user/open-api-keys/options',
    userId ? { userId } : {},
  );
}

async function resetKey(id: string) {
  return requestClient.post<OpenApiConsole.IssuedKey>(
    `/user/open-api-keys/${id}/reset`,
  );
}

async function revokeKey(id: string) {
  return requestClient.post<boolean>(`/user/open-api-keys/${id}/revoke`);
}

async function getSelfSwitch() {
  return requestClient.get<OpenApiConsole.SwitchStatus>('/user/open-api/switch');
}

async function setSelfSwitch(enabled: boolean) {
  return requestClient.post<boolean>('/user/open-api/switch', { enabled });
}

// ---------------------------------------------------------------- 管理面

async function getOpenApiConfig() {
  return requestClient.get<OpenApiConsole.Config>('/system/open-api/config');
}

async function updateOpenApiConfig(payload: OpenApiConsole.ConfigRequest) {
  return requestClient.put<boolean>('/system/open-api/config', payload);
}

async function setUserOpenApiDisabled(id: string | number, disabled: boolean) {
  return requestClient.put<boolean>(`/system/users/${id}/open-api-disabled`, {
    disabled,
  });
}

async function revokeAllUserKeys(id: string | number) {
  return requestClient.post<{ revoked: number }>(
    `/system/users/${id}/open-api-keys/revoke-all`,
  );
}

async function getAllKeys(params: OpenApiConsole.KeyListParams, signal?: AbortSignal) {
  return requestClient.get<{
    items: OpenApiConsole.OpenAPIKey[];
    total: number;
  }>('/system/open-api-keys', {
    params: { ...params, scope: 'all' },
    signal,
  });
}

export {
  getAllKeys,
  getMyKeys,
  getOpenApiConfig,
  getScopeOptions,
  getSelfSwitch,
  issueMyKey,
  resetKey,
  revokeAllUserKeys,
  revokeKey,
  setUserOpenApiDisabled,
  setSelfSwitch,
  updateOpenApiConfig,
};
