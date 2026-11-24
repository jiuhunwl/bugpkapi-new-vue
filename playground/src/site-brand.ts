import type { SiteConfigApi } from '#/api/system/site';

import { reactive, readonly } from 'vue';

import { localeRequestHeaders } from '#/api/locale';
import {
  normalizeGlobalLoadingPreset,
  normalizeLoadingAnimationPreset,
} from '#/api/system/site';

import { useAppConfig } from '@vben/hooks';
import { updatePreferences } from '@vben/preferences';

interface ApiEnvelope<T> {
  code?: number;
  data?: T;
  message?: string;
}

interface PublicCustomCodeConfig {
  cssCode?: string;
  enabled?: number;
  jsCode?: string;
}

const DEFAULT_SITE_NAME = String(
  import.meta.env.VITE_APP_TITLE || 'BugPk-Api',
).trim();
// 像素旧标已彻底退役：正常渲染走「站点配置 logo → 默认品牌图标」。
const DEFAULT_LOGO_URL = '/brand-options/bugpk-icon.png';
const ANALYTICS_HEAD_TAGS = new Set([
  'BASE',
  'LINK',
  'META',
  'SCRIPT',
  'STYLE',
  'TITLE',
]);
const ANALYTICS_MARKER_ATTRIBUTE = 'data-bugpk-site-analytics';
const CUSTOM_STYLE_ID = 'bugpk-site-custom-style';
const CUSTOM_SCRIPT_ID = 'bugpk-site-custom-script';
const CUSTOM_CODE_MARKER = 'data-bugpk-site-custom-code';
const SITE_CONFIG_TIMEOUT_MS = 5000;
const BRAND_LOGO_TIMEOUT_MS = 5000;
const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
let logoResolutionGeneration = 0;

const siteBrand = reactive({
  copyright: '',
  description: '',
  githubUrl: '',
  icp: '',
  // 全局加载动画预设：路由切换 / 请求挂起时由 GlobalRouteLoading 渲染
  globalLoadingPreset: normalizeGlobalLoadingPreset(undefined),
  logoUrl: DEFAULT_LOGO_URL,
  siteName: DEFAULT_SITE_NAME,
  slogan: '',
});

function normalizeApiUrl(path: string) {
  const base = String(apiURL || '').replace(/\/$/, '');
  return `${base}${path}`;
}

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function copyrightYear(copyright: string) {
  return (
    copyright.match(/\b(19|20)\d{2}\b/)?.[0] || String(new Date().getFullYear())
  );
}

function updateFavicon(logoUrl: string) {
  if (typeof document === 'undefined') {
    return;
  }

  // 与当前 favicon 一致时跳过，避免重复写 DOM 触发浏览器重载图标
  let icon = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (icon?.href.endsWith(logoUrl) || icon?.getAttribute('href') === logoUrl) {
    return;
  }
  if (!icon) {
    icon = document.createElement('link');
    icon.rel = 'icon';
    document.head.append(icon);
  }
  icon.href = logoUrl;
}

function preloadBrandLogo(logoUrl: string) {
  if (typeof Image === 'undefined') {
    return Promise.resolve(logoUrl);
  }

  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    let settled = false;
    const timeout = globalThis.setTimeout(() => {
      finish(() => reject(new Error('Brand logo loading timed out.')));
    }, BRAND_LOGO_TIMEOUT_MS);

    function finish(callback: () => void) {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      callback();
    }

    image.onload = () => finish(() => resolve(logoUrl));
    image.onerror = () =>
      finish(() => reject(new Error('Brand logo failed to load.')));
    image.decoding = 'async';
    image.src = logoUrl;

    if (image.complete && image.naturalWidth > 0) {
      finish(() => resolve(logoUrl));
    }
  });
}

function commitBrandLogo(logoUrl: string) {
  siteBrand.logoUrl = logoUrl;
  updatePreferences({
    logo: {
      fit: 'contain',
      source: logoUrl,
      sourceDark: logoUrl,
    },
  });
  updateFavicon(logoUrl);
}

function updateGlobalLoadingTitle(siteName: string) {
  if (typeof window === 'undefined') {
    return;
  }

  (window as any).__BUGPK_API_SET_LOADING_SITE_NAME__?.(siteName);
}

function upsertMeta(name: string, content: string) {
  if (typeof document === 'undefined') {
    return;
  }

  let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = name;
    document.head.append(meta);
  }
  meta.content = content;
}

function upsertMetaProperty(property: string, content: string) {
  if (typeof document === 'undefined') {
    return;
  }

  let meta = document.querySelector<HTMLMetaElement>(
    `meta[property="${property}"]`,
  );
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('property', property);
    document.head.append(meta);
  }
  meta.content = content;
}

