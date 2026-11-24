import type { Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import { authLogin } from './common/auth';

function successResponse(data: unknown) {
  return { code: 0, data, error: null, message: 'ok' };
}

async function expectInputValue(page: Page, expectedValue: string) {
  await expect
    .poll(() =>
      page.locator('input').evaluateAll(
        (inputs, value) =>
          inputs.some(
            (input) => (input as HTMLInputElement).value === value,
          ),
        expectedValue,
      ),
    )
    .toBe(true);
}

async function mockInterfaceList(page: Page) {
  await page.route(/\/system-api\/interface\/list(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: successResponse({
        items: [
          {
            apiCode: 'weather_current',
            avatarUrl: '',
            callCount: 128,
            id: '101',
            isFeatured: 1,
            isTop: 1,
            name: '实时天气',
            pointPrice: 2,
            pollingEnabled: 0,
            price: '0.0100',
            qpsLimit: 20,
            remark: '返回城市实时天气信息',
            requestMethod: 'GET',
            requestUrl: '/gateway/weather',
            status: 1,
          },
          {
            apiCode: 'ip_lookup',
            avatarUrl: '',
            callCount: 64,
            id: '102',
            isFeatured: 0,
            isTop: 0,
            name: 'IP 查询',
            pointPrice: 0,
            pollingEnabled: 1,
            pollingMode: 'ROUND_ROBIN',
            price: '0.0200',
            qpsLimit: 10,
            remark: '查询 IP 归属信息',
            requestMethod: 'POST',
            requestUrl: '/gateway/ip',
            status: 1,
          },
        ],
        total: 2,
      }),
    });
  });
}

async function mockRiskOverview(page: Page) {
  await page.route(
    /\/system-api\/risk-control\/overview(?:\?.*)?$/,
    async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        json: successResponse({
          distributedEvents: 0,
          earthPointCount: 1,
          events: [],
          failedRequests: 18,
          invalidKeyAttempts: 0,
          invalidKeyBlocked: 0,
          policy: {
            burstWindowMinutes: 5,
            distributedIps: 12,
            distributedRequests: 30,
            proxyPoolIps: 5,
            proxyPoolRequests: 12,
            singleIpRequests: 8,
          },
          proxyPoolEvents: 0,
          riskScore: 76,
          riskyRequests: 18,
          singleIpEvents: 1,
          topAttackIp: '203.0.113.8',
          topAttackParam: 'signature-demo',
          topFailedAccounts: [
            {
              displayName: '风险测试用户',
              failedCalls: 12,
              lastSeen: '2026-08-11 12:00:00',
              riskHits: 4,
              status: 1,
              totalCalls: 20,
              uniqueIps: 3,
              userId: '2',
              username: 'risk-user',
            },
          ],
          topFailedIps: [
            {
              clientIp: '203.0.113.8',
              failedCalls: 12,
              lastSeen: '2026-08-11 12:00:00',
              region: '测试区域',
              riskHits: 4,
              totalCalls: 20,
              uniqueUsers: 1,
            },
          ],
          totalRequests: 120,
          trend: [],
          uniqueIps: 6,
          uniqueParamSignatures: 4,
          windowMinutes: 10,
        }),
      });
    },
  );
}

test('shows a startup animation instead of a blank screen while bootstrapping', async ({
  page,
}) => {
  let releaseMain: () => void = () => undefined;
  const mainGate = new Promise<void>((resolve) => {
    releaseMain = resolve;
  });

  await page.addInitScript(() => {
    localStorage.setItem(
      'bugpk-api-loading-animation-v1',
      JSON.stringify({
        loadingAnimationEnabled: 0,
        loadingAnimationPreset: 'bars',
        loadingAnimationUrl: '',
        siteName: 'BugPk Startup',
      }),
    );
  });
  await page.route('**/system-api/site/config', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: successResponse({
        loadingAnimationEnabled: 0,
        loadingAnimationPreset: 'bars',
        loadingAnimationUrl: '',
        siteName: 'BugPk Startup',
      }),
    });
  });
  await page.route('**/src/main.ts*', async (route) => {
    await mainGate;
    await route.continue();
  });

  await page.goto('/', { waitUntil: 'commit' });
  const loading = page.locator('#__app-loading__');
  await expect(loading).toBeVisible();
  await expect(loading).toHaveAttribute('data-preset', 'bars');
  await expect(page.locator('.loading__bars')).toBeVisible();
  await expect(page.locator('#__app-loading-title__')).toHaveText(
    'BugPk Startup',
  );

  releaseMain();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('#app')).not.toBeEmpty({ timeout: 20_000 });
  await expect(loading).toHaveCount(0, { timeout: 20_000 });
});

