import createDOMPurify from 'dompurify';

const purifier = createDOMPurify(window);

const allowedTags = [
  'a',
  'b',
  'blockquote',
  'br',
  'code',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'img',
  'li',
  'ol',
  'p',
  'pre',
  'source',
  'span',
  'strong',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
  'video',
];

function isSafeRichTextUrl(value: string) {
  const trimmed = value.trim();
  if (
    !trimmed ||
    trimmed.includes('\\') ||
    trimmed.includes('\u0000') ||
    trimmed.includes('\r') ||
    trimmed.includes('\n')
  ) {
    return false;
  }
  if (trimmed.startsWith('/')) {
    return !trimmed.startsWith('//');
  }
  try {
    const parsed = new URL(trimmed);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
}

purifier.addHook('uponSanitizeAttribute', (_node, data) => {
  if (
    (data.attrName === 'href' || data.attrName === 'src') &&
    !isSafeRichTextUrl(data.attrValue)
  ) {
    data.keepAttr = false;
  }
});

purifier.addHook('afterSanitizeAttributes', (node) => {
  if (
    node instanceof HTMLAnchorElement &&
    node.getAttribute('target') === '_blank'
  ) {
    node.setAttribute('rel', 'nofollow noopener noreferrer');
  }
});

function sanitizeRichTextHtml(value: string) {
  return purifier.sanitize(value, {
    ALLOWED_ATTR: [
      'alt',
      'controls',
      'height',
      'href',
      'rel',
      'src',
      'target',
      'title',
      'type',
      'width',
    ],
    ALLOWED_TAGS: allowedTags,
  });
}

export { isSafeRichTextUrl, sanitizeRichTextHtml };
