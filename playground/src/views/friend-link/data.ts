import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridColumns } from '#/adapter/vxe-table';
import type { FriendLinkApi } from '#/api/friend-link';

import { $t } from '#/locales';

export interface FriendLinkActionPermissions {
  delete: boolean;
  status: boolean;
  update: boolean;
}

export const linkStatusOptions = () => [
  { label: $t('friendLinkAdmin.visible'), value: 1 },
  { label: $t('friendLinkAdmin.hidden'), value: 0 },
];

export function useLinkGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: { placeholder: $t('friendLinkAdmin.searchPlaceholder') },
      fieldName: 'keyword',
      label: $t('friendLinkAdmin.fields.keyword'),
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: linkStatusOptions() },
      fieldName: 'status',
      label: $t('friendLinkAdmin.fields.status'),
    },
  ];
}
export function useLinkFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: { maxlength: 80, showCount: true },
      fieldName: 'siteName',
      label: $t('friendLinkAdmin.fields.siteName'),
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: { placeholder: 'https://example.com' },
      fieldName: 'siteUrl',
      label: $t('friendLinkAdmin.fields.siteUrl'),
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: { placeholder: 'https://example.com/brand.svg' },
      fieldName: 'logoUrl',
      label: $t('friendLinkAdmin.fields.logo'),
    },
    {
      component: 'InputNumber',
      componentProps: { precision: 0 },
      defaultValue: 0,
      fieldName: 'sortNo',
      label: $t('friendLinkAdmin.fields.sort'),
    },
    {
      component: 'Switch',
      componentProps: {
        checkedChildren: $t('friendLinkAdmin.visible'),
        class: 'w-auto',
        unCheckedChildren: $t('friendLinkAdmin.hidden'),
      },
      defaultValue: true,
      fieldName: 'status',
      label: $t('friendLinkAdmin.fields.status'),
    },
    {
      component: 'Textarea',
      componentProps: { maxlength: 200, rows: 4, showCount: true },
      fieldName: 'description',
      label: $t('friendLinkAdmin.fields.description'),
    },
  ];
}
export function useLinkColumns<T = FriendLinkApi.FriendLinkItem>(
  onActionClick: OnActionClickFn<T>,
  permissions: FriendLinkActionPermissions,
): VxeTableGridColumns {
  return [
    { field: 'logoUrl', slots: { default: 'logo' }, title: 'Logo', width: 88 },
    {
      field: 'siteName',
      minWidth: 160,
      title: $t('friendLinkAdmin.fields.siteName'),
    },
    {
      field: 'siteUrl',
      minWidth: 260,
      slots: { default: 'siteUrl' },
      title: $t('friendLinkAdmin.fields.siteUrl'),
    },
    {
      field: 'description',
      minWidth: 220,
      title: $t('friendLinkAdmin.fields.description'),
    },
    {
      field: 'status',
      slots: { default: 'status' },
      title: $t('friendLinkAdmin.fields.status'),
      width: 100,
    },
    { field: 'sortNo', title: $t('friendLinkAdmin.fields.sort'), width: 90 },
    {
      field: 'applicantName',
      title: $t('friendLinkAdmin.fields.applicant'),
      width: 130,
    },
    {
      field: 'updateTime',
      title: $t('friendLinkAdmin.fields.updateTime'),
      width: 180,
    },
    ...(permissions.update || permissions.status || permissions.delete
      ? [
          {
            align: 'center' as const,
            cellRender: {
              attrs: {
                nameField: 'siteName',
                nameTitle: $t('friendLinkAdmin.entityName'),
                onClick: onActionClick,
              },
              name: 'CellOperation',
              options: [
                {
                  code: 'edit',
                  show: permissions.update,
                  text: $t('friendLinkAdmin.actions.edit'),
                },
                {
                  code: 'status',
                  show: permissions.status,
                  text: $t('friendLinkAdmin.actions.toggleStatus'),
                },
                {
                  code: 'delete',
                  danger: true,
                  show: permissions.delete,
                  text: $t('friendLinkAdmin.actions.delete'),
                },
              ],
            },
            field: 'operation',
            fixed: 'right' as const,
            title: $t('friendLinkAdmin.fields.actions'),
            width: 210,
          },
        ]
      : []),
  ];
}
export function useApplicationColumns(canReview: boolean): VxeTableGridColumns {
  return [
    {
      align: 'left',
      field: 'siteName',
      minWidth: 250,
      slots: { default: 'site' },
      title: $t('friendLinkAdmin.fields.siteName'),
    },
    {
      align: 'left',
      field: 'siteUrl',
      minWidth: 190,
      slots: { default: 'siteUrl' },
      title: $t('friendLinkAdmin.fields.siteUrl'),
    },
    {
      align: 'left',
      field: 'contactName',
      minWidth: 190,
      slots: { default: 'contact' },
      title: $t('friendLinkReview.reviewModal.contactInfo'),
    },
    {
      align: 'left',
      field: 'backlinkUrl',
      minWidth: 170,
      slots: { default: 'backlinkUrl' },
      title: $t('friendLinkAdmin.fields.backlink'),
    },
    {
      align: 'center',
      field: 'status',
      slots: { default: 'status' },
      title: $t('friendLinkAdmin.fields.status'),
      width: 176,
    },
    {
      align: 'left',
      field: 'createTime',
      title: $t('friendLinkAdmin.fields.applyTime'),
      width: 158,
    },
    ...(canReview
      ? [
          {
            align: 'center' as const,
            field: 'operation',
            fixed: 'right' as const,
            slots: { default: 'operation' },
            title: $t('friendLinkAdmin.fields.actions'),
            width: 150,
          },
        ]
      : []),
  ];
}
