import type { Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import { stubPublicSiteConfig } from './common/network';

const FIXTURE_PATH = '/__tests__/fixtures/admin-access-atlas.html';
const FIXTURE_TITLE = 'AdminAccessAtlas browser fixture';

function captureRuntimeErrors(page: Page) {
  const runtimeErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  return runtimeErrors;
}

async function openAtlasFixture(page: Page) {
  await stubPublicSiteConfig(page);
  await page.goto(FIXTURE_PATH, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveTitle(FIXTURE_TITLE);
  await page.waitForFunction(
    () => Boolean((window as any).__adminAccessAtlasFixture?.ready),
    undefined,
    { timeout: 90_000 },
  );
  const fixtureError = await page.evaluate(
    () => (window as any).__adminAccessAtlasFixture?.error ?? '',
  );
  expect(fixtureError).toBe('');
  await expect(page.locator('.admin-access-atlas')).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page, label: string) {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const root = document.documentElement;
          const body = document.body;
          return (
            Math.max(root.scrollWidth, body?.scrollWidth ?? 0) -
            root.clientWidth
          );
        }),
      { message: `${label} must not cause root-level horizontal scrolling` },
    )
    .toBeLessThanOrEqual(1);
}

test.describe.configure({ timeout: 120_000 });

test('shows the default 3D globe and complete location details', async ({
  page,
}) => {
  const runtimeErrors = captureRuntimeErrors(page);
  await page.setViewportSize({ height: 900, width: 1440 });
  await openAtlasFixture(page);

  const atlas = page.locator('.admin-access-atlas');
  const details = atlas.locator('.admin-access-atlas__list');
  const detailRows = details.locator('.atlas-location-row');

  await expect(
    atlas.getByRole('heading', { name: '访问态势图册' }),
  ).toBeVisible();
  const canvas = atlas.locator('.admin-globe-3d__canvas');
  await expect(canvas).toBeVisible();
  const canvasBox = await canvas.boundingBox();
  expect(canvasBox?.width).toBeGreaterThan(200);
  expect(canvasBox?.height).toBeGreaterThan(200);

  await expect(details).toBeVisible();
  await expect(detailRows).toHaveCount(5);
  await expect(details).toContainText('北京市');
  await expect(details).toContainText('台湾');
  await expect(details).toContainText('香港');
  await expect(details).toContainText('澳门');
  await expect(details).toContainText('纽约');
  await expect(detailRows.first()).toContainText('900');

  expect(runtimeErrors).toEqual([]);
});

test('switches 2D maps and metrics without dropping location details', async ({
  page,
}) => {
  const runtimeErrors = captureRuntimeErrors(page);
  await page.setViewportSize({ height: 900, width: 1440 });
  await openAtlasFixture(page);

  const atlas = page.locator('.admin-access-atlas');
  const details = atlas.locator('.admin-access-atlas__list');
  const detailRows = details.locator('.atlas-location-row');

  await atlas
    .getByRole('button', { exact: true, name: '2D 平面' })
    .click();
  const worldMap = atlas.getByRole('img', {
    name: '全球国家访问位置地图',
  });
  await expect(worldMap).toBeVisible();
  await expect(worldMap.locator('.world-access-map__point')).toHaveCount(5);

  await atlas.getByRole('button', { exact: true, name: '失败数' }).click();
  await expect(atlas.locator('.atlas-window')).toContainText('失败请求');
  await expect(worldMap.locator('.point-core--danger')).toHaveCount(5);
  await expect(details).toBeVisible();
  await expect(detailRows).toHaveCount(5);
  await expect(detailRows.first()).toContainText('纽约');
  await expect(detailRows.first()).toContainText('96');

  await atlas
    .getByRole('button', { exact: true, name: '中国（含港澳台）' })
    .click();
  const chinaMap = atlas.getByRole('img', {
    name: '中国省级访问位置地图，包含香港澳门台湾',
  });
  await expect(chinaMap).toBeVisible();
  await expect(chinaMap.locator('.china-access-map__point')).toHaveCount(4);
  await expect(chinaMap.locator('.point-core--danger')).toHaveCount(4);
  await expect(details).toBeVisible();
  await expect(detailRows).toHaveCount(4);
  await expect(details).toContainText('台湾');
  await expect(details).toContainText('香港');
  await expect(details).toContainText('澳门');
  await expect(details).not.toContainText('纽约');

  await atlas.getByRole('button', { exact: true, name: '调用数' }).click();
  await expect(atlas.locator('.atlas-window')).toContainText('调用次数');
  await expect(chinaMap.locator('.point-core--danger')).toHaveCount(0);
  await expect(detailRows.first()).toContainText('北京市');
  await expect(detailRows.first()).toContainText('900');

  expect(runtimeErrors).toEqual([]);
});

for (const viewport of [
  { height: 900, label: 'desktop', width: 1440 },
  { height: 844, label: 'mobile', width: 390 },
]) {
  test(`${viewport.label} fixture has no horizontal overflow`, async ({
    page,
  }) => {
    const runtimeErrors = captureRuntimeErrors(page);
    await page.setViewportSize({
      height: viewport.height,
      width: viewport.width,
    });
    await openAtlasFixture(page);

    await expectNoHorizontalOverflow(page, viewport.label);
    await expect(page.locator('.admin-access-atlas__list')).toBeVisible();
    expect(runtimeErrors).toEqual([]);
  });
}
