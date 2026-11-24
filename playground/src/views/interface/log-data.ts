import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { InterfaceApi } from '#/api/interface';
import type { RemoteOptionFetcher } from '#/components/remote-search-select';

import dayjs from 'dayjs';

import {
  searchInterfaceOptions,
  searchMarketInterfaceOptions,
} from '#/api/interface';
import { searchKeyOptions } from '#/api/key';
import { searchUserOptions } from '#/api/system/user';
import { formatSettlementPrice } from '#/composables/use-settlement-currency';
import { $t } from '#/locales';

import { pollingModeText } from './data';

export function callStatusOptions() {
  return [
    { label: $t('system.interface.callSuccess'), value: 1 },
    { label: $t('system.interface.callFailed'), value: 0 },
  ];
}

export function chargeTypeOptions() {
  return [
    {
      label: $t('system.interface.chargeGlobalPackage'),
      value: 'GLOBAL_PACKAGE',
    },
    {
      label: $t('system.interface.chargeInterfacePackage'),
      value: 'INTERFACE_PACKAGE',
    },
    { label: $t('system.interface.chargePoint'), value: 'POINTS' },
    { label: $t('system.interface.chargeBalance'), value: 'BALANCE' },
    { label: $t('system.interface.chargeFree'), value: 'FREE' },
    { label: $t('system.interface.chargeNoCharge'), value: 'NO_CHARGE' },
    { label: $t('system.interface.chargePending'), value: 'OPEN_PENDING' },
    { label: $t('system.interface.chargeAdmin'), value: 'ADMIN' },
    // Preserve filters for historical records created before the billing contract was finalized.
    { label: $t('system.interface.chargeMemberLegacy'), value: 'MEMBER' },
    { label: $t('system.interface.chargePointLegacy'), value: 'POINT' },
  ];
}

export function billingStatusOptions() {
  return [
    { label: $t('system.interface.billingConfirmed'), value: 'CONFIRMED' },
    { label: $t('system.interface.billingReserved'), value: 'RESERVED' },
    { label: $t('system.interface.billingReleased'), value: 'RELEASED' },
    { label: $t('system.interface.billingFailed'), value: 'FAILED' },
    { label: $t('system.interface.billingNoCharge'), value: 'NO_CHARGE' },
    { label: $t('system.interface.billingPending'), value: 'OPEN_PENDING' },
    { label: $t('system.interface.billingNone'), value: 'NONE' },
  ];
}

function interfaceOptionFetcher(isAdmin: boolean): RemoteOptionFetcher {
  return (keyword, signal) =>
    (isAdmin
      ? searchInterfaceOptions(keyword, signal)
      : searchMarketInterfaceOptions(keyword, signal)
    ).then((items) =>
      items.map((item) => ({ label: item.label, value: item.id })),
    );
}

function keyOptionFetcher(isAdmin: boolean): RemoteOptionFetcher {
  return (keyword, signal) =>
    searchKeyOptions(isAdmin ? 'all' : 'mine', keyword, signal).then((items) =>
      items.map((item) => ({ label: item.label, value: item.id })),
    );
}

const userOptionFetcher: RemoteOptionFetcher = (keyword, signal) =>
  searchUserOptions(keyword, signal).then((items) =>
    items.map((item) => ({ label: item.label, value: item.id })),
  );

export function formatCallLogChargeAmount(
  item: Pick<
    InterfaceApi.UserCallLogItem,
    'chargeAmount' | 'chargeType' | 'pointPrice'
  >,
) {
  if (item.chargeType === 'POINT' || item.chargeType === 'POINTS') {
    return $t('interfaceSchema.log.pointsAmount', [
      callLogPointAmount(item).toLocaleString(),
    ]);
  }
  return formatSettlementPrice(item.chargeAmount, 4);
}

export function callLogPointAmount(
  item: Pick<InterfaceApi.UserCallLogItem, 'pointPrice'>,
) {
  return Number(item.pointPrice ?? 0);
}

