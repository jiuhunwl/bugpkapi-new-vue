import type { OnActionClickFn, VxeTableGridColumns } from '#/adapter/vxe-table';
import type { SystemMenuApi } from '#/api/system/menu';

import { $t } from '#/locales';

export interface MenuActionPermissions {
  create: boolean;
  delete: boolean;
  update: boolean;
}

export function getMenuTypeOptions() {
  return [
    { color: 'processing', label: $t('system.menu.typeCatalog'), value: 'catalog' },
    { color: 'default', label: $t('system.menu.typeMenu'), value: 'menu' },
    { color: 'error', label: $t('system.menu.typeButton'), value: 'button' },
    { color: 'success', label: $t('system.menu.typeEmbedded'), value: 'embedded' },
    { color: 'warning', label: $t('system.menu.typeLink'), value: 'link' },
  ];
}

export function useColumns(
  onActionClick: OnActionClickFn<SystemMenuApi.SystemMenu>,
  permissions: MenuActionPermissions,
): VxeTableGridColumns<SystemMenuApi.SystemMenu> {
  const columns: VxeTableGridColumns<SystemMenuApi.SystemMenu> = [
    {
      align: 'left',
      field: 'meta.title',
      fixed: 'left',
      slots: { default: 'title' },
      title: $t('system.menu.menuTitle'),
      treeNode: true,
      width: 250,
    },
    {
      align: 'center',
      cellRender: { name: 'CellTag', options: getMenuTypeOptions() },
      field: 'type',
      title: $t('system.menu.type'),
      width: 100,
    },
    { field: 'authCode', title: $t('system.menu.authCode'), width: 200 },
    {
      field: 'roleNames',
      formatter: ({ cellValue, row }) => {
        const values =
          Array.isArray(cellValue) && cellValue.length > 0
            ? cellValue
            : row.roles;
        return Array.isArray(values) && values.length > 0
          ? values.join(', ')
          : '-';
      },
      title: $t('system.menu.roles'),
      width: 180,
    },
    { align: 'left', field: 'path', title: $t('system.menu.path'), width: 200 },
    {
      align: 'left',
      field: 'component',
      formatter: ({ row }) => {
        if (row.type === 'embedded') return row.meta?.iframeSrc ?? '';
        if (row.type === 'link') return row.meta?.link ?? '';
        if (row.type === 'catalog' || row.type === 'menu') return row.component ?? '';
        return '';
      },
      minWidth: 200,
      title: $t('system.menu.component'),
    },
    {
      cellRender: { name: 'CellTag' },
      field: 'status',
      title: $t('system.menu.status'),
      width: 100,
    },
  ];

  if (permissions.create || permissions.update || permissions.delete) {
    columns.push({
      align: 'right',
      cellRender: {
        attrs: { nameField: 'name', onClick: onActionClick },
        name: 'CellOperation',
        options: [
          { code: 'append', show: permissions.create, text: $t('menuAdmin.addChild') },
          { code: 'edit', show: permissions.update, text: $t('common.edit') },
          { code: 'delete', danger: true, show: permissions.delete, text: $t('common.delete') },
        ],
      },
      field: 'operation',
      fixed: 'right',
      headerAlign: 'center',
      showOverflow: false,
      title: $t('system.menu.operation'),
      width: 200,
    });
  }
  return columns;
}
