import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildGeoJSONUrl,
  createDatavGeoLoader,
} from './datav-geo-loader';

/**
 * 构造一个假的 GeoJSON FeatureCollection（含指定数量的 feature）。
 */
function makeGeoJSON(featureCount = 3) {
  return {
    type: 'FeatureCollection' as const,
    features: Array.from({ length: featureCount }, (_, i) => ({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [113 + i, 23],
            [113.5 + i, 23],
            [113.5 + i, 23.5],
            [113 + i, 23.5],
            [113 + i, 23],
          ],
        ],
      },
      properties: {
        adcode: `4401${String(i).padStart(2, '0')}`,
        name: `测试区${i}`,
      },
    })),
  };
}

/**
 * 创建一个 mock fetch，可自定义返回行为。
 */
function createMockFetch(
  responseFn: (url: string) =>
    | { ok: boolean; status: number; json: () => Promise<unknown> }
    | Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>,
) {
  return vi.fn(async (url: string) => {
    const result = await responseFn(url);
    return {
      ok: result.ok,
      status: result.status,
      json: result.json,
    } as Response;
  });
}

describe('buildGeoJSONUrl', () => {
  it('outputs the DataV CDN URL with _full suffix', () => {
    expect(buildGeoJSONUrl('440000')).toBe(
      'https://geo.datav.aliyun.com/areas_v3/bound/440000_full.json',
    );
    expect(buildGeoJSONUrl('440100')).toBe(
      'https://geo.datav.aliyun.com/areas_v3/bound/440100_full.json',
    );
  });
});

describe('createDatavGeoLoader', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('loads GeoJSON successfully via fetch', async () => {
    const mockFetch = createMockFetch(() => ({
      ok: true,
      status: 200,
      json: async () => makeGeoJSON(5),
    }));
    const loader = createDatavGeoLoader({
      fetchImpl: mockFetch as unknown as typeof fetch,
      retryDelay: 0,
    });

    const result = await loader.loadGeoJSON('440000');
    expect(result.features).toHaveLength(5);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('serves from cache on second call without fetching', async () => {
    const mockFetch = createMockFetch(() => ({
      ok: true,
      status: 200,
      json: async () => makeGeoJSON(3),
    }));
    const loader = createDatavGeoLoader({
      fetchImpl: mockFetch as unknown as typeof fetch,
      retryDelay: 0,
    });

    await loader.loadGeoJSON('440000');
    await loader.loadGeoJSON('440000');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(loader.has('440000')).toBe(true);
  });

  it('rejects with network error after exhausting retries', async () => {
    const mockFetch = createMockFetch(() => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    }));
    const loader = createDatavGeoLoader({
      fetchImpl: mockFetch as unknown as typeof fetch,
      maxRetries: 2,
      retryDelay: 0,
      timeout: 1000,
    });

    await expect(loader.loadGeoJSON('440000')).rejects.toMatchObject({
      adcode: '440000',
      reason: 'network',
      retryable: true,
    });
    // 初始 1 次 + 2 次重试 = 3 次
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('rejects with empty reason when features array is empty', async () => {
    const mockFetch = createMockFetch(() => ({
      ok: true,
      status: 200,
      json: async () => ({ type: 'FeatureCollection', features: [] }),
    }));
    const loader = createDatavGeoLoader({
      fetchImpl: mockFetch as unknown as typeof fetch,
      retryDelay: 0,
    });

    await expect(loader.loadGeoJSON('440000')).rejects.toMatchObject({
      adcode: '440000',
      reason: 'empty',
      retryable: false,
    });
    // 不可重试，只调一次
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent inflight requests for the same adcode', async () => {
    const mockFetch = createMockFetch(() => ({
      ok: true,
      status: 200,
      json: async () => makeGeoJSON(2),
    }));
    const loader = createDatavGeoLoader({
      fetchImpl: mockFetch as unknown as typeof fetch,
      retryDelay: 0,
    });

    const [a, b] = await Promise.all([
      loader.loadGeoJSON('330000'),
      loader.loadGeoJSON('330000'),
    ]);
    expect(a).toBe(b);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('clear() removes all cached entries', async () => {
    const mockFetch = createMockFetch(() => ({
      ok: true,
      status: 200,
      json: async () => makeGeoJSON(1),
    }));
    const loader = createDatavGeoLoader({
      fetchImpl: mockFetch as unknown as typeof fetch,
      retryDelay: 0,
    });

    await loader.loadGeoJSON('440000');
    expect(loader.has('440000')).toBe(true);
    loader.clear();
    expect(loader.has('440000')).toBe(false);

    await loader.loadGeoJSON('440000');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
