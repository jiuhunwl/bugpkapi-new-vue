import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace InterfaceApi {
  export type RequestMethod = 'GET' | 'GET_POST' | 'POST';
  export type InvokeMethod = 'GET' | 'POST';
  export type BillingOperator = 'CONTAINS' | 'EQ' | 'GT' | 'LT' | 'NE';
  export type CacheOperator = 'EXISTS' | BillingOperator;
  export type RequestValidationLogic = 'ALL' | 'ANY';
  export type RequestValidationResult =
    | 'INVALID_PARAMS'
    | 'PASS'
    | 'PLATFORM_MISMATCH';
  export type RequestValidationSource = 'AUTO' | 'BODY' | 'QUERY';
  export type RequestValidationOperator =
    | 'CONTAINS'
    | 'DOMAIN_IN'
    | 'DOMAIN_NOT_IN'
    | 'EMPTY'
    | 'ENDS_WITH'
    | 'EQ'
    | 'EXISTS'
    | 'HAS_DOMAIN'
    | 'IS_URL'
    | 'NE'
    | 'NOT_CONTAINS'
    | 'NOT_EMPTY'
    | 'NOT_EXISTS'
    | 'NOT_HAS_DOMAIN'
    | 'NOT_REGEX'
    | 'NOT_URL'
    | 'REGEX'
    | 'STARTS_WITH';
  export type ChargeType =
    | 'ADMIN'
    | 'BALANCE'
    | 'FREE'
    | 'GLOBAL_PACKAGE'
    | 'INTERFACE_PACKAGE'
    | 'MEMBER'
    | 'NO_CHARGE'
    | 'OPEN_PENDING'
    | 'POINT'
    | 'POINTS';
  export type PollingMode =
    | 'FASTEST'
    | 'PRIMARY'
    | 'RANDOM'
    | 'ROUND_ROBIN'
    | 'SINGLE';
  export type DomainRouteSource = 'AUTO' | 'BODY' | 'QUERY';
  export type DomainRouteMatchMode = 'EXACT' | 'SUBDOMAIN';
  export type DomainRouteValueMode = 'ALL' | 'ANY';
  export type DomainRouteFallback = 'DEFAULT_POOL' | 'DEFAULT_ROUTE' | 'REJECT';
  export type ProxyProtocol = 'HTTP' | 'HTTPS' | 'SOCKS5';
  export type ProxySource = 'API' | 'FIXED';
  export type InterfaceQuotaCountMode = 'attempt' | 'success';
  export type InterfaceQuotaRoleMode =
    | 'adjust'
    | 'ignore'
    | 'inherit'
    | 'override'
    | 'unlimited';

  export interface InterfaceRoleQuota {
    adjustDay: number;
    adjustHour: number;
    adjustMonth: number;
    adjustWeek: number;
    mode: InterfaceQuotaRoleMode;
    overrideDay: number;
    overrideHour: number;
    overrideMonth: number;
    overrideWeek: number;
    roleId: number;
    roleKey?: string;
    roleName?: string;
  }

  export interface InterfaceQuotaPolicy {
    allUsersDay: number;
    allUsersHour: number;
    allUsersMonth: number;
    allUsersWeek: number;
    countMode: InterfaceQuotaCountMode;
    coverPackage: 0 | 1;
    enabled: 0 | 1;
    perUserDay: number;
    perUserHour: number;
    perUserMonth: number;
    perUserWeek: number;
    roleOverrides: InterfaceRoleQuota[];
  }

  export type InterfaceDegradeWindow = 'day' | 'month' | 'total' | 'week';

  export interface InterfaceRoleDegrade {
    roleId: number;
    roleKey?: string;
    roleName?: string;
    window: InterfaceDegradeWindow;
    threshold: number;
    targetInterfaceId?: number;
    targetInterfaceCode?: string;
    targetInterfaceName?: string;
    targetUrl?: string;
  }

  export interface InterfaceDegradePolicy {
    enabled: 0 | 1;
    defaultTargetInterfaceId: number;
    defaultTargetInterfaceCode?: string;
    defaultTargetInterfaceName?: string;
    defaultTargetUrl?: string;
    policyVersion?: number;
    roleOverrides: InterfaceRoleDegrade[];
  }

  // 三维计量策略。inherit 表示沿用既有判定链（计费开关 + 价格 + 角色配额 + 套餐优先），
  // 所以后端未落策略行的接口读回来三个维度都是 inherit。
  export type MeteringAssetMode = 'charge' | 'free' | 'inherit';
  export type MeteringPackageMode = 'consume' | 'inherit' | 'skip';
  export type MeteringGroupMode = 'count' | 'inherit' | 'skip';

  export interface InterfaceRoleMetering {
    assetMode: MeteringAssetMode;
    groupMode: MeteringGroupMode;
    packageMode: MeteringPackageMode;
    roleId: number;
    roleKey?: string;
    roleName?: string;
  }

  export interface InterfaceMeteringPolicy {
    assetMode: MeteringAssetMode;
    // 兜底闸门状态随策略一起返回：三维全免时接口全平台总量是唯一限流来源。
    guardAllUsersSet: boolean;
    guardEnabled: 0 | 1;
    groupMode: MeteringGroupMode;
    packageMode: MeteringPackageMode;
    roleOverrides: InterfaceRoleMetering[];
  }

  export interface ProxyHeader {
    name: string;
    value: string;
  }

  export interface ProxyPoolConfig {
    apiHeaders: ProxyHeader[];
    apiUrl: string;
    enabled: 0 | 1;
    host: string;
    jsonPath: string;
    password: string;
    passwordConfigured: boolean;
    port: number;
    protocol: ProxyProtocol;
    refreshSeconds: number;
    source: ProxySource;
    username: string;
  }

  export interface ProxyPoolCandidate {
    path: string;
    value: string;
  }

  export interface ProxyPoolInspectResult {
    candidates: ProxyPoolCandidate[];
    detectedPath: string;
    host: string;
    port: number;
    protocol: ProxyProtocol;
  }

  export interface ProxyPoolTestResult {
    elapsedMs: number;
    exitIp: string;
    protocol: ProxyProtocol;
    proxyAddress: string;
    statusCode: number;
    success: boolean;
    target?: string;
  }

  /** 代理池测试目标预设 key（与后端 proxyTestTargets 映射一致） */
  export type ProxyPoolTestTarget =
    | 'baidu'
    | 'bilibili'
    | 'custom'
    | 'douyin'
    | 'kuaishou'
    | 'taobao';

  export interface InterfaceDocResponseFormat {
    example?: string;
    type: 'FILE' | 'HTML' | 'JSON' | 'SSE' | 'TEXT' | 'XML';
  }

  export interface InterfaceItem {
    billingEnabled?: 0 | 1;
    billingLogEnabled?: 0 | 1;
    apiCode: string;
    avatarUrl?: string;
    callCount?: number | string;
    createTime?: string;
    currentNode?: number;
    currentNodeUrl?: string;
    docNotice?: string;
    docPreferredMethod?: '' | InvokeMethod;
    docRequestParams?: string;
    docResponseExample?: string;
    docResponseFields?: string;
    /** Raw JSON column; the typed editor payload lives on InterfaceDocConfig. */
    docResponseFormats?: string;
    docResponseType?:
      | 'FILE'
      | 'HTML'
      | 'JSON'
      | 'SSE'
      | 'TEXT'
      | 'XML';
    docStatusCodes?: string;
    docSummary?: string;
    domainRouting?: DomainRoutingConfig;
    id: string;
    isFeatured: 0 | 1;
    isTop: 0 | 1;
    name: string;
    paramKeys?: string[];
    pointPrice: number | string;
    pollingCheckEnabled?: 0 | 1;
    pollingCheckExpected?: string;
    pollingCheckField?: string;
    pollingEnabled?: 0 | 1;
    pollingMode?: PollingMode;
    pollingStopCode?: string;
    price: number | string;
    proxyPoolConfig?: ProxyPoolConfig;
    qpsLimit?: number;
    sharedQpsLimit?: number;
    remark?: string;
    requestMethod: RequestMethod;
    requestUrl: string;
    responseCleaningEnabled?: 0 | 1;
    responseFieldMappings?: ResponseFieldMapping[];
    status: 0 | 1;
    templateParameters?: string[];
    updateTime?: string;
    upstreamConfigs?: UpstreamConfig[];
    upstreamCount?: number;
    upstreamUrls?: string[];
  }

  export interface InterfaceListParams extends Recordable<any> {
    isFeatured?: 0 | 1;
    keyword?: string;
    page?: number;
    pageSize?: number;
    requestMethod?: RequestMethod;
    status?: 0 | 1;
  }

  export interface SaveInterface {
    apiCode?: string;
    avatarUrl?: string;
    domainRouting?: DomainRoutingConfig;
    isFeatured?: 0 | 1;
    isTop?: 0 | 1;
    name: string;
    pointPrice?: number | string;
    pollingCheckEnabled?: 0 | 1;
    pollingCheckExpected?: string;
    pollingCheckField?: string;
    pollingEnabled?: 0 | 1;
    pollingMode?: PollingMode;
    pollingStopCode?: string;
    price: number | string;
    proxyPoolConfig?: ProxyPoolConfig;
    qpsLimit?: number;
    sharedQpsLimit?: number;
    remark: string;
    requestMethod: RequestMethod;
    requestUrl: string;
    responseCleaningEnabled?: 0 | 1;
    responseFieldMappings?: ResponseFieldMapping[];
    status?: 0 | 1;
    upstreamConfigs?: UpstreamConfig[];
    upstreamUrls?: string[];
  }

  export interface PollingConfig {
    currentNode?: number;
    currentNodeUrl?: string;
    /** Legacy polling responses may omit the domain-routing extension. */
    domainRouting?: DomainRoutingConfig;
    id: string;
    name: string;
    pollingCheckEnabled?: 0 | 1;
    pollingCheckExpected?: string;
    pollingCheckField?: string;
    pollingEnabled: 0 | 1;
    pollingMode: PollingMode;
    pollingStopCode?: string;
    proxyPoolConfig: ProxyPoolConfig;
    requestUrl: string;
    responseCleaningEnabled: 0 | 1;
    responseFieldMappings?: ResponseFieldMapping[];
    upstreamConfigs?: UpstreamConfig[];
    upstreamCount?: number;
    upstreamUrls: string[];
  }

  export interface UpstreamConfig {
    failureCount?: number;
    healthStatus?: 'HEALTHY' | 'UNHEALTHY' | 'UNKNOWN' | string;
    lastCheckedAt?: string;
    lastLatencyMs?: number;
    pollingCheckEnabled?: 0 | 1;
    pollingCheckExpected?: string;
    pollingCheckField?: string;
    responseFieldMappings?: ResponseFieldMapping[];
    url: string;
  }

  export interface ResponseFieldMapping {
    source: string;
    target: string;
  }

  export interface UpstreamCheckResult {
    checkedAt?: string;
    healthStatus: 'HEALTHY' | 'UNHEALTHY' | 'UNKNOWN' | string;
    latencyMs?: number;
    message?: string;
    routeId?: string;
    routeName?: string;
    statusCode?: number;
    url: string;
  }

  export interface SavePollingConfig {
    domainRouting?: DomainRoutingConfig;
    pollingCheckEnabled?: 0 | 1;
    pollingCheckExpected?: string;
    pollingCheckField?: string;
    pollingEnabled?: 0 | 1;
    pollingMode?: PollingMode;
    pollingStopCode?: string;
    proxyPoolConfig?: ProxyPoolConfig;
    responseCleaningEnabled?: 0 | 1;
    responseFieldMappings?: ResponseFieldMapping[];
    upstreamConfigs?: UpstreamConfig[];
    upstreamUrls?: string[];
  }

  export interface DomainRouteMatchConfig {
    domains: string[];
    field: string;
    mode: DomainRouteMatchMode;
    source: DomainRouteSource;
    valueMode: DomainRouteValueMode;
  }

  export interface DomainPollingRoute {
    enabled: 0 | 1;
    id: string;
    match: DomainRouteMatchConfig;
    name: string;
    pollingCheckEnabled: 0 | 1;
    pollingCheckExpected: string;
    pollingCheckField: string;
    pollingEnabled: 0 | 1;
    pollingMode: PollingMode;
    pollingStopCode: string;
    priority: number;
    requestUrl: string;
    responseCleaningEnabled: 0 | 1;
    responseFieldMappings: ResponseFieldMapping[];
    upstreamConfigs: UpstreamConfig[];
  }

  export interface DomainRoutingConfig {
    defaultRouteId?: string;
    enabled: 0 | 1;
    fallback: DomainRouteFallback;
    routes?: DomainPollingRoute[];
  }

  export interface InterfaceDocConfig {
    apiCode?: string;
    docNotice?: string;
    docPreferredMethod?: '' | InvokeMethod;
    docRequestParams?: string;
    docResponseExample?: string;
    docResponseFields?: string;
    docResponseFormats?: InterfaceDocResponseFormat[];
    docResponseType?:
      | 'FILE'
      | 'HTML'
      | 'JSON'
      | 'SSE'
      | 'TEXT'
      | 'XML';
    docStatusCodes?: string;
    docSummary?: string;
    id?: string;
    name?: string;
    requestMethod?: RequestMethod;
    requestUrl?: string;
    templateParameters?: string[];
  }

  export interface InvokePayload {
    body?: Recordable<any> | string;
    keyId?: number;
    method: InvokeMethod;
    queryParams?: Recordable<any>;
  }

  export interface InvokeResult {
    apiName: string;
    billable?: boolean;
    body: string;
    chargeAmount?: number | string;
    elapsedMs: number;
    pointPrice?: number | string;
    pollingMode?: PollingMode;
    price: number | string;
    requestMethod: InvokeMethod;
    statusCode: number;
    success: boolean;
    upstreamSwitched?: boolean;
    upstreamUrl?: string;
  }

  export interface InvokeKeyOption {
    expiresAt?: string;
    id: string;
    keyScope: 'GLOBAL' | 'INTERFACE';
    maskedKey: string;
    name: string;
    secretAvailable: boolean;
  }

  export interface BillingRule {
    expectedValue: string;
    fieldName: string;
    id?: string;
    operator: BillingOperator;
    sortNo?: number;
  }

  export interface RequestValidationCondition {
    expectedValue: string;
    fieldName: string;
    operator: RequestValidationOperator;
    source: RequestValidationSource;
  }

  export interface RequestValidationRule {
    conditions: RequestValidationCondition[];
    logic: RequestValidationLogic;
    name: string;
    result: RequestValidationResult;
    sortNo: number;
  }

  export interface RequestValidationPolicy {
    defaultResult: RequestValidationResult;
    enabled: 0 | 1;
    id: string;
    name: string;
    rules: RequestValidationRule[];
  }

  export interface SaveRequestValidationPolicy {
    defaultResult: RequestValidationResult;
    enabled: 0 | 1;
    rules: RequestValidationRule[];
  }

  export interface ResponseCacheRule {
    expectedValue: string;
    fieldName: string;
    name: string;
    operator: CacheOperator;
    sortNo: number;
    statusCode: number;
    ttlSeconds: number;
  }

  export interface DeliveryPolicy {
    cacheDefaultTtlSeconds: number;
    cacheEnabled: 0 | 1;
    cachePolicyOverride: 0 | 1;
    cacheRules: ResponseCacheRule[];
    effectiveRequestTimeoutMs?: number;
    id: string;
    name: string;
    policyVersion?: number | string;
    requestTimeoutMs: number;
    requestTimeoutOverride: 0 | 1;
    responseAdEnabled: 0 | 1;
    responseAdField: string;
    responseAdId: number | string;
    responseAdPolicyOverride: 0 | 1;
    scope?: 'GLOBAL' | 'INTERFACE' | string;
  }

  export interface SaveDeliveryPolicy {
    cacheDefaultTtlSeconds: number;
    cacheEnabled: 0 | 1;
    cachePolicyOverride?: 0 | 1;
    cacheRules: ResponseCacheRule[];
    requestTimeoutMs: number;
    requestTimeoutOverride?: 0 | 1;
    responseAdEnabled: 0 | 1;
    responseAdField: string;
    responseAdId: number | string;
    responseAdPolicyOverride?: 0 | 1;
  }

  export interface ResponseAdvertisementOption {
    endTime?: string;
    id: string;
    name: string;
    startTime?: string;
    status: 0 | 1;
    title: string;
  }

  export interface UserCallLogItem {
    traceId?: string;
    apiCode: string;
    billable: boolean | number;
    billingStatus?: string;
    chargeAmount: number | string;
    chargeType: ChargeType;
    createTime?: string;
    elapsedMs: number;
    errorMessage?: string;
    id: string;
    interfaceName: string;
    pointPrice: number | string;
    requestMethod: InvokeMethod;
    requestParams?: string;
    requestSize?: number;
    responseBody?: string;
    responseSavedBytes?: number;
    responseSize?: number;
    responseStatus: number;
    responseTruncated?: boolean;
    success: boolean | number;
  }

  export interface CallLogItem extends UserCallLogItem {
    apiKeyId?: string;
    apiKeyPrefix?: string;
    billingRecordId?: string;
    billingSnapshot?: string;
    clientIp?: string;
    clientRegion?: string;
    interfaceId: string;
    ipCity?: string;
    ipCountry?: string;
    ipIsp?: string;
    ipProvince?: string;
    pollingMode?: PollingMode;
    realName?: string;
    requestValue?: string;
    upstreamSwitched?: boolean | number;
    upstreamUrl?: string;
    userId: string;
    username: string;
    userVisible?: boolean | number;
  }

  export type CallLogViewItem = Partial<CallLogItem> & UserCallLogItem;

  export interface CallLogListParams extends Recordable<any> {
    includeTotal?: boolean;
    apiCode?: string;
    apiKeyId?: string;
    billable?: 0 | 1;
    billingOnly?: 0 | 1;
    billingStatus?: string;
    chargeType?: ChargeType;
    clientIp?: string;
    cursor?: string;
    endTime?: string;
    interfaceId?: string;
    keyword?: string;
    maxElapsedMs?: number;
    minElapsedMs?: number;
    page?: number;
    pageSize?: number;
    region?: string;
    startTime?: string;
    success?: 0 | 1;
    timeRange?: [string, string];
    traceId?: string;
    unmasked?: 0 | 1;
    userId?: string;
  }
}

