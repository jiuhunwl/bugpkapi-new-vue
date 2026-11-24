import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace SystemRoleApi {
  export interface SystemRole {
    [key: string]: any;
    builtin: boolean;
    defaultRegisterRole: boolean;
    effectivePermissions: Array<number | string>;
    id: number | string;
    name: string;
    permissionMode: 'all' | 'assigned';
    permissions: Array<number | string>;
    qpsLimit: number;
    quotaCountMode: 'attempt' | 'success';
    quotaDayLimit: number;
    quotaEnabled: 0 | 1;
    quotaHourLimit: number;
    quotaMinuteLimit: number;
    quotaMonthLimit: number;
    remark?: string;
    roleKey: string;
    selfRegisterEnabled: 0 | 1;
    status: 0 | 1;
    userCount: number;
  }

  export interface SaveSystemRole {
    name?: string;
    permissions?: Array<number | string>;
    qpsLimit?: number;
    quotaCountMode?: 'attempt' | 'success';
    quotaDayLimit?: number;
    quotaEnabled?: 0 | 1;
    quotaHourLimit?: number;
    quotaMinuteLimit?: number;
    quotaMonthLimit?: number;
    remark?: string;
    roleKey?: string;
    selfRegisterEnabled?: 0 | 1;
    status?: 0 | 1;
  }

  export interface RoleOption {
    id: number | string;
    name: string;
    qpsLimit: number;
    roleKey: string;
    selfRegisterEnabled: 0 | 1;
    status: 0 | 1;
  }
}

/**
 * 获取角色列表数据
 */
async function getRoleList(params: Recordable<any>) {
  return requestClient.get<{
    items: SystemRoleApi.SystemRole[];
    total: number;
  }>('/system/role/list', { params });
}

async function getRoleOptions() {
  return requestClient.get<SystemRoleApi.RoleOption[]>('/system/role/options');
}

/**
 * 下拉多选用的用户组选项：统一把后端字符串 ID 转成 number，
 * 与表单/接口的 roleIds（number[]）保持一致。
 */
async function getRoleSelectOptions() {
  const list = await getRoleOptions();
  return list.map((role) => ({ ...role, id: Number(role.id) }));
}

/**
 * 创建角色
 * @param data 角色数据
 */
async function createRole(data: SystemRoleApi.SaveSystemRole) {
  return requestClient.post('/system/role', data);
}

/**
 * 更新角色
 *
 * @param id 角色 ID
 * @param data 角色数据
 */
async function updateRole(
  id: number | string,
  data: SystemRoleApi.SaveSystemRole,
) {
  return requestClient.put(`/system/role/${id}`, data);
}

async function updateRoleStatus(id: number | string, status: 0 | 1) {
  return requestClient.request(`/system/role/${id}/status`, {
    data: { status },
    method: 'PATCH',
  });
}

/**
 * 删除角色
 * @param id 角色 ID
 */
async function deleteRole(id: number | string) {
  return requestClient.delete(`/system/role/${id}`);
}

export {
  createRole,
  deleteRole,
  getRoleList,
  getRoleOptions,
  getRoleSelectOptions,
  updateRole,
  updateRoleStatus,
};
