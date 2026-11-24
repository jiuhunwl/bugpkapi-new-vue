import type { InterfaceApi } from '#/api/interface';

export interface PollingUpstreamDraft {
  checkMessage?: string;
  clientId: string;
  failureCount?: number;
  healthStatus?: InterfaceApi.UpstreamConfig['healthStatus'];
  lastCheckedAt?: string;
  lastLatencyMs?: number;
  pollingCheckEnabled: boolean;
  pollingCheckExpected: string;
  pollingCheckField: string;
  responseFieldMappings: InterfaceApi.ResponseFieldMapping[];
  url: string;
}

export interface DomainRouteMatchDraft {
  domainsText: string;
  field: string;
  mode: InterfaceApi.DomainRouteMatchMode;
  source: InterfaceApi.DomainRouteSource;
  valueMode: InterfaceApi.DomainRouteValueMode;
}

export interface DomainPollingRouteDraft {
  clientId: string;
  enabled: boolean;
  id: string;
  match: DomainRouteMatchDraft;
  name: string;
  pollingCheckEnabled: boolean;
  pollingCheckExpected: string;
  pollingCheckField: string;
  pollingEnabled: boolean;
  pollingMode: InterfaceApi.PollingMode;
  pollingStopCode: string;
  priority: number;
  requestUrl: string;
  responseCleaningEnabled: boolean;
  responseFieldMappings: InterfaceApi.ResponseFieldMapping[];
  upstreamConfigs: PollingUpstreamDraft[];
}

export interface DomainRoutingDraft {
  defaultRouteId: string;
  enabled: boolean;
  fallback: InterfaceApi.DomainRouteFallback;
  legacyUpstreams: PollingUpstreamDraft[];
  routes: DomainPollingRouteDraft[];
}

export interface DomainRoutingInput
  extends Partial<Omit<InterfaceApi.DomainRoutingConfig, 'routes'>> {
  routes?: Array<
    Partial<Omit<InterfaceApi.DomainPollingRoute, 'match' | 'upstreamConfigs'>> & {
      match?: Partial<InterfaceApi.DomainRouteMatchConfig>;
      upstreamConfigs?: Array<Partial<InterfaceApi.UpstreamConfig>>;
    }
  >;
}

type DomainRouteInput = NonNullable<DomainRoutingInput['routes']>[number];

export interface LegacyPollingInput {
  upstreamConfigs?: InterfaceApi.UpstreamConfig[];
  upstreamUrls?: string[];
}

const DEFAULT_EXPECTED = '200';
const DEFAULT_FIELD = 'code';
const DEFAULT_PRIORITY = 100;

function text(value: unknown, fallback = ''): string {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function bool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') return value.trim() === '1' || value === 'true';
  return fallback;
}

function pollingMode(value: unknown, enabled = true): InterfaceApi.PollingMode {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized === 'RANDOM') return 'ROUND_ROBIN';
  if (
    normalized === 'FASTEST' ||
    normalized === 'PRIMARY' ||
    normalized === 'ROUND_ROBIN' ||
    normalized === 'SINGLE'
  ) {
    return normalized;
  }
  return enabled ? 'ROUND_ROBIN' : 'SINGLE';
}

/** Read old stored rows using the same inference as the Go polling runtime. */
export function readPollingState(config: {
  pollingEnabled?: unknown;
  pollingMode?: unknown;
  pollingStopCode?: unknown;
  upstreamConfigs?: readonly unknown[];
  upstreamUrls?: readonly unknown[];
}) {
  const mode = text(config.pollingMode).toUpperCase();
  const enabled = bool(config.pollingEnabled) || (
    mode !== 'SINGLE' && (
      Boolean(text(config.pollingStopCode)) ||
      ['FASTEST', 'PRIMARY', 'RANDOM', 'ROUND_ROBIN'].includes(mode) ||
      (mode === '' && ((config.upstreamConfigs?.length ?? 0) > 0 || (config.upstreamUrls?.length ?? 0) > 0))
    )
  );
  return { pollingEnabled: enabled, pollingMode: pollingMode(mode, enabled) };
}

function routeSource(value: unknown): InterfaceApi.DomainRouteSource {
  const normalized = String(value ?? '').trim().toUpperCase();
  return normalized === 'BODY' || normalized === 'QUERY' ? normalized : 'AUTO';
}

function routeMode(value: unknown): InterfaceApi.DomainRouteMatchMode {
  return String(value ?? '').trim().toUpperCase() === 'EXACT'
    ? 'EXACT'
    : 'SUBDOMAIN';
}

