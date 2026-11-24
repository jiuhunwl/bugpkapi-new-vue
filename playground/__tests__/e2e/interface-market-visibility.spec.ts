import { expect, test } from '@playwright/test';
import {
  mockInterfaceAdmin,
  loginInterfaceAdmin,
} from './common/interface-admin';

for (const width of [1440, 900]) {
  test(
    'administrator sees management only at width ' + width,
    async ({ page }, testInfo) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width, height: 900 });
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await mockInterfaceAdmin(page);
      await loginInterfaceAdmin(page);
      await expect(
        page.getByText('域名子池测试接口', { exact: true }).first(),
      ).toBeVisible();
      await expect(page.locator('.interface-market')).toHaveCount(0);
      await expect(page.locator('vite-error-overlay')).toHaveCount(0);
      expect(errors).toEqual([]);
      await page.screenshot({
        path: testInfo.outputPath('admin-list.png'),
        fullPage: true,
      });
      if (width > 1199) {
        await page.route('**/system-api/interface/list*', (route) =>
          route.fulfill({
            status: 500,
            json: { code: 500, message: 'test list failure' },
          }),
        );
        await page.getByTitle('刷新', { exact: true }).click();
        await expect(page.locator('.interface-list-error')).toBeVisible();
        await expect(page.locator('.interface-market')).toHaveCount(0);
      }
    },
  );
}

test('ordinary users still see the interface market', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const state = await mockInterfaceAdmin(page);
  await page.route('**/system-api/user/info', (route) =>
    route.fulfill({
      json: {
        code: 0,
        data: {
          avatar: '',
          homePath: '/console/interface/list',
          realName: 'User',
          roles: ['user'],
          userId: '2',
          username: 'user',
        },
      },
    }),
  );
  await page.route('**/system-api/auth/codes', (route) =>
    route.fulfill({ json: { code: 0, data: [] } }),
  );
  await page.route('**/system-api/market/apis*', (route) =>
    route.fulfill({
      json: { code: 0, data: { items: [state.item], total: 1 } },
    }),
  );
  await loginInterfaceAdmin(page);
  await expect(page.locator('.interface-market')).toBeVisible();
  await expect(
    page
      .locator('.interface-market')
      .getByText('域名子池测试接口', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('.vxe-grid')).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath('user-market.png'),
    fullPage: true,
  });
});
