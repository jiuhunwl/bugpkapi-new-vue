export interface AuthTokenClaims {
  /** 过期时间（Unix 秒） */
  exp?: number;
  /** 用户名 */
  sub?: string;
  /** 用户 ID（字符串化，避免大整数比较差异） */
  uid?: string;
}

function decodeBase64Url(segment: string) {
  const atob = globalThis.atob;
  if (typeof atob !== 'function') {
    return null;
  }
  try {
    const normalized = segment.replaceAll('-', '+').replaceAll('_', '/');
    const padded = normalized.padEnd(
      Math.ceil(normalized.length / 4) * 4,
      '=',
    );
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/**
 * 读取 JWT 的公开声明（不校验签名，只用于前端的过期调度与跨标签页
 * 同用户判断）。令牌不是三段式 JWT 时返回 null。
 */
export function readAuthTokenClaims(
  token: null | string | undefined,
): AuthTokenClaims | null {
  if (!token) {
    return null;
  }
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) {
    return null;
  }
  const payload = decodeBase64Url(parts[1]);
  if (!payload) {
    return null;
  }
  try {
    const claims: unknown = JSON.parse(payload);
    if (!claims || typeof claims !== 'object') {
      return null;
    }
    const record = claims as Record<string, unknown>;
    const result: AuthTokenClaims = {};
    if (typeof record.exp === 'number' && Number.isFinite(record.exp)) {
      result.exp = record.exp;
    }
    if (typeof record.sub === 'string') {
      result.sub = record.sub;
    }
    if (typeof record.uid === 'number' || typeof record.uid === 'string') {
      result.uid = String(record.uid);
    }
    return result;
  } catch {
    return null;
  }
}

/** access token 的绝对过期时间（毫秒），无法解析时返回 null。 */
export function accessTokenExpiresAt(
  token: null | string | undefined,
): null | number {
  const exp = readAuthTokenClaims(token)?.exp;
  return typeof exp === 'number' ? exp * 1000 : null;
}
