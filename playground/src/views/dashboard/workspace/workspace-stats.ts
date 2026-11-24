import type {
  AdminAccessLocation,
  AdminAccessSummary,
  AdminActiveUserStats,
  AdminCallTrend7d,
  AdminOverviewField,
  AdminWorkbenchOverview,
  AdminRevenueTrend7d,
  AdminWorkbenchSection,
  AdminWorkbenchStats,
  CallOutcomeStats,
  InterfacePackageStats,
  MemberPackageStats,
  UserCallTrendStats,
  UserWorkbenchStats,
} from '#/api/core/user';

export const adminOverviewFields = [
  'apiEnabled',
  'apiTotal',
  'keyEnabled',
  'keyTotal',
  'pendingFriendLinks',
  'pendingOrders',
  'todayBillableCalls',
  'todayCalls',
  'todayChargeAmount',
  'todayFailedCalls',
  'todayNewUsers',
  'todayRevenue',
  'todaySuccessCalls',
  'todaySuccessRate',
  'totalRevenue',
  'totalUsers',
] as const satisfies readonly AdminOverviewField[];

const overviewFieldSet = new Set<string>(adminOverviewFields);

function validOverviewValue(
  field: AdminOverviewField,
  value: unknown,
): boolean {
  if (field === 'todaySuccessRate') {
    return (
      typeof value === 'string' &&
      /^\d+(?:\.\d+)?%$/.test(value) &&
      Number(value.slice(0, -1)) <= 100
    );
  }
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0;
  // Some deployments serialize large SQL counts as decimal strings.
  return (
    typeof value === 'string' &&
    /^\d+(?:\.\d+)?$/.test(value) &&
    Number.isFinite(Number(value))
  );
}

function normalizeAdminOverview(
  fallback: AdminWorkbenchOverview,
  value: unknown,
  degraded: boolean,
): AdminWorkbenchOverview {
  const source = isRecord(value) ? value : {};
  const list = source.unavailableFields;
  const explicitHealth =
    Array.isArray(list) &&
    list.every(
      (field) => typeof field === 'string' && overviewFieldSet.has(field),
    );
  // Old degraded responses have no field health: never accept their zero defaults.
  const unavailable = new Set<AdminOverviewField>(
    (degraded && !explicitHealth) || (list !== undefined && !explicitHealth)
      ? adminOverviewFields
      : explicitHealth
      ? (list as AdminOverviewField[])
      : [],
  );
  for (const field of adminOverviewFields) {
    if (!validOverviewValue(field, source[field])) unavailable.add(field);
  }
  return {
    ...mergeKnownFields(fallback, source),
    unavailableFields: [...unavailable],
  };
}

function mergeAdminOverview(
  current: AdminWorkbenchOverview,
  next: AdminWorkbenchOverview,
): AdminWorkbenchOverview {
  const merged = { ...current, unavailableFields: next.unavailableFields };
  const unavailable = new Set(next.unavailableFields);
  for (const field of adminOverviewFields) {
    if (!unavailable.has(field))
      Object.assign(merged, { [field]: next[field] });
  }
  return merged;
}

interface UserWorkbenchDefaultLabels {
  currentPackageName: string;
  currentPackageType: string;
}

type UnknownRecord = Record<string, unknown>;

const adminWorkbenchSectionSet = new Set<AdminWorkbenchSection>([
  'access',
  'activeUsers',
  'alerts',
  'callTrend7d',
  'hotApis',
  'overview',
  'revenueTrend7d',
]);

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeKnownFields<T extends object>(fallback: T, value: unknown): T {
  if (!isRecord(value)) {
    return { ...fallback };
  }
  const result = { ...fallback };
  for (const key of Object.keys(fallback) as Array<keyof T>) {
    const nextValue = value[String(key)];
    if (nextValue !== null && nextValue !== undefined) {
      result[key] = nextValue as T[typeof key];
    }
  }
  return result;
}

function recordArray<T>(value: unknown): T[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isRecord) as T[];
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item ?? ''));
}

function numberArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => {
    const numberValue = Number(item ?? 0);
    return Number.isFinite(numberValue) ? numberValue : 0;
  });
}

function moneyArray(value: unknown): Array<number | string> {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) =>
    typeof item === 'number' || typeof item === 'string' ? item : 0,
  );
}

function normalizeDegradedSections(value: unknown): AdminWorkbenchSection[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [
    ...new Set(
      value.filter(
        (section): section is AdminWorkbenchSection =>
          typeof section === 'string' &&
          adminWorkbenchSectionSet.has(section as AdminWorkbenchSection),
      ),
    ),
  ];
}

