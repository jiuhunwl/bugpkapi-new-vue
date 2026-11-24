import type { Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import { authLogin } from './common/auth';

interface ViewportProfile {
  expectedPaymentColumns: number;
  hasTouch: boolean;
  height: number;
  name: string;
  usesCompactPublicNavigation: boolean;
  usesMobileConsoleNavigation: boolean;
  width: number;
}

const viewportProfiles: ViewportProfile[] = [
  {
    expectedPaymentColumns: 1,
    hasTouch: true,
    height: 844,
    name: 'phone-390',
    usesCompactPublicNavigation: true,
    usesMobileConsoleNavigation: true,
    width: 390,
  },
  {
    expectedPaymentColumns: 2,
    hasTouch: true,
    height: 1024,
    name: 'tablet-768',
    usesCompactPublicNavigation: true,
    usesMobileConsoleNavigation: false,
    width: 768,
  },
  {
    expectedPaymentColumns: 2,
    hasTouch: false,
    height: 900,
    name: 'desktop-1440',
    usesCompactPublicNavigation: false,
    usesMobileConsoleNavigation: false,
    width: 1440,
  },
];

const publicRoutes = [
  '/',
  '/apilist',
  '/docs/1',
  '/links',
  '/donate',
  '/privacy-policy',
  '/terms-of-service',
];

const adminRoutes = [
  '/console/workspace',
  '/interface/list',
  '/payment/config',
  '/content/site',
];

async function expectNoRootOverflow(page: Page, label: string) {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const root = document.documentElement;
          const body = document.body;
          return (
            Math.max(root.scrollWidth, body?.scrollWidth ?? 0) -
            root.clientWidth
          );
        }),
      { message: `${label} must not cause root-level horizontal scrolling` },
    )
    .toBeLessThanOrEqual(1);
}

async function expectPageReady(page: Page, route: string) {
  await expect
    .poll(
      () =>
        page
          .locator('#app')
          .evaluate((app) => (app.textContent ?? '').trim().length),
      {
        message: `${route} should render application content`,
        timeout: 30_000,
      },
    )
    .toBeGreaterThan(20);
  await expect(page.locator('body')).not.toContainText(/404|Not Found/i);
  await expect(page.locator('body')).not.toContainText(/Internal Error/i);
}

async function getGridColumnCount(page: Page) {
  const paymentGrid = page
    .locator('.payment-config-card .payment-method-list')
    .first();
  await expect(paymentGrid).toBeVisible({ timeout: 15_000 });
  return paymentGrid.evaluate((element) => {
    const columns = window.getComputedStyle(element).gridTemplateColumns;
    return columns === 'none' ? 0 : columns.trim().split(/\s+/).length;
  });
}

