import type { Page, Route } from '@playwright/test';

import { expect, test } from '@playwright/test';

function apiDetail(id: string, name = `Demo API ${id}`) {
  return {
    apiCode: `demo_${id}`,
    auth: {
      description: 'Pass the key in a header or query parameter.',
      location: 'Query',
      name: 'key',
      type: 'API Key',
    },
    avatarUrl: '',
    callCount: 4321,
    callTrend7d: [{ date: '2026-09-10', label: '09-10', value: 24 }],
    description: `${name} public documentation.`,
    gatewayPath: `/api/demo_${id}`,
    gatewayUrlTemplate: `/api/demo_${id}?q={q}`,
    id,
    isFeatured: 1,
    isTop: 0,
    name,
    parameters: [
      {
        description: 'Search keyword',
        exampleValue: 'bugpk',
        location: 'Query',
        name: 'q',
        placeholder: 'keyword',
        required: true,
        type: 'string',
      },
    ],
    pointPrice: 0,
    preferredMethod: 'GET',
    price: 0,
    priceLabel: 'Free',
    pricing: {
      description: 'Free test API.',
      label: 'Free',
      pointPrice: 0,
      price: 0,
    },
    requestMethod: 'GET_POST',
    responseExample: '{"code":0,"message":"ok"}',
    responseFields: [
      { description: 'Status code', name: 'code', type: 'number' },
    ],
    responseType: 'JSON',
    statusCodes: [{ code: 200, description: 'OK' }],
    templateParameters: ['q'],
  };
}

type DetailHandler = (route: Route, id: string) => Promise<void>;

async function fulfillDetail(route: Route, id: string, name?: string) {
  await route.fulfill({
    contentType: 'application/json',
    json: { code: 0, data: apiDetail(id, name), message: 'ok' },
    status: 200,
  });
}

async function mockDocs(
  page: Page,
  detailHandler: DetailHandler = (route, id) => fulfillDetail(route, id),
) {
  const detailRequests: string[] = [];
  let testKeyRequests = 0;

  await page.route('**/system-api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/system-api/site/config') {
      await route.fulfill({
        json: {
          code: 0,
          data: {
            description: 'Docs test platform',
            logoUrl: '/favicon.ico',
            siteName: 'Docs Test Site',
            slogan: 'Public API documentation',
          },
          message: 'ok',
        },
      });
      return;
    }
    if (url.pathname === '/system-api/site/custom-code') {
      await route.fulfill({
        json: { code: 0, data: { enabled: 0 }, message: 'ok' },
      });
      return;
    }
    if (url.pathname.includes('/test-key')) {
      testKeyRequests += 1;
      await route.fulfill({
        json: {
          code: 0,
          data: {
            hasKey: true,
            keys: [
              {
                id: 'secret-key-id',
                keyScope: 'GLOBAL',
                maskedKey: 'bp_****docs',
                name: 'Docs Key',
                secretAvailable: true,
              },
            ],
            message: 'Select a key',
          },
        },
      });
      return;
    }
    if (url.pathname === '/system-api/key/secret-key-id/secret') {
      await route.fulfill({
        json: {
          code: 0,
          data: { secretKey: 'SUPER_SECRET_DOC_KEY' },
          message: 'ok',
        },
      });
      return;
    }

    const detailMatch = url.pathname.match(
      /^\/system-api\/market\/apis\/([^/]+)$/,
    );
    if (detailMatch) {
      const id = decodeURIComponent(detailMatch[1]!);
      detailRequests.push(id);
      await detailHandler(route, id);
      return;
    }

    await route.fulfill({ json: { code: 0, data: [], message: 'ok' } });
  });

  return {
    detailRequests,
    getTestKeyRequests: () => testKeyRequests,
  };
}

function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

