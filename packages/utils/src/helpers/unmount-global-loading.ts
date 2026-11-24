/**
 * Smoothly dismiss and then remove the startup loading screen.
 * A timeout fallback prevents a missing transition event from leaving the
 * overlay above the mounted application.
 */
export function unmountGlobalLoading() {
  const loadingElement = document.querySelector('#__app-loading__');
  const injectLoadingElements = document.querySelectorAll(
    '[data-app-loading^="inject"]',
  );

  if (!loadingElement) {
    injectLoadingElements.forEach((element) => element.remove());
    return;
  }

  let cleaned = false;
  let fallbackTimer = 0;

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    window.clearTimeout(fallbackTimer);
    loadingElement.remove();
    injectLoadingElements.forEach((element) => element.remove());
  };
  const handleTransitionEnd = (event: Event) => {
    if (event.target === loadingElement) cleanup();
  };

  loadingElement.addEventListener('transitionend', handleTransitionEnd);
  loadingElement.classList.add('hidden');
  fallbackTimer = window.setTimeout(cleanup, 320);
}
