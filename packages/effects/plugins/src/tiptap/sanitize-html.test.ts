// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { sanitizeTiptapPreviewHTML } from './sanitize-html';

describe('sanitizeTiptapPreviewHTML', () => {
  it('removes executable and parser-confusing content', () => {
    const result = sanitizeTiptapPreviewHTML(`
      <p onclick="alert(1)">safe</p>
      <a href="java&#x73;cript:alert(1)">bad link</a>
      <img src="data:image/svg+xml,<svg onload=alert(1)>" onerror="alert(1)">
      <svg><style><img src=x onerror=alert(1)></style></svg>
      <math><mtext><form><input name=x></form></mtext></math>
      <iframe src="https://evil.example"></iframe>
      <script>alert(1)</script>
    `);
    const lower = result.toLowerCase();

    for (const value of [
      'data:image',
      'iframe',
      'javascript:',
      'onerror',
      'onclick',
      '<form',
      '<input',
      '<math',
      '<script',
      '<svg',
    ]) {
      expect(lower).not.toContain(value);
    }
    expect(result).toContain('<p>safe</p>');
  });

  it('keeps the backend-approved rich-text subset', () => {
    const result = sanitizeTiptapPreviewHTML(
      '<p>Hello <strong>BugPk-Api</strong></p>' +
        '<a href="https://example.com" target="_blank" rel="nofollow noopener noreferrer">link</a>' +
        '<img src="/system-api/upload/notice-image/0123456789abcdef0123456789abcdef.webp" alt="logo">',
    );

    expect(result).toContain('<p>Hello <strong>BugPk-Api</strong></p>');
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('target="_blank"');
    expect(result).toContain('rel="nofollow noopener noreferrer"');
    expect(result).toContain(
      'src="/system-api/upload/notice-image/0123456789abcdef0123456789abcdef.webp"',
    );
  });

  it('rejects credentialed and parser-ambiguous URLs', () => {
    const result = sanitizeTiptapPreviewHTML(
      '<a href="https://user:pass@example.com/path">credentialed</a>' +
        '<img src="https://user@example.com/image.png">' +
        '<a href="https://example.com\\@evil.test/path">ambiguous</a>' +
        '<a href="https://example.com/safe">safe</a>',
    );

    expect(result).not.toContain('user:pass@');
    expect(result).not.toContain('user@example.com');
    expect(result).not.toContain('\\@evil.test');
    expect(result).toContain('href="https://example.com/safe"');
  });

  it('is idempotent after enforcing the strict attribute allowlist', () => {
    const once = sanitizeTiptapPreviewHTML(
      '<p data-probe="drop">safe <a href="HTTPS://example.com/path" target="_blank">link</a></p>',
    );
    expect(sanitizeTiptapPreviewHTML(once)).toBe(once);
    expect(once).not.toContain('data-probe');
  });
});
