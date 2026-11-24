import type { ComputedRef, Ref } from 'vue';

import type { DatavGeoJSON } from './datav-geo-loader';

import { computed, ref, shallowReactive, shallowRef } from 'vue';

import { createDatavGeoLoader, type DatavGeoLoader } from './datav-geo-loader';
import { $t } from '#/locales';

/**
 * 下钻层级粒度（含省级）。
 */
export type DrilldownLevelGranularity = 'city' | 'district' | 'province';

/**
 * 下钻栈中的一个层级。
 */
export interface DrilldownLevel {
  /** 6 位国标行政区划码 */
  adcode: string;
  /** 展示名称（如"广东省"、"广州市"） */
  label: string;
  /** 粒度 */
  granularity: DrilldownLevelGranularity;
}

/**
 * 面包屑项。
 */
export interface BreadcrumbItem {
  /** adcode（"全国"根节点为空字符串） */
  adcode: string;
  /** 展示名称 */
  label: string;
  /** 粒度 */
  granularity: DrilldownLevelGranularity;
  /** 是否为最后一项（当前所在层级，不可点击） */
  isLast: boolean;
  /** 在 stack 中的索引（-1 表示根节点"全国"） */
  index: number;
}

/**
 * useDrilldown 返回值接口。
 */
export interface UseDrilldownReturn {
  /** 下钻栈（不含"全国"根节点） */
  stack: ComputedRef<DrilldownLevel[]>;
  /** 当前层级（栈顶），未下钻时为 null */
  current: ComputedRef<DrilldownLevel | null>;
  /** 下钻深度（0 = 省级全国视图） */
  depth: ComputedRef<number>;
  /** 面包屑列表（含"全国"根节点） */
  breadcrumb: ComputedRef<BreadcrumbItem[]>;
  /** 是否还能继续下钻（受最大深度限制） */
  canDrillDeeper: ComputedRef<boolean>;
  /** 当前加载的 GeoJSON 数据 */
  geoJSON: Ref<DatavGeoJSON | null>;
  /** 是否正在加载 GeoJSON */
  loading: ComputedRef<boolean>;
  /** 加载错误信息 */
  loadError: Ref<string | null>;
  /** 当前层级的粒度标签 */
  granularityLabel: ComputedRef<string>;
  /** 当前层级 adcode（省级视图时为空） */
  currentAdcode: ComputedRef<string>;
  /**
   * 进入下一层级。
   *
   * @param adcode 目标行政区 adcode
   * @param label 目标行政区名称
   * @param clickedGranularity 被点击区域的粒度（province / city / district）
   */
  enter: (
    adcode: string,
    label: string,
    clickedGranularity?: DrilldownLevelGranularity,
  ) => Promise<void>;
  /** 返回上一级 */
  back: () => void;
  /** 重置到省级全国视图 */
  reset: () => void;
  /** 序列化当前栈（用于 sessionStorage 记忆） */
  serialize: () => DrilldownLevel[];
  /** 从序列化数据恢复栈（含 GeoJSON 重载） */
  restoreFrom: (stack: DrilldownLevel[]) => void;
}

/**
 * 直辖市 adcode 集合（北京/上海/天津/重庆）。
 * 这些省级区域 enter 时直接跳到 district 层级，跳过 city。
 */
export const DIRECT_MUNICIPALITY_ADCODES = new Set([
  '110000', // 北京市
  '120000', // 天津市
  '310000', // 上海市
  '500000', // 重庆市
]);

/**
 * 海南省 —— 省直辖县级行政区混合，同样跳过 city 层。
 */
export const HAINAN_ADCODE = '460000';

/** 最大下钻深度：省级(0) → 市级(1) → 区县级(2) */
const MAX_DEPTH = 2;

/**
 * 根据被点击的粒度，计算下一层级粒度。
 * 直辖市 / 海南省从 province 直接到 district（跳过 city）。
 */
function nextGranularity(
  clickedGranularity: DrilldownLevelGranularity,
  adcode: string,
): DrilldownLevelGranularity {
  if (clickedGranularity === 'province') {
    // 直辖市或海南省 → 跳过 city 层
    if (DIRECT_MUNICIPALITY_ADCODES.has(adcode) || adcode === HAINAN_ADCODE) {
      return 'district';
    }
    return 'city';
  }
  if (clickedGranularity === 'city') {
    return 'district';
  }
  // district 已是最细粒度
  return 'district';
}

