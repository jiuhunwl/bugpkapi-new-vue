import { createApp, h, nextTick } from 'vue';

import {
  addIcon,
  hasOfflineIcon,
  IconifyIcon,
  listLocalIcons,
  resolveLocalIcon,
} from '@vben/icons';

import { afterEach, describe, expect, it, vi } from 'vitest';

import vbenLayoutSource from '../../packages/@core/ui-kit/layout-ui/src/vben-layout.vue?raw';
import vbenVxeGridSource from '../../packages/effects/plugins/src/vxe-table/use-vxe-grid.vue?raw';

const productionSources = import.meta.glob('./**/*.{ts,vue}', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>;

const nativeRefreshButtonCases = [
  {
    click: 'loadConfig',
    expectedButtons: 1,
    path: './views/system/custom-code/index.vue',
  },
  {
    click: 'loadConfig',
    expectedButtons: 1,
    path: './views/system/ip-config/index.vue',
  },
  {
    click: 'refreshNow',
    expectedButtons: 2,
    path: './views/risk-control/dashboard.vue',
  },
  {
    click: "emit('refresh')",
    expectedButtons: 3,
    path: './views/ticket/components/TicketDetail.vue',
  },
  {
    click: "emit('refresh')",
    expectedButtons: 2,
    path: './views/ticket/components/TicketListPanel.vue',
  },
] as const;

function collectStaticIconNames() {
  const iconNames = new Set<string>();
  // 匹配静态绑定与三元表达式两侧的图标名（如 :icon="dark ? 'lucide:sun' : 'lucide:moon'"），
  // 防止只在运行时才拼出来的图标逃过离线渲染检查。
  const patterns = [
    /\bicon\s*=\s*["']([a-z\d-]+:[a-z\d-]+)["']/gi,
    /\bicon\s*:\s*["'`]([a-z\d-]+:[a-z\d-]+)["'`]/gi,
    /\?\s*["']([a-z\d-]+:[a-z\d-]+)["']\s*:\s*["']([a-z\d-]+:[a-z\d-]+)["']/gi,
  ];

  for (const [path, source] of Object.entries(productionSources)) {
    if (/\.(?:spec|test)\.[^.]+$/i.test(path)) continue;
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) {
        if (match[1]) iconNames.add(match[1]);
        if (match[2]) iconNames.add(match[2]);
      }
    }
  }

  return [...iconNames].toSorted();
}

const mountedHosts: HTMLDivElement[] = [];

async function renderIcon(icon: string) {
  const host = document.createElement('div');
  document.body.append(host);
  mountedHosts.push(host);
  createApp({
    setup: () => () => h(IconifyIcon, { icon }),
  }).mount(host);
  await nextTick();
  return host;
}

afterEach(() => {
  vi.unstubAllGlobals();
  for (const host of mountedHosts.splice(0)) host.remove();
});

describe('offline icon resolver', () => {
  it('bundles shipped legacy icon prefixes locally', () => {
    for (const icon of [
      'ant-design:upload-outlined',
      'carbon:circle-dash',
      'carbon:security',
      'carbon:workspace',
      'ion:settings-outline',
      'mdi:account',
      'mdi:account-cog',
      'mdi:account-group',
      'mdi:account-plus-outline',
      'mdi:api',
      'mdi:bullhorn-outline',
      'mdi:bullhorn-variant-outline',
      'mdi:cash-plus',
      'mdi:cellphone-cog',
      'mdi:clipboard-text-clock',
      'mdi:clipboard-text-outline',
      'mdi:credit-card-settings-outline',
      'mdi:database-plus',
      'mdi:delete-clock-outline',
      'mdi:email-cog-outline',
      'mdi:key-chain',
      'mdi:link-box-variant-outline',
      'mdi:link-plus',
      'mdi:login-variant',
      'mdi:menu',
      'mdi:package-variant',
      'mdi:receipt-clock-outline',
      'mdi:receipt-text-clock-outline',
      'mdi:shopping-outline',
      'mdi:view-dashboard-outline',
      'mdi:web',
      'mdi:web-sync',
    ]) {
      expect(resolveLocalIcon(icon)).toBeDefined();
    }
  });

  it('leaves unknown collections unresolved', () => {
    expect(resolveLocalIcon('custom:future-icon')).toBeUndefined();
  });

  it('bundles the native Vben shell fold controls without using the fallback', () => {
    expect(hasOfflineIcon('ep:fold')).toBe(true);
    expect(hasOfflineIcon('ep:expand')).toBe(true);
    expect(vbenLayoutSource).toContain('icon="ep:fold"');
    expect(vbenLayoutSource).toContain('icon="ep:expand"');
  });

  it('registers the shipped brand icons before they are rendered', () => {
    for (const icon of [
      'simple-icons:alipay',
      'simple-icons:paypal',
      'simple-icons:tencentqq',
      'simple-icons:wechat',
    ]) {
      expect(hasOfflineIcon(icon)).toBe(true);
    }
  });

  it('renders shipped brand icons locally without issuing an icon API request', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const host = await renderIcon('simple-icons:wechat');

    expect(host.querySelector('svg')).not.toBeNull();
    expect(host.querySelector('[data-missing-icon]')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('renders nothing when an icon misses every local registry', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const host = await renderIcon('custom:missing-icon');

    expect(host.querySelector('svg')).toBeNull();
    expect(host.querySelector('[data-missing-icon]')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('renders theme-toggle and copyright icons from the local lucide registry', () => {
    for (const icon of [
      'lucide:moon',
      'lucide:sun',
      'lucide:copyright',
    ]) {
      expect(resolveLocalIcon(icon)).toBeDefined();
    }
  });

  it('renders a custom registered Iconify name before considering the fallback', async () => {
    addIcon('custom:future-icon', {
      body: '<path d="M2 2h20v20H2z"/>',
      height: 24,
      width: 24,
    });

    const host = await renderIcon('custom:future-icon');

    expect(host.querySelector('svg')).not.toBeNull();
    expect(host.querySelector('[data-missing-icon]')).toBeNull();
  });

  it('keeps legacy names that are still stored in menu configuration', () => {
    expect(resolveLocalIcon('lucide:alert-triangle')).toBeDefined();
    expect(resolveLocalIcon('mdi:home-outline')).toBeDefined();
  });

  it('exposes only locally renderable choices to offline icon pickers', () => {
    expect(listLocalIcons('lucide')).toContain('lucide:refresh-cw');
    expect(listLocalIcons('carbon')).toContain('carbon:workspace');
    expect(listLocalIcons('custom')).toEqual([]);
  });

  it('bundles the local eye toggle icon used by API Key visibility controls', () => {
    expect(resolveLocalIcon('lucide:eye-off')).toBeDefined();
  });

  it('bundles shipped captcha-adjacent admin and donation icons', () => {
    expect(resolveLocalIcon('lucide:coffee')).toBeDefined();
    expect(resolveLocalIcon('lucide:fingerprint')).toBeDefined();
    expect(resolveLocalIcon('lucide:timer-reset')).toBeDefined();
    expect(resolveLocalIcon('lucide:user-round-search')).toBeDefined();
  });

  it('keeps every statically referenced production icon renderable offline', () => {
    const iconNames = collectStaticIconNames();
    const unresolved = iconNames.filter(
      (icon) => !resolveLocalIcon(icon) && !hasOfflineIcon(icon),
    );

    expect(iconNames.length).toBeGreaterThan(100);
    expect(unresolved).toEqual([]);
  });

  it.each(nativeRefreshButtonCases)(
    '$path renders RotateCw for every refresh action',
    ({ click, expectedButtons, path }) => {
      const source = productionSources[path];
      expect(
        source,
        `${path} must be included in the production source scan`,
      ).toBeTypeOf('string');

      const refreshButtons = [
        ...(source ?? '').matchAll(/<Button\b[^>]*>[\s\S]*?<\/Button>/g),
      ]
        .map((match) => match[0])
        .filter((button) => button.includes(`@click="${click}"`));

      expect(refreshButtons).toHaveLength(expectedButtons);
      expect(
        refreshButtons.filter((button) => !/<RotateCw\b/.test(button)),
      ).toEqual([]);
    },
  );

  it('uses the Vben-exported Vue refresh component instead of Iconify SVG strings', () => {
    const vueSources = Object.entries(productionSources).filter(([path]) =>
      path.endsWith('.vue'),
    );
    const iconifyRefreshUsages = vueSources
      .filter(([, source]) =>
        /<IconifyIcon\b[^>]*\bicon\s*=\s*["'](?:lucide:refresh-cw|mdi:web-sync)["'][^>]*>/i.test(
          source,
        ),
      )
      .map(([path]) => path);
    const nativeRefreshCount = vueSources.reduce(
      (total, [, source]) =>
        total + [...source.matchAll(/<RotateCw\b/g)].length,
      0,
    );

    expect(iconifyRefreshUsages).toEqual([]);
    expect(nativeRefreshCount).toBeGreaterThan(10);
  });

  it('replaces the VXE built-in refresh glyph with the shared Vue component', () => {
    expect(vbenVxeGridSource).toMatch(
      /import\s*{[^}]*\bRotateCw\b[^}]*}\s*from '@vben\/icons'/,
    );
    expect(vbenVxeGridSource).toContain('<RotateCw');
    expect(vbenVxeGridSource).toContain('@click="onToolbarRefresh"');
  });

  it('never hardcodes the retired BP letterform in any production source', () => {
    // 用户要求彻底删除 BP 渐变字母块：每个控件必须用自己的图标。
    // 允许的例外只有「清缓存迁移」里指向旧资源的路径字符串。
    const offenders = Object.entries(productionSources)
      .filter(([path]) => path.endsWith('.vue') || path.endsWith('.ts'))
      .filter(([path]) => !/\.(?:spec|test)\.ts$/.test(path))
      .filter(([, source]) =>
        /(?:>|["'])\s*BP\s*(?:<|["'])|class="[^"]*brand-mark[^"]*"\s*>BP</.test(
          source,
        ),
      )
      .filter(([, source]) => !/legacyMarker|bp-mark\.svg|migrated-v1/.test(source))
      .map(([path]) => path);

    expect(offenders).toEqual([]);
  });

  it('resolves the semantic loading and logo icons registered for the brand rollout', () => {
    for (const icon of [
      'lucide:hammer',
      'lucide:scan-line',
      'lucide:server',
      'lucide:waypoints',
      'lucide:bug',
      'lucide:sliders-horizontal',
    ]) {
      expect(resolveLocalIcon(icon), `${icon} 未注册`).toBeDefined();
    }
  });
});
