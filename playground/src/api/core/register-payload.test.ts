import { describe, expect, it } from 'vitest';

import { createRegisterPayload } from './register-payload';

describe('createRegisterPayload', () => {
  it('only sends public registration fields and strips an injected roleId', () => {
    const payload = createRegisterPayload({
      captchaId: 'captcha-1',
      confirmPassword: 'Password123!',
      email: 'user@example.com',
      emailCode: '123456',
      password: 'Password123!',
      roleId: 1,
      username: 'normal-user',
    } as never);

    expect(payload).toEqual({
      captchaId: 'captcha-1',
      confirmPassword: 'Password123!',
      email: 'user@example.com',
      emailCode: '123456',
      mobile: undefined,
      mobileCode: undefined,
      password: 'Password123!',
      username: 'normal-user',
      website: '',
    });
    expect(payload).not.toHaveProperty('roleId');
  });

  it('passes the honeypot value through untouched', () => {
    const payload = createRegisterPayload({
      username: 'bot-user',
      website: 'https://spam.example',
    } as never);

    expect(payload.website).toBe('https://spam.example');
  });
});
