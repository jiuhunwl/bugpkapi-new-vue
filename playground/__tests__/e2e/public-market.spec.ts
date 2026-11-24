import type { Page, Route } from '@playwright/test';

import { expect, test } from '@playwright/test';

import { collectRequestPaths, expectNoSystemRequestsUnderOpenApi } from './common/network';

function apiItem(id: number, name = 'Catalog API ' + id) {
  return {
    id: String(id), name, description: 'Public description ' + id,
    requestMethod: 'GET', price: '0', pointPrice: 0, priceLabel: '免费',
    callCount: 4321, isFeatured: 1, isTop: 0,
  };
}

const firstPage = Array.from({ length: 12 }, (_, index) => apiItem(101 + index));

type MarketHandler = (route: Route, url: URL) => Promise<void>;

async function respond(route: Route, items = firstPage, total = items.length) {
  await route.fulfill({ json: { code: 0, data: { items, total } } });
}

async function mockMarket(page: Page, handler: MarketHandler = (route) => respond(route)) {
  const requests: URL[] = [];
  await page.route('**/system-api/**', async (route) => {
    const url = new URL(route.request().url());
    expect(route.request().method()).toBe('GET');
    if (url.pathname === '/system-api/market/apis') {
      requests.push(url);
      await handler(route, url);
      return;
    }
    await route.fulfill({ json: { code: 0, data: url.pathname === '/system-api/site/config' ? { siteName: 'BugPk API' } : [] } });
  });
  return requests;
}

function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

async function expectQuery(page: Page, expected: Record<string, string>) {
  await expect.poll(() => Object.fromEntries(new URL(page.url()).searchParams)).toEqual(expected);
}

test('market normalizes invalid and duplicate URL values before its first request', async ({ page }) => {
  const paths = collectRequestPaths(page);
  const requests = await mockMarket(page);
  await page.goto('/apilist?requestMethod=DELETE&priceType=free&priceType=POINT&featuredOnly=0&keyword=%20weather%20&unknown=1#catalog');
  await expectQuery(page, { keyword: 'weather', priceType: 'FREE' });
  expect(new URL(page.url()).hash).toBe('#catalog');
  await expect(page.getByTestId('market-ledger')).toContainText('Catalog API 101');
  await expect(page.getByTestId('market-filter-method')).toHaveValue('');
  await expect(page.getByTestId('market-filter-price')).toHaveValue('FREE');
  expect(requests).toHaveLength(1);
  expect(requests[0]!.searchParams.get('page')).toBe('1');
  expect(requests[0]!.searchParams.has('requestMethod')).toBe(false);
  expectNoSystemRequestsUnderOpenApi(paths);
});

test('market exposes paid filters and removable accessible chips backed by the URL', async ({ page }) => {
  await mockMarket(page);
  await page.goto('/apilist');
  await page.getByTestId('market-filter-method').selectOption('POST');
  await page.getByTestId('market-filter-price').selectOption('PAID');
  await page.getByTestId('market-filter-featured').getByRole('checkbox').check();
  await page.getByRole('searchbox').fill('weather');
  await page.getByRole('button', { name: /搜索接口|search apis/i }).click();
  await expectQuery(page, { keyword: 'weather', priceType: 'PAID', requestMethod: 'POST', featuredOnly: '1' });
  await expect(page.getByTestId('market-active-filters')).toContainText('POST');
  await page.getByTestId('market-remove-requestMethod').focus();
  await page.keyboard.press('Space');
  await expectQuery(page, { keyword: 'weather', priceType: 'PAID', featuredOnly: '1' });
  await page.getByTestId('market-remove-keyword').click();
  await expect(page.getByRole('searchbox')).toHaveValue('');
  await page.getByTestId('market-remove-priceType').click();
  await page.getByTestId('market-remove-featuredOnly').click();
  await expectQuery(page, {});
});

for (const oldFails of [false, true]) {
  test('market ignores an older ' + (oldFails ? 'failure' : 'result') + ' after a newer search', async ({ page }) => {
    const gate = deferred();
    const requests = await mockMarket(page, async (route, url) => {
      if (!url.searchParams.get('keyword')) {
        await gate.promise;
        if (oldFails) await route.fulfill({ status: 503, json: { code: 1, message: 'old unavailable' } });
        else await respond(route, [apiItem(1, 'Old API')]);
      } else {
        await respond(route, [apiItem(2, 'New API')]);
      }
    });
    try {
      await page.goto('/apilist', { waitUntil: 'domcontentloaded' });
      await expect.poll(() => requests.length).toBeGreaterThan(0);
      await page.getByRole('searchbox').fill('new');
      await page.getByRole('button', { name: /搜索接口|search apis/i }).click();
      await expect(page.getByTestId('market-ledger')).toContainText('New API');
      gate.release();
      await page.waitForLoadState('networkidle');
      await expect(page.getByTestId('market-ledger')).not.toContainText('Old API');
      await expect(page.getByTestId('market-error')).toHaveCount(0);
      await expect(page.getByTestId('market-total')).toContainText('1');
    } finally {
      gate.release();
    }
  });
}

test('market loading does not pretend there are zero results', async ({ page }) => {
  const gate = deferred();
  await mockMarket(page, async (route) => { await gate.promise; await respond(route, [apiItem(1)]); });
  try {
    await page.goto('/apilist', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('market-loading')).toBeVisible();
    await expect(page.getByTestId('market-total')).toContainText('—');
    await expect(page.getByTestId('market-empty')).toHaveCount(0);
    gate.release();
    await expect(page.getByTestId('market-ledger')).toContainText('Catalog API 1');
  } finally {
    gate.release();
  }
});