function updateDocumentMetadata(
  siteName: string,
  description: string,
  seoTitle = '',
  seoKeywords = '',
  ogImage = '',
  noindex = false,
) {
  if (typeof document === 'undefined') {
    return;
  }

  // SEO 标题优先使用后台配置，留空时回退网站名称
  document.title = seoTitle || siteName;
  upsertMeta('author', siteName);
  // 关键词仅在后台配置非空时覆盖（不再硬编码 `${siteName} Open API Platform`）
  if (seoKeywords) {
    upsertMeta('keywords', seoKeywords);
  }
  if (description) {
    upsertMeta('description', description);
  }
  // 分享图：后台配置非空时覆盖 og:image / twitter:image
  if (ogImage) {
    upsertMetaProperty('og:image', ogImage);
    upsertMeta('twitter:image', ogImage);
  }
  // 收录开关：noindex=1 输出 noindex, follow，否则 index, follow
  upsertMeta('robots', noindex ? 'noindex, follow' : 'index, follow');
}

/**
 * 把启动动画配置写入 localStorage，供下次首屏（JS 未执行前）直接读取。
 *
 * 首屏拿不到接口数据，所以启动动画只能用上一次会话缓存的预设；
 * 后台改完保存后，下一次进入站点即生效。
 */
function cacheSplashConfig(
  config: null | Partial<SiteConfigApi.Config> | undefined,
  siteName: string,
) {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    const preset = normalizeLoadingAnimationPreset(
      config?.loadingAnimationPreset,
    );
    const globalPreset = normalizeGlobalLoadingPreset(
      config?.globalLoadingPreset,
    );
    localStorage.setItem(
      'bugpk-api-loading-animation-v1',
      JSON.stringify({
        enabled: Number(config?.loadingAnimationEnabled) === 1,
        globalPreset,
        preset,
        siteName,
        url: clean(config?.loadingAnimationUrl),
      }),
    );
  } catch {
    // 隐私模式或配额不足时静默跳过，首屏回落到默认预设
  }
}

async function applySiteBrand(config?: null | Partial<SiteConfigApi.Config>) {
  const generation = ++logoResolutionGeneration;
  const siteName = clean(config?.siteName) || DEFAULT_SITE_NAME;
  const configuredLogoUrl = clean(config?.logoUrl);
  const slogan = clean(config?.slogan);
  const description = clean(config?.description);
  const copyright = clean(config?.copyright);
  const githubUrl = clean(config?.githubUrl);
  const icp = clean(config?.icp);
  const seoTitle = clean(config?.seoTitle);
  const seoKeywords = clean(config?.seoKeywords);
  const ogImage = clean(config?.ogImage);
  const noindex = Number(config?.noindex) === 1;

  Object.assign(siteBrand, {
    copyright,
    description,
    githubUrl,
    icp,
    siteName,
    slogan,
  });

  updatePreferences({
    app: {
      name: siteName,
    },
    copyright: {
      companyName: siteName,
      companySiteLink: '',
      date: copyrightYear(copyright),
      enable: true,
      icp,
      icpLink: '',
    },
  });
  updateGlobalLoadingTitle(siteName);
  // 全局加载动画预设：供 GlobalRouteLoading 在路由切换时读取；
  // 与当前值一致时不重新赋值，避免不必要的响应式触发
  const nextGlobalPreset = normalizeGlobalLoadingPreset(
    config?.globalLoadingPreset,
  );
  if (nextGlobalPreset !== siteBrand.globalLoadingPreset) {
    siteBrand.globalLoadingPreset = nextGlobalPreset;
  }
  cacheSplashConfig(config, siteName);
  updateDocumentMetadata(
    siteName,
    description,
    seoTitle,
    seoKeywords,
    ogImage,
    noindex,
  );

  let resolvedLogoUrl = DEFAULT_LOGO_URL;
  if (configuredLogoUrl && configuredLogoUrl !== DEFAULT_LOGO_URL) {
    try {
      resolvedLogoUrl = await preloadBrandLogo(configuredLogoUrl);
    } catch {
      resolvedLogoUrl = DEFAULT_LOGO_URL;
    }
  }

  // A slower load/error callback from an older config must never overwrite a
  // newer successful brand selection.
  if (generation === logoResolutionGeneration) {
    // 后台配置与当前默认一致时（含配置填回默认 URL 的情况）跳过 commit，
    // 不重写偏好与 favicon，零视觉切换
    if (resolvedLogoUrl !== siteBrand.logoUrl) {
      commitBrandLogo(resolvedLogoUrl);
    }
  }

  return readonly(siteBrand);
}

