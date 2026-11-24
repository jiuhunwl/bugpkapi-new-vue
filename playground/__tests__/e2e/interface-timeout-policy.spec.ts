import type { Locator, Page } from '@playwright/test';

import type { InterfaceApi } from '../../src/api/interface';

import { expect, test } from '@playwright/test';

import { loginInterfaceAdmin, mockInterfaceAdmin } from './common/interface-admin';

const globalPath = '/system-api/interface/global-delivery-policy';

type PolicyEditor = {
  drawer: Locator;
  input: Locator;
  panel: Locator;
  toggle: Locator;
};

async function mockTimeoutPolicies(
  page: Page,
  localTimeout = 0,
  localOverride: 0 | 1 = 0,
) {
  const { item: interfaceItem } = await mockInterfaceAdmin(page);
  const localPath =
    '/system-api/interface/' + interfaceItem.id + '/delivery-policy';
  const saves: Array<{ body: InterfaceApi.SaveDeliveryPolicy; path: string }> =
    [];
  const defaults: InterfaceApi.DeliveryPolicy = {
    cacheDefaultTtlSeconds: 0,
    cacheEnabled: 0,
    cachePolicyOverride: 0,
    cacheRules: [],
    id: interfaceItem.id,
    name: interfaceItem.name,
    requestTimeoutMs: localTimeout,
    requestTimeoutOverride: localOverride,
    responseAdEnabled: 0,
    responseAdField: '_advertisement',
    responseAdId: '0',
    responseAdPolicyOverride: 0,
    scope: 'INTERFACE',
  };
  const failures = { getPath: '', save: false };
  let local = { ...defaults };
  let global: InterfaceApi.DeliveryPolicy = {
    ...defaults,
    id: '0',
    name: '全局默认策略',
    requestTimeoutMs: 12_000,
    requestTimeoutOverride: 1,
    scope: 'GLOBAL',
  };

  // Register after the shared auth/list fixture. All writes remain in memory;
  // exercise the actual drawer and API client, never a replacement HTML form.
  for (const pathname of [localPath, globalPath]) {
    await page.route('**' + pathname, async (route) => {
      const request = route.request();
      const isGlobal = pathname === globalPath;
      if (request.method() === 'PUT') {
        if (failures.save) {
          failures.save = false;
          await route.fulfill({ status: 400, json: { code: 400, data: null, error: '策略保存测试失败', message: '策略保存测试失败' } });
          return;
        }
        const body = request.postDataJSON() as InterfaceApi.SaveDeliveryPolicy;
        saves.push({ body, path: pathname });
        if (isGlobal) global = { ...global, ...body };
        else local = { ...local, ...body };
        await route.fulfill({
          json: { code: 0, data: true, error: null, message: 'ok' },
        });
        return;
      }
      if (failures.getPath === pathname) {
        failures.getPath = '';
        await route.fulfill({ status: 500, json: { code: 500, data: null, error: '策略加载测试失败', message: '策略加载测试失败' } });
        return;
      }
      const policy = isGlobal ? global : local;
      const effective =
        isGlobal ||
        (local.requestTimeoutOverride === 1 && local.requestTimeoutMs > 0)
          ? policy.requestTimeoutMs
          : global.requestTimeoutMs;
      await route.fulfill({
        json: {
          code: 0,
          data: { ...policy, effectiveRequestTimeoutMs: effective },
          error: null,
          message: 'ok',
        },
      });
    });
  }
  await page.route('**/system-api/interface/response-advertisements', (route) =>
    route.fulfill({ json: { code: 0, data: [], error: null, message: 'ok' } }),
  );
  await loginInterfaceAdmin(page);
  await expect(page.getByTestId('interface-responsive-item')).toHaveCount(1);
  return { failures, localPath, saves };
}

