import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { authLogin } from './common/auth';

async function mockConsole(page: Page, personal = false) {
  const home = personal
    ? '/console/operation-logs'
    : '/console/payment/amounts';
  const state = {
    rows: [
      {
        id: '701',
        amount: '20.00',
        giftAmount: '2.00',
        sortOrder: 1,
        status: 1,
      },
    ] as Array<Record<string, unknown>>,
    saves: [] as Array<Record<string, unknown>>,
    failNext: false,
    gate: undefined as Promise<void> | undefined,
    mine: 0,
    admin: 0,
    loggedIn: false,
  };
  await page.route('**/system-api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let data: unknown = true;
    if (path === '/system-api/auth/refresh') {
      if (!state.loggedIn) {
        await route.fulfill({
          status: 401,
          json: { code: 401, data: null, error: '未登录', message: '未登录' },
        });
        return;
      }
      data = 'feedback-test-token';
    } else if (path === '/system-api/site/config')
      data = { logoUrl: '', siteName: 'BugPk-Api' };
    else if (path === '/system-api/auth/captcha')
      data = {
        captchaId: 'feedback-test',
        challenge: 'abcdef0123456789',
        difficulty: 1,
        provider: 'pow',
        scene: 'login',
      };
    else if (path === '/system-api/auth/login') {
      state.loggedIn = true;
      data = { accessToken: 'feedback-test-token' };
    } else if (path === '/system-api/auth/codes')
      data = personal
        ? []
        : [
            'payment:preset:list',
            'payment:preset:create',
            'payment:preset:update',
            'payment:preset:delete',
            'system:operation-log:list',
          ];
    else if (path === '/system-api/user/info')
      data = {
        avatar: '',
        desc: '',
        homePath: home,
        realName: 'Feedback Test',
        roles: [personal ? 'user' : 'admin'],
        userId: personal ? '2' : '1',
        username: personal ? 'alice' : 'admin',
      };
    else if (path === '/system-api/menu/all')
      data = personal
        ? []
        : [
            {
              component: '/payment/amount/index',
              id: '701',
              meta: { title: '金额配置', icon: 'lucide:banknote' },
              name: 'PaymentAmountConfig',
              path: home,
              pid: '0',
              status: 1,
              type: 'menu',
            },
          ];
    else if (
      path === '/system-api/payment/recharge/presets' &&
      request.method() === 'GET'
    )
      data = { items: state.rows, total: state.rows.length };
    else if (
      path.startsWith('/system-api/payment/recharge/presets') &&
      ['PUT', 'POST'].includes(request.method())
    ) {
      const payload = request.postDataJSON() as Record<string, unknown>;
      state.saves.push(payload);
      if (state.gate) await state.gate;
      if (state.failNext) {
        state.failNext = false;
        await route.fulfill({
          status: 400,
          json: {
            code: 400,
            data: null,
            error: '测试：保存失败，请重试',
            message: '测试：保存失败，请重试',
          },
        });
        return;
      }
      if (request.method() === 'POST')
        state.rows.push({ ...payload, id: '702' });
      else Object.assign(state.rows[0]!, payload);
    } else if (path === '/system-api/notice/user/list')
      data = { items: [], total: 0 };
    else if (path === '/system-api/notice/user/popup') data = [];
    else if (path === '/system-api/auth/register/config') data = {};
    else if (path === '/system-api/system/operation-log/mine') {
      state.mine++;
      data = {
        items: [
          {
            id: '1',
            userId: '2',
            username: 'alice',
            module: 'auth',
            action: 'login',
            summary: '登录成功',
            status: true,
            statusCode: 200,
            elapsedMs: 1,
            createdAt: '2026-10-03 02:00:00',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      };
    } else if (path.includes('/system/operation-log/')) {
      state.admin++;
      data = { items: [], total: 0 };
    }
    await route.fulfill({
      json: { code: 0, data, error: null, message: 'ok' },
    });
  });
  return { home, state };
}
async function screenshot(page: Page, name: string) {
  if (process.env.FEEDBACK_SCREENSHOT_DIR)
    await page.screenshot({
      path: process.env.FEEDBACK_SCREENSHOT_DIR + '/' + name + '.png',
      fullPage: true,
    });
}

test('amount save shows progress, one failure, preserves input, then refreshes credited amount on retry', async ({
  page,
}) => {
  const { home, state } = await mockConsole(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await authLogin(page, home);
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const confirm = dialog.getByRole('button', { name: /确\s*认/ });
  await dialog.locator('input[name="giftAmount"]').fill('5.00');
  let release!: () => void;
  state.gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  state.failNext = true;
  await confirm.click();
  await expect(confirm.locator('.anticon-loading')).toBeVisible();
  await expect(dialog.getByRole('button', { name: /取\s*消/ })).toBeDisabled();
  expect(state.saves).toHaveLength(1);
  await screenshot(page, 'amount-saving');
  release();
  state.gate = undefined;
  await expect(
    page.getByText('测试：保存失败，请重试', { exact: true }),
  ).toHaveCount(1);
  await expect(dialog.locator('input[name="giftAmount"]')).toHaveValue('5.00');
  await expect(confirm.locator('.anticon-loading')).toHaveCount(0);
  await screenshot(page, 'amount-save-failed');
  await confirm.click();
  await expect(page.getByText('充值金额保存成功', { exact: true })).toHaveCount(
    1,
  );
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText('¥25.00', { exact: true })).toBeVisible();
  expect(state.saves).toHaveLength(2);
  expect(errors).toEqual([]);
  await screenshot(page, 'amount-save-success');
});

test('amount creation reports success and updates the list', async ({
  page,
}) => {
  const { home, state } = await mockConsole(page);
  await authLogin(page, home);
  await page.getByRole('button', { name: '新增金额', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[name="amount"]').fill('12.00');
  await dialog.locator('input[name="giftAmount"]').fill('2.00');
  await dialog.getByRole('button', { name: /确\s*认/ }).click();
  await expect(page.getByText('充值金额添加成功', { exact: true })).toHaveCount(
    1,
  );
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText('¥14.00', { exact: true })).toBeVisible();
  expect(state.rows).toHaveLength(2);
});

test('ordinary user can open personal logs without requesting system logs or statistics', async ({
  page,
}) => {
  const { home, state } = await mockConsole(page, true);
  await authLogin(page, home);
  await expect(page.getByText('alice', { exact: true })).toBeVisible();
  await expect(
    page.getByText('仅显示您本人的登录及控制台重要操作', { exact: false }),
  ).toBeVisible();
  expect(state.mine).toBeGreaterThan(0);
  expect(state.admin).toBe(0);
  await expect(page.getByPlaceholder('搜索用户名')).toHaveCount(0);
  await expect
    .poll(() =>
      page
        .locator('.operation-log__panel')
        .evaluate(
          (element) =>
            element.getBoundingClientRect().right <= window.innerWidth,
        ),
    )
    .toBe(true);
  await screenshot(page, 'personal-operation-log');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page
        .locator('.operation-log__panel')
        .evaluate(
          (element) =>
            element.getBoundingClientRect().right <= window.innerWidth,
        ),
    )
    .toBe(true);
  await screenshot(page, 'personal-operation-log-mobile');
});
