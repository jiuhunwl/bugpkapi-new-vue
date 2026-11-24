import type { Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

interface FriendLinkOptions {
  applyEnabled?: 0 | 1;
  applyNotice?: string;
  captchaEnabled?: boolean;
  links?: Array<{
    description: string;
    id: string;
    logoUrl: string;
    siteName: string;
    siteUrl: string;
  }>;
  signedIn?: boolean;
  submitted?: boolean;
}

const defaultLinks = [
  {
    description: 'A real partner description.',
    id: '1',
    logoUrl: '/missing-partner-logo.svg',
    siteName: 'Partner One',
    siteUrl: 'https://partner.example.com/docs',
    status: 1,
  },
  {
    description: 'Another real partner.',
    id: '2',
    logoUrl: '',
    siteName: 'Partner Two',
    siteUrl: 'https://second.example.com',
    status: 1,
  },
];

async function mockFriendLinks(page: Page, options: FriendLinkOptions = {}) {
  const {
    applyEnabled = 1,
    applyNotice = 'Please add our link before applying.',
    captchaEnabled = false,
    links = defaultLinks,
    signedIn = false,
    submitted = false,
  } = options;

  await page.addInitScript(
    ({ signedIn: shouldSignIn }) => {
      if (shouldSignIn) {
        localStorage.setItem('bugpk:auth-session-active', '1');
      }
    },
    { signedIn },
  );

  let applyRequests = 0;
  const payloads: unknown[] = [];

  await page.route('**/system-api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;

    if (pathname === '/system-api/site/config') {
      await route.fulfill({
        json: {
          code: 0,
          data: {
            description: 'Public API platform',
            logoUrl: '',
            siteName: 'BugPk API',
            slogan: 'Public API platform',
          },
          message: 'ok',
        },
      });
      return;
    }
    if (pathname === '/system-api/site/custom-code') {
      await route.fulfill({
        json: { code: 0, data: { enabled: 0 }, message: 'ok' },
      });
      return;
    }
    if (pathname === '/system-api/auth/refresh') {
      await route.fulfill({
        json: { code: 0, data: 'friend-links-token', message: 'ok' },
      });
      return;
    }
    if (pathname === '/system-api/friend-links/public/list') {
      await route.fulfill({
        json: {
          code: 0,
          data: { items: links, total: links.length },
          message: 'ok',
        },
      });
      return;
    }
    if (pathname === '/system-api/friend-links/public/meta') {
      await route.fulfill({
        json: {
          code: 0,
          data: {
            config: { applyEnabled, applyNotice },
            siteInfo: {
              description: 'Configured site description',
              logoUrl: '',
              siteName: 'BugPk API',
              siteUrl: 'https://bugpk.example.com',
            },
          },
          message: 'ok',
        },
      });
      return;
    }
    if (pathname === '/system-api/friend-links/apply/status') {
      await route.fulfill({
        json: {
          code: 0,
          data: { status: submitted ? 'PENDING' : undefined, submitted },
          message: 'ok',
        },
      });
      return;
    }
    if (pathname === '/system-api/auth/captcha') {
      await route.fulfill({
        json: {
          code: 0,
          data: {
            captchaId: 'friend-links-captcha',
            challenge: 'abcdef0123456789',
            difficulty: 1,
            enabled: captchaEnabled,
            provider: 'pow',
            scene: 'friend_link_apply',
          },
          message: 'ok',
        },
      });
      return;
    }
    if (pathname === '/system-api/auth/captcha/friend-links-captcha/verify') {
      await route.fulfill({
        json: { code: 0, data: true, message: 'ok' },
      });
      return;
    }
    if (pathname === '/system-api/friend-links/apply') {
      applyRequests += 1;
      payloads.push(request.postDataJSON());
      await route.fulfill({
        json: { code: 0, data: true, message: 'ok' },
      });
      return;
    }

    await route.fulfill({ json: { code: 0, data: [], message: 'ok' } });
  });

  return {
    getApplyRequests: () => applyRequests,
    getPayloads: () => payloads,
  };
}

async function openSignedInApplyPanel(page: Page, options?: FriendLinkOptions) {
  await mockFriendLinks(page, { ...options, signedIn: true });
  await page.goto('/links');
  await expect(page.getByTestId('friend-link-apply')).toBeVisible();
  await page.getByTestId('friend-link-apply').click();
  await expect(page.locator('[data-apply-mode]')).toBeVisible();
}

