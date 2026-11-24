import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridColumns } from '#/adapter/vxe-table';
import type { SystemUserApi } from '#/api/system/user';

import { getRoleOptions } from '#/api/system/role';
import { formatSettlementPrice } from '#/composables/use-settlement-currency';
import { $t } from '#/locales';

export interface UserActionPermissions {
  assetAdjust: boolean;
  delete: boolean;
  specifiedResponse: boolean;
  update: boolean;
}

async function fetchRoleOptions() {
  const list = await getRoleOptions();
  // 后端角色 id 为字符串，用户 roleIds 为 number，统一转 number 保证下拉匹配
  return list.map((role: { [key: string]: any; id: number | string; }) => ({
    ...role,
    id: Number(role.id),
  }));
}

export { fetchRoleOptions };

function userStatusOptions() {
  return [
    { color: 'success', label: $t('system.user.statusNormal'), value: 1 },
    { color: 'error', label: $t('system.user.statusBanned'), value: 0 },
  ];
}

function userBanTypeOptions() {
  return [
    { label: $t('system.user.banTemporary'), value: 0 },
    { label: $t('system.user.banPermanent'), value: 1 },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'keyword',
      label: $t('system.user.keyword'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: userStatusOptions(),
      },
      fieldName: 'status',
      label: $t('system.user.status'),
    },
    {
      component: 'ApiSelect',
      componentProps: {
        allowClear: true,
        api: fetchRoleOptions,
        class: 'w-full',
        dropdownStyle: { minWidth: '220px' },
        labelField: 'name',
        popupMatchSelectWidth: false,
        valueField: 'id',
      },
      fieldName: 'roleId',
      label: $t('system.user.roles'),
    },
  ];
}

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'username',
      label: $t('system.user.username'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'realName',
      label: $t('system.user.realName'),
      rules: 'required',
    },
    {
      component: 'Input',
      dependencies: {
        show: false,
        triggerFields: ['id'],
      },
      fieldName: 'id',
      label: 'ID',
    },
    {
      component: 'Switch',
      defaultValue: false,
      dependencies: {
        show(values) {
          return !!values.id;
        },
        triggerFields: ['id'],
      },
      fieldName: 'changePassword',
      help: '\u4ec5\u5728\u9700\u8981\u91cd\u7f6e\u8be5\u7528\u6237\u5bc6\u7801\u65f6\u5f00\u542f\uff0c\u907f\u514d\u6d4f\u89c8\u5668\u81ea\u52a8\u586b\u5145\u5bfc\u81f4\u8bef\u6539\u5bc6\u7801\u3002',
      label: '\u4fee\u6539\u5bc6\u7801',
    },
    {
      component: 'InputPassword',
      componentProps: {
        autocomplete: 'new-password',
        autoComplete: 'new-password',
        placeholder: $t('system.user.passwordPlaceholder'),
      },
      dependencies: {
        required(values) {
          return !values.id || !!values.changePassword;
        },
        show(values) {
          return !values.id || !!values.changePassword;
        },
        triggerFields: ['id', 'changePassword'],
      },
      fieldName: 'password',
      label: $t('system.user.password'),
    },
    {
      component: 'ApiSelect',
      componentProps: {
        api: fetchRoleOptions,
        class: 'w-full',
        dropdownStyle: { minWidth: '220px' },
        labelField: 'name',
        mode: 'multiple',
        popupMatchSelectWidth: false,
        valueField: 'id',
      },
      fieldName: 'roleIds',
      label: $t('system.user.roles'),
      rules: 'selectRequired',
    },
    {
      component: 'ApiSelect',
      componentProps: {
        api: fetchRoleOptions,
        class: 'w-full',
        dropdownStyle: { minWidth: '220px' },
        labelField: 'name',
        popupMatchSelectWidth: false,
        valueField: 'id',
      },
      fieldName: 'primaryRoleId',
      help: $t('system.user.primaryRoleHelp'),
      label: $t('system.user.primaryRole'),
      rules: 'selectRequired',
    },
    {
      component: 'Input',
      fieldName: 'email',
      label: $t('system.user.email'),
    },
    {
      component: 'Input',
      fieldName: 'mobile',
      label: $t('system.user.mobile'),
    },
    {
      component: 'InputNumber',
      componentProps: {
        min: 0,
        precision: 4,
        style: 'width: 100%',
      },
      defaultValue: 0,
      dependencies: {
        show(values) {
          return !values.id;
        },
        triggerFields: ['id'],
      },
      fieldName: 'balance',
      label: $t('system.user.balance'),
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
      dependencies: {
        show(values) {
          return !values.id;
        },
        triggerFields: ['id'],
      },
      fieldName: 'points',
      label: $t('system.user.points'),
      rules: 'required',
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: userStatusOptions(),
        optionType: 'button',
      },
      defaultValue: 1,
      fieldName: 'status',
      label: $t('system.user.status'),
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: userBanTypeOptions(),
        optionType: 'button',
      },
      defaultValue: 0,
      dependencies: {
        show(values) {
          return values.status === 0;
        },
        triggerFields: ['status'],
      },
      fieldName: 'banPermanent',
      label: $t('system.user.banType'),
    },
    {
      component: 'DatePicker',
      componentProps: {
        showTime: true,
        style: 'width: 100%',
        valueFormat: 'YYYY-MM-DD HH:mm:ss',
      },
      dependencies: {
        required(values) {
          return values.status === 0 && values.banPermanent !== 1;
        },
        show(values) {
          return values.status === 0 && values.banPermanent !== 1;
        },
        triggerFields: ['status', 'banPermanent'],
      },
      fieldName: 'banUntil',
      label: $t('system.user.banUntil'),
      rules: 'required',
    },
    {
      component: 'Textarea',
      componentProps: {
        // 封禁原因只有用户看得到，写清主因即可；长句、内部台账名对用户没有意义。
        maxlength: 100,
        rows: 2,
        showCount: true,
        placeholder: $t('system.user.banReasonPlaceholder'),
      },
      dependencies: {
        required(values) {
          return values.status === 0;
        },
        show(values) {
          return values.status === 0;
        },
        triggerFields: ['status'],
      },
      fieldName: 'banReason',
      label: $t('system.user.banReason'),
      rules: 'required',
    },
  ];
}