async function clickPolicyAction(
  page: Page,
  scope: 'GLOBAL' | 'INTERFACE',
) {
  if (scope === 'GLOBAL') {
    await page
      .getByRole('button', { name: '全局投放策略', exact: true })
      .click();
  } else {
    await page
      .getByTestId('interface-responsive-item')
      .getByRole('button', { name: '操作', exact: true })
      .click();
    await page
      .getByRole('menuitem', { name: '投放与缓存策略', exact: true })
      .click();
  }
}

async function openPolicy(
  page: Page,
  scope: 'GLOBAL' | 'INTERFACE' = 'INTERFACE',
): Promise<PolicyEditor> {
  await clickPolicyAction(page, scope);
  const panel = page.getByTestId('delivery-policy-timeout');
  const drawer = page.getByRole('dialog').filter({ has: panel });
  await expect(drawer).toBeVisible();
  const input = drawer.getByRole('spinbutton', {
    name: '超时时间',
    exact: true,
  });
  await expect(input).toBeVisible();
  // Waiting for the real confirm button to unlock also waits for the policy GETs.
  await expect(
    drawer.getByRole('button', {
      name: /^(确\s*认|确\s*定|保\s*存|Confirm|Save)$/,
    }),
  ).toBeEnabled();
  return {
    drawer,
    input,
    panel,
    toggle: drawer.getByRole('switch', {
      name: '覆盖全局请求超时',
      exact: true,
    }),
  };
}

async function savePolicy(page: Page, editor: PolicyEditor, pathname: string) {
  const response = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      new URL(response.url()).pathname === pathname,
  );
  await editor.drawer
    .getByRole('button', { name: /^(确\s*认|确\s*定|保\s*存|Confirm|Save)$/ })
    .click();
  const saved = await response;
  expect(saved.ok()).toBe(true);
  const payload = saved
    .request()
    .postDataJSON() as InterfaceApi.SaveDeliveryPolicy;
  expect(payload).not.toHaveProperty('effectiveRequestTimeoutMs');
  await expect(editor.drawer).not.toBeVisible();
  return payload;
}

async function closePolicy(editor: PolicyEditor) {
  await editor.drawer
    .getByRole('button', { name: /^(取\s*消|Cancel)$/ })
    .click();
  await expect(editor.drawer).not.toBeVisible();
}

