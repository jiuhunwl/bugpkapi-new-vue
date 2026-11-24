import { defineConfig } from '@playwright/test';

import baseConfig from './playwright.config';

// These admin contracts install their own mock backend before navigation.
// The full-suite warmup visits public pages without those mocks and requires a
// live backend, so it is intentionally not part of this isolated UI gate.
export default defineConfig({
  ...baseConfig,
  globalSetup: undefined,
  outputDir: 'node_modules/.e2e/interface-test-results',
  testMatch: ['**/interface-domain-polling.spec.ts', '**/interface-timeout-policy.spec.ts', '**/workspace-partial-stats.spec.ts'],
});
