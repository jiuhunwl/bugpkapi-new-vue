import type {
  AxiosInstance,
  AxiosResponse,
  GenericAbortSignal,
} from 'axios';

import type {
  RequestClientConfig,
  RequestClientOptions,
  RequestRetryPolicy,
} from './types';

import { bindMethods, isString, merge } from '@vben/utils';

import axios from 'axios';
import qs from 'qs';

import { DEFAULT_TIMEOUT_MS, MAX_CONCURRENCY, MAX_WAIT_MS } from './constants';
import { CircuitBreaker } from './modules/circuit-breaker';
import { GlobalConcurrencyLimiter } from './modules/concurrency-limiter';
import { FileDownloader } from './modules/downloader';
import { InterceptorManager } from './modules/interceptor';
import { RequestDedupeStore } from './modules/request-dedupe';
import { createRetryPolicy, isCancelError, sleep } from './modules/retry-policy';
import { SSE } from './modules/sse';
import { FileUploader } from './modules/uploader';

function getParamsSerializer(
  paramsSerializer: RequestClientOptions['paramsSerializer'],
) {
  if (isString(paramsSerializer)) {
    switch (paramsSerializer) {
      case 'brackets': {
        return (params: any) =>
          qs.stringify(params, { arrayFormat: 'brackets' });
      }
      case 'comma': {
        return (params: any) => qs.stringify(params, { arrayFormat: 'comma' });
      }
      case 'indices': {
        return (params: any) =>
          qs.stringify(params, { arrayFormat: 'indices' });
      }
      case 'repeat': {
        return (params: any) => qs.stringify(params, { arrayFormat: 'repeat' });
      }
    }
  }
  return paramsSerializer;
}

/**
 * 将调用方 signal 与内部 AbortController 串联：
 * - 调用方 signal 已 aborted → 内部立即 abort；
 * - 未 aborted → 监听 callerSignal 的 abort 事件同步 abort；
 * 返回合并后的 signal 供 axios 使用，保证组件卸载时能取消在途请求。
 */
function toAbortSignal(callerSignal?: GenericAbortSignal): AbortSignal {
  const ctrl = new AbortController();
  if (callerSignal) {
    if (callerSignal.aborted) {
      ctrl.abort();
    } else {
      callerSignal.addEventListener?.('abort', () => ctrl.abort(), {
        once: true,
      });
    }
  }
  return ctrl.signal;
}

/**
 * 解析重试配置：布尔 / { count, delayMs } / 未指定。
 * `enabled=false` 表示显式关闭重试；其余情况默认开启重试，
 * 但最终是否真正重试由 RetryPolicy.shouldRetry 按“幂等方法 + 可重试错误”判定
 * （即默认只有 GET/HEAD 的 network/timeout 才重试 ≤1 次）。
 */
function resolveRetryConfig(
  retry: RequestClientConfig['retry'],
): { count: number; delayMs?: number; enabled: boolean } {
  if (retry === false) {
    return { count: 0, enabled: false };
  }
  if (retry === true) {
    return { count: 1, enabled: true };
  }
  if (retry && typeof retry === 'object') {
    return { count: retry.count ?? 1, delayMs: retry.delayMs, enabled: true };
  }
  // 未指定：默认启用（幂等 GET 的 network/timeout 最多重试 1 次）
  return { count: 1, enabled: true };
}

class RequestClient {
  public addRequestInterceptor: InterceptorManager['addRequestInterceptor'];

  public addResponseInterceptor: InterceptorManager['addResponseInterceptor'];
  public download: FileDownloader['download'];

  public readonly instance: AxiosInstance;
  // 是否正在刷新token
  public isRefreshing = false;
  public postSSE: SSE['postSSE'];
  // 刷新token队列
  public refreshTokenQueue: Array<{
    reject: (reason?: any) => void;
    resolve: (token: string) => void;
  }> = [];
  public requestSSE: SSE['requestSSE'];
  public upload: FileUploader['upload'];

  /** 全局并发信号量（工作台等普通请求受控；token刷新/登录/上传/下载旁路） */
  private readonly concurrencyLimiter: GlobalConcurrencyLimiter;

  /** 请求级去重表（同指纹进行中请求共享同一 Promise） */
  private readonly dedupeStore: RequestDedupeStore;

  /** 熔断器（按 host 分组，连续失败 N 次后短路） */
  private readonly circuitBreaker: CircuitBreaker;

