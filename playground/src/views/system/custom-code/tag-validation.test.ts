import { describe, expect, it } from 'vitest';

import { hasCompleteCustomCodeTags } from './tag-validation';

describe('custom code tag validation', () => {
  it('accepts empty values and complete tag snippets', () => {
    expect(hasCompleteCustomCodeTags('', 'style')).toBe(true);
    expect(
      hasCompleteCustomCodeTags(
        '<style media="screen">body { color: red; }</style>\n<style>.x{}</style>',
        'style',
      ),
    ).toBe(true);
    expect(
      hasCompleteCustomCodeTags(
        '<script src="https://example.com/app.js"></script>',
        'script',
      ),
    ).toBe(true);
  });

  it('rejects unwrapped or incomplete snippets', () => {
    expect(hasCompleteCustomCodeTags('body {}', 'style')).toBe(false);
    expect(hasCompleteCustomCodeTags('<style>body {}', 'style')).toBe(false);
    expect(hasCompleteCustomCodeTags('alert(1)', 'script')).toBe(false);
  });
});
