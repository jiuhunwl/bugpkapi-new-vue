import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridColumns } from '#/adapter/vxe-table';
import type { SystemRoleApi } from '#/api';

import { $t } from '#/locales';

export interface RoleActionPermissions {
  delete: boolean;
  update: boolean;
}

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('system.role.roleName'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        max: 1_000_000,
        min: 1,
        precision: 0,
        style: 'width: 100%',
      },
      defaultValue: 1,
      fieldName: 'qpsLimit',
      help: $t('roleAdmin.qpsHelp'),
      label: $t('roleAdmin.qpsLimit'),
      rules: 'required',
    },
    {
      component: 'Switch',
      componentProps: {
        checkedChildren: $t('common.enabled'),
        class: 'w-auto',
        unCheckedChildren: $t('common.disabled'),
      },
      defaultValue: false,
      fieldName: 'quotaEnabled',
      help: $t('roleAdmin.quotaEnabledHelp'),
      label: $t('roleAdmin.quotaEnabled'),
    },
    {
      component: 'InputNumber',
      componentProps: {
        max: 1_000_000_000,
        min: 0,
        precision: 0,
        style: 'width: 100%',
      },
      defaultValue: 60,
      fieldName: 'quotaMinuteLimit',
      help: $t('roleAdmin.quotaZeroHelp'),
      label: $t('roleAdmin.quotaMinuteLimit'),
    },
    {
      component: 'InputNumber',
      componentProps: {
        max: 1_000_000_000,
        min: 0,
        precision: 0,
        style: 'width: 100%',
      },
      defaultValue: 600,
      fieldName: 'quotaHourLimit',
      help: $t('roleAdmin.quotaZeroHelp'),
      label: $t('roleAdmin.quotaHourLimit'),
    },
    {
      component: 'InputNumber',
      componentProps: {
        max: 1_000_000_000_000,
        min: 0,
        precision: 0,
        style: 'width: 100%',
      },
      defaultValue: 1000,
      fieldName: 'quotaDayLimit',
      help: $t('roleAdmin.quotaZeroHelp'),
      label: $t('roleAdmin.quotaDayLimit'),
    },
    {
      component: 'InputNumber',
      componentProps: {
        max: 1_000_000_000_000,
        min: 0,
        precision: 0,
        style: 'width: 100%',
      },
      defaultValue: 20000,
      fieldName: 'quotaMonthLimit',
      help: $t('roleAdmin.quotaZeroHelp'),
      label: $t('roleAdmin.quotaMonthLimit'),
    },
    {
      component: 'Select',
      componentProps: {
        options: [
          {
            label: $t('roleAdmin.quotaCountAttempt'),
            value: 'attempt',
          },
          {
            label: $t('roleAdmin.quotaCountSuccess'),
            value: 'success',
          },
        ],
      },
      defaultValue: 'attempt',
      fieldName: 'quotaCountMode',
      help: $t('roleAdmin.quotaCountModeHelp'),
      label: $t('roleAdmin.quotaCountMode'),
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: [
          { label: $t('common.enabled'), value: 1 },
          { label: $t('common.disabled'), value: 0 },
        ],
        optionType: 'button',
      },
      defaultValue: 0,
      fieldName: 'selfRegisterEnabled',
      help: $t('roleAdmin.selfRegisterHelp'),
      label: $t('roleAdmin.selfRegister'),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: 'admin_user',
      },
      fieldName: 'roleKey',
      label: $t('roleAdmin.roleKey'),
      rules: 'required',
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: [
          { label: $t('common.enabled'), value: 1 },
          { label: $t('common.disabled'), value: 0 },
        ],
        optionType: 'button',
      },
      defaultValue: 1,
      fieldName: 'status',
      label: $t('system.role.status'),
    },
    {
      component: 'Textarea',
      fieldName: 'remark',
      label: $t('system.role.remark'),
    },
    {
      component: 'Input',
      fieldName: 'permissions',
      formItemClass: 'items-start',
      label: $t('system.role.setPermissions'),
      modelPropName: 'modelValue',
    },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('system.role.roleName'),
    },
    {
      component: 'Input',
      fieldName: 'roleKey',
      label: $t('roleAdmin.roleKey'),
    },
    { component: 'Input', fieldName: 'id', label: $t('system.role.id') },
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
      label: $t('system.role.status'),
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
      fieldName: 'selfRegisterEnabled',
      label: $t('roleAdmin.selfRegister'),
    },
    {
      component: 'RangePicker',
      fieldName: 'createTime',
      label: $t('system.role.createTime'),
    },
  ];
}

