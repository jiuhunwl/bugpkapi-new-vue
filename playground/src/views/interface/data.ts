import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridColumns } from '#/adapter/vxe-table';
import type { InterfaceApi } from '#/api/interface';

import { formatSettlementPrice } from '#/composables/use-settlement-currency';
import { $t } from '#/locales';

export const requestMethodOptions = [
  { label: 'GET', value: 'GET' },
  { label: 'POST', value: 'POST' },
  { label: 'GET/POST', value: 'GET_POST' },
];

export function pollingModeOptions() {
  return [
    { label: $t('interfaceSchema.polling.fastest'), value: 'FASTEST' },
    { label: $t('interfaceSchema.polling.roundRobin'), value: 'ROUND_ROBIN' },
    { label: $t('interfaceSchema.polling.primary'), value: 'PRIMARY' },
  ];
}

export function pollingModeText(mode?: InterfaceApi.PollingMode) {
  if (mode === 'FASTEST') return $t('interfaceSchema.polling.fastest');
  if (mode === 'PRIMARY') return $t('interfaceSchema.polling.primary');
  if (mode === 'RANDOM' || mode === 'ROUND_ROBIN') {
    return $t('interfaceSchema.polling.roundRobin');
  }
  return $t('interfaceSchema.polling.single');
}

export const invokeMethodOptions = [
  { label: 'GET', value: 'GET' },
  { label: 'POST', value: 'POST' },
];

export const responseTypeOptions = [
  { label: 'JSON', value: 'JSON' },
  { label: 'TEXT', value: 'TEXT' },
  { label: 'XML', value: 'XML' },
  { label: 'HTML', value: 'HTML' },
  { label: 'FILE', value: 'FILE' },
  { label: 'SSE', value: 'SSE' },
];

export function preferredMethodOptions() {
  return [
    { label: $t('interfaceSchema.doc.followMethod'), value: '' },
    { label: 'GET', value: 'GET' },
    { label: 'POST', value: 'POST' },
  ];
}

export interface InterfaceActionPermissions {
  billing: boolean;
  degrade: boolean;
  delete: boolean;
  deliveryPolicy: boolean;
  doc: boolean;
  polling: boolean;
  quota: boolean;
  requestValidation: boolean;
  update: boolean;
}

export function useGridFormSchema(isAdmin = true): VbenFormSchema[] {
  const schema: VbenFormSchema[] = [
    {
      component: 'Input',
      fieldName: 'keyword',
      label: $t('system.interface.keyword'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: requestMethodOptions,
      },
      fieldName: 'requestMethod',
      label: $t('system.interface.requestMethod'),
    },
  ];
  if (isAdmin) {
    schema.push(
      {
        component: 'Select',
        componentProps: {
          allowClear: true,
          options: [
            { label: $t('system.interface.featuredAction'), value: 1 },
            { label: $t('system.interface.unfeaturedAction'), value: 0 },
          ],
        },
        fieldName: 'isFeatured',
        label: $t('system.interface.isFeatured'),
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
        label: $t('system.interface.status'),
      },
    );
  }
  return schema;
}

