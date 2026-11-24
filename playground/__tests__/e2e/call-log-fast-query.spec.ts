import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { authLogin } from './common/auth';
import { waitForAppVisible } from './common/network';

const logPath = '/console/interface/log';
async function mockLogs(page: Page, role: 'admin' | 'user', rowCount = 1) {
  const requests: URLSearchParams[] = [];
  const failures = { count: false };
  const stats = { total: 526856 };
  let releaseCount: (() => void) | undefined;
  let countGate: Promise<void> | undefined;
  await page.route('**/system-api/**', async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;
    let data: unknown = [];
    if (pathname === '/system-api/auth/refresh') {
      await route.fulfill({
        status: 401,
        json: { code: -1, data: null, message: '未登录', error: '未登录' },
      });
      return;
    }
    if (pathname === '/system-api/site/config')
      data = { siteName: 'BugPk-Api' };
    else if (pathname === '/system-api/auth/captcha')
      data = {
        captchaId: 'query-test',
        challenge: 'abcdef0123456789',
        difficulty: 1,
        provider: 'pow',
        scene: 'login',
      };
    else if (pathname.endsWith('/verify')) data = true;
    else if (pathname === '/system-api/auth/login')
      data = { accessToken: 'query-test-token' };
    else if (pathname === '/system-api/user/info')
      data = {
        avatar: '',
        homePath: logPath,
        realName: 'Query Test',
        roles: [role],
        userId: '1',
        username: role,
      };
    else if (pathname === '/system-api/auth/codes')
      data = role === 'admin' ? ['log:call:list', 'log:call:detail'] : [];
    else if (pathname === '/system-api/menu/all')
      data = [
        {
          component: '/interface/log',
          id: '1',
          meta: { title: 'system.interface.callLogTitle' },
          name: 'QueryLogs',
          path: logPath,
          pid: '0',
          status: 1,
          type: 'menu',
        },
      ];
    else if (
      /^\/system-api\/(?:interface\/call-log|user\/call-logs)\/\d+$/.test(
        pathname,
      )
    )
      data = {
        id: '1',
        traceId: 'gw_feedback_1',
        interfaceName: 'cursor-first-page',
        requestMethod: 'GET',
        responseStatus: 200,
        success: true,
        chargeType: 'FREE',
        chargeAmount: '0',
        pointPrice: 0,
      };
    else if (pathname === '/system-api/auth/register/config') data = {};
    else if (
      pathname === '/system-api/interface/call-log/list' ||
      pathname === '/system-api/user/call-logs'
    ) {
      expect(pathname).toBe(
        role === 'admin'
          ? '/system-api/interface/call-log/list'
          : '/system-api/user/call-logs',
      );
      requests.push(url.searchParams);
      const fast = url.searchParams.get('includeTotal') === 'false';
      if (!fast && failures.count) {
        await route.fulfill({
          status: 500,
          json: {
            code: 500,
            message: '服务暂时不可用',
            error_id: 'query-test-error',
          },
        });
        return;
      }
      if (!fast && countGate) await countGate;
      const second = !!url.searchParams.get('cursor');
      data = {
        items: Array.from({ length: rowCount }, (_, index) => ({
          id: String((second ? rowCount : 0) + index + 1),
          interfaceName:
            index === 0
              ? second
                ? 'cursor-second-page'
                : 'cursor-first-page'
              : 'log-fixture-' + index,
          traceId: `gw_feedback_${(second ? rowCount : 0) + index + 1}`,
          requestMethod: 'GET',
          responseStatus: 200,
          elapsedMs: 10,
          success: true,
          chargeType: 'FREE',
          chargeAmount: '0',
          pointPrice: 0,
          createTime: '2026-10-01 10:00:00',
        })),
        total: fast ? -1 : url.searchParams.get('traceId') ? 47 : stats.total,
        totalOmitted: fast,
        nextCursor: second ? '' : 'next-page',
      };
    }
    await route.fulfill({
      json: { code: 0, data, error: null, message: 'ok' },
    });
  });
  // Warm the large lazy view before timing login's redirect on a cold Vite server.
  await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
  await waitForAppVisible(page);
  await page.evaluate(async () => {
    const modulePath = '/src/views/interface/log.vue';
    await import(modulePath);
  });
  await authLogin(page, logPath);
  await expect(
    page.getByText('cursor-first-page', { exact: true }),
  ).toBeVisible();
  return {
    requests,
    failures,
    stats,
    holdCount() {
      countGate = new Promise<void>((resolve) => {
        releaseCount = resolve;
      });
    },
    releaseCount() {
      releaseCount?.();
      countGate = undefined;
    },
  };
}

