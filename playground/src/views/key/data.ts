import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridColumns } from '#/adapter/vxe-table';
import type { KeyApi } from '#/api/key';

import { getKeyInterfaceOptions } from '#/api/key';
import { $t } from '#/locales';

export interface KeyActionPermissions {
  delete: boolean;
  detail: boolean;
  interface: boolean;
  ipWhitelist: boolean;
  status: boolean;
}

export async function fetchInterfaceOptions() {
  return await getKeyInterfaceOptions();
}

function buildOpenUrl() {
  return '/api/{apiCode}';
}

function buildWhitelistPreview(row: KeyApi.KeyItem) {
  const value = (row.ipWhitelist ?? '').trim();
  if (!value) {
    return '-';
  }
  const items = value
    .split(/[,;\n\r]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (items.length === 0) {
    return '-';
  }
  if (items.length <= 2) {
    return items.join(', ');
  }
  return `${items.slice(0, 2).join(', ')} +${items.length - 2}`;
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'keyword',
      label: $t('system.key.keyword'),
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
      label: $t('system.key.status'),
    },
  ];
}

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        maxlength: 64,
        placeholder: $t('system.key.name'),
      },
      fieldName: 'name',
      label: $t('system.key.name'),
      rules: 'required',
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        optionType: 'button',
        options: [
          { label: $t('system.key.scopeInterface'), value: 'INTERFACE' },
          { label: $t('system.key.scopeGlobal'), value: 'GLOBAL' },
        ],
      },
      defaultValue: 'INTERFACE',
      fieldName: 'keyScope',
      label: $t('system.key.keyScope'),
      rules: 'selectRequired',
    },
    {
      component: 'ApiSelect',
      componentProps: {
        api: fetchInterfaceOptions,
        labelField: 'label',
        mode: 'multiple',
        placeholder: $t('system.key.interfacePlaceholder'),
        valueField: 'id',
      },
      dependencies: {
        if(values) {
          return values.keyScope !== 'GLOBAL';
        },
        rules(values) {
          return values.keyScope === 'GLOBAL' ? null : 'selectRequired';
        },
        triggerFields: ['keyScope'],
      },
      fieldName: 'interfaceIds',
      label: $t('system.key.interfaceName'),
    },
  ];
}

export function useColumns<T = KeyApi.KeyItem>(
  onActionClick: OnActionClickFn<T>,
  permissions: KeyActionPermissions,
  onStatusChange: (newStatus: any, row: T) => PromiseLike<boolean | undefined>,
  showUsername = false,
): VxeTableGridColumns {
  const actionCount = [
    permissions.delete,
    permissions.detail,
    permissions.interface,
    permissions.ipWhitelist,
  ].filter(Boolean).length;
  return [
    {
      field: 'id',
      title: 'ID',
      width: 90,
    },
    {
      field: 'name',
      minWidth: 170,
      title: $t('system.key.name'),
    },
    ...(showUsername
      ? [
          {
            field: 'username',
            minWidth: 160,
            title: $t('system.key.username'),
          },
        ]
      : []),
    {
      cellRender: {
        name: 'CellTag',
        options: [
          {
            color: 'processing',
            label: $t('system.key.scopeInterface'),
            value: 'INTERFACE',
          },
          {
            color: 'success',
            label: $t('system.key.scopeGlobal'),
            value: 'GLOBAL',
          },
        ],
      },
      field: 'keyScope',
      title: $t('system.key.keyScope'),
      width: 120,
    },
    {
      field: 'interfaceName',
      minWidth: 180,
      title: $t('system.key.interfaceName'),
    },
    {
      field: 'secretKey',
      minWidth: 360,
      slots: { default: 'secretKey' },
      title: $t('system.key.secretKey'),
    },
    {
      field: 'openUrl',
      formatter: () => buildOpenUrl(),
      minWidth: 320,
      title: $t('system.key.openUrl'),
    },
    {
      field: 'authHeader',
      formatter: () => 'X-API-Key: <your key>',
      minWidth: 250,
      title: $t('system.key.authHeader'),
    },
    {
      field: 'ipWhitelist',
      formatter: ({ row }) => buildWhitelistPreview(row as KeyApi.KeyItem),
      minWidth: 240,
      title: $t('system.key.ipWhitelist'),
    },
    {
      cellRender: {
        ...(permissions.status
          ? { attrs: { beforeChange: onStatusChange }, name: 'CellSwitch' }
          : {
              name: 'CellTag',
              options: [
                { color: 'success', label: $t('common.enabled'), value: 1 },
                { color: 'default', label: $t('common.disabled'), value: 0 },
              ],
            }),
      },
      field: 'status',
      title: $t('system.key.status'),
      width: 100,
    },
    {
      field: 'lastUsedAt',
      title: $t('system.key.lastUsedAt'),
      width: 180,
    },
    {
      field: 'expiresAt',
      formatter: ({ cellValue }) => cellValue || $t('system.key.neverExpires'),
      title: $t('system.key.expiresAt'),
      width: 180,
    },
    {
      field: 'createTime',
      title: $t('system.key.createTime'),
      width: 180,
    },
    ...(actionCount > 0
      ? [
          {
            align: 'center' as const,
            cellRender: {
              attrs: {
                nameField: 'name',
                nameTitle: $t('system.key.name'),
                onClick: onActionClick,
              },
              name: 'CellOperation',
              options: [
                {
                  code: 'detail',
                  show: permissions.detail,
                  text: $t('system.key.detail'),
                },
                {
                  code: 'interfaces',
                  show: permissions.interface,
                  text: $t('system.key.interfaceName'),
                },
                {
                  code: 'ipWhitelist',
                  show: permissions.ipWhitelist,
                  text: $t('system.key.ipWhitelistManage'),
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
            title: $t('system.key.operation'),
            width: Math.max(120, actionCount * 76),
          },
        ]
      : []),
  ];
}
