import type { RequestClientConfig } from '@vben/request';

import { requestClient } from '#/api/request';

/**
 * 系统操作日志（审计）API。
 *
 * 与调用日志（`/interface/call-log`）刻意分开：调用日志面向计费与流量，
 * 操作日志面向「谁对系统做了什么」的安全追溯，两者的检索维度与权限不同。
 */

/** 操作模块码。与后端 OperationLogModule 枚举一一对应。 */
export type OperationLogModule =
  | 'auth'
  | 'content'
  | 'interface'
  | 'key'
  | 'package'
  | 'payment'
  | 'permission'
  | 'risk'
  | 'system'
  | 'ticket'
  | 'user';

/** 动作码。与后端 OperationLogAction 枚举一一对应。 */
export type OperationLogAction =
  | 'adjust-asset'
  | 'config'
  | 'create'
  | 'delete'
  | 'export'
  | 'login'
  | 'logout'
  | 'password'
  | 'register'
  | 'review'
  | 'status'
  | 'update';

export interface OperationLogItem {
  action: string;
  city?: string;
  clientIp?: string;
  country?: string;
  createdAt: string;
  detail?: string;
  elapsedMs: number;
  errorMessage?: string;
  id: string;
  method: string;
  module: string;
  path: string;
  province?: string;
  status: boolean;
  statusCode: number;
  summary: string;
  targetId?: string;
  targetType?: string;
  userAgent?: string;
  userId: string;
  username: string;
}

export interface OperationLogPage {
  items: OperationLogItem[];
  page: number;
  pageSize: number;
  total: number;
}

export interface OperationLogModuleStat {
  count: number;
  module: string;
}

export interface OperationLogActionStat {
  action: string;
  count: number;
  module: string;
}

export interface OperationLogStats {
  activeUsers: number;
  failureCount: number;
  loginCount: number;
  moduleTotals: OperationLogModuleStat[];
  recentActions: OperationLogActionStat[];
  todayCount: number;
  totalCount: number;
}

export interface OperationLogListParams {
  action?: string;
  clientIp?: string;
  endTime?: string;
  keyword?: string;
  module?: string;
  page?: number;
  pageSize?: number;
  startTime?: string;
  status?: boolean;
  userId?: number;
  username?: string;
}

export async function getOperationLogListApi(
  params: OperationLogListParams,
  config?: RequestClientConfig,
) {
  return requestClient.get<OperationLogPage>('/system/operation-log/list', {
    ...config,
    params,
  });
}

export async function getOperationLogOverviewApi(config?: RequestClientConfig) {
  return requestClient.get<OperationLogStats>(
    '/system/operation-log/overview',
    config,
  );
}

/** Authenticated personal audit trail; the server binds the user ID. */
export function getMyOperationLogListApi(params: OperationLogListParams) {
  return requestClient.get<OperationLogPage>('/system/operation-log/mine', {
    params,
  });
}

/** 操作日志的地区字段快照（按需解析接口的返回）。 */
export interface OperationLogRegion {
  city?: string;
  clientIp?: string;
  country?: string;
  province?: string;
}

/**
 * 按需解析单条操作日志的 IP 归属地。
 *
 * 历史记录的地区列多为空（写入期从未解析），本接口由管理员在详情页显式
 * 触发：服务端解析后回写，并返回最新快照。服务端只在三列皆空时才写入，
 * 因此重复点击是安全的、不会覆盖已有结果。
 */
export function resolveOperationLogRegionApi(id: string) {
  return requestClient.post<OperationLogRegion>(
    `/system/operation-log/${encodeURIComponent(id)}/region`,
  );
}
