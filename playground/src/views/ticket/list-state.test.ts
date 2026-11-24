import { describe, expect, it } from 'vitest';

import { readTicketListState, ticketListQuery } from './list-state';

describe('ticket list URL state', () => {
  it('round trips filters and pagination without carrying arbitrary return URLs', () => {
    const state = readTicketListState({
      keyword: ' billing ',
      status: 'OPEN',
      priority: 'HIGH',
      category: 'API',
      unread: '1',
      page: '3',
      pageSize: '50',
      returnTo: 'https://evil.example',
      token: 'ignore',
    });
    expect(state).toEqual({
      keyword: 'billing',
      status: 'OPEN',
      priority: 'HIGH',
      category: 'API',
      unread: 1,
      page: 3,
      pageSize: 50,
    });
    expect(readTicketListState(ticketListQuery(state))).toEqual(state);
    expect(ticketListQuery(state)).not.toHaveProperty('returnTo');
    expect(ticketListQuery(state)).not.toHaveProperty('token');
  });
  it('normalizes invalid or empty values without inventing filters', () => {
    expect(
      readTicketListState({
        status: 'UNKNOWN',
        category: ['API'],
        priority: '',
        unread: 0,
        page: -1,
        pageSize: 999,
      }),
    ).toEqual({ page: 1, pageSize: 20 });
    expect(readTicketListState({ keyword: '', status: null })).toEqual(
      readTicketListState({}),
    );
  });

  it('round trips advanced filters and server-side sorting', () => {
    const state = readTicketListState({
      assignedTo: '42',
      overdue: '1',
      createdFrom: '2026-01-01',
      createdTo: '2026-01-31',
      updatedFrom: 'not-a-date',
      updatedTo: '2026-02-01',
      sortBy: 'priority',
      sortOrder: 'asc',
      page: '2',
      pageSize: '20',
    });
    expect(state).toEqual({
      assignedTo: 42,
      createdFrom: '2026-01-01',
      createdTo: '2026-01-31',
      overdue: 1,
      page: 2,
      pageSize: 20,
      sortBy: 'priority',
      sortOrder: 'asc',
      updatedTo: '2026-02-01',
    });
    expect(readTicketListState(ticketListQuery(state))).toEqual(state);
  });

  it('rejects unknown sort fields and falls back to descending order', () => {
    expect(readTicketListState({ sortBy: 'payload' })).toEqual({
      page: 1,
      pageSize: 20,
    });
    expect(
      readTicketListState({ sortBy: 'created_at', sortOrder: 'sideways' }),
    ).toEqual({
      page: 1,
      pageSize: 20,
      sortBy: 'created_at',
      sortOrder: 'desc',
    });
  });
});