interface UploadFileParams {
  file: File;
  onError?: (error: Error) => void;
  onProgress?: (progress: { percent: number }) => void;
  onSuccess?: (data: any, file: File) => void;
}

async function getInterfaceList(
  params: InterfaceApi.InterfaceListParams,
  signal?: AbortSignal,
) {
  const result = await requestClient.get<{
    items: InterfaceApi.InterfaceItem[];
    total: number;
  }>('/interface/list', {
    params,
    signal,
    // 后端 /interface/list 会并发跑 count + 分页查询，并串行执行
    // populateRecentCallCounts（对 bp_call_api_metric_minute 做 group by 聚合），
    // 数据量大时单次耗时远超 8s 全局默认。这里给列表/聚合类端点独立的长超时预算。
    // 全局 8s 默认值不动（服务 CRUD 场景）。
    timeout: 30_000,
  });
  return result;
}

async function getAllEnabledInterfaces() {
  return getAllInterfaces({ status: 1 });
}

/**
 * 分页循环硬上限：防止后端忽略 page 参数 / total 不可信时进入死循环。
 * 200 页 × 100 条/页 = 20000 条，覆盖正常业务规模。
 */
const MAX_INTERFACE_PAGES = 200;

async function getAllInterfaces(
  filters: Pick<InterfaceApi.InterfaceListParams, 'status'> = {},
) {
  const pageSize = 100;
  const items: InterfaceApi.InterfaceItem[] = [];
  const seenIds = new Set<string>();
  let page = 1;
  let total = Number.POSITIVE_INFINITY;
  let lastSeenCount = -1;

  while (items.length < total && page <= MAX_INTERFACE_PAGES) {
    const result = await getInterfaceList({ page, pageSize, ...filters });
    const pageItems = result.items ?? [];
    total = Math.max(0, Number(result.total) || 0);

    let newOnThisPage = 0;
    for (const item of pageItems) {
      const id = String(item.id);
      if (!seenIds.has(id)) {
        seenIds.add(id);
        items.push(item);
        newOnThisPage += 1;
      }
    }

    // 后端忽略 page 参数、反复返回同一页数据 → 本页全部已见过 → 立即终止
    if (pageItems.length > 0 && newOnThisPage === 0) {
      break;
    }
    // 空页或短页（< pageSize）→ 已到末页 → 终止
    if (pageItems.length === 0 || pageItems.length < pageSize) {
      break;
    }
    // 连续两页返回完全相同的内容（重复页）→ 终止
    if (pageItems.length === lastSeenCount && newOnThisPage === 0) {
      break;
    }
    lastSeenCount = pageItems.length;
    page += 1;
  }

  return items;
}

