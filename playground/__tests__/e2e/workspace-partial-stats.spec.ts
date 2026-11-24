import { expect, test } from '@playwright/test';

import { createDefaultAdminWorkbenchStats } from '../../src/views/dashboard/workspace/workspace-stats';
import { authLogin } from './common/auth';
import {
  collectRequestPaths,
  expectNoSystemRequestsUnderOpenApi,
} from './common/network';

type WorkspaceRole = 'admin' | 'user';

async function mockPartialWorkspaceBackend(
  page: import('@playwright/test').Page,
  role: WorkspaceRole,
  readAdminStats: () => unknown = () => ({}),
  readUserStats: () => unknown = () => ({}),
) {
  const isAdmin = role === 'admin';
  await page.route('**/system-api/**', async (route) => {
    const { pathname } = new URL(route.request().url());
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
        captchaId: 'partial-workspace-captcha',
        challenge: 'abcdef0123456789',
        difficulty: 1,
        provider: 'pow',
        scene: 'login',
      };
    } else if (
      pathname === '/system-api/auth/captcha/partial-workspace-captcha/verify'
    ) {
      data = true;
    } else if (pathname === '/system-api/auth/login') {
      data = { accessToken: 'partial-workspace-access-token' };
    } else if (pathname === '/system-api/user/info') {
      data = {
        avatar: '',
        desc: '',
        homePath: '/console/workspace',
        realName: isAdmin ? 'Workspace Admin' : 'Workspace User',
        roles: [role],
        token: 'partial-workspace-access-token',
        userId: '1',
        username: role,
      };
    } else if (pathname === '/system-api/auth/codes') {
      data = [isAdmin ? 'dashboard:admin:view' : 'dashboard:user:view'];
    } else if (pathname === '/system-api/menu/all') {
      data = [
        {
          authCode: isAdmin ? 'dashboard:admin:view' : 'dashboard:user:view',
          component: '/dashboard/workspace/index',
          id: isAdmin ? '93' : '92',
          meta: {
            icon: 'lucide:layout-dashboard',
            order: 1,
            title: isAdmin
              ? 'system.dashboard.adminTitle'
              : 'system.dashboard.userTitle',
          },
          name: isAdmin ? 'AdminWorkspace' : 'UserWorkspace',
          path: '/console/workspace',
          pid: '0',
          status: 1,
          type: 'menu',
        },
      ];
    } else if (
      isAdmin &&
      pathname === '/system-api/user/workbench/admin-stats'
    ) {
      data = readAdminStats();
    } else if (!isAdmin && pathname === '/system-api/user/workbench/stats') {
      data = readUserStats();
    } else if (pathname === '/system-api/auth/register/config') {
      data = {};
    } else if (pathname === '/system-api/notice/user/list') {
      data = { items: [], total: 0 };
    } else if (pathname === '/system-api/notice/user/popup') {
      data = [];
    }

    await route.fulfill({
      contentType: 'application/json',
      json: { code: 0, data, error: null, message: 'ok' },
    });
  });
}