test('friend-link application switches from desktop dialog to mobile sheet without losing form state', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openSignedInApplyPanel(page);

  await expect(page.locator('[data-apply-mode="dialog"]')).toBeVisible();
  await page.getByTestId('friend-link-form-site-name').fill('Persisted Site');
  const originalInput = await page
    .getByTestId('friend-link-form-site-name')
    .elementHandle();

  await page.setViewportSize({ width: 390, height: 780 });
  await expect(page.locator('[data-apply-mode="sheet"]')).toBeVisible();
  await expect(page.getByTestId('friend-link-form-site-name')).toHaveValue(
    'Persisted Site',
  );
  expect(await originalInput!.evaluate((input) => input.isConnected)).toBe(
    true,
  );
  await originalInput!.dispose();
});

test('friend-link application closes with Escape, restores focus and unlocks body scroll', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await openSignedInApplyPanel(page);
  const trigger = page.getByTestId('friend-link-apply');

  await expect(page.locator('[data-apply-mode="sheet"]')).toBeVisible();
  const close = page.locator('.apply-panel-close');
  await expect(close).toBeFocused();
  await expect(page.getByTestId('friend-link-submit')).toBeEnabled();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByTestId('friend-link-submit')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-apply-mode="sheet"] :focus')).toBeVisible();
  await page.keyboard.press('Escape');

  await expect(page.locator('[data-apply-mode]')).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect
    .poll(() => page.evaluate(() => document.body.style.overflow))
    .toBe('');
});

test('friend-link directory renders real links, logo fallback and only configured application notice', async ({
  page,
}) => {
  await mockFriendLinks(page, { applyNotice: '' });
  await page.goto('/links');

  const directory = page.getByTestId('friend-link-directory');
  await expect(directory).toBeVisible();
  await expect(directory.locator('[data-friend-link]')).toHaveCount(2);
  await expect(directory).toContainText('Partner One');
  await expect(directory.locator('a').first()).toHaveAttribute(
    'href',
    'https://partner.example.com/docs',
  );

  // The real failed image request already triggers the fallback; do not wait
  // for the image that Vue has correctly removed from the DOM.
  await expect(
    directory
      .locator('[data-friend-link]')
      .first()
      .locator('[data-logo-fallback]'),
  ).toHaveText('P');
  await expect(directory.locator('img')).toHaveCount(0);
  await expect(directory.locator('a').first()).toHaveAttribute(
    'rel',
    'noopener noreferrer',
  );
  await expect(page.getByTestId('friend-link-apply-notice')).toHaveCount(0);
});

test('friend-link application redirects unauthenticated visitors with the current route', async ({
  page,
}) => {
  await mockFriendLinks(page);
  await page.goto('/links?from=partners#directory');
  await page.getByTestId('friend-link-apply').click();

  await expect(page).toHaveURL(/\/auth\/login\?redirect=/);
  expect(new URL(page.url()).searchParams.get('redirect')).toBe(
    '%2Flinks%3Ffrom%3Dpartners%23directory',
  );
});

test('friend-link application refuses a duplicate pending submission', async ({
  page,
}) => {
  const requests = await mockFriendLinks(page, {
    signedIn: true,
    submitted: true,
  });
  await page.goto('/links');
  await expect(page.getByTestId('friend-link-apply')).toContainText(
    /已提交|submitted/i,
  );
  await page.getByTestId('friend-link-apply').click();
  await expect(page.locator('[data-apply-mode]')).toHaveCount(0);
  expect(requests.getApplyRequests()).toBe(0);
  await expect(page.getByTestId('friend-link-apply')).toContainText(
    /已提交|submitted/i,
  );
});

test('friend-link application keeps submit disabled until captcha verification', async ({
  page,
}) => {
  const requests = await mockFriendLinks(page, {
    captchaEnabled: true,
    signedIn: true,
  });
  await page.goto('/links');
  await page.getByTestId('friend-link-apply').click();

  await page.getByTestId('friend-link-form-site-name').fill('Captcha Site');
  await page
    .getByTestId('friend-link-form-site-url')
    .fill('https://captcha.example.com');
  await page
    .getByTestId('friend-link-form-email')
    .fill('owner@captcha.example.com');
  const submit = page.getByTestId('friend-link-submit');
  await expect(submit).toBeDisabled();
  expect(requests.getApplyRequests()).toBe(0);
});

