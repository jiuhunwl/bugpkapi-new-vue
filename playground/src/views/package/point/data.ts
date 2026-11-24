import type { PackageActionPermissions } from '../permissions';

import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridColumns } from '#/adapter/vxe-table';
import type { PackageApi } from '#/api/package';

import { getRoleSelectOptions } from '#/api/system/role';
import { formatSettlementPrice } from '#/composables/use-settlement-currency';
import { $t } from '#/locales';

import { packageRoleText } from '../role-limit';

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'keyword',
      label: $t('system.package.keyword'),
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

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('system.package.name'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        min: 0,
        precision: 4,
      },
      defaultValue: 0,
      fieldName: 'price',
      label: $t('system.package.price'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        min: 1,
        precision: 0,
      },
      defaultValue: 100,
      fieldName: 'pointAmount',
      label: $t('system.package.pointAmount'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        min: 0,
        precision: 0,
      },
      defaultValue: 0,
      fieldName: 'stockLimit',
      help: $t('system.package.stockLimitHelp'),
      label: $t('system.package.stockLimit'),
    },
    {
      component: 'InputNumber',
      componentProps: {
        min: 0,
        precision: 0,
      },
      defaultValue: 0,
      fieldName: 'perUserLimit',
      help: $t('system.package.perUserLimitHelp'),
      label: $t('system.package.perUserLimit'),
    },
    {
      component: 'DatePicker',
      componentProps: {
        class: 'w-full',
        placeholder: $t('system.package.saleStartAtPlaceholder'),
        showTime: true,
        valueFormat: 'YYYY-MM-DD HH:mm:ss',
      },
      fieldName: 'saleStartAt',
      label: $t('system.package.saleStartAt'),
    },
    {
      component: 'DatePicker',
      componentProps: {
        class: 'w-full',
        placeholder: $t('system.package.saleEndAtPlaceholder'),
        showTime: true,
        valueFormat: 'YYYY-MM-DD HH:mm:ss',
      },
      fieldName: 'saleEndAt',
      label: $t('system.package.saleEndAt'),
    },
    {
      component: 'Switch',
      componentProps: {
        checkedChildren: $t('system.register.enableAction'),
        class: 'w-auto',
        unCheckedChildren: $t('system.register.disableAction'),
      },
      defaultValue: false,
      fieldName: 'roleRestricted',
      help: $t('system.package.roleRestrictedHelp'),
      label: $t('system.package.roleRestricted'),
    },
    {
      component: 'Switch',
      componentProps: {
        checkedChildren: $t('system.register.enableAction'),
        class: 'w-auto',
        unCheckedChildren: $t('system.register.disableAction'),
      },
      defaultValue: false,
      dependencies: {
        if: (values) => Boolean(values.roleRestricted),
        triggerFields: ['roleRestricted'],
      },
      fieldName: 'roleVisibleOnly',
      help: $t('system.package.roleVisibleOnlyHelp'),
      label: $t('system.package.roleVisibleOnly'),
    },
    {
      component: 'ApiSelect',
      componentProps: {
        allowClear: true,
        api: getRoleSelectOptions,
        class: 'w-full',
        labelField: 'name',
        mode: 'multiple',
        placeholder: $t('system.package.roleGroupPlaceholder'),
        valueField: 'id',
      },
      dependencies: {
        if: (values) => Boolean(values.roleRestricted),
        rules: (values) =>
          values.roleRestricted ? 'selectRequired' : null,
        triggerFields: ['roleRestricted'],
      },
      fieldName: 'roleIds',
      help: $t('system.package.roleGroupHelp'),
      label: $t('system.package.roleGroup'),
    },
    {
      component: 'Switch',
      componentProps: {
        checkedChildren: $t('system.register.enableAction'),
        class: 'w-auto',
        unCheckedChildren: $t('system.register.disableAction'),
      },
      defaultValue: true,
      fieldName: 'status',
      label: $t('system.package.status'),
    },
    {
      component: 'Switch',
      componentProps: {
        checkedChildren: $t('system.package.hiddenOn'),
        class: 'w-auto',
        unCheckedChildren: $t('system.package.hiddenOff'),
      },
      defaultValue: false,
      fieldName: 'hidden',
      help: $t('system.package.hiddenHelp'),
      label: $t('system.package.hidden'),
    },
    {
      component: 'Textarea',
      componentProps: {
        rows: 4,
      },
      fieldName: 'remark',
      label: $t('system.package.remark'),
    },
  ];
}

export function useColumns<T = PackageApi.PointPackage>(
  onActionClick: OnActionClickFn<T>,
  permissions: PackageActionPermissions,
): VxeTableGridColumns {
  return [
    {
      field: 'id',
      title: 'ID',
      width: 90,
    },
    {
      field: 'name',
      minWidth: 180,
      title: $t('system.package.name'),
    },
    {
      field: 'roleRestricted',
      formatter: ({ row }) => packageRoleText(row),
      title: $t('system.package.roleGroup'),
      width: 200,
    },
    {
      field: 'price',
      formatter: ({ cellValue }) =>
        Number(cellValue ?? 0) === 0
          ? $t('system.package.free')
          : formatSettlementPrice(cellValue),
      title: $t('system.package.price'),
      width: 120,
    },
    {
      field: 'pointAmount',
      formatter: ({ cellValue }) =>
        $t('system.package.pointAmountText', [
          Number(cellValue ?? 0).toLocaleString('zh-CN'),
        ]),
      title: $t('system.package.pointAmount'),
      width: 160,
    },
    {
      field: 'stockLimit',
      formatter: ({ cellValue, row }) => {
        const limit = Number(cellValue ?? 0);
        if (limit <= 0) {
          return $t('system.package.unlimited');
        }
        return `${Number(row?.stockUsed ?? 0)} / ${limit}`;
      },
      title: $t('system.package.stockUsed'),
      width: 140,
    },
    {
      field: 'perUserLimit',
      formatter: ({ cellValue }) =>
        Number(cellValue ?? 0) === 0
          ? $t('system.package.unlimited')
          : cellValue,
      title: $t('system.package.perUserLimit'),
      width: 130,
    },
    {
      field: 'saleEndAt',
      formatter: ({ cellValue }) =>
        cellValue || $t('system.package.unlimited'),
      title: $t('system.package.saleEndAt'),
      width: 180,
    },
    {
      cellRender: { name: 'CellTag' },
      field: 'status',
      title: $t('system.package.status'),
      width: 100,
    },
    {
      field: 'hidden',
      formatter: ({ cellValue }) =>
        Number(cellValue ?? 0) === 1 ? $t('system.package.hidden') : '',
      title: $t('system.package.hidden'),
      width: 110,
    },
    {
      field: 'remark',
      minWidth: 180,
      title: $t('system.package.remark'),
    },
    {
      field: 'createTime',
      title: $t('system.package.createTime'),
      width: 180,
    },
    ...(permissions.update || permissions.delete ? [{
      align: 'center' as const,
      cellRender: {
        attrs: {
          nameField: 'name',
          nameTitle: $t('system.package.name'),
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: [
          { code: 'edit', show: permissions.update, text: $t('common.edit') },
          { code: 'delete', danger: true, show: permissions.delete, text: $t('common.delete') },
        ],
      },
      field: 'operation',
      fixed: 'right' as const,
      title: $t('system.package.operation'),
      width: (permissions.update && permissions.delete) ? 160 : 100,
    }] : []),
  ];
}
