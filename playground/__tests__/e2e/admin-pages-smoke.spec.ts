import { expect, test } from '@playwright/test';

import { authLogin } from './common/auth';
import {
  collectRequestPaths,
  expectNoSystemRequestsUnderOpenApi,
} from './common/network';

interface MenuNode {
  children?: MenuNode[];
  path?: string;
}

const criticalAdminRoutes = [
  '/console/workspace',
  '/user/list',
  '/user/role',
  '/system/menu',
  '/system/register',
  '/system/register/email',
  '/system/ip-config',
  '/system/about',
  '/system/captcha-config',
  '/system/custom-code',
  '/system/log-delete',
  '/console/interfaces',
  '/console/call-logs',
  '/key',
  '/package/global',
  '/package/interface',
  '/package/point',
  '/package/billing-records',
  '/risk-control/dashboard',
  '/payment/config',
  '/payment/amounts',
  '/payment/orders',
  '/content/notices',
  '/content/home-notice',
  '/content/site',
  '/content/friend-links',
  '/content/friend-link-applications',
  '/content/friend-link-config',
  '/content/advertisements',
];

const removedAdminRoutes = [
  '/dashboard-stats/admin',
  '/dashboard-stats/user',
  '/risk-control/earth',
  '/purchase/global',
  '/purchase/interface',
  '/purchase/point',
  '/purchase/orders',
];

function flattenMenuPaths(nodes: MenuNode[] = []) {
  const paths = new Set<string>();
  const visit = (node: MenuNode) => {
    if (node.path) {
      paths.add(node.path);
    }
    node.children?.forEach(visit);
  };
  nodes.forEach(visit);
  return paths;
}

async function getMenuPathsFromPayload(payload: {
  code: number;
  data?: MenuNode[];
}) {
  expect(payload.code).toBe(0);
  return flattenMenuPaths(payload.data ?? []);
}

async function expectBusinessPageRendered(page: Parameters<typeof authLogin>[0]) {
  await expect(page.locator('.site-public-header')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(/404|Not Found/i);
  await expect(page.locator('body')).not.toContainText(/403|Forbidden/i);
  await expect(page.locator('body')).not.toContainText(/500|Internal Error/i);
  await expect(page.locator('body')).not.toContainText(
    /绋冲畾鎻愪緵 API 鏈嶅姟缃戠珯|Stable API service/i,
  );

  await page.waitForFunction(
    () => (document.querySelector('#app')?.textContent ?? '').trim().length > 20,
    { timeout: 15_000 },
  );
  const visibleTextLength = await page
    .locator('#app')
    .evaluate((app) => (app.textContent ?? '').trim().length);
  expect(visibleTextLength).toBeGreaterThan(20);

  await expect(
    page
      .locator(
        [
          '.vxe-table',
          '.ant-card',
          '.ant-form',
          '.ant-table',
          'button',
          '[role="table"]',
        ].join(','),
      )
      .first(),
  ).toBeVisible({ timeout: 15_000 });
}

test.describe('Admin Business Pages Smoke', () => {
  test('dynamic admin menu exposes and renders critical business pages', async ({
    page,
  }) => {
    test.setTimeout(180_000);

    const requestPaths = collectRequestPaths(page);
    const serverErrors: string[] = [];
    const pageErrors: string[] = [];
    const menuResponsePromise = page
      .waitForResponse((response) => {
        return new URL(response.url()).pathname === '/system-api/menu/all';
      })
      .then((response) => response.json());

    page.on('response', (response) => {
      const url = new URL(response.url());
      if (url.pathname.startsWith('/system-api/') && response.status() >= 500) {
        serverErrors.push(`${response.status()} ${url.pathname}`);
      }
    });
    page.on('pageerror', (error) => {
      if (/ResizeObserver loop/i.test(error.message)) {
        return;
      }
      pageErrors.push(error.message);
    });

    await authLogin(page);

    const menuPaths = await getMenuPathsFromPayload(await menuResponsePromise);
    for (const route of criticalAdminRoutes) {
      expect(menuPaths, `dynamic menu should include ${route}`).toContain(route);
    }
    for (const route of removedAdminRoutes) {
      expect(menuPaths, `dynamic menu should omit ${route}`).not.toContain(route);
    }

    for (const route of criticalAdminRoutes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(new RegExp(`${route}(?:\\?|$)`));
      await expectBusinessPageRendered(page);
      expect(serverErrors, `no backend 5xx while opening ${route}`).toEqual([]);
      expect(pageErrors, `no runtime error while opening ${route}`).toEqual([]);
    }

    expectNoSystemRequestsUnderOpenApi(requestPaths);
  });
});
