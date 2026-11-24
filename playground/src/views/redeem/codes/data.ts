import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridColumns } from '#/adapter/vxe-table';
import type { RedeemApi } from '#/api/redeem';

import { $t } from '#/locales';
import { getTypeList } from '#/api/redeem';

export interface RedeemCodeActionPermissions {
  export: boolean;
  void: boolean;
}

async function fetchTypeOptions() {
  const result = await getTypeList({ page: 1, pageSize: 200 });
  return (result.items ?? []).map((item) => ({
    label: item.name,
    value: item.id,
  }));
}

export function codeStatusOptions() {
  return [
    {
      color: 'success',
      label: $t('system.redeem.code.statusUnused'),
      value: 1,
    },
    {
      color: 'processing',
      label: $t('system.redeem.code.statusUsed'),
      value: 2,
    },
    {
      color: 'error',
      label: $t('system.redeem.code.statusVoided'),
      value: 0,
    },
  ];
}

export function codeSourceOptions() {
  return [
    { label: $t('system.redeem.code.sourcePage'), value: 1 },
    { label: $t('system.redeem.code.sourceApi'), value: 2 },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'keyword',
      label: $t('system.redeem.code.keyword'),
    },
    {
      component: 'ApiSelect',
      componentProps: {
        allowClear: true,
        api: fetchTypeOptions,
        class: 'w-full',
        dropdownStyle: { minWidth: '220px' },
        labelField: 'label',
        popupMatchSelectWidth: false,
        valueField: 'value',
      },
      fieldName: 'type_id',
      label: $t('system.redeem.code.type'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: codeStatusOptions(),
      },
      fieldName: 'status',
      label: $t('system.redeem.code.status'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: codeSourceOptions(),
      },
      fieldName: 'source',
      label: $t('system.redeem.code.source'),
    },
  ];
}

export function useColumns(
  onActionClick: OnActionClickFn<RedeemApi.Code>,
  permissions: RedeemCodeActionPermissions,
): VxeTableGridColumns<RedeemApi.Code> {
  return [
    {
      field: 'id',
      title: 'ID',
      width: 90,
    },
    {
      field: 'typeName',
      title: $t('system.redeem.code.typeName'),
      width: 160,
    },
    {
      field: 'codeMask',
      title: $t('system.redeem.code.codeMask'),
      width: 200,
    },
    {
      cellRender: { name: 'CellTag', options: codeStatusOptions() },
      field: 'status',
      title: $t('system.redeem.code.status'),
      width: 100,
    },
    {
      cellRender: { name: 'CellTag', options: codeSourceOptions() },
      field: 'source',
      title: $t('system.redeem.code.source'),
      width: 110,
    },
    {
      field: 'batchId',
      formatter: ({ cellValue }) => cellValue || '-',
      title: $t('system.redeem.code.batch'),
      minWidth: 200,
    },
    {
      field: 'usedBy',
      formatter: ({ cellValue }) => cellValue || '-',
      title: $t('system.redeem.code.usedBy'),
      width: 140,
    },
    {
      field: 'usedAt',
      formatter: ({ cellValue }) => cellValue || '-',
      title: $t('system.redeem.code.usedAt'),
      width: 180,
    },
    {
      field: 'createTime',
      title: $t('system.redeem.code.createTime'),
      width: 180,
    },
    ...(permissions.void
      ? [
          {
            align: 'center' as const,
            cellRender: {
              attrs: {
                nameField: 'codeMask',
                nameTitle: $t('system.redeem.code.codeMask'),
                onClick: onActionClick,
              },
              name: 'CellOperation',
              options: [
                {
                  code: 'void',
                  danger: true,
                  show: (row: RedeemApi.Code) => row.status === 1,
                  text: $t('system.redeem.code.void'),
                },
              ],
            },
            field: 'operation',
            fixed: 'right' as const,
            title: $t('system.redeem.code.operation'),
            width: 100,
          },
        ]
      : []),
  ];
}