for (const role of ['admin', 'user'] as const) {
  test(
    'fast log pages and exact count remain separate for ' + role,
    async ({ page }, testInfo) => {
      test.setTimeout(180_000);
      const { requests, failures, stats } = await mockLogs(page, role);
      await expect(page.getByTestId('call-log-total')).toContainText('526,856');
      await expect.poll(() => requests.length).toBe(2);
      expect(requests[0].get('includeTotal')).toBe('false');
      expect(requests[0].get('startTime')).toBeTruthy();
      expect(requests[0].get('endTime')).toBeTruthy();
      await page.getByRole('button', { name: '下一页', exact: true }).click();
      await expect(
        page.getByText('cursor-second-page', { exact: true }),
      ).toBeVisible();
      expect(
        requests
          .filter((r) => r.get('includeTotal') === 'false')[1]
          .get('cursor'),
      ).toBe('next-page');
      expect(
        requests
          .filter((r) => r.get('includeTotal') === 'false')[1]
          .has('page'),
      ).toBe(false);
      await expect(
        page.getByRole('button', { name: '下一页', exact: true }),
      ).toBeDisabled();
      await expect(page.getByTestId('call-log-total')).toContainText('526,856');
      const footer = page.locator('.fast-query-controls');
      const region = page
        .locator('.call-log-standard-grid .vxe-table--body-wrapper')
        .first();
      await expect(
        page.locator('.vxe-grid--bottom-wrapper .fast-query-controls'),
      ).toHaveCount(1);
      await expect(page.locator('.call-log-hero')).toHaveCount(0);
      await expect
        .poll(async () => {
          const footerBox = await footer.boundingBox();
          const regionBox = await region.boundingBox();
          return footerBox!.y - (regionBox!.y + regionBox!.height);
        })
        .toBeGreaterThanOrEqual(0);
      await expect(footer).toBeInViewport();
      await expect
        .poll(() => region.evaluate((el) => el.clientHeight))
        .toBeGreaterThan(80);
      await expect
        .poll(() =>
          footer.evaluate((el) => {
            const count = el.querySelector('.query-summary__value')!;
            const rect = count.getBoundingClientRect();
            const top = document.elementFromPoint(
              rect.x + 5,
              rect.y + rect.height / 2,
            );
            return !!top && el.contains(top);
          }),
        )
        .toBe(true);
      await footer.scrollIntoViewIfNeeded();
      await page
        .locator('.fast-query-controls')
        .screenshot({ path: testInfo.outputPath('exact-total.png') });
      await page.screenshot({
        path: testInfo.outputPath('exact-total-page.png'),
        fullPage: true,
      });
      expect(
        requests.filter((r) => r.get('includeTotal') === 'true').length,
      ).toBeGreaterThanOrEqual(2);
      await expect(
        page.getByText('cursor-second-page', { exact: true }),
      ).toBeVisible();
      await page.getByRole('button', { name: '上一页', exact: true }).click();
      await expect(
        page.getByText('cursor-first-page', { exact: true }),
      ).toBeVisible();
      await expect(page.getByTestId('call-log-total')).toContainText('526,856');
      failures.count = true;
      await page.getByRole('button', { name: '刷新', exact: true }).click();
      await expect(page.getByTestId('call-log-total')).toContainText(
        '总数查询未完成',
      );
      await expect(page.getByTestId('call-log-total')).not.toContainText(
        '526,856',
      );
      await expect(
        page.getByText('cursor-first-page', { exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath('fast-query.png'),
        fullPage: true,
      });
      failures.count = false;
      stats.total = 526857;
      await page.getByRole('button', { name: '重试统计', exact: true }).click();
      await expect(page.getByTestId('call-log-total')).toContainText('526,857');
      stats.total = 526858;
      await page.getByRole('button', { name: '刷新', exact: true }).click();
      await expect(page.getByTestId('call-log-total')).toContainText('526,858');
      await page.getByRole('switch', { name: '快速浏览', exact: true }).click();
      await expect(page.getByTestId('call-log-total')).toContainText('526,858');
      await expect(page.locator('.vxe-pager')).toBeVisible();
      await expect
        .poll(() => requests.at(-1)?.get('includeTotal'))
        .toBe('true');
    },
  );
}

test('count footer has distinct loading state, does not block paging, and follows the theme', async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const control = await mockLogs(page, 'user');
  control.holdCount();
  try {
    await page.getByRole('button', { name: '刷新', exact: true }).click();
    await expect(page.getByTestId('call-log-total')).toContainText('正在统计');
    await expect(
      page.getByRole('button', { name: '重试统计', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: '下一页', exact: true }),
    ).toBeEnabled();
    await page.getByRole('button', { name: '下一页', exact: true }).click();
    await expect(
      page.getByText('cursor-second-page', { exact: true }),
    ).toBeVisible();
  } finally {
    control.releaseCount();
  }
  await expect(page.getByTestId('call-log-total')).toContainText('526,856');
  await page.getByRole('button', { name: '快速浏览与精确统计说明' }).focus();
  await expect(page.getByRole('tooltip')).toContainText('31 天');
  await page.getByRole('button', { name: '下一页', exact: true }).focus();
  const footer = page.locator('.fast-query-controls');
  const grid = page.locator('.call-log-standard-grid');
  const before = await grid.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
  });
  await expect
    .poll(() => grid.evaluate((el) => getComputedStyle(el).backgroundColor))
    .not.toBe(before);
  // Assert our metric inherits the semantic token; Ant buttons own their hover/focus palette.
  await footer.evaluate((el) =>
    (el as HTMLElement).style.setProperty('--foreground', '160 70% 35%'),
  );
  await expect(footer.locator('strong')).toHaveCSS(
    'color',
    'rgb(27, 152, 110)',
  );
  await footer.evaluate((el) =>
    (el as HTMLElement).style.removeProperty('--foreground'),
  );
  for (const width of [360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await expect
      .poll(() => footer.evaluate((el) => el.scrollWidth - el.clientWidth))
      .toBeLessThanOrEqual(1);
  }
  await footer.screenshot({
    path: testInfo.outputPath('exact-total-dark.png'),
  });
});

