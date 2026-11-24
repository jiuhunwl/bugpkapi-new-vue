import type { Page } from '@playwright/test';

import type { HomeApi } from '../../src/api/home';

import { expect, test } from '@playwright/test';

const overview: HomeApi.Overview = {
  callTrend7d: [
    { date: '2026-08-25', label: '周二', value: 120 },
    { date: '2026-08-26', label: '周三', value: 240 },
  ],
  earthPoints: [],
  homeNotice: { content: '系统公告', enabled: 1, id: 1 },
  hotApis: [
    {
      avatarUrl: '/__e2e__/api-icon.svg',
      callCount: 12,
      description: '真实热门接口',
      id: 7,
      isFeatured: 1,
      name: '真实 API',
      requestMethod: 'GET',
    },
  ],
  regionRanking: [
    { code: 'cn', name: '华东', percent: 64, rank: 1, value: 640 },
  ],
  riskSummary: { eventCount: 3, riskScore: 8, riskyRequests: 5 },
  siteConfig: {
    description: '真实平台描述',
    siteName: 'BugPk API',
    slogan: '真实平台口号',
  },
  stats: {
    activeRegions24h: 1,
    activeRegions24hDelta: 0,
    apiTotal: 17,
    availabilityPercent: 99.12,
    availabilitySource: 'API_STATUS',
    calls24h: 4321,
    calls24hDeltaPercent: 0,
    enabledApiTotal: 17,
    peakQps24h: 29,
    peakQps24hDelta: 0,
    userTotal: 0,
  },
};

async function mockOverview(page: Page, data: HomeApi.Overview = overview) {
  await page.route('**/__e2e__/api-icon.svg', (route) => route.fulfill({
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44"><rect width="44" height="44" fill="#2563eb"/></svg>',
  }));
  await page.route('**/system-api/home/overview', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ code: 0, data }),
      status: 200,
    });
  });
}

test.beforeEach(async ({ page }) => {
  await page.route('**/system-api/**', async (route) => {
    const data = new URL(route.request().url()).pathname === '/system-api/site/config'
      ? overview.siteConfig
      : [];
    await route.fulfill({ json: { code: 0, data } });
  });
});

