import type { RouteRecordStringComponent } from '@vben/types';

/** Release notes inherit the authorized About entry; never add a public route. */
export function withReleaseNotesMenu(
  menus: RouteRecordStringComponent[],
): RouteRecordStringComponent[] {
  return menus.flatMap((menu) => {
    const next = { ...menu };
    if (menu.children) next.children = withReleaseNotesMenu(menu.children);
    if (
      !['/system/about', '/console/system/about'].includes(menu.path) ||
      String(menu.component ?? '').replace(/^\//, '') !== 'system/about/index'
    )
      return [next];
    const path = menu.path.replace(/\/about$/, '/updates');
    if (
      menus.some(
        (item) => item.path === path || item.name === 'SystemReleaseNotes',
      )
    )
      return [next];
    return [
      next,
      {
        ...menu,
        name: 'SystemReleaseNotes',
        path,
        component: '/system/updates/index',
        redirect: undefined,
        children: undefined,
        meta: {
          ...menu.meta,
          title: 'system.updates.title',
          hideInMenu: true,
          activePath: menu.path,
          keepAlive: false,
        },
      },
    ];
  });
}
