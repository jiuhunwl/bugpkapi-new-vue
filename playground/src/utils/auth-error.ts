/**
 * 区分「会话真的没了」和「这次请求没成功」。
 *
 * 只有刷新接口明确返回 401 才意味着 refresh token 已过期/被撤销/被登出，
 * 这时清掉本地会话标记、回登录页是对的。网络中断、网关 5xx、Redis 抖动、
 * 跨站 403 都只是这一次失败，不能据此让用户重新登录 —— 否则一次后端重启
 * 就能把所有人踢下线。
 */
export function isSessionDefinitivelyInvalid(error: unknown) {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const status = (error as { response?: { status?: unknown } }).response
    ?.status;
  return status === 401;
}
