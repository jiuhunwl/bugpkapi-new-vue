import type { GeoJSONCollection } from './geo-utils';

import { $t } from '#/locales';

/**
 * 下钻粒度类型：市级 / 区县级。
 */
export type DrilldownGranularity = 'city' | 'district';

/**
 * GeoJSON 加载错误对象。
 */
export interface GeoJSONLoadError extends Error {
  /** 请求的 6 位 adcode */
  adcode: string;
  /** 错误原因 */
  reason: 'empty' | 'network' | 'timeout';
  /** 人类可读的错误信息 */
  message: string;
  /** 是否可重试 */
  retryable: boolean;
}

/** DataV GeoJSON 数据返回类型 */
export type DatavGeoJSON = GeoJSONCollection;

/** 加载器对外接口 */
export interface DatavGeoLoader {
  /** 加载指定 adcode 的 GeoJSON（含缓存与重试） */
  loadGeoJSON(adcode: string): Promise<DatavGeoJSON>;
  /** 判断指定 adcode 是否已在缓存中 */
  has(adcode: string): boolean;
  /** 清空全部缓存 */
  clear(): void;
}

/** 创建加载器时的配置项 */
export interface DatavGeoLoaderOptions {
  /** 请求超时（毫秒），默认 8000 */
  timeout?: number;
  /** 最大重试次数（不含首次），默认 2 */
  maxRetries?: number;
  /** 重试间隔（毫秒），默认 1000 */
  retryDelay?: number;
  /** 自定义 URL 构造函数（部署方案切换点） */
  buildUrl?: (adcode: string) => string;
  /** 自定义 fetch（测试注入用） */
  fetchImpl?: typeof fetch;
}

/**
 * 默认 URL 构造函数 —— 方案 A（前端直连 DataV CDN）。
 *
 * 生产环境如需切换为方案 B（后端代理），只需替换此函数体为：
 *   `return \`/api/geo/proxy?adcode=${adcode}\`;`
 */
export function buildGeoJSONUrl(adcode: string): string {
  return `https://geo.datav.aliyun.com/areas_v3/bound/${adcode}_full.json`;
}

/** 默认超时 8s */
const DEFAULT_TIMEOUT = 8000;
/** 默认重试 2 次 */
const DEFAULT_MAX_RETRIES = 2;
/** 默认重试间隔 1s */
const DEFAULT_RETRY_DELAY = 1000;

/**
 * 创建一个 DataV GeoJSON 加载器。
 *
 * - 内置内存缓存（Map），同一 adcode 二次加载不发起网络请求。
 * - 支持超时与自动重试。
 * - inflight 去重：同一个 adcode 并发请求只发一次网络调用。
 *
 * @param options 配置项
 * @returns 加载器实例
 */
export function createDatavGeoLoader(
  options: DatavGeoLoaderOptions = {},
): DatavGeoLoader {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const retryDelay = options.retryDelay ?? DEFAULT_RETRY_DELAY;
  const buildUrl = options.buildUrl ?? buildGeoJSONUrl;
  const fetchImpl = options.fetchImpl ?? fetch;

  const cache = new Map<string, DatavGeoJSON>();
  const inflight = new Map<string, Promise<DatavGeoJSON>>();

  function has(adcode: string): boolean {
    return cache.has(adcode);
  }

  function clear(): void {
    cache.clear();
    inflight.clear();
  }

  function sleep(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function makeError(
    adcode: string,
    reason: GeoJSONLoadError['reason'],
    message: string,
    retryable: boolean,
  ): GeoJSONLoadError {
    return Object.assign(new Error(message), {
      adcode,
      name: 'GeoJSONLoadError',
      reason,
      retryable,
    });
  }

  /**
   * 执行一次 fetch（带超时）。
   * 返回 Promise<Response>；超时则 reject。
   */
  async function fetchOnce(url: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      return await fetchImpl(url, {
        signal: controller.signal,
      });
    } catch (error) {
      // AbortController 触发的 abort 归类为 timeout
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw makeError(
          url.split('/').pop()?.replace('_full.json', '') ?? '',
          'timeout',
          $t('adminAccess.drilldown.timeout', [timeout]),
          true,
        );
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function loadWithRetry(adcode: string): Promise<DatavGeoJSON> {
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const url = buildUrl(adcode);
        const response = await fetchOnce(url);
        if (!response.ok) {
          throw makeError(
            adcode,
            'network',
            $t('adminAccess.drilldown.httpError', [response.status]),
            true,
          );
        }
        const json: unknown = await response.json();
        const collection = json as DatavGeoJSON;
        if (
          !collection ||
          !Array.isArray(collection.features) ||
          collection.features.length === 0
        ) {
          throw makeError(
            adcode,
            'empty',
            $t('adminAccess.drilldown.noSubdivisions'),
            false,
          );
        }
        return collection;
      } catch (error) {
        lastError = error;
        // 不可重试的错误直接抛出
        if (error instanceof Error && 'retryable' in error) {
          const loadError = error as GeoJSONLoadError;
          if (!loadError.retryable) {
            throw loadError;
          }
        }
        // 还有重试机会则等待后继续
        if (attempt < maxRetries) {
          await sleep(retryDelay);
        }
      }
    }
    // 重试耗尽
    if (lastError instanceof Error && 'reason' in lastError) {
      const loadError: GeoJSONLoadError = lastError as GeoJSONLoadError;
      throw makeError(
        loadError.adcode,
        loadError.reason,
        loadError.message,
        loadError.retryable,
      );
    }
    throw makeError(
      adcode,
      'network',
      $t('adminAccess.drilldown.loadRegionFailed', [adcode]),
      true,
    );
  }

  async function loadGeoJSON(adcode: string): Promise<DatavGeoJSON> {
    const normalized = String(adcode).trim();
    // 缓存命中
    const cached = cache.get(normalized);
    if (cached) return cached;
    // inflight 去重
    const existing = inflight.get(normalized);
    if (existing) return existing;

    const promise = loadWithRetry(normalized)
      .then((result) => {
        cache.set(normalized, result);
        inflight.delete(normalized);
        return result;
      })
      .catch((error) => {
        inflight.delete(normalized);
        throw error;
      });
    inflight.set(normalized, promise);
    return promise;
  }

  return {
    clear,
    has,
    loadGeoJSON,
  };
}

/**
 * 共享的单例加载器实例。
 *
 * 全模块共用一个缓存，避免多次实例化导致缓存分散。
 * 测试中可使用 `createDatavGeoLoader()` 自行构造独立实例。
 */
export const datavGeoLoader = createDatavGeoLoader();
