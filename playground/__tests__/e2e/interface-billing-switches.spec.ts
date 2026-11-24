import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { mockInterfaceAdmin } from './common/interface-admin';
import { authLogin } from './common/auth';

async function setup(page: Page, failLoad = false) {
  const state = await mockInterfaceAdmin(page);
  Object.assign(state.item, {
    billingEnabled: 1,
    billingLogEnabled: 1,
    price: '2.5000',
    pointPrice: 7,
  });
  const saves: any[] = [];
  let rules = [
    { fieldName: 'code', operator: 'EQ', expectedValue: '200', sortNo: 1 },
  ];
  await page.route('**/system-api/auth/codes', (route) =>
    route.fulfill({
      json: {
        code: 0,
        data: ['interface:list', 'interface:update', 'interface:billing'],
        message: 'ok',
      },
    }),
  );
  await page.route(
    '**/system-api/interface/801/billing-rules',
    async (route) => {
      if (route.request().method() === 'PUT') {
        const body = route.request().postDataJSON();
        saves.push(body);
        Object.assign(state.item, {
          billingEnabled: body.billingEnabled,
          billingLogEnabled: body.billingLogEnabled,
        });
        rules = body.rules;
        await route.fulfill({ json: { code: 0, data: true, message: 'ok' } });
        return;
      }
      if (failLoad) {
        await route.fulfill({
          status: 500,
          json: { code: 500, message: '加载失败' },
        });
        return;
      }
      await route.fulfill({ json: { code: 0, data: rules, message: 'ok' } });
    },
  );
  await authLogin(page, '/console/interface/list');
  await expect(page.getByTestId('interface-responsive-item')).toHaveCount(1);
  return { saves, state };
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
test.describe('Per-interface billing controls', () => {
  test.use({ viewport: { width: 390, height: 900 } });
  test.setTimeout(90_000);
  test('saves and reopens independent switches without changing prices or rules', async ({
    page,
  }, testInfo) => {
    const backend = await setup(page);
    let drawer = await openBilling(page);
    const confirm = () =>
      drawer.getByRole('button', {
        name: /^(确\s*认|确\s*定|保\s*存|Confirm|Save)$/,
      });
    await expect(confirm()).toBeEnabled();
    await drawer.getByRole('switch', { name: '接口计费总开关' }).click();
    await expect(
      drawer.getByRole('switch', { name: '计费日志开关', exact: true }),
    ).toBeChecked();
    await drawer.screenshot({
      path: testInfo.outputPath('interface-billing-mobile.png'),
    });
    await confirm().click();
    await expect(drawer).not.toBeVisible();
    expect(backend.saves[0]).toMatchObject({
      billingEnabled: 0,
      billingLogEnabled: 1,
      rules: [{ fieldName: 'code', expectedValue: '200', operator: 'EQ' }],
    });
    drawer = await openBilling(page);
    await expect(confirm()).toBeEnabled();
    await expect(
      drawer.getByRole('switch', { name: '接口计费总开关' }),
    ).not.toBeChecked();
    await drawer.getByRole('switch', { name: '接口计费总开关' }).click();
    await drawer
      .getByRole('switch', { name: '计费日志开关', exact: true })
      .click();
    await confirm().click();
    await expect(drawer).not.toBeVisible();
    expect(backend.saves[1]).toMatchObject({
      billingEnabled: 1,
      billingLogEnabled: 0,
    });
    expect(backend.state.item).toMatchObject({
      price: '2.5000',
      pointPrice: 7,
    });
    drawer = await openBilling(page);
    await expect(confirm()).toBeEnabled();
    await expect(
      drawer.getByRole('switch', { name: '接口计费总开关' }),
    ).toBeChecked();
    await expect(
      drawer.getByRole('switch', { name: '计费日志开关', exact: true }),
    ).not.toBeChecked();
  });
  test('blocks saving after a rule load failure instead of deleting existing rules', async ({
    page,
  }) => {
    const backend = await setup(page, true);
    const drawer = await openBilling(page);
    await expect(
      drawer.getByText(/扣费规则加载失败/, { exact: false }),
    ).toBeVisible();
    await expect(
      drawer.getByText(/加载失败/, { exact: false }),
    ).toBeVisible();
    await expect(
      drawer.getByRole('button', {
        name: /^(确\s*认|确\s*定|保\s*存|Confirm|Save)$/,
      }),
    ).toHaveCount(0);
    expect(backend.saves).toEqual([]);
  });
});
