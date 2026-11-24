import { describe, expect, it, vi } from 'vitest';

vi.mock('#/api/key', () => ({
  getKeyInterfaceOptions: vi.fn(async () => []),
}));

import { useColumns } from './data';

const none = {
  delete: false,
  detail: false,
  interface: false,
  ipWhitelist: false,
  status: false,
};

describe('API key management permissions', () => {
  it('removes the operation column when no action is granted', () => {
    const columns = useColumns(vi.fn(), none, vi.fn()) ?? [];
    expect(columns.some((column) => column?.field === 'operation')).toBe(false);
  });

  it('shows only actions granted by permission codes', () => {
    const columns = useColumns(
      vi.fn(),
      { ...none, interface: true },
      vi.fn(),
    ) ?? [];
    const operation = columns.find((column) => column?.field === 'operation');
    const visible = ((operation as any)?.cellRender?.options ?? [])
      .filter((option: any) => option.show)
      .map((option: any) => option.code);
    expect(visible).toEqual(['interfaces']);
  });

  it('renders a read-only status tag without status permission', () => {
    const columns = useColumns(vi.fn(), none, vi.fn()) ?? [];
    const status = columns.find((column) => column?.field === 'status');
    expect((status as any)?.cellRender?.name).toBe('CellTag');
    expect((status as any)?.cellRender?.attrs).toBeUndefined();
  });

  it('renders the status switch only with status permission', () => {
    const columns = useColumns(
      vi.fn(),
      { ...none, status: true },
      vi.fn(),
    ) ?? [];
    const status = columns.find((column) => column?.field === 'status');
    expect((status as any)?.cellRender?.name).toBe('CellSwitch');
    expect((status as any)?.cellRender?.attrs?.beforeChange).toBeTypeOf(
      'function',
    );
  });
});
