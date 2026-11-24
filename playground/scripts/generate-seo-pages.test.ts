import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// 脚本路径必须相对测试文件解析：从 monorepo 根目录跑 vitest 时 process.cwd() 不是 playground，
// 用 CWD 相对路径会 ERR_MODULE_NOT_FOUND。见 packages root 的 vitest run。
const playgroundDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const seoScript = join(dirname(fileURLToPath(import.meta.url)), 'generate-seo-pages.mjs');

describe('generate-seo-pages', () => {
  it('emits parseable JSON-LD for legal pages', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'bugpk-seo-'));
    try {
      writeFileSync(
        join(outputDir, 'index.html'),
        '<title>Base</title><meta name="description" content="Base"><meta name="robots" content="index, follow"><link rel="canonical" href="https://example.test/"><meta property="og:url" content="https://example.test/"><meta property="og:title" content="Base"><meta name="twitter:title" content="Base"></head>',
      );
      execFileSync(process.execPath, [seoScript], {
        cwd: playgroundDir,
        env: {
          ...process.env,
          BUGPK_FRONTEND_OUT_DIR: outputDir,
          VITE_APP_SITE_URL: 'https://example.test/A&B',
        },
      });

      const html = readFileSync(join(outputDir, 'privacy-policy/index.html'), 'utf8');
      const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
      expect(scripts.length).toBe(1);
      const pageJsonLd = scripts.map((script) => JSON.parse(script[1])).find((item) => item['@type'] === 'WebPage');
      expect(pageJsonLd.url).toBe('https://example.test/A&B/privacy-policy');
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
