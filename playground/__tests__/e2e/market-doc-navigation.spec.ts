import { expect, test } from '@playwright/test';

import {
  collectRequestPaths,
  expectNoSystemRequestsUnderOpenApi,
} from './common/network';

async function mockMarketDocs(page: import('@playwright/test').Page) {
  await page.route('**/system-api/site/config', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: {
        code: 0,
        data: {
          copyright: 'Copyright 2026 BugPk-Api',
          description: 'Unified API platform',
          icp: 'BugPk-Api',
          logoUrl: '/favicon.ico',
          siteName: 'BugPk-Api',
          slogan: 'Stable API service platform',
        },
        error: null,
        message: 'ok',
      },
      status: 200,
    });
  });

  await page.route(/\/system-api\/market\/apis(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: {
        code: 0,
        data: {
          items: [
            {
              apiCode: 'demo_doc_api',
              avatarUrl: '',
              callCount: 42,
              description: 'Demo API used to verify document navigation.',
              id: '1',
              isFeatured: 1,
              isTop: 1,
              name: 'Demo Document API',
              pointPrice: 0,
              price: 0,
              priceLabel: 'Free',
              requestMethod: 'GET',
            },
          ],
          total: 1,
        },
        error: null,
        message: 'ok',
      },
      status: 200,
    });
  });

  await page.route('**/system-api/market/apis/1', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: {
        code: 0,
        data: {
          apiCode: 'demo_doc_api',
          auth: {
            description: 'Pass the API key in query or header.',
            location: 'Query',
            name: 'key',
            type: 'API Key',
          },
          avatarUrl: '',
          callCount: 42,
          callTrend7d: [{ date: '2026-07-03', label: '07-03', value: 42 }],
          description: 'Demo API used to verify document navigation.',
          gatewayPath: '/api/demo_doc_api',
          gatewayUrlTemplate: '/api/demo_doc_api?q={q}',
          id: '1',
          isFeatured: 1,
          isTop: 1,
          name: 'Demo Document API',
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
          requestMethod: 'GET',
          responseExample: '{"code":0,"message":"ok"}',
          responseFields: [
            { description: 'Status code', name: 'code', type: 'number' },
          ],
          responseType: 'JSON',
          statusCodes: [{ code: 200, description: 'OK' }],
          templateParameters: ['q'],
        },
        error: null,
        message: 'ok',
      },
      status: 200,
    });
  });

  await page.route('**/system-api/market/apis/1/test-key', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: {
        code: 0,
        data: {
          hasKey: false,
          keyScope: '',
          message: 'Create a key first',
          secretKey: '',
        },
        error: null,
        message: 'ok',
      },
      status: 200,
    });
  });
}

test.describe('Market Document Navigation', () => {
  test('opens API documentation from the market card', async ({ page }) => {
    const paths = collectRequestPaths(page);
    await mockMarketDocs(page);

    const marketListResponse = page.waitForResponse(
      (response) =>
        /\/system-api\/market\/apis(?:\?.*)?$/.test(response.url()) &&
        response.status() === 200,
    );

    await page.goto('/apilist', { waitUntil: 'domcontentloaded' });
    await marketListResponse;

    const card = page.locator('.api-card', { hasText: 'Demo Document API' });
    await expect(card).toBeVisible();
    await card.click();

    await expect(page).toHaveURL(/\/docs\/1(?:\?|$)/);
    await expect(page.locator('.docs-page')).toBeVisible();
    await expect(page.locator('.docs-breadcrumb')).toContainText(
      'Demo Document API',
    );
    await expect(page.locator('#parameters')).toContainText('q');

    expectNoSystemRequestsUnderOpenApi(paths);
  });
});
