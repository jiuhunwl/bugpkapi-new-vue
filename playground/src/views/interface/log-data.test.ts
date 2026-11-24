import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  searchInterfaceOptions,
  searchMarketInterfaceOptions,
} from '#/api/interface';
import { searchKeyOptions } from '#/api/key';
import { searchUserOptions } from '#/api/system/user';

vi.mock('#/api/interface', () => ({
  searchInterfaceOptions: vi.fn(),
  searchMarketInterfaceOptions: vi.fn(),
}));

vi.mock('#/api/key', () => ({
  searchKeyOptions: vi.fn(),
}));

vi.mock('#/api/system/user', () => ({
  searchUserOptions: vi.fn(),
}));

import {
  callLogPointAmount,
  chargeTypeOptions,
  formatCallLogChargeAmount,
  isBillingRecordsRoute,
  normalizeCallLogFilters,
  useCallLogColumns,
  useCallLogGridFormSchema,
} from './log-data';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('call log billing contract', () => {
  it('identifies the admin billing-records view reused by the call-log page', () => {
    expect(
      isBillingRecordsRoute({
        name: 'BillingRecordList',
        path: '/package/billing-records',
      }),
    ).toBe(true);
    expect(
      isBillingRecordsRoute({ path: '/console/package/billing-records' }),
    ).toBe(true);
    expect(
      isBillingRecordsRoute({
        name: 'InterfaceCallLog',
        path: '/console/call-logs',
      }),
    ).toBe(false);
    expect(isBillingRecordsRoute({})).toBe(false);
  });

  it('contains every current backend charge type', () => {
    const values = new Set(chargeTypeOptions().map((item) => item.value));
    for (const value of [
      'ADMIN',
      'BALANCE',
      'FREE',
      'GLOBAL_PACKAGE',
      'INTERFACE_PACKAGE',
      'NO_CHARGE',
      'OPEN_PENDING',
      'POINTS',
    ]) {
      expect(values.has(value)).toBe(true);
    }
  });

  it('uses pointPrice for points billing instead of the money amount', () => {
    expect(callLogPointAmount({ pointPrice: 25 })).toBe(25);
  });

  it('uses chargeAmount for balance billing', () => {
    expect(
      formatCallLogChargeAmount({
        chargeAmount: '1.25',
        chargeType: 'BALANCE',
        pointPrice: 0,
      }),
    ).toBe('¥1.25');
  });

  it('maps the time range to backend start and end parameters', () => {
    expect(
      normalizeCallLogFilters({
        keyword: 'weather',
        timeRange: ['2026-01-01 00:00:00', '2026-01-02 00:00:00'],
      }),
    ).toEqual({
      endTime: '2026-01-02 00:00:00',
      keyword: 'weather',
      startTime: '2026-01-01 00:00:00',
    });
  });

  it('only exposes the user ID filter to administrators', () => {
    const adminFields = useCallLogGridFormSchema(true).map(
      (item) => item.fieldName,
    );
    const userFields = useCallLogGridFormSchema(false).map(
      (item) => item.fieldName,
    );
    expect(adminFields).toContain('userId');
    expect(userFields).not.toContain('userId');
    for (const field of [
      'apiKeyId',
      'billable',
      'billingStatus',
      'interfaceId',
      'maxElapsedMs',
      'minElapsedMs',
      'region',
      'timeRange',
    ]) {
      expect(userFields).toContain(field);
    }
  });

  it('provides a stable detail action column', () => {
    const action = (useCallLogColumns(true) ?? []).find(
      (column) => column?.field === 'action',
    );
    expect(action?.slots).toEqual({ default: 'action' });
    expect(action?.fixed).toBe('right');
  });
});

describe('call log filter schema', () => {
  const adminSchema = useCallLogGridFormSchema(true);
  const userSchema = useCallLogGridFormSchema(false);

  it('uses RemoteSearchSelect with fetchOptions for dropdown filters', () => {
    for (const field of ['interfaceId', 'apiKeyId', 'userId']) {
      const entry = adminSchema.find((item) => item.fieldName === field);
      expect(entry?.component).toBe('RemoteSearchSelect');
      expect(typeof (entry?.componentProps as any)?.fetchOptions).toBe(
        'function',
      );
    }
  });

  it('keeps internal exact filters admin-only', () => {
    for (const field of ['clientIp', 'apiCode']) {
      expect(
        adminSchema.find((item) => item.fieldName === field)?.component,
      ).toBe('Input');
      expect(
        userSchema.find((item) => item.fieldName === field),
      ).toBeUndefined();
    }
  });

  it('user schema has no userId filter', () => {
    expect(
      userSchema.find((item) => item.fieldName === 'userId'),
    ).toBeUndefined();
  });
});

