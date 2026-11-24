import type { AdminAccessLocation } from '#/api/core/user';
import type { ECharts, EChartsOption } from 'echarts';

import {
  ADMIN_ACCESS_MAP_REGISTRATIONS,
  buildChina2DOption,
  buildGlobe3DOption,
  buildWorld2DOption,
} from './map-options';

export type AdminAccessEChartsMode =
  | 'china-2d'
  | 'globe-3d'
  | 'world-2d';

export interface CreateAdminAccessEChartsOptions {
  locations: readonly AdminAccessLocation[];
  metric?: 'calls' | 'failures';
  mode: AdminAccessEChartsMode;
}

let mapsRegistered = false;

export async function createAdminAccessECharts(
  container: HTMLElement | null,
  options: CreateAdminAccessEChartsOptions,
): Promise<ECharts> {
  if (!container) {
    throw new Error('Admin access ECharts container is required');
  }

  const echarts = await import('echarts');
  registerAdminAccessMaps(echarts);
  if (options.mode === 'globe-3d') {
    await import('echarts-gl');
  }

  echarts.getInstanceByDom(container)?.dispose();
  const chart = echarts.init(container, undefined, { renderer: 'canvas' });
  chart.setOption(buildOption(options) as EChartsOption, {
    lazyUpdate: false,
    notMerge: true,
  });
  return chart;
}

function registerAdminAccessMaps(echarts: typeof import('echarts')) {
  if (mapsRegistered) return;
  for (const registration of ADMIN_ACCESS_MAP_REGISTRATIONS) {
    echarts.registerMap(
      registration.name,
      registration.geoJSON as Parameters<typeof echarts.registerMap>[1],
    );
  }
  mapsRegistered = true;
}

function buildOption(options: CreateAdminAccessEChartsOptions) {
  const metric = options.metric ?? 'calls';
  if (options.mode === 'china-2d') {
    return buildChina2DOption(options.locations, metric);
  }
  if (options.mode === 'world-2d') {
    return buildWorld2DOption(options.locations, metric);
  }
  return buildGlobe3DOption(options.locations, metric);
}
