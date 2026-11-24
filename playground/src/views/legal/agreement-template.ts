import type { LegalSection } from './types';

import { sanitizeRichTextHtml } from '#/utils/sanitize-rich-text-html';

export interface ParsedAgreementTemplate {
  html: string;
  sections: LegalSection[];
}

/**
 * 后台模板正文是纯 HTML，目录需要从 h2（没有 h2 时退回 h3）提取。
 * 净化器会移除 id 属性，所以标题锚点必须在净化之后补，避免和后台
 * 手写的 id 冲突。
 */
export function parseAgreementTemplateHtml(
  input: string,
): ParsedAgreementTemplate {
  const sanitized = sanitizeRichTextHtml(input);
  if (!sanitized || typeof DOMParser === 'undefined') {
    return { html: sanitized, sections: [] };
  }
  const documentNode = new DOMParser().parseFromString(
    `<div id="agreement-template-root">${sanitized}</div>`,
    'text/html',
  );
  const container = documentNode.querySelector('#agreement-template-root');
  if (!container) {
    return { html: sanitized, sections: [] };
  }
  let headings = [...container.querySelectorAll('h2')];
  if (headings.length === 0) {
    headings = [...container.querySelectorAll('h3')];
  }
  const sections = headings.map((heading, index) => {
    const id = `agreement-template-section-${index + 1}`;
    heading.id = id;
    return {
      id,
      items: [],
      title: heading.textContent?.trim() || `#${index + 1}`,
    };
  });
  return { html: container.innerHTML, sections };
}
