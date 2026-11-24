import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

type LegalCopy = typeof import('../../src/locales/langs/zh-CN/legal.json');

const readLegalCopy = (locale: string): LegalCopy =>
  JSON.parse(
    readFileSync(
      new URL(
        '../../src/locales/langs/' + locale + '/legal.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
const en = readLegalCopy('en-US');
const zh = readLegalCopy('zh-CN');

const configuredRepositoryUrl =
  'https://code.example.test/enterprise/api-platform';
const legalRoutes = ['/privacy-policy', '/terms-of-service'];
const viewports = [
  { height: 844, name: 'phone', width: 390 },
  { height: 1024, name: 'tablet', width: 768 },
  { height: 900, name: 'desktop', width: 1440 },
];

test('legal pages use the configured repository and remain below the fixed header', async ({
  page,
}) => {
  test.setTimeout(90_000);

  await page.route('**/site/config', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }

    await route.fulfill({
      body: JSON.stringify({
        code: 0,
        data: {
          githubUrl: configuredRepositoryUrl,
          siteName: 'Enterprise API Platform',
        },
        message: 'ok',
      }),
      contentType: 'application/json',
      status: 200,
    });
  });

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);

    for (const route of legalRoutes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });

      const header = page.locator('.site-public-header');
      const title = page.getByTestId('legal-document-title');
      await expect(header).toBeVisible();
      await expect(title).toBeVisible();
      await expect(page.locator('.contact-fallback')).toHaveText(
        zh.common.contactFallback,
      );

      await expect
        .poll(
          async () => {
            const [headerBox, titleBox] = await Promise.all([
              header.boundingBox(),
              title.boundingBox(),
            ]);
            if (!headerBox || !titleBox) return Number.NEGATIVE_INFINITY;
            return titleBox.y - (headerBox.y + headerBox.height);
          },
          {
            message: `${viewport.name} ${route} title must not be covered by the fixed navigation`,
          },
        )
        .toBeGreaterThanOrEqual(0);

      await expect(
        page
          .locator(`.site-public-header a[href="${configuredRepositoryUrl}"]`)
          .first(),
      ).toHaveAttribute('href', configuredRepositoryUrl);
      await expect(
        page
          .locator(`.site-footer a[href="${configuredRepositoryUrl}"]`)
          .first(),
      ).toHaveAttribute('href', configuredRepositoryUrl);
      await expect(
        page.locator(`.instance-panel a[href="${configuredRepositoryUrl}"]`),
      ).toHaveAttribute('href', configuredRepositoryUrl);
      await expect(page.locator('body')).not.toContainText(
        'https://github.com/bugpk/bugpkapi',
      );

      if (route === '/terms-of-service') {
        await expect(page.locator('#terms-opensource li').nth(1)).toContainText(
          configuredRepositoryUrl,
        );
      }
    }
  }
});

