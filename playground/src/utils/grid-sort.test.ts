import { describe, expect, it } from 'vitest';

import { readGridSort } from './grid-sort';

const fields = {
  createdAt: 'created_at',
  status: 'status',
} as const;

describe('readGridSort', () => {
  it('maps a known column and normalizes the direction', () => {
    expect(readGridSort({ field: 'createdAt', order: 'asc' }, fields)).toEqual({
      sortBy: 'created_at',
      sortOrder: 'asc',
    });
    expect(readGridSort({ field: 'createdAt', order: 'desc' }, fields)).toEqual({
      sortBy: 'created_at',
      sortOrder: 'desc',
    });
    expect(readGridSort({ field: 'status', order: 'sideways' }, fields)).toEqual(
      { sortBy: 'status', sortOrder: 'desc' },
    );
  });

  it('accepts vxe multiple-sort arrays and drops unknown columns', () => {
    expect(
      readGridSort([{ field: 'status', order: 'asc' }], fields),
    ).toEqual({ sortBy: 'status', sortOrder: 'asc' });
    expect(readGridSort({ field: 'payload', order: 'asc' }, fields)).toEqual(
      {},
    );
    expect(readGridSort(null, fields)).toEqual({});
    expect(readGridSort('createdAt', fields)).toEqual({});
  });
});
