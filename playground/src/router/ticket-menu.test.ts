import { describe, expect, it } from 'vitest';
import { normalizeTicketMenus } from './ticket-menu';

describe('legacy ticket menu compatibility', () => {
  it('maps official old menu components to list pages without mutating permissions or input', () => {
    const menus = [
      {
        name: 'TicketCenter',
        path: '/tickets',
        component: '/ticket/index',
        authCode: 'ticket:user:list',
        meta: { title: 'Mine' },
      },
      {
        name: 'AdminTicketManagement',
        path: '/admin/tickets',
        component: '/ticket/admin',
        authCode: 'ticket:admin:list',
      },
    ];
    const mapped = normalizeTicketMenus(menus);
    expect(mapped[0]).toMatchObject({
      name: 'UserTicketCenter',
      path: '/console/tickets',
      component: '/ticket/user-list',
      authCode: 'ticket:user:list',
      meta: { title: 'Mine', fullPathKey: false, keepAlive: false },
    });
    expect(mapped[1]).toMatchObject({
      component: '/ticket/admin-list',
      authCode: 'ticket:admin:list',
    });
    expect(menus[0]?.component).toBe('/ticket/index');
  });
  it('handles nested menus and leaves unrelated or custom paths alone', () => {
    const menus = [
      {
        name: 'RootMenu',
        path: '/other',
        component: 'BasicLayout',
        children: [
          {
            name: 'UserTicketCenter',
            path: '/console/tickets',
            component: '/ticket/user',
          },
        ],
      },
      { name: 'Custom', path: '/custom', component: '/ticket/user' },
    ];
    const mapped = normalizeTicketMenus(menus);
    expect(mapped[0]?.children?.[0]?.component).toBe('/ticket/user-list');
    expect(mapped[1]).toEqual(menus[1]);
  });
});