function routeValueMode(value: unknown): InterfaceApi.DomainRouteValueMode {
  return String(value ?? '').trim().toUpperCase() === 'ANY' ? 'ANY' : 'ALL';
}

function fallback(value: unknown): InterfaceApi.DomainRouteFallback {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized === 'DEFAULT_ROUTE' || normalized === 'REJECT') {
    return normalized;
  }
  return 'DEFAULT_POOL';
}

function cloneMappings(
  mappings?: InterfaceApi.ResponseFieldMapping[],
): InterfaceApi.ResponseFieldMapping[] {
  return (mappings ?? []).map((mapping) => ({
    source: String(mapping.source ?? ''),
    target: String(mapping.target ?? ''),
  }));
}

function clientId(prefix: string, index: number): string {
  return `${prefix}:${index}`;
}

function nextRouteId(index: number, usedIds = new Set<string>()): string {
  let serial = Math.max(1, index + 1);
  while (usedIds.has(`route-${serial}`)) serial += 1;
  return `route-${serial}`;
}

/**
 * Split the admin's friendly domain input without retaining formatting-only
 * differences. The backend performs the authoritative DNS validation; this
 * helper only makes the draft predictable and easy to review.
 */
export function parseDomainText(value: unknown): string[] {
  const rawValues = Array.isArray(value) ? value : String(value ?? '').split(/[\s,;]+/u);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of rawValues) {
    let domain = String(raw ?? '').trim().toLowerCase();
    if (!domain) continue;
    if (domain.includes('://')) {
      try {
        domain = new URL(domain).hostname.toLowerCase();
      } catch {
        // Leave malformed input visible; the backend will return the useful
        // validation error instead of silently changing what the admin typed.
      }
    }
    domain = domain.replace(/^\*\./u, '').replace(/\.$/u, '');
    if (domain && !seen.has(domain)) {
      seen.add(domain);
      result.push(domain);
    }
  }
  return result;
}

export function upstreamDraftsFromConfig(
  configs?: Array<Partial<InterfaceApi.UpstreamConfig>>,
  legacyUrls?: string[],
): PollingUpstreamDraft[] {
  const source: Array<Partial<InterfaceApi.UpstreamConfig>> =
    configs && configs.length > 0
      ? configs
      : (legacyUrls ?? []).map((url) => ({ url }));
  return source.map((config, index) => ({
    checkMessage: undefined,
    clientId: clientId('upstream', index),
    failureCount: config.failureCount,
    healthStatus: config.healthStatus,
    lastCheckedAt: config.lastCheckedAt,
    lastLatencyMs: config.lastLatencyMs,
    pollingCheckEnabled: config.pollingCheckEnabled === 1,
    pollingCheckExpected: text(config.pollingCheckExpected, DEFAULT_EXPECTED),
    pollingCheckField: text(config.pollingCheckField, DEFAULT_FIELD),
    responseFieldMappings: cloneMappings(config.responseFieldMappings),
    url: String(config.url ?? '').trim(),
  }));
}

export function createDomainRouteDraft(
  route?: DomainRouteInput,
  index = 0,
  usedIds = new Set<string>(),
): DomainPollingRouteDraft {
  const enabled = bool(route?.enabled, true);
  const routeId = text(route?.id) || nextRouteId(index, usedIds);
  const match = route?.match;
  const domains = parseDomainText(match?.domains);
  const upstreamConfigs = route?.upstreamConfigs ?? [];
  const polling = route
    ? readPollingState(route)
    : { pollingEnabled: true, pollingMode: 'ROUND_ROBIN' as const };
  return {
    clientId: clientId(`route:${routeId}`, index),
    enabled,
    id: routeId,
    match: {
      domainsText: domains.join('\n'),
      field: text(match?.field, 'url'),
      mode: routeMode(match?.mode),
      source: routeSource(match?.source),
      valueMode: routeValueMode(match?.valueMode),
    },
    name: text(route?.name, routeId),
    pollingCheckEnabled: bool(route?.pollingCheckEnabled),
    pollingCheckExpected: text(route?.pollingCheckExpected, DEFAULT_EXPECTED),
    pollingCheckField: text(route?.pollingCheckField, DEFAULT_FIELD),
    ...polling,
    pollingStopCode: text(route?.pollingStopCode),
    priority: Number.isFinite(Number(route?.priority))
      ? Math.trunc(Number(route?.priority))
      : DEFAULT_PRIORITY,
    requestUrl: text(route?.requestUrl),
    responseCleaningEnabled: bool(route?.responseCleaningEnabled),
    responseFieldMappings: cloneMappings(route?.responseFieldMappings),
    upstreamConfigs: upstreamDraftsFromConfig(upstreamConfigs),
  };
}

