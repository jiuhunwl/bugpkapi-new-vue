import type { Locator, Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import { authLogin } from './common/auth';

const bilibiliApiUrl =
  'https://api.live.bilibili.com/ip_service/v1/ip_service/get_ip_addr?ip={ip}';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formField(page: Page, label: string): Locator {
  return page
    .getByRole('textbox', {
      name: new RegExp(`${escapeRegExp(label)}\\s*:`),
    })
    .first();
}

async function chooseSource(page: Page, label: string) {
  // Vben's Select wrapper does not guarantee an `.ant-select` class on the
  // clickable root across Ant Design versions; the accessible combobox is the
  // stable contract exposed by the rendered control.
  const combobox = page.getByRole('combobox', { name: /数据源类型/ });
  // Ant Design renders the readonly search input beneath the selected label;
  // the label can intercept a normal click, while a forced click still
  // dispatches the Select trigger event on the stable accessible control.
  await combobox.click({ force: true });
  await page.getByText(label, { exact: true }).last().click();
}

async function saveConfig(page: Page) {
  const responsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      response.request().method() === 'PUT' &&
      url.pathname === '/system-api/system/ip-config'
    );
  });
  await page.getByRole('button', { name: '保存配置' }).click();
  const response = await responsePromise;
  expect(response.ok()).toBe(true);
  const payload = await response.json();
  expect(payload?.code).toBe(0);
  await expect(page.getByText('保存成功').last()).toBeVisible();
}

test('administrator can apply and persist the strict Bilibili IP preset', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const serverErrors: string[] = [];
  page.on('response', (response) => {
    const path = new URL(response.url()).pathname;
    if (path.startsWith('/system-api/') && response.status() >= 500) {
      serverErrors.push(`${response.status()} ${path}`);
    }
  });

  const accessToken = await authLogin(page);
  await page.goto('/system/ip-config', { waitUntil: 'networkidle' });
  await expect(page.locator('body')).toContainText('IP 归属地数据源');
  await expect(page.locator('body')).toContainText(
    'Bilibili：校验 code 与 data.addr',
  );
  await expect(page.locator('body')).not.toContainText(
    'http://ip-api.com/json/{ip}',
  );

  await chooseSource(page, 'Bilibili IP 归属地');
  await expect(formField(page, '数据源名称')).toHaveValue('bilibili');
  await expect(formField(page, '接口地址(apiUrl)')).toHaveValue(
    bilibiliApiUrl,
  );
  await expect(formField(page, '解析规则(parseRule)')).toHaveValue(
    /\$\.data\.country.*\$\.data\.latitude.*\$\.data\.longitude/,
  );
  await saveConfig(page);

  const saved = await page.evaluate(async (token) => {
    const response = await fetch('/system-api/system/ip-config', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.json();
  }, accessToken);
  expect(saved?.code).toBe(0);
  expect(saved?.data?.dataSourceName).toBe('bilibili');
  expect(saved?.data?.apiUrl).toBe(bilibiliApiUrl);

  await chooseSource(page, '内置默认源：ipwho.is（推荐）');
  await saveConfig(page);
  expect(serverErrors).toEqual([]);
});
