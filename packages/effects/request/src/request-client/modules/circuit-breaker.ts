import type { CircuitBreakerConfig, CircuitState } from '../types';

import { CIRCUIT_FAIL_THRESHOLD, CIRCUIT_OPEN_MS } from '../constants';
import { CircuitOpenError } from '../errors';

/**
 * 熔断器（每接口分组 key 独立计数）
 *
 * 状态机：CLOSED →（连续失败 ≥ threshold）→ OPEN →（openWindowMs 后）→ HALF_OPEN
 *        →（探活成功）→ CLOSED；HALF_OPEN 探活失败一次 → 回到 OPEN 并重置窗口。
 *
 * OPEN 期间 tryAcquire 直接抛 CircuitOpenError（零 HTTP），组合层捕获后降级保留旧数据。
 */
class CircuitBreaker {
  private readonly failureThreshold: number;

  private readonly openWindowMs: number;

  /** key -> { failures, state, openedAt, halfOpenAt } */
  private groups = new Map<string, CircuitGroupState>();

  constructor(config?: CircuitBreakerConfig) {
    this.failureThreshold = config?.failureThreshold ?? CIRCUIT_FAIL_THRESHOLD;
    this.openWindowMs = config?.openWindowMs ?? CIRCUIT_OPEN_MS;
  }

  /**
   * 尝试获取请求许可：OPEN 抛出 CircuitOpenError；
   * HALF_OPEN 放行首个探活请求，探活在途（probeInFlight）期间后续请求拒绝（防止探活风暴）。
   */
  tryAcquire(key: string): void {
    const group = this.getGroup(key);
    if (group.state === 'open') {
      // 开放窗口到期：进入 half-open 并放行探活
      if (Date.now() - group.openedAt >= this.openWindowMs) {
        group.state = 'half-open';
        group.halfOpenAt = Date.now();
        group.failures = 0;
        group.probeInFlight = false;
      } else {
        throw new CircuitOpenError(key);
      }
      return;
    }
    if (group.state === 'half-open') {
      // half-open：放行首个探活请求，探活期间后续请求拒绝，防多路并发打爆后端
      if (group.probeInFlight) {
        throw new CircuitOpenError(key);
      }
      group.probeInFlight = true;
      return;
    }
    // closed：放行
  }

  /**
   * 记录成功（任一路径成功即重置连续失败计数；half-open 探活成功 → closed）
   */
  recordSuccess(key: string): void {
    const group = this.getGroup(key);
    group.failures = 0;
    if (group.state === 'half-open') {
      group.state = 'closed';
      group.openedAt = 0;
      group.halfOpenAt = 0;
      group.probeInFlight = false;
    }
  }

  /**
   * 记录失败（连续失败达到阈值 → open，并记录 openedAt）
   */
  recordFailure(key: string): void {
    const group = this.getGroup(key);
    group.failures++;
    if (group.state === 'half-open') {
      // 探活失败：回到 open 并重置窗口
      group.state = 'open';
      group.openedAt = Date.now();
      group.halfOpenAt = 0;
      group.probeInFlight = false;
      return;
    }
    if (group.failures >= this.failureThreshold) {
      group.state = 'open';
      group.openedAt = Date.now();
    }
  }

  /**
   * 获取当前熔断状态（open 到期时自动视图为 half-open）
   */
  getState(key: string): CircuitState {
    const group = this.getGroup(key);
    if (group.state === 'open') {
      if (Date.now() - group.openedAt >= this.openWindowMs) {
        group.state = 'half-open';
        group.halfOpenAt = Date.now();
        group.failures = 0;
        group.probeInFlight = false;
      }
    }
    return group.state;
  }

  /**
   * 判断错误是否为熔断降级信号（供组合层保留旧数据）
   */
  isBreakerError(error: unknown): error is CircuitOpenError {
    return error instanceof CircuitOpenError;
  }

  /**
   * 重置分组（测试/热更新用）
   */
  reset(key?: string): void {
    if (key !== undefined) {
      this.groups.delete(key);
      return;
    }
    this.groups.clear();
  }

  /** 当前分组数量（观测用） */
  get size(): number {
    return this.groups.size;
  }

  private getGroup(key: string): CircuitGroupState {
    let group = this.groups.get(key);
    if (!group) {
      group = {
        failures: 0,
        halfOpenAt: 0,
        openedAt: 0,
        probeInFlight: false,
        state: 'closed',
      };
      this.groups.set(key, group);
    }
    return group;
  }
}

interface CircuitGroupState {
  failures: number;
  state: CircuitState;
  openedAt: number;
  halfOpenAt: number;
  /** half-open 探活请求是否在途（防探活风暴） */
  probeInFlight: boolean;
}

export { CircuitBreaker };