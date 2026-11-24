import createDOMPurify from 'dompurify';

const purifier = createDOMPurify(window);

function sanitizeCodeHighlightHtml(value: string) {
  return purifier.sanitize(value, {
    ALLOWED_ATTR: ['class'],
    ALLOWED_TAGS: ['span'],
  });
}

export { sanitizeCodeHighlightHtml };
