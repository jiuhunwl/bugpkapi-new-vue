import { expect, test } from '@playwright/test';

import { authLogin } from './common/auth';
import {
  collectContextRequestPaths,
  collectRequestPaths,
  expectNoSystemRequestsUnderOpenApi,
} from './common/network';

const publicRoutes = [
  '/',
  '/apilist',
  '/links',
  '/donate',
  '/privacy-policy',
  '/terms-of-service',
];

const authenticatedRoutes = [
  '/console/workspace',
  '/profile',
  '/user/list',
  '/user/role',
  '/system/menu',
  '/system/register',
  '/system/register/email',
  '/system/register/mobile',
  '/system/login/quick',
  '/system/site',
  '/system/log-delete',
  '/interface/list',
  '/interface/log',
  '/key/list',
  '/package/global',
  '/package/interface',
  '/package/point',
  '/package/billing-records',
  '/purchase/global',
  '/purchase/interface',
  '/purchase/point',
  '/purchase/orders',
  '/purchase/assets',
  '/dashboard-stats/admin',
  '/dashboard-stats/user',
  '/risk-control/dashboard',
  '/risk-control/earth',
  '/payment/config',
  '/payment/amounts',
  '/payment/orders',
  '/content/notices',
  '/content/home-notice',
  '/content/site',
  '/content/friend-links',
  '/content/friend-link-applications',
  '/content/friend-link-config',
];

async function waitForAppVisible(page: {
  waitForFunction: (
    pageFunction: () => boolean,
    options?: { timeout: number },
  ) => Promise<unknown>;
}) {
  await page.waitForFunction(
    () => {
      const style = window.getComputedStyle(document.body);
      return style.display !== 'none' && style.visibility !== 'hidden';
    },
    { timeout: 15_000 },
  );
}

test.describe('Frontend Route Boundary Tests', () => {
  test('public pages do not send system requests to /api/*', async ({
    page,
  }) => {
    const requestPaths = collectRequestPaths(page);

    for (const route of publicRoutes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await waitForAppVisible(page);
    }

    expectNoSystemRequestsUnderOpenApi(requestPaths);
  });

  test('authenticated pages use /system-api and keep /api reserved for open gateway', async ({
    context,
    page,
  }) => {
    test.setTimeout(90_000);

    const requestPaths = collectContextRequestPaths(context);

    await authLogin(page);
    await page.close();

    for (const route of authenticatedRoutes) {
      const routePage = await context.newPage();
      try {
        await routePage.goto(route, { waitUntil: 'domcontentloaded' });
        await waitForAppVisible(routePage);
        await expect(routePage).toHaveURL(
          new RegExp(route.replace('/', '\\/')),
        );
        await expect(routePage.locator('body')).not.toContainText(
          /404|Not Found/i,
        );
        await expect(routePage.locator('body')).not.toContainText(
          /稳定提供 API 服务网站|Stable API service/i,
        );
      } finally {
        await routePage.close();
      }
    }

    expect(requestPaths.some((path) => path.startsWith('/system-api/'))).toBe(
      true,
    );
    expectNoSystemRequestsUnderOpenApi(requestPaths);
  });
});