test('friend-link page has no root horizontal overflow at 320px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 820 });
  await mockFriendLinks(page);
  await page.goto('/links');
  await expect(page.getByTestId('friend-link-directory')).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1);
});

test('friend-link application preserves every existing payload field and prevents a second submission', async ({
  page,
}) => {
  const requests = await mockFriendLinks(page, { signedIn: true });
  await page.goto('/links');
  await page.getByTestId('friend-link-apply').click();
  await page
    .getByTestId('friend-link-form-site-name')
    .fill('  Applicant Site  ');
  await page
    .getByTestId('friend-link-form-site-url')
    .fill('  https://applicant.example  ');
  await page
    .getByTestId('friend-link-form-email')
    .fill('owner@applicant.example');
  await page.getByLabel(/联系人|Contact Name/i).fill('  Site Owner  ');
  await page.getByLabel(/联系 QQ|QQ.*Contact/i).fill('  @site-owner  ');
  await page
    .getByLabel(/网站 Logo|Site Logo/i)
    .fill('  https://applicant.example/logo.svg  ');
  await page
    .getByLabel(/网站描述|Site Description/i)
    .fill('  A developer resource.  ');
  await page
    .getByLabel(/已放置我方链接的页面|Backlink Page/i)
    .fill('  https://applicant.example/links  ');
  await page.getByTestId('friend-link-submit').click();

  await expect(page.locator('[data-apply-mode]')).toHaveCount(0);
  expect(requests.getPayloads()).toEqual([
    {
      backlinkUrl: 'https://applicant.example/links',
      captchaId: 'friend-links-captcha',
      contactEmail: 'owner@applicant.example',
      contactName: 'Site Owner',
      contactQq: '@site-owner',
      description: 'A developer resource.',
      language: 'zh',
      logoUrl: 'https://applicant.example/logo.svg',
      siteName: 'Applicant Site',
      siteUrl: 'https://applicant.example',
    },
  ]);
  await page.getByTestId('friend-link-apply').click();
  await expect(page.locator('[data-apply-mode]')).toHaveCount(0);
  expect(requests.getApplyRequests()).toBe(1);
});

test('friend-link application respects the administrator application switch', async ({
  page,
}) => {
  const requests = await mockFriendLinks(page, {
    applyEnabled: 0,
    signedIn: true,
  });
  await page.goto('/links');
  await expect(page.getByTestId('friend-link-apply')).toContainText(
    /暂未开放|closed/i,
  );
  await page.getByTestId('friend-link-apply').click();
  await expect(page.locator('[data-apply-mode]')).toHaveCount(0);
  expect(requests.getApplyRequests()).toBe(0);
});

for (const colorScheme of ['light', 'dark'] as const) {
  for (const width of [320, 768, 1440]) {
    test(
      'friend-link directory and application remain usable at ' +
        width +
        'px in ' +
        colorScheme,
      async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme });
        await page.addInitScript((mode) => {
          const namespace = 'bugpk-api-v0.0.0-dev-dev';
          localStorage.setItem(namespace + '-light-theme-migrated-v1', 'true');
          localStorage.setItem(
            namespace + '-preferences',
            JSON.stringify({
              value: { app: { locale: 'zh-CN' }, theme: { mode } },
            }),
          );
          localStorage.setItem(
            namespace + '-preferences-theme',
            JSON.stringify({ value: mode }),
          );
          document.documentElement.classList.toggle('dark', mode === 'dark');
        }, colorScheme);
        await mockFriendLinks(page, { signedIn: true });
        await page.goto('/links');
        const directory = page.getByTestId('friend-link-directory');
        await expect(directory.locator('[data-friend-link]')).toHaveCount(2);
        await page.screenshot({
          path: testInfo.outputPath('directory.png'),
          fullPage: true,
        });

        const content = await page.locator('.public-site-main').boundingBox();
        const list = await directory.boundingBox();
        expect(content).not.toBeNull();
        expect(list).not.toBeNull();
        expect(Math.abs(list!.x - content!.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(list!.width - content!.width)).toBeLessThanOrEqual(1);
        expect(
          await page
            .locator('.apply-strip')
            .evaluate((el) => el.scrollWidth - el.clientWidth),
        ).toBeLessThanOrEqual(1);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth - innerWidth,
          ),
        ).toBeLessThanOrEqual(1);

        await page.getByTestId('friend-link-apply').click();
        const panel = page.getByRole('dialog');
        await expect(panel).toHaveAttribute(
          'data-apply-mode',
          width < 900 ? 'sheet' : 'dialog',
        );
        await expect(page.getByTestId('friend-link-submit')).toBeEnabled();
        await page.screenshot({
          path: testInfo.outputPath('application.png'),
          fullPage: true,
        });
        const bounds = await panel.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(901);
        for (const selector of [
          '.apply-panel-close',
          '.apply-panel-cancel',
          '.apply-panel-submit',
          '.apply-form-grid input',
        ]) {
          const box = await panel.locator(selector).first().boundingBox();
          expect(box!.height).toBeGreaterThanOrEqual(44);
        }
        const background = await panel.evaluate(
          (el) => getComputedStyle(el).backgroundColor,
        );
        const rgb = background.match(/[\d.]+/g)!.map(Number);
        expect(rgb[3] ?? 1).toBeGreaterThanOrEqual(0.9);
        expect(rgb[0]! < 80).toBe(colorScheme === 'dark');
      },
    );
  }
}