test.describe('Interface timeout policy editor', () => {
  test.use({ viewport: { height: 900, width: 390 } });
  test.setTimeout(90_000);

  test('saves and reopens the exact global timeout boundaries', async ({
    page,
  }) => {
    const backend = await mockTimeoutPolicies(page);
    for (const value of [100, 120_000]) {
      const editor = await openPolicy(page, 'GLOBAL');
      await expect(editor.toggle).toHaveCount(0);
      await expect(editor.input).toBeEnabled();
      await editor.input.fill(String(value));
      expect(await savePolicy(page, editor, globalPath)).toMatchObject({
        requestTimeoutMs: value,
        requestTimeoutOverride: 1,
      });
      const reopened = await openPolicy(page, 'GLOBAL');
      await expect(reopened.input).toHaveValue(String(value));
      await closePolicy(reopened);
    }
    expect(backend.saves.map((save) => save.path)).toEqual([
      globalPath,
      globalPath,
    ]);
  });

  test('keeps an unset interface inherited after save and follows a later global edit', async ({
    page,
  }) => {
    const backend = await mockTimeoutPolicies(page);
    const inherited = await openPolicy(page);
    await expect(inherited.toggle).not.toBeChecked();
    await expect(inherited.input).toBeDisabled();
    await expect(inherited.input).toHaveValue('12000');
    expect(await savePolicy(page, inherited, backend.localPath)).toMatchObject({
      requestTimeoutMs: 0,
      requestTimeoutOverride: 0,
    });

    const global = await openPolicy(page, 'GLOBAL');
    await global.input.fill('30000');
    expect(await savePolicy(page, global, globalPath)).toMatchObject({
      requestTimeoutMs: 30_000,
    });
    const reopened = await openPolicy(page);
    await expect(reopened.input).toBeDisabled();
    await expect(reopened.input).toHaveValue('30000');
    await expect(reopened.panel).toContainText('最终生效：30000 毫秒');
    expect(await savePolicy(page, reopened, backend.localPath)).toMatchObject({
      requestTimeoutMs: 0,
      requestTimeoutOverride: 0,
    });
  });

  test('preserves an edited local override when disabled, saved, reopened and enabled', async ({
    page,
  }) => {
    const backend = await mockTimeoutPolicies(page, 60_000, 1);
    const editor = await openPolicy(page);
    await expect(editor.toggle).toBeChecked();
    await expect(editor.input).toHaveValue('60000');
    await expect(editor.panel).toContainText('最终生效：60000 毫秒');
    await editor.input.fill('45000');
    await editor.toggle.click();
    await expect(editor.input).toBeDisabled();
    await expect(editor.input).toHaveValue('12000');
    expect(await savePolicy(page, editor, backend.localPath)).toMatchObject({
      requestTimeoutMs: 45_000,
      requestTimeoutOverride: 0,
    });

    const reopened = await openPolicy(page);
    await expect(reopened.input).toHaveValue('12000');
    await expect(reopened.toggle).not.toBeChecked();
    await reopened.toggle.click();
    await expect(reopened.input).toBeEnabled();
    await expect(reopened.input).toHaveValue('45000');
    await expect(reopened.panel).toContainText('最终生效：45000 毫秒');
    expect(await savePolicy(page, reopened, backend.localPath)).toMatchObject({
      requestTimeoutMs: 45_000,
      requestTimeoutOverride: 1,
    });
    const enabledAgain = await openPolicy(page);
    await expect(enabledAgain.input).toHaveValue('45000');
    await expect(enabledAgain.toggle).toBeChecked();
  });

  test('round-trips an explicit zero without freezing the then-current global timeout', async ({
    page,
  }) => {
    const backend = await mockTimeoutPolicies(page, 0, 1);
    const editor = await openPolicy(page);
    await expect(editor.input).toBeEnabled();
    await expect(editor.input).toHaveValue('0');
    await expect(editor.panel).toContainText('最终生效：12000 毫秒');
    expect(await savePolicy(page, editor, backend.localPath)).toMatchObject({
      requestTimeoutMs: 0,
      requestTimeoutOverride: 1,
    });

    const global = await openPolicy(page, 'GLOBAL');
    await global.input.fill('20000');
    await savePolicy(page, global, globalPath);
    const reopened = await openPolicy(page);
    await expect(reopened.input).toHaveValue('0');
    await expect(reopened.panel).toContainText('最终生效：20000 毫秒');
    await reopened.toggle.click();
    await expect(reopened.input).toHaveValue('20000');
    await reopened.toggle.click();
    await expect(reopened.input).toHaveValue('0');
    expect(await savePolicy(page, reopened, backend.localPath)).toMatchObject({
      requestTimeoutMs: 0,
      requestTimeoutOverride: 1,
    });
  });

  test('does not erase the saved local value when disabling an invalid draft', async ({
    page,
  }) => {
    const backend = await mockTimeoutPolicies(page, 60_000, 1);
    const editor = await openPolicy(page);
    await editor.input.fill('99');
    await editor.toggle.click();
    await expect(editor.input).toBeDisabled();
    await expect(editor.input).toHaveValue('12000');
    expect(await savePolicy(page, editor, backend.localPath)).toMatchObject({
      requestTimeoutMs: 60_000,
      requestTimeoutOverride: 0,
    });
    const reopened = await openPolicy(page);
    await reopened.toggle.click();
    await expect(reopened.input).toHaveValue('60000');
  });

  for (const value of [100, 120_000]) {
    test(
      'persists local boundary ' +
        value +
        ' ms independently of the 12000 ms global setting',
      async ({ page }) => {
        const backend = await mockTimeoutPolicies(page);
        const editor = await openPolicy(page);
        await editor.toggle.click();
        await editor.input.fill(String(value));
        expect(await savePolicy(page, editor, backend.localPath)).toMatchObject(
          {
            requestTimeoutMs: value,
            requestTimeoutOverride: 1,
          },
        );
        const reopened = await openPolicy(page);
        await expect(reopened.input).toHaveValue(String(value));
        await expect(reopened.panel).toContainText(
          '最终生效：' + value + ' 毫秒',
        );
      },
    );
  }

  test('blocks the 1..99 ms gap and an empty global value without sending PUT', async ({
    page,
  }) => {
    const backend = await mockTimeoutPolicies(page, 60_000, 1);
    const editor = await openPolicy(page);
    await editor.input.fill('99');
    await editor.drawer
      .getByRole('button', { name: /^(确\s*认|确\s*定|保\s*存|Confirm|Save)$/ })
      .click();
    await expect(
      page.getByText('请求超时须为 0（继承全局），或 100 到 120000 毫秒', {
        exact: true,
      }),
    ).toBeVisible();
    expect(backend.saves).toEqual([]);
    await closePolicy(editor);
    const global = await openPolicy(page, 'GLOBAL');
    await global.input.fill('');
    await global.drawer
      .getByRole('button', { name: /^(确\s*认|确\s*定|保\s*存|Confirm|Save)$/ })
      .click();
    await expect(
      page.getByText('请求超时必须在 100 到 120000 毫秒之间', { exact: true }),
    ).toBeVisible();
    expect(backend.saves).toEqual([]);
  });
});


