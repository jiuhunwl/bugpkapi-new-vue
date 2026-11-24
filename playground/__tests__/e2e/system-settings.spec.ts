import { expect, test } from '@playwright/test';

import { authLogin } from './common/auth';
import {
  collectRequestPaths,
  expectNoSystemRequestsUnderOpenApi,
} from './common/network';

const enabledSettingsPages = [
  {
    path: '/system/register',
    text: /是否开放注册|Open Registration/i,
  },
  {
    path: '/system/register/email',
    text: /SMTP服务器|SMTP Server/i,
  },
];

const disabledSettingsPaths = [
  '/system/register/mobile',
  '/system/login/quick',
];

test.describe('System Settings Routes', () => {
  test('renders registration and login setting pages without falling through to blank routes', async ({
    page,
  }) => {
    const requestPaths = collectRequestPaths(page);

    await authLogin(page);

    for (const item of enabledSettingsPages) {
      await page.goto(item.path, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(new RegExp(`${item.path}(?:\\?|$)`));
      await expect(page.locator('body')).toContainText(item.text);
      await expect(page.locator('body')).not.toContainText(/404|Not Found/i);
    }

    for (const path of disabledSettingsPaths) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(new RegExp(`${path}(?:\\?|$)`));
      await expect(page.locator('body')).toContainText(
        /未找到页面|无法找到您要找的页面|Not Found/i,
      );
    }

    expectNoSystemRequestsUnderOpenApi(requestPaths);
  });
});
