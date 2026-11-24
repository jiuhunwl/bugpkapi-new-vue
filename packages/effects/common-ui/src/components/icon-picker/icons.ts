import type { Recordable } from '@vben/types';

import { listIcons, listLocalIcons } from '@vben/icons';

/**
 * 一个缓存对象，在不刷新页面时，无需重复请求远程接口
 */
export const ICONS_MAP: Recordable<string[]> = {};

/**
 * 从项目离线图标注册表获取图标集数据。
 * 结果会被缓存，图标选择器不会向 Iconify/Unisvg 发起运行时请求。
 * @param prefix 图标集名称
 * @returns 图标集中包含的所有图标名称
 */
export async function fetchIconsData(prefix: string): Promise<string[]> {
  if (Reflect.has(ICONS_MAP, prefix) && ICONS_MAP[prefix]) {
    return ICONS_MAP[prefix];
  }

  ICONS_MAP[prefix] = [
    ...new Set([...listLocalIcons(prefix), ...listIcons('', prefix)]),
  ].toSorted();
  return ICONS_MAP[prefix];
}