async function createInterface(data: InterfaceApi.SaveInterface) {
  return requestClient.post<InterfaceApi.InterfaceItem>('/interface', data);
}

async function updateInterface(id: string, data: InterfaceApi.SaveInterface) {
  return requestClient.put(`/interface/${id}`, data);
}

async function getInterfaceQuota(id: number | string) {
  return requestClient.get<InterfaceApi.InterfaceQuotaPolicy>(
    `/interface/${id}/quota`,
  );
}

async function updateInterfaceQuota(
  id: number | string,
  data: InterfaceApi.InterfaceQuotaPolicy,
) {
  return requestClient.put(`/interface/${id}/quota`, data);
}

async function getInterfaceMetering(id: number | string) {
  return requestClient.get<InterfaceApi.InterfaceMeteringPolicy>(
    `/interface/${id}/metering`,
  );
}

async function updateInterfaceMetering(
  id: number | string,
  data: InterfaceApi.InterfaceMeteringPolicy,
) {
  return requestClient.put(`/interface/${id}/metering`, data);
}

async function getInterfaceDegrade(id: number | string) {
  return requestClient.get<InterfaceApi.InterfaceDegradePolicy>(
    `/interface/${id}/degrade`,
  );
}

async function updateInterfaceDegrade(
  id: number | string,
  data: InterfaceApi.InterfaceDegradePolicy,
) {
  return requestClient.put(`/interface/${id}/degrade`, data);
}

