import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridColumns } from '#/adapter/vxe-table';
import type { RechargeAmountApi } from '#/api/system/payment';

import { formatSettlementPrice } from '#/composables/use-settlement-currency';
import { $t } from '#/locales';
export interface RechargePresetActionPermissions {
  delete: boolean;
  update: boolean;
}
export const statusOptions = () => [
  { label: $t('rechargePreset.enabled'), value: 1 },
  { label: $t('rechargePreset.disabled'), value: 0 },
];
export function formatAmount(value?: number | string) {
  return formatSettlementPrice(value);
}
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: { placeholder: $t('rechargePreset.searchPlaceholder') },
      fieldName: 'keyword',
      label: $t('rechargePreset.fields.keyword'),
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: statusOptions() },
      fieldName: 'status',
      label: $t('rechargePreset.fields.status'),
    },
  ];
}
export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'InputNumber',
      componentProps: { min: 0.01, precision: 2 },
      defaultValue: 10,
      fieldName: 'amount',
      label: $t('rechargePreset.fields.amount'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: { min: 0, precision: 2 },
      defaultValue: 0,
      fieldName: 'giftAmount',
      help: $t('rechargePreset.giftHelp'),
      label: $t('rechargePreset.fields.gift'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: { min: 0, precision: 0 },
      defaultValue: 0,
      fieldName: 'sortNo',
      label: $t('rechargePreset.fields.sort'),
    },
    {
      component: 'Switch',
      componentProps: {
        checkedChildren: $t('rechargePreset.enabled'),
        class: 'w-auto',
        unCheckedChildren: $t('rechargePreset.disabled'),
      },
      defaultValue: true,
      fieldName: 'status',
      label: $t('rechargePreset.fields.status'),
    },
  ];
}
export function useColumns<T = RechargeAmountApi.RechargeAmount>(
  onActionClick: OnActionClickFn<T>,
  permissions: RechargePresetActionPermissions,
): VxeTableGridColumns {
  return [
    {
      field: 'amount',
      formatter: ({ cellValue }) => formatAmount(cellValue),
      title: $t('rechargePreset.fields.amount'),
      width: 140,
    },
    {
      field: 'giftAmount',
      formatter: ({ cellValue }) =>
        Number(cellValue ?? 0) > 0
          ? formatAmount(cellValue)
          : $t('rechargePreset.noGift'),
      title: $t('rechargePreset.fields.gift'),
      width: 140,
    },
    {
      field: 'creditAmount',
      formatter: ({ cellValue }) => formatAmount(cellValue),
      title: $t('rechargePreset.fields.credit'),
      width: 140,
    },
    {
      cellRender: { name: 'CellTag' },
      field: 'status',
      title: $t('rechargePreset.fields.status'),
      width: 100,
    },
    { field: 'sortNo', title: $t('rechargePreset.fields.sort'), width: 100 },
    {
      field: 'updateTime',
      title: $t('rechargePreset.fields.updateTime'),
      width: 180,
    },
    ...(permissions.update || permissions.delete
      ? [
          {
            align: 'center' as const,
            cellRender: {
              attrs: {
                nameField: 'amount',
                nameTitle: $t('rechargePreset.entityName'),
                onClick: onActionClick,
              },
              name: 'CellOperation',
              options: [
                {
                  code: 'edit',
                  show: permissions.update,
                  text: $t('rechargePreset.actions.edit'),
                },
                {
                  code: 'delete',
                  danger: true,
                  show: permissions.delete,
                  text: $t('rechargePreset.actions.delete'),
                },
              ],
            },
            field: 'operation',
            fixed: 'right' as const,
            title: $t('rechargePreset.fields.actions'),
            width: permissions.update && permissions.delete ? 160 : 100,
          },
        ]
      : []),
  ];
}