test('docs update SEO after detail load and expose a sticky desktop toc', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockDocs(page, (route, id) => fulfillDetail(route, id, 'Demo API'));

  await page.goto('/docs/42');
  // Wait for the app bootstrap separately from the UI interaction assertions.
  await expect(page.locator('.docs-page')).toBeVisible({ timeout: 15_000 });

  await expect(page.locator('.public-site-shell')).toBeVisible();
  await expect(page.locator('.docs-layout')).toBeVisible();
  await expect(page.locator('.docs-article')).toBeVisible();
  await expect(page.locator('.docs-overview h1')).toHaveCount(1);
  await expect(page.locator('.api-hero')).toHaveCount(0);
  const articleBox = await page.locator('.docs-article').boundingBox();
  const playgroundBox = await page.locator('.docs-playground').boundingBox();
  expect(articleBox!.width).toBeGreaterThan(850);
  expect(playgroundBox!.y).toBeGreaterThanOrEqual(
    articleBox!.y + articleBox!.height,
  );
  await page.locator('.docs-toc a[href="#parameters"]').click();
  await expect(page.locator('.docs-toc a[href="#parameters"]')).toHaveAttribute(
    'aria-current',
    'location',
  );
  await page.locator('.docs-toc a[href="#overview"]').click();
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.screenshot({
    path: testInfo.outputPath('docs-desktop.png'),
    fullPage: true,
  });
  const toc = page.locator('.docs-toc');
  await expect(toc).toBeVisible();
  await expect(toc).toHaveCSS('position', 'sticky');
  await expect(page).toHaveTitle(/Demo API - Docs Test Site/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    /\/docs\/42$/,
  );
});

test('docs route changes cannot be overwritten by an older request', async ({
  page,
}) => {
  const oldRequest = deferred();
  let oldCompleted = false;
  const requests = await mockDocs(page, async (route, id) => {
    if (id === '42') {
      await oldRequest.promise;
      await fulfillDetail(route, id, 'Old API');
      oldCompleted = true;
      return;
    }
    await fulfillDetail(route, id, 'New API');
  });

  try {
    await page.goto('/docs/42', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => requests.detailRequests).toEqual(['42']);
    await page.evaluate(() => {
      window.history.pushState({}, '', '/docs/43');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    await expect(page.getByRole('heading', { name: 'New API' })).toBeVisible();
    oldRequest.release();
    await expect.poll(() => oldCompleted).toBe(true);
    await expect(page.getByRole('heading', { name: 'New API' })).toBeVisible();
    await expect(page.locator('.docs-page')).not.toContainText('Old API');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      /\/docs\/43$/,
    );
  } finally {
    oldRequest.release();
  }
});

test('docs network failure exposes retry and recovers the same document', async ({
  page,
}) => {
  let attempts = 0;
  await mockDocs(page, async (route, id) => {
    attempts += 1;
    if (attempts === 1) {
      await route.fulfill({
        json: { code: 1, message: 'unavailable' },
        status: 503,
      });
      return;
    }
    await fulfillDetail(route, id, 'Recovered API');
  });

  await page.goto('/docs/42');
  // Wait for the app bootstrap separately from the UI interaction assertions.
  await expect(page.locator('.docs-page')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('docs-error')).toBeVisible();
  await page.getByTestId('docs-retry').click();
  await expect(
    page.getByRole('heading', { name: 'Recovered API' }),
  ).toBeVisible();
  expect(attempts).toBe(2);
});

test('docs 404 response renders a dedicated missing state', async ({
  page,
}) => {
  await mockDocs(page, async (route) => {
    await route.fulfill({
      json: { code: 1, message: 'not found' },
      status: 404,
    });
  });

  await page.goto('/docs/404');
  await expect(page.getByTestId('docs-not-found')).toBeVisible();
  await expect(page.getByTestId('docs-error')).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    /noindex/,
  );
});

test('docs mobile layout exposes jump navigation and stacks the explorer', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 820 });
  await mockDocs(page);

  await page.goto('/docs/42');
  // Wait for the app bootstrap separately from the UI interaction assertions.
  await expect(page.locator('.docs-page')).toBeVisible({ timeout: 15_000 });

  await expect(page.locator('.docs-jump-nav')).toBeVisible();
  await expect(page.locator('.docs-toc')).toBeHidden();
  await page.screenshot({
    path: testInfo.outputPath('docs-mobile.png'),
    fullPage: true,
  });
  const request = await page.locator('.request-builder').boundingBox();
  const response = await page.locator('.response-console').boundingBox();
  expect(request).not.toBeNull();
  expect(response).not.toBeNull();
  expect(response!.y).toBeGreaterThanOrEqual(request!.y + request!.height - 1);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1);
});

