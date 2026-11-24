interface SubmitDrawer {
  lock: () => unknown;
  unlock: () => unknown;
}

/** One in-flight submission per drawer, including async form validation. */
export function createDrawerSubmit() {
  let submitting = false;
  return async (drawer: SubmitDrawer, action: () => Promise<void>) => {
    if (submitting) return;
    submitting = true;
    drawer.lock();
    try {
      await action();
    } catch {
      // Form validation shows field errors; requestClient shows request errors.
      // Leave the drawer and entered values intact without a duplicate toast.
    } finally {
      drawer.unlock();
      submitting = false;
    }
  };
}