export function useColumns<T = SystemRoleApi.SystemRole>(
  onActionClick: OnActionClickFn<T>,
  permissions: RoleActionPermissions,
  onStatusChange?: (newStatus: any, row: T) => PromiseLike<boolean | undefined>,
): VxeTableGridColumns {
  return [
    {
      field: 'name',
      title: $t('system.role.roleName'),
      width: 200,
    },
    {
      field: 'id',
      title: $t('system.role.id'),
      width: 100,
    },
    {
      field: 'roleKey',
      title: $t('roleAdmin.roleKey'),
      width: 160,
    },
    {
      field: 'qpsLimit',
      formatter: ({ cellValue }) => Number(cellValue ?? 1).toLocaleString(),
      title: $t('roleAdmin.qpsLimit'),
      width: 120,
    },
    {
      cellRender: {
        name: 'CellTag',
        options: [
          { color: 'success', label: $t('common.enabled'), value: 1 },
          { color: 'default', label: $t('common.disabled'), value: 0 },
        ],
      },
      field: 'quotaEnabled',
      title: $t('roleAdmin.quotaStatus'),
      width: 120,
    },
    {
      field: 'quotaDayLimit',
      formatter: ({ row }) =>
        Number(row.quotaEnabled ?? 0) === 0
          ? $t('roleAdmin.quotaUnlimited')
          : Number(row.quotaDayLimit ?? 0) === 0
            ? $t('roleAdmin.quotaUnlimited')
            : `${Number(row.quotaDayLimit).toLocaleString()} / ${$t('roleAdmin.quotaDayUnit')}`,
      title: $t('roleAdmin.quotaDayLimit'),
      width: 150,
    },
    {
      field: 'quotaCountMode',
      formatter: ({ cellValue }) =>
        cellValue === 'success'
          ? $t('roleAdmin.quotaCountSuccess')
          : $t('roleAdmin.quotaCountAttempt'),
      title: $t('roleAdmin.quotaCountMode'),
      width: 150,
    },
    {
      cellRender: {
        name: 'CellTag',
        options: [
          { color: 'success', label: $t('common.enabled'), value: 1 },
          { color: 'default', label: $t('common.disabled'), value: 0 },
        ],
      },
      field: 'selfRegisterEnabled',
      title: $t('roleAdmin.selfRegister'),
      width: 130,
    },
    {
      field: 'userCount',
      formatter: ({ cellValue }) => Number(cellValue ?? 0).toLocaleString(),
      title: $t('roleAdmin.userCount'),
      width: 110,
    },
    {
      field: 'builtin',
      formatter: ({ row }) =>
        row.defaultRegisterRole
          ? $t('roleAdmin.defaultRole')
          : row.builtin
            ? $t('roleAdmin.builtinRole')
            : $t('roleAdmin.customRole'),
      title: $t('roleAdmin.roleType'),
      width: 130,
    },
    {
      cellRender: {
        ...(permissions.update && onStatusChange
          ? { attrs: { beforeChange: onStatusChange }, name: 'CellSwitch' }
          : { name: 'CellTag' }),
      },
      field: 'status',
      title: $t('system.role.status'),
      width: 100,
    },
    {
      field: 'remark',
      minWidth: 100,
      title: $t('system.role.remark'),
    },
    {
      field: 'createTime',
      title: $t('system.role.createTime'),
      width: 200,
    },
    ...((permissions.update || permissions.delete) ? [{
      align: 'center' as const,
      cellRender: {
        attrs: {
          nameField: 'name',
          nameTitle: $t('system.role.name'),
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
      title: $t('system.role.operation'),
      width: 160,
    }] : []),
  ];
}
