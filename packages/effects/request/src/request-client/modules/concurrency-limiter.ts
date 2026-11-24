import { RequestConcurrencyTimeoutError } from '../errors';

/**
 * 全局并发限流器（手写 FIFO 信号量，无第三方依赖）
 *
 * 用于约束工作台等高并发场景的瞬时在途请求数：
 * - acquire 排队等待，release 后按 FIFO 唤醒下一个；
 * - 旁路（skipConcurrency）请求直接通行，不占常规额度；
 * - dispose 释放所有排队者（组件卸载 / 熔断后阻塞唤醒）。
 */
export interface ConcurrencyLimiterOptions {
  /** 最大并行数，默认 5 */
  max?: number;
  /** 最长排队等待时间（ms），超时抛 RequestConcurrencyTimeoutError */
  maxWaitMs?: number;
}

class GlobalConcurrencyLimiter {
  private active = 0;

  private disposed = false;

  private waiters: Array<{
    reject: (reason?: unknown) => void;
    resolve: () => void;
    timer?: ReturnType<typeof setTimeout>;
  }> = [];

  private readonly max: number;

  private readonly maxWaitMs: number;

  constructor(options: ConcurrencyLimiterOptions = {}) {
    this.max = options.max ?? 5;
    this.maxWaitMs = options.maxWaitMs ?? 5000;
  }

  /**
   * 获取当前活跃（在途）请求数
   */
  get activeCountValue(): number {
    return this.active;
  }

  /**
   * 获取当前排队等待请求数
   */
  get pendingCount(): number {
    return this.waiters.length;
  }

  /**
   * 获取最大并发数
   */
  get maxConcurrency(): number {
    return this.max;
  }

  /**
   * 获取最大等待时长（ms）
   */
  get maxWait(): number {
    return this.maxWaitMs;
  }

  /**
   * 是否已释放（dispose 后不可再 acquire）
   */
  get isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * 获取一个执行许可：排队等待直至有空位或超时。
   * 返回 release 函数，请求完成后必须调用。
   * @returns release 函数
   */
  async acquire(): Promise<() => void> {
    if (this.disposed) {
      return () => undefined;
    }
    if (this.active < this.max) {
      this.active++;
      return this.createRelease();
    }
    // 排队等待：FIFO
    await new Promise<void>((resolve, reject) => {
      const waiter: {
        reject: (reason?: unknown) => void;
        resolve: () => void;
        timer?: ReturnType<typeof setTimeout>;
      } = { reject, resolve };
      waiter.timer = setTimeout(() => {
        const index = this.waiters.indexOf(waiter);
        if (index >= 0) {
          this.waiters.splice(index, 1);
        }
        reject(new RequestConcurrencyTimeoutError(this.maxWaitMs));
      }, this.maxWaitMs);
      this.waiters.push(waiter);
    });
    return this.createRelease();
  }

  /**
   * 旁路判断由调用方处理（config.skipConcurrency === true），
   * 这里提供静态工具判定，便于测试与请求层统一逻辑。
   */
  static isBypassed(options: { skipConcurrency?: boolean }): boolean {
    return options?.skipConcurrency === true;
  }

  /**
   * 释放一个配额：唤醒下一个排队者（FIFO）
   */
  private release(): void {
    this.active--;
    if (this.disposed) {
      return;
    }
    while (this.waiters.length > 0 && this.active < this.max) {
      const waiter = this.waiters.shift();
      if (!waiter) {
        break;
      }
      if (waiter.timer) {
        clearTimeout(waiter.timer);
      }
      this.active++;
      waiter.resolve();
    }
  }

  /**
   * 创建释放 release（幂等，防止重复释放）
   */
  private createRelease(): () => void {
    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;
      this.release();
    };
  }

  /**
   * 释放所有排队者（组件卸载 / 主动取消），
   * 之后新 acquire 直接放行（不再阻塞）。
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const waiter of this.waiters) {
      if (waiter.timer) {
        clearTimeout(waiter.timer);
      }
      waiter.reject(new RequestDisposedError());
    }
    this.waiters = [];
  }
}

/** 并发器被 dispose 后新 acquire 的异常（不用于业务重试） */
class RequestDisposedError extends Error {
  constructor() {
    super('concurrency limiter disposed');
    this.name = 'RequestDisposedError';
  }
}

export { GlobalConcurrencyLimiter, RequestDisposedError };