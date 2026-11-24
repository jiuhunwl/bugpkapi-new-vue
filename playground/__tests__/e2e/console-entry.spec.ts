import { expect, test } from '@playwright/test';

import { authLogin } from './common/auth';

test.describe('Console Entry', () => {
  test('opens the workspace layout instead of rendering the public home at /workspace', async ({
    page,
  }) => {
    await authLogin(page);

    await expect(page).toHaveURL(/\/console\/workspace(?:\?|$)/);
    await expect(page.locator('.site-public-header')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText(
      /稳定提供 API 服务网站|Stable API service/i,
    );

    await page.goto('/');
    await expect(page.locator('.site-public-header')).toBeVisible();

    await page.getByTestId('console-entry').click();

    await expect(page).toHaveURL(/\/console\/workspace(?:\?|$)/);
    await expect(page.locator('.site-public-header')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText(
      /稳定提供 API 服务网站|Stable API service/i,
    );
  });
});
