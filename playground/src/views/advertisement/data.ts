import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridColumns } from '#/adapter/vxe-table';
import type { AdvertisementApi } from '#/api/advertisement';

import { $t } from '#/locales';

export interface AdvertisementActionPermissions {
  delete: boolean;
  update: boolean;
}

export const placementOptions = () => [
  { label: $t('advertisementAdmin.placements.home'), value: 'HOME' },
  { label: $t('advertisementAdmin.placements.console'), value: 'CONSOLE' },
  { label: $t('advertisementAdmin.placements.notice'), value: 'NOTICE' },
  {
    label: $t('advertisementAdmin.placements.serviceProvider'),
    value: 'SERVICE_PROVIDER',
  },
  {
    label: $t('advertisementAdmin.placements.apiResponse'),
    value: 'API_RESPONSE',
  },
];

export const targetOptions = () => [
  { label: $t('advertisementAdmin.targets.blank'), value: '_blank' },
  { label: $t('advertisementAdmin.targets.self'), value: '_self' },
];

export function placementText(placement: AdvertisementApi.Placement) {
  const option = placementOptions().find((item) => item.value === placement);
  return option?.label ?? placement;
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('advertisementAdmin.searchPlaceholder'),
      },
      fieldName: 'keyword',
      label: $t('advertisementAdmin.fields.keyword'),
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: placementOptions() },
      fieldName: 'placement',
      label: $t('advertisementAdmin.fields.placement'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: $t('advertisementAdmin.status.enabled'), value: 1 },
          { label: $t('advertisementAdmin.status.disabled'), value: 0 },
        ],
      },
      fieldName: 'status',
      label: $t('advertisementAdmin.fields.status'),
    },
  ];
}

/**
 * 列设计：开始/结束时间合并为一列「投放时间」，更新时间移出默认列，
 * 表格总宽从 ~1470px 压到 ~1050px，常规宽度下不再出现横向滚动。
 */
export function useColumns<T = AdvertisementApi.Advertisement>(
  onActionClick: OnActionClickFn<T>,
  permissions: AdvertisementActionPermissions,
): VxeTableGridColumns {
  const hasActions = permissions.update || permissions.delete;
  return [
    {
      field: 'imageUrl',
      slots: { default: 'image' },
      title: $t('advertisementAdmin.fields.imageUrl'),
      width: 92,
    },
    {
      field: 'name',
      minWidth: 150,
      title: $t('advertisementAdmin.fields.name'),
    },
    {
      field: 'title',
      minWidth: 170,
      title: $t('advertisementAdmin.fields.title'),
    },
    {
      field: 'placement',
      slots: { default: 'placement' },
      title: $t('advertisementAdmin.fields.placement'),
      width: 140,
    },
    {
      field: 'status',
      slots: { default: 'status' },
      title: $t('advertisementAdmin.fields.status'),
      width: 90,
    },
    {
      field: 'sortNo',
      title: $t('advertisementAdmin.fields.sortNo'),
      width: 70,
    },
    {
      field: 'schedule',
      formatter: ({ row }) => {
        const start: string = row.startTime || '';
        const end: string = row.endTime || '';
        if (!start && !end) return $t('advertisementAdmin.scheduleAlways');
        // 截到分钟，避免两段完整时间戳把列撑爆
        const short = (value: string) => value.slice(0, 16);
        return `${start ? short(start) : '—'} ~ ${end ? short(end) : '—'}`;
      },
      title: $t('advertisementAdmin.fields.schedule'),
      width: 230,
    },
    ...(hasActions
      ? [
          {
            align: 'center' as const,
            cellRender: {
              attrs: {
                nameField: 'name',
                nameTitle: $t('advertisementAdmin.entityName'),
                onClick: onActionClick,
              },
              name: 'CellOperation',
              options: [
                {
                  code: 'edit',
                  show: permissions.update,
                  text: $t('advertisementAdmin.actions.edit'),
                },
                {
                  code: 'delete',
                  danger: true,
                  show: permissions.delete,
                  text: $t('advertisementAdmin.actions.delete'),
                },
              ],
            },
            field: 'operation',
            fixed: 'right' as const,
            title: $t('advertisementAdmin.fields.actions'),
            width: 130,
          },
        ]
      : []),
  ];
}
