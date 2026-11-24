import type { Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import { waitForAppVisible } from './common/network';

/**
 * 找回密码页「登录」按钮导航回归测试。
 *
 * 背景 Bug：认证容器 form.vue 中 Transition(out-in) + KeepAlive(:include=['Login'])
 * 的组合，在从 ForgetPassword 切回已缓存的 Login 时 enter 过渡不触发，
 * 内容滞留 slide-right-enter-from（opacity: 0）导致表单区域白屏。
 * 修复：移除 KeepAlive 缓存。本测试验证切换后登录表单 opacity 恢复为 1（无白屏）。
 */
async function mockAuthBootstrap(page: Page) {
  await page.route('**/system-api/site/config', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: {
        code: 0,
        data: { siteName: 'BugPk-Api' },
        error: null,
        message: 'ok',
      },
    });
  });
  await page.route('**/system-api/auth/captcha**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: {
        code: 0,
        data: {
          captchaId: 'captcha-login-test',
          challenge: 'abcdef0123456789',
          difficulty: 1,
          provider: 'pow',
          scene: 'login',
        },
        error: null,
        message: 'ok',
      },
    });
  });
}

/** 断言登录页表单完全可见且无白屏（opacity 过渡结束后必须为 1）。 */
async function expectLoginFormFullyVisible(page: Page) {
  await expect(page).toHaveURL(/\/auth\/login$/);
  await expect(page.locator("input[name='username']")).toBeVisible();
  await expect(page.locator("input[name='password']")).toBeVisible();
  // 白屏判定：修复前组件会停留在 opacity: 0；这里强制等待过渡完成并恢复为 1。
  await page.waitForFunction(
    () => {
      const el = document.querySelector("input[name='username']");
      return !!el && window.getComputedStyle(el).opacity === '1';
    },
    { timeout: 10_000 },
  );
}

/** 从登录页进入找回密码页，并点击「登录」按钮返回。 */
async function goToForgetPasswordAndBack(page: Page) {
  // 登录页 -> 找回密码页
  await page.getByText('忘记密码?', { exact: true }).click();
  await expect(page).toHaveURL(/\/auth\/forget-password/);
  await expect(page.locator("input[name='account']")).toBeVisible();

  // 按钮应为「登录」（原「返回」）
  const loginButton = page.getByRole('button', { name: '登录', exact: true });
  await expect(loginButton).toBeVisible();

  // 找回密码页 -> 登录页（关键：验证无白屏）
  await loginButton.click();
  await expectLoginFormFullyVisible(page);
}

test.describe('Forget Password -> Login Navigation', () => {
  test('「登录」按钮返回登录页且无白屏（往返稳定）', async ({ page }) => {
    await mockAuthBootstrap(page);

    // 首次访问登录页（Login 组件挂载，修复前会被 KeepAlive 缓存）
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
    await waitForAppVisible(page);
    await expect(page.locator("input[name='username']")).toBeVisible();

    // 往返 3 次，确保切换稳定无白屏
    for (let i = 0; i < 3; i++) {
      await goToForgetPasswordAndBack(page);
    }
  });
});
