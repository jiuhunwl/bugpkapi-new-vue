const DEFAULT_VBEN_USER_AVATAR =
  'https://unpkg.com/@vbenjs/static-source@0.1.7/source/avatar-v1.webp';

function resolveUserAvatar(avatar: unknown): string {
  const value = String(avatar ?? '').trim();
  return value || DEFAULT_VBEN_USER_AVATAR;
}

export { DEFAULT_VBEN_USER_AVATAR, resolveUserAvatar };
