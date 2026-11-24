import { describe, expect, it } from 'vitest';

import { createCallLogCursorPager } from './log-pagination';

describe('call-log cursor pagination', () => {
  it('stores the first page cursor and sends it with the next page request', () => {
    const pager = createCallLogCursorPager();
    const filters = { keyword: 'trace' };
    const firstPage = { currentPage: 1, pageSize: 20 };

    const firstRequest = pager.start(firstPage, filters);
    expect(firstRequest.params).toEqual({
      keyword: 'trace',
      page: 1,
      pageSize: 20,
    });

    pager.accept(firstRequest, {
      items: [],
      nextCursor: 'cursor-page-2',
      total: 123456,
    });

    expect(
      pager.start({ currentPage: 2, pageSize: 20 }, filters).params,
    ).toEqual({
      cursor: 'cursor-page-2',
      keyword: 'trace',
      pageSize: 20,
    });
  });

  it('clears the cursor chain when filters change', () => {
    const pager = createCallLogCursorPager();
    const firstPage = { currentPage: 1, pageSize: 20 };

    const firstRequest = pager.start(firstPage, { keyword: 'old' });
    pager.accept(firstRequest, {
      items: [],
      nextCursor: 'stale-cursor',
      total: 10,
    });

    expect(
      pager.start({ currentPage: 2, pageSize: 20 }, { keyword: 'new' }).params,
    ).toEqual({
      keyword: 'new',
      page: 2,
      pageSize: 20,
    });
  });

  it('clears the cursor chain when a refresh starts', () => {
    const pager = createCallLogCursorPager();
    const firstPage = { currentPage: 1, pageSize: 20 };
    const filters = { keyword: 'trace' };

    const firstRequest = pager.start(firstPage, filters);
    pager.accept(firstRequest, {
      items: [],
      nextCursor: 'stale-cursor',
      total: 10,
    });
    pager.reset();

    expect(
      pager.start({ currentPage: 2, pageSize: 20 }, filters).params,
    ).toEqual({
      keyword: 'trace',
      page: 2,
      pageSize: 20,
    });
  });

  it('clears the cursor chain when the page size changes', () => {
    const pager = createCallLogCursorPager();
    const filters = { keyword: 'trace' };
    const firstPage = { currentPage: 1, pageSize: 20 };

    const firstRequest = pager.start(firstPage, filters);
    pager.accept(firstRequest, {
      items: [],
      nextCursor: 'wrong-size-cursor',
      total: 10,
    });

    expect(
      pager.start({ currentPage: 2, pageSize: 50 }, filters).params,
    ).toEqual({
      keyword: 'trace',
      page: 2,
      pageSize: 50,
    });
  });

  it('ignores a response from a superseded query', () => {
    const pager = createCallLogCursorPager();
    const filters = { keyword: 'trace' };
    const firstPage = { currentPage: 1, pageSize: 20 };

    const first = pager.start(firstPage, filters);
    const replacement = pager.start(firstPage, filters);
    pager.accept(first, {
      items: [],
      nextCursor: 'stale-cursor',
      total: 10,
    });
    pager.accept(replacement, {
      items: [],
      nextCursor: 'current-cursor',
      total: 10,
    });

    expect(
      pager.start({ currentPage: 2, pageSize: 20 }, filters).params,
    ).toEqual({
      cursor: 'current-cursor',
      keyword: 'trace',
      pageSize: 20,
    });
  });
});

it('never silently falls back to OFFSET for a missing fast-mode cursor', () => {
  const pager = createCallLogCursorPager();
  expect(() =>
    pager.start({ currentPage: 4, pageSize: 20 }, { includeTotal: false }),
  ).toThrow();
});