/**
 * 下钻状态机 composable。
 *
 * 管理 adcode 栈、层级切换、面包屑数据、GeoJSON 懒加载、ESC 键返回。
 *
 * @param loader 可选的自定义 GeoJSON 加载器（测试注入用）
 * @returns 下钻状态机接口
 */
export function useDrilldown(loader?: DatavGeoLoader): UseDrilldownReturn {
  const geoLoader = loader ?? createDatavGeoLoader();

  const stack = shallowReactive<DrilldownLevel[]>([]);
  const geoJSON = shallowRef<DatavGeoJSON | null>(null);
  const loadingFlag = ref(false);
  const loadError = ref<string | null>(null);

  const stackComputed = computed(() => [...stack]);
  const current = computed(() => stack[stack.length - 1] ?? null);
  const depth = computed(() => stack.length);
  const loading = computed(() => loadingFlag.value);

  const breadcrumb = computed<BreadcrumbItem[]>(() => {
    const items: BreadcrumbItem[] = [
      {
        adcode: '',
        granularity: 'province',
        index: -1,
        isLast: stack.length === 0,
        label: $t('adminAccess.drilldown.nationwide'),
      },
    ];
    for (let i = 0; i < stack.length; i++) {
      const level = stack[i]!;
      items.push({
        adcode: level.adcode,
        granularity: level.granularity,
        index: i,
        isLast: i === stack.length - 1,
        label: level.label,
      });
    }
    return items;
  });

  const canDrillDeeper = computed(() => depth.value < MAX_DEPTH);

  const granularityLabel = computed(() => {
    const level = current.value;
    if (!level) return $t('adminAccess.drilldown.province');
    if (level.granularity === 'city') return $t('adminAccess.drilldown.city');
    if (level.granularity === 'district') {
      return $t('adminAccess.drilldown.district');
    }
    return $t('adminAccess.drilldown.province');
  });

  const currentAdcode = computed(() => current.value?.adcode ?? '');

  async function loadGeoJSONForCurrent(): Promise<void> {
    const level = current.value;
    if (!level) {
      geoJSON.value = null;
      return;
    }
    loadingFlag.value = true;
    loadError.value = null;
    try {
      const result = await geoLoader.loadGeoJSON(level.adcode);
      geoJSON.value = result;
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === 'object' && error !== null && 'message' in error
            ? String((error as { message: unknown }).message)
            : $t('adminAccess.drilldown.loadFailed');
      loadError.value = message;
      geoJSON.value = null;
    } finally {
      loadingFlag.value = false;
    }
  }

  async function enter(
    adcode: string,
    label: string,
    clickedGranularity: DrilldownLevelGranularity = 'province',
  ): Promise<void> {
    // 最细层级不允许再下钻
    if (depth.value >= MAX_DEPTH) return;

    const next = nextGranularity(clickedGranularity, adcode);
    stack.push({ adcode: String(adcode), granularity: next, label });
    await loadGeoJSONForCurrent();
  }

  function back(): void {
    if (stack.length === 0) return;
    stack.pop();
    if (stack.length === 0) {
      geoJSON.value = null;
      loadError.value = null;
    } else {
      // 返回到上一层级，需要重新加载该层级的 GeoJSON
      void loadGeoJSONForCurrent();
    }
  }

  function reset(): void {
    stack.length = 0;
    geoJSON.value = null;
    loadError.value = null;
    loadingFlag.value = false;
  }

  function serialize(): DrilldownLevel[] {
    return stack.map((level) => ({ ...level }));
  }

  function restoreFrom(savedStack: DrilldownLevel[]): void {
    stack.length = 0;
    for (const level of savedStack) {
      stack.push({ ...level });
    }
    if (stack.length > 0) {
      void loadGeoJSONForCurrent();
    } else {
      geoJSON.value = null;
    }
  }

  return {
    back,
    breadcrumb,
    canDrillDeeper,
    current,
    currentAdcode,
    depth,
    enter,
    geoJSON,
    granularityLabel,
    loadError,
    loading,
    reset,
    restoreFrom,
    serialize,
    stack: stackComputed,
  };
}
