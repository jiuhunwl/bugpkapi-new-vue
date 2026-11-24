function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function readableExportErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return '';
  const message = error.message.trim();
  return message && !message.startsWith('CALL_LOG_EXPORT_') ? message : '';
}

export async function validateCallLogExportBlob(
  response: unknown,
): Promise<Blob> {
  if (typeof Blob === 'undefined' || !(response instanceof Blob)) {
    throw new TypeError('CALL_LOG_EXPORT_INVALID_RESPONSE');
  }
  if (response.size === 0) {
    throw new Error('CALL_LOG_EXPORT_EMPTY_RESPONSE');
  }

  const contentType = response.type.toLowerCase();
  const prefixText = await response.slice(0, 512).text();
  const prefix = prefixText.replace(/^\uFEFF/, '').trimStart();
  const lowerPrefix = prefix.toLowerCase();
  const isHTML =
    contentType.includes('text/html') ||
    lowerPrefix.startsWith('<!doctype html') ||
    lowerPrefix.startsWith('<html');
  if (isHTML) {
    throw new Error('CALL_LOG_EXPORT_INVALID_RESPONSE');
  }

  const mightBeJSON =
    contentType.includes('json') ||
    prefix.startsWith('{') ||
    prefix.startsWith('[');
  if (mightBeJSON) {
    const text = await response.text();
    try {
      const payload = JSON.parse(text) as Record<string, unknown>;
      const nested =
        payload.data && typeof payload.data === 'object'
          ? (payload.data as Record<string, unknown>)
          : undefined;
      const message = [
        payload.message,
        payload.error,
        nested?.message,
        nested?.error,
      ].find((value): value is string => isNonBlankString(value));
      if (message) {
        throw new Error(message);
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message !== 'CALL_LOG_EXPORT_INVALID_RESPONSE' &&
        !(error instanceof SyntaxError)
      ) {
        throw error;
      }
    }
    throw new Error('CALL_LOG_EXPORT_INVALID_RESPONSE');
  }

  return response;
}

export async function getCallLogExportErrorMessage(
  error: unknown,
): Promise<string> {
  if (typeof Blob !== 'undefined' && error instanceof Blob) {
    try {
      await validateCallLogExportBlob(error);
    } catch (blobError) {
      return readableExportErrorMessage(blobError);
    }
    return '';
  }
  return readableExportErrorMessage(error);
}

export async function downloadCallLogExportBlob(
  response: unknown,
  filename: string,
): Promise<void> {
  const blob = await validateCallLogExportBlob(response);
  const url = URL.createObjectURL(blob);
  let link: HTMLAnchorElement | undefined;
  let downloadStarted = false;

  try {
    link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    downloadStarted = true;
  } finally {
    try {
      link?.remove();
    } finally {
      if (downloadStarted) {
        globalThis.setTimeout(() => URL.revokeObjectURL(url), 100);
      } else {
        URL.revokeObjectURL(url);
      }
    }
  }
}
