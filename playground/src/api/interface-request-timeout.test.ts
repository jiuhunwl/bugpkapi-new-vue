import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getAllInterfaces,
  getInterfaceList,
  invokeInterface,
} from './interface';

const client = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock('#/api/request', () => ({ requestClient: client }));

beforeEach(() => {
  client.get.mockReset();
  client.post.mockReset();
  client.post.mockResolvedValue({ success: true });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('management invocation timeout contract', () => {
  it('allows the maximum server request budget instead of using the 8-second CRUD timeout', async () => {
    const payload = {
      method: 'GET' as const,
      queryParams: { url: 'https://example.com/video' },
    };
    await invokeInterface('801', payload);
    expect(client.post).toHaveBeenCalledWith(
      '/interface/801/invoke',
      payload,
      { timeout: 130_000 },
    );
  });
});

describe('interface list timeout contract', () => {
  it('uses an extended timeout for the heavy list/aggregation endpoint', async () => {
    client.get.mockResolvedValueOnce({ items: [], total: 0 });
    await getInterfaceList({ page: 1, pageSize: 10 });
    expect(client.get).toHaveBeenCalledWith(
      '/interface/list',
      expect.objectContaining({ timeout: 30_000 }),
    );
  });
});

describe('getAllInterfaces guardrails', () => {
  it('terminates when the backend ignores page and repeatedly returns the same page', async () => {
    // 模拟后端忽略 page 参数：每次返回相同的 100 条（全是同一批 id）
    const fixedPage = Array.from({ length: 100 }, (_, i) => ({
      id: String(i + 1),
      name: `api-${i + 1}`,
    }));
    client.get.mockResolvedValue({ items: fixedPage, total: 1_000_000 });

    const items = await getAllInterfaces();

    // 全部去重后只有 100 条；调用次数必须远小于 10000（total/pageSize）
    expect(items).toHaveLength(100);
    // 调用次数应在 2 次（第一次拿数据、第二次发现全部重复即退出）
    expect(client.get.mock.calls.length).toBeLessThan(5);
  });

  it('terminates after reaching the hard page cap even when total is huge', async () => {
    // 每页返回 100 条不同的 id，total 给一个极大值
    client.get.mockImplementation((_url: string, cfg: any) => {
      const base = (cfg.params.page - 1) * 100;
      return Promise.resolve({
        items: Array.from({ length: 100 }, (_, i) => ({
          id: String(base + i + 1),
          name: `api-${base + i + 1}`,
        })),
        total: Number.MAX_SAFE_INTEGER,
      });
    });

    await getAllInterfaces();
    // 不应无限调用：受 MAX_INTERFACE_PAGES=200 约束
    expect(client.get.mock.calls.length).toBeLessThanOrEqual(200);
  });

  it('terminates on an empty page', async () => {
    client.get.mockResolvedValueOnce({ items: [], total: 0 });
    const items = await getAllInterfaces();
    expect(items).toHaveLength(0);
    expect(client.get).toHaveBeenCalledTimes(1);
  });
});
