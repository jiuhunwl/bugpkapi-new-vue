interface CopyTextOptions {
  clipboard?: null | Pick<Clipboard, 'writeText'>;
  document?: Document | null;
}

async function copyText(value: string, options: CopyTextOptions = {}) {
  const text = String(value ?? '');
  const clipboard =
    options.clipboard === undefined
      ? globalThis.navigator?.clipboard
      : options.clipboard;

  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(text);
      return;
    } catch {
      // Permission and insecure-context failures can still use the DOM path.
    }
  }

  const documentRef =
    options.document === undefined ? globalThis.document : options.document;
  if (!documentRef?.body || typeof documentRef.execCommand !== 'function') {
    throw new Error('Clipboard copy is unavailable.');
  }

  const activeElement = documentRef.activeElement;
  const textarea = documentRef.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('aria-hidden', 'true');
  textarea.setAttribute('readonly', 'readonly');
  textarea.style.position = 'fixed';
  textarea.style.inset = '0 auto auto -9999px';
  textarea.style.opacity = '0';
  documentRef.body.append(textarea);
  try {
    textarea.focus({ preventScroll: true });
    textarea.select();
    if (!documentRef.execCommand('copy')) {
      throw new Error('Clipboard copy was rejected.');
    }
  } finally {
    textarea.remove();
    if (activeElement instanceof HTMLElement) {
      activeElement.focus({ preventScroll: true });
    }
  }
}

export { copyText };
export type { CopyTextOptions };
