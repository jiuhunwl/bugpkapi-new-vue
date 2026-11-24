export interface RequestTimeoutSaveInput {
  displayedValue: unknown;
  inherited: boolean;
  storedLocalValue: unknown;
}

const MIN_REQUEST_TIMEOUT_MS = 100;
const MAX_REQUEST_TIMEOUT_MS = 120_000;

/**
 * Return the value that should be persisted for a delivery-policy timeout.
 *
 * The UI displays the effective global value while an interface inherits, so
 * using that displayed value would silently replace a previously saved local
 * override. Prefer the separately retained local value in that mode; zero is
 * the explicit database marker for "inherit" when no local value exists.
 */
export function requestTimeoutValueForSave({
  displayedValue,
  inherited,
  storedLocalValue,
}: RequestTimeoutSaveInput): number {
  const candidate = inherited ? storedLocalValue : displayedValue;
  const value = Math.trunc(Number(candidate ?? 0));
  if (
    !Number.isFinite(value) ||
    value < MIN_REQUEST_TIMEOUT_MS ||
    value > MAX_REQUEST_TIMEOUT_MS
  ) {
    return 0;
  }
  return value;
}

/** Normalize a server-provided local timeout without treating the effective
 * global timeout as a local value. */
export function normalizeStoredRequestTimeout(value: unknown): number {
  return requestTimeoutValueForSave({
    displayedValue: value,
    inherited: false,
    storedLocalValue: 0,
  });
}
