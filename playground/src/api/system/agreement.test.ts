import { describe, expect, it } from 'vitest';

import { normalizeAgreementLang } from './agreement';

describe('normalizeAgreementLang', () => {
  it.each([
    ['zh', 'zh-CN'],
    ['zh_CN', 'zh-CN'],
    ['en', 'en-US'],
    ['en-GB', 'en-US'],
    [' en-us,en;q=0.9', 'en-US'],
    ['fr-FR', 'zh-CN'],
    ['', 'zh-CN'],
  ])('maps %s to %s', (input, expected) => {
    expect(normalizeAgreementLang(input)).toBe(expected);
  });
});
