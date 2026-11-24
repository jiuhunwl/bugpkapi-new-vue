import type { Page } from '@playwright/test';

import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
const releases = JSON.parse(readFileSync(new URL('../../src/data/releases.json', import.meta.url), 'utf8'));

import { authLogin } from './common/auth';
import { collectRequestPaths } from './common/network';

async function mockAboutBackend(page: Page, role: 'admin' | 'user') {
  let signedIn = false;
  await page.route('**/system-api/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === '/system-api/site/admin/config') {
      await route.fulfill({
        status: 403,
        json: { code: 403, message: 'Forbidden' },
      });
      return;
    }
    if (pathname === '/system-api/auth/refresh' && signedIn) {
      await route.fulfill({
        json: { code: 0, data: 'about-test-token', error: null, message: 'ok' },
      });
      return;
    }
    if (pathname === '/system-api/auth/refresh') {
      await route.fulfill({
        status: 401,
        json: { code: -1, data: null, message: '未登录' },
      });
      return;
    }

    let data: unknown = {};
    if (pathname === '/system-api/site/config') {
      data = {
        authorName: 'Public Config Author',
        authorUrl: 'https://author.example.test',
        contactQq: '123456789',
        githubUrl: 'https://github.com/bugpk/bugpkapi',
        loadingAnimationEnabled: 0,
        siteName: 'About Regression',
      };
    } else if (pathname === '/system-api/auth/captcha') {
      data = {
        captchaId: 'about-captcha',
        challenge: 'abcdef0123456789',
        difficulty: 1,
        provider: 'pow',
        scene: 'login',
      };
    } else if (pathname === '/system-api/auth/captcha/about-captcha/verify') {
      data = true;
    } else if (pathname === '/system-api/auth/login') {
      signedIn = true;
      data = { accessToken: 'about-test-token' };
    } else if (pathname === '/system-api/user/info') {
      data = {
        avatar: '',
        desc: '',
        homePath: '/system/about',
        realName: 'About User',
        roles: [role],
        token: 'about-test-token',
        userId: '2',
        username: role,
      };
    } else if (pathname === '/system-api/auth/codes') {
      data = role === 'admin' ? ['site:config:view', 'site:config:update'] : [];
    } else if (pathname === '/system-api/menu/all') {
      data = [
        {
          component: '/system/about/index',
          id: '999',
          meta: {
            icon: 'mdi:information-outline',
            title: 'system.about.title',
          },
          name: 'SystemAbout',
          path: '/system/about',
          pid: '0',
          status: 1,
          type: 'menu',
        },
      ];
    } else if (pathname === '/system-api/notice/user/list') {
      data = { items: [], total: 0 };
    } else if (pathname === '/system-api/notice/user/popup') {
      data = [];
    }
    await route.fulfill({
      json: { code: 0, data, error: null, message: 'ok' },
    });
  });
}

for (const role of ['user', 'admin'] as const) {
  test(
    role + ' can read About using only the public site config',
    async ({ page }, testInfo) => {
      test.setTimeout(90_000);
      const paths = collectRequestPaths(page);
      const pageErrors: string[] = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await mockAboutBackend(page, role);
      await authLogin(page, '/system/about');

      await expect(page.locator('.about-page')).toBeVisible();
      await expect(
        page.getByRole('link', { name: 'Public Config Author' }),
      ).toHaveAttribute('href', 'https://author.example.test');
      await expect(page.locator('.about-page')).toContainText('123456789');
      await expect(page.locator('.ant-message-error')).toHaveCount(0);
      expect(paths).toContain('/system-api/site/config');
      expect(
        paths.filter((path) => path === '/system-api/site/admin/config'),
      ).toEqual([]);
      expect(pageErrors).toEqual([]);
      await page.screenshot({
        path: testInfo.outputPath('about-' + role + '.png'),
        fullPage: true,
      });
      await page.getByTestId('about-release-notes').click();
      await expect(page).toHaveURL(/\/system\/updates$/);
      await expect(page.getByTestId('release-entry')).toHaveCount(
        releases.length,
      );
      await expect(page.getByTestId('release-entry').first()).toContainText(
        'v' + releases[0]!.version,
      );
      await expect(page.getByTestId('release-entry').first()).toContainText(
        releases[0]!.date,
      );
      await expect(page.getByTestId('release-notes-page')).toContainText(
        String(releases.at(-1)!.date),
      );
      await page.reload();
      await expect(page.getByTestId('release-notes-page')).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath('release-notes-' + role + '.png'),
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.getByTestId('release-entry').first()).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath('release-notes-mobile-' + role + '.png'),
        fullPage: true,
      });
      await page
        .getByRole('button', { name: /返回关于系统|Back to About/ })
        .click();
      await expect(page.locator('.about-page')).toBeVisible();
      expect(pageErrors).toEqual([]);
    },
  );
}
