import type { PackageActionPermissions } from '../permissions';

import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridColumns } from '#/adapter/vxe-table';
import type { PackageApi } from '#/api/package';

import { getPackageInterfaceOptions } from '#/api/package';
import { getRoleSelectOptions } from '#/api/system/role';
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
      component: 'ApiSelect',
      componentProps: {
        allowClear: true,
        api: getPackageInterfaceOptions,
        labelField: 'label',
        valueField: 'id',
      },
      fieldName: 'interfaceId',
      label: $t('system.package.interfaceName'),
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
      component: 'ApiSelect',
      componentProps: {
        api: getPackageInterfaceOptions,
        labelField: 'label',
        valueField: 'id',
      },
      fieldName: 'interfaceId',
      label: $t('system.package.interfaceName'),
      rules: 'selectRequired',
    },
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('system.package.name'),
      rules: 'required',
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
        rows: 3,
      },
      fieldName: 'remark',
      label: $t('system.package.remark'),
    },
  ];
}

export function useColumns<T = PackageApi.InterfacePackage>(
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
      field: 'interfaceName',
      minWidth: 180,
      title: $t('system.package.interfaceName'),
    },
    {
      field: 'apiCode',
      minWidth: 150,
      title: $t('system.interface.apiCode'),
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
      field: 'specs',
      formatter: ({ cellValue }) =>
        Array.isArray(cellValue)
          ? cellValue
              .map((item) =>
                item.id ? `#${item.id} ${item.specName}` : item.specName,
              )
              .join('、')
          : '',
      minWidth: 240,
      title: $t('system.package.specs'),
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
