import { describe, expect, it, vi } from 'vitest';

vi.mock('#/api/system/role', () => ({
  getRoleList: vi.fn(async () => ({ items: [], total: 0 })),
}));

import { useColumns as useMenuColumns } from './menu/data';
import { useColumns as useRoleColumns } from './role/data';
import { useColumns as useUserColumns } from './user/data';

describe('system management permissions', () => {
  it('removes menu operations for list-only roles', () => {
    const columns =
      useMenuColumns(vi.fn(), {
        create: false,
        delete: false,
        update: false,
      }) ?? [];
    expect(columns.some((column) => column?.field === 'operation')).toBe(false);
  });

  it('separates menu create, update, and delete actions', () => {
    const columns =
      useMenuColumns(vi.fn(), {
        create: true,
        delete: false,
        update: true,
      }) ?? [];
    const operation = columns.find((column) => column?.field === 'operation');
    const visible = ((operation as any)?.cellRender?.options ?? [])
      .filter((option: any) => option.show)
      .map((option: any) => option.code);
    expect(visible).toEqual(['append', 'edit']);
  });

  it('uses a read-only role status without update permission', () => {
    const columns =
      useRoleColumns(
        vi.fn(),
        { delete: false, update: false },
        vi.fn(),
      ) ?? [];
    const status = columns.find((column) => column?.field === 'status');
    expect((status as any)?.cellRender?.name).toBe('CellTag');
    expect(columns.some((column) => column?.field === 'operation')).toBe(false);
  });

  it('separates user update, specified-response, and delete actions', () => {
    const columns =
      useUserColumns(vi.fn(), {
        assetAdjust: false,
        delete: true,
        specifiedResponse: false,
        update: true,
      }) ?? [];
    const operation = columns.find((column) => column?.field === 'operation');
    const visible = ((operation as any)?.cellRender?.options ?? [])
      .filter((option: any) => option.show)
      .map((option: any) => option.code);
    expect(visible).toEqual(['edit', 'delete']);
  });
});
