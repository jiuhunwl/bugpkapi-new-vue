import type { PackageApi } from '#/api/package';

import { $t } from '#/locales';

/** 管理端列表展示套餐允许的用户组与可见性。 */
export function packageRoleText(row?: PackageApi.PackageRoleLimit): string {
  if (Number(row?.roleRestricted ?? 0) !== 1) {
    return $t('system.package.roleUnlimited');
  }
  const names = Array.isArray(row?.roleNames)
    ? row.roleNames.filter(Boolean)
    : [];
  const label =
    names.length > 0
      ? names.join('、')
      : $t('system.package.roleGroupEmpty');
  return Number(row?.roleVisibleOnly ?? 0) === 1
    ? $t('system.package.roleGroupVisibleOnlyText', [label])
    : label;
}
