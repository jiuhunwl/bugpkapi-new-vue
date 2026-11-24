import type { SystemRoleApi } from '#/api/system/role';

type RolePermissionView = Pick<
  SystemRoleApi.SystemRole,
  'effectivePermissions' | 'permissionMode' | 'permissions'
>;

export function visibleRolePermissionIds(role: RolePermissionView) {
  const values =
    role.permissionMode === 'all'
      ? role.effectivePermissions
      : role.permissions;
  return (values || []).map(String);
}

export function rolePermissionTemplateIds(
  role: RolePermissionView | undefined,
): string[] {
  if (!role) return [];

  const values =
    role.permissionMode === 'all'
      ? role.effectivePermissions
      : role.permissions;
  if (!Array.isArray(values)) return [];

  const ids = new Set<number>();
  for (const value of values) {
    const id = Number(value);
    if (Number.isSafeInteger(id) && id > 0) {
      ids.add(id);
    }
  }
  return [...ids].map(String);
}

export function rolePermissionPayload(
  role: RolePermissionView | undefined,
  selectedPermissions: unknown,
): number[] {
  const values =
    role?.permissionMode === 'all' ? role.permissions : selectedPermissions;
  if (!Array.isArray(values)) return [];

  const ids = new Set<number>();
  for (const value of values) {
    const id = Number(value);
    if (Number.isSafeInteger(id) && id > 0) {
      ids.add(id);
    }
  }
  return [...ids];
}
