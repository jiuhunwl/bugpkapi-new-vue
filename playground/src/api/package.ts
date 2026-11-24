import type { Recordable } from '@vben/types';

import { getAllEnabledInterfaces } from '#/api/interface';
import { requestClient } from '#/api/request';

import { purchaseRequestConfig } from './purchase-idempotency';

export namespace PackageApi {
  export interface PackageRoleLimit {
    /** 是否限制用户组购买：0 不限制，1 限制 */
    roleRestricted?: 0 | 1;
    /** 限制时是否仅对允许用户组可见：0 所有人可见，1 仅允许组可见 */
    roleVisibleOnly?: 0 | 1;
    /** 允许购买的用户组（角色）ID */
    roleIds?: number[];
    /** 允许购买的用户组名称（管理端列表回显） */
    roleNames?: string[];
  }

  export interface GlobalPackage extends PackageRoleLimit {
    canPurchase?: boolean;
    createTime?: string;
    dailyLimit: number;
    /** 总调用量上限，0 = 不限 */
    totalLimit?: number;
    /** 计量方式：success 仅成功计量，attempt 失败也计量 */
    countMode?: 'success' | 'attempt';
    /** 商城隐藏：0 正常售卖，1 商城不可见不可购买，仅管理端可下发 */
    hidden?: 0 | 1;
    id: string;
    name: string;
    perUserLimit?: number;
    price: number | string;
    qpsLimit: number;
    remark?: string;
    saleEndAt?: string;
    saleStartAt?: string;
    status: 0 | 1;
    stockLimit?: number;
    stockUsed?: number;
    updateTime?: string;
    validDays: number;
  }

  export interface InterfacePackageSpec {
    createTime?: string;
    dailyLimit: number;
    /** 总调用量上限，0 = 不限 */
    totalLimit?: number;
    /** 计量方式：success 仅成功计量，attempt 失败也计量 */
    countMode?: 'success' | 'attempt';
    id?: string;
    packageId?: string;
    perUserLimit?: number;
    price: number | string;
    qpsLimit: number;
    remark?: string;
    saleEndAt?: string;
    saleStartAt?: string;
    sortNo?: number;
    specName: string;
    status: 0 | 1;
    stockLimit?: number;
    stockUsed?: number;
    updateTime?: string;
    validDays: number;
  }

  export interface InterfacePackage extends PackageRoleLimit {
    apiCode?: string;
    canPurchase?: boolean;
    createTime?: string;
    /** 商城隐藏（套餐级，对全部规格生效）：0 正常售卖，1 商城不可见不可购买 */
    hidden?: 0 | 1;
    id: string;
    interfaceId: string;
    interfaceName?: string;
    name: string;
    remark?: string;
    specs: InterfacePackageSpec[];
    status: 0 | 1;
    updateTime?: string;
  }

  export interface PointPackage extends PackageRoleLimit {
    canPurchase?: boolean;
    createTime?: string;
    /** 商城隐藏：0 正常售卖，1 商城不可见不可购买，仅管理端可下发 */
    hidden?: 0 | 1;
    id: string;
    name: string;
    perUserLimit?: number;
    pointAmount: number | string;
    points?: number | string;
    price: number | string;
    remark?: string;
    saleEndAt?: string;
    saleStartAt?: string;
    status: 0 | 1;
    stockLimit?: number;
    stockUsed?: number;
    updateTime?: string;
  }

  export interface MallGlobalPackage {
    canPurchase?: boolean;
    createTime?: string;
    dailyLimit: number;
    id: string;
    name: string;
    perUserLimit?: number;
    price: number | string;
    qpsLimit: number;
    remark?: string;
    saleEndAt?: string;
    saleStartAt?: string;
    stockLimit?: number;
    stockUsed?: number;
    validDays: number;
  }

  export interface MallPointPackage {
    canPurchase?: boolean;
    createTime?: string;
    id: string;
    name: string;
    perUserLimit?: number;
    pointAmount: number | string;
    points?: number | string;
    price: number | string;
    remark?: string;
    saleEndAt?: string;
    saleStartAt?: string;
    stockLimit?: number;
    stockUsed?: number;
  }