async function getInterfacePolling(id: string) {
  return requestClient.get<InterfaceApi.PollingConfig>(
    `/interface/${id}/polling`,
  );
}

async function updateInterfacePolling(
  id: string,
  data: InterfaceApi.SavePollingConfig,
) {
  return requestClient.put(`/interface/${id}/polling`, data);
}

async function checkInterfaceUpstreams(id: string) {
  return requestClient.post<InterfaceApi.UpstreamCheckResult[]>(
    `/interface/${id}/upstreams/check`,
  );
}

async function inspectInterfaceProxyPool(
  interfaceId: string | undefined,
  proxyPoolConfig: InterfaceApi.ProxyPoolConfig,
) {
  return requestClient.post<InterfaceApi.ProxyPoolInspectResult>(
    '/interface/proxy-pool/inspect',
    {
      interfaceId: interfaceId ? Number(interfaceId) : 0,
      proxyPoolConfig,
    },
  );
}

async function testInterfaceProxyPool(
  interfaceId: string | undefined,
  proxyPoolConfig: InterfaceApi.ProxyPoolConfig,
  testTarget?: string,
  customTestUrl?: string,
) {
  return requestClient.post<InterfaceApi.ProxyPoolTestResult>(
    '/interface/proxy-pool/test',
    {
      interfaceId: interfaceId ? Number(interfaceId) : 0,
      proxyPoolConfig,
      testTarget,
      customTestUrl,
    },
  );
}

