import { expect, test } from '@playwright/test';

import { authLogin } from './common/auth';

test.describe('Captcha scene settings', () => {
  test('persists a scene checkbox without replacing provider configuration', async ({
    page,
  }) => {
    await authLogin(page);
    await page.goto('/system/captcha-config', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('body')).toContainText('启用验证码的场景');
    const checkboxes = page.getByRole('checkbox');
    await expect(checkboxes).toHaveCount(7);

    const loginScene = page.getByRole('checkbox', { name: /账号登录/ });
    await expect(loginScene).toBeChecked();

    const saveRequest = page.waitForRequest(
      (request) =>
        request.method() === 'PUT' &&
        new URL(request.url()).pathname ===
          '/system-api/system/captcha-config/scenes',
    );
    const saveResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        new URL(response.url()).pathname ===
          '/system-api/system/captcha-config/scenes',
    );
    await loginScene.uncheck();
    await page.getByRole('button', { name: '保存场景启用范围' }).click();

    const requestBody = JSON.parse((await saveRequest).postData() || '{}');
    expect(requestBody.scenes).toEqual(
      expect.arrayContaining([
        'default',
        'register',
        'register_email',
        'register_mobile',
        'password_reset',
        'change_password',
      ]),
    );
    expect(requestBody.scenes).not.toContain('login');
    expect((await saveResponse).ok()).toBe(true);

    const disabledChallenge = await page.request.get(
      '/system-api/auth/captcha?scene=login',
    );
    const disabledBody = await disabledChallenge.json();
    expect(disabledBody?.code).toBe(0);
    expect(disabledBody?.data?.enabled).toBe(false);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('checkbox', { name: /账号登录/ })).not.toBeChecked();

    const restoreRequest = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        new URL(response.url()).pathname ===
          '/system-api/system/captcha-config/scenes',
    );
    await page.getByRole('checkbox', { name: /账号登录/ }).check();
    await page.getByRole('button', { name: '保存场景启用范围' }).click();
    expect((await restoreRequest).ok()).toBe(true);
  });
});