export function useCallLogGridFormSchema(isAdmin = false): VbenFormSchema[] {
  const rangeEnd = dayjs();
  const adminFields: VbenFormSchema[] = isAdmin
    ? [
        {
          component: 'RemoteSearchSelect',
          componentProps: {
            debounceMs: 300,
            fetchOptions: userOptionFetcher,
            placeholder: $t('system.interface.remoteSearchPlaceholder'),
          },
          fieldName: 'userId',
          label: $t('system.interface.filterUserId'),
        },
      ]
    : [];
  const adminExactFields: VbenFormSchema[] = isAdmin
    ? [
        {
          component: 'Input',
          componentProps: {
            placeholder: $t('system.interface.remoteSearchExactPlaceholder'),
          },
          fieldName: 'clientIp',
          label: $t('system.interface.filterClientIp'),
        },
        {
          component: 'Input',
          componentProps: {
            placeholder: $t('system.interface.remoteSearchExactPlaceholder'),
          },
          fieldName: 'apiCode',
          label: $t('system.interface.filterApiCode'),
        },
      ]
    : [];
  return [
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('system.interface.callLogKeywordPlaceholder'),
      },
      fieldName: 'keyword',
      label: $t('system.interface.keyword'),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('system.interface.remoteSearchExactPlaceholder'),
        allowClear: true,
      },
      fieldName: 'traceId',
      label: $t('system.interface.filterTraceId'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: callStatusOptions(),
      },
      fieldName: 'success',
      label: $t('system.interface.callResult'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: chargeTypeOptions(),
      },
      fieldName: 'chargeType',
      label: $t('system.interface.chargeType'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: billingStatusOptions(),
      },
      fieldName: 'billingStatus',
      label: $t('system.interface.billingStatus'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: $t('common.yes'), value: 1 },
          { label: $t('common.no'), value: 0 },
        ],
      },
      fieldName: 'billable',
      label: $t('system.interface.billable'),
    },
    {
      component: 'RemoteSearchSelect',
      componentProps: {
        debounceMs: 300,
        fetchOptions: interfaceOptionFetcher(isAdmin),
        placeholder: $t('system.interface.remoteSearchPlaceholder'),
      },
      fieldName: 'interfaceId',
      label: $t('system.interface.filterInterfaceId'),
    },
    {
      component: 'RemoteSearchSelect',
      componentProps: {
        debounceMs: 300,
        fetchOptions: keyOptionFetcher(isAdmin),
        placeholder: $t('system.interface.remoteSearchPlaceholder'),
      },
      fieldName: 'apiKeyId',
      label: $t('system.interface.filterApiKeyId'),
    },
    ...adminExactFields,
    ...adminFields,
    {
      component: 'Input',
      fieldName: 'region',
      label: $t('system.interface.clientRegion'),
    },
    {
      component: 'InputNumber',
      componentProps: { min: 0, precision: 0 },
      fieldName: 'minElapsedMs',
      label: $t('system.interface.minElapsedMs'),
    },
    {
      component: 'InputNumber',
      componentProps: { min: 0, precision: 0 },
      fieldName: 'maxElapsedMs',
      label: $t('system.interface.maxElapsedMs'),
    },
    {
      component: 'RangePicker',
      componentProps: {
        showTime: true,
        valueFormat: 'YYYY-MM-DD HH:mm:ss',
      },
      defaultValue: [
        rangeEnd.subtract(24, 'hour').format('YYYY-MM-DD HH:mm:ss'),
        rangeEnd.format('YYYY-MM-DD HH:mm:ss'),
      ],
      fieldName: 'timeRange',
      label: $t('system.interface.callTimeRange'),
    },
  ];
}

/**
 * 后台“计费记录”菜单与“调用日志”复用同一个页面组件。只有计费记录视图需要
 * 追加 billingOnly 过滤，以便跟随接口的计费总开关与计费日志开关。
 */
export function isBillingRecordsRoute(route: {
  name?: unknown;
  path?: string;
}): boolean {
  return (
    route.name === 'BillingRecordList' ||
    (route.path ?? '').includes('/billing-records')
  );
}