  /**
   * 构造函数，用于创建Axios实例
   * @param options - Axios请求配置，可选
   */
  constructor(options: RequestClientOptions = {}) {
    // 合并默认配置和传入的配置
    const defaultConfig: RequestClientOptions = {
      headers: {
        'Content-Type': 'application/json;charset=utf-8',
      },
      responseReturn: 'raw',
      // 默认超时时间：8s，与后端服务 8s 限时对齐，避免 “前端等后端恢复、后端已超时取消” 的空等
      timeout: DEFAULT_TIMEOUT_MS,
    };
    const { ...axiosConfig } = options;
    const requestConfig = merge(axiosConfig, defaultConfig);
    requestConfig.paramsSerializer = getParamsSerializer(
      requestConfig.paramsSerializer,
    );
    this.instance = axios.create(requestConfig);

    this.concurrencyLimiter = new GlobalConcurrencyLimiter({
      max: MAX_CONCURRENCY,
      maxWaitMs: MAX_WAIT_MS,
    });
    this.dedupeStore = new RequestDedupeStore();
    this.circuitBreaker = new CircuitBreaker();

    bindMethods(this);

    // 实例化拦截器管理器
    const interceptorManager = new InterceptorManager(this.instance);
    this.addRequestInterceptor =
      interceptorManager.addRequestInterceptor.bind(interceptorManager);
    this.addResponseInterceptor =
      interceptorManager.addResponseInterceptor.bind(interceptorManager);

    // 实例化文件上传器
    const fileUploader = new FileUploader(this);
    this.upload = fileUploader.upload.bind(fileUploader);
    // 实例化文件下载器
    const fileDownloader = new FileDownloader(this);
    this.download = fileDownloader.download.bind(fileDownloader);
    // 实例化SSE模块
    const sse = new SSE(this);
    this.postSSE = sse.postSSE.bind(sse);
    this.requestSSE = sse.requestSSE.bind(sse);
  }

  /**
   * DELETE请求方法
   */
  public delete<T = any>(
    url: string,
    config?: RequestClientConfig,
  ): Promise<T> {
    return this.request<T>(url, {
      ...config,
      method: 'DELETE',
    });
  }

  /**
   * GET请求方法
   */
  public get<T = any>(url: string, config?: RequestClientConfig): Promise<T> {
    return this.request<T>(url, {
      ...config,
      method: 'GET',
    });
  }

  /**
   * 获取基础URL
   */
  public getBaseUrl() {
    return this.instance.defaults.baseURL;
  }

  /**
   * POST请求方法
   */
  public post<T = any>(
    url: string,
    data?: any,
    config?: RequestClientConfig,
  ): Promise<T> {
    return this.request<T>(url, {
      ...config,
      data,
      method: 'POST',
    });
  }

  /**
   * PUT请求方法
   */
  public put<T = any>(
    url: string,
    data?: any,
    config?: RequestClientConfig,
  ): Promise<T> {
    return this.request<T>(url, {
      ...config,
      data,
      method: 'PUT',
    });
  }

