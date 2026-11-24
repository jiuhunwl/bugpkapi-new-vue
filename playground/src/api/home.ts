import { requestClient } from './request';

export namespace HomeApi {
  export interface PlatformStats {
    activeRegions24h: number;
    activeRegions24hDelta: number;
    apiTotal: number;
    availabilityPercent: number | string;
    availabilitySource: 'API_STATUS' | 'CALL_SUCCESS';
    calls24h: number;
    calls24hDeltaPercent: number | string;
    enabledApiTotal: number;
    peakQps24h: number;
    peakQps24hDelta: number;
    userTotal: number;
    /**
     * Analytics truth envelope. The traffic fields above are only meaningful
     * when `analyticsReady` is true; otherwise every name listed in
     * `unavailableFields` must be rendered as unavailable rather than as zero.
     */
    analyticsReady?: boolean;
    coveredUpTo?: string;
    degradedSections?: string[];
    lagSeconds?: number;
    unavailableFields?: string[];
  }

  export interface HotApiItem {
    avatarUrl?: null | string;
    callCount: number;
    description?: string;
    id: number | string;
    isFeatured?: number;
    isTop?: number;
    name: string;
    pointPrice?: number;
    price?: number | string;
    requestMethod?: string;
  }

  export interface HomeNotice {
    content: string;
    enabled: 0 | 1 | number;
    /** 滚动文案由投放到滚动位的公告承载，这里只是定位用的公告编号。 */
    noticeId?: string;
    updateTime?: null | string;
  }

  export interface SiteConfig {
    contactAddress?: string;
    contactEmail?: string;
    contactPhone?: string;
    contactQq?: string;
    contactWechat?: string;
    copyright?: string;
    description?: string;
    githubUrl?: string;
    icp?: string;
    id?: number | string;
    loadingAnimationEnabled?: number;
    loadingAnimationUrl?: string;
    logoUrl?: string;
    siteName: string;
    slogan?: string;
    updateTime?: null | string;
  }

  export interface Overview {
    homeNotice?: HomeNotice;
    hotApis: HotApiItem[];
    siteConfig?: SiteConfig;
    stats: PlatformStats;
  }
}

export function getHomeOverview() {
  return requestClient.get<HomeApi.Overview>('/home/overview');
}
