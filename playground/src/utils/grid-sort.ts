export interface GridSortParams<T extends string> {
  sortBy?: T;
  sortOrder?: 'asc' | 'desc';
}

/**
 * 把 vxe-grid 的 remote sort 参数映射成后端白名单字段。
 * 只接受调用方给出的列映射，未知列/非法方向一律回退到“不传排序”，
 * 由后端使用默认排序，避免把任意字段拼进 SQL。
 */
export function readGridSort<T extends string>(
  sort: unknown,
  fields: Record<string, T | undefined>,
): GridSortParams<T> {
  const param = Array.isArray(sort) ? sort[0] : sort;
  const field =
    param && typeof param === 'object' && typeof param.field === 'string'
      ? fields[param.field]
      : undefined;
  if (!field) {
    return {};
  }
  return {
    sortBy: field,
    sortOrder: param.order === 'asc' ? 'asc' : 'desc',
  };
}
