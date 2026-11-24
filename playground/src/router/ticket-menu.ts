import type { RouteRecordStringComponent } from '@vben/types';

/** Adapt only official ticket menu entries; keep custom menu paths untouched. */
export function normalizeTicketMenus(
  menus: RouteRecordStringComponent[],
): RouteRecordStringComponent[] {
  return menus.map((menu) => {
    const next = { ...menu };
    if (menu.children) next.children = normalizeTicketMenus(menu.children);
    const component = String(menu.component ?? '').replace(/^\//, '');
    if (
      ['ticket/index', 'ticket/user', 'ticket/user-list'].includes(component) &&
      ['/tickets', '/console/tickets'].includes(menu.path)
    ) {
      next.component = '/ticket/user-list';
      next.name = 'UserTicketCenter';
      next.path = '/console/tickets';
      next.meta = {
        ...menu.meta,
        title: menu.meta?.title ?? 'ticket.title',
        fullPathKey: false,
        keepAlive: false,
      };
    } else if (
      ['ticket/admin', 'ticket/admin-list'].includes(component) &&
      menu.path === '/admin/tickets'
    ) {
      next.component = '/ticket/admin-list';
      next.name = 'AdminTicketManagement';
      next.meta = {
        ...menu.meta,
        title: menu.meta?.title ?? 'ticket.adminTitle',
        fullPathKey: false,
        keepAlive: false,
      };
    }
    return next;
  });
}
