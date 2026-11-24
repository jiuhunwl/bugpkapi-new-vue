import { describe, expect, it } from 'vitest';
import { withReleaseNotesMenu } from './release-menu';
describe('release notes menu access', () => {
  it('adds a hidden sibling only to an authorized official About entry', () => {
    const input = [
      {
        name: 'SystemAbout',
        path: '/system/about',
        component: '/system/about/index',
        meta: { title: 'About', authority: ['admin'] },
      },
    ];
    const result = withReleaseNotesMenu(input);
    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({
      name: 'SystemReleaseNotes',
      path: '/system/updates',
      component: '/system/updates/index',
      meta: { hideInMenu: true, authority: ['admin'] },
    });
    expect(input).toHaveLength(1);
    expect(withReleaseNotesMenu(result)).toHaveLength(2);
  });
  it('supports nested and console-prefixed menus without opening a public route', () => {
    const result = withReleaseNotesMenu([
      {
        name: 'System',
        path: '/system',
        component: 'BasicLayout',
        children: [
          {
            name: 'SystemAbout',
            path: '/console/system/about',
            component: '/system/about/index',
          },
        ],
      },
    ]);
    expect(result[0]?.children?.[1]?.path).toBe('/console/system/updates');
    expect(
      withReleaseNotesMenu([
        {
          name: 'CustomAbout',
          path: '/custom',
          component: '/system/about/index',
        },
      ]),
    ).toHaveLength(1);
    expect(withReleaseNotesMenu([])).toEqual([]);
  });
});
