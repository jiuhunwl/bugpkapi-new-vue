import type {
  AxiosRequestConfig,
  AxiosResponse,
  CreateAxiosDefaults,
  GenericAbortSignal,
  InternalAxiosRequestConfig,
} from 'axios';

type ExtendOptions<T = any> = {
  /** 应用侧认证会话代次，用于隔离旧请求、重试和进行中的去重项。 */
  __authSessionGeneration?: number;
  /**
   * 参数序列化方式。预置的有
   * - brackets: ids[]=1&ids[]=2&ids[]=3
   * - comma: ids=1,2,3
   * - indices: ids[0]=1&ids[1]=2&ids[2]=3
   * - repeat: ids=1&ids=2&ids=3
   */
  paramsSerializer?:
    | 'brackets'
    | 'comma'
    | 'indices'
    | 'repeat'
    | AxiosRequestConfig<T>['paramsSerializer'];
  /**
   * 响应数据的返回方式。
   * - raw: 原始的AxiosResponse，包括headers、status等，不做是否成功请求的检查。
   * - body: 返回响应数据的BODY部分（只会根据status检查请求是否成功，忽略对code的判断，这种情况下应由调用方检查请求是否成功）。
   * - data: 解构响应的BODY数据，只返回其中的data节点数据（会检查status和code是否为成功状态）。
   */
  responseReturn?: 'body' | 'data' | 'raw';
};

/**
 * 请求级去重模式
 * - 'pending'（默认）：同指纹进行中则复用同一 Promise，结束后可再发
 * - 'force'：无视进行中直接新发（不进入 dedupe map）
 * - 'none'：完全关闭去重
 */
type RequestDedupeMode = 'none' | 'pending' | 'force';

/**
 * 可重试错误分类（用于错误分类判定与重试策略）
 * - network: 网络层错误（axios Network Error / ECONNABORTED）
 * - timeout: 超时错误（axios code=ECONNABORTED）
 * - http5xx: HTTP 5xx（含 522 Origin Connection Time-out）
 * - http522: 单独标记 522
 */
type RetriableError = 'network' | 'timeout' | 'http5xx' | 'http522';

/**
 * 重试策略配置
 */
interface RequestRetryPolicy {
  /** 最大重试次数，默认 1（GET 幂等） */
  maxRetries: number;
  /** 指数退避基础延迟（ms），默认 300 */
  baseDelayMs: number;
  /** 退避延迟上限（ms），默认 2000 */
  maxDelayMs: number;
  /** 随机抖动比例，默认 0.3 */
  jitterRatio: number;
  /** 是否应该重试：错误分类 + 方法幂等性判定 */
  shouldRetry(error: unknown, method: string): boolean;
  /** 第 attempt 次重试的退避延迟（ms）：指数退避 + 抖动 */
  delayForAttempt(attempt: number): number;
}

/**
 * 熔断器配置
 */
interface CircuitBreakerConfig {
  /** 连续失败触发 open 的次数，默认 5 */
  failureThreshold: number;
  /** open 保持时间窗口（ms），默认 30_000 */
  openWindowMs: number;
  /** half-open 探活探测频率（ms），默认 3_000 */
  halfOpenProbeMs: number;
}

/**
 * 熔断器状态
 */
type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * 去重表条目：进行中请求的元数据
 */
interface DedupeEntry {
  /** 进行中请求的共享 Promise */
  promise: Promise<unknown>;
  /** 创建时间 */
  createdAt: number;
  /** 由组件取消标记，标记后不再共享给后续调用方 */
  canceled: boolean;
}

type RequestClientConfig<T = any> = AxiosRequestConfig<T> &
  ExtendOptions<T> & {
    /**
     * 请求级去重；同指纹进行中请求共享同一 Promise。
     * - 'pending'（默认）：进行中则复用，结束后可再发
     * - 'force'：无视进行中直接新发（不进入 dedupe map）
     * - 'none'：完全关闭去重
     */
    dedupe?: RequestDedupeMode;
    /** 手动取消信号（组件/路由离开时调用者持有） */
    signal?: AbortSignal | GenericAbortSignal;
    /** 请求取消注册：为 true 时 request() 自动串联，组件卸载可 abort */
    withAbort?: boolean;
    /** GET/HEAD 幂等可重试；默认由方法判定，也可显式覆盖 */
    retry?: boolean | { count?: number; delayMs?: number };
    /** 全局并发限制的旁路（token 刷新 / 登录 / SSE / 上传 / 下载） */
    skipConcurrency?: boolean;
    /** 错误分类 fallback：调用方自定义判定是否可重试 */
    isRetriableError?: (error: unknown) => boolean;
    /** 熔断分组 key；默认为 `${method} ${host}` */
    circuitGroupKey?: string;
  };

type RequestResponse<T = any> = AxiosResponse<T> & {
  config: RequestClientConfig<T>;
};

type RequestContentType =
  | 'application/json;charset=utf-8'
  | 'application/octet-stream;charset=utf-8'
  | 'application/x-www-form-urlencoded;charset=utf-8'
  | 'multipart/form-data;charset=utf-8';

type RequestClientOptions = CreateAxiosDefaults &
  ExtendOptions &
  Partial<RequestClientConfig>;

/**
 * SSE 请求选项
 */
interface SseRequestOptions extends RequestInit {
  onMessage?: (message: string) => void;
  onEnd?: () => void;
}

interface RequestInterceptorConfig {
  fulfilled?: (
    config: ExtendOptions & InternalAxiosRequestConfig,
  ) =>
    | (ExtendOptions & InternalAxiosRequestConfig<any>)
    | Promise<ExtendOptions & InternalAxiosRequestConfig<any>>;
  rejected?: (error: any) => any;
}

interface ResponseInterceptorConfig<T = any> {
  fulfilled?: (
    response: RequestResponse<T>,
  ) => Promise<RequestResponse> | RequestResponse;
  rejected?: (error: any) => any;
}

type MakeErrorMessageFn = (message: string, error: any) => void;

interface HttpResponse<T = any> {
  /**
   * 0 表示成功，其他表示失败
   * 0 means success, others means fail
   */
  code: number;
  data: T;
  message: string;
}

export type {
  CircuitBreakerConfig,
  CircuitState,
  DedupeEntry,
  HttpResponse,
  MakeErrorMessageFn,
  RequestClientConfig,
  RequestClientOptions,
  RequestContentType,
  RequestDedupeMode,
  RequestInterceptorConfig,
  RequestResponse,
  RequestRetryPolicy,
  ResponseInterceptorConfig,
  RetriableError,
  SseRequestOptions,
};