test.describe('Workspace Partial Statistics', () => {
  test('keeps the admin workspace usable when nested stats are missing', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const requestPaths = collectRequestPaths(page);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => {
      if (!/ResizeObserver loop/i.test(error.message)) {
        pageErrors.push(error.message);
      }
    });

    await mockPartialWorkspaceBackend(page, 'admin');
    await authLogin(page);
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByText(/平台用户|Platform Users/i).first(),
    ).toBeVisible();
    await expect(
      page.getByText(/今日调用|Today's Calls/i).first(),
    ).toBeVisible();
    await expect(page.getByText(/调用趋势|Call Trend/i).first()).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(requestPaths).toContain('/system-api/user/workbench/admin-stats');
    expectNoSystemRequestsUnderOpenApi(requestPaths);
    expect(requestPaths).not.toContain('/api/user/workbench/admin-stats');
  });

  test('shows the priority package config with unlimited window meta', async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    await mockPartialWorkspaceBackend(page, 'user', undefined, () => ({
      dailyLimit: 160000,
      hasAnyPackage: true,
      hasMemberPackage: true,
      memberPackage: {
        dailyLimit: 160000,
        packageName: '服务测试旗舰版（月卡）',
        qpsLimit: 20,
        remainingCalls: 90000,
      },
      packageQuotaPreferred: true,
      qpsLimit: 20,
      roleQuotaEnabled: true,
      roleQuotaHourLimit: 3600,
      roleQuotaMinuteLimit: 90,
      roleQuotaMonthLimit: 1728000,
    }));
    await authLogin(page);
    await page.waitForLoadState('networkidle');

    // 有可用套餐时展示套餐配置，不能再把角色配额（90/分、3,600/时）当成套餐规格。
    await expect(page.getByText('每日限额').first()).toBeVisible();
    await expect(page.getByText('160,000').first()).toBeVisible();
    await expect(page.getByText('20', { exact: true }).first()).toBeVisible();
    await expect(
      page.getByText('每分钟不限制 · 每小时不限制 · 每月不限制'),
    ).toBeVisible();
    await expect(
      page.getByText('90/分 · 3,600/时 · 1,728,000/月'),
    ).toHaveCount(0);
    await page
      .locator('.user-metric-card')
      .filter({ hasText: '每日限额' })
      .first()
      .screenshot({ path: testInfo.outputPath('user-package-preferred.png') });
  });

  test('keeps the user workspace usable when nested stats are missing', async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    const requestPaths = collectRequestPaths(page);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => {
      if (!/ResizeObserver loop/i.test(error.message)) {
        pageErrors.push(error.message);
      }
    });

    await mockPartialWorkspaceBackend(page, 'user');
    await authLogin(page);
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByText(/今日调用|Today's Calls/i).first(),
    ).toBeVisible();
    await expect(
      page.getByText(/剩余次数|Remaining Calls/i).first(),
    ).toBeVisible();
    await expect(page.getByText('2/10', { exact: true })).toHaveCount(0);
    await expect(page.locator('.user-asset-summary')).toBeVisible();
    await page
      .locator('.card-box')
      .first()
      .screenshot({ path: testInfo.outputPath('user-header-fixed.png') });
    await expect(page.getByText(/成功率|Success Rate/i).first()).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(requestPaths).toContain('/system-api/user/workbench/stats');
    expectNoSystemRequestsUnderOpenApi(requestPaths);
    expect(requestPaths).not.toContain('/api/user/workbench/stats');
  });
});

