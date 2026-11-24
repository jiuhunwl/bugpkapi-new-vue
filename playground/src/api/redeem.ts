import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace RedeemApi {
  /** 奖励类型：1 点数 2 余额 3 全站套餐 4 接口套餐规格 5 组合（点数+余额） */
  export type RewardType = 1 | 2 | 3 | 4 | 5;

  export interface CodeType {
    code: string;
    createTime: string;
    endAt: string;
    frozen: boolean;
    generatedCount: number;
    id: string;
    name: string;
    perIpLimit: number;
    perUserLimit: number;
    redeemedCount: number;
    rewardBalance: string;
    rewardPoints: number;
    rewardRefId: number;
    rewardRefName?: string;
    rewardType: RewardType;
    startAt: string;
    status: 0 | 1;
    updateTime: string;
  }

  export interface SaveTypeRequest {
    code: string;
    endAt: string;
    name: string;
    perIpLimit: number;
    perUserLimit: number;
    rewardBalance?: number | string;
    rewardPoints?: number;
    rewardRefId?: number;
    rewardType: RewardType;
    startAt: string;
    status?: 0 | 1;
  }

  export interface Code {
    batchId?: string;
    codeMask: string;
    createTime: string;
    id: string;
    source: 1 | 2;
    status: RedeemApi.CodeStatus;
    typeId: string;
    typeName: string;
    usedAt?: string;
    usedBy?: string;
  }

  /** 1 未用 2 已用 0 已作废 */
  export type CodeStatus = 0 | 1 | 2;

  export interface GenerateResult {
    batchId: string;
    count: number;
  }

  export interface Record {
    codeMask: string;
    createTime: string;
    id: string;
    rewardBalance: string;
    rewardName?: string;
    rewardPoints: number;
    rewardType: RewardType;
    source: 1 | 2;
    typeId: string;
    typeName: string;
    userId?: string;
    username?: string;
    validDays?: number;
  }

  export interface RedeemResult {
    balanceAfter: string;
    pointsAfter: number;
    rewardBalance: string;
    rewardName?: string;
    rewardPoints: number;
    rewardType: RewardType;
    validDays?: number;
  }

  export interface ListParams extends Recordable<any> {
    keyword?: string;
    page?: number;
    pageSize?: number;
    source?: 1 | 2;
    status?: CodeStatus;
    type_id?: number | string;
  }

  export interface GenerateRequest {
    campaignRef?: string;
    count: number;
    perIpLimit?: number;
    perUserLimit?: number;
  }
}

async function getTypeList(params: RedeemApi.ListParams, signal?: AbortSignal) {
  return requestClient.get<{ items: RedeemApi.CodeType[]; total: number }>(
    '/redeem/types',
    { params, signal },
  );
}

async function createType(payload: RedeemApi.SaveTypeRequest) {
  return requestClient.post<boolean>('/redeem/types', payload);
}

async function updateType(id: string, payload: RedeemApi.SaveTypeRequest) {
  return requestClient.put<boolean>(`/redeem/types/${id}`, payload);
}

async function updateTypeStatus(id: string, status: 0 | 1) {
  return requestClient.put<boolean>(`/redeem/types/${id}/status`, { status });
}

async function generateCodes(id: string, payload: RedeemApi.GenerateRequest) {
  return requestClient.post<RedeemApi.GenerateResult>(
    `/redeem/types/${id}/codes`,
    payload,
  );
}

async function getCodeList(params: RedeemApi.ListParams, signal?: AbortSignal) {
  return requestClient.get<{ items: RedeemApi.Code[]; total: number }>(
    '/redeem/codes',
    { params, signal },
  );
}

async function exportCodes(typeId: string | number) {
  return requestClient.download<Blob>('/redeem/codes/export', {
    params: { type_id: typeId },
    timeout: 600_000,
  });
}

async function voidCode(id: string) {
  return requestClient.post<boolean>(`/redeem/codes/${id}/void`);
}

async function getRecordList(
  params: RedeemApi.ListParams,
  signal?: AbortSignal,
) {
  return requestClient.get<{ items: RedeemApi.Record[]; total: number }>(
    '/redeem/records',
    { params, signal },
  );
}

/** 用户端：兑换（页面来源 source=1，服务端固定写入） */
async function redeemCode(code: string) {
  return requestClient.post<RedeemApi.RedeemResult>('/user/redeem/code', {
    code,
  });
}

/** 用户端：本人兑换记录（视图不含 username） */
async function getUserRedeemRecords(
  params: RedeemApi.ListParams,
  signal?: AbortSignal,
) {
  return requestClient.get<{ items: RedeemApi.Record[]; total: number }>(
    '/user/redeem/records',
    { params, signal },
  );
}

export {
  createType,
  exportCodes,
  generateCodes,
  getCodeList,
  getRecordList,
  getTypeList,
  getUserRedeemRecords,
  redeemCode,
  updateType,
  updateTypeStatus,
  voidCode,
};
