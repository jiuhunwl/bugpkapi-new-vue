import { expect, test } from '@playwright/test';

import { authLogin } from './common/auth';

async function mockLoginBootstrap(
  page: import('@playwright/test').Page,
  captcha: Record<string, unknown> = {
    captchaId: 'captcha-login-test',
    challenge: 'abcdef0123456789',
    difficulty: 1,
    provider: 'pow',
    scene: 'login',
  },
) {
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
        data: captcha,
        error: null,
        message: 'ok',
      },
    });
  });
}

test.describe('Auth Login Page Tests', () => {
  test('shows the login page for BugPk-Api', async ({ page }) => {
    const captchaResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname === '/system-api/auth/captcha' &&
        url.searchParams.get('scene') === 'login'
      );
    });

    await page.goto('/auth/login');
    await captchaResponse;

    await expect(page).toHaveTitle(/BugPk-Api/);
    await expect(page.locator("input[name='username']")).toBeVisible();
    await expect(page.locator("input[name='password']")).toBeVisible();
    await expect(page.locator("div[name='captcha']")).toBeVisible();
  });

  test('logs in with valid credentials through system-api only', async ({
    page,
  }) => {
    const requests: string[] = [];
    page.on('request', (request) => {
      requests.push(request.url());
    });

    await authLogin(page);

    const forbiddenSystemRoutes = requests.filter((url) => {
      const { pathname } = new URL(url);
      return /^\/api\/(auth|user|system|payment|notice|site|friend-links|menu|key|package|dashboard|interface)(\/|$)/.test(
        pathname,
      );
    });

    expect(forbiddenSystemRoutes).toEqual([]);
    expect(
      requests.some(
        (url) => new URL(url).pathname === '/system-api/auth/login',
      ),
    ).toBe(true);
    expect(
      requests.some((url) => new URL(url).pathname === '/system-api/menu/all'),
    ).toBe(true);
  });

  test('does not expose the unimplemented QQ sign-in flow', async ({
    page,
  }) => {
    const requestPaths: string[] = [];
    page.on('request', (request) => {
      requestPaths.push(new URL(request.url()).pathname);
    });
    await mockLoginBootstrap(page);
    await page.goto('/auth/login');

    await expect(page.locator('.qq-login-button')).toHaveCount(0);
    expect(requestPaths).not.toContain('/system-api/auth/qq/config');
    expect(requestPaths).not.toContain('/system-api/auth/qq/login');
  });

  test('shows the built-in slider when no third-party provider is enabled', async ({
    page,
  }) => {
    const captchaResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname === '/system-api/auth/captcha' &&
        url.searchParams.get('scene') === 'login'
      );
    });
    await mockLoginBootstrap(page, {
      captchaId: 'captcha-login-default',
      challenge: 'abcdef0123456789',
      difficulty: 1,
      provider: 'pow',
      scene: 'login',
    });

    await page.goto('/auth/login');
    await captchaResponse;

    await expect(page.locator("div[name='captcha']")).toBeVisible();
    await expect(page.locator("div[name='captcha-action']")).toBeVisible();
  });
});
