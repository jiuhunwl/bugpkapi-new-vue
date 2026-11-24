import { requestClient } from './request';

export namespace RiskControlApi {
  export type BanMode = 'PERMANENT' | 'TEMPORARY';

  export interface BanAccountRequest {
    banUntil?: string;
    mode: BanMode;
    reason: string;
    userId: string;
  }
  export interface QueryParams {
    limit?: number;
    windowMinutes?: number;
  }

  export type RiskEventType =
    | 'DISTRIBUTED_SAME_PARAMS'
    | 'PROXY_POOL_SAME_PARAMS'
    | 'SINGLE_IP_CC';
  export type RiskLevel = 'CRITICAL' | 'HIGH' | 'LOW' | 'MEDIUM';

  export interface RiskAccount {
    id: string;
    username?: string;
  }

  export interface RiskEvent {
    accounts?: RiskAccount[];
    apiCode?: string;
    apiKeys?: string[];
    avgElapsedMs: number;
    clientIp?: string;
    eventType: RiskEventType;
    failedCount: number;
    firstSeen: string;
    interfaceId?: string;
    interfaceName?: string;
    lastSeen: string;
    paramSignature: string;
    reason: string;
    region?: string;
    requestCount: number;
    requestIps?: string[];
    requestMethods?: string[];
    requestSample?: string;
    riskScore: number;
    severity: RiskLevel;
    successCount: number;
    uniqueIpCount: number;
    uniqueKeyCount: number;
    uniqueUserCount: number;
  }

  export interface TrendPoint {
    label: string;
    riskyEvents: number;
    totalCalls: number;
  }

  export interface DetectionPolicy {
    burstWindowMinutes: number;
    distributedIps: number;
    distributedRequests: number;
    proxyPoolIps: number;
    proxyPoolRequests: number;
    singleIpRequests: number;
  }

  export interface FailedIPRank {
    apiCode?: string;
    clientIp: string;
    failedCalls: number;
    interfaceFailedCalls: number;
    interfaceId?: string;
    interfaceName?: string;
    lastSeen: string;
    region?: string;
    riskHits: number;
    totalCalls: number;
    uniqueUsers: number;
  }

  export interface FailedAccountRank {
    apiCode?: string;
    displayName?: string;
    failedCalls: number;
    interfaceFailedCalls: number;
    interfaceId?: string;
    interfaceName?: string;
    lastSeen: string;
    riskHits: number;
    status: number;
    totalCalls: number;
    uniqueIps: number;
    userId: string;
    username?: string;
  }

  export interface Overview {
    distributedEvents: number;
    earthPointCount: number;
    events: RiskEvent[];
    failedRequests: number;
    invalidKeyAttempts: number;
    invalidKeyBlocked: number;
    policy: DetectionPolicy;
    proxyPoolEvents: number;
    riskScore: number;
    riskyRequests: number;
    singleIpEvents: number;
    topAttackIp?: string;
    topAttackParam?: string;
    topFailedAccounts: FailedAccountRank[];
    topFailedIps: FailedIPRank[];
    totalRequests: number;
    trend: TrendPoint[];
    uniqueIps: number;
    uniqueParamSignatures: number;
    windowMinutes: number;
  }

  export interface EarthPoint {
    callCount: number;
    city?: string;
    country?: string;
    failedCalls: number;
    isp?: string;
    latitude: string;
    longitude: string;
    province?: string;
    region: string;
    riskHits: number;
    riskLevel: RiskLevel;
    successCalls: number;
    uniqueIps: number;
  }

  export interface EarthOverview {
    activePoints: number;
    events: RiskEvent[];
    points: EarthPoint[];
    totalCalls: number;
    totalRiskHits: number;
    windowMinutes: number;
  }
}

export function getRiskControlOverview(params?: RiskControlApi.QueryParams) {
  return requestClient.get<RiskControlApi.Overview>('/risk-control/overview', {
    params,
  });
}

export function getRiskControlEvents(params?: RiskControlApi.QueryParams) {
  return requestClient.get<RiskControlApi.RiskEvent[]>('/risk-control/events', {
    params,
  });
}

export function getRiskControlEarth(params?: RiskControlApi.QueryParams) {
  return requestClient.get<RiskControlApi.EarthOverview>(
    '/risk-control/earth',
    { params },
  );
}

export function banRiskAccount(data: RiskControlApi.BanAccountRequest) {
  return requestClient.post('/risk-control/accounts/ban', {
    ...data,
    userId: Number(data.userId),
  });
}
