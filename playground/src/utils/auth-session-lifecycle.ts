let sessionGeneration = 0;
const invalidationListeners = new Set<() => void>();

export class AuthSessionInvalidatedError extends Error {
  readonly __CANCEL__ = true;
  readonly code = 'AUTH_SESSION_INVALIDATED';

  constructor() {
    super('The authentication session has changed.');
    this.name = 'AuthSessionInvalidatedError';
  }
}

export function getAuthSessionGeneration() {
  return sessionGeneration;
}

export function isAuthSessionCurrent(generation: number) {
  return generation === sessionGeneration;
}

export function assertAuthSessionCurrent(generation: number) {
  if (!isAuthSessionCurrent(generation)) {
    throw new AuthSessionInvalidatedError();
  }
}

export function advanceAuthSession() {
  sessionGeneration++;
  for (const invalidate of invalidationListeners) {
    invalidate();
  }
  return sessionGeneration;
}

export function onAuthSessionInvalidated(invalidate: () => void) {
  invalidationListeners.add(invalidate);
  return () => {
    invalidationListeners.delete(invalidate);
  };
}