async function loadPublicSiteConfig() {
  const { acceptLanguage, appLocale } = localeRequestHeaders();
  const response = await fetch(normalizeApiUrl('/site/config'), {
    signal: AbortSignal.timeout(SITE_CONFIG_TIMEOUT_MS),
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Accept-Language': acceptLanguage,
      'X-App-Locale': appLocale,
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as ApiEnvelope<SiteConfigApi.Config>;
  return payload?.data ?? null;
}

async function loadPublicCustomCode() {
  const { acceptLanguage, appLocale } = localeRequestHeaders();
  const response = await fetch(normalizeApiUrl('/site/custom-code'), {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Accept-Language': acceptLanguage,
      'X-App-Locale': appLocale,
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload =
    (await response.json()) as ApiEnvelope<PublicCustomCodeConfig>;
  return payload?.data ?? null;
}

function applyPublicCustomCode(config?: null | PublicCustomCodeConfig) {
  if (typeof document === 'undefined') return;

  document
    .querySelectorAll(`[${CUSTOM_CODE_MARKER}]`)
    .forEach((node) => node.remove());
  document.getElementById(CUSTOM_STYLE_ID)?.remove();
  document.getElementById(CUSTOM_SCRIPT_ID)?.remove();

  if (Number(config?.enabled ?? 0) !== 1) return;

  const cssCode = String(config?.cssCode ?? '');
  if (cssCode.trim()) {
    const template = document.createElement('template');
    template.innerHTML = cssCode;
    template.content.querySelectorAll('style').forEach((source, index) => {
      const style = document.createElement('style');
      for (const attribute of Array.from(source.attributes)) {
        style.setAttribute(attribute.name, attribute.value);
      }
      if (index === 0) style.id = CUSTOM_STYLE_ID;
      style.setAttribute(CUSTOM_CODE_MARKER, 'style');
      style.textContent = source.textContent;
      document.head.append(style);
    });
  }

  const jsCode = String(config?.jsCode ?? '');
  if (jsCode.trim()) {
    const template = document.createElement('template');
    template.innerHTML = jsCode;
    template.content.querySelectorAll('script').forEach((source, index) => {
      const script = document.createElement('script');
      for (const attribute of Array.from(source.attributes)) {
        script.setAttribute(attribute.name, attribute.value);
      }
      if (index === 0) script.id = CUSTOM_SCRIPT_ID;
      script.setAttribute(CUSTOM_CODE_MARKER, 'script');
      if (!script.type) script.type = 'text/javascript';
      script.textContent = `${source.textContent ?? ''}\n//# sourceURL=bugpk-site-custom-${index + 1}.js`;
      document.head.append(script);
    });
  }
}

function analyticsTarget(element: Element) {
  return ANALYTICS_HEAD_TAGS.has(element.tagName)
    ? document.head
    : document.body;
}

function appendAnalyticsElement(element: Element) {
  element.setAttribute(ANALYTICS_MARKER_ATTRIBUTE, '');
  (analyticsTarget(element) || document.head).append(element);
}

function appendExecutableAnalyticsScript(source: HTMLScriptElement) {
  const script = document.createElement('script');
  for (const attribute of Array.from(source.attributes)) {
    script.setAttribute(attribute.name, attribute.value);
  }
  if (!source.hasAttribute('async')) {
    script.async = false;
  }
  script.textContent = source.textContent;
  appendAnalyticsElement(script);
}

function applySiteAnalyticsCode(rawCode?: null | string) {
  if (typeof document === 'undefined') return;

  document
    .querySelectorAll(`[${ANALYTICS_MARKER_ATTRIBUTE}]`)
    .forEach((node) => node.remove());

  const code = String(rawCode ?? '').replace(/^\ufeff/, '');
  if (!code.trim()) return;

  const containsMarkup = code.trimStart().startsWith('<');
  if (!containsMarkup) {
    const script = document.createElement('script');
    script.textContent = code;
    appendAnalyticsElement(script);
    return;
  }

  const template = document.createElement('template');
  template.innerHTML = code;
  for (const node of Array.from(template.content.children)) {
    if (node instanceof HTMLScriptElement) {
      appendExecutableAnalyticsScript(node);
      continue;
    }
    appendAnalyticsElement(node.cloneNode(true) as Element);
  }
}

async function initSiteBrand() {
  try {
    const config = await loadPublicSiteConfig();
    await applySiteBrand(config);
    applySiteAnalyticsCode(config?.analyticsCode);
  } catch {
    await applySiteBrand(null);
    applySiteAnalyticsCode(null);
  }
}

async function initPublicCustomCode() {
  try {
    applyPublicCustomCode(await loadPublicCustomCode());
  } catch {
    applyPublicCustomCode(null);
  }
}

function useSiteBrand() {
  return readonly(siteBrand);
}

export {
  applyPublicCustomCode,
  applySiteAnalyticsCode,
  applySiteBrand,
  DEFAULT_LOGO_URL,
  DEFAULT_SITE_NAME,
  initPublicCustomCode,
  initSiteBrand,
  useSiteBrand,
};
