import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { TicketApi } from '#/api/ticket';

import { $t } from '#/locales';

const statusValues: TicketApi.Status[] = [
  'OPEN',
  'PROCESSING',
  'WAITING_USER',
  'RESOLVED',
  'CLOSED',
];

const priorityValues: TicketApi.Priority[] = [
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT',
];

const categoryValues: TicketApi.Category[] = [
  'GENERAL',
  'API',
  'BILLING',
  'ACCOUNT',
  'BUG',
  'OTHER',
];

export function useGridFormSchema(isAdmin: boolean): VbenFormSchema[] {
  const schema: VbenFormSchema[] = [
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('ticket.filters.keyword'),
      },
      fieldName: 'keyword',
      label: $t('ticket.grid.keyword'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: statusValues.map((value) => ({
          label: $t(`ticket.status.${value}`),
          value,
        })),
        placeholder: $t('ticket.filters.status'),
      },
      fieldName: 'status',
      label: $t('ticket.grid.status'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: priorityValues.map((value) => ({
          label: $t(`ticket.priority.${value}`),
          value,
        })),
        placeholder: $t('ticket.filters.priority'),
      },
      fieldName: 'priority',
      label: $t('ticket.grid.priority'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: categoryValues.map((value) => ({
          label: $t(`ticket.category.${value}`),
          value,
        })),
        placeholder: $t('ticket.filters.category'),
      },
      fieldName: 'category',
      label: $t('ticket.grid.category'),
    },
  ];

  {
    schema.push({
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [{ label: $t('ticket.summary.unread'), value: 1 }],
        placeholder: $t('ticket.filters.unreadOnly'),
      },
      fieldName: 'unread',
      label: $t('ticket.filters.unreadOnly'),
    });
  }

  schema.push({
    component: 'Select',
    componentProps: {
      allowClear: true,
      options: [{ label: $t('ticket.filters.overdueOnly'), value: 1 }],
      placeholder: $t('ticket.filters.overdueOnly'),
    },
    fieldName: 'overdue',
    label: $t('ticket.grid.overdue'),
  });

  if (isAdmin) {
    schema.push({
      component: 'Select',
      componentProps: {
        allowClear: true,
        optionFilterProp: 'label',
        options: [],
        placeholder: $t('ticket.filters.assigneePlaceholder'),
        showSearch: true,
      },
      fieldName: 'assignedTo',
      label: $t('ticket.grid.assignee'),
    });
  }

  for (const [fieldName, label] of [
    ['createdFrom', $t('ticket.grid.createdAt')],
    ['createdTo', $t('ticket.grid.createdAt')],
    ['updatedFrom', $t('ticket.grid.updatedAt')],
    ['updatedTo', $t('ticket.grid.updatedAt')],
  ] as const) {
    schema.push({
      component: 'DatePicker',
      componentProps: {
        allowClear: true,
        class: 'w-full',
        placeholder: fieldName.endsWith('From')
          ? $t('ticket.filters.dateFrom')
          : $t('ticket.filters.dateTo'),
        valueFormat: 'YYYY-MM-DD',
      },
      fieldName,
      label,
    });
  }

  return schema;
}

/**
 * 工单列表的表格列。
 *
 * 单击行跳转由外层 list.vue 通过 gridEvents.cellClick 处理，
 * 因此这里不挂"操作列"——列表页本身只做"选一条进入对话"这一件事。
 * 宽度按「1280 屏 + 侧边栏」收敛：状态/优先级/分类都是枚举，
 * 给到能放下最长中文标签即可，把剩余空间让给主题列。
 */
export function ticketOwnerLabel(row: TicketApi.Ticket) {
  return row.displayName || row.username || `#${row.userId}`;
}

export function useColumns<T = TicketApi.Ticket>(
  isAdmin: boolean,
): VxeTableGridColumns<T> {
  const base: VxeTableGridColumns<T> = [
    {
      field: 'subject',
      slots: { default: 'subject' },
      minWidth: 300,
      align: 'left',
      showOverflow: false,
      title: $t('ticket.grid.subject'),
    },
    {
      cellRender: {
        name: 'CellTag',
        options: statusValues.map((value) => ({
          color: statusColor(value),
          label: $t(`ticket.status.${value}`),
          value,
        })),
      },
      field: 'status',
      sortable: true,
      title: $t('ticket.grid.status'),
      width: 112,
    },
    {
      cellRender: {
        name: 'CellTag',
        options: priorityValues.map((value) => ({
          color: priorityColor(value),
          label: $t(`ticket.priority.${value}`),
          value,
        })),
      },
      field: 'priority',
      sortable: true,
      title: $t('ticket.grid.priority'),
      width: 96,
    },
    {
      cellRender: {
        name: 'CellTag',
        options: categoryValues.map((value) => ({
          label: $t(`ticket.category.${value}`),
          value,
        })),
      },
      field: 'category',
      title: $t('ticket.grid.category'),
      width: 108,
    },
    {
      field: 'lastMessageAt',
      slots: { default: 'latest' },
      align: 'left',
      sortable: true,
      title: $t('ticket.layout.latest'),
      width: 156,
    },
    {
      field: 'createdAt',
      formatter: ({ cellValue }) => formatTicketTime(String(cellValue ?? '')),
      sortable: true,
      title: $t('ticket.grid.createdAt'),
      width: 156,
    },
  ];

  if (isAdmin) {
    // 提交人列用插槽渲染成可点击项：管理员排查工单时需要立刻看到
    // 这个用户的余额/套餐/状态，单击用户名直接展开用户信息抽屉。
    base.splice(4, 0, {
      field: 'username',
      minWidth: 132,
      showOverflow: true,
      slots: { default: 'owner' },
      title: $t('ticket.grid.owner'),
    });
  }

  return base;
}

export function statusColor(status: TicketApi.Status): string {
  switch (status) {
    case 'CLOSED': {
      return 'default';
    }
    case 'OPEN': {
      return 'warning';
    }
    case 'PROCESSING': {
      return 'processing';
    }
    case 'RESOLVED': {
      return 'success';
    }
    case 'WAITING_USER': {
      return 'default';
    }
    default: {
      return 'default';
    }
  }
}

export function priorityColor(priority: TicketApi.Priority): string {
  switch (priority) {
    case 'HIGH': {
      return 'warning';
    }
    case 'LOW': {
      return 'default';
    }
    case 'NORMAL': {
      return 'default';
    }
    case 'URGENT': {
      return 'error';
    }
    default: {
      return 'default';
    }
  }
}

export function formatTicketTime(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
