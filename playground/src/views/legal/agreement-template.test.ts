// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { parseAgreementTemplateHtml } from './agreement-template';

describe('parseAgreementTemplateHtml', () => {
  it('sanitizes the body and assigns stable heading anchors', () => {
    const parsed = parseAgreementTemplateHtml(
      '<h2>一、协议主体</h2><p>正文</p><script>alert(1)</script><h2>二、退款</h2><ul><li>条款</li></ul>',
    );
    expect(parsed.html).not.toContain('script');
    expect(parsed.html).toContain('id="agreement-template-section-1"');
    expect(parsed.html).toContain('id="agreement-template-section-2"');
    expect(parsed.sections).toEqual([
      { id: 'agreement-template-section-1', items: [], title: '一、协议主体' },
      { id: 'agreement-template-section-2', items: [], title: '二、退款' },
    ]);
  });

  it('falls back to h3 when the document has no h2', () => {
    const parsed = parseAgreementTemplateHtml('<h3>小节</h3><p>正文</p>');
    expect(parsed.sections).toHaveLength(1);
    expect(parsed.sections[0]?.title).toBe('小节');
  });

  it('keeps empty input empty', () => {
    expect(parseAgreementTemplateHtml('')).toEqual({ html: '', sections: [] });
  });
});
