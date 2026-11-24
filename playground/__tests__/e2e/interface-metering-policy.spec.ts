import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { mockInterfaceAdmin } from './common/interface-admin';
import { authLogin } from './common/auth';

const INHERIT = '沿用默认';
// main.ts 用 namespace 隔离偏好缓存；这里必须和开发构建下算出来的值一致。
const PREFERENCE_NAMESPACE = 'bugpk-api-v0.0.0-dev-dev';

interface Rgb {
  a: number;
  b: number;
  g: number;
  r: number;
}

function parseRgb(value: string): null | Rgb {
  const match = value.match(/rgba?\(([^)]+)\)/);
  if (!match?.[1]) return null;
  const [r = '0', g = '0', b = '0', a = '1'] = match[1].split(',').map((part) => part.trim());
  return { r: Number(r), g: Number(g), b: Number(b), a: Number(a) };
}

async function readRgb(locator: Locator, property: string): Promise<Rgb> {
  const value = await locator.evaluate(
    (el, prop) => getComputedStyle(el).getPropertyValue(prop as string),
    property,
  );
  const rgb = parseRgb(value);
  expect(rgb, `计算样式应返回 rgb/rgba，实际为 ${value}`).not.toBeNull();
  return rgb!;
}

function luminance(rgb: Rgb) {
  return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
}

interface MeteringBackend {
  policy: {
    assetMode: string;
    groupMode: string;
    packageMode: string;
    guardEnabled: number;
    guardAllUsersSet: boolean;
    roleOverrides: Array<{
      assetMode: string;
      groupMode: string;
      packageMode: string;
      roleId: number;
    }>;
  };
  meteringSaves: any[];
  ruleSaves: any[];
  failMeteringLoad: boolean;
}

async function setup(page: Page) {
  const state = await mockInterfaceAdmin(page);
  Object.assign(state.item, {
    billingEnabled: 1,
    billingLogEnabled: 1,
    price: '1.0000',
    pointPrice: 3,
  });
  const backend: MeteringBackend = {
    policy: {
      assetMode: 'inherit',
      groupMode: 'inherit',
      packageMode: 'inherit',
      guardEnabled: 0,
      guardAllUsersSet: false,
      roleOverrides: [],
    },
    meteringSaves: [],
    ruleSaves: [],
    failMeteringLoad: false,
  };
  let rules = [{ fieldName: 'code', operator: 'EQ', expectedValue: '200', sortNo: 1 }];

  await page.route('**/system-api/auth/codes', (route) =>
    route.fulfill({
      json: {
        code: 0,
        data: ['interface:list', 'interface:update', 'interface:billing'],
        message: 'ok',
      },
    }),
  );
  await page.route('**/system-api/system/role/options', (route) =>
    route.fulfill({
      json: {
        code: 0,
        data: [
          { id: '3', name: 'VIP 会员', roleKey: 'vip' },
          { id: '4', name: '普通用户', roleKey: 'common' },
        ],
        message: 'ok',
      },
    }),
  );
  await page.route('**/system-api/interface/801/billing-rules', async (route) => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON();
      backend.ruleSaves.push(body);
      rules = body.rules;
      await route.fulfill({ json: { code: 0, data: true, message: 'ok' } });
      return;
    }
    await route.fulfill({ json: { code: 0, data: rules, message: 'ok' } });
  });
  await page.route('**/system-api/interface/801/metering', async (route) => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON();
      backend.meteringSaves.push(body);
      // 与后端一致：保存成功后回显以落库值为准。
      backend.policy = {
        assetMode: body.assetMode,
        groupMode: body.groupMode,
        packageMode: body.packageMode,
        guardEnabled: body.guardEnabled,
        guardAllUsersSet: body.guardAllUsersSet,
        roleOverrides: body.roleOverrides,
      };
      await route.fulfill({ json: { code: 0, data: true, message: 'ok' } });
      return;
    }
    if (backend.failMeteringLoad) {
      await route.fulfill({
        status: 500,
        json: { code: 500, message: '计量策略加载失败' },
      });
      return;
    }
    await route.fulfill({ json: { code: 0, data: backend.policy, message: 'ok' } });
  });

  await authLogin(page, '/console/interface/list');
  await expect(page.getByTestId('interface-responsive-item')).toHaveCount(1);
  return backend;
}

async function openBilling(page: Page) {
  await page
    .getByTestId('interface-responsive-item')
    .getByRole('button', { name: '操作', exact: true })
    .click();
  await page.getByRole('menuitem', { name: '扣费标准', exact: true }).click();
  const drawer = page
    .getByRole('dialog')
    .filter({ has: page.getByRole('switch', { name: '接口计费总开关' }) });
  await expect(drawer).toBeVisible();
  return drawer;
}

async function closeBilling(page: Page, drawer: Locator) {
  const cancel = drawer
    .getByRole('button', { name: /^(取\s*消|Cancel)$/ })
    .first();
  if (await cancel.count()) {
    await cancel.click();
  } else {
    await page.keyboard.press('Escape');
  }
  await expect(drawer).not.toBeVisible();
}

