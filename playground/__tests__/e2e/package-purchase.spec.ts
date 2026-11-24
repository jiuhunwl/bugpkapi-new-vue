import type { Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import { authLogin } from './common/auth';

interface ApiBody<T> {
  code: number;
  data: T;
  error?: null | string;
  message: string;
}

interface UserDetail {
  balance?: number | string;
  email?: string;
  homePath?: string;
  id: string;
  mobile?: string;
  points?: number | string;
  realName: string;
  roleIds: Array<number | string>;
  status: 0 | 1;
  username: string;
}

interface UserInfo {
  userId: string;
}

interface PointPackage {
  id: string;
  name: string;
  pointAmount?: number | string;
  points?: number | string;
  price: number | string;
}

async function apiFetch<T>(
  page: Page,
  token: string,
  path: string,
  init: RequestInit = {},
) {
  return page.evaluate(
    async ({ accessToken, requestInit, requestPath }) => {
      const headers = new Headers(requestInit.headers);
      headers.set('Authorization', `Bearer ${accessToken}`);
      if (requestInit.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      const response = await fetch(requestPath, {
        ...requestInit,
        headers,
      });
      const body = (await response.json()) as ApiBody<unknown>;
      if (!response.ok || body.code !== 0) {
        throw new Error(body.error || body.message || `HTTP ${response.status}`);
      }
      return body.data;
    },
    {
      accessToken: token,
      requestInit: init,
      requestPath: path,
    },
  ) as Promise<T>;
}

function parseMoney(value: number | string | undefined) {
  return Number(String(value ?? '0').replace(/[¥￥,\s]/g, ''));
}

function saveUserPayload(user: UserDetail, patch: Partial<UserDetail>) {
  return {
    balance: patch.balance ?? user.balance ?? '0',
    email: patch.email ?? user.email ?? '',
    homePath: patch.homePath ?? user.homePath ?? '/console/workspace',
    mobile: patch.mobile ?? user.mobile ?? '',
    points: Number(patch.points ?? user.points ?? 0),
    realName: patch.realName ?? user.realName,
    roleIds: user.roleIds.map((item) => Number(item)),
    status: patch.status ?? user.status,
    username: user.username,
  };
}

test.describe('Package Purchase Regression', () => {
  test('creates point package from string points and purchases with balance', async ({
    page,
  }) => {
    const token = await authLogin(page);
    expect(token).toBeTruthy();

    const userInfo = await apiFetch<UserInfo>(page, token, '/system-api/user/info');
    const originalUser = await apiFetch<UserDetail>(
      page,
      token,
      `/system-api/system/user/${userInfo.userId}`,
    );
    const packageName = `E2E Point ${Date.now()}`;
    let createdPackageId = '';

    try {
      await apiFetch<boolean>(page, token, '/system-api/package/point', {
        body: JSON.stringify({
          name: packageName,
          pointAmount: '1,000',
          price: '1.25',
          status: 1,
        }),
        method: 'POST',
      });

      const pointList = await apiFetch<{
        items: PointPackage[];
        total: number;
      }>(
        page,
        token,
        `/system-api/package/point/list?keyword=${encodeURIComponent(packageName)}&page=1&pageSize=10`,
      );
      const pointPackage = pointList.items.find(
        (item) => item.name === packageName,
      );
      expect(pointPackage).toBeTruthy();
      createdPackageId = pointPackage!.id;
      expect(Number(pointPackage!.pointAmount ?? pointPackage!.points)).toBe(1000);

      await apiFetch<boolean>(
        page,
        token,
        `/system-api/system/user/${userInfo.userId}`,
        {
          body: JSON.stringify(
            saveUserPayload(originalUser, {
              balance: '100.0000',
              points: originalUser.points ?? 0,
            }),
          ),
          method: 'PUT',
        },
      );

      await apiFetch<boolean>(
        page,
        token,
        `/system-api/package/mall/point/${createdPackageId}/purchase`,
        {
          body: '{}',
          headers: {
            'Idempotency-Key': `e2e-point-purchase-${Date.now()}`,
          },
          method: 'POST',
        },
      );

      const updatedUser = await apiFetch<UserDetail>(
        page,
        token,
        `/system-api/system/user/${userInfo.userId}`,
      );
      expect(Number(updatedUser.points)).toBe(
        Number(originalUser.points ?? 0) + 1000,
      );
      expect(parseMoney(updatedUser.balance)).toBeCloseTo(98.75, 4);
    } finally {
      if (createdPackageId) {
        await apiFetch<boolean>(
          page,
          token,
          `/system-api/package/point/${createdPackageId}`,
          { method: 'DELETE' },
        ).catch(() => undefined);
      }
      await apiFetch<boolean>(
        page,
        token,
        `/system-api/system/user/${userInfo.userId}`,
        {
          body: JSON.stringify(saveUserPayload(originalUser, originalUser)),
          method: 'PUT',
        },
      ).catch(() => undefined);
    }
  });

  test('does not mark formatted balance as insufficient in payment modal', async ({
    page,
  }) => {
    const token = await authLogin(page);
    expect(token).toBeTruthy();

    const packageName = `E2E Modal ${Date.now()}`;
    let createdPackageId = '';

    try {
      await apiFetch<boolean>(page, token, '/system-api/package/point', {
        body: JSON.stringify({
          name: packageName,
          pointAmount: 100,
          price: '99.99',
          status: 1,
        }),
        method: 'POST',
      });
      const pointList = await apiFetch<{
        items: PointPackage[];
      }>(
        page,
        token,
        `/system-api/package/point/list?keyword=${encodeURIComponent(packageName)}&page=1&pageSize=10`,
      );
      createdPackageId =
        pointList.items.find((item) => item.name === packageName)?.id ?? '';
      expect(createdPackageId).toBeTruthy();

      await page.route('**/system-api/user/workbench/stats', async (route) => {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            code: 0,
            data: {
              balance: '¥1,000.00',
              callTrends: {
                oneYear: { labels: [], total: 0, values: [] },
                sevenDays: { labels: [], total: 0, values: [] },
                thirtyDays: { labels: [], total: 0, values: [] },
              },
              currentPackageName: '',
              currentPackageType: '',
              dailyLimit: 0,
              dailyLimitUnlimited: true,
              failedCalls: 0,
              failedRate: '0%',
              hasAnyPackage: false,
              hasMemberPackage: false,
              interfacePackageCount: 0,
              interfacePackages: [],
              memberPackage: null,
              points: 0,
              qpsLimit: 0,
              qpsLimitUnlimited: true,
              remainingCalls: 0,
              remainingUnlimited: true,
              successCalls: 0,
              successRate: '0%',
              todayCalls: 0,
            },
            error: null,
            message: 'ok',
          }),
        });
      });
      await page.route('**/system-api/package/mall/point/list**', async (route) => {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            code: 0,
            data: {
              items: [
                {
                  id: createdPackageId,
                  name: packageName,
                  pointAmount: 100,
                  points: 100,
                  price: '99.99',
                  remark: 'E2E modal package',
                },
              ],
              total: 1,
            },
            error: null,
            message: 'ok',
          }),
        });
      });

      const pointMallResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/system-api/package/mall/point/list') &&
          response.status() === 200,
      );
      await page.goto('/purchase/point', { waitUntil: 'domcontentloaded' });
      await pointMallResponse;
      const card = page.locator('.package-card').filter({ hasText: packageName });
      await expect(card).toBeVisible({ timeout: 15_000 });
      await card.getByRole('button').click();

      const modal = page.getByRole('dialog');
      await expect(modal).toBeVisible();
      await expect(modal).toContainText(/1,000\.00/);
      await expect(modal).not.toContainText(/不足|insufficient/i);
      await expect(
        modal.getByRole('button', { name: /确认|Buy|Confirm/i }).last(),
      ).toBeEnabled();
    } finally {
      if (createdPackageId) {
        await apiFetch<boolean>(
          page,
          token,
          `/system-api/package/point/${createdPackageId}`,
          { method: 'DELETE' },
        ).catch(() => undefined);
      }
    }
  });
});