test('friend-link application validates required fields and email before sending a request', async ({
  page,
}) => {
  const requests = await mockFriendLinks(page, { signedIn: true });
  await page.goto('/links');
  await page.getByTestId('friend-link-apply').click();
  const submit = page.getByTestId('friend-link-submit');
  await submit.click();
  await expect(page.getByText('请填写网站名称', { exact: true })).toBeVisible();
  await page.getByTestId('friend-link-form-site-name').fill('Validation Site');
  await submit.click();
  await expect(page.getByText('请填写网站地址', { exact: true })).toBeVisible();
  await page
    .getByTestId('friend-link-form-site-url')
    .fill('https://validation.example');
  await submit.click();
  await expect(page.getByText('请填写联系邮箱', { exact: true })).toBeVisible();
  await page.getByTestId('friend-link-form-email').fill('not-an-email');
  await submit.click();
  await expect(
    page.getByText('请填写有效的联系邮箱', { exact: true }),
  ).toBeVisible();
  expect(requests.getApplyRequests()).toBe(0);
});

test('friend-link application preserves the draft after a server failure and can retry', async ({
  page,
}) => {
  const requests = await mockFriendLinks(page, { signedIn: true });
  await page.route(
    '**/system-api/friend-links/apply',
    async (route) => {
      await route.fulfill({
        status: 503,
        json: {
          code: 503,
          message: 'Application temporarily unavailable',
          data: null,
        },
      });
    },
    { times: 1 },
  );
  await page.goto('/links');
  await page.getByTestId('friend-link-apply').click();
  await page.getByTestId('friend-link-form-site-name').fill('Retry Site');
  await page
    .getByTestId('friend-link-form-site-url')
    .fill('https://retry.example');
  await page.getByTestId('friend-link-form-email').fill('owner@retry.example');
  const failedRequest = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/system-api/friend-links/apply' &&
      response.status() === 503,
  );
  await page.getByTestId('friend-link-submit').click();
  await failedRequest;
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByTestId('friend-link-form-site-name')).toHaveValue(
    'Retry Site',
  );
  await expect(page.getByTestId('friend-link-submit')).toBeEnabled();
  await page.getByTestId('friend-link-submit').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(requests.getPayloads()).toEqual([
    expect.objectContaining({
      siteName: 'Retry Site',
      captchaId: 'friend-links-captcha',
    }),
  ]);
});

test('friend-link application recovers from captcha loading failure without losing the draft', async ({
  page,
}) => {
  await mockFriendLinks(page, { signedIn: true });
  await page.route(
    '**/system-api/auth/captcha?scene=friend_link_apply',
    async (route) => {
      await route.fulfill({
        status: 503,
        json: {
          code: 503,
          message: 'Captcha temporarily unavailable',
          data: null,
        },
      });
    },
    { times: 1 },
  );
  await page.goto('/links');
  await page.getByTestId('friend-link-apply').click();
  await page
    .getByTestId('friend-link-form-site-name')
    .fill('Captcha Retry Site');
  await expect(page.getByTestId('friend-link-submit')).toBeDisabled();
  await expect(
    page.getByText('验证码加载失败，请重试', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '重新加载', exact: true }).click();
  await expect(page.getByTestId('friend-link-submit')).toBeEnabled();
  await expect(page.getByTestId('friend-link-form-site-name')).toHaveValue(
    'Captcha Retry Site',
  );
});
