const AUTH_SESSION_HINT_KEY = 'bugpk:auth-session-active';

function updateAuthSessionHint(active: boolean) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    if (active) {
      window.localStorage.setItem(AUTH_SESSION_HINT_KEY, '1');
    } else {
      window.localStorage.removeItem(AUTH_SESSION_HINT_KEY);
    }
  } catch {
    // Storage can be unavailable in hardened browser contexts.
  }
}

export function clearAuthSessionHint() {
  updateAuthSessionHint(false);
}

export function hasAuthSessionHint() {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return window.localStorage.getItem(AUTH_SESSION_HINT_KEY) === '1';
  } catch {
    return false;
  }
}

export function markAuthSessionActive() {
  updateAuthSessionHint(true);
}