test.describe('Policy failure safety', () => {
  test.use({ viewport: { height: 900, width: 390 } });
  test.setTimeout(90_000);
  for (const scenario of [
    { name: 'global policy', scope: 'GLOBAL', dependency: 'global' },
    { name: 'interface policy', scope: 'INTERFACE', dependency: 'local' },
    { name: 'global dependency of an interface', scope: 'INTERFACE', dependency: 'global' },
  ] as const) {
    test('does not save defaults after a failed ' + scenario.name + ' GET', async ({ page }) => {
      const backend = await mockTimeoutPolicies(page, 60_000, 1);
      const pageErrors: string[] = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      const failedPath = scenario.dependency === 'global' ? globalPath : backend.localPath;
      backend.failures.getPath = failedPath;
      const failedResponse = page.waitForResponse((response) => new URL(response.url()).pathname === failedPath && response.status() === 500);
      await clickPolicyAction(page, scenario.scope);
      await failedResponse;
      await expect(page.getByRole('dialog').filter({ has: page.getByTestId('delivery-policy-timeout') })).not.toBeVisible();
      expect(backend.saves).toHaveLength(0);
      const retry = await openPolicy(page, scenario.scope);
      await expect(retry.input).toHaveValue(scenario.scope === 'GLOBAL' ? '12000' : '60000');
      await savePolicy(page, retry, scenario.scope === 'GLOBAL' ? globalPath : backend.localPath);
      expect(pageErrors).toEqual([]);
    });
  }
  for (const scope of ['GLOBAL', 'INTERFACE'] as const) {
    test('retains a ' + scope + ' draft after a failed PUT and retries safely', async ({ page }) => {
      const backend = await mockTimeoutPolicies(page, 60_000, 1);
      const pageErrors: string[] = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      const editor = await openPolicy(page, scope);
      await editor.input.fill('45000');
      backend.failures.save = true;
      const pathname = scope === 'GLOBAL' ? globalPath : backend.localPath;
      const failedResponse = page.waitForResponse((response) => new URL(response.url()).pathname === pathname && response.request().method() === 'PUT' && response.status() === 400);
      await editor.drawer.getByRole('button', { name: /^(确\s*认|确\s*定|保\s*存|Confirm|Save)$/ }).click();
      await failedResponse;
      await expect(editor.drawer).toBeVisible();
      await expect(editor.input).toHaveValue('45000');
      expect(backend.saves).toHaveLength(0);
      expect(await savePolicy(page, editor, pathname)).toMatchObject({ requestTimeoutMs: 45000, requestTimeoutOverride: 1 });
      expect(pageErrors).toEqual([]);
    });
  }
});