function normalizeAdminActiveUser(value: unknown): AdminActiveUserStats {
  const source = isRecord(value) ? value : {};
  const rawId = source.id;
  const rawChargeAmount = source.chargeAmount;
  const todayCalls = Number(source.todayCalls ?? source.callCount ?? 0);
  const successCalls = Number(source.successCalls ?? 0);

  return {
    chargeAmount:
      typeof rawChargeAmount === 'number' || typeof rawChargeAmount === 'string'
        ? rawChargeAmount
        : 0,
    id: typeof rawId === 'number' || typeof rawId === 'string' ? rawId : '',
    realName: String(source.realName ?? ''),
    successCalls: Number.isFinite(successCalls) ? successCalls : 0,
    successRate: String(
      source.successRate ??
        ((Number.isFinite(todayCalls) ? todayCalls : 0) > 0 ? '—' : '0%'),
    ),
    todayCalls: Number.isFinite(todayCalls) ? todayCalls : 0,
    username: String(source.username ?? ''),
  };
}

function normalizeAdminAccessLocation(value: unknown): AdminAccessLocation {
  const source = isRecord(value) ? value : {};
  const numberValue = (key: string) => {
    const parsed = Number(source[key] ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  return {
    averageElapsedMs: numberValue('averageElapsedMs'),
    callCount: numberValue('callCount'),
    city: String(source.city ?? ''),
    country: String(source.country ?? ''),
    failedCalls: numberValue('failedCalls'),
    firstSeen: String(source.firstSeen ?? ''),
    isp: String(source.isp ?? ''),
    lastSeen: String(source.lastSeen ?? ''),
    latitude: source.latitude as number | string | undefined,
    longitude: source.longitude as number | string | undefined,
    province: String(source.province ?? ''),
    region: String(source.region ?? ''),
    riskHits: numberValue('riskHits'),
    successCalls: numberValue('successCalls'),
    uniqueIps: numberValue('uniqueIps'),
  };
}

function emptyAdminAccessSummary(): AdminAccessSummary {
  return {
    activeCountries: 0,
    activeLocations: 0,
    failedCalls: 0,
    successCalls: 0,
    totalCalls: 0,
    uniqueIps: 0,
    windowDays: 30,
  };
}

export function emptyUserCallTrend(): UserCallTrendStats {
  return {
    labels: [],
    total: 0,
    values: [],
  };
}

function normalizeAdminAccessSummary(value: unknown): AdminAccessSummary {
  const result = mergeKnownFields(emptyAdminAccessSummary(), value);
  const numberValue = (input: unknown) => {
    const parsed = Number(input ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  return {
    activeCountries: numberValue(result.activeCountries),
    activeLocations: numberValue(result.activeLocations),
    failedCalls: numberValue(result.failedCalls),
    successCalls: numberValue(result.successCalls),
    totalCalls: numberValue(result.totalCalls),
    uniqueIps: numberValue(result.uniqueIps),
    windowDays: numberValue(result.windowDays) || 30,
  };
}

function normalizeUserCallTrend(value: unknown): UserCallTrendStats {
  const result = mergeKnownFields(emptyUserCallTrend(), value);
  return {
    ...result,
    labels: stringArray(result.labels),
    values: numberArray(result.values),
  };
}

export function createDefaultUserWorkbenchStats(
  labels: UserWorkbenchDefaultLabels,
): UserWorkbenchStats {
  return {
    balance: '0.0000',
    callTrends: {
      oneYear: emptyUserCallTrend(),
      sevenDays: emptyUserCallTrend(),
      thirtyDays: emptyUserCallTrend(),
    },
    currentPackageName: labels.currentPackageName,
    currentPackageType: labels.currentPackageType,
    dailyLimit: 0,
    dailyLimitUnlimited: false,
    failedCalls: 0,
    failedRate: '0%',
    hasAnyPackage: false,
    hasMemberPackage: false,
    interfacePackageCount: 0,
    interfacePackages: [],
    memberPackage: null,
    outcomes: emptyCallOutcomes(),
    points: 0,
    packageQuotaPreferred: false,
    qpsLimit: 1,
    qpsLimitUnlimited: false,
    remainingCalls: 0,
    remainingUnlimited: false,
    roleQuotaCountMode: 'attempt',
    roleQuotaDayLimit: 0,
    roleQuotaDayRemaining: 0,
    roleQuotaDayUnlimited: true,
    roleQuotaDayUsed: 0,
    roleQuotaEnabled: false,
    roleQuotaHourLimit: 0,
    roleQuotaMinuteLimit: 0,
    roleQuotaMonthLimit: 0,
    roleKey: '',
    roleName: '',
    successCalls: 0,
    successRate: '0%',
    todayCalls: 0,
  };
}

export function normalizeUserWorkbenchStats(
  value: unknown,
  labels: UserWorkbenchDefaultLabels,
): UserWorkbenchStats {
  const fallback = createDefaultUserWorkbenchStats(labels);
  const result = mergeKnownFields(fallback, value);
  const callTrends: UnknownRecord = isRecord(result.callTrends)
    ? result.callTrends
    : {};
  return {
    ...result,
    callTrends: {
      oneYear: normalizeUserCallTrend(callTrends.oneYear),
      sevenDays: normalizeUserCallTrend(callTrends.sevenDays),
      thirtyDays: normalizeUserCallTrend(callTrends.thirtyDays),
    },
    interfacePackages: recordArray<InterfacePackageStats>(
      result.interfacePackages,
    ),
    memberPackage: isRecord(result.memberPackage)
      ? (result.memberPackage as unknown as MemberPackageStats)
      : null,
    outcomes: normalizeCallOutcomes(result.outcomes),
  };
}

export function emptyCallOutcomes(): CallOutcomeStats {
  return {
    available: false,
    calls: 0,
    successCalls: 0,
    expectedEmptyCalls: 0,
    clientErrorCalls: 0,
    throttledCalls: 0,
    upstreamFailureCalls: 0,
    sampleCalls: 0,
    successRate: '0%',
    serviceFailureRate: '0%',
    clientErrorRate: '0%',
    throttleRate: '0%',
    expectedEmptyRate: '0%',
  };
}

function normalizeCallOutcomes(value: unknown): CallOutcomeStats {
  const fallback = emptyCallOutcomes();
  const source = isRecord(value) ? value : {};
  const count = (key: keyof CallOutcomeStats) => {
    const parsed = Number(source[key]);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  };
  const rate = (key: keyof CallOutcomeStats) => {
    const raw = source[key];
    return typeof raw === 'string' && /^(?:\d+(?:\.\d+)?%|—)$/.test(raw)
      ? raw
      : fallback[key];
  };
  return {
    available: source.available === true,
    calls: count('calls'),
    successCalls: count('successCalls'),
    expectedEmptyCalls: count('expectedEmptyCalls'),
    clientErrorCalls: count('clientErrorCalls'),
    throttledCalls: count('throttledCalls'),
    upstreamFailureCalls: count('upstreamFailureCalls'),
    sampleCalls: count('sampleCalls'),
    successRate: rate('successRate') as string,
    serviceFailureRate: rate('serviceFailureRate') as string,
    clientErrorRate: rate('clientErrorRate') as string,
    throttleRate: rate('throttleRate') as string,
    expectedEmptyRate: rate('expectedEmptyRate') as string,
  };
}

export function emptyAdminCallTrend(): AdminCallTrend7d {
  return {
    billableCalls: [],
    chargeAmounts: [],
    chargeTotal: '0.00',
    failedCalls: [],
    labels: [],
    successCalls: [],
    total: 0,
    totalCalls: [],
  };
}

function normalizeAdminCallTrend(value: unknown): AdminCallTrend7d {
  const result = mergeKnownFields(emptyAdminCallTrend(), value);
  return {
    ...result,
    billableCalls: numberArray(result.billableCalls),
    chargeAmounts: moneyArray(result.chargeAmounts),
    failedCalls: numberArray(result.failedCalls),
    labels: stringArray(result.labels),
    successCalls: numberArray(result.successCalls),
    totalCalls: numberArray(result.totalCalls),
  };
}

export function emptyAdminRevenueTrend(): AdminRevenueTrend7d {
  return {
    labels: [],
    orderCounts: [],
    paidAmounts: [],
    totalAmount: '0.00',
    totalOrders: 0,
  };
}

function normalizeAdminRevenueTrend(value: unknown): AdminRevenueTrend7d {
  const result = mergeKnownFields(emptyAdminRevenueTrend(), value);
  return {
    ...result,
    labels: stringArray(result.labels),
    orderCounts: numberArray(result.orderCounts),
    paidAmounts: moneyArray(result.paidAmounts),
  };
}

export function createDefaultAdminWorkbenchStats(): AdminWorkbenchStats {
  return {
    accessLocations: [],
    accessSummary: emptyAdminAccessSummary(),
    activeUsers: [],
    alerts: [],
    analyticsReady: false,
    callTrend7d: emptyAdminCallTrend(),
    degradedSections: [],
    hotApis: [],
    outcomes: emptyCallOutcomes(),
    overview: {
      apiEnabled: 0,
      apiTotal: 0,
      keyEnabled: 0,
      keyTotal: 0,
      pendingFriendLinks: 0,
      pendingOrders: 0,
      todayBillableCalls: 0,
      todayCalls: 0,
      todayChargeAmount: '0.00',
      todayFailedCalls: 0,
      todayNewUsers: 0,
      todayRevenue: '0.00',
      todaySuccessCalls: 0,
      todaySuccessRate: '0%',
      totalRevenue: '0.00',
      totalUsers: 0,
    },
    revenueTrend7d: emptyAdminRevenueTrend(),
  };
}

export function normalizeAdminWorkbenchStats(
  value: unknown,
): AdminWorkbenchStats {
  const fallback = createDefaultAdminWorkbenchStats();
  const result = mergeKnownFields(fallback, value);
  const source = isRecord(value) ? value : {};
  return {
    ...result,
    accessLocations: recordArray<AdminAccessLocation>(
      result.accessLocations,
    ).map(normalizeAdminAccessLocation),
    accessSummary: normalizeAdminAccessSummary(result.accessSummary),
    activeUsers: recordArray(result.activeUsers).map(normalizeAdminActiveUser),
    alerts: recordArray(result.alerts),
    analyticsReady:
      typeof source.analyticsReady === 'boolean' ? source.analyticsReady : true,
    callTrend7d: normalizeAdminCallTrend(result.callTrend7d),
    degradedSections: normalizeDegradedSections(source.degradedSections),
    hotApis: recordArray(result.hotApis),
    outcomes: normalizeCallOutcomes(result.outcomes),
    overview: normalizeAdminOverview(
      fallback.overview,
      source.overview,
      normalizeDegradedSections(source.degradedSections).includes('overview') ||
        (source.analyticsReady === false &&
          normalizeDegradedSections(source.degradedSections).length === 0),
    ),
    revenueTrend7d: normalizeAdminRevenueTrend(result.revenueTrend7d),
  };
}

export function mergeAdminWorkbenchSection(
  current: AdminWorkbenchStats,
  value: unknown,
  section: AdminWorkbenchSection,
): AdminWorkbenchStats {
  const next = normalizeAdminWorkbenchStats(value);
  const health = {
    analyticsReady: next.analyticsReady,
    degradedSections: next.degradedSections,
  };
  if (section === 'overview') {
    return {
      ...current,
      ...health,
      outcomes: next.outcomes.available ? next.outcomes : current.outcomes,
      overview: mergeAdminOverview(current.overview, next.overview),
    };
  }
  if (
    next.degradedSections.includes(section) ||
    (next.analyticsReady === false && next.degradedSections.length === 0)
  ) {
    return { ...current, ...health };
  }
  switch (section) {
    case 'access': {
      return {
        ...current,
        ...health,
        accessLocations: next.accessLocations,
        accessSummary: next.accessSummary,
      };
    }
    case 'activeUsers': {
      return { ...current, ...health, activeUsers: next.activeUsers };
    }
    case 'alerts': {
      return { ...current, ...health, alerts: next.alerts };
    }
    case 'callTrend7d': {
      return { ...current, ...health, callTrend7d: next.callTrend7d };
    }
    case 'hotApis': {
      return { ...current, ...health, hotApis: next.hotApis };
    }
    case 'revenueTrend7d': {
      return { ...current, ...health, revenueTrend7d: next.revenueTrend7d };
    }
  }
}

/**
 * 全量合并：后端返回完整 AdminWorkbenchStats 时，直接对整个 next 归一化后替换。
 * 用于 refreshAllSections（一次带全部 sections 的请求），保持其他部分不变。
 */
export function mergeAdminWorkbenchAll(
  current: AdminWorkbenchStats,
  value: unknown,
): AdminWorkbenchStats {
  const next = normalizeAdminWorkbenchStats(value);
  const degraded = new Set(next.degradedSections);
  const merged: AdminWorkbenchStats = {
    ...current,
    analyticsReady: next.analyticsReady,
    degradedSections: next.degradedSections,
    outcomes: next.outcomes.available ? next.outcomes : current.outcomes,
    overview: mergeAdminOverview(current.overview, next.overview),
  };
  // Older/migrating backends can report global unavailability without naming
  // sections. Match the loader's error handling before merging zero defaults.
  if (next.analyticsReady === false && degraded.size === 0) return merged;
  if (!degraded.has('access')) {
    merged.accessLocations = next.accessLocations;
    merged.accessSummary = next.accessSummary;
  }
  if (!degraded.has('activeUsers')) merged.activeUsers = next.activeUsers;
  if (!degraded.has('alerts')) merged.alerts = next.alerts;
  if (!degraded.has('callTrend7d')) merged.callTrend7d = next.callTrend7d;
  if (!degraded.has('hotApis')) merged.hotApis = next.hotApis;
  if (!degraded.has('revenueTrend7d')) {
    merged.revenueTrend7d = next.revenueTrend7d;
  }
  return merged;
}