export function createDomainRoutingDraft(
  config?: DomainRoutingInput,
  legacy?: LegacyPollingInput,
): DomainRoutingDraft {
  const routes = config?.routes ?? [];
  const usedIds = new Set<string>();
  const routeDrafts = routes.map((route, index) => {
    const draft = createDomainRouteDraft(route, index, usedIds);
    usedIds.add(draft.id);
    return draft;
  });
  return {
    defaultRouteId: text(config?.defaultRouteId),
    enabled: bool(config?.enabled),
    fallback: fallback(config?.fallback),
    legacyUpstreams: upstreamDraftsFromConfig(
      legacy?.upstreamConfigs,
      legacy?.upstreamUrls,
    ),
    routes: routeDrafts,
  };
}

export function addDomainRoute(
  routes: DomainPollingRouteDraft[],
): DomainPollingRouteDraft[] {
  const usedIds = new Set(routes.map((route) => text(route.id)));
  const index = routes.length;
  return [
    ...routes,
    createDomainRouteDraft(undefined, index, usedIds),
  ];
}

export function updateDomainRouteDraft(
  routes: DomainPollingRouteDraft[],
  index: number,
  replacement: DomainPollingRouteDraft,
  defaultRouteId = '',
): {
  defaultRouteId: string;
  routes: DomainPollingRouteDraft[];
} {
  const previousId = routes[index]?.id;
  const nextRoutes = routes.map((route, routeIndex) =>
    routeIndex === index ? replacement : route,
  );
  return {
    defaultRouteId:
      previousId && defaultRouteId === previousId
        ? text(replacement.id)
        : defaultRouteId,
    routes: nextRoutes,
  };
}

export function removeDomainRoute(
  routes: DomainPollingRouteDraft[],
  clientIdToRemove: string,
): DomainPollingRouteDraft[] {
  return routes.filter((route) => route.clientId !== clientIdToRemove);
}

function normalizeUpstreamDrafts(
  drafts: PollingUpstreamDraft[],
): InterfaceApi.UpstreamConfig[] {
  const seen = new Set<string>();
  return drafts.reduce<InterfaceApi.UpstreamConfig[]>((result, draft) => {
    const url = text(draft.url);
    if (!url || seen.has(url)) return result;
    seen.add(url);
    const config: InterfaceApi.UpstreamConfig = {
      pollingCheckEnabled: draft.pollingCheckEnabled ? 1 : 0,
      pollingCheckExpected: text(draft.pollingCheckExpected, DEFAULT_EXPECTED),
      pollingCheckField: text(draft.pollingCheckField, DEFAULT_FIELD),
      url,
    };
    // In the dedicated editor an empty list is an explicit clear. Omitting
    // it asks the backend to preserve the stored mappings for legacy clients.
    config.responseFieldMappings = cloneMappings(draft.responseFieldMappings);
    result.push(config);
    return result;
  }, []);
}

export function normalizeDomainRoutingDraft(
  draft: DomainRoutingDraft,
): InterfaceApi.DomainRoutingConfig {
  const routes = draft.routes.map((route, index) => {
    const id = text(route.id) || nextRouteId(index);
    const domains = parseDomainText(route.match.domainsText);
    return {
      enabled: route.enabled ? 1 : 0,
      id,
      match: {
        domains,
        field: text(route.match.field, 'url'),
        mode: routeMode(route.match.mode),
        source: routeSource(route.match.source),
        valueMode: routeValueMode(route.match.valueMode),
      },
      name: text(route.name, id),
      pollingCheckEnabled: route.pollingCheckEnabled ? 1 : 0,
      pollingCheckExpected: text(
        route.pollingCheckExpected,
        DEFAULT_EXPECTED,
      ),
      pollingCheckField: text(route.pollingCheckField, DEFAULT_FIELD),
      pollingEnabled: route.pollingEnabled ? 1 : 0,
      pollingMode: pollingMode(route.pollingMode, route.pollingEnabled),
      pollingStopCode: text(route.pollingStopCode),
      priority: Number.isFinite(Number(route.priority))
        ? Math.trunc(Number(route.priority))
        : DEFAULT_PRIORITY,
      requestUrl: text(route.requestUrl),
      responseCleaningEnabled: route.responseCleaningEnabled ? 1 : 0,
      responseFieldMappings: cloneMappings(route.responseFieldMappings),
      upstreamConfigs: normalizeUpstreamDrafts(route.upstreamConfigs),
    } satisfies InterfaceApi.DomainPollingRoute;
  });
  const defaultRouteId = text(draft.defaultRouteId);
  return {
    defaultRouteId: defaultRouteId || undefined,
    enabled: draft.enabled ? 1 : 0,
    fallback: fallback(draft.fallback),
    routes,
  };
}