test.describe('Admin statistics readiness', () => {
  test.setTimeout(90_000);
  const callPanel = (page: import('@playwright/test').Page) =>
    page
      .locator('section.admin-panel')
      .filter({
        has: page.getByRole('heading', { name: /调用趋势|Call Trend/i }),
      });
  const revenuePanel = (page: import('@playwright/test').Page) =>
    page
      .locator('section.admin-panel')
      .filter({
        has: page.getByRole('heading', { name: /收入趋势|Revenue Trend/i }),
      });

  test('shows unknown summaries until ready and then renders genuine zeros', async ({
    page,
  }, testInfo) => {
    let stats = createDefaultAdminWorkbenchStats();
    await mockPartialWorkspaceBackend(page, 'admin', () => stats);
    await authLogin(page);
    await page.waitForLoadState('networkidle');
    await expect(callPanel(page).locator('.ant-tag')).toContainText('—');
    await expect(revenuePanel(page).locator('.ant-tag')).toHaveText('—');
    await expect(
      page.locator('.admin-access-atlas__summary strong'),
    ).toHaveText(['—', '—', '—']);
    await expect(page.locator('.atlas-list-head p')).toContainText('—');
    await expect(page.locator('.atlas-empty')).toContainText('暂不可用');
    await page
      .locator('.admin-access-atlas__head')
      .screenshot({
        path: testInfo.outputPath('admin-access-unavailable.png'),
      });
    await callPanel(page).screenshot({
      path: testInfo.outputPath('admin-call-trend-unavailable.png'),
    });
    stats = { ...createDefaultAdminWorkbenchStats(), analyticsReady: true };
    await callPanel(page)
      .getByRole('button', { name: /刷新|Refresh/i })
      .click();
    await expect(callPanel(page).locator('.ant-tag')).toContainText('0');
    await expect(callPanel(page).locator('.ant-tag')).not.toContainText('—');
    await expect(revenuePanel(page).locator('.ant-tag')).toContainText('0.00');
    await expect(
      page.locator('.admin-access-atlas__summary strong'),
    ).toHaveText(['0', '0', '0']);
    await expect(page.locator('.atlas-empty')).toContainText('暂无可展示');
  });

  test('retains last complete summaries during a degraded refresh', async ({
    page,
  }) => {
    let stats = createDefaultAdminWorkbenchStats();
    stats.analyticsReady = true;
    stats.callTrend7d.total = 17;
    stats.revenueTrend7d.totalAmount = '12.50';
    stats.accessSummary.totalCalls = 17;
    stats.accessSummary.uniqueIps = 4;
    stats.accessSummary.activeCountries = 2;
    await mockPartialWorkspaceBackend(page, 'admin', () => stats);
    await authLogin(page);
    await page.waitForLoadState('networkidle');
    await expect(callPanel(page).locator('.ant-tag')).toContainText('17');
    await expect(
      page.locator('.admin-access-atlas__summary strong'),
    ).toHaveText(['17', '2', '4']);
    stats = createDefaultAdminWorkbenchStats();
    await callPanel(page)
      .getByRole('button', { name: /刷新|Refresh/i })
      .click();
    await expect(callPanel(page).getByRole('alert')).toBeVisible();
    await expect(callPanel(page).locator('.ant-tag')).toContainText('17');
    await expect(revenuePanel(page).locator('.ant-tag')).toContainText('12.50');
    await expect(
      page.locator('.admin-access-atlas__summary strong'),
    ).toHaveText(['17', '2', '4']);
  });

  test('flags a stale call trend without replacing the last valid count and then recovers', async ({
    page,
  }, testInfo) => {
    const defaults = createDefaultAdminWorkbenchStats();
    const ready = {
      ...defaults,
      analyticsReady: true,
      callTrend7d: {
        ...defaults.callTrend7d,
        labels: ['10-10'],
        total: 1,
        totalCalls: [1],
        successCalls: [1],
        failedCalls: [0],
        billableCalls: [0],
        chargeAmounts: ['0.0000'],
      },
    };
    let stats = ready;
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => {
      if (!/ResizeObserver loop/i.test(error.message)) pageErrors.push(error.message);
    });
    await mockPartialWorkspaceBackend(page, 'admin', () => stats);
    await authLogin(page);
    await page.waitForLoadState('networkidle');
    const panel = callPanel(page);
    await expect(panel.locator('.ant-tag')).toContainText('1');
    stats = {
      ...ready,
      analyticsReady: false,
      degradedSections: ['callTrend7d'],
      callTrend7d: defaults.callTrend7d,
    };
    await panel.getByRole('button', { name: /刷新|Refresh/i }).click();
    await expect(panel.getByRole('alert')).toBeVisible();
    await expect(panel.locator('.ant-tag')).toContainText('1');
    await expect(panel.locator('.ant-tag')).not.toContainText('0');
    await panel.screenshot({ path: testInfo.outputPath('call-trend-stale-warning.png') });
    stats = {
      ...ready,
      callTrend7d: { ...ready.callTrend7d, total: 2, totalCalls: [2], failedCalls: [1] },
    };
    await panel.getByRole('button', { name: /刷新|Refresh/i }).click();
    await expect(panel.getByRole('alert')).toHaveCount(0);
    await expect(panel.locator('.ant-tag')).toContainText('2');
    await panel.screenshot({ path: testInfo.outputPath('call-trend-recovered.png') });
    expect(pageErrors).toEqual([]);
  });

  test('keeps first-load HTTP failures unknown instead of showing zero', async ({
    page,
  }) => {
    await mockPartialWorkspaceBackend(page, 'admin');
    await page.route('**/system-api/user/workbench/admin-stats**', (route) =>
      route.fulfill({
        status: 503,
        json: {
          code: 503,
          data: null,
          error: '统计测试暂不可用',
          message: '统计测试暂不可用',
        },
      }),
    );
    await authLogin(page);
    await page.waitForLoadState('networkidle');
    await expect(callPanel(page).getByRole('alert')).toBeVisible();
    await expect(callPanel(page).locator('.ant-tag')).toContainText('—');
    await expect(revenuePanel(page).locator('.ant-tag')).toHaveText('—');
    await expect(
      page.locator('.admin-access-atlas__summary strong'),
    ).toHaveText(['—', '—', '—']);
  });
});