export function normalizeCallLogFilters(
  values: InterfaceApi.CallLogListParams,
): InterfaceApi.CallLogListParams {
  const { timeRange, ...filters } = values;
  const [startTime, endTime] = Array.isArray(timeRange) ? timeRange : [];
  // Vben can represent an untouched field as missing, undefined or null.
  // Keep their wire-equivalent filters identical so paging retains its cursor.
  return Object.fromEntries(
    Object.entries({ ...filters, endTime, startTime }).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  );
}

export function useCallLogColumns(
  isAdmin: boolean,
  showActions = true,
): VxeTableGridColumns<InterfaceApi.CallLogViewItem> {
  const adminColumns = isAdmin
    ? [
        {
          field: 'username',
          minWidth: 140,
          title: $t('system.interface.callUsername'),
        },
        {
          field: 'requestValue',
          minWidth: 260,
          title: $t('system.interface.linkOrValue'),
        },
        {
          field: 'clientIp',
          formatter: ({ cellValue }: any) => cellValue || '-',
          minWidth: 150,
          title: $t('system.interface.clientIp'),
        },
        {
          field: 'clientRegion',
          formatter: ({ cellValue }: any) => cellValue || '-',
          minWidth: 180,
          title: $t('system.interface.clientRegion'),
        },
        {
          field: 'userVisible',
          formatter: ({ cellValue }: any) =>
            cellValue === false || cellValue === 0
              ? $t('interfaceSchema.log.hidden')
              : $t('interfaceSchema.log.visible'),
          title: $t('interfaceSchema.log.visibility'),
          width: 110,
        },
        {
          field: 'upstreamUrl',
          formatter: ({ cellValue }: any) => cellValue || '-',
          minWidth: 260,
          title: $t('interfaceSchema.log.upstreamUrl'),
        },
        {
          field: 'upstreamSwitched',
          formatter: ({ cellValue }: any) =>
            cellValue === true || cellValue === 1
              ? $t('common.yes')
              : $t('common.no'),
          title: $t('interfaceSchema.log.switched'),
          width: 100,
        },
        {
          field: 'pollingMode',
          formatter: ({ cellValue }: any) =>
            pollingModeText(cellValue as InterfaceApi.PollingMode),
          title: $t('interfaceSchema.log.pollingMode'),
          width: 120,
        },
      ]
    : [];
  return [
    {
      field: 'interfaceName',
      minWidth: 200,
      align: 'left',
      title: $t('system.interface.usedInterface'),
    },
    {
      field: 'traceId',
      minWidth: 330,
      align: 'left',
      title: $t('system.interface.traceId'),
      slots: { default: 'traceId' },
    },
    {
      cellRender: {
        name: 'CellTag',
        options: [
          { color: 'processing', label: 'GET', value: 'GET' },
          { color: 'success', label: 'POST', value: 'POST' },
        ],
      },
      field: 'requestMethod',
      title: $t('system.interface.requestMethod'),
      width: 110,
    },
    {
      field: 'responseStatus',
      title: $t('system.interface.statusCode'),
      width: 110,
    },
    {
      field: 'createTime',
      title: $t('system.interface.createTime'),
      width: 180,
    },

    {
      field: 'elapsedMs',
      formatter: ({ cellValue }) => `${Number(cellValue ?? 0)} ms`,
      title: $t('system.interface.elapsedMs'),
      width: 110,
    },
    {
      field: 'success',
      slots: { default: 'success' },
      title: $t('system.interface.callResult'),
      width: 110,
    },
    {
      field: 'chargeType',
      slots: { default: 'chargeType' },
      title: $t('system.interface.chargeType'),
      width: 130,
    },
    {
      field: 'chargeAmount',
      formatter: ({ row }) => formatCallLogChargeAmount(row),
      title: $t('system.interface.chargeAmount'),
      width: 120,
    },
    ...adminColumns,
    {
      field: 'errorMessage',
      minWidth: 180,
      title: $t('system.interface.errorMessage'),
    },
    ...(showActions
      ? [
          {
            field: 'action',
            fixed: 'right' as const,
            slots: { default: 'action' },
            title: $t('system.interface.action'),
            width: 92,
          },
        ]
      : []),
  ];
}
