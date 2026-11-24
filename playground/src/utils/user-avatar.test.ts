import { describe, expect, it } from 'vitest';

import { DEFAULT_VBEN_USER_AVATAR, resolveUserAvatar } from './user-avatar';

describe('resolveUserAvatar', () => {
  it('keeps a configured user avatar without involving the site logo', () => {
    expect(resolveUserAvatar(' https://assets.example/user-avatar.webp ')).toBe(
      'https://assets.example/user-avatar.webp',
    );
  });

  it.each([undefined, null, '', '   '])(
    'falls back to the original Vben avatar for %s',
    (avatar) => {
      expect(resolveUserAvatar(avatar)).toBe(DEFAULT_VBEN_USER_AVATAR);
    },
  );

  it('keeps any non-empty value as-is, including a slash-only path', () => {
    expect(resolveUserAvatar('/')).toBe('/');
  });
});
