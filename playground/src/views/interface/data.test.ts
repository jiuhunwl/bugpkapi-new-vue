import { describe, expect, it, vi } from 'vitest';

import { useColumns, useFormSchema, useGridFormSchema } from './data';

const none = {
  billing: false,
  degrade: false,
  delete: false,
  deliveryPolicy: false,
  doc: false,
  polling: false,
  quota: false,
  requestValidation: false,
  update: false,
};

describe('interface management permissions', () => {
  it('removes management operations when no action permission is granted', () => {
    const columns = useColumns(vi.fn(), none) ?? [];
    expect(columns.some((column) => column?.field === 'operation')).toBe(false);
  });

  it('shows only operations granted by permission codes', () => {
    const columns = useColumns(vi.fn(), {
      ...none,
      doc: true,
      update: true,
    }) ?? [];
    const operation = columns.find((column) => column?.field === 'operation');
    const options = (operation as any)?.cellRender?.options ?? [];
    const visible = options
      .filter((option: any) => option.show)
      .map((option: any) => option.code);
    expect(visible).toEqual(['edit', 'doc']);
  });

  it('exposes delivery policy only with its dedicated permission', () => {
    const columns = useColumns(vi.fn(), {
      ...none,
      deliveryPolicy: true,
    }) ?? [];
    const operation = columns.find((column) => column?.field === 'operation');
    const visible = ((operation as any)?.cellRender?.options ?? [])
      .filter((option: any) => option.show)
      .map((option: any) => option.code);
    expect(visible).toEqual(['deliveryPolicy']);
  });

  it('exposes request validation only with its dedicated permission', () => {
    const columns = useColumns(vi.fn(), {
      ...none,
      requestValidation: true,
    }) ?? [];
    const operation = columns.find((column) => column?.field === 'operation');
    const visible = ((operation as any)?.cellRender?.options ?? [])
      .filter((option: any) => option.show)
      .map((option: any) => option.code);
    expect(visible).toEqual(['requestValidation']);
  });

  it('only exposes management-only filters to list permission holders', () => {
    const publicFields = useGridFormSchema(false).map((item) => item.fieldName);
    const managementFields = useGridFormSchema(true).map(
      (item) => item.fieldName,
    );
    expect(publicFields).not.toContain('status');
    expect(publicFields).not.toContain('isFeatured');
    expect(managementFields).toContain('status');
    expect(managementFields).toContain('isFeatured');
  });

  it('disables avatar upload unless an uploader is explicitly granted', () => {
    const withoutUpload = useFormSchema().find(
      (item) => item.fieldName === 'avatarFile',
    );
    const uploader = vi.fn();
    const withUpload = useFormSchema(uploader).find(
      (item) => item.fieldName === 'avatarFile',
    );
    expect((withoutUpload as any)?.componentProps?.customRequest).toBeUndefined();
    expect((withoutUpload as any)?.componentProps?.disabled).toBe(true);
    expect((withUpload as any)?.componentProps?.customRequest).toBe(uploader);
    expect((withUpload as any)?.componentProps?.disabled).toBe(false);
  });
});
