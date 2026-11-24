import type { InterfaceApi } from '#/api/interface';

export interface CallLogPageRequest {
  currentPage: number;
  pageSize: number;
}

export interface CallLogPageResponse {
  items: InterfaceApi.CallLogViewItem[];
  nextCursor?: string;
  total: number;
}

export interface CallLogCursorRequest {
  page: CallLogPageRequest;
  params: InterfaceApi.CallLogListParams;
  sequence: number;
}

export interface CallLogCursorPager {
  accept: (
    request: CallLogCursorRequest,
    response: CallLogPageResponse,
  ) => void;
  reset: () => void;
  start: (
    page: CallLogPageRequest,
    filters: InterfaceApi.CallLogListParams,
  ) => CallLogCursorRequest;
}

const pagingKeys = new Set(['cursor', 'page', 'pageSize']);

function withoutPaging(
  filters: InterfaceApi.CallLogListParams,
): InterfaceApi.CallLogListParams {
  return Object.fromEntries(
    Object.entries(filters).filter(
      ([key, value]) => !pagingKeys.has(key) && value !== undefined,
    ),
  );
}

function stableValue(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableValue(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableValue(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? String(value);
}

function filterKey(filters: InterfaceApi.CallLogListParams): string {
  return stableValue(withoutPaging(filters));
}

/**
 * Bridges VXE's numbered pager to the API's forward-only keyset cursor.
 * Unknown page jumps retain a page fallback until a cursor for that page has
 * been observed; this keeps the existing pager usable with older backends.
 */
export function createCallLogCursorPager(): CallLogCursorPager {
  const cursors = new Map<number, string>();
  let activeFilterKey: string | undefined;
  let activePageSize: number | undefined;
  let latestSequence = 0;

  function reset() {
    cursors.clear();
    activeFilterKey = undefined;
    activePageSize = undefined;
    latestSequence += 1;
  }

  function syncScope(
    filters: InterfaceApi.CallLogListParams,
    pageSize: number,
  ) {
    const nextKey = filterKey(filters);
    if (
      activeFilterKey !== nextKey ||
      (activePageSize !== undefined && activePageSize !== pageSize)
    ) {
      cursors.clear();
      activeFilterKey = nextKey;
      activePageSize = pageSize;
    }
    if (activeFilterKey === undefined) activeFilterKey = nextKey;
    if (activePageSize === undefined) activePageSize = pageSize;
  }

  function start(
    page: CallLogPageRequest,
    filters: InterfaceApi.CallLogListParams,
  ): CallLogCursorRequest {
    const currentPage = Math.max(1, Number(page.currentPage) || 1);
    const pageSize = Math.max(1, Number(page.pageSize) || 20);
    syncScope(filters, pageSize);
    const base = withoutPaging(filters);
    let params: InterfaceApi.CallLogListParams;

    // Returning to page one starts a new cursor chain (also covers VXE's
    // reload behavior, which resets currentPage before calling query).
    if (currentPage === 1) {
      cursors.clear();
      params = { ...base, page: 1, pageSize };
    } else {
      const cursor = cursors.get(currentPage);
      if (cursor) {
        // Do not send page and cursor together. The backend treats cursor as a
        // keyset seek, while page is an OFFSET hint for legacy requests.
        params = { ...base, cursor, pageSize };
      } else {
        if (base.includeTotal === false)
          throw new Error('Fast pagination requires a known cursor');
        params = { ...base, page: currentPage, pageSize };
      }
    }

    latestSequence += 1;
    return {
      page: { currentPage, pageSize },
      params,
      sequence: latestSequence,
    };
  }

  function accept(
    request: CallLogCursorRequest,
    response: CallLogPageResponse,
  ) {
    if (request.sequence !== latestSequence) return;
    if (request.page.pageSize !== activePageSize) return;
    const currentPage = request.page.currentPage;
    const nextPage = currentPage + 1;
    const nextCursor = response.nextCursor?.trim();
    if (nextCursor) {
      cursors.set(nextPage, nextCursor);
    } else {
      cursors.delete(nextPage);
    }
  }

  return { accept, reset, start };
}
