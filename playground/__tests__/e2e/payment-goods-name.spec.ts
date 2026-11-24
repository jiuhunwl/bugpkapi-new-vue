import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { authLogin } from './common/auth';

const DEFAULT_GOODS_NAME = 'API 开放平台技术服务费';

interface CurrencyPayload {
  currency: string;
  goodsName?: string;
  usdCnyRate?: string;
}

async function setup(page: Page) {
  const state = {
    currency: {
      currency: 'CNY',
      goodsName: DEFAULT_GOODS_NAME,
      usdCnyRate: '7.2000',
    } as CurrencyPayload,
    currencySaves: [] as CurrencyPayload[],
  };

  await page.route('**/system-api/**', async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    let data: unknown = true;

    if (pathname === '/system-api/auth/refresh') {
      await route.fulfill({
        json: { code: -1, data: null, error: '未登录', message: '未登录' },
        status: 401,
      });
      return;
    }
    if (pathname === '/system-api/auth/captcha') {
      data = {
        captchaId: 'payment-goods-name-captcha',
        challenge: 'abcdef0123456789',
        difficulty: 1,
        provider: 'pow',
        scene: 'login',
      };
    } else if (pathname === '/system-api/auth/login') {
      data = { accessToken: 'payment-goods-name-test-token' };
    } else if (pathname === '/system-api/user/info') {
      data = {
        avatar: '',
        desc: '',
        homePath: '/console/payment/config',
        realName: 'Payment Admin',
        roles: ['admin'],
        userId: '1',
        username: 'admin',
      };
    } else if (pathname === '/system-api/site/config') {
      data = { logoUrl: '', siteName: 'BugPk-Api' };
    } else if (pathname === '/system-api/auth/codes') {
      data = ['payment:config:view', 'payment:config:update'];
    } else if (pathname === '/system-api/menu/all') {
      data = [
        {
          component: '/payment/config',
          id: '901',
          meta: { icon: 'mdi:credit-card-settings-outline', title: '支付配置' },
          name: 'PaymentConfig',
          path: '/console/payment/config',
          pid: '0',
          status: 1,
          type: 'menu',
        },
      ];
    } else if (pathname === '/system-api/payment/currency/config') {
      if (request.method() === 'PUT') {
        const body = request.postDataJSON() as CurrencyPayload;
        state.currencySaves.push(body);
        state.currency = body;
        data = true;
      } else {
        data = state.currency;
      }
    } else if (pathname === '/system-api/payment/methods') {
      data = [
        { code: 'ALIPAY', enabled: true, sortOrder: 1 },
        { code: 'WECHAT', enabled: true, sortOrder: 2 },
      ];
    } else if (pathname === '/system-api/payment/alipay/config') {
      data = { enabled: 0, mode: 'SANDBOX', notifyUrl: '', returnUrl: '' };
    } else if (pathname === '/system-api/payment/wechat/config') {
      data = { enabled: 0, mode: 'SANDBOX' };
    } else if (pathname === '/system-api/payment/hupijiao/config') {
      data = { alipay: {}, wechat: {} };
    } else if (pathname === '/system-api/system/role/options') {
      data = [];
    } else if (pathname === '/system-api/payment/sponsor/config') {
      data = { enabled: false, roleId: 0, roleName: '' };
    } else if (pathname === '/system-api/payment/trc20/config') {
      data = {
        address: '',
        apiKeyConfigured: false,
        confirmations: 1,
        enabled: false,
        maxAmount: '10000',
        minAmount: '5',
      };
    } else if (pathname === '/system-api/notice/user/list') {
      data = { items: [], total: 0 };
    } else if (pathname === '/system-api/notice/user/popup') {
      data = [];
    }

    await route.fulfill({ json: { code: 0, data, message: 'ok' } });
  });

  await authLogin(page, '/console/payment/config');
  return state;
}

async function openCurrencyTab(page: Page) {
  await page.getByRole('tab', { name: '货币设置' }).click();
  const card = page
    .locator('.payment-config-card')
    .filter({ hasText: '站点结算货币' });
  await expect(card).toBeVisible();
  return card;
}

function goodsNameInput(page: Page) {
  return page.getByPlaceholder('如：API 开放平台技术服务费');
}

async function settleNotices(page: Page) {
  await expect(page.locator('.ant-notification-notice')).toHaveCount(0, {
    timeout: 15_000,
  });
}

