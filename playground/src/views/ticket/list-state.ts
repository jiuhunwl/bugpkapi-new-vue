import type { TicketApi } from '#/api/ticket';

export type TicketListState = TicketApi.ListParams & {
  page: number;
  pageSize: number;
};
const scalar = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number'
    ? String(value).trim()
    : '';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const SORT_FIELDS: TicketApi.ListSortBy[] = [
  'created_at',
  'last_message_at',
  'priority',
  'sla_due',
  'status',
  'updated_at',
];

function readDate(value: unknown) {
  const text = scalar(value);
  return DATE_ONLY.test(text) ? text : '';
}

/** Only list-owned parameters are propagated to details and back. */
export function readTicketListState(
  values: Record<string, unknown>,
): TicketListState {
  const page = Number(scalar(values.page));
  const size = Number(scalar(values.pageSize));
  const state: TicketListState = {
    page: Number.isSafeInteger(page) && page > 0 && page <= 1000 ? page : 1,
    pageSize: [10, 20, 50].includes(size) ? size : 20,
  };
  const keyword = scalar(values.keyword);
  if (keyword) state.keyword = keyword;
  if (
    ['CLOSED', 'OPEN', 'PROCESSING', 'RESOLVED', 'WAITING_USER'].includes(
      scalar(values.status),
    )
  )
    state.status = scalar(values.status) as TicketApi.Status;
  if (['HIGH', 'LOW', 'NORMAL', 'URGENT'].includes(scalar(values.priority)))
    state.priority = scalar(values.priority) as TicketApi.Priority;
  if (
    ['ACCOUNT', 'API', 'BILLING', 'BUG', 'GENERAL', 'OTHER'].includes(
      scalar(values.category),
    )
  )
    state.category = scalar(values.category) as TicketApi.Category;
  if (scalar(values.unread) === '1') state.unread = 1;
  if (scalar(values.overdue) === '1') state.overdue = 1;
  const assignedTo = Number(scalar(values.assignedTo));
  if (Number.isSafeInteger(assignedTo) && assignedTo > 0) {
    state.assignedTo = assignedTo;
  }
  for (const key of [
    'createdFrom',
    'createdTo',
    'updatedFrom',
    'updatedTo',
  ] as const) {
    const value = readDate(values[key]);
    if (value) {
      state[key] = value;
    }
  }
  const sortBy = scalar(values.sortBy) as TicketApi.ListSortBy;
  if (SORT_FIELDS.includes(sortBy)) {
    state.sortBy = sortBy;
    state.sortOrder = scalar(values.sortOrder) === 'asc' ? 'asc' : 'desc';
  }
  return state;
}

export function ticketListQuery(
  state: TicketListState,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(readTicketListState({ ...state })).map(([key, value]) => [
      key,
      String(value),
    ]),
  );
}
