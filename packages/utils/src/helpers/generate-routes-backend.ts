import type { RouteRecordRaw } from 'vue-router';

import type {
  ComponentRecordType,
  GenerateMenuAndRoutesOptions,
  RouteRecordStringComponent,
} from '@vben-core/typings';

import { mapTree } from '@vben-core/shared/utils';

/**
 * 判断路由是否在菜单中显示但访问时展示 403（让用户知悉功能并申请权限）
 */
function menuHasVisibleWithForbidden(route: RouteRecordRaw): boolean {
  return !!route.meta?.menuVisibleWithForbidden;
}

/**
 * 动态生成路由 - 后端方式
 * 对 meta.menuVisibleWithForbidden 为 true 的项直接替换为 403 组件，让用户知悉功能并申请权限。
 */
async function generateRoutesByBackend(
  options: GenerateMenuAndRoutesOptions,
): Promise<RouteRecordRaw[]> {
  const {
    fetchMenuListAsync,
    layoutMap = {},
    pageMap = {},
    forbiddenComponent,
  } = options;

  try {
    const menuRoutes = await fetchMenuListAsync?.();
    if (!menuRoutes) {
      return [];
    }

    const normalizePageMap: ComponentRecordType = {};

    for (const [key, value] of Object.entries(pageMap)) {
      normalizePageMap[normalizeViewPath(key)] = value;
    }

    let routes = convertRoutes(menuRoutes, layoutMap, normalizePageMap);

    if (forbiddenComponent) {
      routes = mapTree(routes, (route) => {
        if (menuHasVisibleWithForbidden(route)) {
          route.component = forbiddenComponent;
        }
        return route;
      });
    }

    return routes;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

function convertRoutes(
  routes: RouteRecordStringComponent[],
  layoutMap: ComponentRecordType,
  pageMap: ComponentRecordType,
): RouteRecordRaw[] {
  return mapTree(routes, (node) => {
    const route = node as unknown as RouteRecordRaw;
    const { component, name } = node;

    if (!name) {
      console.error('route name is required', route);
    }

    // layout转换
    if (component && layoutMap[component]) {
      route.component = layoutMap[component];
      // 页面组件转换
    } else if (component) {
      const pageKey = resolvePageKey(component, pageMap);
      if (pageKey) {
        route.component = pageMap[pageKey];
      } else {
        const normalizePath = normalizeViewPath(component);
        const fallbackKey = normalizePath.endsWith('.vue')
          ? normalizePath
          : `${normalizePath}.vue`;
        console.error(`route component is invalid: ${fallbackKey}`, route);
        route.component = pageMap['/_core/fallback/not-found.vue'];
      }
    }

    return route;
  });
}

function normalizeViewPath(path: string): string {
  // 去除相对路径前缀
  const normalizedPath = path.replace(/^(\.\/|\.\.\/)+/, '');

  // 确保路径以 '/' 开头
  const viewPath = normalizedPath.startsWith('/')
    ? normalizedPath
    : `/${normalizedPath}`;

  // 这里耦合了vben-admin的目录结构
  return viewPath.replace(/^\/views/, '');
}

function resolvePageKey(
  component: string,
  pageMap: ComponentRecordType,
): string | undefined {
  const normalizePath = normalizeViewPath(component);
  const pageKey = normalizePath.endsWith('.vue')
    ? normalizePath
    : `${normalizePath}.vue`;
  const basePath = pageKey.replace(/\.vue$/, '');
  const candidates = [
    pageKey,
    `${basePath}/index.vue`,
    `${basePath}/list.vue`,
    ...getBackendComponentAliases(pageKey),
  ];

  return candidates.find((candidate) => pageMap[candidate]);
}

function getBackendComponentAliases(pageKey: string): string[] {
  const aliases: Record<string, string[]> = {
    '/dashboard-stats/admin.vue': ['/dashboard/workspace/index.vue'],
    '/dashboard-stats/user.vue': ['/dashboard/workspace/index.vue'],
    '/friend-links/admin/applications.vue': ['/friend-link/index.vue'],
    '/friend-links/admin/config.vue': ['/friend-link/index.vue'],
    '/friend-links/admin/list.vue': ['/friend-link/list.vue'],
    '/package/billing-records.vue': ['/interface/log.vue'],
    '/payment/orders.vue': ['/payment/order/index.vue'],
    '/payment/recharge-presets.vue': ['/payment/amount/index.vue'],
    '/site/admin/config.vue': ['/system/site/index.vue'],
  };

  return aliases[pageKey] ?? [];
}
export { generateRoutesByBackend };
