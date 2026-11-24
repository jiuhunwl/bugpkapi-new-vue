import type { AddressInfo } from 'node:net';

import { createServer } from 'node:http';

import type { Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import { authLogin } from './common/auth';

interface ApiEnvelope<T> {
  code: number;
  data: T;
  message?: string;
}

interface Advertisement {
  description?: string;
  id: string;
  linkTarget: '_blank' | '_self';
  linkUrl?: string;
  name: string;
  payload?: Record<string, unknown>;
  placement: string;
  status: 0 | 1;
  title: string;
}

interface CustomCodeConfig {
  cssCode: string;
  enabled: 0 | 1;
  jsCode: string;
  updateTime?: string;
}

interface InterfaceItem {
  apiCode: string;
  id: string;
  name: string;
}

interface KeyResult {
  id: string;
  secretKey: string;
}

const placements = [
  'HOME',
  'CONSOLE',
  'NOTICE',
  'SERVICE_PROVIDER',
  'API_RESPONSE',
] as const;

async function adminApi<T>(
  page: Page,
  accessToken: string,
  method: string,
  path: string,
  data?: unknown,
) {
  const response = await page.request.fetch(path, {
    data,
    failOnStatusCode: false,
    headers: { Authorization: `Bearer ${accessToken}` },
    method,
  });
  const body = (await response.json()) as ApiEnvelope<T>;
  expect(response.status(), `${method} ${path}`).toBeLessThan(500);
  expect(body.code, `${method} ${path}: ${body.message ?? ''}`).toBe(0);
  return body.data;
}

async function bestEffortDelete(
  page: Page,
  accessToken: string,
  path: string,
) {
  await page.request
    .delete(path, {
      failOnStatusCode: false,
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    .catch(() => undefined);
}

test.describe('Advertising, delivery policy, and custom code', () => {
  test('connects admin configuration to public rendering and gateway delivery', async ({
    page,
  }) => {
    test.setTimeout(120_000);

    const marker = `${Date.now()}`;
    const createdAdvertisementIds: string[] = [];
    let createdInterfaceId = '';
    let createdKeyId = '';
    let originalCustomCode: CustomCodeConfig | undefined;
    let mockRequestCount = 0;
    let mockListening = false;

    const mockServer = createServer((_request, response) => {
      mockRequestCount += 1;
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(
        JSON.stringify({
          code: 0,
          data: { count: mockRequestCount, source: 'e2e-upstream' },
        }),
      );
    });

    const stopMockServer = async () => {
      if (!mockListening) return;
      mockListening = false;
      await new Promise<void>((resolve, reject) => {
        mockServer.close((error) => {
          if (error) reject(error);
          else resolve();
        });
        mockServer.closeAllConnections?.();
      });
    };

    const accessToken = await authLogin(page);

    try {
      originalCustomCode = await adminApi<CustomCodeConfig>(
        page,
        accessToken,
        'GET',
        '/system-api/system/custom-code',
      );

      const advertisements = new Map<string, Advertisement>();
      for (const placement of placements) {
        const created = await adminApi<Advertisement>(
          page,
          accessToken,
          'POST',
          '/system-api/advertisement/admin',
          {
            description: `E2E ${placement} description ${marker}`,
            endTime: '',
            imageUrl: '',
            linkTarget: '_blank',
            linkUrl: `https://example.com/e2e/${placement.toLowerCase()}`,
            name: `e2e-${placement.toLowerCase()}-${marker}`,
            payload: { campaign: marker, placement },
            placement,
            sortNo: 90_000,
            startTime: '',
            status: 1,
            title: `E2E ${placement} ${marker}`,
          },
        );
        createdAdvertisementIds.push(created.id);
        advertisements.set(placement, created);
      }

      const provider = advertisements.get('SERVICE_PROVIDER');
      expect(provider).toBeDefined();
      const providerTitle = `E2E Provider Updated ${marker}`;
      await adminApi<boolean>(
        page,
        accessToken,
        'PUT',
        `/system-api/advertisement/admin/${provider!.id}`,
        {
          description: `Updated service provider ${marker}`,
          endTime: '',
          imageUrl: '',
          linkTarget: '_blank',
          linkUrl: 'https://example.com/e2e/provider-updated',
          name: provider!.name,
          payload: { campaign: marker, updated: true },
          placement: 'SERVICE_PROVIDER',
          sortNo: 90_001,
          startTime: '',
          status: 1,
          title: providerTitle,
        },
      );
      const providerDetail = await adminApi<Advertisement>(
        page,
        accessToken,
        'GET',
        `/system-api/advertisement/admin/${provider!.id}`,
      );
      expect(providerDetail.title).toBe(providerTitle);
      expect(providerDetail.payload).toEqual({
        campaign: marker,
        updated: true,
      });

      for (const placement of placements.slice(0, 4)) {
        const response = await page.request.get(
          `/system-api/advertisement/public?placement=${placement}`,
        );
        expect(response.ok()).toBe(true);
        const body = (await response.json()) as ApiEnvelope<
          Record<string, unknown>[]
        >;
        expect(body.code).toBe(0);
        const publicAdvertisement = body.data.find(
          (item) => String(item.id) === advertisements.get(placement)?.id,
        );
        expect(publicAdvertisement).toBeDefined();
        for (const internalField of [
          'createTime',
          'endTime',
          'name',
          'payload',
          'sortNo',
          'startTime',
          'status',
          'updateTime',
        ]) {
          expect(publicAdvertisement).not.toHaveProperty(internalField);
        }
      }

      const responseAdPublicAttempt = await page.request.get(
        '/system-api/advertisement/public?placement=API_RESPONSE',
        { failOnStatusCode: false },
      );
      const responseAdPublicBody = (await responseAdPublicAttempt.json()) as {
        code: number;
      };
      expect(responseAdPublicBody.code).not.toBe(0);

      await page.goto('/content/advertisements', {
        waitUntil: 'domcontentloaded',
      });
      await expect(page.getByText(provider!.name).first()).toBeVisible({
        timeout: 15_000,
      });

      const serviceProviderResponse = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return (
          url.pathname === '/system-api/advertisement/public' &&
          url.searchParams.get('placement') === 'SERVICE_PROVIDER'
        );
      });
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      expect((await serviceProviderResponse).ok()).toBe(true);
      await expect(page.locator('.service-provider-ad')).toContainText(
        providerTitle,
        { timeout: 15_000 },
      );
      const providerLink = page.locator('.service-provider-ad__name');
      await expect(providerLink).toHaveAttribute(
        'href',
        'https://example.com/e2e/provider-updated',
      );
      await expect(providerLink).toHaveAttribute(
        'rel',
        /noopener noreferrer sponsored/,
      );

      const cssCode = `html { --bugpk-e2e-custom-code: ${marker}px; }`;
      const jsCode = `window.__bugpkCustomCodeE2E = ${JSON.stringify(marker)};`;
      await adminApi<boolean>(
        page,
        accessToken,
        'PUT',
        '/system-api/system/custom-code',
        { cssCode, enabled: 1, jsCode, updateTime: '' },
      );
      const publicCustomCodeResponse = await page.request.get(
        '/system-api/site/custom-code',
      );
      const publicCustomCode = (
        (await publicCustomCodeResponse.json()) as ApiEnvelope<CustomCodeConfig>
      ).data;
      expect(publicCustomCode).toMatchObject({ cssCode, enabled: 1, jsCode });

      await page.goto(`/?custom-code-e2e=${marker}`, {
        waitUntil: 'domcontentloaded',
      });
      const customStyle = page.locator(
        'style[data-source="bugpk-admin-custom-code"]',
      );
      await expect(customStyle).toHaveCount(1, { timeout: 15_000 });
      expect(await customStyle.textContent()).toContain(cssCode);
      await page.waitForFunction(
        (expected) => Reflect.get(window, '__bugpkCustomCodeE2E') === expected,
        marker,
      );

      await new Promise<void>((resolve, reject) => {
        mockServer.once('error', reject);
        mockServer.listen(0, '127.0.0.1', () => {
          mockServer.off('error', reject);
          mockListening = true;
          resolve();
        });
      });
      const mockAddress = mockServer.address() as AddressInfo;
      const apiCode = `e2e_cache_${marker}`;
      const interfaceItem = await adminApi<InterfaceItem>(
        page,
        accessToken,
        'POST',
        '/system-api/interface',
        {
          apiCode,
          avatarUrl: '',
          isFeatured: 0,
          isTop: 0,
          name: `E2E Cache ${marker}`,
          pointPrice: 0,
          pollingEnabled: 0,
          pollingMode: 'SINGLE',
          price: '0.0000',
          remark: 'conditional cache and response advertisement e2e',
          requestMethod: 'GET',
          requestUrl: `http://127.0.0.1:${mockAddress.port}/cache-probe`,
          status: 1,
          upstreamConfigs: [],
          upstreamUrls: [],
        },
      );
      createdInterfaceId = interfaceItem.id;

      const responseAdvertisement = advertisements.get('API_RESPONSE');
      expect(responseAdvertisement).toBeDefined();
      await adminApi<boolean>(
        page,
        accessToken,
        'PUT',
        `/system-api/interface/${createdInterfaceId}/delivery-policy`,
        {
          cacheDefaultTtlSeconds: 1,
          cacheEnabled: 1,
          cacheRules: [
            {
              expectedValue: '0',
              fieldName: 'code',
              name: 'successful JSON response',
              operator: 'EQ',
              sortNo: 1,
              statusCode: 200,
              ttlSeconds: 30,
            },
          ],
          responseAdEnabled: 1,
          responseAdField: '_e2eAd',
          responseAdId: responseAdvertisement!.id,
        },
      );
      const savedPolicy = await adminApi<Record<string, unknown>>(
        page,
        accessToken,
        'GET',
        `/system-api/interface/${createdInterfaceId}/delivery-policy`,
      );
      expect(savedPolicy).toMatchObject({
        cacheDefaultTtlSeconds: 1,
        cacheEnabled: 1,
        responseAdEnabled: 1,
        responseAdField: '_e2eAd',
        responseAdId: responseAdvertisement!.id,
      });

      const key = await adminApi<KeyResult>(
        page,
        accessToken,
        'POST',
        '/system-api/key',
        {
          expiresAt: null,
          interfaceIds: [],
          ipWhitelist: [],
          keyType: 'GLOBAL',
          name: `e2e-cache-key-${marker}`,
          status: 1,
        },
      );
      createdKeyId = key.id;
      expect(key.secretKey).toMatch(/^bp_live_/);

      const gatewayHeaders = { 'X-API-Key': key.secretKey };
      const firstGatewayResponse = await page.request.get(
        `/api/${apiCode}?probe=conditional-cache`,
        { headers: gatewayHeaders },
      );
      expect(firstGatewayResponse.ok()).toBe(true);
      const firstGatewayBody = (await firstGatewayResponse.json()) as Record<
        string,
        any
      >;
      expect(firstGatewayBody.data).toMatchObject({
        count: 1,
        source: 'e2e-upstream',
      });
      expect(firstGatewayBody._e2eAd).toMatchObject({
        name: responseAdvertisement!.title,
        url: responseAdvertisement!.linkUrl,
      });
      expect(mockRequestCount).toBe(1);

      await stopMockServer();
      await page.waitForTimeout(1250);

      const cachedGatewayResponse = await page.request.get(
        `/api/${apiCode}?probe=conditional-cache`,
        { headers: gatewayHeaders },
      );
      expect(cachedGatewayResponse.ok()).toBe(true);
      const cachedGatewayBody = (await cachedGatewayResponse.json()) as Record<
        string,
        any
      >;
      expect(cachedGatewayBody.data).toMatchObject({
        count: 1,
        source: 'e2e-upstream',
      });
      expect(cachedGatewayBody._e2eAd).toMatchObject({
        name: responseAdvertisement!.title,
        url: responseAdvertisement!.linkUrl,
      });
      expect(mockRequestCount).toBe(1);

      // Open-gateway QPS accounting is second-bucketed. Move the intentional
      // cache miss into the next bucket so the assertion exercises upstream
      // failure sanitization instead of the independent rate limiter.
      await page.waitForTimeout(1100);

      const failedGatewayResponse = await page.request.get(
        `/api/${apiCode}?probe=uncached-failure`,
        { failOnStatusCode: false, headers: gatewayHeaders },
      );
      expect(failedGatewayResponse.status()).toBe(502);
      const failedGatewayText = await failedGatewayResponse.text();
      const failedGatewayBody = JSON.parse(failedGatewayText) as {
        code: number;
        message: string;
      };
      expect(failedGatewayBody.code).toBe(-1);
      expect(failedGatewayBody.message).toBeTruthy();
      for (const leakedDetail of [
        '127.0.0.1',
        `${mockAddress.port}`,
        'cache-probe',
        'connectex',
        'connection refused',
      ]) {
        expect(failedGatewayText.toLowerCase()).not.toContain(
          leakedDetail.toLowerCase(),
        );
      }
    } finally {
      await stopMockServer().catch(() => undefined);
      if (originalCustomCode) {
        await page.request
          .put('/system-api/system/custom-code', {
            data: {
              cssCode: originalCustomCode.cssCode,
              enabled: originalCustomCode.enabled,
              jsCode: originalCustomCode.jsCode,
              updateTime: '',
            },
            failOnStatusCode: false,
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          .catch(() => undefined);
      }
      await bestEffortDelete(
        page,
        accessToken,
        `/system-api/key/${createdKeyId}`,
      );
      await bestEffortDelete(
        page,
        accessToken,
        `/system-api/interface/${createdInterfaceId}`,
      );
      for (const id of createdAdvertisementIds.reverse()) {
        await bestEffortDelete(
          page,
          accessToken,
          `/system-api/advertisement/admin/${id}`,
        );
      }
    }
  });
});
