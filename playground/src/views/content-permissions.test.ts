import { describe, expect, it, vi } from 'vitest';

vi.mock('#/api/notice', () => ({
  uploadNoticeImage: vi.fn(),
}));

import { useApplicationColumns, useLinkColumns } from './friend-link/data';
import {
  useColumns as useNoticeColumns,
  useFormSchema as useNoticeFormSchema,
} from './notice/admin/data';

describe('content management permissions', () => {
  it('keeps notice preview while hiding ungranted management actions', () => {
    const columns =
      useNoticeColumns(vi.fn(), {
        delete: false,
        popup: false,
        status: false,
        top: false,
        update: false,
      }) ?? [];
    const operation = columns.find((column) => column?.field === 'operation');
    const visible = ((operation as any)?.cellRender?.options ?? [])
      .filter((option: any) => option.show)
      .map((option: any) => option.code);
    expect(visible).toEqual(['preview']);
  });

  it('separates each notice operation permission', () => {
    const columns =
      useNoticeColumns(vi.fn(), {
        delete: true,
        popup: false,
        status: true,
        top: false,
        update: true,
      }) ?? [];
    const operation = columns.find((column) => column?.field === 'operation');
    const visible = ((operation as any)?.cellRender?.options ?? [])
      .filter((option: any) => option.show)
      .map((option: any) => option.code);
    expect(visible).toEqual(['preview', 'edit', 'status', 'delete']);
  });

  it('removes friend-link operations without action permission', () => {
    const columns =
      useLinkColumns(vi.fn(), {
        delete: false,
        status: false,
        update: false,
      }) ?? [];
    expect(columns.some((column) => column?.field === 'operation')).toBe(false);
  });

  it('only exposes explicitly granted friend-link actions', () => {
    const columns =
      useLinkColumns(vi.fn(), {
        delete: false,
        status: true,
        update: false,
      }) ?? [];
    const operation = columns.find((column) => column?.field === 'operation');
    const visible = ((operation as any)?.cellRender?.options ?? [])
      .filter((option: any) => option.show)
      .map((option: any) => option.code);
    expect(visible).toEqual(['status']);
  });

  it('removes application review actions for list-only roles', () => {
    const columns = useApplicationColumns(false) ?? [];
    expect(columns.some((column) => column?.field === 'operation')).toBe(false);
  });

  it('renders application operations via a row-controlled slot', () => {
    const columns = useApplicationColumns(true) ?? [];
    const operation = columns.find((column) => column?.field === 'operation');
    expect(operation?.slots?.default).toBe('operation');
  });

  it('only injects the notice image uploader when permission is granted', () => {
    const withoutUpload = useNoticeFormSchema().find(
      (item) => item.fieldName === 'contentHtml',
    );
    const uploader = vi.fn();
    const withUpload = useNoticeFormSchema(uploader).find(
      (item) => item.fieldName === 'contentHtml',
    );
    expect((withoutUpload as any)?.componentProps?.imageUploader).toBeUndefined();
    expect((withUpload as any)?.componentProps?.imageUploader).toBe(uploader);
  });
});