test('renders and refreshes all three admin call trend series', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  let stats = createDefaultAdminWorkbenchStats();
  stats.analyticsReady = true;
  stats.callTrend7d = {
    labels: ['09-27', '09-28', '09-29', '09-30', '10-01', '10-02', '10-03'],
    totalCalls: [7, 12, 9, 15, 17, 10, 20],
    successCalls: [6, 10, 8, 12, 15, 9, 17],
    failedCalls: [1, 2, 1, 3, 2, 1, 3],
    billableCalls: [0, 0, 0, 0, 0, 0, 0],
    chargeAmounts: ['0', '0', '0', '0', '0', '0', '0'],
    total: 90,
  };
  const errors: string[] = [];
  page.on('pageerror', (error) => {
    if (!/ResizeObserver loop/i.test(error.message)) errors.push(error.message);
  });
  await mockPartialWorkspaceBackend(page, 'admin', () => stats);
  await authLogin(page);
  const panel = page
    .locator('section.admin-panel')
    .filter({
      has: page.getByRole('heading', { name: /调用趋势|Call Trend/i }),
    });
  await expect(panel.locator('.ant-tag')).toContainText('90');
  await expect(panel.locator('canvas')).toBeVisible();
  await expect
    .poll(() =>
      panel.locator('.admin-chart').getAttribute('_echarts_instance_'),
    )
    .toBeTruthy();
  // ECharts animates initial line drawing for one second; capture the settled chart.
  await page.waitForTimeout(1200);
  await panel.screenshot({
    path: testInfo.outputPath('admin-call-trend-fixed.png'),
  });
  stats = {
    ...stats,
    callTrend7d: {
      ...stats.callTrend7d,
      total: 97,
      totalCalls: [7, 12, 9, 15, 17, 10, 27],
      successCalls: [6, 10, 8, 12, 15, 9, 24],
    },
  };
  await panel.getByRole('button', { name: /刷新|Refresh/i }).click();
  await expect(panel.locator('.ant-tag')).toContainText('97');
  await expect(panel.locator('canvas')).toBeVisible();
  expect(errors).toEqual([]);
});


