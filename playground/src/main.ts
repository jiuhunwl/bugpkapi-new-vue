import { initPreferences } from '@vben/preferences';
import { unmountGlobalLoading } from '@vben/utils';

import { overridesPreferences } from './preferences';
import { installStartupRecovery } from './startup-recovery';

const startupRecovery = installStartupRecovery();

function resetWindowScroll() {
  window.scrollTo({ behavior: 'auto', left: 0, top: 0 });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

function setupScrollRestoration() {
  if (typeof window === 'undefined') {
    return;
  }

  if ('scrollRestoration' in window.history) {
    window.history.scrollRestoration = 'manual';
  }

  resetWindowScroll();
  window.addEventListener('pageshow', resetWindowScroll, { once: true });
  window.addEventListener('load', resetWindowScroll, { once: true });
}

function migrateDefaultThemeToLight(namespace: string) {
  const migrationKey = `${namespace}-light-theme-migrated-v1`;
  if (localStorage.getItem(migrationKey)) {
    return;
  }

  const preferencesKey = `${namespace}-preferences`;
  const themeKey = `${namespace}-preferences-theme`;
  const cachedPreferences = localStorage.getItem(preferencesKey);

  if (cachedPreferences) {
    try {
      const parsed = JSON.parse(cachedPreferences);
      parsed.value = {
        ...parsed.value,
        theme: {
          ...parsed.value?.theme,
          mode: 'light',
        },
      };
      localStorage.setItem(preferencesKey, JSON.stringify(parsed));
    } catch {
      localStorage.removeItem(preferencesKey);
    }
  }

  localStorage.setItem(themeKey, JSON.stringify({ value: 'light' }));
  localStorage.setItem(migrationKey, 'true');
}

function removeDeprecatedDeptState(namespace: string) {
  const migrationKey = `${namespace}-remove-deprecated-menu-state-v4`;
  if (localStorage.getItem(migrationKey)) {
    return;
  }

  const markers = [
    '/system/dept',
    '/system/role',
    '/dashboard',
    '/analytics',
    '/interface',
    'SystemDept',
    'Dashboard',
    'Analytics',
    'InterfaceManagement',
    'system.dept.title',
    'page.dashboard.analytics',
    'system.interface.title',
    'System:Dept:',
  ];

  for (const storage of [localStorage, sessionStorage]) {
    const keys = Array.from({ length: storage.length }, (_, index) =>
      storage.key(index),
    ).filter((key): key is string => !!key);

    for (const key of keys) {
      if (!key.startsWith(namespace)) {
        continue;
      }

      const value = storage.getItem(key);
      if (value && markers.some((marker) => value.includes(marker))) {
        storage.removeItem(key);
      }
    }
  }

  localStorage.setItem(migrationKey, 'true');
}

function removeLegacySensitiveAccessState(namespace: string) {
  const migrationKey = `${namespace}-remove-sensitive-access-state-v1`;
  if (localStorage.getItem(migrationKey)) {
    return;
  }

  const accessStoreKey = `${namespace}-core-access`;
  localStorage.removeItem(accessStoreKey);
  sessionStorage.removeItem(accessStoreKey);
  localStorage.setItem(migrationKey, 'true');
}

// 像素旧标已退役：清掉缓存里指向它的偏好设置，让 logo / favicon 回退到品牌默认标。
function migrateLegacyPixelLogo(namespace: string) {
  const migrationKey = `${namespace}-pixel-logo-migrated-v1`;
  if (localStorage.getItem(migrationKey)) {
    return;
  }

  const legacyMarker = '/brand-options/pixel/';
  for (const key of [
    `${namespace}-preferences`,
    `${namespace}-preferences-theme`,
  ]) {
    const value = localStorage.getItem(key);
    if (value && value.includes(legacyMarker)) {
      localStorage.removeItem(key);
    }
  }

  localStorage.setItem(migrationKey, 'true');
}

// 旧默认品牌图标（BP 渐变字母块 bp-mark.svg）已彻底下线、文件也已删除：
// 字段级清掉缓存里指向它的 logo 偏好，让首屏直接用新默认 bugpk-icon，
// 避免配置加载后二次切换、或图片 404 落到兜底。
function migrateLegacyBpMarkLogo(namespace: string) {
  const migrationKey = `${namespace}-bpmark-logo-migrated-v1`;
  if (localStorage.getItem(migrationKey)) {
    return;
  }

  const legacyMarker = '/brand-options/bp-mark.svg';
  const key = `${namespace}-preferences`;
  const value = localStorage.getItem(key);
  if (value && value.includes(legacyMarker)) {
    try {
      const parsed = JSON.parse(value);
      const logo = parsed?.value?.logo;
      if (logo && (logo.source === legacyMarker || logo.sourceDark === legacyMarker)) {
        delete parsed.value.logo;
        localStorage.setItem(key, JSON.stringify(parsed));
      }
    } catch {
      localStorage.removeItem(key);
    }
  }

  localStorage.setItem(migrationKey, 'true');
}

async function initApplication() {
  const env = import.meta.env.PROD ? 'prod' : 'dev';
  const appVersion =
    String(import.meta.env.VITE_APP_VERSION || 'v0.0.0-dev').trim() ||
    'v0.0.0-dev';
  const appNamespace =
    String(import.meta.env.VITE_APP_NAMESPACE || 'bugpk-api').trim() ||
    'bugpk-api';
  const namespace = `${appNamespace}-${appVersion}-${env}`;

  migrateDefaultThemeToLight(namespace);
  removeDeprecatedDeptState(namespace);
  removeLegacySensitiveAccessState(namespace);
  migrateLegacyPixelLogo(namespace);
  migrateLegacyBpMarkLogo(namespace);

  await initPreferences({
    namespace,
    overrides: overridesPreferences,
  });

  const { bootstrap } = await import('./bootstrap');
  await bootstrap(namespace);

  unmountGlobalLoading();
  startupRecovery.markApplicationStable();
}

setupScrollRestoration();
void initApplication().catch(startupRecovery.handleStartupError);
