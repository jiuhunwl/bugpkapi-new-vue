import { afterEach, describe, expect, it, vi } from 'vitest';

import { copyText } from './copy-text';

const originalExecCommand = document.execCommand;

afterEach(() => {
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    value: originalExecCommand,
  });
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('copyText', () => {
  it('uses the Clipboard API when it is available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    await copyText('secret-value', {
      clipboard: { writeText },
      document: null,
    });

    expect(writeText).toHaveBeenCalledWith('secret-value');
  });

  it('falls back to a temporary textarea when Clipboard API is rejected', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    });

    await copyText('fallback-secret', {
      clipboard: { writeText },
      document,
    });

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('rejects when no copy mechanism is available', async () => {
    await expect(
      copyText('secret-value', { clipboard: null, document: null }),
    ).rejects.toThrow('Clipboard copy is unavailable');
  });
});
