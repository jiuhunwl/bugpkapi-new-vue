import { describe, expect, it } from 'vitest';

import enPage from './langs/en-US/page.json';
import zhPage from './langs/zh-CN/page.json';

describe('friend-link logo URL placeholder', () => {
  it.each([
    ['en-US', enPage],
    ['zh-CN', zhPage],
  ])('does not recommend the application-root logo path for %s', (_locale, page) => {
    const placeholder = page.public.links.form.logoUrlPlaceholder;

    expect(placeholder).not.toContain('/logo.png');
  });
});
