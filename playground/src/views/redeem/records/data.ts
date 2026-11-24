import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { RedeemApi } from '#/api/redeem';

import { getTypeList } from '#/api/redeem';
import { formatSettlementPrice } from '#/composables/use-settlement-currency';
import { $t } from '#/locales';

async function fetchTypeOptions() {
  const result = await getTypeList({ page: 1, pageSize: 200 });
  return (result.items ?? []).map((item) => ({
    label: item.name,
    value: item.id,
  }));
}

export function recordSourceOptions() {
  return [
    { label: $t('system.redeem.code.sourcePage'), value: 1 },
    { label: $t('system.redeem.code.sourceApi'), value: 2 },
  ];
}

export function rewardTypeLabel(value: RedeemApi.RewardType) {
  switch (value) {
    case 1: {
      return $t('system.redeem.type.rewardTypePoints');
    }
    case 2: {
      return $t('system.redeem.type.rewardTypeBalance');
    }
    case 3: {
      return $t('system.redeem.type.rewardTypeGlobalPackage');
    }
    case 4: {
      return $t('system.redeem.type.rewardTypeInterfaceSpec');
    }
    default: {
      return $t('system.redeem.type.rewardTypeCombo');
    }
  }
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'keyword',
      label: $t('system.redeem.record.keyword'),
    },
    {
      component: 'ApiSelect',
      componentProps: {
        allowClear: true,
        api: fetchTypeOptions,
        class: 'w-full',
        dropdownStyle: { minWidth: '220px' },
        labelField: 'label',
        popupMatchSelectWidth: false,
        valueField: 'value',
      },
      fieldName: 'type_id',
      label: $t('system.redeem.record.type'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: recordSourceOptions(),
      },
      fieldName: 'source',
      label: $t('system.redeem.record.source'),
    },
  ];
}

export function useColumns(): VxeTableGridColumns<RedeemApi.Record> {
  return [
    {
      field: 'id',
      title: 'ID',
      width: 90,
    },
    {
      field: 'username',
      formatter: ({ cellValue }) => cellValue || '-',
      title: $t('system.redeem.record.username'),
      width: 140,
    },
    {
      field: 'codeMask',
      title: $t('system.redeem.record.codeMask'),
      width: 200,
    },
    {
      field: 'typeName',
      title: $t('system.redeem.record.typeName'),
      width: 160,
    },
    {
      field: 'rewardType',
      formatter: ({ cellValue }) => rewardTypeLabel(cellValue),
      title: $t('system.redeem.record.rewardType'),
      width: 120,
    },
    {
      field: 'rewardPoints',
      formatter: ({ cellValue }) => Number(cellValue ?? 0).toLocaleString(),
      title: $t('system.redeem.record.rewardPoints'),
      width: 110,
    },
    {
      field: 'rewardBalance',
      formatter: ({ cellValue }) => formatSettlementPrice(cellValue, 4),
      title: $t('system.redeem.record.rewardBalance'),
      width: 120,
    },
    {
      field: 'rewardName',
      formatter: ({ cellValue }) => cellValue || '-',
      title: $t('system.redeem.record.rewardName'),
      minWidth: 150,
    },
    {
      field: 'validDays',
      formatter: ({ row }) =>
        row.rewardType === 3 || row.rewardType === 4
          ? String(row.validDays ?? '-')
          : '-',
      title: $t('system.redeem.record.validDays'),
      width: 110,
    },
    {
      cellRender: { name: 'CellTag', options: recordSourceOptions() },
      field: 'source',
      title: $t('system.redeem.record.source'),
      width: 110,
    },
    {
      field: 'createTime',
      title: $t('system.redeem.record.createTime'),
      width: 180,
    },
  ];
}
