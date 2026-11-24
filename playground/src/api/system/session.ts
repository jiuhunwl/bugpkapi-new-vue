import { requestClient } from '#/api/request';

export namespace SessionConfigApi {
  export interface Config {
    /** access token 有效期（分钟），5～1440 */
    accessTokenMinutes: number;
    /** refresh token 有效期（天），1～365 */
    refreshTokenDays: number;
  }
}

/** 读取登录态有效期配置（系统设置-登录态配置）。 */
export function getSessionConfigApi(signal?: AbortSignal) {
  return requestClient.get<SessionConfigApi.Config>('/system/session-config', {
    signal,
  });
}

/** 保存登录态有效期配置，保存后对新签发的令牌即时生效。 */
export function saveSessionConfigApi(data: SessionConfigApi.Config) {
  return requestClient.put<SessionConfigApi.Config>(
    '/system/session-config',
    data,
  );
}