export function useFormSchema(
  avatarUploader?: (options: any) => Promise<any>,
): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('system.interface.name'),
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('system.interface.apiCodePlaceholder'),
      },
      fieldName: 'apiCode',
      label: $t('system.interface.apiCode'),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('system.interface.avatarUrlPlaceholder'),
      },
      fieldName: 'avatarUrl',
      label: $t('system.interface.avatarUrl'),
    },
    {
      component: 'Upload',
      componentProps: {
        accept: '.png,.jpg,.jpeg,.webp,.gif',
        customRequest: avatarUploader,
        disabled: !avatarUploader,
        listType: 'picture-card',
        maxCount: 1,
        maxSize: 2,
        multiple: false,
        showUploadList: true,
      },
      fieldName: 'avatarFile',
      label: $t('system.interface.avatarUpload'),
      renderComponentContent: () => ({
        default: () => $t('system.interface.uploadAvatar'),
      }),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('system.interface.requestUrlPlaceholder', ['{text}']),
      },
      description: $t('system.interface.requestUrlHelp', [
        '{text}',
        '{url}',
        '{phone}',
      ]),
      fieldName: 'requestUrl',
      label: $t('system.interface.requestUrl'),
      rules: 'required',
    },
    {
      component: 'Select',
      componentProps: {
        options: requestMethodOptions,
      },
      defaultValue: 'GET',
      fieldName: 'requestMethod',
      label: $t('system.interface.requestMethod'),
      rules: 'selectRequired',
    },
    {
      component: 'InputNumber',
      componentProps: {
        max: 1_000_000,
        min: -1,
        precision: 0,
      },
      defaultValue: 0,
      description: $t('system.interface.qpsLimitHelp'),
      fieldName: 'qpsLimit',
      label: $t('system.interface.userQpsLimit'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        max: 1_000_000,
        min: 0,
        precision: 0,
      },
      defaultValue: 0,
      description: $t('system.interface.sharedQpsLimitHelp'),
      fieldName: 'sharedQpsLimit',
      label: $t('system.interface.sharedQpsLimit'),
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
      fieldName: 'pollingEnabled',
      label: $t('interfaceSchema.polling.multiUpstream'),
    },
    {
      component: 'Select',
      componentProps: {
        options: pollingModeOptions(),
      },
      defaultValue: 'FASTEST',
      fieldName: 'pollingMode',
      label: $t('interfaceSchema.polling.mode'),
      rules: 'selectRequired',
    },
    {
      component: 'Textarea',
      componentProps: {
        placeholder:
          'https://node-a.example.com/api/{text}\nhttps://node-b.example.com/api/{text}',
        rows: 4,
      },
      description: $t('interfaceSchema.polling.upstreamHelp'),
      fieldName: 'upstreamUrlsText',
      label: $t('interfaceSchema.polling.upstreamNodes'),
    },
    {
      component: 'InputNumber',
      componentProps: {
        min: 0,
        precision: 4,
      },
      defaultValue: 0,
      fieldName: 'price',
      label: $t('system.interface.price'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        min: 0,
        precision: 0,
      },
      defaultValue: 0,
      fieldName: 'pointPrice',
      label: $t('system.interface.pointPrice'),
      rules: 'required',
    },
    {
      component: 'Switch',
      componentProps: {
        checkedChildren: $t('system.interface.topAction'),
        class: 'w-auto',
        unCheckedChildren: $t('system.interface.normalAction'),
      },
      defaultValue: false,
      fieldName: 'isTop',
      label: $t('system.interface.isTop'),
    },
    {
      component: 'Switch',
      componentProps: {
        checkedChildren: $t('system.interface.featuredAction'),
        class: 'w-auto',
        unCheckedChildren: $t('system.interface.unfeaturedAction'),
      },
      defaultValue: false,
      fieldName: 'isFeatured',
      label: $t('system.interface.isFeatured'),
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
      label: $t('system.interface.status'),
    },
    {
      component: 'Textarea',
      componentProps: {
        maxlength: 255,
        placeholder: $t('interfaceSchema.descriptionPlaceholder'),
        rows: 4,
        showCount: true,
      },
      fieldName: 'remark',
      label: $t('system.interface.remark'),
      rules: 'required',
    },
  ];
}

export function usePollingFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Switch',
      componentProps: {
        checkedChildren: $t('common.enabled'),
        class: 'w-auto',
        unCheckedChildren: $t('common.disabled'),
      },
      defaultValue: false,
      fieldName: 'pollingEnabled',
      label: $t('interfaceSchema.polling.enabled'),
    },
    {
      component: 'Select',
      componentProps: {
        options: pollingModeOptions(),
      },
      defaultValue: 'ROUND_ROBIN',
      fieldName: 'pollingMode',
      label: $t('interfaceSchema.polling.mode'),
      rules: 'selectRequired',
    },
  ];
}

