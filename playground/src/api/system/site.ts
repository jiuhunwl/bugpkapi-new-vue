import { requestClient } from '#/api/request';

/** 启动动画（首屏 splash）内置预设 */
export type LoadingAnimationPreset =
  | 'dots'
  | 'forge'
  | 'gateway'
  | 'orbit'
  | 'rail'
  | 'scan';

/** 全局加载动画（路由切换 / 请求挂起）内置预设 */
export type GlobalLoadingPreset =
  | 'bar'
  | 'dots'
  | 'logo'
  | 'packet'
  | 'ring'
  | 'skeleton';

export const LOADING_ANIMATION_PRESETS: LoadingAnimationPreset[] = [
  'forge',
  'gateway',
  'orbit',
  'scan',
  'rail',
  'dots',
];

export const GLOBAL_LOADING_PRESETS: GlobalLoadingPreset[] = [
  'bar',
  'ring',
  'skeleton',
  'packet',
  'logo',
  'dots',
];

export const DEFAULT_LOADING_ANIMATION_PRESET: LoadingAnimationPreset = 'gateway';
export const DEFAULT_GLOBAL_LOADING_PRESET: GlobalLoadingPreset = 'bar';

export function normalizeLoadingAnimationPreset(
  value: unknown,
): LoadingAnimationPreset {
  const preset = String(value ?? '').trim() as LoadingAnimationPreset;
  return LOADING_ANIMATION_PRESETS.includes(preset)
    ? preset
    : DEFAULT_LOADING_ANIMATION_PRESET;
}

export function normalizeGlobalLoadingPreset(
  value: unknown,
): GlobalLoadingPreset {
  const preset = String(value ?? '').trim() as GlobalLoadingPreset;
  return GLOBAL_LOADING_PRESETS.includes(preset)
    ? preset
    : DEFAULT_GLOBAL_LOADING_PRESET;
}

export namespace SiteConfigApi {
  export interface Config {
    analyticsCode?: string;
    authorName?: string;
    authorUrl?: string;
    contactAddress?: string;
    contactEmail?: string;
    contactPhone?: string;
    contactQq?: string;
    contactWechat?: string;
    copyright?: string;
    description?: string;
    icp?: string;
    id?: number | string;
    githubUrl?: string;
    licenseType?: string;
    licenseUrl?: string;
    globalLoadingPreset?: GlobalLoadingPreset;
    loadingAnimationEnabled?: number;
    loadingAnimationPreset?: LoadingAnimationPreset;
    loadingAnimationUrl?: string;
    logoUrl?: string;
    noindex?: number;
    ogImage?: string;
    seoKeywords?: string;
    seoTitle?: string;
    siteName: string;
    siteUrl?: string;
    slogan?: string;
    updateTime?: null | string;
  }
}

interface UploadFileParams {
  file: File;
  onError?: (error: Error) => void;
  onProgress?: (progress: { percent: number }) => void;
  onSuccess?: (data: any, file: File) => void;
}

async function getSiteConfig() {
  return requestClient.get<SiteConfigApi.Config>('/site/admin/config');
}

async function getPublicSiteConfig() {
  return requestClient.get<SiteConfigApi.Config>('/site/config');
}

async function updateSiteConfig(data: SiteConfigApi.Config) {
  return requestClient.put('/site/admin/config', data);
}

async function uploadSiteLogo({
  file,
  onError,
  onProgress,
  onSuccess,
}: UploadFileParams) {
  try {
    onProgress?.({ percent: 0 });
    const data = await requestClient.upload('/upload/site-logo', { file });
    onProgress?.({ percent: 100 });
    onSuccess?.(data, file);
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error(String(error)));
  }
}

async function uploadLoadingAnimation({
  file,
  onError,
  onProgress,
  onSuccess,
}: UploadFileParams) {
  try {
    onProgress?.({ percent: 0 });
    const data = await requestClient.upload('/upload/loading-animation', {
      file,
    });
    onProgress?.({ percent: 100 });
    onSuccess?.(data, file);
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error(String(error)));
  }
}

export {
  getPublicSiteConfig,
  getSiteConfig,
  updateSiteConfig,
  uploadLoadingAnimation,
  uploadSiteLogo,
};
