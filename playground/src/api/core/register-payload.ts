import type { AuthApi } from './auth';

export function createRegisterPayload(
  data: AuthApi.RegisterParams,
): AuthApi.RegisterParams {
  return {
    captchaId: data.captchaId,
    confirmPassword: data.confirmPassword,
    email: data.email,
    emailCode: data.emailCode,
    mobile: data.mobile,
    mobileCode: data.mobileCode,
    password: data.password,
    username: data.username,
    // Honeypot: real users never fill this CSS-hidden input; the backend
    // silently drops requests where it is non-empty.
    website: data.website ?? '',
  };
}