export function useDocFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Textarea',
      componentProps: {
        placeholder: $t('interfaceSchema.doc.summaryPlaceholder'),
        rows: 3,
      },
      fieldName: 'docSummary',
      label: $t('interfaceSchema.doc.summary'),
    },
    {
      component: 'Select',
      componentProps: {
        options: responseTypeOptions,
      },
      defaultValue: 'JSON',
      fieldName: 'docResponseType',
      label: $t('interfaceSchema.doc.responseType'),
    },
    {
      component: 'Select',
      componentProps: {
        options: preferredMethodOptions(),
      },
      defaultValue: '',
      fieldName: 'docPreferredMethod',
      label: $t('interfaceSchema.doc.preferredMethod'),
    },
    {
      component: 'Textarea',
      componentProps: {
        placeholder:
          '[{"name":"url","type":"string","location":"Query","required":true,"description":"URL to process"}]',
        rows: 6,
      },
      description: $t('interfaceSchema.doc.requestParamsHelp'),
      fieldName: 'docRequestParams',
      label: $t('interfaceSchema.doc.requestParams'),
    },
    {
      component: 'Textarea',
      componentProps: {
        placeholder:
          '[{"name":"data.url","type":"string","description":"Returned URL"}]',
        rows: 5,
      },
      description: $t('interfaceSchema.doc.responseFieldsHelp'),
      fieldName: 'docResponseFields',
      label: $t('interfaceSchema.doc.responseFields'),
    },
    {
      component: 'Textarea',
      componentProps: {
        placeholder: '{"code":200,"msg":"ok","data":{}}',
        rows: 8,
      },
      description: $t('interfaceSchema.doc.responseExampleHelp'),
      fieldName: 'docResponseExample',
      label: $t('interfaceSchema.doc.responseExample'),
    },
    {
      component: 'Textarea',
      componentProps: {
        placeholder:
          '[{"code":200,"description":"Success"},{"code":401,"description":"Invalid API key"}]',
        rows: 5,
      },
      description: $t('interfaceSchema.doc.statusCodesHelp'),
      fieldName: 'docStatusCodes',
      label: $t('interfaceSchema.doc.statusCodes'),
    },
    {
      component: 'Textarea',
      componentProps: {
        placeholder: $t('interfaceSchema.doc.noticePlaceholder'),
        rows: 3,
      },
      fieldName: 'docNotice',
      label: $t('interfaceSchema.doc.notice'),
    },
  ];
}

export function useInvokeSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Select',
      componentProps: {
        options: invokeMethodOptions,
      },
      defaultValue: 'GET',
      fieldName: 'method',
      label: $t('system.interface.invokeMethod'),
      rules: 'selectRequired',
    },
    {
      component: 'Textarea',
      componentProps: {
        placeholder: '{"keyword":"test"}',
        rows: 5,
      },
      fieldName: 'queryParamsText',
      label: $t('system.interface.queryParams'),
    },
    {
      component: 'Textarea',
      componentProps: {
        placeholder: '{"name":"test"}',
        rows: 6,
      },
      fieldName: 'bodyText',
      label: $t('system.interface.bodyParams'),
    },
  ];
}

