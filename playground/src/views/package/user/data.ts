import type { PackageActionPermissions } from '../permissions';

import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridColumns } from '#/adapter/vxe-table';
import type { PackageApi } from '#/api/package';

import { $t } from '#/locales';

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('system.package.userKeywordPlaceholder'),
      },
      fieldName: 'keyword',
      label: $t('system.package.keyword'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: $t('system.package.scopeGlobal'), value: 'GLOBAL' },
          { label: $t('system.package.scopeInterface'), value: 'INTERFACE' },
        ],
        placeholder: $t('system.package.scope'),
      },
      fieldName: 'scope',
      label: $t('system.package.scope'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: $t('common.enabled'), value: 1 },
          { label: $t('common.disabled'), value: 0 },
        ],
      },
      fieldName: 'status',
      label: $t('system.package.status'),
    },
  ];
}

function formatLimit(value: number | string | undefined) {
  return Number(value ?? 0) === 0 ? $t('system.package.unlimited') : String(value);
}

function formatUsage(value: number | string | undefined) {
  return Number(value ?? 0).toLocaleString();
}

export function useColumns<T = PackageApi.UserEntitlement>(
  onActionClick: OnActionClickFn<T>,
  permissions: PackageActionPermissions,
): VxeTableGridColumns {
  return [
    {
      field: 'id',
      title: 'ID',
      width: 80,
    },
    {
      field: 'username',
      formatter: ({ row }) =>
        row.displayName && row.displayName !== row.username
          ? `${row.displayName} (${row.username})`
          : row.username,
      minWidth: 160,
      title: $t('system.package.user'),
    },
    {
      cellRender: {
        name: 'CellTag',
        options: [
          {
            color: 'processing',
            label: $t('system.package.scopeGlobal'),
            value: 'GLOBAL',
          },
          {
            color: 'default',
            label: $t('system.package.scopeInterface'),
            value: 'INTERFACE',
          },
        ],
      },
      field: 'scope',
      title: $t('system.package.scope'),
      width: 110,
    },
    {
      field: 'packageName',
      minWidth: 200,
      showOverflow: false,
      slots: { default: 'packageName' },
      title: $t('system.package.packageName'),
    },
    {
      field: 'dailyLimit',
      formatter: ({ cellValue }) => formatLimit(cellValue),
      title: $t('system.package.dailyLimit'),
      width: 130,
    },
    {
      field: 'qpsLimit',
      formatter: ({ cellValue }) => formatLimit(cellValue),
      title: $t('system.package.qpsLimit'),
      width: 110,
    },
    {
      field: 'dayUsed',
      formatter: ({ cellValue }) => formatUsage(cellValue),
      title: $t('system.package.dayUsed'),
      width: 100,
    },
    {
      field: 'totalUsed',
      formatter: ({ cellValue }) => formatUsage(cellValue),
      title: $t('system.package.totalUsed'),
      width: 100,
    },
    {
      field: 'startAt',
      title: $t('system.package.startAt'),
      width: 165,
    },
    {
      field: 'endAt',
      title: $t('system.package.endAt'),
      width: 165,
    },
    {
      cellRender: { name: 'CellTag' },
      field: 'status',
      title: $t('system.package.status'),
      width: 90,
    },
    {
      field: 'createTime',
      title: $t('system.package.createTime'),
      width: 165,
    },
    ...(permissions.update || permissions.delete
      ? [
          {
            align: 'center' as const,
            cellRender: {
              attrs: {
                nameField: 'packageName',
                nameTitle: $t('system.package.packageName'),
                onClick: onActionClick,
              },
              name: 'CellOperation',
              options: [
                {
                  code: 'edit',
                  show: permissions.update,
                  text: $t('system.package.userEditAction'),
                },
                {
                  code: 'delete',
                  danger: true,
                  show: permissions.delete,
                  text: $t('common.delete'),
                },
              ],
            },
            field: 'operation',
            fixed: 'right' as const,
            title: $t('system.package.operation'),
            width:
              permissions.update && permissions.delete ? 150 : 100,
          },
        ]
      : []),
  ];
}