test.describe('Public homepage v3 redesign', () => {
  test('renders four count-up stats from real overview data', async ({
    page,
  }) => {
    await mockOverview(page);
    await page.goto('/');

    const stats = page.getByTestId('home-metrics');
    await expect(stats).toBeVisible({ timeout: 15_000 });
    await expect(stats.locator('.stat')).toHaveCount(4);
    await expect(stats).toContainText('17');
    await expect(stats).toContainText('4,321');
    await expect(stats).toContainText('29');
    await expect(stats).toContainText('99.12%');
    await expect(stats).toContainText(/API_STATUS|接口状态/i);
  });

  test('flow monitor renders the four-stage request pipeline without fake timing', async ({
    page,
  }) => {
    await mockOverview(page);
    await page.goto('/');

    const flowCard = page.getByTestId('home-flow-card');
    await expect(flowCard).toBeVisible();
    await expect(flowCard.locator('.flow-line')).toHaveCount(4);
    await expect(flowCard.locator('.flow-result')).toContainText('4,321');
    await expect(flowCard).not.toContainText(/\d+ms/);
    await expect(flowCard).not.toContainText('99.9%');
  });

  test('removes the calling signals section while keeping the homepage sections', async ({ page }) => {
    await mockOverview(page);
    await page.goto('/');

    await expect(page.getByTestId('home-featured')).toBeVisible();
    await expect(page.getByTestId('home-insights')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '调用信号', exact: true })).toHaveCount(0);
    await expect(page.getByTestId('home-lifecycle')).toBeVisible();
    await expect(page.getByTestId('home-faq')).toBeVisible();
  });

  test('scrolling announcement marquee renders and closes', async ({
    page,
  }) => {
    await mockOverview(page);
    await page.goto('/');

    const marquee = page.locator('.marquee-track');
    await expect(marquee).toBeVisible();
    await expect(marquee.locator('span')).toHaveCount(2);
    await page.locator('.notice-close').click();
    await expect(page.locator('.notice')).toHaveCount(0);
  });

  test('shows dashes and retry on overview failure', async ({ page }) => {
    await page.route('**/system-api/home/overview', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ code: 1, message: 'unavailable' }),
        status: 503,
      });
    });
    await page.goto('/');

    await expect(page.getByTestId('home-metrics')).toContainText('—');
    await expect(page.getByRole('alert')).toContainText(/失败|unavailable/i);
    await expect(page.getByRole('button', { name: /重试|retry/i })).toBeVisible();
    await expect(page.getByTestId('home-metrics')).not.toContainText('0');
    await expect(page.getByTestId('home-insights')).toHaveCount(0);
  });

  test('submitting search uses router query state', async ({ page }) => {
    await mockOverview(page);
    await page.goto('/');
    await page.getByTestId('home-search-input').fill('抖音 聚合');
    await page.getByTestId('home-search').getByRole('button').click();
    await expect(page).toHaveURL(/\/apilist\?keyword=%E6%8A%96%E9%9F%B3(?:%20|\+)%E8%81%9A%E5%90%88$/);
  });

  test('featured grid renders only mocked real APIs', async ({
    page,
  }) => {
    await mockOverview(page);
    await page.goto('/');

    const featured = page.getByTestId('home-featured');
    await expect(featured).toContainText('真实 API');
    await expect(featured).not.toContainText('抖音无水印解析');
    await expect(featured.locator('.api-card')).toHaveCount(1);
    await expect(featured).not.toContainText('广告位招租');
  });

  test('featured cards display the configured API icon instead of a name-based badge', async ({ page }) => {
    await mockOverview(page);
    await page.goto('/');

    const card = page.getByTestId('home-api-card-7');
    await card.scrollIntoViewIfNeeded();
    const icon = card.getByRole('img', { name: '真实 API', exact: true });
    await expect(icon).toHaveAttribute('src', '/__e2e__/api-icon.svg');
    await expect(icon).toHaveAttribute('referrerpolicy', 'no-referrer');
    await expect.poll(() => icon.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    await expect(card).toHaveAttribute('href', '/docs/7');
    await expect(card.locator('.plat')).not.toContainText('全');
  });

  test('featured cards without configured icons show a neutral fallback', async ({ page }) => {
    await mockOverview(page, {
      ...overview,
      hotApis: ['', null, undefined, '   '].map((avatarUrl, index) => ({
        ...overview.hotApis[0]!, avatarUrl, id: index + 1, name: '抖音 API',
      })),
    });
    await page.goto('/');

    const featured = page.getByTestId('home-featured');
    await expect(featured.locator('.api-card')).toHaveCount(4);
    await expect(featured.locator('.plat img')).toHaveCount(0);
    await expect(featured.locator('.plat svg')).toHaveCount(4);
    await expect(featured.locator('.plat').first()).not.toContainText('抖');
  });

  test('failed API icons use a neutral fallback without breaking the card link', async ({ page }) => {
    await page.route('**/__e2e__/missing-icon.png', (route) => route.fulfill({ status: 404, body: '' }));
    await mockOverview(page, {
      ...overview,
      hotApis: [{ ...overview.hotApis[0]!, avatarUrl: '/__e2e__/missing-icon.png' }],
    });
    await page.goto('/');

    const card = page.getByTestId('home-api-card-7');
    await card.scrollIntoViewIfNeeded();
    await expect(card.locator('.plat svg')).toBeVisible();
    await expect(card.locator('.plat img')).toHaveCount(0);
    await expect(card).toContainText('真实 API');
    await expect(card).toHaveAttribute('href', '/docs/7');
  });

  test('faq renders six items with working category tabs', async ({ page }) => {
    await mockOverview(page);
    await page.goto('/');

    const faq = page.getByTestId('home-faq');
    await expect(faq.locator('.faq-item')).toHaveCount(6);
    await expect(faq.locator('.faq-contact')).toBeVisible();

    const tabs = faq.locator('.faq-tabs button');
    await expect(tabs).toHaveCount(4);
    await tabs.filter({ hasText: '调用相关' }).click();
    await expect(faq.locator('.faq-item')).toHaveCount(1);
    await tabs.filter({ hasText: '全部' }).click();
    await expect(faq.locator('.faq-item')).toHaveCount(6);
  });

  test('cta banner offers register and open-source actions', async ({
    page,
  }) => {
    await mockOverview(page);
    await page.goto('/');

    const cta = page.getByTestId('home-cta');
    await expect(cta.locator('.cta')).toBeVisible();
    await expect(cta.locator('a[href="/auth/register"]')).toBeVisible();
    await expect(
      cta.locator('a[href*="github.com/search"]'),
    ).toBeVisible();
  });
});

for (const colorScheme of ['light', 'dark'] as const) {
  for (const width of [320, 768, 1440]) {
    test('home sections stay readable at ' + width + 'px in ' + colorScheme, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.addInitScript((mode) => {
        const namespace = 'bugpk-api-v0.0.0-dev-dev';
        localStorage.setItem(namespace + '-light-theme-migrated-v1', 'true');
        localStorage.setItem(namespace + '-preferences', JSON.stringify({ value: { theme: { mode } } }));
        localStorage.setItem(namespace + '-preferences-theme', JSON.stringify({ value: mode }));
      }, colorScheme);
      await page.route('**/system-api/**', async (route) => {
        const data = new URL(route.request().url()).pathname === '/system-api/site/config'
          ? overview.siteConfig
          : [];
        await route.fulfill({ json: { code: 0, data } });
      });
      await mockOverview(page);
      await page.goto('/');
      await expect(page.getByTestId('home-metrics')).toContainText('99.12%');
      await page.evaluate((dark) => document.documentElement.classList.toggle('dark', dark), colorScheme === 'dark');
      await expect.poll(() => page.locator('.public-site-shell').evaluate((element) =>
        getComputedStyle(element).getPropertyValue('--ps-bg').trim(),
      )).toBe(colorScheme === 'dark' ? '#070b16' : '#f5f7fc');

      let previousBottom = 0;
      for (const id of ['home-hero', 'home-featured', 'home-lifecycle', 'home-faq', 'home-cta']) {
        const section = page.getByTestId(id);
        await expect(section).toBeVisible();
        const box = await section.boundingBox();
        expect(box, id).not.toBeNull();
        expect(box!.x, id).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width, id).toBeLessThanOrEqual(width + 1);
        expect(box!.y, id + ' must not overlap its preceding section').toBeGreaterThanOrEqual(previousBottom - 1);
        previousBottom = box!.y + box!.height;
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: testInfo.outputPath('home-' + width + '-' + colorScheme + '.png'), fullPage: true, animations: 'disabled' });
    });
  }
}