describe('call log remote option fetchers', () => {
  function fetcherOf(
    schema: Array<{ componentProps?: any; fieldName: string }>,
    fieldName: string,
  ) {
    return schema.find((item) => item.fieldName === fieldName)?.componentProps
      ?.fetchOptions as (
      keyword: string,
      signal: AbortSignal,
    ) => Promise<Array<{ label: string; value: string }>>;
  }

  it('maps interface search results to select options per role', async () => {
    const controller = new AbortController();
    vi.mocked(searchInterfaceOptions).mockResolvedValue([
      { id: '8', label: '#8 · Admin API' },
    ]);
    vi.mocked(searchMarketInterfaceOptions).mockResolvedValue([
      { id: '12', label: '#12 · Weather' },
    ]);

    await expect(
      fetcherOf(useCallLogGridFormSchema(true), 'interfaceId')(
        'admin',
        controller.signal,
      ),
    ).resolves.toEqual([{ label: '#8 · Admin API', value: '8' }]);
    expect(searchInterfaceOptions).toHaveBeenCalledWith(
      'admin',
      controller.signal,
    );

    await expect(
      fetcherOf(useCallLogGridFormSchema(false), 'interfaceId')(
        'weather',
        controller.signal,
      ),
    ).resolves.toEqual([{ label: '#12 · Weather', value: '12' }]);
    expect(searchMarketInterfaceOptions).toHaveBeenCalledWith(
      'weather',
      controller.signal,
    );
  });

  it('scopes key search by role and maps ids to values', async () => {
    const controller = new AbortController();
    vi.mocked(searchKeyOptions).mockResolvedValue([
      { id: '31', label: '#31 · Mobile key (sk-9f)' },
    ]);

    await expect(
      fetcherOf(useCallLogGridFormSchema(true), 'apiKeyId')(
        'mobile',
        controller.signal,
      ),
    ).resolves.toEqual([{ label: '#31 · Mobile key (sk-9f)', value: '31' }]);
    expect(searchKeyOptions).toHaveBeenCalledWith(
      'all',
      'mobile',
      controller.signal,
    );

    await expect(
      fetcherOf(useCallLogGridFormSchema(false), 'apiKeyId')(
        'mine',
        controller.signal,
      ),
    ).resolves.toEqual([{ label: '#31 · Mobile key (sk-9f)', value: '31' }]);
    expect(searchKeyOptions).toHaveBeenLastCalledWith(
      'mine',
      'mine',
      controller.signal,
    );
  });

  it('maps user search results to select options', async () => {
    const controller = new AbortController();
    vi.mocked(searchUserOptions).mockResolvedValue([
      { id: '5', label: '#5 · alice (Alice)' },
    ]);

    await expect(
      fetcherOf(useCallLogGridFormSchema(true), 'userId')(
        'alice',
        controller.signal,
      ),
    ).resolves.toEqual([{ label: '#5 · alice (Alice)', value: '5' }]);
    expect(searchUserOptions).toHaveBeenCalledWith('alice', controller.signal);
  });
});

it('starts fast browsing with an explicit visible 24-hour time range', () => {
  const field = useCallLogGridFormSchema(true).find(
    (item) => item.fieldName === 'timeRange',
  );
  const range = field?.defaultValue as [string, string];
  expect(range).toHaveLength(2);
  const start = Date.parse(range[0].replace(' ', 'T'));
  const end = Date.parse(range[1].replace(' ', 'T'));
  expect(end - start).toBe(24 * 60 * 60 * 1000);
});

it('normalizes sparse and empty form fields to the same cursor scope', () => {
  const timeRange: [string, string] = [
    '2026-10-01 00:00:00',
    '2026-10-01 12:00:00',
  ];
  expect(
    normalizeCallLogFilters({
      timeRange,
      keyword: '',
      region: undefined,
      userId: null!,
    }),
  ).toEqual(normalizeCallLogFilters({ timeRange }));
  expect(
    normalizeCallLogFilters({ timeRange, success: 0, billable: 0 }),
  ).toMatchObject({ success: 0, billable: 0 });
});

describe('feedback request IDs', () => {
  it.each([true, false])(
    'shows a copyable request ID and exact filter for admin=%s',
    (admin) => {
      expect(
        (useCallLogColumns(admin) ?? []).find((c) => c.field === 'traceId')
          ?.slots,
      ).toEqual({ default: 'traceId' });
      expect(
        useCallLogGridFormSchema(admin).find((f) => f.fieldName === 'traceId')
          ?.component,
      ).toBe('Input');
    },
  );
});
