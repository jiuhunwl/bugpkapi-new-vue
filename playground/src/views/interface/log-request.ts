interface ActiveRequest<TResult> {
  controller: AbortController;
  promise: Promise<TResult>;
}

/**
 * Keeps grid refreshes race-free without leaving obsolete database queries
 * running. An aborted waiter follows the replacement promise, so an older VXE
 * callback can never commit stale rows after the newest request completes.
 */
export function createLatestRequestRunner<TArgs extends unknown[], TResult>(
  request: (...args: [...TArgs, AbortSignal]) => Promise<TResult>,
) {
  let active: ActiveRequest<TResult> | undefined;
  let latestPromise: Promise<TResult> | undefined;

  function run(...args: TArgs): Promise<TResult> {
    const previous = active;

    const controller = new AbortController();
    const entry: ActiveRequest<TResult> = {
      controller,
      promise: undefined as unknown as Promise<TResult>,
    };
    active = entry;

    let requestPromise: Promise<TResult>;
    try {
      requestPromise = request(...args, controller.signal);
    } catch (error) {
      requestPromise = Promise.reject(error);
    }

    entry.promise = requestPromise
      .catch((error: unknown) => {
        if (!controller.signal.aborted) throw error;
        if (latestPromise && latestPromise !== entry.promise) {
          return latestPromise;
        }
        throw error;
      })
      .finally(() => {
        if (active === entry) active = undefined;
      });
    latestPromise = entry.promise;
    previous?.controller.abort();
    return entry.promise;
  }

  function cancel() {
    const request = active;
    active = undefined;
    latestPromise = undefined;
    request?.controller.abort();
  }

  return { cancel, run };
}