test('docs explorer requires login and keeps key material out of persistent surfaces', async ({
  page,
}) => {
  const consoleMessages: string[] = [];
  page.on('console', (message) => consoleMessages.push(message.text()));
  const requests = await mockDocs(page);

  await page.goto('/docs/42');
  // Wait for the app bootstrap separately from the UI interaction assertions.
  await expect(page.locator('.docs-page')).toBeVisible({ timeout: 15_000 });

  const explorer = page.locator('#online-test');
  await expect(explorer).toContainText(/登录|log in/i);
  await expect(
    explorer.getByRole('link', { name: /登录|log in/i }),
  ).toBeVisible();
  expect(requests.getTestKeyRequests()).toBe(0);
  expect(page.url()).not.toContain('SUPER_SECRET_DOC_KEY');
  expect(
    await page.evaluate(() =>
      [...Object.values(localStorage), ...Object.values(sessionStorage)].join(
        '\n',
      ),
    ),
  ).not.toContain('SUPER_SECRET_DOC_KEY');
  expect(consoleMessages.join('\n')).not.toContain('SUPER_SECRET_DOC_KEY');
  await expect(page.locator('body')).not.toContainText('SUPER_SECRET_DOC_KEY');
});

test('docs redesign shows readable fields and working first-screen entry points', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockDocs(page, async (route, id) => {
    const data = apiDetail(id, '文档布局验收');
    data.parameters.push({
      name: 'optional_long_parameter',
      type: 'string',
      location: 'Query',
      required: false,
      description: '可选参数描述',
      placeholder: '',
      exampleValue: 'example&value',
    });
    await route.fulfill({ json: { code: 0, data, message: 'ok' } });
  });
  await page.goto('/docs/42');
  await expect(page.locator('.docs-overview h1')).toBeVisible({
    timeout: 15000,
  });
  await expect(page.locator('.parameter-row')).toHaveCount(2);
  await expect(page.locator('.parameter-row').last()).toContainText('可选');
  await page.locator('.docs-overview__actions a[href="#examples"]').click();
  await expect(page.locator('#examples')).toBeInViewport();
  await page
    .locator('.language-tabs button')
    .getByText('Python', { exact: true })
    .click();
  await expect(page.locator('#examples pre')).toContainText('requests');
  await page
    .locator('.auth-tabs button')
    .getByText('Query', { exact: true })
    .click();
  await expect(page.locator('#examples pre')).toContainText('"key"');
  await page.locator('.docs-toc a[href="#online-test"]').click();
  await expect(page.locator('.request-builder')).toBeInViewport();
  expect(errors).toEqual([]);
});

test('docs sections remain usable at narrow widths and reflect the public theme', async ({
  page,
}, testInfo) => {
  await mockDocs(page);
  await page.goto('/docs/42');
  await expect(page.locator('.docs-overview h1')).toBeVisible({
    timeout: 15000,
  });
  for (const width of [360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
  }
  await page.evaluate(() => {
    document
      .querySelector<HTMLElement>('.docs-page')!
      .style.setProperty('--home-primary', 'rgb(20, 120, 90)');
  });
  await expect(page.locator('.docs-primary-action')).toHaveCSS(
    'background-color',
    'rgb(20, 120, 90)',
  );
  const before = await page
    .locator('.docs-overview h1')
    .evaluate((el) => getComputedStyle(el).color);
  await page.getByTestId('public-theme-toggle').click();
  await expect
    .poll(() =>
      page
        .locator('.docs-overview h1')
        .evaluate((el) => getComputedStyle(el).color),
    )
    .not.toBe(before);
  await page.screenshot({
    path: testInfo.outputPath('docs-theme-dark.png'),
    fullPage: false,
  });
});
