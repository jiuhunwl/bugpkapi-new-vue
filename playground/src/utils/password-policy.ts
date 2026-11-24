export const PASSWORD_MAX_CHARACTERS = 64;
export const PASSWORD_MAX_BYTES = 72;
export const PASSWORD_MIN_CHARACTERS = 8;

export function isValidPassword(value: string) {
  const characters = Array.from(value).length;
  const bytes = new TextEncoder().encode(value).length;
  return (
    characters >= PASSWORD_MIN_CHARACTERS &&
    characters <= PASSWORD_MAX_CHARACTERS &&
    bytes <= PASSWORD_MAX_BYTES
  );
}
