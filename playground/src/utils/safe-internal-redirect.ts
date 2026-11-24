const MAX_DECODE_PASSES = 4;

function containsControlCharacter(value: string) {
  for (const character of value) {
    const code = character.codePointAt(0);
    if (code !== undefined && (code <= 0x1f || code === 0x7f)) {
      return true;
    }
  }
  return false;
}

function decodeRedirectValue(value: string): null | string {
  let decoded = value;
  for (let pass = 0; pass < MAX_DECODE_PASSES; pass += 1) {
    if (!decoded.includes('%')) {
      return decoded;
    }
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) {
        return decoded;
      }
      decoded = next;
    } catch {
      return null;
    }
  }
  return decoded.includes('%') ? null : decoded;
}

function normalizeInternalPath(value: unknown): null | string {
  if (typeof value !== 'string') {
    return null;
  }
  const decoded = decodeRedirectValue(value.trim());
  if (
    !decoded ||
    !decoded.startsWith('/') ||
    decoded.startsWith('//') ||
    decoded.includes('\\') ||
    containsControlCharacter(decoded)
  ) {
    return null;
  }
  return decoded;
}

/**
 * Accept only absolute paths inside this SPA. Query-provided redirects may be
 * encoded more than once, so validation always happens after bounded decoding.
 */
function safeInternalRedirect(value: unknown, fallback = '/') {
  return normalizeInternalPath(value) ?? normalizeInternalPath(fallback) ?? '/';
}

export { safeInternalRedirect };
