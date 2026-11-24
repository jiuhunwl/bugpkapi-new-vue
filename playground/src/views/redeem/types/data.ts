import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridColumns } from '#/adapter/vxe-table';
import type { RedeemApi } from '#/api/redeem';

import { getGlobalPackageList, getInterfacePackageList } from '#/api/package';
import { formatSettlementPrice } from '#/composables/use-settlement-currency';
import { $t } from '#/locales';

export interface RedeemTypeActionPermissions {
  create: boolean;
  generate: boolean;
  update: boolean;
}

export function rewardTypeOptions() {
  return [
    { label: $t('system.redeem.type.rewardTypePoints'), value: 1 },
    { label: $t('system.redeem.type.rewardTypeBalance'), value: 2 },
    { label: $t('system.redeem.type.rewardTypeGlobalPackage'), value: 3 },
    { label: $t('system.redeem.type.rewardTypeInterfaceSpec'), value: 4 },
    { label: $t('system.redeem.type.rewardTypeCombo'), value: 5 },
  ];
}

function typeStatusOptions() {
  return [
    {
      color: 'success',
      label: $t('system.redeem.type.statusEnabled'),
      value: 1,
    },
    {
      color: 'error',
      label: $t('system.redeem.type.statusDisabled'),
      value: 0,
    },
  ];
}

/** 全站套餐下拉选项（rewardType=3）
 * 后端 listquery.Validate 上限硬编码 100（packagepkg/content/service.go），
 * 请求 200 会返回 400「pageSize must be between 1 and 100」。 */
export async function fetchGlobalPackageOptions() {
  const result = await getGlobalPackageList({ page: 1, pageSize: 100 });
  return (result.items ?? [])
    .filter((item) => item.status === 1)
    .map((item) => ({ label: item.name, value: Number(item.id) }));
}

/** 接口规格下拉选项（rewardType=4） */
export async function fetchInterfaceSpecOptions() {
  const result = await getInterfacePackageList({ page: 1, pageSize: 100 });
  const options: Array<{ label: string; value: number }> = [];
  for (const pkg of result.items ?? []) {
    for (const spec of pkg.specs ?? []) {
      if (!spec.id) continue;
      options.push({
        label: `${pkg.interfaceName || pkg.name} / ${spec.specName}`,
        value: Number(spec.id),
      });
    }
  }
  return options;
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'keyword',
      label: $t('system.redeem.type.keyword'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: typeStatusOptions(),
      },
      fieldName: 'status',
      label: $t('system.redeem.type.status'),
    },
  ];
}

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        maxlength: 64,
        placeholder: $t('system.redeem.type.codePlaceholder'),
      },
      fieldName: 'code',
      label: $t('system.redeem.type.code'),
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: {
        maxlength: 64,
      },
      fieldName: 'name',
      label: $t('system.redeem.type.name'),
      rules: 'required',
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        disabled: false,
        options: rewardTypeOptions(),
        optionType: 'button',
      },
      defaultValue: 1,
      fieldName: 'rewardType',
      label: $t('system.redeem.type.rewardType'),
      rules: 'selectRequired',
    },
    {
      component: 'InputNumber',
      componentProps: {
        min: 0,
        precision: 0,
        style: 'width: 100%',
      },
      dependencies: {
        required(values) {
          return values.rewardType === 1 || values.rewardType === 5;
        },
        show(values) {
          return values.rewardType === 1 || values.rewardType === 5;
        },
        triggerFields: ['rewardType'],
      },
      fieldName: 'rewardPoints',
      label: $t('system.redeem.type.rewardPoints'),
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('system.redeem.type.rewardBalancePlaceholder'),
      },
      dependencies: {
        required(values) {
          return values.rewardType === 2 || values.rewardType === 5;
        },
        show(values) {
          return values.rewardType === 2 || values.rewardType === 5;
        },
        triggerFields: ['rewardType'],
      },
      fieldName: 'rewardBalance',
      label: $t('system.redeem.type.rewardBalance'),
      rules: 'required',
    },
    {
      component: 'Select',
      componentProps: {
        class: 'w-full',
        options: [],
        placeholder: $t('system.redeem.type.rewardRefPlaceholderGlobal'),
        popupMatchSelectWidth: false,
      },
      dependencies: {
        required(values) {
          return values.rewardType === 3 || values.rewardType === 4;
        },
        show(values) {
          return values.rewardType === 3 || values.rewardType === 4;
        },
        triggerFields: ['rewardType'],
      },
      fieldName: 'rewardRefId',
      label: $t('system.redeem.type.rewardRef'),
      rules: 'selectRequired',
    },
    {
      component: 'InputNumber',
      componentProps: {
        min: 0,
        precision: 0,
        style: 'width: 100%',
      },
      defaultValue: 1,
      fieldName: 'perUserLimit',
      help: $t('system.redeem.type.limitUnlimited'),
      label: $t('system.redeem.type.perUserLimit'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        min: 0,
        precision: 0,
        style: 'width: 100%',
      },
      defaultValue: 0,
      fieldName: 'perIpLimit',
      help: $t('system.redeem.type.limitUnlimited'),
      label: $t('system.redeem.type.perIpLimit'),
      rules: 'required',
    },
    {
      component: 'DatePicker',
      componentProps: {
        showTime: true,
        style: 'width: 100%',
        valueFormat: 'YYYY-MM-DD HH:mm:ss',
      },
      fieldName: 'startAt',
      label: $t('system.redeem.type.startAt'),
    },
    {
      component: 'DatePicker',
      componentProps: {
        showTime: true,
        style: 'width: 100%',
        valueFormat: 'YYYY-MM-DD HH:mm:ss',
      },
      fieldName: 'endAt',
      label: $t('system.redeem.type.endAt'),
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: typeStatusOptions(),
        optionType: 'button',
      },
      defaultValue: 1,
      fieldName: 'status',
      label: $t('system.redeem.type.status'),
    },
  ];
}

