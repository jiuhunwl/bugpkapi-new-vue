import { expect, test } from '@playwright/test';

test.describe('Public site shell', () => {
  test('mobile navigation traps focus, closes with Escape and restores focus', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await page.goto('/');

    await page.evaluate(() => {
      document.body.style.overflow = 'scroll';
    });

    const trigger = page.getByRole('button', {
      name: /打开站点导航|open site navigation/i,
    });
    await trigger.click();

    await expect(
      page.locator('[data-testid="public-mobile-nav"]'),
    ).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(
      page.locator('[data-testid="public-mobile-nav"] :focus'),
    ).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(
      page.locator('[data-testid="public-mobile-nav"]'),
    ).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect
      .poll(() => page.evaluate(() => document.body.style.overflow))
      .toBe('scroll');
  });

  test('public root marker is removed on a client-side route transition', async ({
    page,
  }) => {
    await page.goto('/');
    await page.evaluate(() => {
      (window as Window & { __publicShellSpaSentinel?: string }).__publicShellSpaSentinel =
        'same-document';
    });
    await expect(page.locator('html')).toHaveAttribute(
      'data-public-site',
      'active',
    );

    const loginLink = page.locator('.site-actions .login-link');
    await expect(loginLink).toBeVisible();
    await loginLink.click();
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.locator('html')).not.toHaveAttribute('data-public-site');
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as Window & { __publicShellSpaSentinel?: string })
              .__publicShellSpaSentinel,
        ),
      )
      .toBe('same-document');
  });

  test('public shell exposes one main landmark', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main')).toHaveCount(1);
  });

  test('dark preference sets the prepaint background before Vue starts', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.route('**/src/main.ts**', (route) => route.abort());
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const backgrounds = await page.evaluate(() =>
      ['html', 'body', '#app'].map((selector) =>
        window.getComputedStyle(document.querySelector(selector)!).backgroundColor,
      ),
    );
    expect(backgrounds).toEqual([
      'rgb(7, 11, 22)',
      'rgb(7, 11, 22)',
      'rgb(7, 11, 22)',
    ]);
  });
});
