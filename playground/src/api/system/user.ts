import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace SystemUserApi {
  export interface SystemUser {
    balance?: number | string;
    banPermanent?: 0 | 1;
    banReason?: string;
    banUntil?: string;
    createTime?: string;
    email?: string;
    homePath?: string;
    id: string;
    lastLoginTime?: string;
    mobile?: string;
    points?: number | string;
    primaryRoleId: number | string;
    realName: string;
    roleIds: number[];
    roleNames: string[];
    roles: string[];
    specifiedResponseBillable?: 0 | 1;
    specifiedResponseEnabled?: 0 | 1;
    status: 0 | 1;
    totalRequests?: number | string;
    username: string;
  }

  export interface SaveUser {
    balance?: number | string;
    banPermanent?: 0 | 1;
    banReason?: string;
    banUntil?: string;
    changePassword?: boolean;
    email?: string;
    homePath?: string;
    id?: string;
    mobile?: string;
    password?: string;
    points?: number | string;
    primaryRoleId?: number | string;
    realName?: string;
    roleIds?: Array<number | string>;
    status?: 0 | 1;
    username: string;
  }

  export interface SpecifiedResponseConfig {
    specifiedResponseBillable: 0 | 1;
    specifiedResponseBody: string;
    specifiedResponseEnabled: 0 | 1;
  }

  export interface AdjustUserAssetRequest {
    /** 有符号余额增减值；正数增加，负数扣减，0 表示不变。 */
    balanceDelta: number | string;
    /** 有符号点数增减值；正数增加，负数扣减，0 表示不变。 */
    pointsDelta: number | string;
    reason: string;
  }

  export interface UserAssetAdjustment {
    balance: number | string;
    balanceDelta: number | string;
    points: number | string;
    pointsDelta: number | string;
  }

  export interface UserListParams extends Recordable<any> {
    keyword?: string;
    page?: number;
    pageSize?: number;
    roleId?: number;
    status?: 0 | 1;
    unmasked?: 0 | 1;
  }
}

async function getUserList(
  params: SystemUserApi.UserListParams,
  signal?: AbortSignal,
) {
  const result = await requestClient.get<{
    items: SystemUserApi.SystemUser[];
    total: number;
  }>('/system/user/list', { params, signal });
  return result;
}

async function getAllUserOptions() {
  const items: Array<{ id: string; label: string }> = [];
  const pageSize = 200;
  let page = 1;
  let total = Number.POSITIVE_INFINITY;
  while (items.length < total) {
    const result = await getUserList({ page, pageSize });
    total = Number(result.total) || 0;
    for (const user of result.items ?? []) {
      const realName = String(user.realName ?? '').trim();
      items.push({
        id: String(user.id),
        label: `#${user.id} · ${user.username}${realName ? ` (${realName})` : ''}`,
      });
    }
    if (!result.items?.length || result.items.length < pageSize) break;
    page += 1;
  }
  return items;
}

async function createUser(data: SystemUserApi.SaveUser) {
  return requestClient.post('/system/user', data);
}

async function getUser(id: string) {
  return requestClient.get<SystemUserApi.SystemUser>(`/system/user/${id}`);
}

async function updateUser(id: string, data: SystemUserApi.SaveUser) {
  return requestClient.put(`/system/user/${id}`, data);
}

async function adjustUserAssets(
  id: string,
  data: SystemUserApi.AdjustUserAssetRequest,
) {
  return requestClient.post<SystemUserApi.UserAssetAdjustment>(
    `/system/user/${id}/adjust-assets`,
    data,
  );
}

async function deleteUser(id: string) {
  return requestClient.delete(`/system/user/${id}`);
}

async function getUserSpecifiedResponse(id: string) {
  return requestClient.get<SystemUserApi.SpecifiedResponseConfig>(
    `/system/user/${id}/specified-response`,
  );
}

async function updateUserSpecifiedResponse(
  id: string,
  data: SystemUserApi.SpecifiedResponseConfig,
) {
  return requestClient.put(`/system/user/${id}/specified-response`, data);
}

/** 按关键字搜索用户选项（单页、服务端搜索）。 */
async function searchUserOptions(keyword: string, signal?: AbortSignal) {
  const result = await getUserList(
    { keyword: keyword || undefined, page: 1, pageSize: 20 },
    signal,
  );
  return (result.items ?? []).map((user) => {
    const realName = String(user.realName ?? '').trim();
    return {
      id: String(user.id),
      label: `#${user.id} · ${user.username}${realName ? ` (${realName})` : ''}`,
    };
  });
}

export {
  adjustUserAssets,
  createUser,
  deleteUser,
  getAllUserOptions,
  getUser,
  getUserList,
  getUserSpecifiedResponse,
  searchUserOptions,
  updateUser,
  updateUserSpecifiedResponse,
};
