import { describe, expect, it, vi } from 'vitest';

vi.mock('#/api/package', () => ({
  getPackageInterfaceOptions: vi.fn(async () => []),
}));

import { useColumns as useGlobalColumns } from './global/data';
import { useColumns as useInterfaceColumns } from './interface/data';
import { useColumns as usePointColumns } from './point/data';

const columnFactories = [
  useGlobalColumns,
  useInterfaceColumns,
  usePointColumns,
];

describe('package management permissions', () => {
  it.each(columnFactories)(
    'removes operations when update and delete are not granted',
    (useColumns) => {
      const columns =
        useColumns(vi.fn(), { delete: false, grant: false, update: false }) ??
        [];
      expect(columns.some((column) => column?.field === 'operation')).toBe(false);
    },
  );

  it.each(columnFactories)(
    'shows only the explicitly granted operation',
    (useColumns) => {
      const columns =
        useColumns(vi.fn(), { delete: false, grant: false, update: true }) ??
        [];
      const operation = columns.find((column) => column?.field === 'operation');
      const visible = ((operation as any)?.cellRender?.options ?? [])
        .filter((option: any) => option.show)
        .map((option: any) => option.code);
      expect(visible).toEqual(['edit']);
    },
  );
});
