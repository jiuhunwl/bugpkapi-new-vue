const QQ_OAUTH_HOSTS = new Set(['connect.qq.com', 'graph.qq.com']);

function resolveOfficialQqAuthorizeUrl(value: unknown): null | string {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (
      parsed.protocol !== 'https:' ||
      parsed.username ||
      parsed.password ||
      parsed.hash ||
      !QQ_OAUTH_HOSTS.has(parsed.hostname.toLowerCase())
    ) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

export { resolveOfficialQqAuthorizeUrl };
