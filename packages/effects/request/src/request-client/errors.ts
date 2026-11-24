/**
 * 请求层自定义错误类型
 *
 * - CircuitOpenError: 熔断器 OPEN 期间 request() 不发出真实 HTTP，直接抛此错误，
 *   组合层捕获后降级保留旧数据（不清 UI、不弹错）。
 * - RequestConcurrencyTimeoutError: 在并发队列中等待超过 MAX_WAIT_MS，视为可重试的超时类错误。
 */

/** 熔断器 OPEN 期间的降级信号错误 */
class CircuitOpenError extends Error {
  /** 错误码，供组合层判断熔断期保留旧数据 */
  public code: string;

  /** 熔断分组 key */
  public circuitGroupKey: string;

  constructor(
    circuitGroupKey: string,
    message = 'service temporarily unavailable',
  ) {
    super(message);
    this.name = 'CircuitOpenError';
    this.code = 'CB_OPEN';
    this.circuitGroupKey = circuitGroupKey;
  }
}

/** 并发队列等待超时错误（可重试的 timeout 类错误） */
class RequestConcurrencyTimeoutError extends Error {
  /** 错误码，供重试策略识别为可重试 */
  public code: string;

  /** 等待超过的毫秒数 */
  public waitMs: number;

  constructor(waitMs: number) {
    super(`concurrency queue wait exceeded ${waitMs}ms`);
    this.name = 'RequestConcurrencyTimeoutError';
    this.code = 'CONCURRENCY_TIMEOUT';
    this.waitMs = waitMs;
  }
}

export { CircuitOpenError, RequestConcurrencyTimeoutError };