export function useColumns<T = SystemUserApi.SystemUser>(
  onActionClick: OnActionClickFn<T>,
  permissions: UserActionPermissions,
): VxeTableGridColumns {
  return [
    {
      field: 'id',
      title: 'ID',
      width: 90,
    },
    {
      field: 'username',
      title: $t('system.user.username'),
      width: 160,
    },
    {
      field: 'realName',
      title: $t('system.user.realName'),
      width: 160,
    },
    {
      field: 'mobile',
      title: $t('system.user.mobile'),
      width: 160,
    },
    {
      field: 'email',
      minWidth: 180,
      title: $t('system.user.email'),
    },
    {
      field: 'roleNames',
      formatter: ({ cellValue, row }) => {
        const values =
          Array.isArray(cellValue) && cellValue.length > 0
            ? cellValue
            : row.roles;
        return Array.isArray(values) ? values.join('、') : values || '-';
      },
      title: $t('system.user.roles'),
      width: 180,
    },
    {
      field: 'primaryRoleId',
      formatter: ({ row }) => {
        const index = (row.roleIds ?? []).map(Number).indexOf(Number(row.primaryRoleId));
        return index >= 0 ? (row.roleNames?.[index] ?? row.roles?.[index] ?? '-') : '-';
      },
      title: $t('system.user.primaryRole'),
      width: 150,
    },
    {
      field: 'balance',
      formatter: ({ cellValue }) => formatSettlementPrice(cellValue, 4),
      title: $t('system.user.balance'),
      width: 120,
    },
    {
      field: 'points',
      formatter: ({ cellValue }) => Number(cellValue ?? 0).toLocaleString(),
      title: $t('system.user.points'),
      width: 120,
    },
    {
      field: 'totalRequests',
      formatter: ({ cellValue }) => Number(cellValue ?? 0).toLocaleString(),
      title: $t('system.user.totalRequests'),
      width: 140,
    },
    {
      cellRender: { name: 'CellTag', options: userStatusOptions() },
      field: 'status',
      title: $t('system.user.status'),
      width: 100,
    },
    {
      field: 'banUntil',
      formatter: ({ row }) => {
        if (row.status !== 0) return '-';
        return row.banPermanent === 1
          ? $t('system.user.banPermanent')
          : row.banUntil || '-';
      },
      title: $t('system.user.banUntil'),
      width: 180,
    },
    {
      field: 'banReason',
      formatter: ({ row }) => (row.status === 0 ? row.banReason || '-' : '-'),
      title: $t('system.user.banReason'),
      width: 220,
    },
    {
      field: 'lastLoginTime',
      title: $t('system.user.lastLoginTime'),
      width: 180,
    },
    {
      field: 'createTime',
      title: $t('system.user.createTime'),
      width: 180,
    },
    ...(permissions.update ||
    permissions.assetAdjust ||
    permissions.specifiedResponse ||
    permissions.delete
      ? [
          {
            align: 'center' as const,
            cellRender: {
              attrs: {
                nameField: 'username',
                nameTitle: $t('system.user.username'),
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
                  code: 'assetAdjust',
                  show: permissions.assetAdjust,
                  text: $t('system.user.assetAdjustAction'),
                },
                {
                  code: 'specifiedResponse',
                  show: permissions.specifiedResponse,
                  text: $t('system.user.specifiedResponseManage'),
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
            title: $t('system.user.operation'),
            width: 300,
          },
        ]
      : []),
  ];
}

export function useDescriptionItems(data?: SystemUserApi.SystemUser) {
  // VbenDescriptions 读的是 content 字段，写成 value 只会剩下列名、内容全空。
  return [
    { content: data?.id ?? '-', label: 'ID' },
    { content: data?.username ?? '-', label: $t('system.user.username') },
    { content: data?.realName ?? '-', label: $t('system.user.realName') },
    { content: data?.email ?? '-', label: $t('system.user.email') },
    { content: data?.mobile ?? '-', label: $t('system.user.mobile') },
    {
      content: Array.isArray(data?.roleNames)
        ? data.roleNames.join(', ')
        : Array.isArray(data?.roles)
          ? data.roles.join(', ')
          : (data?.roles ?? '-'),
      label: $t('system.user.roles'),
    },
    {
      content: (() => {
        const index = (data?.roleIds ?? [])
          .map(Number)
          .indexOf(Number(data?.primaryRoleId));
        return index >= 0
          ? (data?.roleNames?.[index] ?? data?.roles?.[index] ?? '-')
          : '-';
      })(),
      label: $t('system.user.primaryRole'),
    },
    {
      content: Number(data?.balance ?? 0).toFixed(4),
      label: $t('system.user.balance'),
    },
    {
      content: Number(data?.points ?? 0).toLocaleString(),
      label: $t('system.user.points'),
    },
    {
      content: Number(data?.totalRequests ?? 0).toLocaleString(),
      label: $t('system.user.totalRequests'),
    },
    {
      content:
        userStatusOptions().find((item) => item.value === data?.status)
          ?.label ?? '-',
      label: $t('system.user.status'),
    },
    {
      content:
        data?.status === 0
          ? data.banPermanent === 1
            ? $t('system.user.banPermanent')
            : (data.banUntil ?? '-')
          : '-',
      label: $t('system.user.banUntil'),
    },
    {
      content: data?.status === 0 ? (data.banReason ?? '-') : '-',
      label: $t('system.user.banReason'),
    },
    {
      content: data?.lastLoginTime ?? '-',
      label: $t('system.user.lastLoginTime'),
    },
    {
      content: data?.createTime ?? '-',
      label: $t('system.user.createTime'),
    },
  ];
}
