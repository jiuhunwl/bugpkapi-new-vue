import type {
  ApplicationConfig,
  VbenAdminProAppConfigRaw,
} from '@vben/types/global';

/**
 * 由 vite-inject-app-config 注入的全局配置
 */
export function useAppConfig(
  env: Record<string, any>,
  isProduction: boolean,
): ApplicationConfig {
  // 生产环境下，直接使用 window._VBEN_ADMIN_PRO_APP_CONF_ 全局变量
  const config = isProduction
    ? (window._VBEN_ADMIN_PRO_APP_CONF_ ?? {})
    : (env as VbenAdminProAppConfigRaw);

  const {
    VITE_GLOB_API_URL,
    VITE_GLOB_AUTH_DINGDING_CORP_ID,
    VITE_GLOB_AUTH_DINGDING_CLIENT_ID,
  } = config;

  // 生产运行时配置由 vite-inject-app-config 注入。若旧部署包缺少该文件
  // 或文件内容为空，请求必须仍然指向后端前缀，不能退回当前页面并拿到 index.html。
  const apiURL = normalizeApiURL(VITE_GLOB_API_URL);

  const applicationConfig: ApplicationConfig = {
    apiURL,
    auth: {},
  };
  if (VITE_GLOB_AUTH_DINGDING_CORP_ID && VITE_GLOB_AUTH_DINGDING_CLIENT_ID) {
    applicationConfig.auth.dingding = {
      clientId: VITE_GLOB_AUTH_DINGDING_CLIENT_ID,
      corpId: VITE_GLOB_AUTH_DINGDING_CORP_ID,
    };
  }

  return applicationConfig;
}

function normalizeApiURL(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return '/system-api';
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw.replace(/\/+$/, '');
  }
  const relative = raw.replace(/^\/+/, '').replace(/\/+$/, '');
  return relative ? `/${relative}` : '/system-api';
}
