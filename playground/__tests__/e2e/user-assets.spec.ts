import { expect, test } from '@playwright/test';

import { authLogin } from './common/auth';
import {
  collectRequestPaths,
  expectNoSystemRequestsUnderOpenApi,
} from './common/network';

async function mockUserAssetBackend(page: import('@playwright/test').Page) {
  await page.route('**/system-api/**', async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    let data: unknown = true;

    if (pathname === '/system-api/auth/refresh') {
      await route.fulfill({
        contentType: 'application/json',
        json: { code: -1, data: null, error: '未登录', message: '未登录' },
        status: 401,
      });
      return;
    }
    if (pathname === '/system-api/site/config') {
      data = { logoUrl: '', siteName: 'BugPk-Api' };
    } else if (pathname === '/system-api/auth/captcha') {
      data = {
        captchaId: 'asset-center-captcha',
        challenge: 'abcdef0123456789',
        difficulty: 1,
        provider: 'pow',
        scene: 'login',
      };
    } else if (
      pathname === '/system-api/auth/captcha/asset-center-captcha/verify'
    ) {
      data = true;
    } else if (pathname === '/system-api/auth/login') {
      data = { accessToken: 'asset-center-access-token' };
    } else if (pathname === '/system-api/user/info') {
      data = {
        avatar: '',
        desc: '',
        homePath: '/purchase/assets',
        realName: 'Asset Admin',
        roles: ['admin'],
        token: 'asset-center-access-token',
        userId: '1',
        username: 'admin',
      };
    } else if (pathname === '/system-api/auth/codes') {
      data = ['dashboard:user:view', 'package:mall:list'];
    } else if (pathname === '/system-api/menu/all') {
      data = [
        {
          authCode: 'package:mall:list',
          children: [
            {
              authCode: 'package:mall:list',
              component: '/purchase/assets/index',
              id: '174',
              meta: {
                icon: 'lucide:wallet-cards',
                order: 5,
                title: 'system.package.assets.title',
              },
              name: 'UserAssetCenter',
              path: '/purchase/assets',
              pid: '84',
              status: 1,
              type: 'menu',
            },
          ],
          id: '84',
          meta: { icon: 'lucide:shopping-bag', title: 'system.package.mallTitle' },
          name: 'PackageMall',
          path: '/package/mall',
          pid: '0',
          status: 1,
          type: 'catalog',
        },
      ];
    } else if (pathname === '/system-api/user/packages') {
      data = [
        {
          dailyLimit: 1000,
          endAt: '2026-08-12 12:00:00',
          id: '1',
          name: 'E2E Asset Package',
          qpsLimit: 20,
          scope: 'GLOBAL',
          usedToday: 12,
        },
      ];
    } else if (pathname === '/system-api/user/wallet/transactions') {
      data = {
        items: [
          {
            amount: '25.5000',
            balanceAfter: '25.5000',
            bizId: '1',
            bizType: 'ADMIN_USER_ASSET_ADJUST',
            createTime: '2026-07-13 12:00:00',
            id: '1',
            points: 100,
            pointsAfter: 100,
            remark: 'E2E asset adjustment',
          },
        ],
        total: 1,
      };
    } else if (pathname === '/system-api/user/billing-records') {
      data = {
        items: [
          {
            apiCode: 'asset-e2e-api',
            chargeAmount: '0.5000',
            chargeType: 'BALANCE',
            createTime: '2026-07-13 12:01:00',
            id: '1',
            interfaceId: '1',
            pointAmount: 0,
            reason: 'E2E billing',
            status: 'CONFIRMED',
            userId: '1',
          },
        ],
        total: 1,
      };
    }

    await route.fulfill({
      contentType: 'application/json',
      json: { code: 0, data, error: null, message: 'ok' },
    });
  });
}

test.describe('User Asset Center', () => {
  test('renders packages, wallet and self-scoped billing records', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const requestPaths = collectRequestPaths(page);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => {
      const isAssetPage = page.url().includes('/purchase/assets');
      if (isAssetPage && !/ResizeObserver loop/i.test(error.message)) {
        pageErrors.push(error.message);
      }
    });

    await mockUserAssetBackend(page);
    await authLogin(page, '/purchase/assets');

    await expect(page).toHaveURL(/\/purchase\/assets(?:\?|$)/);
    await expect(page.getByRole('heading', { name: /我的资产|My Assets/i })).toBeVisible();
    await expect(page.getByText(/套餐权益|Package Benefits/i)).toBeVisible();
    await expect(page.getByText(/余额与点数流水|Balance and Point Transactions/i)).toBeVisible();
    await expect(page.getByText(/开放调用计费|Open API Billing/i)).toBeVisible();
    await expect(page.getByText('E2E Asset Package')).toBeVisible();
    await expect(page.getByText(/管理员调整|Administrator Adjustment/i)).toBeVisible();
    await expect(page.getByText('asset-e2e-api')).toBeVisible();

    const refreshRequestsBefore = requestPaths.filter((path) =>
      path.startsWith('/system-api/user/'),
    ).length;
    await page.getByRole('button', { name: /刷新|Refresh/i }).click();
    await expect
      .poll(
        () =>
          requestPaths.filter((path) => path.startsWith('/system-api/user/'))
            .length,
      )
      .toBeGreaterThan(refreshRequestsBefore);

    expect(pageErrors).toEqual([]);
    expectNoSystemRequestsUnderOpenApi(requestPaths);
    expect(requestPaths).not.toContain('/api/user/packages');
    expect(requestPaths).not.toContain('/api/user/wallet/transactions');
    expect(requestPaths).not.toContain('/api/user/billing-records');

    const screenshotPath = process.env.USER_ASSET_SCREENSHOT_PATH;
    if (screenshotPath) {
      await page.screenshot({ fullPage: false, path: screenshotPath });
    }
  });
});