async function pick(page: Page, field: Locator, option: string) {
  await field.locator('.ant-select-selector').click();
  const dropdown = page.locator(
    '.ant-select-dropdown:not(.ant-select-dropdown-hidden)',
  );
  await dropdown
    .locator('.ant-select-item-option-content')
    .filter({ hasText: option })
    .last()
    .click();
}

function selection(field: Locator) {
  return field.locator('.ant-select-selection-item');
}

function roleRow(drawer: Locator, name: string) {
  return drawer.getByTestId('metering-role-row').filter({ hasText: name });
}

function confirmButton(drawer: Locator) {
  return drawer.getByRole('button', {
    name: /^(确\s*认|确\s*定|保\s*存|Confirm|Save)$/,
  });
}

// 截图前收掉选项浮层与登录提示：它们会盖住区块，验收时看不出真实排版。
async function settleOverlays(page: Page) {
  // AntD 给每个 Select 都常驻一个 dropdown 容器，只有展开的那个是可见的。
  const openDropdown = page.locator('.ant-select-dropdown:visible');
  if (await openDropdown.count()) {
    await page.keyboard.press('Escape');
    await expect(openDropdown).toHaveCount(0);
  }
  await expect(page.locator('.ant-notification-notice')).toHaveCount(0, {
    timeout: 15_000,
  });
}