for (const role of ['admin', 'user'] as const) {
  test(
    'log viewport retains rows with filters and count footer for ' + role,
    async ({ page }, testInfo) => {
      test.setTimeout(180_000);
      const { requests } = await mockLogs(page, role, 20);
      await expect(
        page.locator('.call-log-standard-grid .vxe-header--column').first(),
      ).toContainText('使用接口');
      await expect.poll(() => requests.length).toBe(2);
      const body = page
        .locator('.call-log-standard-grid .vxe-table--body-wrapper')
        .first();
      const footer = page.locator('.fast-query-controls');
      await expect(body).toBeVisible();
      const minimum = (page.viewportSize()?.width ?? 1280) < 768 ? 180 : 260;
      const size = () =>
        body.evaluate((el) => ({
          height: el.clientHeight,
          scroll: el.scrollHeight,
          top: el.getBoundingClientRect().top,
          bottom: el.getBoundingClientRect().bottom,
        }));
      await testInfo.attach('initial-layout', {
        body: JSON.stringify(await size()),
        contentType: 'application/json',
      });
      await page.screenshot({
        path: testInfo.outputPath('initial-list.png'),
        fullPage: false,
      });
      await expect
        .poll(async () => (await size()).height)
        .toBeGreaterThanOrEqual(minimum);
      await expect
        .poll(async () => {
          const foot = await footer.boundingBox();
          const rows = await body.boundingBox();
          return foot!.y - rows!.y - rows!.height;
        })
        .toBeGreaterThanOrEqual(0);
      await expect(footer).toBeInViewport();
      console.log(
        'LOG_VIEWPORT',
        JSON.stringify({
          role,
          viewport: page.viewportSize(),
          ...(await size()),
        }),
      );
      await testInfo.attach('ready-layout', {
        body: JSON.stringify(await size()),
        contentType: 'application/json',
      });
      await page.screenshot({
        path: testInfo.outputPath('ready-list.png'),
        fullPage: false,
      });
      const toggle = page.getByText('展开', { exact: true }).first();
      if (await toggle.isVisible()) {
        await toggle.click();
        await expect(
          page.getByText('最小耗时', { exact: false }).first(),
        ).toBeVisible();
        await expect.poll(async () => (await size()).height).toBeGreaterThan(0);
        await page.screenshot({
          path: testInfo.outputPath('filters-toggled.png'),
          fullPage: false,
        });
        await page.getByText('收起', { exact: true }).first().click();
      }
      await expect(page.getByTestId('call-log-total')).toContainText('526,856');
      await expect
        .poll(async () => (await size()).height)
        .toBeGreaterThanOrEqual(minimum);
      const area = (await body.boundingBox())!;
      await page.mouse.move(
        area.x + Math.min(80, area.width / 2),
        area.y + area.height / 2,
      );
      await page.mouse.wheel(0, 2000);
      // The name column can be horizontally offscreen; verify the actual row.
      await expect(
        body.locator('tr').filter({ hasText: 'log-fixture-19' }),
      ).toBeInViewport();
      await testInfo.attach('settled-layout', {
        body: JSON.stringify(await size()),
        contentType: 'application/json',
      });
      await page.getByRole('button', { name: '下一页', exact: true }).click();
      await expect(
        page.getByText('cursor-second-page', { exact: true }),
      ).toBeVisible();
      expect(
        requests.filter((r) => r.get('includeTotal') === 'true'),
      ).toHaveLength(2);
      await expect
        .poll(async () => (await size()).height)
        .toBeGreaterThanOrEqual(minimum);
      await page.screenshot({
        path: testInfo.outputPath('final-list.png'),
        fullPage: false,
      });
    },
  );
}