export function normalizeLegacyUpstreams(
  drafts: PollingUpstreamDraft[],
): InterfaceApi.UpstreamConfig[] {
  return normalizeUpstreamDrafts(drafts);
}

/** Return whether saving the draft should materialize a domainRouting object. */
export function hasDomainRoutingSettings(draft: DomainRoutingDraft): boolean {
  return (
    draft.enabled ||
    draft.routes.length > 0 ||
    Boolean(text(draft.defaultRouteId)) ||
    draft.fallback !== 'DEFAULT_POOL'
  );
}

function hasPersistedDomainRouting(
  config?: InterfaceApi.DomainRoutingConfig,
): boolean {
  return Boolean(
    config &&
      (config.enabled === 1 ||
        Boolean(text(config.fallback)) ||
        Boolean(text(config.defaultRouteId)) ||
        (config.routes?.length ?? 0) > 0),
  );
}

/**
 * Omit the extension for untouched legacy rows, but send an explicit disabled
 * document when an existing domain-routing document was cleared in the UI.
 * The distinction matters because the API preserves omitted fields for
 * backwards-compatible partial saves.
 */
export function normalizeDomainRoutingForSave(
  draft: DomainRoutingDraft,
  existing?: InterfaceApi.DomainRoutingConfig,
): InterfaceApi.DomainRoutingConfig | undefined {
  if (!hasDomainRoutingSettings(draft) && !hasPersistedDomainRouting(existing)) {
    return undefined;
  }
  return normalizeDomainRoutingDraft(draft);
}

function applyCheckResult(
  draft: PollingUpstreamDraft,
  result: InterfaceApi.UpstreamCheckResult,
) {
  draft.healthStatus = result.healthStatus;
  draft.lastLatencyMs = result.latencyMs;
  draft.lastCheckedAt = result.checkedAt || draft.lastCheckedAt;
  draft.checkMessage = result.message;
  if (result.healthStatus === 'HEALTHY') {
    draft.failureCount = 0;
  }
}

/**
 * Merge an administrative probe response into the editable draft. Route IDs
 * are mandatory for sub-route rows because the same upstream URL may be
 * intentionally reused by multiple independent pools.
 */
export function applyCheckResultsToDraft(
  results: InterfaceApi.UpstreamCheckResult[],
  primaryUrl: string,
  legacyUpstreams: PollingUpstreamDraft[],
  routes: DomainPollingRouteDraft[],
): InterfaceApi.UpstreamCheckResult | undefined {
  const normalizedPrimaryUrl = text(primaryUrl);
  let primaryResult: InterfaceApi.UpstreamCheckResult | undefined;
  for (const result of results) {
    const routeId = text(result.routeId);
    const url = text(result.url);
    if (!url) continue;
    if (!routeId) {
      if (normalizedPrimaryUrl && url === normalizedPrimaryUrl) {
        primaryResult = result;
        continue;
      }
      const legacy = legacyUpstreams.find((item) => text(item.url) === url);
      if (legacy) applyCheckResult(legacy, result);
      continue;
    }
    const route = routes.find((item) => text(item.id) === routeId);
    if (!route) continue;
    const upstream = route.upstreamConfigs.find(
      (item) => text(item.url) === url,
    );
    if (upstream) applyCheckResult(upstream, result);
  }
  return primaryResult;
}

export function findCheckResult(
  results: InterfaceApi.UpstreamCheckResult[],
  routeId: string,
  url: string,
): InterfaceApi.UpstreamCheckResult | undefined {
  const wantedRoute = text(routeId);
  const wantedUrl = text(url);
  if (!wantedUrl) return undefined;
  return results.find(
    (result) =>
      text(result.routeId) === wantedRoute && text(result.url) === wantedUrl,
  );
}
