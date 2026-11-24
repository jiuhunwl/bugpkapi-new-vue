export type NoticeHubTab = 'list' | 'ticker';

export const NOTICE_HUB_TABS: readonly NoticeHubTab[] = ['list', 'ticker'];

// 「公告管理」与「首页滚动公告」两条历史菜单收敛成同一个页面：路由名只决定期望页签。
const TAB_BY_ROUTE_NAME: Record<string, NoticeHubTab> = {
  HomeNoticeConfig: 'ticker',
  NoticeList: 'list',
};

export interface NoticeHubTabInput {
  canList: boolean;
  canTicker: boolean;
  queryTab?: unknown;
  routeName?: unknown;
}

export function isNoticeHubTab(value: unknown): value is NoticeHubTab {
  return value === 'list' || value === 'ticker';
}

export function canAccessNoticeHubTab(
  tab: NoticeHubTab,
  input: Pick<NoticeHubTabInput, 'canList' | 'canTicker'>,
) {
  return tab === 'ticker' ? input.canTicker : input.canList;
}

// ?tab= 优先于路由名，方便书签与工作台跳转指定页签。
export function preferredNoticeHubTab(
  input: NoticeHubTabInput,
): NoticeHubTab | undefined {
  const preferred = isNoticeHubTab(input.queryTab)
    ? input.queryTab
    : TAB_BY_ROUTE_NAME[String(input.routeName ?? '')];
  return preferred && canAccessNoticeHubTab(preferred, input)
    ? preferred
    : undefined;
}

export function resolveNoticeHubTab(input: NoticeHubTabInput): NoticeHubTab {
  return (
    preferredNoticeHubTab(input) ??
    NOTICE_HUB_TABS.find((tab) => canAccessNoticeHubTab(tab, input)) ??
    'list'
  );
}
