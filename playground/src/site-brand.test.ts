import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyPublicCustomCode,
  applySiteAnalyticsCode,
  applySiteBrand,
  DEFAULT_LOGO_URL,
  useSiteBrand,
} from './site-brand';

const STYLE_ID = 'bugpk-site-custom-style';
const SCRIPT_ID = 'bugpk-site-custom-script';
const ANALYTICS_SELECTOR = '[data-bugpk-site-analytics]';

class ControlledImage {
  static pending = new Map<string, ControlledImage>();
  complete = false;
  decoding = '';
  naturalWidth = 0;
  onerror: (() => void) | null = null;
  onload: (() => void) | null = null;

  get src() {
    return this._source;
  }

  set src(value: string) {
    this._source = value;
    ControlledImage.pending.set(value, this);
  }

  private _source = '';

  static fail(url: string) {
    ControlledImage.pending.get(url)?.onerror?.();
  }

  static succeed(url: string) {
    const image = ControlledImage.pending.get(url);
    if (!image) return;
    image.complete = true;
    image.naturalWidth = 64;
    image.onload?.();
  }
}

beforeEach(() => {
  ControlledImage.pending.clear();
  vi.stubGlobal('Image', ControlledImage);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.getElementById(STYLE_ID)?.remove();
  document.getElementById(SCRIPT_ID)?.remove();
  document
    .querySelectorAll(ANALYTICS_SELECTOR)
    .forEach((node) => node.remove());
});

describe('site brand logo resolution', () => {
  it('commits a custom logo only after it loads successfully', async () => {
    const brand = useSiteBrand();
    const pending = applySiteBrand({
      logoUrl: 'https://assets.example/custom.svg',
      siteName: 'Custom Brand',
    });

    expect(brand.logoUrl).not.toBe('https://assets.example/custom.svg');
    ControlledImage.succeed('https://assets.example/custom.svg');
    await pending;

    expect(brand.logoUrl).toBe('https://assets.example/custom.svg');
  });

  it('falls back only when the configured logo fails', async () => {
    const pending = applySiteBrand({
      logoUrl: 'https://assets.example/broken.svg',
    });
    ControlledImage.fail('https://assets.example/broken.svg');
    await pending;

    expect(useSiteBrand().logoUrl).toBe(DEFAULT_LOGO_URL);
  });

  it('ignores stale completion from an older generation', async () => {
    const older = applySiteBrand({
      logoUrl: 'https://assets.example/older.svg',
    });
    const newer = applySiteBrand({
      logoUrl: 'https://assets.example/newer.svg',
    });

    ControlledImage.succeed('https://assets.example/newer.svg');
    await newer;
    ControlledImage.fail('https://assets.example/older.svg');
    await older;

    expect(useSiteBrand().logoUrl).toBe('https://assets.example/newer.svg');
  });
});

describe('site analytics code', () => {
  it('injects complete analytics snippets with executable scripts', () => {
    applySiteAnalyticsCode(`
      <script async src="https://analytics.example/tracker.js" data-site="demo"></script>
      <script>window.dataLayer = window.dataLayer || [];</script>
      <noscript><img src="https://analytics.example/pixel.gif" alt="" /></noscript>
      <img src="https://analytics.example/direct-pixel.gif" data-pixel="direct" alt="" />
    `);

    const nodes = document.querySelectorAll(ANALYTICS_SELECTOR);
    expect(nodes).toHaveLength(4);
    const scripts = document.querySelectorAll<HTMLScriptElement>(
      `script${ANALYTICS_SELECTOR}`,
    );
    expect(scripts).toHaveLength(2);
    expect(scripts[0]?.src).toBe('https://analytics.example/tracker.js');
    expect(scripts[0]?.dataset.site).toBe('demo');
    expect(scripts[1]?.textContent).toContain('window.dataLayer');
    expect(
      document.body.querySelector(`noscript${ANALYTICS_SELECTOR}`),
    ).not.toBeNull();
    expect(
      document.body.querySelector(
        `img${ANALYTICS_SELECTOR}[data-pixel="direct"]`,
      ),
    ).not.toBeNull();
  });

  it('supports plain JavaScript and removes old analytics nodes', () => {
    applySiteAnalyticsCode('window.analyticsQueue = [];');
    expect(
      document.querySelector(`script${ANALYTICS_SELECTOR}`)?.textContent,
    ).toContain('window.analyticsQueue');

    applySiteAnalyticsCode('');
    expect(document.querySelector(ANALYTICS_SELECTOR)).toBeNull();
  });
});

describe('public custom code', () => {
  it('injects complete enabled CSS and JavaScript tags', () => {
    applyPublicCustomCode({
      cssCode: '<style media="screen">.brand-probe { color: rgb(1 2 3); }</style>',
      enabled: 1,
      jsCode: '<script type="module">window.__brandProbe = true;</script>',
    });

    expect(document.getElementById(STYLE_ID)?.textContent).toContain(
      '.brand-probe',
    );
    expect(document.getElementById(STYLE_ID)?.getAttribute('media')).toBe(
      'screen',
    );
    expect(document.getElementById(SCRIPT_ID)?.textContent).toContain(
      'window.__brandProbe = true;',
    );
    expect(document.getElementById(SCRIPT_ID)?.getAttribute('type')).toBe(
      'module',
    );
  });

  it('removes previously injected code when disabled', () => {
    applyPublicCustomCode({
      cssCode: '<style>body {}</style>',
      enabled: 1,
      jsCode: '<script>void 0;</script>',
    });
    applyPublicCustomCode({ enabled: 0 });

    expect(document.getElementById(STYLE_ID)).toBeNull();
    expect(document.getElementById(SCRIPT_ID)).toBeNull();
  });
});
