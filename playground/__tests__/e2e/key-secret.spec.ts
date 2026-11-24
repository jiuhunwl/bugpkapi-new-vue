import type { Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import { authLogin } from './common/auth';

interface CreatedKeyPayload {
  id?: string;
  secretKey?: string;
}

async function findAccessToken(page: Page) {
  if (page.isClosed()) {
    return '';
  }
  return page.evaluate(() => {
    function visit(value: unknown): string {
      if (!value || typeof value !== 'object') {
        return '';
      }
      if (
        'accessToken' in value &&
        typeof (value as { accessToken?: unknown }).accessToken === 'string'
      ) {
        return (value as { accessToken: string }).accessToken;
      }
      for (const child of Object.values(value as Record<string, unknown>)) {
        const found = visit(child);
        if (found) {
          return found;
        }
      }
      return '';
    }

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key) {
        continue;
      }
      const raw = localStorage.getItem(key);
      if (!raw) {
        continue;
      }
      try {
        const found = visit(JSON.parse(raw));
        if (found) {
          return found;
        }
      } catch {
        // Non-JSON localStorage entries are irrelevant for auth cleanup.
      }
    }
    return '';
  });
}

async function deleteKeyIfPossible(
  page: Page,
  accessToken: string,
  id?: string,
) {
  if (!id || !accessToken) {
    return;
  }
  await page.evaluate(
    async ({ keyId, accessToken }) => {
      await fetch(`/system-api/key/${keyId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        method: 'DELETE',
      }).catch(() => undefined);
    },
    { accessToken, keyId: id },
  );
}

test.describe('API Key Secret Display', () => {
  test('reveals and hides a created secret after the dialog is closed', async ({ page }) => {
    let createdKey: CreatedKeyPayload = {};
    const keyName = `e2e-key-${Date.now()}`;

    const accessToken = await authLogin(page);
    expect(await findAccessToken(page)).toBe('');
    await page.goto('/key/list', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/密钥列表|Key/i).first()).toBeVisible();

    try {
      const createResponse = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname === '/system-api/key',
      );

      await page.getByRole('button', { name: /新增密钥|Create/i }).click();
      const drawer = page.getByRole('dialog', { name: /新增密钥|Create/i });
      await expect(drawer).toBeVisible();
      await drawer
        .locator("input[name='name']")
        .fill(keyName);
      await drawer.getByText(/全站接口|Global/i).click();
      await drawer
        .getByRole('button', { name: /确\s*定|确\s*认|OK|Confirm/i })
        .last()
        .click();

      const rawCreateResponse = await (await createResponse).json();
      createdKey = rawCreateResponse?.data ?? {};
      const secretKey = String(createdKey.secretKey ?? '');

      expect(secretKey).toMatch(/^bp_live_[A-Za-z0-9_-]{16,}$/);
      expect(secretKey).not.toContain('*');

      const secretDialog = page.getByRole('dialog').filter({
        hasText: /密钥创建成功|Secret|Key/i,
      });
      await expect(secretDialog).toBeVisible();
      await expect(secretDialog.locator('textarea')).toHaveValue(secretKey);
      await expect(secretDialog).toContainText(/加密保存|stored encrypted/i);

      await secretDialog
        .getByRole('button', { name: /关\s*闭|Close|Cancel/i })
        .click();
      await expect(secretDialog).toBeHidden();

      await expect(page.locator('body')).not.toContainText(secretKey);
      const keyRow = page.locator('.vxe-body--row').filter({ hasText: keyName });
      await expect(keyRow).toBeVisible();
      await expect(keyRow).toContainText(/\*{3,}/);

      await keyRow.getByRole('button', { name: /显示|Show/i }).click();
      await expect(keyRow).toContainText(secretKey);

      await keyRow.getByRole('button', { name: /隐藏|Hide/i }).click();
      await expect(keyRow).not.toContainText(secretKey);
      await expect(keyRow).toContainText(/\*{3,}/);
    } finally {
      await deleteKeyIfPossible(page, accessToken, createdKey.id);
    }
  });
});
