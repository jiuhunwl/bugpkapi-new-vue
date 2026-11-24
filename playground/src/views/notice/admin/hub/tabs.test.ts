import { describe, expect, it } from 'vitest';

import {
  canAccessNoticeHubTab,
  NOTICE_HUB_TABS,
  preferredNoticeHubTab,
  resolveNoticeHubTab,
} from './tabs';

const ALL = { canList: true, canTicker: true };

describe('notice hub tab resolution', () => {
  it('keeps the two historical menus on their own pane', () => {
    expect(resolveNoticeHubTab({ ...ALL, routeName: 'NoticeList' })).toBe('list');
    expect(resolveNoticeHubTab({ ...ALL, routeName: 'HomeNoticeConfig' })).toBe(
      'ticker',
    );
  });

  it('falls back to a pane the role may open', () => {
    // 只被授权 notice:home-config 的角色沿用旧书签 /content/notices 时，
    // 应落到滚动位页签而不是停在一个空列表上。
    expect(
      resolveNoticeHubTab({
        canList: false,
        canTicker: true,
        routeName: 'NoticeList',
      }),
    ).toBe('ticker');
    expect(
      resolveNoticeHubTab({
        canList: true,
        canTicker: false,
        routeName: 'HomeNoticeConfig',
      }),
    ).toBe('list');
  });

  it('lets ?tab= win over the route name', () => {
    expect(
      resolveNoticeHubTab({ ...ALL, queryTab: 'ticker', routeName: 'NoticeList' }),
    ).toBe('ticker');
  });

  it('ignores a tab the role cannot access or that is not a tab', () => {
    expect(
      preferredNoticeHubTab({ canList: false, canTicker: true, queryTab: 'list' }),
    ).toBeUndefined();
    expect(
      preferredNoticeHubTab({ ...ALL, queryTab: '../../admin', routeName: 'NoticeList' }),
    ).toBe('list');
    expect(preferredNoticeHubTab({ ...ALL, queryTab: 'secret' })).toBeUndefined();
    expect(preferredNoticeHubTab({ ...ALL })).toBeUndefined();
  });

  it('stays on list when no pane is granted so the page can say so', () => {
    const none = { canList: false, canTicker: false };
    expect(resolveNoticeHubTab(none)).toBe('list');
    expect(NOTICE_HUB_TABS.every((tab) => !canAccessNoticeHubTab(tab, none))).toBe(
      true,
    );
  });
});
