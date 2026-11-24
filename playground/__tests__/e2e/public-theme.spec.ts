import type { Locator, Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

const publicDarkPages = [
  {
    contentSelector: '.search-box',
    englishHeading: 'All APIs',
    hasFooter: true,
    pageSelector: '.market-page',
    route: '/apilist',
    surfaceSelectors: ['.api-card'],
  },
  {
    // 友链卡在 FriendLinkDirectory 组件里，类名是 friend-link-entry；
    // 旧类 .link-card 只剩 index.vue 里的死 CSS，DOM 中已不存在。
    contentSelector: '.friend-link-entry',
    englishHeading: 'Friend Links',
    hasFooter: true,
    pageSelector: '.links-page',
    route: '/links',
    surfaceSelectors: ['.count-badge'],
  },
  {
    contentSelector: '.donate-card',
    englishHeading: 'Scan to Donate',
    hasFooter: true,
    pageSelector: '.donate-page',
    route: '/donate',
    surfaceSelectors: ['.donate-method'],
  },
  {
    contentSelector: '.docs-section-nav',
    englishHeading: 'Demo API',
    hasFooter: true,
    pageSelector: '.docs-page',
    route: '/docs/1',
    surfaceSelectors: ['.docs-auth', '.docs-params', '.docs-response'],
  },
];

const preferenceNamespace = 'bugpk-api-v0.0.0-dev-dev';

function parseRgb(backgroundColor: string) {
  const match = backgroundColor.match(
    /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/,
  );
  if (!match) {
    return null;
  }
  return {
    alpha: match[4] === undefined ? 1 : Number(match[4]),
    blue: Number(match[3]),
    green: Number(match[2]),
    red: Number(match[1]),
  };
}

function luminance({ blue, green, red }: { blue: number; green: number; red: number }) {
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

async function expectPublicHeaderVisible(page: Page) {
  await expect(page.locator('.site-public-header')).toBeVisible({
    timeout: 15_000,
  });
}

async function mockPublicApiDocs(page: Page) {
  await page.route('**/system-api/site/config', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: {
        code: 0,
        data: {
          copyright: 'Copyright 2026 BugPk-Api',
          description: 'Unified API platform',
          icp: 'BugPk-Api',
          logoUrl: '/favicon.ico',
          siteName: 'Custom Configured Site',
          slogan: 'Stable API service platform',
        },
        error: null,
        message: 'ok',
      },
      status: 200,
    });
  });

  await page.route(/\/system-api\/market\/apis(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: {
        code: 0,
        data: {
          items: [
            {
              apiCode: 'demo_api',
              avatarUrl: '',
              callCount: 128,
              description: 'Demo API for public theme verification.',
              id: '1',
              isFeatured: 1,
              isTop: 1,
              name: 'Demo API',
              pointPrice: 0,
              price: 0,
              priceLabel: 'Free',
              requestMethod: 'GET',
            },
          ],
          total: 1,
        },
        error: null,
        message: 'ok',
      },
      status: 200,
    });
  });

  await page.route('**/system-api/friend-links/public/list', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: {
        code: 0,
        data: {
          items: [
            {
              description: 'BugPk-Api partner site',
              id: '1',
              logoUrl: '',
              siteName: 'BugPk Partner',
              siteUrl: 'https://example.com',
              status: 1,
            },
          ],
          total: 1,
        },
        error: null,
        message: 'ok',
      },
      status: 200,
    });
  });

  await page.route('**/system-api/friend-links/public/meta', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: {
        code: 0,
        data: {
          config: {
            applyEnabled: 1,
            applyNotice: 'Please add our link first.',
          },
          siteInfo: {
            description: 'Unified API platform',
            logoUrl: '/favicon.ico',
            siteName: 'BugPk-Api',
            siteUrl: 'https://bugpk-api.example.com',
          },
        },
        error: null,
        message: 'ok',
      },
      status: 200,
    });
  });

  await page.route('**/system-api/market/apis/1', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: {
        code: 0,
        data: {
          apiCode: 'demo_api',
          auth: {
            description: '',
            location: 'Query',
            name: 'key',
            type: 'API Key',
          },
          avatarUrl: '',
          callCount: 128,
          callTrend7d: [
            { date: '2026-06-27', label: '06-27', value: 8 },
            { date: '2026-06-28', label: '06-28', value: 12 },
            { date: '2026-06-29', label: '06-29', value: 16 },
            { date: '2026-06-30', label: '06-30', value: 18 },
            { date: '2026-07-01', label: '07-01', value: 22 },
            { date: '2026-07-02', label: '07-02', value: 24 },
            { date: '2026-07-03', label: '07-03', value: 28 },
          ],
          description: 'Demo API for public docs theme verification.',
          gatewayPath: '/api/demo_api',
          gatewayUrlTemplate: '/api/demo_api?key={user-created-key}&q={q}',
          id: '1',
          isFeatured: 1,
          isTop: 1,
          name: 'Demo API',
          parameters: [
            {
              description: 'Search keyword',
              exampleValue: 'bugpk',
              location: 'Query',
              name: 'q',
              placeholder: 'keyword',
              required: true,
              type: 'string',
            },
          ],
          pointPrice: 0,
          preferredMethod: 'GET',
          price: 0,
          priceLabel: 'Free',
          pricing: {
            description: 'Free test API.',
            label: 'Free',
            pointPrice: 0,
            price: 0,
          },
          requestMethod: 'GET',
          responseExample: '{"code":0,"message":"ok"}',
          responseFields: [
            { description: 'Status code', name: 'code', type: 'number' },
          ],
          responseType: 'JSON',
          statusCodes: [{ code: 200, description: 'OK' }],
          templateParameters: ['q'],
        },
        error: null,
        message: 'ok',
      },
      status: 200,
    });
  });

  await page.route('**/system-api/market/apis/1/test-key', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: {
        code: 0,
        data: {
          hasKey: false,
          keyScope: '',
          message: 'Create a key first',
          secretKey: '',
        },
        error: null,
        message: 'ok',
      },
      status: 200,
    });
  });

  await page.route('**/system-api/donation/config', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: {
        code: 0,
        data: {
          description: 'Support the project with a scan.',
          enabled: 1,
          eyebrow: 'SUPPORT',
          methods: [
            {
              color: '#1677ff',
              enabled: 1,
              icon: 'lucide:smartphone',
              key: 'alipay',
              name: 'Alipay',
              qrCodeUrl: '/favicon.ico',
              sortNo: 1,
              tip: 'Scan with Alipay',
            },
          ],
          scanDescription: 'Scan the QR code to support this project.',
          thanks: 'Thank you for your support!',
        },
        error: null,
        message: 'ok',
      },
      status: 200,
    });
  });

  await page.route('**/system-api/donation/supporters**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: {
        code: 0,
        data: {
          items: [],
          total: 0,
        },
        error: null,
        message: 'ok',
      },
      status: 200,
    });
  });
}