test.describe('Per-interface metering policy', () => {
  test.use({ viewport: { width: 390, height: 900 } });
  test.setTimeout(180_000);

  test('keeps the three dimensions independent and guards a fully unmetered API', async ({
    page,
  }, testInfo) => {
    const backend = await setup(page);
    let drawer = await openBilling(page);
    await expect(drawer.getByTestId('metering-field-asset')).toBeVisible();

    // 默认全 inherit：与 1.2.88 现网行为等价，且每个用户组都列出一行。
    await expect(selection(drawer.getByTestId('metering-field-asset'))).toHaveText(
      INHERIT,
    );
    await expect(
      selection(drawer.getByTestId('metering-field-package')),
    ).toHaveText(INHERIT);
    await expect(selection(drawer.getByTestId('metering-field-group'))).toHaveText(
      INHERIT,
    );
    await expect(drawer.getByTestId('metering-role-row')).toHaveCount(2);
    await settleOverlays(page);
    await drawer
      .locator('.billing-metering')
      .screenshot({ path: testInfo.outputPath('metering-mobile-default.png') });

    // 三维全免但接口没有全平台总量兜底：必须挡住，连扣费规则都不提交。
    await pick(page, drawer.getByTestId('metering-field-asset'), '永不扣费');
    await pick(page, drawer.getByTestId('metering-field-package'), '不占次数');
    await pick(page, drawer.getByTestId('metering-field-group'), '不计入');
    await expect(drawer.getByTestId('metering-guard')).toBeVisible();
    await settleOverlays(page);
    await drawer
      .locator('.billing-metering')
      .screenshot({ path: testInfo.outputPath('metering-mobile-guard.png') });
    await confirmButton(drawer).click();
    await expect.poll(() => backend.meteringSaves.length).toBe(0);
    expect(backend.ruleSaves).toEqual([]);
    await expect(drawer).toBeVisible();

    // 兜底闸门打开后重新进入，同一组配置就允许保存。
    await closeBilling(page, drawer);
    backend.policy.guardEnabled = 1;
    backend.policy.guardAllUsersSet = true;
    drawer = await openBilling(page);
    await expect(
      roleRow(drawer, 'VIP 会员').locator('.ant-select-selection-item').first(),
    ).toHaveText(INHERIT);
    await pick(page, drawer.getByTestId('metering-field-asset'), '永不扣费');
    await pick(page, drawer.getByTestId('metering-field-package'), '不占次数');
    await pick(page, drawer.getByTestId('metering-field-group'), '不计入');
    await expect(drawer.getByTestId('metering-guard')).toHaveCount(0);
    await confirmButton(drawer).click();
    await expect(drawer).not.toBeVisible();
    expect(backend.meteringSaves[0]).toMatchObject({
      assetMode: 'free',
      groupMode: 'skip',
      packageMode: 'skip',
      guardEnabled: 1,
      guardAllUsersSet: true,
      roleOverrides: [],
    });
    // 计量策略单独提交，不能顺手改动扣费规则与价格。
    expect(backend.ruleSaves[0]).toMatchObject({
      billingEnabled: 1,
      billingLogEnabled: 1,
      rules: [{ fieldName: 'code', expectedValue: '200', operator: 'EQ' }],
    });

    // 用户组覆盖：只有被改过的那一维离开 inherit，其余维度继承接口级。
    drawer = await openBilling(page);
    await expect(selection(drawer.getByTestId('metering-field-asset'))).toHaveText(
      '永不扣费',
    );
    await pick(page, roleRow(drawer, '普通用户').locator('.ant-select').nth(2), '强制计入');
    await confirmButton(drawer).click();
    await expect(drawer).not.toBeVisible();
    expect(backend.meteringSaves[1]).toMatchObject({
      assetMode: 'free',
      packageMode: 'skip',
      groupMode: 'skip',
      roleOverrides: [
        {
          assetMode: 'inherit',
          groupMode: 'count',
          packageMode: 'inherit',
          roleId: 4,
        },
      ],
    });

    drawer = await openBilling(page);
    await expect(
      roleRow(drawer, '普通用户').locator('.ant-select-selection-item').nth(2),
    ).toHaveText('强制计入');
    await expect(
      roleRow(drawer, 'VIP 会员').locator('.ant-select-selection-item').nth(2),
    ).toHaveText(INHERIT);
    await settleOverlays(page);
    await drawer
      .locator('.billing-metering')
      .screenshot({ path: testInfo.outputPath('metering-mobile-role.png') });
    await closeBilling(page, drawer);
  });

  test('keeps billing rules usable and skips the policy when the strategy fails to load', async ({
    page,
  }, testInfo) => {
    const backend = await setup(page);
    backend.failMeteringLoad = true;
    const drawer = await openBilling(page);

    // 计量策略读失败不能把整个抽屉判死：扣费规则照常可见、可保存。
    await expect(drawer.getByTestId('metering-load-failed')).toBeVisible();
    await expect(drawer.getByTestId('metering-field-asset')).toHaveCount(0);
    await expect(
      drawer.getByRole('switch', { name: '接口计费总开关' }),
    ).toBeChecked();
    await expect(confirmButton(drawer)).toBeEnabled();
    await settleOverlays(page);
    await drawer
      .locator('.billing-metering')
      .screenshot({ path: testInfo.outputPath('metering-mobile-load-failed.png') });

    await drawer
      .getByRole('switch', { name: '接口计费总开关' })
      .click();
    await confirmButton(drawer).click();
    await expect(drawer).not.toBeVisible();
    expect(backend.ruleSaves).toHaveLength(1);
    expect(backend.ruleSaves[0]).toMatchObject({ billingEnabled: 0 });
    // 全 inherit 的默认值绝不能覆盖线上策略。
    expect(backend.meteringSaves).toEqual([]);
  });

  test('renders the policy block on a wide screen', async ({
    page,
  }, testInfo) => {
    await setup(page);
    const drawer = await openBilling(page);
    // 抽屉在窄屏打开后再展宽：同时核对宽屏布局与随视口变化的重排。
    await page.setViewportSize({ height: 900, width: 1_280 });
    await expect(drawer.getByTestId('metering-field-asset')).toBeVisible();
    await pick(page, drawer.getByTestId('metering-field-asset'), '永不扣费');
    await pick(page, drawer.getByTestId('metering-field-package'), '不占次数');
    await pick(page, drawer.getByTestId('metering-field-group'), '不计入');
    await expect(drawer.getByTestId('metering-guard')).toBeVisible();
    await expect(drawer.getByTestId('metering-role-row')).toHaveCount(2);

    const box = await drawer.locator('.billing-metering').boundingBox();
    const drawerBox = await drawer.boundingBox();
    expect(box).not.toBeNull();
    expect(drawerBox).not.toBeNull();
    // 区块不得溢出抽屉，窄屏下同理靠 grid 换列保证。
    expect(box!.width).toBeLessThanOrEqual(drawerBox!.width + 1);

    await settleOverlays(page);
    await page.screenshot({
      path: testInfo.outputPath('metering-desktop-light.png'),
      fullPage: false,
    });
  });

  test('renders the policy block in dark mode', async ({ page }, testInfo) => {
    // 走应用自己的主题偏好：只往 html 上加 dark class 不会切换 AntD 的暗色算法，
    // 下拉框会留在浅色，截图看着像深色其实是假阳性。
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
    }, PREFERENCE_NAMESPACE);
    await setup(page);
    const drawer = await openBilling(page);
    await page.setViewportSize({ height: 900, width: 1_280 });
    await expect(drawer.getByTestId('metering-field-asset')).toBeVisible();
    await pick(page, drawer.getByTestId('metering-field-asset'), '永不扣费');
    await pick(page, drawer.getByTestId('metering-field-package'), '不占次数');
    await pick(page, drawer.getByTestId('metering-field-group'), '不计入');
    await expect(drawer.getByTestId('metering-guard')).toBeVisible();

    const shellBackground = await readRgb(
      drawer.locator('.billing-metering'),
      'background-color',
    );
    expect(shellBackground.a, '区块底色应不透明，否则下面测的是继承色').toBeGreaterThan(
      0.05,
    );
    expect(
      luminance(shellBackground),
      '计量策略区块应随主题转暗',
    ).toBeLessThan(120);
    const helpText = await readRgb(
      drawer.locator('.billing-metering').getByText('永不扣费：保留价格但一律不扣').first(),
      'color',
    );
    expect(
      luminance(helpText),
      '暗色下说明文案要保持可读',
    ).toBeGreaterThan(120);
    await expect(drawer.getByTestId('metering-guard')).toBeVisible();

    await settleOverlays(page);
    await drawer
      .locator('.billing-metering')
      .screenshot({ path: testInfo.outputPath('metering-dark-block.png') });
    await page.screenshot({
      path: testInfo.outputPath('metering-desktop-dark.png'),
      fullPage: false,
    });
  });
});
