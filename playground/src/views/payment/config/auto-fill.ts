/**
 * 支付渠道配置的「免手填」地址推导。
 *
 * 同域部署下，后端对外通知地址与前端跳转地址都可以由当前站点域名
 * 自动生成，无需管理员手动拼接。各渠道表单加载配置后对空值调用这里
 * 的函数预填，避免任何需要手动点击「填入」按钮的交互。
 */

const DEFAULT_API_PREFIX = '/system-api';

function apiBaseUrl(): string {
  const apiUrl = String(
    import.meta.env.VITE_GLOB_API_URL || DEFAULT_API_PREFIX,
  ).trim();
  if (/^https?:\/\//i.test(apiUrl)) {
    return apiUrl.replace(/\/$/, '');
  }
  return `${window.location.origin}${apiUrl.startsWith('/') ? apiUrl : `/${apiUrl}`}`.replace(
    /\/$/,
    '',
  );
}

/** 渠道在后端注册的异步通知路径（不含 API 前缀）。 */
export const PAYMENT_NOTIFY_PATHS = {
  alipay: '/payment/alipay/notify',
  hupijiao(method?: null | string): string {
    return `/payment/hupijiao/notify/${method || 'ALIPAY'}`;
  },
  wechat: '/payment/wechat/notify',
} as const;

/** 后端对外异步通知地址。 */
export function suggestedNotifyUrl(path: string): string {
  return `${apiBaseUrl()}${path}`;
}

/** 支付完成后浏览器跳回的控制台地址（hash 路由）。 */
export function suggestedReturnUrl(): string {
  const base = new URL(import.meta.env.BASE_URL || '/', window.location.origin)
    .toString()
    .replace(/\/$/, '');
  return `${base}/#/console/workspace`;
}
