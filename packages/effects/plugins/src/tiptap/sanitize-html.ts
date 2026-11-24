import type { DOMPurify as DOMPurifyInstance } from 'dompurify';

import createDOMPurify from 'dompurify';

const ALLOWED_TAGS = [
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
] as const;

const ALLOWED_ATTR = [
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
] as const;

const SAFE_CONTENT_URL = /^(?:(?:https?):\/\/|\/(?![/\\])|$)/i;
const MEDIA_TYPE = /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i;
const NUMERIC_ATTR = /^[0-9]{1,5}$/;
const ALLOWED_TAG_SET = new Set<string>(ALLOWED_TAGS);
const ALLOWED_ATTR_SET = new Set<string>(ALLOWED_ATTR);
let purifier: DOMPurifyInstance | undefined;
let targetHookPurifier: DOMPurifyInstance | undefined;

function escapeHTML(content: string): string {
  return content
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getDOMPurify() {
  if (typeof window === 'undefined') return undefined;
  if (!purifier || !purifier.isSupported) {
    // DOM test environments and SSR can initialize the package before a
    // browser-like window exists. Bind lazily to the active window instead of
    // trusting the module-level singleton created at import time.
    purifier = createDOMPurify(window);
  }
  return purifier.isSupported ? purifier : undefined;
}

function ensureTargetHook(instance: DOMPurifyInstance) {
  if (targetHookPurifier === instance) return;
  instance.addHook('uponSanitizeAttribute', (_node, event) => {
    if (event.attrName === 'target') {
      event.forceKeepAttr = event.attrValue === '_blank';
    }
  });
  targetHookPurifier = instance;
}

function isAttributeAllowed(tagName: string, attributeName: string) {
  if (!ALLOWED_ATTR_SET.has(attributeName)) return false;
  switch (attributeName) {
    case 'href':
    case 'rel':
    case 'target': {
      return tagName === 'a';
    }
    case 'alt': {
      return tagName === 'img';
    }
    case 'src': {
      return tagName === 'img' || tagName === 'source' || tagName === 'video';
    }
    case 'height':
    case 'width': {
      return tagName === 'img' || tagName === 'video';
    }
    case 'type': {
      return tagName === 'source';
    }
    case 'controls': {
      return tagName === 'video';
    }
    case 'title': {
      return tagName === 'a' || tagName === 'img';
    }
    default: {
      return false;
    }
  }
}

function isSafeContentURL(value: string) {
  const normalized = value.trim();
  if (
    !normalized ||
    normalized.includes('\\') ||
    /[\u0000\r\n]/.test(normalized)
  ) {
    return false;
  }
  if (normalized.startsWith('/')) {
    return !normalized.startsWith('//');
  }
  try {
    const parsed = new URL(normalized);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      Boolean(parsed.host) &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
}

function enforcePreviewAttributes(content: string): string {
  if (typeof document === 'undefined') {
    return escapeHTML(content);
  }
  const template = document.createElement('template');
  template.innerHTML = content;

  for (const element of template.content.querySelectorAll<HTMLElement>('*')) {
    const tagName = element.tagName.toLowerCase();
    if (!ALLOWED_TAG_SET.has(tagName)) {
      element.remove();
      continue;
    }
    for (const attribute of [...element.attributes]) {
      const attributeName = attribute.name.toLowerCase();
      if (!isAttributeAllowed(tagName, attributeName)) {
        element.removeAttribute(attribute.name);
      }
    }
    for (const name of ['href', 'src']) {
      const value = element.getAttribute(name);
      if (value !== null && !isSafeContentURL(value)) {
        element.removeAttribute(name);
      }
    }
    for (const name of ['height', 'width']) {
      const value = element.getAttribute(name);
      if (value !== null && !NUMERIC_ATTR.test(value)) {
        element.removeAttribute(name);
      }
    }
    const mediaType = element.getAttribute('type');
    if (mediaType !== null && !MEDIA_TYPE.test(mediaType)) {
      element.removeAttribute('type');
    }
    const target = element.getAttribute('target');
    if (target !== null) {
      if (target !== '_blank') {
        element.removeAttribute('target');
      } else {
        element.setAttribute('rel', 'nofollow noopener noreferrer');
      }
    }
  }
  return template.innerHTML;
}

export function sanitizeTiptapPreviewHTML(content: string): string {
  const instance = getDOMPurify();
  if (!instance) {
    return escapeHTML(content);
  }
  ensureTargetHook(instance);
  const sanitized = instance.sanitize(content, {
    ALLOWED_ATTR: [...ALLOWED_ATTR],
    ALLOWED_TAGS: [...ALLOWED_TAGS],
    ALLOWED_URI_REGEXP: SAFE_CONTENT_URL,
    ALLOW_ARIA_ATTR: false,
    ALLOW_DATA_ATTR: false,
    FORBID_ATTR: ['style'],
    FORBID_TAGS: [
      'embed',
      'form',
      'iframe',
      'input',
      'math',
      'object',
      'script',
      'style',
      'svg',
      'template',
    ],
  });
  return enforcePreviewAttributes(sanitized);
}