  export interface MallInterfacePackageSpec {
    dailyLimit: number;
    id: string;
    packageId: string;
    perUserLimit?: number;
    price: number | string;
    qpsLimit: number;
    remark?: string;
    saleEndAt?: string;
    saleStartAt?: string;
    sortNo?: number;
    specName: string;
    stockLimit?: number;
    stockUsed?: number;
    validDays: number;
  }

  export interface MallInterfacePackage {
    apiCode: string;
    avatarUrl?: string;
    callCount?: number | string;
    canPurchase?: boolean;
    id: string;
    interfaceId: string;
    interfaceName: string;
    interfaceRemark?: string;
    minPrice?: number | string;
    name: string;
    remark?: string;
    requestMethod: string;
    specCount?: number | string;
    specs: MallInterfacePackageSpec[];
  }

  export interface InterfaceOption {
    apiCode: string;
    id: string;
    label: string;
    name: string;
    price: number | string;
    requestMethod: string;
  }

  export interface ListParams extends Recordable<any> {
    interfaceId?: string;
    keyword?: string;
    page?: number;
    pageSize?: number;
    status?: 0 | 1;
  }

  export interface SaveGlobalPackage extends PackageRoleLimit {
    dailyLimit: number;
    totalLimit?: number;
    countMode?: 'success' | 'attempt';
    name: string;
    perUserLimit?: number;
    price: number | string;
    qpsLimit: number;
    remark?: string;
    saleEndAt?: string;
    saleStartAt?: string;
    status?: 0 | 1;
    hidden?: 0 | 1;
    stockLimit?: number;
    validDays: number;
  }

  export interface SaveInterfacePackage extends PackageRoleLimit {
    interfaceId: string;
    name: string;
    remark?: string;
    specs: InterfacePackageSpec[];
    status?: 0 | 1;
    hidden?: 0 | 1;
  }

  export interface SavePointPackage extends PackageRoleLimit {
    name: string;
    perUserLimit?: number;
    pointAmount?: number | string;
    points?: number | string;
    price: number | string;
    remark?: string;
    saleEndAt?: string;
    saleStartAt?: string;
    status?: 0 | 1;
    hidden?: 0 | 1;
    stockLimit?: number;
  }

  export interface PurchaseInterfacePackagePayload {
    specId: string;
  }

  export interface UserPackage {
    dailyLimit: number;
    /** 总调用量快照，0 = 不限 */
    totalLimit?: number;
    /** 累计消耗（含失败计量，取决于 countMode） */
    totalUsed?: number;
    countMode?: 'success' | 'attempt';
    endAt: string;
    id: string;
    /** 用户指定的主套餐：网关优先扣减它，耗尽后回落到默认顺序。 */
    isPrimary: boolean;
    name: string;
    qpsLimit: number;
    scope: 'GLOBAL' | 'INTERFACE';
    usedToday: number;
    /** 来源套餐编号：前端据此判断用户是否已持有同款，从而把按钮切成「续费」。 */
    packageId?: string;
    /** 接口套餐的规格编号；全站套餐为空。 */
    specId?: string;
    /** 剩余天数（向上取整，当天算 1 天）。 */
    remainDays?: number;
    /** 该套餐当前是否允许续费顺延。 */
    renewable?: boolean;
  }

  /** 管理端看到的单条用户套餐权益（含用户与接口信息）。 */
  export interface UserEntitlement {
    apiCode?: string;
    createTime?: string;
    dailyLimit: number;
    totalLimit?: number;
    countMode?: 'success' | 'attempt';
    dayUsed: number;
    displayName?: string;
    endAt: string;
    id: string;
    interfaceId?: string;
    interfaceName?: string;
    packageId: string;
    packageName: string;
    qpsLimit: number;
    scope: 'GLOBAL' | 'INTERFACE';
    specId?: string;
    specName?: string;
    startAt: string;
    status: 0 | 1;
    totalUsed: number;
    userId: string;
    username: string;
  }

  export interface UpdateUserEntitlementPayload {
    status?: 0 | 1;
    endAt?: string;
    dailyLimit?: number;
    totalLimit?: number;
    countMode?: 'success' | 'attempt';
    qpsLimit?: number;
  }

