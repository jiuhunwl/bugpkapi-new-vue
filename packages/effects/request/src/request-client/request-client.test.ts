import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RequestClient } from './request-client';

describe('requestClient', () => {
  let mock: MockAdapter;
  let requestClient: RequestClient;

  beforeEach(() => {
    mock = new MockAdapter(axios);
    requestClient = new RequestClient();
  });

  afterEach(() => {
    mock.reset();
    vi.restoreAllMocks();
  });

  it('should successfully make a GET request', async () => {
    mock.onGet('test/url').reply(200, { data: 'response' });

    const response = await requestClient.get('test/url');

    expect(response.data).toEqual({ data: 'response' });
  });

  it('should successfully make a POST request', async () => {
    const postData = { key: 'value' };
    const mockData = { data: 'response' };
    mock.onPost('/test/post', postData).reply(200, mockData);
    const response = await requestClient.post('/test/post', postData);
    expect(response.data).toEqual(mockData);
  });

  it('should successfully make a PUT request', async () => {
    const putData = { key: 'updatedValue' };
    const mockData = { data: 'updated response' };
    mock.onPut('/test/put', putData).reply(200, mockData);
    const response = await requestClient.put('/test/put', putData);
    expect(response.data).toEqual(mockData);
  });

  it('should successfully make a DELETE request', async () => {
    const mockData = { data: 'delete response' };
    mock.onDelete('/test/delete').reply(200, mockData);
    const response = await requestClient.delete('/test/delete');
    expect(response.data).toEqual(mockData);
  });

  it('should handle network errors', async () => {
    mock.onGet('/test/error').networkError();
    await expect(requestClient.get('/test/error')).rejects.toMatchObject({
      isAxiosError: true,
      message: 'Network Error',
    });
  });

  it('should handle timeout', async () => {
    mock.onGet('/test/timeout').timeout();
    await expect(requestClient.get('/test/timeout')).rejects.toMatchObject({
      isAxiosError: true,
      code: 'ECONNABORTED',
    });
  });

  it('should share a single HTTP request for concurrent identical GETs (dedupe)', async () => {
    let requestCount = 0;
    mock.onGet('/test/dedupe').reply(() => {
      requestCount++;
      return new Promise((resolve) => {
        setTimeout(() => resolve([200, { data: 'shared' }]), 30);
      });
    });

    const [a, b, c] = await Promise.all([
      requestClient.get('/test/dedupe'),
      requestClient.get('/test/dedupe'),
      requestClient.get('/test/dedupe'),
    ]);

    expect(requestCount).toBe(1);
    expect(a.data).toEqual({ data: 'shared' });
    expect(b.data).toEqual({ data: 'shared' });
    expect(c.data).toEqual({ data: 'shared' });
  });

  it('should retry GET network errors at most once and then succeed', async () => {
    let callCount = 0;
    const customAdapter = (config: any) => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(
          Object.assign(new Error('Network Error'), {
            code: 'ERR_NETWORK',
            config,
            isAxiosError: true,
          }),
        );
      }
      return Promise.resolve({
        config,
        data: { data: 'retried' },
        headers: {},
        status: 200,
        statusText: 'OK',
      });
    };
    const client = new RequestClient({ adapter: customAdapter as any });
    vi.useFakeTimers();

    const promise = client.get('/test/retry', { retry: true });
    await vi.advanceTimersByTimeAsync(2000);
    const response = await promise;

    expect(callCount).toBe(2);
    expect(response.data).toEqual({ data: 'retried' });
    vi.useRealTimers();
  });

  it('should limit retries for GET timeout errors to maxRetries', async () => {
    let callCount = 0;
    const customAdapter = (config: any) => {
      callCount++;
      return Promise.reject(
        Object.assign(new Error('timeout of 8000ms exceeded'), {
          code: 'ECONNABORTED',
          config,
          isAxiosError: true,
        }),
      );
    };
    const client = new RequestClient({ adapter: customAdapter as any });
    vi.useFakeTimers();

    const promise = client.get('/test/retry-limit', { retry: true });
    // 先挂载断言，避免推进 fake timers 期间 Promise 先拒绝而产生未处理拒绝
    const rejection = expect(promise).rejects.toMatchObject({
      code: 'ECONNABORTED',
      isAxiosError: true,
    });
    await vi.advanceTimersByTimeAsync(2000);
    await rejection;
    expect(callCount).toBe(2); // 1 次初始 + 1 次重试
    vi.useRealTimers();
  });

  it('should not retry non-idempotent POST on network failure', async () => {
    mock.onPost('/test/post-fail').networkError();
    await expect(
      requestClient.post('/test/post-fail', { a: 1 }, { retry: true }),
    ).rejects.toMatchObject({ isAxiosError: true });
  });

  it('should trip the circuit breaker after 5 consecutive failures', async () => {
    // circuitGroupKey 指向同一组，5 次失败后第 6 次直接抛 CircuitOpenError（零 HTTP）
    mock.onGet('/test/circuit').reply(500, { data: 'fail' });

    for (let i = 0; i < 5; i++) {
      await expect(
        requestClient.get('/test/circuit', {
          circuitGroupKey: 'GET http://localhost',
        }),
      ).rejects.toMatchObject({ data: 'fail' });
    }

    await expect(
      requestClient.get('/test/circuit', {
        circuitGroupKey: 'GET http://localhost',
      }),
    ).rejects.toMatchObject({ code: 'CB_OPEN', name: 'CircuitOpenError' });
  });

  it('should not count cancelled requests as failures', async () => {
    mock.onGet('/test/cancel').reply(() => {
      return new Promise((resolve) => {
        setTimeout(() => resolve([200, { data: 'late' }]), 50);
      });
    });

    const controller = new AbortController();
    const promise = requestClient
      .get('/test/cancel', { signal: controller.signal })
      .catch((error) => error);
    controller.abort();
    const error = await promise;
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('ERR_CANCELED');
  });

  it('should successfully upload a file', async () => {
    const fileData = new Blob(['file contents'], { type: 'text/plain' });

    mock.onPost('/test/upload').reply((config) => {
      return config.data instanceof FormData && config.data.has('file')
        ? [200, { data: 'file uploaded' }]
        : [400, { error: 'Bad Request' }];
    });

    const response = await requestClient.upload('/test/upload', {
      file: fileData,
    });
    expect(response.data).toEqual({ data: 'file uploaded' });
  });

  it('should successfully download a file as a blob', async () => {
    const mockFileContent = new Blob(['mock file content'], {
      type: 'text/plain',
    });

    mock.onGet('/test/download').reply(200, mockFileContent);

    const res = await requestClient.download<any>('/test/download');

    expect(res.data).toBeInstanceOf(Blob);
  });
});