async function expectDarkSurface(
  locator: Locator,
  label: string,
  maxLuminance = 180,
) {
  const backgroundColor = await locator.evaluate(
    (element) => window.getComputedStyle(element).backgroundColor,
  );
  const rgb = parseRgb(backgroundColor);

  expect(rgb, `${label} background should be rgb/rgba`).not.toBeNull();
  expect(rgb!.alpha).toBeGreaterThan(0.05);
  expect(luminance(rgb!), label).toBeLessThan(maxLuminance);
}

test.describe('Public Dark Theme', () => {
  test.beforeEach(async ({ page }) => {
    await mockPublicApiDocs(page);
    await page.addInitScript((namespace) => {
      // main.ts runs a one-time "default theme to light" migration. Seed its
      // marker so it is skipped, otherwise it overwrites the dark preference
      // below and the public pages race back to the light tone.
      localStorage.setItem(`${namespace}-light-theme-migrated-v1`, 'true');
      localStorage.setItem(
        `${namespace}-preferences`,
        JSON.stringify({ value: { theme: { mode: 'dark' } } }),
      );
      localStorage.setItem(
        `${namespace}-preferences-theme`,
        JSON.stringify({ value: 'dark' }),
      );
      document.documentElement.classList.add('dark');
    }, preferenceNamespace);
  });

  for (const item of publicDarkPages) {
    test(`${item.route} uses dark surfaces`, async ({ page }) => {
      await page.goto(item.route, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
      });

      const pageShell = page.locator(item.pageSelector);
      const contentShell = page.locator(item.contentSelector).first();
      const header = page.locator('.site-public-header');
      const openSourceLink = page
        .locator('.site-nav a[href*="github.com/search"]')
        .first();

      await expect(pageShell).toBeVisible();
      await expect(contentShell).toBeVisible();
      await expect(header).toBeVisible();
      await expect(openSourceLink).toBeVisible();
      await expect(openSourceLink).toHaveAttribute(
        'href',
        /github\.com\/search\?q=BugPk-Api&type=repositories/,
      );

      await page.waitForFunction((selector) => {
        const element = document.querySelector(selector);
        if (!element) {
          return false;
        }
        return window
          .getComputedStyle(element)
          .getPropertyValue('--home-background')
          .trim()
          .toLowerCase()
          .includes('#070b16');
      }, item.pageSelector);

      await expectDarkSurface(
        contentShell,
        `${item.route} should not render a light content surface in dark mode`,
      );

      await expectDarkSurface(
        header,
        `${item.route} header should use a dark surface`,
        120,
      );

      for (const selector of item.surfaceSelectors) {
        const surface = page.locator(selector).first();
        await expect(surface).toBeVisible();
        await expectDarkSurface(
          surface,
          `${item.route} ${selector} should use a dark surface`,
        );
      }

      if (item.hasFooter) {
        const footer = page.locator('.site-footer');
        const footerLink = footer.getByRole('link').first();
        const footerDonateLink = footer
          .getByRole('link', {
            name: /donate|赞赏支持/i,
          })
          .first();
        const footerOpenSourceLink = footer
          .getByRole('link', { name: /open source|开源仓库/i })
          .first();
        await expect(footer).toBeVisible();
        await expect(footerLink).toBeVisible();
        await expect(footerDonateLink).toBeVisible();
        await expect(footerOpenSourceLink).toBeVisible();
        await expect(footerOpenSourceLink).toHaveAttribute(
          'href',
          /github\.com\/search\?q=BugPk-Api&type=repositories/,
        );

        const footerLinkColor = await footerLink.evaluate(
          (element) => window.getComputedStyle(element).color,
        );
        const footerLinkRgb = parseRgb(footerLinkColor);
        expect(footerLinkRgb, `${item.route} footer link should be rgb/rgba`).not.toBeNull();
        expect(
          luminance(footerLinkRgb!),
          `${item.route} footer link should stay readable in dark mode`,
        ).toBeGreaterThan(120);

        const footerOpenSourceColor = await footerOpenSourceLink.evaluate(
          (element) => window.getComputedStyle(element).color,
        );
        const footerOpenSourceRgb = parseRgb(footerOpenSourceColor);
        expect(
          footerOpenSourceRgb,
          `${item.route} footer open source link should be rgb/rgba`,
        ).not.toBeNull();
        expect(
          luminance(footerOpenSourceRgb!),
          `${item.route} footer open source link should stay readable in dark mode`,
        ).toBeGreaterThan(120);
      }

      const openSourceColor = await openSourceLink.evaluate(
        (element) => window.getComputedStyle(element).color,
      );
      const openSourceRgb = parseRgb(openSourceColor);
      expect(openSourceRgb, `${item.route} open source link should be rgb/rgba`).not.toBeNull();
      expect(
        luminance(openSourceRgb!),
        `${item.route} open source link should stay readable in dark mode`,
      ).toBeGreaterThan(120);
    });
  }

  test('mobile public menu uses dark surfaces and keeps open source readable', async ({
    page,
  }) => {
    await page.setViewportSize({ height: 760, width: 390 });
    await page.goto('/apilist', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
    });

    await page
      .getByRole('button', { name: /open site navigation|打开站点导航/i })
      .click();

    const mobilePanel = page.locator('.mobile-menu-panel.open');
    const openSourceLink = mobilePanel
      .getByRole('link', { name: /open source|开源地址/i })
      .first();

    await expect(mobilePanel).toBeVisible();
    await expect(openSourceLink).toBeVisible();
    await expect(openSourceLink).toHaveAttribute(
      'href',
      /github\.com\/search\?q=BugPk-Api&type=repositories/,
    );
    await expectDarkSurface(
      mobilePanel,
      'mobile public menu should use a dark surface',
      150,
    );

    const openSourceColor = await openSourceLink.evaluate(
      (element) => window.getComputedStyle(element).color,
    );
    const openSourceRgb = parseRgb(openSourceColor);
    expect(openSourceRgb).not.toBeNull();
    expect(luminance(openSourceRgb!)).toBeGreaterThan(120);
  });
});

