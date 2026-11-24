import type { InterfaceApi } from '#/api/interface';

import { readPollingState } from '../domain-polling';

/** A retained backup list must not implicitly turn a disabled switch on. */
export function pollingSwitchPayload(
  enabled: unknown,
  mode: unknown,
): Pick<InterfaceApi.SaveInterface, 'pollingEnabled' | 'pollingMode'> {
  if (enabled !== true && enabled !== 1) {
    return { pollingEnabled: 0, pollingMode: 'SINGLE' };
  }
  const pollingMode: InterfaceApi.PollingMode =
    mode === 'PRIMARY' || mode === 'ROUND_ROBIN' ? mode : 'FASTEST';
  return { pollingEnabled: 1, pollingMode };
}

/** Only serialize fields owned by the general form, not hidden node settings. */
export function normalizeUpstreamConfigs(
  value: unknown,
): InterfaceApi.UpstreamConfig[] {
  const urls = String(value ?? '')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set(urls)].map((url) => ({ url }));
}

export function upstreamTextFromItem(item?: InterfaceApi.InterfaceItem) {
  const configs = item?.upstreamConfigs ?? [];
  const urls =
    configs.length > 0
      ? configs.map((config) => config.url)
      : (item?.upstreamUrls ?? []);
  return urls.filter(Boolean).join('\n');
}

/**
 * Basic edits must not replay polling drawer settings from a stale list row.
 * Omit unchanged polling fields; for changed URLs the API retains each stored
 * node's checks/mappings by URL. Only the polling drawer edits those fields.
 */
export function generalFormPollingPayload(
  values: {
    pollingEnabled?: unknown;
    pollingMode?: unknown;
    upstreamUrlsText?: unknown;
  },
  current?: InterfaceApi.InterfaceItem,
): Pick<
  InterfaceApi.SaveInterface,
  'pollingEnabled' | 'pollingMode' | 'upstreamConfigs' | 'upstreamUrls'
> {
  const state = pollingSwitchPayload(values.pollingEnabled, values.pollingMode);
  const configs = normalizeUpstreamConfigs(values.upstreamUrlsText);
  const previousConfigs = normalizeUpstreamConfigs(
    upstreamTextFromItem(current),
  );
  const urlsChanged =
    !current || JSON.stringify(configs) !== JSON.stringify(previousConfigs);
  const previousState = current ? readPollingState(current) : undefined;
  const pollingChanged =
    !previousState ||
    JSON.stringify(state) !==
      JSON.stringify(
        pollingSwitchPayload(
          previousState.pollingEnabled,
          previousState.pollingMode,
        ),
      );
  return {
    // URL saves include the switch so backend legacy inference cannot enable
    // a deliberately disabled pool just because it contains backup nodes.
    ...(pollingChanged || urlsChanged ? state : {}),
    ...(urlsChanged
      ? {
          upstreamConfigs: configs,
          upstreamUrls: configs.map((config) => config.url),
        }
      : {}),
  };
}
