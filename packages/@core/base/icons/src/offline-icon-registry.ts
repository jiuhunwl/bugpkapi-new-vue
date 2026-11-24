import type { IconifyIcon, IconifyJSON } from '@iconify/vue/offline';

import {
  addCollection as addOfflineCollection,
  addIcon as addOfflineIcon,
} from '@iconify/vue/offline';

const registeredIconNames = new Set<string>();

function addCollection(data: IconifyJSON, prefix?: boolean | string) {
  addOfflineCollection(data, prefix);

  let resolvedPrefix = String(data.prefix || '');
  if (typeof prefix === 'string') {
    resolvedPrefix = prefix;
  } else if (prefix === false) {
    resolvedPrefix = '';
  }
  for (const name of [
    ...Object.keys(data.icons || {}),
    ...Object.keys(data.aliases || {}),
  ]) {
    registeredIconNames.add(
      resolvedPrefix ? `${resolvedPrefix}:${name}` : name,
    );
  }
}

function addIcon(name: string, data: IconifyIcon) {
  registeredIconNames.add(name);
  addOfflineIcon(name, data);
}

function hasOfflineIcon(name: string) {
  return registeredIconNames.has(name);
}

function listIcons(provider = '', prefix = '') {
  const providerToken = provider ? `@${provider}:` : '';
  const prefixToken = prefix ? `${prefix}:` : '';
  const expectedPrefix = `${providerToken}${prefixToken}`;
  return [...registeredIconNames]
    .filter((name) => !expectedPrefix || name.startsWith(expectedPrefix))
    .toSorted();
}

export { addCollection, addIcon, hasOfflineIcon, listIcons };
