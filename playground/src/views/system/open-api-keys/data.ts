import type { OnActionClickFn, VxeTableGridColumns } from '#/adapter/vxe-table';

import { $t } from '#/locales';
import { type OpenApiConsole } from '#/api/open-api';

const STATUS_ENABLED = 1;

function formatDateTime({ cellValue }: { cellValue?: string }) {
  if (!cellValue) return '—';
  return cellValue.replaceAll('T', ' ').slice(0, 19);
}

function scopeLabels({ cellValue }: { cellValue?: string[] }) {
  const scopes = cellValue ?? [];
  if (scopes.length === 0) return '—';
  return scopes.join(' · ');
}

/**
 * 密钥的展示态。status 是数据库原始值、不随到期翻转，只看它会把过期密钥显示成
 * 可用；到期与否由后端按鉴权链同源规则派生。
 */
export function keyState(row: OpenApiConsole.OpenAPIKey): {
  color: string;
  label: string;
} {
  if (Number(row.status) !== STATUS_ENABLED) {
    return { color: 'error', label: $t('system.openApi.keyStatusRevoked') };
  }
  if (row.expired) {
    return { color: 'warning', label: $t('system.openApi.keyStatusExpired') };
  }
  return { color: 'success', label: $t('system.openApi.keyStatusEnabled') };
}

export function buildColumns(
  onActionClick: OnActionClickFn<OpenApiConsole.OpenAPIKey>,
): VxeTableGridColumns<OpenApiConsole.OpenAPIKey> {
  return [
    {
      align: 'left',
      field: 'username',
      formatter: ({ cellValue }: { cellValue?: string }) =>
        cellValue || '—',
      minWidth: 130,
      title: $t('system.openApi.username'),
    },
    {
      align: 'left',
      cellRender: {
        name: 'CellTag',
        options: [
          {
            color: 'blue',
            label: $t('system.openApi.scopeAdmin'),
            value: true,
          },
          {
            color: 'cyan',
            label: $t('system.openApi.scopeNormal'),
            value: false,
          },
        ],
      },
      field: 'isAdminScope',
      minWidth: 96,
      title: $t('system.openApi.scope'),
    },
    {
      align: 'left',
      field: 'status',
      minWidth: 96,
      slots: { default: 'status' },
      title: $t('system.openApi.keyStatus'),
    },
    {
      align: 'left',
      field: 'name',
      minWidth: 140,
      title: $t('system.openApi.keyName'),
    },
    {
      align: 'left',
      field: 'maskedKey',
      minWidth: 200,
      title: $t('system.openApi.maskedKey'),
    },
    {
      align: 'left',
      field: 'scopes',
      formatter: scopeLabels,
      minWidth: 220,
      title: $t('system.openApi.scopes'),
    },
    {
      align: 'left',
      field: 'ipWhitelist',
      formatter: ({ cellValue }: { cellValue?: string[] }) =>
        (cellValue?.length ?? 0) > 0 ? cellValue!.join(', ') : '—',
      minWidth: 150,
      title: $t('system.openApi.ipWhitelist'),
    },
    {
      align: 'left',
      field: 'expiresAt',
      formatter: formatDateTime,
      minWidth: 160,
      title: $t('system.openApi.expiresAt'),
    },
    {
      align: 'left',
      field: 'lastUsedAt',
      formatter: formatDateTime,
      minWidth: 160,
      title: $t('system.openApi.lastUsedAt'),
    },
    {
      align: 'left',
      field: 'createTime',
      formatter: formatDateTime,
      minWidth: 160,
      title: $t('system.openApi.createTime'),
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: [
          {
            code: 'revoke',
            danger: true,
            show: (row: OpenApiConsole.OpenAPIKey) =>
              Number(row.status) === STATUS_ENABLED,
            text: $t('system.openApi.revoke'),
          },
        ],
      },
      field: 'operation',
      fixed: 'right',
      title: $t('system.openApi.operation'),
      width: 110,
    },
  ];
}
