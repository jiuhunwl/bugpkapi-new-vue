import { expect, test } from '@playwright/test';

test('/apis preserves query and hash while redirecting to /apilist', async ({
  page,
}) => {
  await page.goto('/apis?keyword=weather#results');
  await expect(page).toHaveURL(/\/apilist\?keyword=weather#results$/);
});

test('public unknown paths render the public 404 and noindex', async ({
  page,
}) => {
  await page.goto('/missing-public-page');
  await expect(page.locator('[data-testid="public-not-found"]')).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'noindex, nofollow',
  );
});

test('unknown console paths do not render the public 404', async ({ page }) => {
  await page.goto('/console/missing-route');
  await expect(page.locator('[data-testid="public-not-found"]')).toHaveCount(0);
});

test('public 404 actions meet the minimum touch target size', async ({ page }) => {
  await page.goto('/missing-public-page');
  await expect(
    page.locator('[data-testid="public-not-found"] .ps-not-found__action'),
  ).toHaveCount(3);
  const heights = await page.locator('[data-testid="public-not-found"] .ps-not-found__action').evaluateAll(
    (elements) => elements.map((element) => element.getBoundingClientRect().height),
  );
  expect(heights.length).toBe(3);
  expect(heights.every((height) => height >= 44)).toBe(true);
});
