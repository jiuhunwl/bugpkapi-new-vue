import type { Locator, Page } from '@playwright/test';

import { Buffer } from 'node:buffer';

import { expect, test } from '@playwright/test';

import type { DonationApi } from '#/api/donation';

import { authLogin } from './common/auth';
import {
  collectRequestPaths,
  expectNoSystemRequestsUnderOpenApi,
  waitForAppVisible,
} from './common/network';

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

function field(scope: Locator, label: string) {
  return scope
    .locator('.ant-form-item')
    .filter({ hasText: label })
    .locator('input, textarea')
    .first();
}

function collectBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    const sourceUrl = message.location().url;
    if (
      sourceUrl.includes('/system-api/auth/refresh') &&
      text.includes('401')
    ) {
      return;
    }
    const knownIconHosts = [
      'api.iconify.design',
      'api.simplesvg.com',
      'api.unisvg.com',
    ];
    const isKnownIconRequest = knownIconHosts.some(
      (host) => sourceUrl.includes(host) || text.includes(host),
    );
    if (
      isKnownIconRequest &&
      /ERR_(?:CONNECTION_RESET|INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|NETWORK_ACCESS_DENIED)/.test(
        text,
      )
    ) {
      return;
    }
    errors.push(sourceUrl ? `${text} (${sourceUrl})` : text);
  });
  page.on('pageerror', (error) => errors.push(error.stack || error.message));
  return errors;
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe('Donation settings', () => {
  test('publishes an uploaded QR code and invalidates the public cache', async ({
    context,
    page,
  }, testInfo) => {
    testInfo.setTimeout(120_000);
    const requestPaths = collectRequestPaths(page);
    const browserErrors = collectBrowserErrors(page);
    const serverErrors: string[] = [];
    page.on('response', (response) => {
      if (response.status() >= 500) serverErrors.push(response.url());
    });

    await authLogin(page);
    await page.goto('/content/donation', { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: '赞赏设置' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/404|Not Found/i);

    const copySection = page.locator('.donation-copy-section');
    const titleA = `E2E 赞赏支持 ${Date.now()}`;
    const titleB = `${titleA} 已更新`;
    await field(copySection, '短标题').fill('E2E 赞赏');
    await field(copySection, '页面标题').fill(titleA);
    await field(copySection, '页面说明').fill(
      '浏览器端到端测试发布的赞赏说明。',
    );
    await field(copySection, '扫码区标题').fill('选择赞赏渠道');
    await field(copySection, '扫码区说明').fill('请使用测试渠道扫码。');
    await field(copySection, '感谢文案').fill('感谢支持 BugPk-Api。');

    await page.getByRole('button', { name: '新增赞赏渠道' }).click();
    const method = page.locator('.method-item').first();
    await expect(method).toBeVisible();
    await field(method, '渠道标识').fill('e2e-channel');
    await field(method, '渠道名称').fill('E2E 测试渠道');
    await field(method, '渠道图标').fill('lucide:heart-handshake');
    await field(method, '扫码提示').fill('打开测试客户端扫一扫');

    const uploadResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        response.request().method() === 'POST' &&
        url.pathname === '/system-api/upload/donation-qr'
      );
    });
    await method.locator('input[type="file"]').setInputFiles({
      buffer: tinyPng,
      mimeType: 'image/png',
      name: 'e2e-donation.png',
    });
    expect((await uploadResponse).ok()).toBe(true);
    await expect(page.getByText('收款码上传成功')).toBeVisible();
    await expect(field(method, '收款码地址')).toHaveValue(
      /^\/system-api\/upload\/donation-qr\/[a-f0-9]+\.png$/,
    );

    await method.locator('.method-order [role="switch"]').click();
    await copySection.locator('.publish-switch [role="switch"]').click();

    const saveButton = page
      .locator('.page-actions')
      .getByRole('button', { name: '保存设置' });
    const firstSave = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        response.request().method() === 'PUT' &&
        url.pathname === '/system-api/donation/admin/config'
      );
    });
    await saveButton.click();
    expect((await firstSave).ok()).toBe(true);
    await expect(page.getByText('赞赏设置保存成功')).toBeVisible();

    const publicPage = await context.newPage();
    const publicErrors = collectBrowserErrors(publicPage);
    const publicServerErrors: string[] = [];
    publicPage.on('response', (response) => {
      if (response.status() >= 500) publicServerErrors.push(response.url());
    });
    await publicPage.goto('/donate', { waitUntil: 'networkidle' });
    await expect(
      publicPage.getByRole('heading', { name: titleA }),
    ).toBeVisible();
    await expect(publicPage.getByText('E2E 测试渠道')).toBeVisible();
    await expect(
      publicPage.getByRole('img', { name: 'E2E 测试渠道收款码' }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(publicPage);
    const singleMethodAlignment = await publicPage.evaluate(() => {
      const shell = document.querySelector('.donate-card');
      const method = document.querySelector('.donate-method');
      if (!shell || !method) return null;
      const shellBox = shell.getBoundingClientRect();
      const methodBox = method.getBoundingClientRect();
      return {
        methodCenter: methodBox.left + methodBox.width / 2,
        shellCenter: shellBox.left + shellBox.width / 2,
      };
    });
    expect(singleMethodAlignment).not.toBeNull();
    expect(
      Math.abs(
        singleMethodAlignment!.methodCenter -
          singleMethodAlignment!.shellCenter,
      ),
    ).toBeLessThan(2);

    await publicPage
      .getByRole('button', { name: '放大查看E2E 测试渠道收款码' })
      .click();
    await expect(
      publicPage.getByRole('dialog', { name: '查看E2E 测试渠道收款码' }),
    ).toBeVisible();
    await publicPage.getByRole('button', { name: '关闭' }).click();

    await field(copySection, '页面标题').fill(titleB);
    const secondSave = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        response.request().method() === 'PUT' &&
        url.pathname === '/system-api/donation/admin/config'
      );
    });
    await saveButton.click();
    expect((await secondSave).ok()).toBe(true);
    await publicPage.reload({ waitUntil: 'networkidle' });
    await expect(
      publicPage.getByRole('heading', { name: titleB }),
    ).toBeVisible();

    await publicPage.screenshot({
      fullPage: true,
      path: testInfo.outputPath('donation-public-desktop.png'),
    });
    await page.setViewportSize({ height: 844, width: 390 });
    await expect(page.getByRole('heading', { name: '赞赏设置' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: '保存设置' }).first(),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: testInfo.outputPath('donation-admin-mobile.png'),
    });
    expect(browserErrors).toEqual([]);
    expect(publicErrors).toEqual([]);
    expect(serverErrors).toEqual([]);
    expect(publicServerErrors).toEqual([]);
    expectNoSystemRequestsUnderOpenApi(requestPaths);
    await publicPage.close();
  });

  test('creates a supporter in admin and displays it publicly', async ({
    context,
    page,
  }) => {
    test.setTimeout(90_000);
    const browserErrors = collectBrowserErrors(page);
    let createdSupporter: null | DonationApi.Supporter = null;
    let submittedPayload: DonationApi.CreateSupporterPayload | null = null;

    await context.route(
      'https://assets.example.test/supporter.png',
      async (route) => {
        await route.fulfill({
          body: tinyPng,
          contentType: 'image/png',
          status: 200,
        });
      },
    );
    await context.route(
      '**/system-api/donation/admin/supporters*',
      async (route) => {
        const request = route.request();
        if (request.method() === 'POST') {
          submittedPayload =
            request.postDataJSON() as DonationApi.CreateSupporterPayload;
          createdSupporter = {
            ...submittedPayload,
            amount: '66.60',
            createTime: '2026-08-10 12:01:00',
            creatorName: 'admin',
            id: 'supporter-admin-e2e',
          };
          await route.fulfill({
            contentType: 'application/json',
            json: { code: 0, data: createdSupporter, message: 'ok' },
            status: 200,
          });
          return;
        }
        await route.fulfill({
          contentType: 'application/json',
          json: {
            code: 0,
            data: {
              items: createdSupporter ? [createdSupporter] : [],
              total: createdSupporter ? 1 : 0,
            },
            message: 'ok',
          },
          status: 200,
        });
      },
    );
    await context.route(
      '**/system-api/donation/admin/config',
      async (route) => {
        await route.fulfill({
          contentType: 'application/json',
          json: {
            code: 0,
            data: {
              description: '赞赏人端到端测试',
              enabled: 1,
              eyebrow: '赞赏',
              methods: [],
              scanDescription: '测试赞赏渠道',
              scanTitle: '扫码赞赏',
              thanks: '感谢支持',
              title: '赞赏支持',
              updateTime: '2026-08-10 12:00:00',
            },
            message: 'ok',
          },
          status: 200,
        });
      },
    );
    await context.route('**/system-api/donation/config', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          code: 0,
          data: {
            description: '赞赏人端到端测试',
            enabled: 1,
            eyebrow: '赞赏',
            methods: [],
            scanDescription: '测试赞赏渠道',
            scanTitle: '扫码赞赏',
            thanks: '感谢支持',
            title: '赞赏支持',
          },
          message: 'ok',
        },
        status: 200,
      });
    });
    await context.route(
      '**/system-api/donation/supporters?*',
      async (route) => {
        await route.fulfill({
          contentType: 'application/json',
          json: {
            code: 0,
            data: {
              items: createdSupporter ? [createdSupporter] : [],
              total: createdSupporter ? 1 : 0,
            },
            message: 'ok',
          },
          status: 200,
        });
      },
    );

    await authLogin(page);
    await page.goto('/content/donation', { waitUntil: 'networkidle' });
    await expect(page.getByText('赞赏人管理')).toBeVisible();
    await page.getByRole('button', { name: '新增赞赏人' }).click();

    const dialog = page.getByRole('dialog', { name: '新增赞赏人' });
    await expect(dialog).toBeVisible();
    await dialog.getByTestId('supporter-nickname').fill('E2E 赞赏人');
    await dialog
      .getByTestId('supporter-avatar-url')
      .fill('https://assets.example.test/supporter.png');
    await dialog.getByTestId('supporter-amount').fill('66.6');
    await dialog.getByTestId('supporter-message').fill('感谢持续维护项目');

    const createResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        response.request().method() === 'POST' &&
        url.pathname === '/system-api/donation/admin/supporters'
      );
    });
    await dialog.getByRole('button', { name: '确认添加' }).click();
    expect((await createResponse).ok()).toBe(true);
    await expect(page.getByText('赞赏人添加成功')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'E2E 赞赏人' })).toBeVisible();
    await expect(page.getByRole('cell', { name: '¥66.60' })).toBeVisible();
    expect(submittedPayload).toMatchObject({
      amount: '66.60',
      avatarUrl: 'https://assets.example.test/supporter.png',
      message: '感谢持续维护项目',
      nickname: 'E2E 赞赏人',
    });

    const publicPage = await context.newPage();
    const publicErrors = collectBrowserErrors(publicPage);
    await publicPage.goto('/donate', { waitUntil: 'networkidle' });
    await waitForAppVisible(publicPage);
    const publicSupporter = publicPage.getByTestId(
      'supporter-supporter-admin-e2e',
    );
    await expect(publicSupporter).toBeVisible();
    await expect(publicSupporter.getByText('E2E 赞赏人')).toBeVisible();
    await expect(publicSupporter.getByText('¥66.60')).toBeVisible();
    await expect(publicSupporter.getByText('感谢持续维护项目')).toBeVisible();
    await expect(
      publicSupporter.getByRole('img', { name: 'E2E 赞赏人 的头像' }),
    ).toBeVisible();
    expect(browserErrors).toEqual([]);
    expect(publicErrors).toEqual([]);
    await publicPage.close();
  });

  test('renders every public state and remains usable on mobile', async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(90_000);
    const browserErrors = collectBrowserErrors(page);
    let mode: 'disabled' | 'empty' | 'error' | 'loading' | 'normal' = 'loading';
    let releaseLoading: (() => void) | undefined;
    const loadingGate = new Promise<void>((resolve) => {
      releaseLoading = resolve;
    });

    await page.route('**/system-api/donation/config', async (route) => {
      if (mode === 'loading') await loadingGate;
      if (mode === 'error') {
        await route.fulfill({
          contentType: 'application/json',
          json: { code: 503, data: null, message: 'temporary unavailable' },
          status: 503,
        });
        return;
      }

      const methods =
        mode === 'normal'
          ? [
              {
                color: '#1677ff',
                enabled: 1,
                icon: 'lucide:heart',
                key: 'mobile-one',
                name: '移动渠道一',
                qrCodeUrl: `data:image/png;base64,${tinyPng.toString('base64')}`,
                sortNo: 10,
                tip: '扫一扫渠道一',
              },
              {
                color: '#16a34a',
                enabled: 1,
                icon: 'lucide:scan-line',
                key: 'mobile-two',
                name: '移动渠道二',
                qrCodeUrl: `data:image/png;base64,${tinyPng.toString('base64')}`,
                sortNo: 20,
                tip: '扫一扫渠道二',
              },
            ]
          : [];
      await route.fulfill({
        contentType: 'application/json',
        json: {
          code: 0,
          data: {
            description: '公开状态端到端测试。',
            enabled: mode === 'disabled' ? 0 : 1,
            eyebrow: '赞赏',
            methods,
            scanDescription: '选择一个测试渠道。',
            scanTitle: '扫码赞赏',
            thanks: '感谢支持。',
            title: '赞赏状态测试',
          },
          message: 'ok',
        },
        status: 200,
      });
    });

    await page.route('**/system-api/donation/supporters?*', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          code: 0,
          data: {
            items: [
              {
                amount: '12.50',
                avatarUrl: '',
                donatedAt: '2026-08-09 08:30:00',
                id: 'supporter-mobile-1',
                message: '感谢持续维护项目',
                nickname: 'E2E 赞赏人',
              },
            ],
            total: 1,
          },
          message: 'ok',
        },
        status: 200,
      });
    });

    await page.goto('/donate', { waitUntil: 'domcontentloaded' });
    await waitForAppVisible(page);
    await expect(page.getByText('正在加载', { exact: true })).toBeVisible();
    mode = 'disabled';
    releaseLoading?.();
    await expect(page.getByText('赞赏暂未开放')).toBeVisible();

    mode = 'error';
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByText('加载失败', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '重新加载' })).toBeVisible();
    browserErrors.length = 0;

    mode = 'empty';
    await page.getByRole('button', { name: '重新加载' }).click();
    await expect(page.getByText('暂无可用渠道')).toBeVisible();

    mode = 'normal';
    await page.setViewportSize({ height: 844, width: 390 });
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByText('移动渠道一')).toBeVisible();
    await expect(page.getByText('移动渠道二')).toBeVisible();
    await expect(page.getByText('E2E 赞赏人')).toBeVisible();
    await expect(page.getByText('¥12.50')).toBeVisible();
    await expect(page.getByText('感谢持续维护项目')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const methodBoxes = await page
      .locator('.donate-method')
      .evaluateAll((elements) =>
        elements.map((element) => {
          const box = element.getBoundingClientRect();
          return { left: box.left, top: box.top };
        }),
      );
    expect(methodBoxes).toHaveLength(2);
    expect(Math.abs(methodBoxes[0]!.left - methodBoxes[1]!.left)).toBeLessThan(
      2,
    );
    expect(methodBoxes[1]!.top).toBeGreaterThan(methodBoxes[0]!.top);

    await page
      .getByRole('button', { name: '放大查看移动渠道一收款码' })
      .click();
    await expect(
      page.getByRole('dialog', { name: '查看移动渠道一收款码' }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath('donation-public-mobile.png'),
    });

    expect(browserErrors).toEqual([]);
  });
});
