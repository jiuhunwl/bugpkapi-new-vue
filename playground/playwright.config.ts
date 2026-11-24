import type { PlaywrightTestConfig } from '@playwright/test';

import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

import { devices } from '@playwright/test';

const playwrightPort = Number(
  process.env.PLAYWRIGHT_PORT || process.env.VITE_PORT || 5555,
);
const playwrightHost = process.env.PLAYWRIGHT_HOST || '127.0.0.1';
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ||
  `http://${playwrightHost}:${playwrightPort}`;
const useExternalWebServer = process.env.PLAYWRIGHT_EXTERNAL_SERVER === '1';
const playwrightShutdownToken =
  process.env.PLAYWRIGHT_SHUTDOWN_TOKEN || randomBytes(32).toString('hex');
if (!useExternalWebServer) {
  process.env.PLAYWRIGHT_SHUTDOWN_TOKEN = playwrightShutdownToken;
}

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
const config: PlaywrightTestConfig = {
  expect: {
    /**
     * Maximum time expect() should wait for the condition to be met.
     * For example in `await expect(locator).toHaveText();`
     */
    timeout: 5000,
  },
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  globalSetup: './__tests__/e2e/global-setup.ts',
  globalTeardown: './__tests__/e2e/global-teardown.ts',
  /* Folder for test artifacts such as screenshots, videos, traces, etc. */
  outputDir: 'node_modules/.e2e/test-results/',
  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    // {
    //   name: 'firefox',
    //   use: {
    //     ...devices['Desktop Firefox'],
    //   },
    // },
    // {
    //   name: 'webkit',
    //   use: {
    //     ...devices['Desktop Safari'],
    //   },
    // },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: {
    //     ...devices['Pixel 5'],
    //   },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: {
    //     ...devices['iPhone 12'],
    //   },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: {
    //     channel: 'msedge',
    //   },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: {
    //     channel: 'chrome',
    //   },
    // },
  ],
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['list'],
    ['html', { outputFolder: 'node_modules/.e2e/playwright-report' }],
  ],
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  testDir: './__tests__/e2e',
  /* Maximum time one test can run for. */
  timeout: 30 * 1000,
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Maximum time each action such as `click()` can take. Defaults to 0 (no limit). */
    actionTimeout: 0,
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL,
    /* Run headless by default; set PW_HEADED=1 when visual debugging is needed. */
    headless: process.env.PW_HEADED !== '1',
    launchOptions: {
      args: ['--disable-logging', '--log-file=NUL'],
      env: {
        ...process.env,
        CHROME_LOG_FILE: resolve('node_modules/.e2e/chromium-debug.log'),
      },
    },
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'retain-on-failure',
  },

  /* Run your local dev server before starting the tests */
  webServer: useExternalWebServer
    ? undefined
    : {
        command: `node ../node_modules/vite/bin/vite.js --mode development --host ${playwrightHost} --port ${playwrightPort}`,
        env: {
          ...process.env,
          PLAYWRIGHT_INTERNAL_SERVER: '1',
          PLAYWRIGHT_SHUTDOWN_TOKEN: playwrightShutdownToken,
          VITE_PORT: `${playwrightPort}`,
        },
        reuseExistingServer: true,
        timeout: 120 * 1000,
        url: baseURL,
      },

  /*
   * The full suite mutates auth state and exercises one shared dev server.
   * Keep the default run serial so `pnpm test:e2e` reports product failures,
   * not cross-test storage or bootstrap contention.
   */
  workers: 1,
};

export default config;