test('market failed first page shows an explicit retry instead of empty data', async ({ page }) => {
  let fail = true;
  const requests = await mockMarket(page, async (route) => {
    if (fail) await route.fulfill({ status: 503, json: { code: 1, message: 'unavailable' } });
    else await respond(route, [apiItem(1, 'Recovered API')]);
  });
  await page.goto('/apilist');
  await expect(page.getByTestId('market-error')).toBeVisible();
  await expect(page.getByTestId('market-total')).toContainText('—');
  await expect(page.getByTestId('market-empty')).toHaveCount(0);
  fail = false;
  await page.getByTestId('market-retry').click();
  await expect(page.getByTestId('market-ledger')).toContainText('Recovered API');
  await expect(page.getByTestId('market-error')).toHaveCount(0);
  expect(requests.map((url) => url.searchParams.get('page'))).toEqual(['1', '1']);
});

test('market empty response has its own state and no load-more action', async ({ page }) => {
  await mockMarket(page, (route) => respond(route, []));
  await page.goto('/apilist');
  await expect(page.getByTestId('market-empty')).toBeVisible();
  await expect(page.getByTestId('market-total')).toContainText('0');
  await expect(page.getByTestId('market-error')).toHaveCount(0);
  await expect(page.getByTestId('market-load-more')).toHaveCount(0);
});

test('market failed append retries the same page without losing rows or changing URL', async ({ page }) => {
  let secondPageAttempts = 0;
  const requests = await mockMarket(page, async (route, url) => {
    if (url.searchParams.get('page') === '1') return respond(route, firstPage, 13);
    secondPageAttempts += 1;
    if (secondPageAttempts === 1) await route.fulfill({ status: 503, json: { code: 1, message: 'unavailable' } });
    else await respond(route, [apiItem(113, 'Final API')], 13);
  });
  await page.goto('/apilist?priceType=FREE');
  await expect(page.getByTestId('market-api-item')).toHaveCount(12);
  const originalUrl = page.url();
  await page.getByTestId('market-load-more').click();
  await expect(page.getByTestId('market-error')).toBeVisible();
  await expect(page.getByTestId('market-api-item')).toHaveCount(12);
  await page.getByTestId('market-retry').click();
  await expect(page.getByTestId('market-api-item')).toHaveCount(13);
  await expect(page.getByTestId('market-ledger')).toContainText('Final API');
  await expect(page.getByTestId('market-load-more')).toHaveCount(0);
  expect(page.url()).toBe(originalUrl);
  expect(requests.map((url) => url.searchParams.get('page'))).toEqual(['1', '2', '2']);
});

test('market filter changes discard an in-flight append and restart at page one', async ({ page }) => {
  const gate = deferred();
  const requests = await mockMarket(page, async (route, url) => {
    if (url.searchParams.get('requestMethod') === 'POST') return respond(route, [apiItem(200, 'Filtered API')]);
    if (url.searchParams.get('page') === '2') { await gate.promise; return respond(route, [apiItem(113, 'Stale append')], 13); }
    await respond(route, firstPage, 13);
  });
  try {
    await page.goto('/apilist');
    await page.getByTestId('market-load-more').click();
    await expect.poll(() => requests.some((url) => url.searchParams.get('page') === '2')).toBe(true);
    await page.getByTestId('market-filter-method').selectOption('POST');
    await expect(page.getByTestId('market-ledger')).toContainText('Filtered API');
    gate.release();
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('market-api-item')).toHaveCount(1);
    await expect(page.getByTestId('market-ledger')).not.toContainText('Stale append');
    const filtered = requests.filter((url) => url.searchParams.get('requestMethod') === 'POST');
    expect(filtered.map((url) => url.searchParams.get('page'))).toEqual(['1']);
  } finally {
    gate.release();
  }
});

for (const colorScheme of ['light', 'dark'] as const) {
  for (const width of [320, 768, 1440]) {
    test('market ledger reflows at ' + width + 'px in ' + colorScheme, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.addInitScript((mode) => {
        const namespace = 'bugpk-api-v0.0.0-dev-dev';
        localStorage.setItem(namespace + '-light-theme-migrated-v1', 'true');
        localStorage.setItem(namespace + '-preferences', JSON.stringify({ value: { theme: { mode } } }));
        localStorage.setItem(namespace + '-preferences-theme', JSON.stringify({ value: mode }));
      }, colorScheme);
      await mockMarket(page, (route) => respond(route, firstPage.slice(0, 5)));
      await page.goto('/apilist?requestMethod=GET&priceType=FREE');
      await expect(page.getByTestId('market-api-item')).toHaveCount(5);
      await page.evaluate((dark) => document.documentElement.classList.toggle('dark', dark), colorScheme === 'dark');
      const row = page.getByTestId('market-api-item').first();
      await expect(row).toContainText('101');
      await expect(row).toContainText('Public description 101');
      await expect(row).toContainText('GET');
      await expect(row).toContainText('4,321');
      await expect(row).toHaveAttribute('href', '/docs/101');
      for (const target of [page.getByTestId('market-filter-method'), page.getByTestId('market-filter-price'), page.getByTestId('market-remove-requestMethod'), page.getByRole('button', { name: /搜索接口|search apis/i })]) {
        const box = await target.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
        expect(box!.width).toBeGreaterThanOrEqual(44);
      }
      const boxes = await page.getByTestId('market-api-item').evaluateAll((elements) => elements.map((element) => {
        const box = element.getBoundingClientRect();
        return { left: box.left, right: box.right, client: element.clientWidth, scroll: element.scrollWidth };
      }));
      for (const box of boxes) {
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeLessThanOrEqual(width + 1);
        expect(box.scroll - box.client).toBeLessThanOrEqual(1);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: testInfo.outputPath('market-' + width + '-' + colorScheme + '.png'), fullPage: true, animations: 'disabled' });
    });
  }
}