async function getInterfaceDoc(id: string) {
  return requestClient.get<InterfaceApi.InterfaceDocConfig>(
    `/interface/${id}/doc`,
  );
}

async function updateInterfaceDoc(
  id: string,
  data: InterfaceApi.InterfaceDocConfig,
) {
  return requestClient.put(`/interface/${id}/doc`, data);
}

async function deleteInterface(id: string) {
  return requestClient.delete(`/interface/${id}`);
}

async function batchUpdateInterfaceStatus(ids: string[], status: 0 | 1) {
  return requestClient.put('/interface/batch/status', {
    ids: ids.map((id) => Number(id)),
    status,
  });
}

async function batchDeleteInterfaces(ids: string[]) {
  return requestClient.delete('/interface/batch', {
    data: { ids: ids.map((id) => Number(id)) },
  });
}

async function invokeInterface(id: string, data: InterfaceApi.InvokePayload) {
  return requestClient.post<InterfaceApi.InvokeResult>(
    `/interface/${id}/invoke`,
    data,
    // The backend owns the 0..120s business budget; leave transport headroom
    // instead of truncating it with the shared 8s CRUD-client timeout.
    { timeout: 130_000 },
  );
}

async function getInterfaceInvokeKeys(id: string, keyword = '') {
  return requestClient.get<InterfaceApi.InvokeKeyOption[]>(
    `/interface/${id}/invoke-keys`,
    {
      params: keyword.trim() ? { keyword: keyword.trim() } : undefined,
    },
  );
}

