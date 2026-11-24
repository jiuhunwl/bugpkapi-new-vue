import { expect, test } from '@playwright/test';

import { completePowCaptcha } from './common/captcha';

test('verifies password_reset captcha before sending the email code', async ({
  page,
}) => {
  const captchaId = 'captcha-password-reset-test';
  const requestOrder: string[] = [];
  let verifyPayload: Record<string, unknown> | undefined;
  let sendCodePayload: Record<string, unknown> | undefined;

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
  await page.route(
    '**/system-api/auth/password-reset/account',
    async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          code: 0,
          data: { maskedEmail: 'ca***@example.com' },
          error: null,
          message: 'ok',
        },
      });
    },
  );
  await page.route('**/system-api/auth/captcha**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.includes('/verify')) {
      requestOrder.push('verify');
      verifyPayload = route.request().postDataJSON();
      await route.fulfill({
        contentType: 'application/json',
        json: { code: 0, data: true, error: null, message: 'ok' },
      });
      return;
    }
    expect(url.searchParams.get('scene')).toBe('password_reset');
    await route.fulfill({
      contentType: 'application/json',
      json: {
        code: 0,
        data: {
          captchaId,
          challenge: 'password-reset-challenge',
          difficulty: 0,
          enabled: true,
          provider: 'pow',
          scene: 'password_reset',
        },
        error: null,
        message: 'ok',
      },
    });
  });
  await page.route(
    '**/system-api/auth/password-reset/email-code',
    async (route) => {
      requestOrder.push('send');
      sendCodePayload = route.request().postDataJSON();
      await route.fulfill({
        contentType: 'application/json',
        json: { code: 0, data: true, error: null, message: 'ok' },
      });
    },
  );

  await page.goto('/auth/forget-password', { waitUntil: 'domcontentloaded' });
  await page.locator("input[name='account']").fill('captcha_user');
  await page.locator("button[aria-label='submit']").click();
  await expect(page.locator('.reset-email-card__button')).toBeVisible();

  await page.locator('.reset-email-card__button').click();
  const captcha = page.locator('.ant-modal .captcha-widget');
  await expect(captcha).toBeVisible();
  expect(sendCodePayload).toBeUndefined();

  await completePowCaptcha(page, captcha);
  await expect.poll(() => verifyPayload).toBeTruthy();
  await expect.poll(() => sendCodePayload).toBeTruthy();

  expect(requestOrder).toEqual(['verify', 'send']);
  expect(verifyPayload).toMatchObject({ time: expect.any(String) });
  expect(sendCodePayload).toEqual({
    account: 'captcha_user',
    captchaId,
  });
});