// Validate rendered copy, not just the presence of locale files.
for (const locale of ['zh-CN', 'en-US'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`legal V2 copy, navigation and layout: ${locale} / ${theme}`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(120_000);
      const messages = locale === 'zh-CN' ? zh : en;
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const consoleErrors: string[] = [];
      page.on('console', (message) => {
        if (
          message.type() === 'error' &&
          !/api.iconify.design|api.simplesvg.com|api.unisvg.com/.test(
            message.location().url,
          )
        ) {
          consoleErrors.push(message.text());
        }
      });
      await page.route('**/system-api/**', async (route) => {
        const url = route.request().url();
        const data = url.includes('/site/config')
          ? {
              githubUrl: configuredRepositoryUrl,
              siteName: 'Enterprise API Platform',
              contactEmail: 'legal@example.test',
            }
          : url.includes('/donation/config')
          ? {
              enabled: 1,
              title: '',
              description: '',
              eyebrow: '',
              scanTitle: '',
              scanDescription: '',
              thanks: '',
              methods: [
                {
                  enabled: 1,
                  key: 'alipay',
                  name: 'Alipay',
                  color: '#1677ff',
                  icon: 'lucide:heart',
                  qrCodeUrl: '/favicon.ico',
                  sortNo: 1,
                  tip: '',
                },
              ],
            }
          : url.includes('/donation/supporters')
          ? { items: [], total: 0 }
          : null;
        await route.fulfill({ json: { code: 0, data, message: 'ok' } });
      });
      await page.addInitScript(
        ({ locale, theme }) => {
          const namespace = 'bugpk-api-v0.0.0-dev-dev';
          localStorage.setItem(
            namespace + '-preferences',
            JSON.stringify({
              value: {
                app: { locale },
                theme: { mode: theme },
              },
            }),
          );
          localStorage.setItem(
            namespace + '-preferences-theme',
            JSON.stringify({ value: theme }),
          );
          localStorage.setItem(namespace + '-light-theme-migrated-v1', 'true');
          localStorage.setItem('bugpk_api_home_theme', 'blue');
        },
        { locale, theme },
      );

      for (const width of [320, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        for (const kind of ['terms', 'privacy'] as const) {
          const route =
            kind === 'terms' ? '/terms-of-service' : '/privacy-policy';
          await page.goto(route, { waitUntil: 'domcontentloaded' });
          await expect(page.getByTestId('legal-document-title')).toHaveText(
            messages[kind].title,
          );
          await expect(page).toHaveURL(new RegExp(route + '$'));
          await expect(page).toHaveTitle(
            new RegExp(kind === 'terms' ? '协议|Terms' : '隐私|Privacy', 'i'),
          );
          await expect(page.locator('vite-error-overlay')).toHaveCount(0);
          if (theme === 'dark') {
            await expect(page.locator('html')).toHaveClass(/dark/);
          } else {
            await expect(page.locator('html')).not.toHaveClass(/dark/);
          }
          await expect(page.locator('.legal-meta')).toContainText('2026-10-06');
          await expect(page.locator('.legal-stamp')).toContainText('V2.0');
          await expect(page.locator('.legal-meta')).toContainText(
            messages.common.effectiveDateValue,
          );
          await expect(
            page.locator('.instance-panel a[href="mailto:legal@example.test"]'),
          ).toBeVisible();
          const sections = messages[kind].sections;
          await expect(page.locator('.legal-toc nav a')).toHaveCount(
            Object.keys(sections).length,
          );
          for (const [key, section] of Object.entries(sections)) {
            const id =
              kind +
              '-' +
              key.replace(/[A-Z]/g, (char) => '-' + char.toLowerCase());
            const target = page.locator('#' + id);
            await expect(target.locator('h2')).toHaveText(section.title);
            const items = Object.entries(section).filter(([field]) =>
              /^item\d+$/.test(field),
            );
            await expect(target.locator('li')).toHaveCount(items.length);
            for (const [, text] of items) {
              const rendered = text.replace(
                '{0}',
                key === 'opensource'
                  ? configuredRepositoryUrl
                  : 'Enterprise API Platform',
              );
              await expect(target).toContainText(rendered);
            }
          }
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth - innerWidth,
            ),
          ).toBeLessThanOrEqual(1);
          await page.screenshot({
            path: testInfo.outputPath(kind + '-' + width + '-hero.png'),
          });
          const anchor =
            kind === 'terms' ? 'terms-complaints' : 'privacy-retention';
          await page.locator('.legal-toc a[href="#' + anchor + '"]').click();
          await expect(page).toHaveURL(new RegExp('#' + anchor + '$'));
          await expect(page.locator('#' + anchor)).toBeInViewport();
          await page.screenshot({
            path: testInfo.outputPath(kind + '-' + width + '-section.png'),
          });
        }
      }
      await page
        .locator('.document-switcher a[href="/terms-of-service"]')
        .click();
      await expect(page.getByTestId('legal-document-title')).toHaveText(
        messages.terms.title,
      );
      await page.setViewportSize({ width: 320, height: 900 });
      await page.goto('/donate', { waitUntil: 'domcontentloaded' });
      const donationNotice = page.locator('.note-chip');
      await expect(donationNotice).toContainText(
        locale === 'zh-CN' ? '不等同于购买套餐' : 'not a package purchase',
      );
      await expect(donationNotice).toContainText(
        locale === 'zh-CN'
          ? '付款或备注不当然同意公开'
          : 'does not itself authorize public display',
      );
      await donationNotice.scrollIntoViewIfNeeded();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
      ).toBeLessThanOrEqual(1);
      await page.screenshot({
        path: testInfo.outputPath('donate-320-notice.png'),
      });
      expect(errors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  }
}