async function getInterfaceBillingRules(id: string) {
  return requestClient.get<InterfaceApi.BillingRule[]>(
    `/interface/${id}/billing-rules`,
  );
}

async function getInterfaceRequestValidation(id: string) {
  return requestClient.get<InterfaceApi.RequestValidationPolicy>(
    `/interface/${id}/request-validation`,
  );
}

async function getInterfaceDeliveryPolicy(id: string) {
  return requestClient.get<InterfaceApi.DeliveryPolicy>(
    `/interface/${id}/delivery-policy`,
  );
}

async function getGlobalDeliveryPolicy() {
  return requestClient.get<InterfaceApi.DeliveryPolicy>(
    '/interface/global-delivery-policy',
  );
}

async function updateInterfaceDeliveryPolicy(
  id: string,
  data: InterfaceApi.SaveDeliveryPolicy,
) {
  return requestClient.put(`/interface/${id}/delivery-policy`, data);
}

async function updateGlobalDeliveryPolicy(
  data: InterfaceApi.SaveDeliveryPolicy,
) {
  return requestClient.put('/interface/global-delivery-policy', data);
}

async function getResponseAdvertisementOptions() {
  return requestClient.get<InterfaceApi.ResponseAdvertisementOption[]>(
    '/interface/response-advertisements',
  );
}

