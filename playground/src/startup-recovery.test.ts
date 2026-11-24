import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installStartupRecovery } from './startup-recovery';

describe('startup recovery', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="__app-loading__">
        <div id="__app-loading-status__">Secure API channel</div>
        <button id="__app-loading-retry__" hidden>重新加载</button>
      </div>
    `;
    sessionStorage.clear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('keeps a visible retry state when application bootstrap fails', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const recovery = installStartupRecovery();
    recovery.handleStartupError(new Error('bootstrap failed'));

    expect(
      document
        .querySelector('#__app-loading__')
        ?.classList.contains('is-error'),
    ).toBe(true);
    expect(
      document.querySelector('#__app-loading-status__')?.textContent,
    ).toBe('页面加载失败，请检查网络后重试');
    expect(
      (document.querySelector('#__app-loading-retry__') as HTMLButtonElement)
        .hidden,
    ).toBe(false);
  });
});
