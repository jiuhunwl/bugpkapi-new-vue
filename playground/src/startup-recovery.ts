const PRELOAD_ERROR_EVENT = 'vite:preloadError';
const MAX_AUTOMATIC_RELOADS = 2;
const RECOVERY_STORAGE_KEY = 'bugpk-api-startup-recovery-v1';
const RECOVERY_WINDOW_MS = 30_000;
let reloadScheduled = false;

interface RecoveryMarker {
  attempts: number;
  attemptedAt: number;
  href: string;
}

function currentHref() {
  return window.location.href;
}

function readRecoveryMarker(): null | RecoveryMarker {
  try {
    const value = sessionStorage.getItem(RECOVERY_STORAGE_KEY);
    if (!value) return null;

    const marker = JSON.parse(value) as Partial<RecoveryMarker>;
    if (
      typeof marker.attempts !== 'number' ||
      typeof marker.attemptedAt !== 'number' ||
      typeof marker.href !== 'string'
    ) {
      sessionStorage.removeItem(RECOVERY_STORAGE_KEY);
      return null;
    }
    return marker as RecoveryMarker;
  } catch {
    sessionStorage.removeItem(RECOVERY_STORAGE_KEY);
    return null;
  }
}

function writeRecoveryMarker(marker: RecoveryMarker) {
  try {
    sessionStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(marker));
  } catch {
    // Storage may be unavailable in privacy-restricted browsers. The fallback
    // error state below still keeps the page recoverable without it.
  }
}

function clearRecoveryMarker() {
  try {
    sessionStorage.removeItem(RECOVERY_STORAGE_KEY);
  } catch {
    // Ignore unavailable session storage.
  }
}

function startupCopy() {
  let locale = '';
  try {
    const namespace = import.meta.env.VITE_APP_NAMESPACE || 'bugpk-api';
    locale = localStorage.getItem(`${namespace}-preferences-locale`) ?? '';
  } catch {
    // Storage can be unavailable in privacy-restricted browsers.
  }
  return locale === 'en-US'
    ? {
        retry: 'Reload',
        status: 'Page failed to load. Check your network and try again.',
      }
    : { retry: '重新加载', status: '页面加载失败，请检查网络后重试' };
}

function showStartupError(error: unknown) {
  console.error('Application startup failed:', error);

  const loading = document.querySelector<HTMLElement>('#__app-loading__');
  const status = document.querySelector<HTMLElement>('#__app-loading-status__');
  const retryButton = document.querySelector<HTMLButtonElement>(
    '#__app-loading-retry__',
  );
  const copy = startupCopy();

  loading?.classList.remove('is-custom');
  loading?.classList.add('is-error');
  if (status) {
    status.textContent = copy.status;
  }
  if (retryButton) {
    retryButton.hidden = false;
    retryButton.textContent = copy.retry;
    retryButton.onclick = () => {
      clearRecoveryMarker();
      window.location.reload();
    };
  }
}

function recoverFromPreloadError(error: unknown) {
  if (reloadScheduled) return;

  const marker = readRecoveryMarker();
  const href = currentHref();
  const now = Date.now();
  const activeMarker =
    marker?.href === href && now - marker.attemptedAt <= RECOVERY_WINDOW_MS
      ? marker
      : null;

  if ((activeMarker?.attempts ?? 0) >= MAX_AUTOMATIC_RELOADS) {
    showStartupError(error);
    return;
  }

  reloadScheduled = true;
  writeRecoveryMarker({
    attempts: (activeMarker?.attempts ?? 0) + 1,
    attemptedAt: now,
    href,
  });
  window.location.reload();
}

function isDynamicImportError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /(?:failed to fetch|error loading|importing).*(?:dynamically imported module|module script)|unable to preload css/i.test(
    message,
  );
}

function handleStartupError(error: unknown) {
  if (isDynamicImportError(error)) {
    recoverFromPreloadError(error);
    return;
  }
  showStartupError(error);
}

export function installStartupRecovery() {
  window.addEventListener(PRELOAD_ERROR_EVENT, (event) => {
    event.preventDefault();
    recoverFromPreloadError(event.payload);
  });

  return {
    markApplicationStable() {
      window.setTimeout(() => {
        const marker = readRecoveryMarker();
        if (marker?.href === currentHref()) {
          clearRecoveryMarker();
        }
      }, RECOVERY_WINDOW_MS);
    },
    handleStartupError,
  };
}