  /** 管理端直接下发套餐权益：users 支持用户名与数字用户 ID 混填（每行一个）。 */
  export interface GrantUserEntitlementPayload {
    scope: 'GLOBAL' | 'INTERFACE' | 'POINT';
    packageId?: number;
    specId?: number;
    users: string[];
    /** 可选到期时间（YYYY-MM-DD HH:mm:ss），传入后覆盖套餐有效天数 */
    endAt?: string;
  }

  export interface GrantUserEntitlementResult {
    granted: number;
    notFound?: string[];
  }

  export interface WalletTransaction {
    amount: number | string;
    balanceAfter: number | string;
    bizId?: string;
    bizType: string;
    createTime: string;
    id: string;
    points: number;
    pointsAfter: number;
    remark?: string;
  }

  export interface BillingRecord {
    apiCode: string;
    chargeAmount: number | string;
    chargeType: string;
    createTime: string;
    id: string;
    interfaceId: string;
    pointAmount: number;
    reason?: string;
    status: string;
    userId: string;
  }

  export interface PageParams extends Recordable<any> {
    page?: number;
    pageSize?: number;
  }
}

function withPointAmount<
  T extends { pointAmount?: number | string; points?: number | string },
>(item: T): T & { pointAmount: number | string } {
  return {
    ...item,
    pointAmount: item.pointAmount ?? item.points ?? 0,
  };
}

function normalizePointPackagePayload(data: PackageApi.SavePointPackage) {
  const pointAmount = normalizePointCount(data.pointAmount ?? data.points);
  return {
    ...data,
    pointAmount,
    points: pointAmount,
  };
}

function normalizePointCount(value: number | string | undefined) {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? Math.max(0, value) : 0;
  }
  const text = String(value ?? '')
    .replaceAll(',', '')
    .trim();
  if (!text) {
    return 0;
  }
  const number = Number(text);
  return Number.isInteger(number) ? Math.max(0, number) : 0;
}

async function getGlobalPackageList(params: PackageApi.ListParams) {
  return requestClient.get<{
    items: PackageApi.GlobalPackage[];
    total: number;
  }>('/package/global/list', { params });
}

async function getMallGlobalPackageList(params: PackageApi.ListParams) {
  return requestClient.get<{
    items: PackageApi.MallGlobalPackage[];
    total: number;
  }>('/package/mall/global/list', { params });
}

async function getMallPointPackageList(params: PackageApi.ListParams) {
  const result = await requestClient.get<{
    items: PackageApi.MallPointPackage[];
    total: number;
  }>('/package/mall/point/list', { params });
  return {
    ...result,
    items: (result.items ?? []).map(withPointAmount),
  };
}

async function createGlobalPackage(data: PackageApi.SaveGlobalPackage) {
  return requestClient.post('/package/global', data);
}

async function updateGlobalPackage(
  id: string,
  data: PackageApi.SaveGlobalPackage,
) {
  return requestClient.put(`/package/global/${id}`, data);
}

async function deleteGlobalPackage(id: string, force = false) {
  return requestClient.delete(`/package/global/${id}`, {
    params: force ? { force: 1 } : undefined,
  });
}

async function getInterfacePackageList(params: PackageApi.ListParams) {
  return requestClient.get<{
    items: PackageApi.InterfacePackage[];
    total: number;
  }>('/package/interface/list', { params });
}

async function getPointPackageList(params: PackageApi.ListParams) {
  const result = await requestClient.get<{
    items: PackageApi.PointPackage[];
    total: number;
  }>('/package/point/list', { params });
  return {
    ...result,
    items: (result.items ?? []).map(withPointAmount),
  };
}

async function getMallInterfacePackageList(params: PackageApi.ListParams) {
  return requestClient.get<{
    items: PackageApi.MallInterfacePackage[];
    total: number;
  }>('/package/mall/interface/list', { params });
}

async function getMallInterfacePackageDetail(id: string) {
  return requestClient.get<PackageApi.MallInterfacePackage>(
    `/package/mall/interface/${id}`,
  );
}

async function purchaseMallGlobalPackage(id: string) {
  return requestClient.post(
    `/package/mall/global/${id}/purchase`,
    {},
    purchaseRequestConfig(),
  );
}

async function purchaseMallInterfacePackage(
  id: string,
  data?: PackageApi.PurchaseInterfacePackagePayload,
) {
  return requestClient.post(
    `/package/mall/interface/${data?.specId || id}/purchase`,
    {},
    purchaseRequestConfig(),
  );
}

