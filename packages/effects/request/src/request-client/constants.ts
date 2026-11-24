/**
 * 请求层共享常量（BugPk-Api 工作台并发请求优化）
 *
 * 所有默认值集中在此，请求层模块（去重/限流/重试/熔断）统一引用，
 * 避免在不同文件中散落魔法数字。
 */

/** 去重指纹分隔符（method | url?params 用作 key 拼接，避免碰撞） */
export const DEDUPE_KEY_SEP = '|';

/** 全局并发上限：工作台统计等普通请求同时进行的最多数量 */
export const MAX_CONCURRENCY = 5;

/** GET 幂等重试的最大次数（timeout/network 最多重试 1 次） */
export const MAX_RETRY = 1;

/** 重试指数退避的初始延迟基数（ms） */
export const BACKOFF_BASE_MS = 300;

/** 重试退避延迟上限（ms） */
export const BACKOFF_MAX_MS = 2000;

/** 重试退避随机抖动比例（0.3 = ±30%） */
export const JITTER_RATIO = 0.3;

/** 前端默认请求超时（ms）：与后端 8s 限时对齐，避免前端等后端恢复造成空等 */
export const DEFAULT_TIMEOUT_MS = 8000;

/** 熔断器：连续失败多少次后进入 OPEN（不再放行真实 HTTP） */
export const CIRCUIT_FAIL_THRESHOLD = 5;

/** 熔断器：OPEN 保持时长（ms），到期后进入 half-open 探活 */
export const CIRCUIT_OPEN_MS = 30000;

/** 熔断器：half-open 探活并发探测窗口（ms），成功即闭合 */
export const HALF_OPEN_PROBE_MS = 3000;

/** 并发队列最大等待时长（ms）：防止请求无限排队挂死 */
export const MAX_WAIT_MS = 5000;