import { expect, test } from '@playwright/test';

import { stubPublicSiteConfig } from './common/network';

interface SmokeResult {
  error: string;
  ready: boolean;
  results: Record<string, { seriesIds: string[] }>;
}

test.describe.configure({ timeout: 120_000 });

test('executes China 2D, world 2D and globe 3D options in real ECharts', async ({
  page,
}) => {
  const runtimeErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  page.on('pageerror', (error) => runtimeErrors.push(error.message));

  await stubPublicSiteConfig(page);
  await page.goto('/__tests__/fixtures/admin-access-map-options.html', {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(
    () => Boolean((window as any).__adminAccessEChartsSmoke?.ready),
    undefined,
    { timeout: 90_000 },
  );

  const smoke = await page.evaluate(
    () => (window as any).__adminAccessEChartsSmoke as SmokeResult,
  );
  expect(smoke.error).toBe('');
  expect(smoke.results['china-2d']?.seriesIds).toContain('access-hotspots');
  expect(smoke.results['china-2d']?.seriesIds).toContain(
    'china-south-sea-lines',
  );
  expect(smoke.results['world-2d']?.seriesIds).toContain('access-hotspots');
  expect(smoke.results['world-2d']?.seriesIds).toContain(
    'world-china-south-sea-lines',
  );
  expect(smoke.results['globe-3d']?.seriesIds).toContain('access-hotspots');
  expect(smoke.results['globe-3d']?.seriesIds).toContain(
    'globe-world-boundaries',
  );
  expect(smoke.results['globe-3d']?.seriesIds).toContain(
    'globe-china-south-sea-lines',
  );
  await expect(page.locator('#china-2d canvas').first()).toBeVisible();
  await expect(page.locator('#world-2d canvas').first()).toBeVisible();
  await expect(page.locator('#globe-3d canvas').first()).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});
