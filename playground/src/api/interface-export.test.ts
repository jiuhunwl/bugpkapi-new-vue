import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  download: vi.fn(),
  get: vi.fn(),
}));

vi.mock('./request', () => ({
  requestClient: {
    download: mocks.download,
    get: mocks.get,
  },
}));

import { exportInterfaceCallLogs, getInterfaceCallLogList } from './interface';

describe('call-log export API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the request client file downloader for a CSV blob response', async () => {
    const blob = new Blob(['id,time\n1,2026-08-15'], { type: 'text/csv' });
    mocks.download.mockResolvedValue(blob);

    const params = {
      endTime: '2026-08-15 23:59:59',
      interfaceId: '12',
      startTime: '2026-08-15 00:00:00',
    };

    await expect(exportInterfaceCallLogs(params)).resolves.toBe(blob);
    expect(mocks.download).toHaveBeenCalledWith('/interface/call-log/export', {
      params,
      timeout: 600_000,
    });
  });

  it('uses a short non-retrying budget for fast cursor pages', async () => {
    const params = {
      includeTotal: false,
      startTime: '2026-10-01 00:00:00',
      endTime: '2026-10-01 01:00:00',
    };
    await getInterfaceCallLogList(params, true);
    expect(mocks.get).toHaveBeenCalledWith('/user/call-logs', {
      params,
      retry: false,
      signal: undefined,
      timeout: 8000,
    });
  });

  it('forwards an abort signal to a call-log list request', async () => {
    const controller = new AbortController();
    const result = { items: [], total: 0 };
    mocks.get.mockResolvedValue(result);

    await expect(
      getInterfaceCallLogList({ keyword: 'trace' }, false, controller.signal),
    ).resolves.toBe(result);
    expect(mocks.get).toHaveBeenCalledWith('/interface/call-log/list', {
      params: { keyword: 'trace' },
      retry: false,
      signal: controller.signal,
      timeout: 17_000,
    });
  });
});
