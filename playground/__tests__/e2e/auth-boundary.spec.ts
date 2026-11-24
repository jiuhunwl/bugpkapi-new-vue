import { expect, test } from '@playwright/test';

import {
  collectRequestPaths,
  expectNoSystemRequestsUnderOpenApi,
  waitForAppVisible,
} from './common/network';

test.describe('Auth Route Boundary Tests', () => {
  for (const route of ['/auth/code-login', '/auth/qrcode-login']) {
    test(`${route} is a disabled placeholder and does not simulate login`, async ({
      page,
    }) => {
      const requestPaths = collectRequestPaths(page);

      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await waitForAppVisible(page);

      await expect(page).toHaveURL(new RegExp(`${route.replace('/', '\\/')}`));
      await expect(page.locator("input[name='username']")).toHaveCount(0);
      await expect(page.locator("input[name='password']")).toHaveCount(0);
      expect(requestPaths).not.toContain('/system-api/auth/login');
      expect(requestPaths).not.toContain('/api/auth/login');
      expectNoSystemRequestsUnderOpenApi(requestPaths);
    });
  }
});
