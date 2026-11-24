import { readFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';

const chromiumDebugLog = resolve('debug.log');

function isLoopbackHostname(hostname: string) {
  const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return (
    normalized === '::1' ||
    normalized === 'localhost' ||
    normalized.startsWith('127.')
  );
}

export default async function globalTeardown() {
  if (process.env.PLAYWRIGHT_EXTERNAL_SERVER !== '1') {
    const port = process.env.PLAYWRIGHT_PORT || process.env.VITE_PORT || '5555';
    const host = process.env.PLAYWRIGHT_HOST || '127.0.0.1';
    const baseURL =
      process.env.PLAYWRIGHT_BASE_URL || `http://${host}:${port}`;
    const shutdownToken = process.env.PLAYWRIGHT_SHUTDOWN_TOKEN;
    try {
      const shutdownURL = new URL('/__playwright_shutdown__', baseURL);
      if (shutdownToken && isLoopbackHostname(shutdownURL.hostname)) {
        await fetch(shutdownURL, {
          headers: {
            'X-Playwright-Shutdown-Token': shutdownToken,
          },
          method: 'POST',
          signal: AbortSignal.timeout(2_000),
        });
      }
    } catch {
      // Playwright still performs its normal child-process cleanup.
    }
  }

  try {
    const content = await readFile(chromiumDebugLog, 'utf8');
    if (
      content.includes('gpu\\command_buffer\\service\\gl_utils.cc') &&
      content.includes('GL Driver Message')
    ) {
      await unlink(chromiumDebugLog);
    }
  } catch {
    // The log is optional and may not exist on other browsers or platforms.
  }
}
