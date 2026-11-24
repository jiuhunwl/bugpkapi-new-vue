import { describe, expect, it, vi } from 'vitest';
import { useCallLogQuery } from './use-call-log-query';

const filters = {
  startTime: '2026-10-01 00:00:00',
  endTime: '2026-10-01 12:00:00',
};
const page = { currentPage: 1, pageSize: 20 };
const fastResult = {
  items: [],
  total: -1,
  totalOmitted: true,
  nextCursor: 'cursor-2',
};
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

function mockLoad() {
  return vi
    .fn()
    .mockImplementation(async (params) =>
      params.includeTotal ? { items: [], total: 987 } : fastResult,
    );
}

describe('call-log automatic filtered totals', () => {
  it('loads rows first then automatically counts with identical filters and user scope', async () => {
    const load = mockLoad();
    const state = useCallLogQuery(load);
    await state.query(page, { ...filters, userId: '2', unmasked: 1 }, true);
    await flush();
    expect(load).toHaveBeenNthCalledWith(
      1,
      {
        ...filters,
        userId: '2',
        unmasked: 1,
        includeTotal: false,
        page: 1,
        pageSize: 20,
      },
      true,
      expect.any(AbortSignal),
    );
    expect(load).toHaveBeenNthCalledWith(
      2,
      {
        ...filters,
        userId: '2',
        unmasked: 1,
        includeTotal: true,
        page: 1,
        pageSize: 1,
      },
      true,
      expect.any(AbortSignal),
    );
    expect(state.total.value).toBe(987);
    expect(state.hasNext.value).toBe(true);
  });
  it('keeps cursor pagination and counts all matches rather than the remaining cursor rows', async () => {
    const load = mockLoad();
    const state = useCallLogQuery(load);
    await state.query(page, filters, true);
    await flush();
    state.currentPage.value = 2;
    await state.query(page, filters, true);
    await flush();
    expect(load.mock.calls[2]?.[0]).toEqual({
      ...filters,
      includeTotal: false,
      cursor: 'cursor-2',
      pageSize: 20,
    });
    expect(load.mock.calls[3]?.[0]).toEqual({
      ...filters,
      includeTotal: true,
      page: 1,
      pageSize: 1,
    });
    await state.query(
      page,
      { ...filters, interfaceId: '7', success: 0 },
      false,
    );
    await flush();
    expect(state.currentPage.value).toBe(1);
    expect(load.mock.lastCall?.slice(0, 2)).toEqual([
      {
        ...filters,
        interfaceId: '7',
        success: 0,
        includeTotal: true,
        page: 1,
        pageSize: 1,
      },
      false,
    ]);
  });
  it('recounts on refresh even when the filters have not changed', async () => {
    let total = 8;
    const load = vi
      .fn()
      .mockImplementation(async (params) =>
        params.includeTotal ? { items: [], total } : fastResult,
      );
    const state = useCallLogQuery(load);
    await state.query(page, filters, false);
    await flush();
    expect(state.total.value).toBe(8);
    total = 12;
    state.reset();
    expect(state.total.value).toBeNull();
    await state.query(page, filters, false);
    await flush();
    expect(state.total.value).toBe(12);
  });
  it('does not block rows and ignores a late count from obsolete filters', async () => {
    let resolve!: (value: { items: never[]; total: number }) => void;
    const load = mockLoad()
      .mockResolvedValueOnce(fastResult)
      .mockImplementationOnce(
        () =>
          new Promise((r) => {
            resolve = r;
          }),
      );
    const state = useCallLogQuery(load);
    await state.query(page, filters, false);
    expect(state.loading.value).toBe(false);
    expect(state.hasLoaded.value).toBe(true);
    expect(state.countLoading.value).toBe(true);
    const signal = load.mock.lastCall?.[2];
    await state.query(page, { ...filters, interfaceId: '7' }, false);
    await flush();
    expect(signal.aborted).toBe(true);
    resolve({ items: [], total: 999 });
    await flush();
    expect(state.total.value).toBe(987);
  });
  it('keeps a failed count unknown, shows the failure, and supports retry without hiding rows', async () => {
    const load = mockLoad()
      .mockResolvedValueOnce(fastResult)
      .mockRejectedValueOnce(new Error('timeout'));
    const state = useCallLogQuery(load);
    await state.query(page, filters, false);
    await flush();
    expect(state.total.value).toBeNull();
    expect(state.countError.value).toBe(true);
    expect(state.hasLoaded.value).toBe(true);
    expect(state.countLoading.value).toBe(false);
    await state.loadTotal();
    expect(state.countError.value).toBe(false);
    expect(state.total.value).toBe(987);
  });
  it('cancels in-flight counting on unmount/reset without stale updates', async () => {
    let resolve!: (value: { items: never[]; total: number }) => void;
    const load = mockLoad()
      .mockResolvedValueOnce(fastResult)
      .mockImplementationOnce(
        () =>
          new Promise((r) => {
            resolve = r;
          }),
      );
    const state = useCallLogQuery(load);
    await state.query(page, filters, false);
    const signal = load.mock.lastCall?.[2];
    state.reset();
    resolve({ items: [], total: 99 });
    await flush();
    expect(signal.aborted).toBe(true);
    expect(state.total.value).toBeNull();
    expect(state.countLoading.value).toBe(false);
  });
  it('uses the existing exact total for numbered mode without a second request', async () => {
    const load = vi.fn().mockResolvedValue({ items: [], total: 400 });
    const state = useCallLogQuery(load);
    state.fastMode.value = false;
    await state.query({ currentPage: 4, pageSize: 50 }, {}, false);
    expect(load).toHaveBeenCalledTimes(1);
    expect(state.total.value).toBe(400);
  });
  it('does not query a total after the list request fails', async () => {
    const load = vi.fn().mockRejectedValue(new Error('offline'));
    const state = useCallLogQuery(load);
    await expect(state.query(page, filters, false)).rejects.toThrow('offline');
    expect(load).toHaveBeenCalledTimes(1);
    expect(state.hasLoaded.value).toBe(false);
    expect(state.total.value).toBeNull();
  });
});