  /**
   * 通用的请求方法 —— 唯一收口（get/post/put/delete 均经此）
   *
   * 优化链路（并发优化五件事，按序执行）：
   * 1) 熔断准入（OPEN 直接抛 CircuitOpenError → 组合层降级旧数据）
   * 2) 请求级去重（同指纹进行中共享同一 Promise）
   * 3) signal 合并（调用方 signal + 内部 AbortController）
   * 4) 全局并发限流（旁路请求：token刷新/登录/上传/下载 越过队列）
   * 5) 重试（GET/HEAD 幂等 network/timeout ≤ 1 次），成功/失败记录熔断
   * 取消（abort）不重试、不计熔断。
   */
  public async request<T>(
    url: string,
    config: RequestClientConfig,
  ): Promise<T> {
    const method = String(config.method || 'GET').toUpperCase();
    const finalUrl = url || '';

    // 1) 熔断准入：OPEN 状态直接抛 CircuitOpenError（HTTP 0 发出）
    const circuitKey = this.resolveCircuitGroupKey(config, finalUrl);
    this.circuitBreaker.tryAcquire(circuitKey);

    // 重试策略（按 config.retry 覆盖；未指定则默认启用：GET/HEAD 幂等 network/timeout ≤1 次）
    const retryInfo = resolveRetryConfig(config.retry) as {
      count: number;
      delayMs?: number;
      enabled: boolean;
    };
    const retryPolicy = createRetryPolicy({
      isRetriableError: config.isRetriableError,
      maxRetries: retryInfo.enabled ? retryInfo.count : 0,
    });

    // 2) 请求级去重：同指纹进行中请求共享同一 Promise
    const requestKey = RequestDedupeStore.keyOf(method, finalUrl, config);
    const dedupeEnabled =
      config.dedupe === undefined || config.dedupe === 'pending';
    if (dedupeEnabled) {
      const sharedPromise = this.dedupeStore.get(requestKey);
      if (sharedPromise) {
        return sharedPromise as Promise<T>;
      }
    }

    // 3) 并发限流（旁路请求直接越过队列，不占常规额度）
    const bypassed =
      GlobalConcurrencyLimiter.isBypassed(config) ||
      this.isBypassUrl(finalUrl);

    // 去重占位必须在 await acquire() 之前同步登记：否则并发同 key 请求
    // 会都先 get 到 undefined、各自 acquire、各自发真实 HTTP，去重失效。
    // 这里先注册一个 deferred Promise 作为占位，后续请求直接复用；
    // 真正执行体完成后再 resolve/reject 该占位，finally 中删除 key。
    let dedupeResolve!: (value: T | PromiseLike<T>) => void;
    let dedupeReject!: (reason?: any) => void;
    let dedupePromise: Promise<T> | undefined;
    if (dedupeEnabled) {
      dedupePromise = new Promise<T>((resolve, reject) => {
        dedupeResolve = resolve;
        dedupeReject = reject;
      });
      this.dedupeStore.set(requestKey, dedupePromise);
    }

    let release: (() => void) | undefined;
    try {
      release = bypassed ? undefined : await this.concurrencyLimiter.acquire();
    } catch (error) {
      // 排队超时等 acquire 失败：占位需要一并拒绝并清表，避免悬挂的共享 Promise
      if (dedupeEnabled) {
        this.dedupeStore.delete(requestKey);
        dedupeReject(error);
      }
      throw error;
    }

    // 4) 执行器：内部包含重试循环 + 熔断记录；结束后释放并发配额
    const executor = async (): Promise<T> => {
      try {
        return await this.executeWithRetry<T>(
          config,
          finalUrl,
          method,
          circuitKey,
          retryPolicy,
          retryInfo.delayMs,
        );
      } finally {
        release?.();
      }
    };

    // 5) 执行并把结果回填给占位 Promise；成功/失败后删除 key
    if (dedupeEnabled) {
      executor()
        .then(dedupeResolve, dedupeReject)
        .finally(() => {
          this.dedupeStore.delete(requestKey);
        });
      return dedupePromise as Promise<T>;
    }
    return executor();
  }

  /** 熔断分组 key：优先 config.circuitGroupKey，默认 `${method} ${host}` */
  private resolveCircuitGroupKey(
    config: RequestClientConfig,
    url: string,
  ): string {
    if (config.circuitGroupKey) {
      return config.circuitGroupKey;
    }
    const method = String(config.method || 'GET').toUpperCase();
    const baseUrl = this.getBaseUrl() || 'http://localhost';
    let origin = baseUrl;
    try {
      origin = new URL(url, baseUrl).origin;
    } catch {
      // 保留 baseUrl 作为 origin
    }
    return `${method} ${origin}`;
  }

  /** 旁路路径判定：token 刷新 / 登录 / 上传 / 下载不经过并发队列 */
  private isBypassUrl(url: string): boolean {
    return (
      url.includes('/auth/refresh') ||
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.startsWith('/upload') ||
      url.startsWith('/download')
    );
  }

  /**
   * 执行请求并支持有限重试。
   * - callerSignal 已取消时直接抛取消错误（不重试、不计熔断）
   * - 幂等 GET network/timeout 至多重试 maxRetries 次（指数退避 + 抖动）
   * - 其余失败（5xx 等）默认不重试但记一次熔断失败
   */
  private async executeWithRetry<T>(
    config: RequestClientConfig,
    url: string,
    method: string,
    circuitKey: string,
    retryPolicy: RequestRetryPolicy,
    fixedDelayMs?: number,
  ): Promise<T> {
    const mergedSignal = toAbortSignal(config.signal);
    let attemptNo = 0;
    for (;;) {
      attemptNo++;
      if (config.signal?.aborted || mergedSignal.aborted) {
        const error = new Error('Request canceled');
        Object.assign(error, { code: 'ERR_CANCELED' });
        throw error;
      }
      try {
        const response: AxiosResponse<T> = await this.instance({
          ...config,
          signal: mergedSignal,
          url,
        });
        this.circuitBreaker.recordSuccess(circuitKey);
        return response as T;
      } catch (error: any) {
        // 取消不重试、不计熔断
        if (isCancelError(error)) {
          throw error.response ? error.response.data : error;
        }
        const shouldRetry =
          attemptNo <= retryPolicy.maxRetries &&
          retryPolicy.shouldRetry(error, method);
        if (shouldRetry) {
          const delayMs =
            fixedDelayMs ?? retryPolicy.delayForAttempt(attemptNo + 1);
          await sleep(delayMs);
          continue;
        }
        this.circuitBreaker.recordFailure(circuitKey);
        throw error.response ? error.response.data : error;
      }
    }
  }
}

export { RequestClient };