async function purchaseMallPointPackage(id: string) {
  return requestClient.post(
    `/package/mall/point/${id}/purchase`,
    {},
    purchaseRequestConfig(),
  );
}

async function getUserPackages() {
  return requestClient.get<PackageApi.UserPackage[]>('/user/packages');
}

/**
 * 指定主套餐。id 传 0 表示取消，回到「快到期的、高配的」默认扣减顺序。
 * 主套餐只影响扣减先后，不改变权益本身的额度与有效期。
 */
async function setPrimaryPackage(data: {
  id: number;
  scope: 'GLOBAL' | 'INTERFACE';
}) {
  return requestClient.put<boolean>('/user/packages/primary', data);
}

async function getUserWalletTransactions(params: PackageApi.PageParams) {
  return requestClient.get<{
    items: PackageApi.WalletTransaction[];
    total: number;
  }>('/user/wallet/transactions', { params });
}

async function getUserBillingRecords(params: PackageApi.PageParams) {
  return requestClient.get<{
    items: PackageApi.BillingRecord[];
    total: number;
  }>('/user/billing-records', { params });
}

async function createInterfacePackage(data: PackageApi.SaveInterfacePackage) {
  return requestClient.post('/package/interface', data);
}

async function updateInterfacePackage(
  id: string,
  data: PackageApi.SaveInterfacePackage,
) {
  return requestClient.put(`/package/interface/${id}`, data);
}

async function deleteInterfacePackage(id: string, force = false) {
  return requestClient.delete(`/package/interface/${id}`, {
    params: force ? { force: 1 } : undefined,
  });
}

async function createPointPackage(data: PackageApi.SavePointPackage) {
  return requestClient.post('/package/point', normalizePointPackagePayload(data));
}

async function updatePointPackage(
  id: string,
  data: PackageApi.SavePointPackage,
) {
  return requestClient.put(
    `/package/point/${id}`,
    normalizePointPackagePayload(data),
  );
}

async function deletePointPackage(id: string, force = false) {
  return requestClient.delete(`/package/point/${id}`, {
    params: force ? { force: 1 } : undefined,
  });
}

async function getUserEntitlementList(params: PackageApi.ListParams) {
  return requestClient.get<{
    items: PackageApi.UserEntitlement[];
    total: number;
  }>('/package/user-entitlement/list', { params });
}

async function updateUserEntitlement(
  id: string,
  scope: PackageApi.UserEntitlement['scope'],
  data: PackageApi.UpdateUserEntitlementPayload,
) {
  return requestClient.put(`/package/user-entitlement/${id}`, {
    scope,
    ...data,
  });
}

async function deleteUserEntitlement(
  id: string,
  scope: PackageApi.UserEntitlement['scope'],
) {
  return requestClient.delete(`/package/user-entitlement/${id}`, {
    params: { scope },
  });
}

async function grantUserEntitlement(data: PackageApi.GrantUserEntitlementPayload) {
  return requestClient.post<PackageApi.GrantUserEntitlementResult>(
    '/package/user-entitlement/grant',
    data,
  );
}

async function getPackageInterfaceOptions() {
  const items = await getAllEnabledInterfaces();
  return items.map((item) => ({
    ...item,
    label: `${item.name} (${item.apiCode})`,
  }));
}

export {
  createGlobalPackage,
  createInterfacePackage,
  createPointPackage,
  deleteGlobalPackage,
  deleteInterfacePackage,
  deletePointPackage,
  deleteUserEntitlement,
  getGlobalPackageList,
  getInterfacePackageList,
  getMallGlobalPackageList,
  getMallInterfacePackageDetail,
  getMallInterfacePackageList,
  getMallPointPackageList,
  getPackageInterfaceOptions,
  getPointPackageList,
  getUserBillingRecords,
  getUserEntitlementList,
  getUserPackages,
  getUserWalletTransactions,
  grantUserEntitlement,
  purchaseMallGlobalPackage,
  purchaseMallInterfacePackage,
  purchaseMallPointPackage,
  setPrimaryPackage,
  updateGlobalPackage,
  updateInterfacePackage,
  updatePointPackage,
  updateUserEntitlement,
};
