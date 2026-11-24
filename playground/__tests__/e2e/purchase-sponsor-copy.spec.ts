import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { authLogin } from './common/auth';

const TIERS = [
  { dailyLimit: 6_000, id: '11', name: '服务测试基础版（月卡）', price: '9.9000', qpsLimit: 5, ticket: '标准工单 48 小时内响应' },
  { dailyLimit: 20_000, id: '12', name: '服务测试标准版（月卡）', price: '29.9000', qpsLimit: 10, ticket: '优先工单 24 小时内响应' },
  { dailyLimit: 50_000, id: '13', name: '服务测试专业版（月卡）', price: '59.0000', qpsLimit: 15, ticket: '优先工单 12 小时内响应' },
  { dailyLimit: 160_000, id: '14', name: '服务测试旗舰版（月卡）', price: '149.0000', qpsLimit: 20, ticket: '专属工单 8 小时内响应' },
].map((tier) => ({
  ...tier,
  remark: `赞助兑换服务：本档为对本站技术与服务运营的自愿赞助支持，不构成解析次数或内容授权；回馈内容为服务器/带宽成本分摊、并发保障 ${tier.qpsLimit} QPS、${tier.ticket}，以及每日 ${tier.dailyLimit.toLocaleString()} 次服务测试额度。详见《支付与赞助服务协议》。`,
  validDays: 30,
}));

async function setup(page: Page) {
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
        captchaId: 'sponsor-copy-captcha',
        challenge: 'abcdef0123456789',
        difficulty: 1,
        provider: 'pow',
        scene: 'login',
      };
    } else if (pathname === '/system-api/auth/login') {
      data = { accessToken: 'sponsor-copy-test-token' };
    } else if (pathname === '/system-api/user/info') {
      data = {
        avatar: '',
        desc: '',
        homePath: '/console/purchase/global',
        realName: 'Sponsor User',
        roles: ['admin'],
        userId: '1',
        username: 'admin',
      };
    } else if (pathname === '/system-api/site/config') {
      data = { logoUrl: '', siteName: 'BugPk-Api' };
    } else if (pathname === '/system-api/auth/codes') {
      data = ['package:purchase'];
    } else if (pathname === '/system-api/menu/all') {
      data = [
        {
          component: '/purchase/global',
          id: '1101',
          meta: { icon: 'mdi:shopping-outline', title: '赞助档位' },
          name: 'UserGlobalPackage',
          path: '/console/purchase/global',
          pid: '0',
          status: 1,
          type: 'menu',
        },
      ];
    } else if (pathname === '/system-api/package/mall/global/list') {
      data = { items: TIERS, total: TIERS.length };
    } else if (pathname === '/system-api/notice/user/list') {
      data = { items: [], total: 0 };
    } else if (pathname === '/system-api/notice/user/popup') {
      data = [];
    }

    await route.fulfill({ json: { code: 0, data, message: 'ok' } });
  });

  await authLogin(page, '/console/purchase/global');
}

function cards(page: Page) {
  return page.locator('.package-card--global');
}

test.describe('Sponsor tier copy', () => {
  test.setTimeout(120_000);

  test('renders renamed service tiers with detailed descriptions', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ height: 900, width: 1_280 });
    await setup(page);
    await expect(cards(page)).toHaveCount(4);

    // 每档展示自己的服务测试额度、并发与详细服务说明；名称统一为「服务测试xx版」。
    for (const [index, card] of (await cards(page).all()).entries()) {
      const tier = TIERS[index]!;
      const title = card.locator('h3');
      // 展示层在档位与时长之间插入零宽断点，比对时忽略它。
      expect((await title.innerText()).replaceAll(String.fromCharCode(0x200b), '')).toBe(tier.name);
      // 名称含「（月卡/季卡/年卡）」，不能再被省略号截断。
      await expect
        .poll(() => title.evaluate((el) => el.scrollHeight - el.clientHeight))
        .toBeLessThanOrEqual(1);
      await expect(
        card.getByText('服务测试额度', { exact: true }).first(),
      ).toBeVisible();
      await expect(card.locator('strong').filter({ hasText: /^每日 [\d,]+ 次$/ })).toHaveText(
        `每日 ${tier.dailyLimit.toLocaleString()} 次`,
      );
      await expect(card.getByText(`每秒 ${tier.qpsLimit} 次`)).toBeVisible();
      const desc = card.locator('.package-card__desc');
      await expect(desc).toContainText('赞助兑换服务：本档为对本站技术与服务运营的自愿赞助支持');
      // 备注是详细服务说明，必须完整展示，不能被行数限制截断。
      await expect
        .poll(() => desc.evaluate((el) => el.scrollHeight - el.clientHeight))
        .toBeLessThanOrEqual(1);
    }

    await expect(page.locator('.ant-notification-notice')).toHaveCount(0, {
      timeout: 15_000,
    });
    await page.screenshot({
      path: testInfo.outputPath('sponsor-tiers-desktop.png'),
      fullPage: false,
    });

    await page.setViewportSize({ height: 900, width: 390 });
    await expect(cards(page).first()).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ),
      )
      .toBeLessThanOrEqual(1);
    await page.screenshot({
      path: testInfo.outputPath('sponsor-tiers-mobile.png'),
      fullPage: false,
    });
  });

  test('renders the sponsor tiers in dark mode', async ({ page }, testInfo) => {
    await page.setViewportSize({ height: 900, width: 1_280 });
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
    const card = cards(page).first();
    await expect(card.getByText('服务测试额度', { exact: true }).first()).toBeVisible();

    const background = await card.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    const [r = 0, g = 0, b = 0] = (background.match(/\d+/g) ?? []).map(Number);
    expect(
      0.2126 * r + 0.7152 * g + 0.0722 * b,
      `卡片应随主题转暗，实际 ${background}`,
    ).toBeLessThan(200);

    await expect(page.locator('.ant-notification-notice')).toHaveCount(0, {
      timeout: 15_000,
    });
    await page.screenshot({
      path: testInfo.outputPath('sponsor-tiers-dark.png'),
      fullPage: false,
    });
  });
});
