import { describe, expect, it } from 'vitest';

import { resolveLocalIcon } from '../iconify-icon';

describe('IconifyIcon local functional icons', () => {
  it('resolves the native timezone icon instead of the pixel fallback', () => {
    expect(resolveLocalIcon('fluent-mdl2:world-clock')).toBeDefined();
  });

  it('resolves framework and social icons used by shell pages', () => {
    const shellIcons = [
      'lucide:area-chart',
      'ic:baseline-view-in-ar',
      'mdi:github',
      'carbon:logo-github',
      'ion:logo-vue',
      'ion:logo-html5',
      'ion:logo-angular',
      'bx:bxl-react',
      'ion:logo-javascript',
      'ion:home-outline',
      'ion:grid-outline',
      'ion:layers-outline',
      'ion:settings-outline',
      'ion:key-outline',
      'ion:bar-chart-outline',
      'logos:naiveui',
      'logos:element',
    ];

    for (const icon of shellIcons) {
      expect(resolveLocalIcon(icon), icon).toBeDefined();
    }
  });
});
