import type { Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import { completePowCaptcha } from './common/captcha';

async function mockRegistrationBootstrap(page: Page) {
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
  await page.route('**/system-api/auth/register/config', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: {
        code: 0,
        data: {
          emailRegisterEnabled: true,
          emailServiceEnabled: true,
          mobileRegisterEnabled: false,
          registerEnabled: true,
        },
        error: null,
        message: 'ok',
      },
    });
  });
}

test.describe('Auth Registration Page Tests', () => {
  test('renders the registration captcha when the register scene is enabled', async ({
    page,
  }) => {
    await mockRegistrationBootstrap(page);
    await page.route('**/system-api/auth/captcha**', async (route) => {
      const url = new URL(route.request().url());
      expect(url.searchParams.get('scene')).toBe('register');
      await route.fulfill({
        contentType: 'application/json',
        json: {
          code: 0,
          data: {
            captchaId: 'captcha-register-test',
            challenge: 'abcdef0123456789',
            difficulty: 1,
            provider: 'pow',
            scene: 'register',
          },
          error: null,
          message: 'ok',
        },
      });
    });

    const captchaResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname === '/system-api/auth/captcha' &&
        url.searchParams.get('scene') === 'register'
      );
    });
    await page.goto('/auth/register', { waitUntil: 'domcontentloaded' });
    await captchaResponse;

    await expect(page.locator("input[name='username']")).toBeVisible();
    await expect(page.locator('.captcha-widget')).toBeVisible();
    await expect(
      page.locator(".captcha-widget [name='captcha-action']"),
    ).toBeVisible();
  });

  test('verifies the registration captcha before submitting its captcha id', async ({
    page,
  }) => {
    await mockRegistrationBootstrap(page);
    const captchaId = 'captcha-register-submit-test';
    let verifyPayload: Record<string, unknown> | undefined;
    let registerPayload: Record<string, unknown> | undefined;
    let registerRequests = 0;

    await page.route('**/system-api/auth/captcha**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.includes('/verify')) {
        verifyPayload = route.request().postDataJSON();
        await route.fulfill({
          contentType: 'application/json',
          json: { code: 0, data: true, error: null, message: 'ok' },
        });
        return;
      }
      expect(url.searchParams.get('scene')).toBe('register');
      await route.fulfill({
        contentType: 'application/json',
        json: {
          code: 0,
          data: {
            captchaId,
            challenge: 'register-challenge',
            difficulty: 0,
            enabled: true,
            provider: 'pow',
            scene: 'register',
          },
          error: null,
          message: 'ok',
        },
      });
    });
    await page.route('**/system-api/auth/register', async (route) => {
      registerRequests++;
      registerPayload = route.request().postDataJSON();
      await route.fulfill({
        contentType: 'application/json',
        json: {
          code: 400,
          data: null,
          error: 'TEST_STOP_AFTER_PAYLOAD_CAPTURE',
          message: 'test',
        },
        status: 400,
      });
    });

    await page.goto('/auth/register', { waitUntil: 'domcontentloaded' });
    await expect(page.locator("input[name='username']")).toBeVisible();
    await page.locator("input[name='username']").fill('captcha_user');
    await page.getByPlaceholder('请输入邮箱').fill('captcha@example.com');
    await page.locator("input[name='emailCode']").fill('123456');
    await page.locator("input[name='password']").fill('Password123!');
    await page
      .locator("input[name='confirmPassword']")
      .fill('Password123!');
    await page.getByRole('checkbox', { name: /我同意/ }).check();

    await page.getByRole('button', { name: 'register' }).click();
    await page.waitForTimeout(150);
    expect(registerRequests).toBe(0);

    const verifyRequest = page.waitForRequest((request) =>
      request.url().endsWith(`/system-api/auth/captcha/${captchaId}/verify`),
    );
    await completePowCaptcha(page, page.locator('.captcha-widget').first());
    await verifyRequest;
    await expect.poll(() => verifyPayload).toBeTruthy();

    const registerRequest = page.waitForRequest((request) =>
      request.url().endsWith('/system-api/auth/register'),
    );
    await page.getByRole('button', { name: 'register' }).click();
    await registerRequest;
    await expect.poll(() => registerPayload).toBeTruthy();
    expect(registerPayload).toMatchObject({
      captchaId,
      email: 'captcha@example.com',
      emailCode: '123456',
      username: 'captcha_user',
    });
    expect(verifyPayload).toMatchObject({ time: expect.any(String) });
  });
});