async function getInterfaceCallLogList(
  params: InterfaceApi.CallLogListParams,
  userScope = false,
  signal?: AbortSignal,
) {
  const url = userScope ? '/user/call-logs' : '/interface/call-log/list';
  return requestClient.get<{
    items: InterfaceApi.CallLogViewItem[];
    nextCursor?: string;
    total: number;
    totalOmitted?: boolean;
  }>(url, {
    params,
    retry: false,
    signal,
    // Server list budgets are 6s (fast) / 15s (exact), leaving transport margin.
    timeout: params.includeTotal === false ? 8000 : 17_000,
  });
}

async function getInterfaceCallLogDetail(
  id: string,
  userScope = false,
  unmasked = false,
) {
  const url = userScope ? `/user/call-logs/${id}` : `/interface/call-log/${id}`;
  return requestClient.get<InterfaceApi.CallLogViewItem>(url, {
    params: !userScope && unmasked ? { unmasked: 1 } : undefined,
  });
}

async function hideUserCallLog(id: string) {
  return requestClient.delete<boolean>(`/user/call-logs/${id}`);
}

async function exportInterfaceCallLogs(params: InterfaceApi.CallLogListParams) {
  return requestClient.download<Blob>('/interface/call-log/export', {
    params,
    // Streaming export issues up to 100 keyset batches (50k rows / 500 per
    // batch) with a 15s timeout each; a short client timeout would abort the
    // download mid-stream on large datasets.
    timeout: 600_000,
  });
}