test('overview keeps independent metrics visible through repair, recovery and a partial refresh', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const defaults = createDefaultAdminWorkbenchStats();
  const unavailable = ['todayCalls', 'todaySuccessCalls', 'todayFailedCalls', 'todayBillableCalls', 'todayChargeAmount', 'todayRevenue', 'todaySuccessRate'] as const;
  let stats = { ...defaults, analyticsReady: false, degradedSections: ['overview'], overview: { ...defaults.overview,
    totalUsers: 42, todayNewUsers: 2, apiTotal: 8, apiEnabled: 6, keyTotal: 12, keyEnabled: 9,
    pendingOrders: 3, pendingFriendLinks: 4, totalRevenue: '138.25', unavailableFields: [...unavailable],
  } };
  const errors: string[] = [];
  page.on('pageerror', (error) => { if (!/ResizeObserver loop/i.test(error.message)) errors.push(error.message); });
  await mockPartialWorkspaceBackend(page, 'admin', () => stats);
  await authLogin(page);
  const overview = page.locator('.admin-overview-section');
  const card = (label: string) => overview.locator('.admin-metric-card').filter({ has: page.locator('.admin-metric-card__title', { hasText: label }) });
  await expect(card('平台用户').locator('.admin-metric-card__value')).toHaveText('42');
  await expect(card('接口总数').locator('.admin-metric-card__value')).toHaveText('8');
  await expect(card('用户密钥').locator('.admin-metric-card__value')).toHaveText('12');
  await expect(card('待支付订单').locator('.admin-metric-card__value')).toHaveText('3');
  await expect(card('待支付订单')).toContainText('友链待审 4');
  await expect(card('今日收入')).toContainText('138.25');
  await expect(card('今日调用').locator('.admin-metric-card__value')).toHaveText('—');
  await expect(page.getByTestId('admin-overview-status')).toContainText('部分指标暂不可用');
  await expect(overview.locator('.admin-refresh-status-text')).not.toContainText('更新于');
  await page.screenshot({ path: testInfo.outputPath('overview-partial-desktop.png') });
  stats = { ...stats, analyticsReady: true, degradedSections: [], overview: { ...stats.overview,
    todayCalls: 25, todaySuccessCalls: 24, todayFailedCalls: 1, todayRevenue: '3.50', todayChargeAmount: '3.50', todaySuccessRate: '96%', unavailableFields: [],
  } };
  await overview.getByRole('button', { name: /刷新|Refresh/i }).click();
  await expect(card('今日调用').locator('.admin-metric-card__value')).toHaveText('25');
  await expect(card('今日收入').locator('.admin-metric-card__value')).toContainText('3.50');
  await expect(page.getByTestId('admin-overview-status')).toHaveCount(0);
  await expect(overview.locator('.admin-refresh-status-text')).toContainText('更新于');
  await expect(overview.locator('.admin-refresh-status-text')).toContainText(/[1-9]\d*s/, { timeout: 6000 });
  stats = { ...stats, analyticsReady: false, degradedSections: ['overview'], overview: { ...stats.overview,
    totalUsers: 43, todayCalls: 0, todayRevenue: '0', unavailableFields: [...unavailable],
  } };
  await overview.getByRole('button', { name: /刷新|Refresh/i }).click();
  await expect(card('平台用户').locator('.admin-metric-card__value')).toHaveText('43');
  await expect(card('今日调用').locator('.admin-metric-card__value')).toHaveText('25');
  await expect(card('今日收入').locator('.admin-metric-card__value')).toContainText('3.50');
  await expect(page.getByTestId('admin-overview-status')).toContainText('保留上次成功值');
  await expect(overview.locator('.admin-refresh-status-text')).not.toContainText('更新于');
  await page.setViewportSize({ width: 390, height: 844 });
  await overview.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('overview-partial-mobile.png') });
  expect(errors).toEqual([]);
});


test('million counts remain complete and readable on desktop and mobile', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const defaults = createDefaultAdminWorkbenchStats();
  const stats = {
    ...defaults,
    analyticsReady: true,
    degradedSections: [],
    overview: {
      ...defaults.overview,
      todayCalls: 1_000_000,
      todaySuccessCalls: 900_000,
      todayFailedCalls: 100_000,
      todaySuccessRate: '90.00%',
      unavailableFields: [],
    },
  };
  await mockPartialWorkspaceBackend(page, 'admin', () => stats);
  await authLogin(page);
  const card = page.locator('.admin-metric-card').filter({
    has: page.locator('.admin-metric-card__title', { hasText: '今日调用' }),
  });
  const value = card.locator('.admin-metric-card__value');
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await expect(value).toHaveText('1,000,000');
    await expect.poll(() => value.evaluate((element) => {
      const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight);
      return element.getBoundingClientRect().height <= lineHeight + 1 &&
        element.scrollWidth <= element.clientWidth + 1;
    })).toBe(true);
    await card.screenshot({ path: testInfo.outputPath('million-count-' + viewport.width + '.png') });
  }
});