async function forceMobileHeaderNavigationPreferences(page: Page) {
  await page.evaluate(() => {
    const preferencesKey = Object.keys(localStorage).find((key) =>
      key.endsWith('-preferences'),
    );
    if (!preferencesKey) {
      throw new Error('preferences storage was not initialized');
    }
    const cached = JSON.parse(localStorage.getItem(preferencesKey) || '{}');
    cached.value = {
      ...cached.value,
      app: { ...cached.value?.app, layout: 'header-nav' },
      sidebar: {
        ...cached.value?.sidebar,
        collapsed: false,
        hidden: true,
      },
    };
    localStorage.setItem(preferencesKey, JSON.stringify(cached));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expectPageReady(page, '/console/workspace');
  // vite dev 冷编译窗口期 reload 偶发停留在启动 splash；重载一次自愈。
  if (!(await page.evaluate(() => Boolean((document.querySelector('#app') as any)?.__vue_app__)))) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expectPageReady(page, '/console/workspace');
  }
}

for (const profile of viewportProfiles) {
  test.describe(`Responsive Layout - ${profile.name}`, () => {
    test.use({
      hasTouch: profile.hasTouch,
      viewport: { height: profile.height, width: profile.width },
    });

    test('public pages reflow without viewport overflow', async ({ page }) => {
      test.setTimeout(150_000);
      for (const route of publicRoutes) {
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        await expectPageReady(page, route);
        await expect(page.locator('.site-public-header')).toBeVisible();
        await expectNoRootOverflow(page, `${profile.name} ${route}`);
      }

      const desktopNavigation = page.locator('.site-nav');
      const mobileMenuToggle = page.locator('.nav-toggle');
      if (profile.usesCompactPublicNavigation) {
        await expect(desktopNavigation).toBeHidden();
        await expect(mobileMenuToggle).toBeVisible();

        const toggleBox = await mobileMenuToggle.boundingBox();
        expect(toggleBox?.width).toBeGreaterThanOrEqual(44);
        expect(toggleBox?.height).toBeGreaterThanOrEqual(44);

        await mobileMenuToggle.click();
        await expect(page.locator('.mobile-menu-panel.open')).toBeVisible();
        await expectNoRootOverflow(
          page,
          `${profile.name} expanded public menu`,
        );
      } else {
        await expect(desktopNavigation).toBeVisible();
        await expect(mobileMenuToggle).toBeHidden();
      }
    });

    test('console pages, forms, tables, and drawers stay within the viewport', async ({
      page,
    }, testInfo) => {
      test.setTimeout(180_000);
      await authLogin(page);

      if (profile.usesMobileConsoleNavigation) {
        await forceMobileHeaderNavigationPreferences(page);
        const menuToggle = page.getByTestId('mobile-sidebar-toggle');
        const sidebar = page.locator('aside').first();

        await expect(menuToggle).toBeVisible();
        await expect(menuToggle).toHaveAttribute('aria-expanded', 'false');
        await menuToggle.click();
        await expect(menuToggle).toHaveAttribute('aria-expanded', 'true');
        await expect(page.getByTestId('mobile-sidebar-mask')).toBeVisible();
        await expect
          .poll(async () => (await sidebar.boundingBox())?.width ?? 0)
          .toBeGreaterThan(100);

        const activeMenuItem = sidebar.locator('a[role="menuitem"].is-active');
        await expect(activeMenuItem.first()).toBeVisible();
        await activeMenuItem.first().click();
        await expect(menuToggle).toHaveAttribute('aria-expanded', 'false');
        await expect(page.getByTestId('mobile-sidebar-mask')).toHaveCount(0);
        await expect
          .poll(async () => (await sidebar.boundingBox())?.width ?? 0)
          .toBeLessThanOrEqual(1);
      }

      for (const route of adminRoutes) {
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        await expectPageReady(page, route);
        await expectNoRootOverflow(page, `${profile.name} ${route}`);
      }

      await page.goto('/payment/config', { waitUntil: 'domcontentloaded' });
      expect(await getGridColumnCount(page)).toBe(
        profile.expectedPaymentColumns,
      );

      if (profile.width < 768) {
        const methodRow = page
          .locator('.payment-config-card .payment-method-row')
          .first();
        await expect(methodRow).toBeVisible();
        await expect(methodRow).toHaveCSS('align-items', 'flex-start');
      }

      await page.goto('/interface/list', { waitUntil: 'domcontentloaded' });
      const compactInterfaceList = page.getByTestId(
        'interface-responsive-list',
      );
      const createButton =
        profile.width < 1200
          ? compactInterfaceList.locator(
              '.responsive-interface-list__header-actions .ant-btn-primary',
            )
          : page.locator('.vxe-grid--toolbar-wrapper .ant-btn-primary').last();

      if (profile.width < 1200) {
        await expect(compactInterfaceList).toBeVisible({ timeout: 15_000 });
      } else {
        await expect(compactInterfaceList).toHaveCount(0);
      }
      await expect(createButton).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('.ant-message-notice:visible')).toHaveCount(0, {
        timeout: 15_000,
      });
      await page.screenshot({
        fullPage: true,
        path: testInfo.outputPath(`interface-list-${profile.name}.png`),
      });
      await createButton.click();

      const drawer = page.locator('[role="dialog"]:visible').last();
      await expect(drawer).toBeVisible({ timeout: 15_000 });
      await expect
        .poll(async () => {
          const box = await drawer.boundingBox();
          return box ? Math.abs(box.x + box.width - profile.width) : Infinity;
        })
        .toBeLessThanOrEqual(1);
      const drawerBox = await drawer.boundingBox();
      expect(drawerBox).not.toBeNull();
      expect(drawerBox!.x).toBeGreaterThanOrEqual(-1);
      expect(drawerBox!.x + drawerBox!.width).toBeLessThanOrEqual(
        profile.width + 1,
      );
      if (profile.width < 768) {
        expect(drawerBox!.width).toBeGreaterThanOrEqual(profile.width - 2);
      }
      await expectNoRootOverflow(page, `${profile.name} interface drawer`);
    });
  });
}