export function useColumns<T = InterfaceApi.InterfaceItem>(
  onActionClick: OnActionClickFn<T>,
  permissions: InterfaceActionPermissions,
): VxeTableGridColumns {
  const actionCount = Object.values(permissions).filter(Boolean).length;
  const selectionColumn =
    permissions.update || permissions.delete
      ? [{ type: 'checkbox' as const, width: 48 }]
      : [];
  return [
    ...selectionColumn,
    {
      field: 'id',
      title: 'ID',
      width: 90,
    },
    {
      field: 'name',
      minWidth: 180,
      title: $t('system.interface.name'),
    },
    {
      field: 'apiCode',
      minWidth: 160,
      title: $t('system.interface.apiCode'),
    },
    {
      cellRender: {
        attrs: {
          height: 36,
          width: 36,
        },
        name: 'CellImage',
      },
      field: 'avatarUrl',
      title: $t('system.interface.avatarUrl'),
      width: 90,
    },
    {
      field: 'requestUrl',
      minWidth: 280,
      title: $t('system.interface.requestUrl'),
    },
    {
      field: 'pollingEnabled',
      formatter: ({ row }) =>
        Number(row.pollingEnabled ?? 0) === 1
          ? pollingModeText(row.pollingMode)
          : $t('common.disabled'),
      title: $t('interfaceSchema.polling.status'),
      width: 120,
    },
    {
      field: 'currentNode',
      formatter: ({ row }) => {
        if (Number(row.pollingEnabled ?? 0) !== 1) return '-';
        const total = Number(row.upstreamCount ?? row.upstreamUrls?.length ?? 1);
        const node = Number(row.currentNode ?? 1);
        const url = row.currentNodeUrl ? ` ${row.currentNodeUrl}` : '';
        return `${node}/${total}${url}`;
      },
      minWidth: 260,
      title: $t('interfaceSchema.polling.currentNode'),
    },
    {
      cellRender: {
        name: 'CellTag',
        options: [
          { color: 'processing', label: 'GET', value: 'GET' },
          { color: 'success', label: 'POST', value: 'POST' },
          { color: 'warning', label: 'GET/POST', value: 'GET_POST' },
        ],
      },
      field: 'requestMethod',
      title: $t('system.interface.requestMethod'),
      width: 120,
    },
    {
      field: 'qpsLimit',
      formatter: ({ cellValue }) => {
        const limit = Number(cellValue ?? 0);
        if (limit === -1) return $t('system.interface.qpsBypass');
        return limit > 0
          ? String(limit)
          : $t('system.interface.qpsUnlimited');
      },
      title: $t('system.interface.userQpsLimit'),
      width: 120,
    },
    {
      field: 'sharedQpsLimit',
      formatter: ({ cellValue }) => {
        const limit = Number(cellValue ?? 0);
        return limit > 0
          ? String(limit)
          : $t('system.interface.qpsUnlimited');
      },
      title: $t('system.interface.sharedQpsLimit'),
      width: 120,
    },
    {
      field: 'price',
      formatter: ({ cellValue }) => formatSettlementPrice(cellValue, 4),
      title: $t('system.interface.price'),
      width: 120,
    },
    {
      field: 'pointPrice',
      formatter: ({ cellValue }) => Number(cellValue ?? 0).toLocaleString(),
      title: $t('system.interface.pointPrice'),
      width: 120,
    },
    {
      cellRender: {
        name: 'CellTag',
        options: [
          {
            color: 'processing',
            label: $t('system.interface.topAction'),
            value: 1,
          },
          {
            color: 'default',
            label: $t('system.interface.normalAction'),
            value: 0,
          },
        ],
      },
      field: 'isTop',
      title: $t('system.interface.isTop'),
      width: 90,
    },
    {
      cellRender: {
        name: 'CellTag',
        options: [
          {
            color: 'success',
            label: $t('system.interface.featuredAction'),
            value: 1,
          },
          {
            color: 'default',
            label: $t('system.interface.unfeaturedAction'),
            value: 0,
          },
        ],
      },
      field: 'isFeatured',
      title: $t('system.interface.isFeatured'),
      width: 100,
    },
    {
      cellRender: { name: 'CellTag' },
      field: 'status',
      title: $t('system.interface.status'),
      width: 100,
    },
    {
      field: 'remark',
      minWidth: 160,
      title: $t('system.interface.remark'),
    },
    {
      field: 'createTime',
      title: $t('system.interface.createTime'),
      width: 180,
    },
    ...(actionCount > 0
      ? [
          {
            align: 'center' as const,
            cellRender: {
              attrs: {
                // 常用操作留在行内，其余折叠进「更多」，避免操作列把表格撑出横向滚动。
                maxCount: 2,
                nameField: 'name',
                nameTitle: $t('system.interface.name'),
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
                  code: 'delete',
                  danger: true,
                  show: permissions.delete,
                  text: $t('common.delete'),
                },
                {
                  code: 'billingRule',
                  show: permissions.billing,
                  text: $t('system.interface.billingRule'),
                },
                {
                  code: 'polling',
                  show: permissions.polling,
                  text: $t('interfaceSchema.polling.action'),
                },
                {
                  code: 'quota',
                  show: permissions.quota,
                  text: $t('interfaceQuota.title'),
                },
                {
                  code: 'degrade',
                  show: permissions.degrade,
                  text: $t('interfaceDegrade.action'),
                },
                {
                  code: 'requestValidation',
                  show: permissions.requestValidation,
                  text: $t('requestValidation.action'),
                },
                {
                  code: 'doc',
                  show: permissions.doc,
                  text: $t('interfaceSchema.doc.action'),
                },
                {
                  code: 'deliveryPolicy',
                  show: permissions.deliveryPolicy,
                  text: $t('deliveryPolicy.title'),
                },
              ],
            },
            field: 'operation',
            fixed: 'right' as const,
            title: $t('system.interface.operation'),
            width: 160,
          },
        ]
      : []),
  ];
}
