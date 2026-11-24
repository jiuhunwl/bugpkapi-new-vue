import { expect, test } from '@playwright/test';

test('preopened external window is detached from its opener', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });

  const popupPromise = page.waitForEvent('popup');
  const opened = await page.evaluate(async () => {
    const modulePath = '/src/utils/safe-window.ts';
    const { preopenDetachedWindow } = await import(
      /* @vite-ignore */ modulePath
    );
    return Boolean(preopenDetachedWindow());
  });

  expect(opened).toBe(true);
  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded');
  expect(await popup.evaluate(() => window.opener === null)).toBe(true);
  await popup.close();
});
