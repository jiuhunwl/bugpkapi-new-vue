// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { sanitizeCodeHighlightHtml } from './sanitize-code-html';

describe('sanitizeCodeHighlightHtml', () => {
  it('keeps syntax spans while removing executable markup', () => {
    const result = sanitizeCodeHighlightHtml(
      '<span class="tok-string" onclick="alert(1)">safe</span><script>alert(1)</script><img src=x onerror=alert(1)>',
    );
    expect(result).toBe('<span class="tok-string">safe</span>');
  });

  it('removes links and dangerous protocols', () => {
    const result = sanitizeCodeHighlightHtml(
      '<a href="javascript:alert(1)"><span class="tok-keyword">const</span></a>',
    );
    expect(result).toBe('<span class="tok-keyword">const</span>');
  });
});
