import { describe, expect, it, vi } from 'vitest';

import { CircuitBreaker } from './circuit-breaker';

const CONFIG = {
  failureThreshold: 5,
  halfOpenProbeMs: 3000,
  openWindowMs: 30_000,
};

describe('circuit-breaker', () => {
  it('stays closed on successes and intermittent failures', () => {
    const cb = new CircuitBreaker(CONFIG);
    cb.tryAcquire('api');
    cb.recordSuccess('api');
    for (let i = 0; i < 4; i++) {
      cb.recordFailure('api');
      cb.recordSuccess('api');
    }
    expect(cb.getState('api')).toBe('closed');
  });

  it('opens after the failure threshold and tryAcquire throws', () => {
    const cb = new CircuitBreaker(CONFIG);
    for (let i = 0; i < CONFIG.failureThreshold; i++) {
      cb.recordFailure('api');
    }
    expect(cb.getState('api')).toBe('open');
    expect(() => cb.tryAcquire('api')).toThrowError(
      expect.objectContaining({ code: 'CB_OPEN' }),
    );
  });

  it('opens after threshold and transitions to half-open after the window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    const cb = new CircuitBreaker(CONFIG);
    for (let i = 0; i < CONFIG.failureThreshold; i++) {
      cb.recordFailure('api');
    }
    expect(cb.getState('api')).toBe('open');

    // 未到窗口：仍为 open
    vi.setSystemTime(new Date('2024-01-01T00:00:10Z'));
    expect(cb.getState('api')).toBe('open');
    expect(() => cb.tryAcquire('api')).toThrowError(
      expect.objectContaining({ code: 'CB_OPEN' }),
    );

    // 已到窗口：进入 half-open 且允许探活
    vi.setSystemTime(new Date('2024-01-01T00:00:31Z'));
    expect(cb.getState('api')).toBe('half-open');
    expect(() => cb.tryAcquire('api')).not.toThrow();

    // half-open 探活失败 → 回到 open
    cb.recordFailure('api');
    expect(cb.getState('api')).toBe('open');
    vi.useRealTimers();
  });

  it('closes after half-open probe success', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    const cb = new CircuitBreaker(CONFIG);
    for (let i = 0; i < CONFIG.failureThreshold; i++) {
      cb.recordFailure('api');
    }
    vi.setSystemTime(new Date('2024-01-01T00:00:31Z'));
    expect(cb.getState('api')).toBe('half-open');
    cb.recordSuccess('api');
    expect(cb.getState('api')).toBe('closed');
    vi.useRealTimers();
  });

  it('keeps separate groups independent', () => {
    const cb = new CircuitBreaker(CONFIG);
    for (let i = 0; i < CONFIG.failureThreshold; i++) {
      cb.recordFailure('a');
    }
    expect(cb.getState('a')).toBe('open');
    expect(cb.getState('b')).toBe('closed');
  });

  it('isBreakerError recognizes the CircuitOpenError', () => {
    const cb = new CircuitBreaker(CONFIG);
    for (let i = 0; i < CONFIG.failureThreshold; i++) {
      cb.recordFailure('api');
    }
    let caught: unknown;
    try {
      cb.tryAcquire('api');
    } catch (error) {
      caught = error;
    }
    expect(cb.isBreakerError(caught)).toBe(true);
    expect(cb.isBreakerError(new Error('x'))).toBe(false);
  });
});