test.describe('Payment goods name', () => {
  test.setTimeout(120_000);

  test('shows the configured goods name and fits a phone screen', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ height: 900, width: 1_280 });
    await setup(page);
    const card = await openCurrencyTab(page);

    await expect(goodsNameInput(page)).toHaveValue(DEFAULT_GOODS_NAME);
    await expect(page.getByText('支付商品名', { exact: true })).toBeVisible();
    await expect(
      card.getByText('留空则沿用订单明细名', { exact: false }),
    ).toBeVisible();
    await expect(goodsNameInput(page)).toBeEnabled();

    await settleNotices(page);
    await page.screenshot({
      path: testInfo.outputPath('payment-goods-name-desktop.png'),
      fullPage: false,
    });

    const input = goodsNameInput(page);
    await page.setViewportSize({ height: 900, width: 390 });
    await expect(input).toBeVisible();
    // 窄屏下输入框与帮助文案都不能把卡片撑出横向滚动。
    await expect
      .poll(() =>
        card.evaluate((el) => el.scrollWidth - el.clientWidth),
      )
      .toBeLessThanOrEqual(1);
    await expect
      .poll(() => input.evaluate((el) => el.getBoundingClientRect().width))
      .toBeGreaterThan(200);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ),
      )
      .toBeLessThanOrEqual(1);
    const bleed = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      return [...document.querySelectorAll('*')]
        .filter(
          (el) =>
            el.getBoundingClientRect().right > width + 1 &&
            // AntD 把溢出的页签放在屏幕外备用容器里，不属于布局溢出。
            !el.closest('.ant-tabs-nav'),
        )
        .slice(0, 5)
        .map((el) => `${el.tagName}.${el.className}`.slice(0, 120));
    });
    expect(bleed, `越界元素: ${bleed.join(' | ')}`).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath('payment-goods-name-mobile-full.png'),
      fullPage: false,
    });
  });

  test('rejects names over 127 bytes and saves the configured name', async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width: 1_280 });
    const backend = await setup(page);
    await openCurrencyTab(page);

    const input = goodsNameInput(page);
    await input.fill('测'.repeat(43));
    await page.getByRole('button', { name: '保存货币设置' }).click();
    await expect(
      page.getByText('支付商品名过长（上限 127 字节，约 42 个汉字）'),
    ).toBeVisible();
    expect(backend.currencySaves).toEqual([]);

    // 42 个汉字正好 126 字节，仍在渠道上限内。
    await input.fill('服'.repeat(42));
    await page.getByRole('button', { name: '保存货币设置' }).click();
    await expect
      .poll(() => backend.currencySaves.length)
      .toBe(1);
    expect(backend.currencySaves[0]).toEqual({
      currency: 'CNY',
      goodsName: '服'.repeat(42),
    });

    await input.fill(DEFAULT_GOODS_NAME);
    await page.getByRole('button', { name: '保存货币设置' }).click();
    await expect.poll(() => backend.currencySaves.length).toBe(2);
    expect(backend.currencySaves[1]).toEqual({
      currency: 'CNY',
      goodsName: DEFAULT_GOODS_NAME,
    });
    await expect(page.getByText('货币设置已更新').first()).toBeVisible();
  });

  test('renders the currency card in dark mode', async ({ page }, testInfo) => {
    await page.setViewportSize({ height: 900, width: 1_280 });
    // 走应用自己的主题偏好：只加 html.dark 不会切换 AntD 的暗色算法。
    await page.addInitScript((namespace) => {
      localStorage.setItem(`${namespace}-light-theme-migrated-v1`, 'true');
      localStorage.setItem(
        `${namespace}-preferences`,
        JSON.stringify({ value: { theme: { mode: 'dark' } } }),
      );
      localStorage.setItem(
        `${namespace}-preferences-theme`,
        JSON.stringify({ value: 'dark' }),
      );
    }, 'bugpk-api-v0.0.0-dev-dev');
    await setup(page);
    const card = await openCurrencyTab(page);
    await expect(goodsNameInput(page)).toHaveValue(DEFAULT_GOODS_NAME);

    const background = await card.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    const [r = 0, g = 0, b = 0] = (background.match(/\d+/g) ?? []).map(Number);
    expect(
      0.2126 * r + 0.7152 * g + 0.0722 * b,
      `卡片应随主题转暗，实际 ${background}`,
    ).toBeLessThan(120);

    await settleNotices(page);
    await card.screenshot({
      path: testInfo.outputPath('payment-goods-name-dark.png'),
    });
  });
});
