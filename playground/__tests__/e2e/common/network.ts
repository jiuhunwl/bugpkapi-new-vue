import type { BrowserContext, Page } from '@playwright/test';

import { expect } from '@playwright/test';

const forbiddenSystemApiPattern =
  /^\/api\/(advertisement|auth|user|system|payment|notice|site|friend-links|menu|key|package|dashboard|interface|risk-control|upload|market|home|donation)(\/|$)/;

export function collectRequestPaths(page: Page) {
  const paths: string[] = [];
  page.on('request', (request) => {
    paths.push(new URL(request.url()).pathname);
  });
  return paths;
}

export function collectContextRequestPaths(context: BrowserContext) {
  const paths: string[] = [];
  context.on('request', (request) => {
    paths.push(new URL(request.url()).pathname);
  });
  return paths;
}

export function expectNoSystemRequestsUnderOpenApi(paths: string[]) {
  expect(paths.filter((path) => forbiddenSystemApiPattern.test(path))).toEqual(
    [],
  );
}

export async function stubPublicSiteConfig(page: Page) {
  await page.route(/\/system-api\/site\/config$/, async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: {
        code: 0,
        data: { siteName: 'BugPk-Api' },
        error: null,
        message: 'ok',
      },
      status: 200,
    });
  });
}

export async function waitForAppVisible(page: {
  waitForFunction: (
    pageFunction: () => boolean,
    options?: { timeout: number },
  ) => Promise<unknown>;
}) {
  await page.waitForFunction(
    () => {
      const app = document.querySelector('#app');
      const loading = document.querySelector<HTMLElement>('#__app-loading__');
      const loadingStyle = loading ? window.getComputedStyle(loading) : null;
      const loadingVisible = Boolean(
        loading &&
        !loading.classList.contains('hidden') &&
        loadingStyle?.display !== 'none' &&
        loadingStyle?.visibility !== 'hidden',
      );
      return Boolean(app?.childElementCount) && !loadingVisible;
    },
    { timeout: 30_000 },
  );
}
