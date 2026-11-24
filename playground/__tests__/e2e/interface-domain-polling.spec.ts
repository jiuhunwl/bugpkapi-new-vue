import type { Locator, Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import { loginInterfaceAdmin, mockInterfaceAdmin } from './common/interface-admin';

async function selectOption(page: Page, field: Locator, label: string) {
  await field.locator('.ant-select-selector').click();
  await page.locator('.ant-select-item-option-content').filter({ hasText: label }).last().click();
}

async function openPolling(page: Page) {
  if (await page.getByTestId('interface-responsive-item').count()) {
    await page.getByTestId('interface-responsive-item').getByRole('button', { name: '操作', exact: true }).click();
    await page.getByRole('menuitem', { name: '轮询', exact: true }).click();
  } else {
    await page.getByRole('button', { name: '轮询', exact: true }).first().click();
  }
  const panel = page.locator('.domain-panel');
  await expect(panel).toBeVisible();
  return panel;
}

test.describe('domain-specific polling editor', () => {
  test.setTimeout(90_000);

  test('creates, saves, reopens, renames and removes a domain sub-pool without losing legacy checks', async ({ page }) => {
    const state = await mockInterfaceAdmin(page);
    const warnings: string[] = [];
    page.on('console', (message) => { if (/Failed to resolve component/.test(message.text())) warnings.push(message.text()); });
    await loginInterfaceAdmin(page);
    let panel = await openPolling(page);
    await expect(panel.locator('.domain-control .ant-select')).toHaveCount(1);
    await panel.locator('header').first().getByRole('switch').click();
    await selectOption(page, panel.locator('.domain-control').first(), '回退到指定子路由');
    await panel.getByRole('button', { name: '添加域名子路由' }).click();
    const editor = panel.locator('.route-panel');
    await editor.getByLabel('路由编号', { exact: true }).fill('douyin');
    await editor.getByLabel('路由名称', { exact: true }).fill('抖音独立池');
    await editor.getByLabel(/^匹配域名/).fill('DOUYIN.COM, iesdouyin.com\ndouyin.com.');
    await editor.getByLabel('子路由主接口地址', { exact: true }).fill('https://provider.example/douyin');
    await editor.getByRole('button', { name: '添加子路由节点' }).click();
    await editor.getByPlaceholder('请输入第 1 个子路由上游地址').fill('https://provider-a.example/douyin');
    await expect.poll(() => editor.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await selectOption(page, panel.locator('.domain-control').nth(1), '抖音独立池');
    await page.getByRole('button', { name: /确\s*认/ }).click();
    await expect.poll(() => state.pollingSaves.length).toBe(1);
    const saved = state.pollingSaves[0]!;
    expect(saved.domainRouting).toMatchObject({
      enabled: 1, fallback: 'DEFAULT_ROUTE', defaultRouteId: 'douyin',
      routes: [{ id: 'douyin', name: '抖音独立池', match: { domains: ['douyin.com', 'iesdouyin.com'], source: 'AUTO', field: 'url', mode: 'SUBDOMAIN', valueMode: 'ALL' }, upstreamConfigs: [{ url: 'https://provider-a.example/douyin' }] }],
    });
    expect(saved).toMatchObject({ pollingCheckEnabled: 1, pollingCheckField: 'meta.code', pollingCheckExpected: '0', pollingStopCode: '40401', upstreamConfigs: [{ pollingCheckEnabled: 1, pollingCheckField: 'result.code', pollingCheckExpected: 'ok', responseFieldMappings: [{ source: 'payload', target: 'data' }] }] });
    await expect(panel).not.toBeVisible();
    panel = await openPolling(page);
    await expect(panel.getByLabel('路由名称', { exact: true })).toHaveValue('抖音独立池');
    await expect(panel.getByLabel(/^匹配域名/)).toHaveValue('douyin.com\niesdouyin.com');
    await panel.getByLabel('路由编号', { exact: true }).fill('video-pool');
    await page.getByRole('button', { name: /确\s*认/ }).click();
    await expect.poll(() => state.pollingSaves.length).toBe(2);
    expect(state.pollingSaves[1]!.domainRouting?.defaultRouteId).toBe('video-pool');
    await expect(panel).not.toBeVisible();
    panel = await openPolling(page);
    await panel.getByRole('button', { name: '删除第 1 条域名子路由' }).click();
    await selectOption(page, panel.locator('.domain-control').first(), '拒绝未匹配请求');
    await page.getByRole('button', { name: /确\s*认/ }).click();
    await expect.poll(() => state.pollingSaves.length).toBe(3);
    expect(state.pollingSaves[2]!.domainRouting).toMatchObject({ enabled: 1, fallback: 'REJECT', routes: [] });
    expect(warnings).toEqual([]);
  });


  test('persists clearing the last default-pool node mapping without losing its failure checks', async ({ page }) => {
    const state = await mockInterfaceAdmin(page);
    await loginInterfaceAdmin(page);
    await openPolling(page);
    const drawer = page.getByRole('dialog');
    const node = drawer.locator('.upstream').first();
    await expect(node.locator('.mapping-row')).toHaveCount(1);
    await node.locator('.mapping-row').getByRole('button', { name: '删除第 1 条字段映射', exact: true }).click();
    await expect(node.locator('.mapping-row')).toHaveCount(0);
    await drawer.getByRole('button', { name: /确\s*认/ }).click();
    await expect.poll(() => state.pollingSaves.length).toBe(1);
    expect(state.pollingSaves[0]!.upstreamConfigs).toEqual([{
      url: 'https://backup.example/api',
      pollingCheckEnabled: 1,
      pollingCheckField: 'result.code',
      pollingCheckExpected: 'ok',
      responseFieldMappings: [],
    }]);
    await expect(drawer).not.toBeVisible();
    await openPolling(page);
    await expect(page.getByRole('dialog').locator('.upstream').first().locator('.mapping-count')).toHaveText('0');
  });

  test('keeps the draft open after a backend validation failure and allows retry', async ({ page }) => {
    const state = await mockInterfaceAdmin(page);
    await loginInterfaceAdmin(page);
    const panel = await openPolling(page);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    state.failNextPollingSave = true;
    await page.getByRole('button', { name: /确\s*认/ }).click();
    await expect(page.getByText('默认域名子轮询路由必须存在且启用').first()).toBeVisible();
    await expect(panel).toBeVisible();
    await expect(page.getByRole('button', { name: /确\s*认/ })).toBeEnabled();
    await page.getByRole('button', { name: /确\s*认/ }).click();
    await expect.poll(() => state.pollingSaves.length).toBe(1);
    await expect(panel).not.toBeVisible();
    expect(pageErrors).toEqual([]);
  });
  test('keeps a mobile sub-pool editor inside its drawer and saves the same contract', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const state = await mockInterfaceAdmin(page);
    await loginInterfaceAdmin(page);
    const panel = await openPolling(page);
    await expect(panel).toContainText('/api/{apiCode}');
    await panel.locator('header').first().getByRole('switch').click();
    await panel.getByRole('button', { name: '添加域名子路由' }).click();
    const editor = panel.locator('.route-panel');
    await editor.getByLabel('路由名称', { exact: true }).fill('移动端业务池');
    await editor.getByLabel(/^匹配域名/).fill('kuaishou.com, kwai.com');
    await editor.getByLabel('子路由主接口地址', { exact: true }).fill('https://provider.example/kwai');
    await expect.poll(() => editor.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    const notices = page.locator('.ant-notification-notice-close');
    for (let index = (await notices.count()) - 1; index >= 0; index -= 1) {
      await notices.nth(index).click();
    }
    await expect(notices).toHaveCount(0);
    await panel.locator('header').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('domain-editor-mobile.png') });
    await page.getByRole('button', { name: /确\s*认/ }).click();
    await expect.poll(() => state.pollingSaves.length).toBe(1);
    expect(state.pollingSaves[0]!.domainRouting).toMatchObject({ enabled: 1, fallback: 'DEFAULT_POOL', routes: [{ name: '移动端业务池', match: { domains: ['kuaishou.com', 'kwai.com'] } }] });
  });

  test('does not reset unreturned hidden checks on a basic interface edit', async ({ page }) => {
    const state = await mockInterfaceAdmin(page);
    delete state.item.pollingCheckEnabled;
    delete state.item.pollingCheckField;
    delete state.item.pollingCheckExpected;
    delete state.item.pollingStopCode;
    delete state.item.responseCleaningEnabled;
    delete state.item.upstreamConfigs;
    await loginInterfaceAdmin(page);
    await page.getByRole('button', { name: '修改', exact: true }).first().click();
    const drawer = page.getByRole('dialog');
    await drawer.getByLabel(/接口名称$/).fill('只编辑基础名称');
    await drawer.getByRole('button', { name: /确\s*认/ }).click();
    await expect.poll(() => state.interfaceSaves.length).toBe(1);
    const saved = state.interfaceSaves[0]!;
    expect(saved.name).toBe('只编辑基础名称');
    for (const field of ['pollingCheckEnabled', 'pollingCheckField', 'pollingCheckExpected', 'pollingStopCode', 'responseCleaningEnabled']) {
      expect(saved).not.toHaveProperty(field);
    }
    expect(saved).not.toHaveProperty('upstreamConfigs');
    expect(saved).not.toHaveProperty('upstreamUrls');
  });

  test('basic edit cannot reset enabled checks from a stale list snapshot', async ({ page }, testInfo) => {
    const state = await mockInterfaceAdmin(page);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    // The polling endpoint still holds enabled checks; only the list is stale.
    state.item.pollingCheckEnabled = 0;
    state.item.upstreamConfigs = [{
      url: 'https://backup.example/api', pollingCheckEnabled: 0,
      pollingCheckField: 'code', pollingCheckExpected: '200',
    }];
    await loginInterfaceAdmin(page);
    await page.getByRole('button', { name: '修改', exact: true }).first().click();
    const drawer = page.getByRole('dialog');
    await drawer.getByLabel(/接口名称$/).fill('保留轮询失败校验');
    await drawer.getByRole('button', { name: /确\s*认/ }).click();
    await expect.poll(() => state.interfaceSaves.length).toBe(1);
    expect(state.interfaceSaves[0]).not.toHaveProperty('pollingCheckEnabled');
    expect(state.interfaceSaves[0]).not.toHaveProperty('upstreamConfigs');
    await expect(drawer).not.toBeVisible();
    await openPolling(page);
    const upstream = page.getByRole('dialog').locator('.upstream').first();
    await expect(upstream.getByRole('switch')).toBeChecked();
    await expect(upstream.getByRole('textbox').nth(1)).toHaveValue('result.code');
    await expect(upstream.getByRole('textbox').nth(2)).toHaveValue('ok');
    expect(pageErrors).toEqual([]);
    await upstream.screenshot({ path: testInfo.outputPath('preserved-failure-check.png') });
  });
  test('does not allow an unloaded polling form to overwrite stored configuration', async ({ page }) => {
    const state = await mockInterfaceAdmin(page);
    await loginInterfaceAdmin(page);
    state.failNextPollingLoad = true;
    await page.getByRole('button', { name: '轮询', exact: true }).first().click();
    await expect(page.getByText('轮询配置加载失败').first()).toBeVisible();
    await expect(page.locator('.domain-panel')).not.toBeVisible();
    expect(state.pollingSaves).toHaveLength(0);
    const panel = await openPolling(page);
    await page.getByRole('button', { name: /确\s*认/ }).click();
    await expect.poll(() => state.pollingSaves.length).toBe(1);
    expect(state.pollingSaves[0]).toMatchObject({ pollingCheckEnabled: 1, pollingCheckField: 'meta.code', pollingCheckExpected: '0' });
    await expect(panel).not.toBeVisible();
  });

});
