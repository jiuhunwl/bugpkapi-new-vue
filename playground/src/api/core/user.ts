import type { UserInfo } from '@vben/types';
import type { RequestClientConfig } from '@vben/request';

import { requestClient } from '#/api/request';

export interface InterfacePackageStats {
  apiCode: string;
  dailyLimit: number;
  expireTime?: string;
  interfaceId: string;
  interfaceName: string;
  packageId: string;
  packageName: string;
  qpsLimit: number;
  remainingCalls: number;
  remainingUnlimited: boolean;
  specId: string;
  specName: string;
  startTime?: string;
  todayCalls: number;
  userPackageId: string;
}

export interface MemberPackageStats {
  dailyLimit: number;
  expireTime?: string;
  packageId: string;
  packageName: string;
  qpsLimit: number;
  remainingCalls: number;
  remainingUnlimited: boolean;
  startTime?: string;
  todayCalls: number;
  userPackageId: string;
}

export type UserCallTrendKey = 'oneYear' | 'sevenDays' | 'thirtyDays';

export interface UserCallTrendStats {
  labels: string[];
  total: number;
  values: number[];
}

export interface CallOutcomeStats {
  available: boolean;
  calls: number;
  successCalls: number;
  expectedEmptyCalls: number;
  clientErrorCalls: number;
  throttledCalls: number;
  upstreamFailureCalls: number;
  sampleCalls: number;
  successRate: string;
  serviceFailureRate: string;
  clientErrorRate: string;
  throttleRate: string;
  expectedEmptyRate: string;
}

export interface UserWorkbenchStats {
  balance: number | string;
  callTrends: Record<UserCallTrendKey, UserCallTrendStats>;
  currentPackageName: string;
  currentPackageType: string;
  dailyLimit: number;
  dailyLimitUnlimited: boolean;
  failedCalls: number;
  failedRate: string;
  hasAnyPackage: boolean;
  hasMemberPackage: boolean;
  interfacePackageCount: number;
  interfacePackages: InterfacePackageStats[];
  memberPackage?: MemberPackageStats | null;
  outcomes: CallOutcomeStats;
  points: number;
  // true 表示有效配额来自套餐（主套餐优先，其次最早到期），用户组分/时/月窗口不参与。
  packageQuotaPreferred: boolean;
  qpsLimit: number;
  qpsLimitUnlimited: boolean;
  remainingCalls: number;
  remainingUnlimited: boolean;
  roleQuotaEnabled: boolean;
  roleQuotaMinuteLimit: number;
  roleQuotaHourLimit: number;
  roleQuotaDayLimit: number;
  roleQuotaMonthLimit: number;
  roleQuotaCountMode: 'attempt' | 'success';
  roleQuotaDayUsed: number;
  roleQuotaDayRemaining: number;
  roleQuotaDayUnlimited: boolean;
  roleKey: string;
  roleName: string;
  successCalls: number;
  successRate: string;
  todayCalls: number;
}

export interface QqBindingStatus {
  avatar?: string;
  bindTime?: string;
  bound: boolean;
  enabled: boolean;
  lastLoginTime?: string;
  nickname?: string;
}

export interface QqBindingAuthorizeResult {
  url: string;
}

export type AdminOverviewField = Exclude<keyof AdminWorkbenchOverview, 'unavailableFields'>;

export interface AdminWorkbenchOverview {
  /** Absent on older backends; an explicit list permits safe partial updates. */
  unavailableFields?: AdminOverviewField[];
  apiEnabled: number;
  apiTotal: number;
  keyEnabled: number;
  keyTotal: number;
  pendingFriendLinks: number;
  pendingOrders: number;
  todayBillableCalls: number;
  todayCalls: number;
  todayChargeAmount: number | string;
  todayFailedCalls: number;
  todayNewUsers: number;
  todayRevenue: number | string;
  todaySuccessCalls: number;
  todaySuccessRate: string;
  totalRevenue: number | string;
  totalUsers: number;
}

export interface AdminCallTrend7d {
  billableCalls: number[];
  chargeAmounts: Array<number | string>;
  chargeTotal: number | string;
  failedCalls: number[];
  labels: string[];
  successCalls: number[];
  total: number;
  totalCalls: number[];
}

export interface AdminRevenueTrend7d {
  labels: string[];
  orderCounts: number[];
  paidAmounts: Array<number | string>;
  totalAmount: number | string;
  totalOrders: number;
}

export interface AdminHotApiStats {
  apiCode: string;
  apiStatus: number;
  avgElapsedMs: number;
  billableCalls: number;
  chargeAmount: number | string;
  failedCalls: number;
  id: number | string;
  name: string;
  successCalls: number;
  successRate: string;
  todayCalls: number;
}

export interface AdminActiveUserStats {
  chargeAmount: number | string;
  id: number | string;
  realName: string;
  successCalls: number;
  successRate: string;
  todayCalls: number;
  username: string;
}

export interface AdminWorkbenchAlert {
  content: string;
  level: 'danger' | 'info' | 'success' | 'warning';
  title: string;
  url?: string;
}

