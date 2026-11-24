// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { isSafeRichTextUrl, sanitizeRichTextHtml } from './sanitize-rich-text-html';

describe('sanitizeRichTextHtml', () => {
  it('removes executable markup and unsafe media URLs', () => {
    const result = sanitizeRichTextHtml(
      '<p onclick="alert(1)">safe</p><script>alert(1)</script><img src="data:text/html,boom" onerror="alert(1)"><a href="javascript:alert(1)">bad</a>',
    );
    expect(result).toBe('<p>safe</p><img><a>bad</a>');
  });

  it('keeps safe links and protects new windows', () => {
    const result = sanitizeRichTextHtml(
      '<a href="https://example.com/path" target="_blank">safe</a><img src="/system-api/upload/notice-image/0123456789abcdef0123456789abcdef.png">',
    );
    expect(result).toContain('href="https://example.com/path"');
    expect(result).toContain('rel="nofollow noopener noreferrer"');
    expect(result).toContain('src="/system-api/upload/notice-image/');
  });
});

describe('isSafeRichTextUrl', () => {
  it.each([
    'javascript:alert(1)',
    'data:text/html,boom',
    '//evil.example/path',
    'https://example.com/\u0000hidden',
    'https://example.com/line\nbreak',
    'https://user:pass@example.com/path',
    'https://example.com\\@evil.test/path',
  ])('rejects %s', (value) => {
    expect(isSafeRichTextUrl(value)).toBe(false);
  });
});