test('renders complete interface information and mobile batch selection', async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await authLogin(page);
  await mockInterfaceList(page);

  await page.goto('/interface/list', { waitUntil: 'domcontentloaded' });
  await expect(
    page.locator('.vxe-header--column').filter({ hasText: 'ID' }).first(),
  ).toBeVisible();
  await expect(page.locator('.vxe-body--row').first()).toContainText('101');
  await expect(page.locator('.vxe-body--row').first()).toContainText(
    '/gateway/weather',
  );
  await expect(page.getByRole('button', { name: '启用选中' })).toBeVisible();
  await expect(page.getByRole('button', { name: '停用选中' })).toBeVisible();
  await expect(page.getByRole('button', { name: '批量删除' })).toBeVisible();

  await page.setViewportSize({ height: 844, width: 390 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  const compactList = page.getByTestId('interface-responsive-list');
  await expect(compactList).toBeVisible();
  const cards = compactList.getByTestId('interface-responsive-item');
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toContainText('ID 101');
  await expect(cards.first()).toContainText('/gateway/weather');

  const checkboxes = compactList.locator('input[type="checkbox"]');
  await checkboxes.nth(0).check();
  await checkboxes.nth(1).check();
  await expect(
    compactList.getByRole('button', { name: '启用选中 (2)' }),
  ).toBeVisible();
  await expect(
    compactList.getByRole('button', { name: '停用选中 (2)' }),
  ).toBeVisible();
  await expect(
    compactList.getByRole('button', { name: '删除选中 (2)' }),
  ).toBeVisible();
});

test('opens temporary and permanent risk account ban choices', async ({
  page,
}) => {
  await authLogin(page);
  await mockRiskOverview(page);

  await page.goto('/risk-control/dashboard', {
    waitUntil: 'domcontentloaded',
  });
  await page.getByRole('button', { name: '封号' }).click();

  const dialog = page.getByRole('dialog').filter({ hasText: '封禁账号' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('结束时间')).toBeVisible();
  await dialog.locator('.ant-select-selector').click();
  await page
    .locator('.ant-select-item-option')
    .filter({ hasText: '永久封禁' })
    .click();
  await expect(dialog.getByText('结束时间')).toHaveCount(0);
  await expect(
    dialog.getByPlaceholder('请填写风控封禁原因'),
  ).toBeVisible();
});

test('shows all loading presets, custom media and branding fields', async ({
  page,
}) => {
  await authLogin(page);
  await page.route('**/system-api/site/admin/config', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: successResponse({
        analyticsCode: '',
        authorName: 'BugPk Team',
        authorUrl: 'https://example.com/about',
        githubUrl: 'https://github.com/bugpk/bugpkapi',
        licenseType: 'MIT',
        licenseUrl: 'https://github.com/bugpk/bugpkapi/blob/main/LICENSE',
        loadingAnimationEnabled: 0,
        loadingAnimationPreset: 'orbit',
        loadingAnimationUrl: 'https://assets.example.test/loading.gif',
        logoUrl: '',
        noindex: 0,
        siteName: 'BugPk-Api',
      }),
    });
  });

  await page.goto('/content/site', { waitUntil: 'domcontentloaded' });
  await expectInputValue(page, 'https://github.com/bugpk/bugpkapi');
  await expectInputValue(page, 'BugPk Team');
  await expectInputValue(page, 'MIT');
  await expectInputValue(page, 'https://assets.example.test/loading.gif');

  const presetField = page
    .locator('.vben-form-item')
    .filter({ hasText: '内置动画' });
  await presetField.locator('.ant-select-selector').click();
  for (const label of ['数据网关', '节点环绕', '脉冲扩散', '信号柱']) {
    await expect(
      page.locator('.ant-select-item-option').filter({ hasText: label }),
    ).toBeVisible();
  }
  await expect(page.locator('.loading-preview__orbit')).toBeVisible();
});
