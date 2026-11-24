import type { InterfaceApi } from '#/api/interface';

export function clearProxyPoolConfig(): InterfaceApi.ProxyPoolConfig {
  return createProxyPoolDraft();
}

export function clearProxyPoolPassword(
  draft: InterfaceApi.ProxyPoolConfig,
): InterfaceApi.ProxyPoolConfig {
  return {
    ...draft,
    password: '',
    passwordConfigured: false,
  };
}

export function createProxyPoolDraft(
  config: Partial<InterfaceApi.ProxyPoolConfig> = {},
): InterfaceApi.ProxyPoolConfig {
  return {
    apiHeaders: config.apiHeaders?.map((item) => ({ ...item })) || [],
    apiUrl: config.apiUrl || '',
    enabled: config.enabled === 1 ? 1 : 0,
    host: config.host || '',
    jsonPath: config.jsonPath || '',
    password: '',
    passwordConfigured: config.passwordConfigured === true,
    port: Number(config.port || 0),
    protocol: config.protocol || 'HTTP',
    refreshSeconds: Number(config.refreshSeconds || 30),
    source: config.source || 'FIXED',
    username: config.username || '',
  };
}

export function normalizeProxyPoolDraft(
  draft: InterfaceApi.ProxyPoolConfig,
): InterfaceApi.ProxyPoolConfig {
  const source: InterfaceApi.ProxySource =
    draft.source === 'API' ? 'API' : 'FIXED';
  const common = {
    enabled: draft.enabled === 1 ? (1 as const) : (0 as const),
    password: draft.password.trim(),
    passwordConfigured: draft.passwordConfigured === true,
    protocol: draft.protocol || 'HTTP',
    source,
    username: draft.username.trim(),
  };
  if (source === 'FIXED') {
    return {
      ...common,
      apiHeaders: [],
      apiUrl: '',
      host: draft.host.trim(),
      jsonPath: '',
      port: Number(draft.port || 0),
      refreshSeconds: 0,
    };
  }
  return {
    ...common,
    apiHeaders: draft.apiHeaders
      .map((item) => ({
        name: item.name.trim(),
        value: item.value.trim(),
      }))
      .filter((item) => item.name && item.value),
    apiUrl: draft.apiUrl.trim(),
    host: '',
    jsonPath: draft.jsonPath.trim().replace(/^\$\./, ''),
    port: 0,
    refreshSeconds: Number(draft.refreshSeconds || 30),
  };
}