async function saveInterfaceBillingRules(
  id: string,
  rules: InterfaceApi.BillingRule[],
  settings?: { billingEnabled: 0 | 1; billingLogEnabled: 0 | 1 },
) {
  return requestClient.put(`/interface/${id}/billing-rules`, {
    rules,
    ...settings,
  });
}

async function updateInterfaceRequestValidation(
  id: string,
  data: InterfaceApi.SaveRequestValidationPolicy,
) {
  return requestClient.put(`/interface/${id}/request-validation`, data);
}

async function uploadInterfaceAvatar({
  file,
  onError,
  onProgress,
  onSuccess,
}: UploadFileParams) {
  try {
    onProgress?.({ percent: 0 });
    const data = await requestClient.upload('/upload/interface-avatar', {
      file,
    });
    onProgress?.({ percent: 100 });
    onSuccess?.(data, file);
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error(String(error)));
  }
}

const optionPageSize = 20;

function toInterfaceOption(item: {
  apiCode?: string;
  id: number | string;
  name: string;
}) {
  return {
    id: String(item.id),
    label: `#${item.id} · ${item.name}${item.apiCode ? ` (${item.apiCode})` : ''}`,
  };
}

/** 管理员按关键字搜索接口选项（单页、服务端搜索）。 */
async function searchInterfaceOptions(keyword: string, signal?: AbortSignal) {
  const result = await getInterfaceList(
    { keyword: keyword || undefined, page: 1, pageSize: optionPageSize },
    signal,
  );
  return (result.items ?? []).map(toInterfaceOption);
}

/** 用户按关键字搜索其可用接口选项（market 端点，单页）。 */
async function searchMarketInterfaceOptions(
  keyword: string,
  signal?: AbortSignal,
) {
  const result = await requestClient.get<{
    items: Array<{ apiCode?: string; id: number | string; name: string }>;
    total: number;
  }>('/market/apis', {
    params: {
      keyword: keyword || undefined,
      page: 1,
      pageSize: optionPageSize,
    },
    signal,
  });
  return (result.items ?? []).map(toInterfaceOption);
}

export {
  batchDeleteInterfaces,
  batchUpdateInterfaceStatus,
  checkInterfaceUpstreams,
  createInterface,
  deleteInterface,
  exportInterfaceCallLogs,
  getAllEnabledInterfaces,
  getAllInterfaces,
  getGlobalDeliveryPolicy,
  getInterfaceBillingRules,
  getInterfaceCallLogDetail,
  getInterfaceCallLogList,
  getInterfaceDegrade,
  getInterfaceDeliveryPolicy,
  getInterfaceDoc,
  getInterfaceInvokeKeys,
  getInterfaceList,
  getInterfaceMetering,
  getInterfacePolling,
  getInterfaceQuota,
  getInterfaceRequestValidation,
  getResponseAdvertisementOptions,
  hideUserCallLog,
  inspectInterfaceProxyPool,
  invokeInterface,
  saveInterfaceBillingRules,
  searchInterfaceOptions,
  searchMarketInterfaceOptions,
  testInterfaceProxyPool,
  updateGlobalDeliveryPolicy,
  updateInterface,
  updateInterfaceDegrade,
  updateInterfaceDeliveryPolicy,
  updateInterfaceDoc,
  updateInterfaceMetering,
  updateInterfacePolling,
  updateInterfaceQuota,
  updateInterfaceRequestValidation,
  uploadInterfaceAvatar,
};