export interface AdminAccessLocation {
  averageElapsedMs: number;
  callCount: number;
  city?: string;
  country?: string;
  failedCalls: number;
  firstSeen?: string;
  isp?: string;
  lastSeen?: string;
  latitude?: number | string;
  longitude?: number | string;
  province?: string;
  region: string;
  riskHits: number;
  successCalls: number;
  uniqueIps: number;
}

export interface AdminAccessSummary {
  activeCountries: number;
  activeLocations: number;
  failedCalls: number;
  successCalls: number;
  totalCalls: number;
  uniqueIps: number;
  /**
   * 窗口覆盖的自然天数。`all` 范围下由后端返回 0（表示无固定天数），
   * 展示层应改用「全部历史」这类文案而不是「近 0 天」。
   */
  windowDays: number;
}

/**
 * 访问态势图册的时间范围。
 *
 * 后端把范围换算成 bucket_start 下界，四种取值命中同一条索引，
 * 因此切换范围不涉及不同的查询计划。
 */
export type AdminAccessRange = '7d' | '30d' | 'all' | 'today';

export interface AdminWorkbenchStats {
  accessLocations: AdminAccessLocation[];
  accessSummary: AdminAccessSummary;
  activeUsers: AdminActiveUserStats[];
  alerts: AdminWorkbenchAlert[];
  analyticsReady: boolean;
  callTrend7d: AdminCallTrend7d;
  degradedSections: AdminWorkbenchSection[];
  hotApis: AdminHotApiStats[];
  outcomes: CallOutcomeStats;
  overview: AdminWorkbenchOverview;
  revenueTrend7d: AdminRevenueTrend7d;
}

export type AdminWorkbenchSection =
  | 'access'
  | 'activeUsers'
  | 'alerts'
  | 'callTrend7d'
  | 'hotApis'
  | 'overview'
  | 'revenueTrend7d';

/**
 * 获取用户信息
 */
export async function getUserInfoApi() {
  return requestClient.get<UserInfo>('/user/info');
}

/**
 * 更新用户个人资料（姓名、头像）
 */
export async function updateProfileApi(data: {
  avatar?: string;
  realName: string;
}) {
  return requestClient.put<UserInfo>('/user/profile', data);
}

/**
 * 发送绑定邮箱验证码
 */
export async function sendBindEmailCodeApi(email: string) {
  return requestClient.post<boolean>('/user/send-bind-email-code', { email });
}

/**
 * 验证并绑定邮箱
 */
export async function bindEmailApi(email: string, code: string) {
  return requestClient.put<UserInfo>('/user/bind-email', { email, code });
}

/**
 * 发送绑定手机验证码
 */
export async function sendBindMobileCodeApi(mobile: string) {
  return requestClient.post<boolean>('/user/send-bind-mobile-code', { mobile });
}

/**
 * 验证并绑定手机号
 */
export async function bindMobileApi(mobile: string, code: string) {
  return requestClient.put<UserInfo>('/user/bind-mobile', { mobile, code });
}

/**
 * 获取QQ绑定状态
 */
export async function getQqBindingStatusApi() {
  return requestClient.get<QqBindingStatus>('/user/qq-binding');
}

/**
 * 创建QQ绑定授权地址
 */
export async function getQqBindingAuthorizeApi() {
  return requestClient.get<QqBindingAuthorizeResult>(
    '/user/qq-binding/authorize',
  );
}

/**
 * 解绑QQ
 */
export async function unbindQqApi() {
  return requestClient.delete<boolean>('/user/qq-binding');
}

/**
 * 修改密码
 */
export async function changePasswordApi(data: {
  captchaId: string;
  confirmPassword: string;
  newPassword: string;
  oldPassword: string;
}) {
  return requestClient.put<boolean>('/user/password', data);
}

/**
 * 为 OAuth 自动创建的账号设置初始密码
 */
export async function setInitialPasswordApi(data: {
  captchaId: string;
  confirmPassword: string;
  password: string;
}) {
  return requestClient.post<boolean>('/user/password/set', data);
}

/**
 * 获取用户端工作台统计
 */
export async function getUserWorkbenchStatsApi() {
  return requestClient.get<UserWorkbenchStats>('/user/workbench/stats');
}

/**
 * 获取管理员工作台统计
 * @param sections - 可选 section 列表；为空则请求全量（与后端默认全量语义一致）
 * @param config - 透传请求层配置（signal / circuitGroupKey / dedupe 等）
 * @param accessRange - 访问态势图册的时间范围；省略时后端按 30 天处理
 */
export async function getAdminWorkbenchStatsApi(
  sections?: AdminWorkbenchSection[],
  config?: RequestClientConfig,
  accessRange?: AdminAccessRange,
) {
  const params: Record<string, string> = {};
  if (sections && sections.length > 0) {
    params.sections = sections.join(',');
  }
  if (accessRange) {
    params.accessRange = accessRange;
  }
  return requestClient.get<AdminWorkbenchStats>('/user/workbench/admin-stats', {
    ...config,
    params: Object.keys(params).length > 0 ? params : undefined,
  });
}
