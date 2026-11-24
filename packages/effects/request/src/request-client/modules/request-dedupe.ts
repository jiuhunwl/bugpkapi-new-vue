import type { DedupeEntry, RequestClientConfig } from '../types';

/**
 * 请求去重 Store：同指纹（method+url+params+data）进行中请求共享同一 Promise。
 *
 * 不依赖第三方库，内部为 Map。key 由稳定序列化生成（参数顺序无关）。
 */
class RequestDedupeStore {
  private pending = new Map<string, DedupeEntry>();

  /**
   * 构造稳定指纹 key：
   * `${method}|${url}?${stableStringify(params)}`，data 存在时追加 `|body=${...}`。
   * params 按 key 排序，保证相同语义的请求（不同参数顺序）key 一致。
   */
  static keyOf(
    method: string,
    url: string,
    config?: RequestClientConfig,
  ): string {
    const m = String(method || 'GET').toUpperCase();
    const u = url || '';
    const params = config?.params ?? {};
    const data = config?.data;
    const paramsKey = stableStringify(params);
    const bodyKey =
      data === undefined || data === null
        ? ''
        : `|body=${stableStringify(data)}`;
    const sessionKey =
      config?.__authSessionGeneration === undefined
        ? ''
        : `|session=${config.__authSessionGeneration}`;
    return `${m}|${u}?${paramsKey}${bodyKey}${sessionKey}`;
  }

  /**
   * 获取进行中的共享 Promise（不存在或已取消则返回 undefined）
   */
  get(key: string): Promise<unknown> | undefined {
    const entry = this.pending.get(key);
    if (!entry || entry.canceled) {
      return undefined;
    }
    return entry.promise;
  }

  /**
   * 记录新的进行中请求
   */
  set(key: string, promise: Promise<unknown>): void {
    this.pending.set(key, {
      canceled: false,
      createdAt: Date.now(),
      promise,
    });
  }

  /**
   * 移除记录（请求完成/失败后由调用方在 finally 调用）
   */
  delete(key: string): void {
    this.pending.delete(key);
  }

  /**
   * 判断 key 是否正在被共享
   */
  has(key: string): boolean {
    return this.pending.has(key);
  }

  /**
   * 标记进行中请求被组件取消：取消后不再共享给后续调用方。
   * 仅标记，真正的 abort 由 signal 传播（见 request() 合并）。
   */
  markCanceled(key: string): void {
    const entry = this.pending.get(key);
    if (entry) {
      entry.canceled = true;
    }
  }

  /**
   * 当前去重表中的进行中 key 数量（测试/观测用）
   */
  get size(): number {
    return this.pending.size;
  }

  /**
   * 清空去重表（测试或重置用）
   */
  clear(): void {
    this.pending.clear();
  }
}

/**
 * 稳定序列化：对象 key 排序 + JSON，忽略 undefined 字段；
 * 数组按原顺序；标量直接 JSON。
 */
function stableStringify(value: unknown): string {
  if (value === undefined) {
    return '';
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort();
    const parts = keys.map((key) => {
      const item = record[key];
      if (item === undefined) {
        return '';
      }
      return `${JSON.stringify(key)}:${stableStringify(item)}`;
    });
    return `{${parts.join(',')}}`;
  }
  return JSON.stringify(value);
}

export { RequestDedupeStore, stableStringify };