test.describe('Public Navigation I18n', () => {
  test.beforeEach(async ({ page }) => {
    await mockPublicApiDocs(page);
    await page.addInitScript((namespace) => {
      localStorage.setItem(
        `${namespace}-preferences`,
        JSON.stringify({
          value: {
            app: {
              locale: 'en-US',
            },
            theme: {
              mode: 'dark',
            },
          },
        }),
      );
      localStorage.setItem(
        `${namespace}-preferences-theme`,
        JSON.stringify({ value: 'dark' }),
      );
      document.documentElement.classList.add('dark');
    }, preferenceNamespace);
  });

  for (const item of publicDarkPages) {
    test(`${item.route} renders public navigation in English`, async ({
      page,
    }) => {
      await page.goto(item.route, { waitUntil: 'domcontentloaded' });

      await expectPublicHeaderVisible(page);
      await expect(
        page.locator('.site-nav').getByRole('link', { name: 'API Market' }),
      ).toBeVisible();
      await expect(
        page.locator('.site-nav').getByRole('link', { name: 'Friend Links' }),
      ).toBeVisible();
      await expect(
        page.locator('.site-nav').getByRole('link', { name: 'Donate' }),
      ).toBeVisible();
      await expect(
        page.locator('.site-nav').getByRole('link', { name: 'Open Source' }),
      ).toBeVisible();
      if (item.hasFooter) {
        await expect(
          page
            .locator('.site-footer')
            .getByRole('link', { name: 'API Market' })
            .first(),
        ).toBeVisible();
        await expect(
          page
            .locator('.site-footer')
            .getByRole('link', { name: 'Friend Links' })
            .first(),
        ).toBeVisible();
        await expect(
          page
            .locator('.site-footer')
            .getByRole('link', { name: 'Donate' })
            .first(),
        ).toBeVisible();
        await expect(
          page
            .locator('.site-footer')
            .getByRole('link', { name: 'Open source' })
            .first(),
        ).toBeVisible();
      }
      await expect(
        page.getByRole('heading', { name: item.englishHeading }).first(),
      ).toBeVisible();
    });
  }

  test.describe('Chinese locale', () => {
    test.beforeEach(async ({ page }) => {
      await mockPublicApiDocs(page);
      await page.addInitScript((namespace) => {
        localStorage.setItem(
          `${namespace}-preferences`,
          JSON.stringify({
            value: {
              app: {
                locale: 'zh-CN',
              },
              theme: {
                mode: 'dark',
              },
            },
          }),
        );
        localStorage.setItem(
          `${namespace}-preferences-theme`,
          JSON.stringify({ value: 'dark' }),
        );
        document.documentElement.classList.add('dark');
      }, preferenceNamespace);
    });

    const chineseHeadings: Record<string, string> = {
      '/apilist': '全部接口',
      '/docs/1': 'Demo API',
      '/donate': '扫码赞赏',
      '/links': '友情链接',
    };

    for (const item of publicDarkPages) {
      test(`${item.route} renders public navigation in Chinese`, async ({
        page,
      }) => {
        await page.goto(item.route, { waitUntil: 'domcontentloaded' });

        await expectPublicHeaderVisible(page);
        await expect(
          page.locator('.site-nav').getByRole('link', { name: '接口市场' }),
        ).toBeVisible();
        await expect(
          page.locator('.site-nav').getByRole('link', { name: '友情链接' }),
        ).toBeVisible();
        await expect(
          page.locator('.site-nav').getByRole('link', { name: '赞赏支持' }),
        ).toBeVisible();
        await expect(
          page.locator('.site-nav').getByRole('link', { name: '开源地址' }),
        ).toBeVisible();
        await expect(
          page
            .locator('.site-nav')
            .getByRole('link', { name: '开源地址' })
            .first(),
        ).toHaveAttribute(
          'href',
          /github\.com\/search\?q=BugPk-Api&type=repositories/,
        );
        if (item.hasFooter) {
          await expect(
            page
              .locator('.site-footer')
              .getByRole('link', { name: '赞赏支持' })
              .first(),
          ).toBeVisible();
          await expect(
            page
              .locator('.site-footer')
              .getByRole('link', { name: '开源仓库' })
              .first(),
          ).toBeVisible();
        }
        await expect(
          page
            .getByRole('heading', { name: chineseHeadings[item.route] })
            .first(),
        ).toBeVisible();
      });
    }
  });
});