for (const role of ['admin', 'user'] as const) {
  test(
    'feedback request ID can be viewed, copied and searched for ' + role,
    async ({ page, context }, testInfo) => {
      test.setTimeout(180_000);
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const { requests } = await mockLogs(page, role);
      const cell = page.getByTestId('call-log-request-id').first();
      await expect(cell).toContainText('gw_feedback_1');
      await page.screenshot({
        path: testInfo.outputPath('request-id-list.png'),
        fullPage: true,
      });
      await cell.getByRole('button', { name: '复制请求 ID' }).click();
      await expect
        .poll(() => page.evaluate(() => navigator.clipboard.readText()))
        .toBe('gw_feedback_1');
      await page
        .getByRole('button', { name: '详情', exact: true })
        .first()
        .click();
      await expect(
        page.getByTestId('call-log-detail').getByTestId('call-log-request-id'),
      ).toContainText('gw_feedback_1');
      await expect(
        page.getByTestId('call-log-detail').getByTestId('call-log-request-id'),
      ).toBeInViewport();
      await page.screenshot({
        path: testInfo.outputPath('request-id-detail.png'),
        animations: 'disabled',
        fullPage: true,
      });
      await page
        .getByRole('button', { name: /^关\s*闭$/ })
        .last()
        .click();
      await page.getByText('展开', { exact: true }).first().click();
      await page.locator('input[name="traceId"]').fill('gw_feedback_1');
      await page.getByRole('button', { name: /^搜\s*索$/ }).click();
      await expect
        .poll(() => requests.at(-1)?.get('traceId'))
        .toBe('gw_feedback_1');
      await expect(page.getByTestId('call-log-total')).toContainText('47');
      expect(requests.at(-1)?.get('includeTotal')).toBe('true');
      expect(errors).toEqual([]);
    },
  );
}