export function useGenerateFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'InputNumber',
      componentProps: {
        max: 5000,
        min: 1,
        precision: 0,
        style: 'width: 100%',
      },
      defaultValue: 1,
      fieldName: 'count',
      label: $t('system.redeem.type.count'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        allowClear: true,
        min: 0,
        placeholder: $t('system.redeem.type.inheritTemplate'),
        precision: 0,
        style: 'width: 100%',
      },
      fieldName: 'perUserLimit',
      help: $t('system.redeem.type.limitUnlimited'),
      label: $t('system.redeem.type.perUserLimit'),
    },
    {
      component: 'InputNumber',
      componentProps: {
        allowClear: true,
        min: 0,
        placeholder: $t('system.redeem.type.inheritTemplate'),
        precision: 0,
        style: 'width: 100%',
      },
      fieldName: 'perIpLimit',
      help: $t('system.redeem.type.limitUnlimited'),
      label: $t('system.redeem.type.perIpLimit'),
    },
    {
      component: 'Input',
      componentProps: {
        maxlength: 64,
        placeholder: $t('system.redeem.type.campaignRefPlaceholder'),
      },
      fieldName: 'campaignRef',
      label: $t('system.redeem.type.campaignRef'),
    },
  ];
}

export function useColumns(
  onActionClick: OnActionClickFn<RedeemApi.CodeType>,
  permissions: RedeemTypeActionPermissions,
): VxeTableGridColumns<RedeemApi.CodeType> {
  return [
    {
      field: 'id',
      title: 'ID',
      width: 90,
    },
    {
      field: 'code',
      title: $t('system.redeem.type.code'),
      width: 140,
    },
    {
      field: 'name',
      title: $t('system.redeem.type.name'),
      width: 160,
    },
    {
      field: 'rewardType',
      formatter: ({ cellValue }) =>
        rewardTypeOptions().find((item) => item.value === cellValue)?.label ??
        '-',
      title: $t('system.redeem.type.rewardType'),
      width: 130,
    },
    {
      field: 'rewardPoints',
      formatter: ({ row }) =>
        row.rewardType === 1 || row.rewardType === 5
          ? Number(row.rewardPoints ?? 0).toLocaleString()
          : '-',
      title: $t('system.redeem.type.rewardPoints'),
      width: 110,
    },
    {
      field: 'rewardBalance',
      formatter: ({ row }) =>
        row.rewardType === 2 || row.rewardType === 5
          ? formatSettlementPrice(row.rewardBalance, 4)
          : '-',
      title: $t('system.redeem.type.rewardBalance'),
      width: 120,
    },
    {
      field: 'rewardRefName',
      formatter: ({ row }) =>
        row.rewardType === 3 || row.rewardType === 4
          ? (row.rewardRefName || '-')
          : '-',
      title: $t('system.redeem.type.rewardRef'),
      minWidth: 160,
    },
    {
      field: 'perUserLimit',
      formatter: ({ cellValue }) =>
        Number(cellValue ?? 0) === 0
          ? $t('system.redeem.type.unlimited')
          : Number(cellValue).toLocaleString(),
      title: $t('system.redeem.type.perUserLimit'),
      width: 110,
    },
    {
      field: 'perIpLimit',
      formatter: ({ cellValue }) =>
        Number(cellValue ?? 0) === 0
          ? $t('system.redeem.type.unlimited')
          : Number(cellValue).toLocaleString(),
      title: $t('system.redeem.type.perIpLimit'),
      width: 110,
    },
    {
      field: 'startAt',
      formatter: ({ row }) =>
        `${row.startAt || '-'} ~ ${row.endAt || '-'}`,
      title: $t('system.redeem.type.validityPeriod'),
      width: 330,
    },
    {
      cellRender: { name: 'CellTag', options: typeStatusOptions() },
      field: 'status',
      title: $t('system.redeem.type.status'),
      width: 90,
    },
    {
      field: 'generatedCount',
      formatter: ({ row }) =>
        `${Number(row.generatedCount ?? 0).toLocaleString()} / ${Number(row.redeemedCount ?? 0).toLocaleString()}`,
      title: $t('system.redeem.type.usage'),
      width: 120,
    },
    {
      field: 'frozen',
      formatter: ({ cellValue }) =>
        cellValue === true ? $t('system.redeem.type.frozen') : '-',
      title: $t('system.redeem.type.frozenTitle'),
      width: 110,
    },
    {
      field: 'createTime',
      title: $t('system.redeem.type.createTime'),
      width: 180,
    },
    ...(permissions.update || permissions.generate
      ? [
          {
            align: 'center' as const,
            cellRender: {
              attrs: {
                nameField: 'name',
                nameTitle: $t('system.redeem.type.name'),
                onClick: onActionClick,
              },
              name: 'CellOperation',
              options: [
                {
                  code: 'edit',
                  show: permissions.update,
                  text: $t('common.edit'),
                },
                {
                  code: 'toggleStatus',
                  danger: true,
                  show: permissions.update,
                  text: $t('system.redeem.type.toggleStatus'),
                },
                {
                  code: 'generate',
                  show: permissions.generate,
                  text: $t('system.redeem.code.generate'),
                },
              ],
            },
            field: 'operation',
            fixed: 'right' as const,
            title: $t('system.redeem.type.operation'),
            width: 230,
          },
        ]
      : []),
  ];
}
