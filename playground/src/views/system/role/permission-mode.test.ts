import { describe, expect, it } from 'vitest';

import * as permissionMode from './permission-mode';

const { visibleRolePermissionIds } = permissionMode;

const rolePermissionTemplateIds = (
  permissionMode as typeof permissionMode & {
    rolePermissionTemplateIds?: (
      role: Parameters<typeof visibleRolePermissionIds>[0] | undefined,
    ) => string[];
  }
).rolePermissionTemplateIds;

describe('role permission mode', () => {
  it('uses effective permissions for the all-permissions administrator', () => {
    expect(
      visibleRolePermissionIds({
        effectivePermissions: [1, 2, 3],
        permissionMode: 'all',
        permissions: [1],
      }),
    ).toEqual(['1', '2', '3']);
  });

  it('uses assigned permissions for regular roles', () => {
    expect(
      visibleRolePermissionIds({
        effectivePermissions: [7],
        permissionMode: 'assigned',
        permissions: [7],
      }),
    ).toEqual(['7']);
  });

  it('normalizes assigned role permissions for use as a template', () => {
    expect(rolePermissionTemplateIds).toBeTypeOf('function');
    if (!rolePermissionTemplateIds)
      throw new Error('missing rolePermissionTemplateIds');

    expect(
      rolePermissionTemplateIds({
        effectivePermissions: [99],
        permissionMode: 'assigned',
        permissions: [7, '8', 7, 0, 'bad'],
      }),
    ).toEqual(['7', '8']);
  });

  it('uses effective permissions for an all-permissions template', () => {
    expect(rolePermissionTemplateIds).toBeTypeOf('function');
    if (!rolePermissionTemplateIds)
      throw new Error('missing rolePermissionTemplateIds');

    expect(
      rolePermissionTemplateIds({
        effectivePermissions: [11, '12', 11, 0, 'bad'],
        permissionMode: 'all',
        permissions: [99],
      }),
    ).toEqual(['11', '12']);
  });

  it('returns an empty template when no source role is selected', () => {
    expect(rolePermissionTemplateIds).toBeTypeOf('function');
    if (!rolePermissionTemplateIds)
      throw new Error('missing rolePermissionTemplateIds');

    expect(rolePermissionTemplateIds(undefined)).toEqual([]);
  });

  it('preserves assigned relationships when saving the administrator role', () => {
    const rolePermissionPayload = (
      permissionMode as typeof permissionMode & {
        rolePermissionPayload?: (
          role: Parameters<typeof visibleRolePermissionIds>[0] | undefined,
          selectedPermissions: unknown,
        ) => number[];
      }
    ).rolePermissionPayload;
    expect(rolePermissionPayload).toBeTypeOf('function');
    if (!rolePermissionPayload)
      throw new Error('missing rolePermissionPayload');

    expect(
      rolePermissionPayload(
        {
          effectivePermissions: [1, 2, 3],
          permissionMode: 'all',
          permissions: [99],
        },
        ['1', '2', '3'],
      ),
    ).toEqual([99]);
  });

  it('normalizes editable permission IDs to unique positive integers', () => {
    const rolePermissionPayload = (
      permissionMode as typeof permissionMode & {
        rolePermissionPayload?: (
          role: Parameters<typeof visibleRolePermissionIds>[0] | undefined,
          selectedPermissions: unknown,
        ) => number[];
      }
    ).rolePermissionPayload;
    expect(rolePermissionPayload).toBeTypeOf('function');
    if (!rolePermissionPayload)
      throw new Error('missing rolePermissionPayload');

    expect(
      rolePermissionPayload(undefined, ['7', 8, '7', 0, -1, 'bad']),
    ).toEqual([7, 8]);
  });
});
