import { requestClient } from '#/api/request';

/**
 * 额度概览：把「免费额度（用户组）」与「付费额度（套餐 / 点数 / 余额）」
 * 分开返回。两层不合并成一个数字——免费额度按窗口重置，付费额度按权益
 * 有效期存续，混在一起用户就分不清自己在花哪一种。
 */
export namespace QuotaApi {
  export type WindowName =
    | 'day'
    | 'hour'
    | 'minute'
    | 'month'
    | 'new-account';

  export interface WindowUsage {
    /** limit 为 0 表示该窗口不限量，此时 remaining 固定为 -1。 */
    exhausted: boolean;
    limit: number;
    remaining: number;
    resetAt: string;
    used: number;
    window: WindowName;
  }

  export interface PackageUsage {
    dailyLimit: number;
    /** 总调用量快照，0 = 不限 */
    totalLimit?: number;
    /** 累计消耗（含失败计量，取决于 countMode） */
    totalUsed?: number;
    /** 计量方式：success 仅成功计量，attempt 失败也计量 */
    countMode?: 'success' | 'attempt';
    endAt: string;
    exhausted: boolean;
    /** 形如 "GLOBAL:12" / "INTERFACE:7"，前一段是权益所在层。 */
    id: string;
    isPrimary: boolean;
    name: string;
    /** 日剩余与总剩余中更紧的；两侧都不限时为 -1。 */
    remaining: number;
    scope: 'GLOBAL' | 'INTERFACE';
    usedToday: number;
  }

  export interface PaidUsage {
    available: boolean;
    balance: string;
    packages: PackageUsage[];
    points: number;
  }

  export interface RoleBrief {
    countMode: string;
    id: number;
    key: string;
    name: string;
    quotaEnabled: boolean;
  }

  export interface Overview {
    /** 计数不可读时为 false，此时所有 used 都是 0，不能当成真实用量展示。 */
    counterAvailable: boolean;
    free: WindowUsage[];
    newAccount?: WindowUsage;
    paid: PaidUsage;
    role: RoleBrief;
  }
}

export async function getQuotaOverview() {
  return requestClient.get<QuotaApi.Overview>('/user/quota/overview');
}
