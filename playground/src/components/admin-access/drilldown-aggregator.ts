import type { AdminAccessLocation } from '#/api/core/user';

import { normalizeRegion } from './geo-utils';
import type { DrilldownLevel } from './useDrilldown';

/**
 * 聚合结果。
 */
export interface AggregateResult {
  /** key = normalizeRegion(featureName) */
  valuesByKey: Map<string, number>;
  /** 最大值（用于热区着色比例），至少 1 */
  max: number;
  /** 未匹配到任何 feature 的记录（归入"其他"） */
  unmatched: AdminAccessLocation[];
}

type Metric = 'calls' | 'failures';

/**
 * 计算单条记录在当前指标下的数值。
 */
function locationValue(location: AdminAccessLocation, metric: Metric): number {
  return metric === 'failures' ? location.failedCalls : location.callCount;
}

/**
 * 标准化为聚合 key（去掉省/市/区等后缀，转为小写）。
 */
function normalizeKey(value: unknown): string {
  return normalizeRegion(value)
    .replace(/(省|市|自治区|特别行政区|壮族|回族|维吾尔|地区|区|县|自治州|盟|新区)$/g, '')
    .replace(/(sheng|province|city|district|autonomousregion|municipality|specialadministrativeregion)$/g, '');
}

/**
 * 判断 location 是否属于指定省份（模糊匹配）。
 */
function matchProvince(
  location: AdminAccessLocation,
  provinceLabel: string,
): boolean {
  const normalizedProvince = normalizeKey(provinceLabel);
  const candidates = [
    location.province,
    location.region,
    location.city,
  ];
  return candidates.some(
    (value) => value && normalizeKey(value).includes(normalizedProvince),
  );
}

/**
 * 判断 location 是否属于指定城市（模糊匹配）。
 */
function matchCity(
  location: AdminAccessLocation,
  cityLabel: string,
): boolean {
  const normalizedCity = normalizeKey(cityLabel);
  const candidates = [
    location.city,
    location.region,
  ];
  return candidates.some(
    (value) => value && normalizeKey(value).includes(normalizedCity),
  );
}

/**
 * 按 adcode 链过滤 locations。
 *
 * stack 表示当前下钻路径（不含"全国"根节点），从省到市到区县逐级 AND 叠加。
 * - depth=1（省级）：过滤 province 匹配
 * - depth=2（市级）：过滤 province 匹配 AND city 匹配
 * - depth=3（区县级）：过滤 province 匹配 AND city 匹配 AND region 匹配
 */
export function filterByChain(
  locations: readonly AdminAccessLocation[],
  stack: readonly DrilldownLevel[],
): AdminAccessLocation[] {
  if (stack.length === 0) return [...locations];

  const provinceLevel = stack.find((level) => level.granularity === 'province');
  const cityLevel = stack.find((level) => level.granularity === 'city');

  return locations.filter((location) => {
    // 省级过滤
    if (provinceLevel && !matchProvince(location, provinceLevel.label)) {
      return false;
    }
    // 市级过滤
    if (cityLevel && !matchCity(location, cityLevel.label)) {
      return false;
    }
    return true;
  });
}

/**
 * 按市级聚合。
 *
 * 对属于 `provinceLabel` 的记录，按 `location.city`（或 region 兜底）分组，
 * 返回每个城市 key 对应的指标值之和。
 */
export function aggregateByCity(
  locations: readonly AdminAccessLocation[],
  provinceLabel: string,
  metric: Metric = 'calls',
): AggregateResult {
  const valuesByKey = new Map<string, number>();
  const unmatched: AdminAccessLocation[] = [];
  let max = 1;

  for (const location of locations) {
    if (!matchProvince(location, provinceLabel)) continue;
    const cityRaw = location.city || location.region || '';
    if (!cityRaw) {
      unmatched.push(location);
      continue;
    }
    const key = normalizeKey(cityRaw);
    if (!key) {
      unmatched.push(location);
      continue;
    }
    const value = locationValue(location, metric);
    const accumulated = (valuesByKey.get(key) ?? 0) + value;
    valuesByKey.set(key, accumulated);
    if (accumulated > max) max = accumulated;
  }

  return { max, unmatched, valuesByKey };
}

/**
 * 按区/县级聚合。
 *
 * 对属于 `cityLabel` 的记录，取 `location.region` 去掉省/市/区等后缀后的
 * 尾部区县名做 key，返回每个区县 key 对应的指标值之和。
 */
export function aggregateByDistrict(
  locations: readonly AdminAccessLocation[],
  cityLabel: string,
  metric: Metric = 'calls',
): AggregateResult {
  const valuesByKey = new Map<string, number>();
  const unmatched: AdminAccessLocation[] = [];
  let max = 1;

  for (const location of locations) {
    if (!matchCity(location, cityLabel)) continue;
    // 区县级优先从 region 取，去掉城市前缀后做 key
    const regionRaw = location.region || location.city || '';
    if (!regionRaw) {
      unmatched.push(location);
      continue;
    }
    // 去掉 city 前缀，取最后一段区县名
    const cleanedRegion = stripCityPrefix(regionRaw, cityLabel);
    const key = normalizeKey(cleanedRegion);
    if (!key) {
      unmatched.push(location);
      continue;
    }
    const value = locationValue(location, metric);
    const accumulated = (valuesByKey.get(key) ?? 0) + value;
    valuesByKey.set(key, accumulated);
    if (accumulated > max) max = accumulated;
  }

  return { max, unmatched, valuesByKey };
}

/**
 * 从 region 字符串中去掉城市名前缀，返回剩余区县名部分。
 *
 * 例如 region="广东省 广州市 天河区", city="广州市" → "天河区"
 * 如果 region 本身就是区县名（不含城市前缀），直接返回原值。
 */
function stripCityPrefix(region: string, city: string): string {
  const cleanedRegion = String(region ?? '').trim();
  const normalizedCity = normalizeKey(city);
  if (!normalizedCity) return cleanedRegion;
  // 尝试按空格/分隔符切分，取包含区县信息的最后一段
  const segments = cleanedRegion.split(/[\s,，。·/|>]+/).filter(Boolean);
  if (segments.length > 1) {
    // 取最后一段（通常是区县）
    const lastSegment = segments[segments.length - 1] ?? cleanedRegion;
    // 如果最后一段与城市名相同，取倒数第二段
    if (normalizeKey(lastSegment).includes(normalizedCity)) {
      return segments[segments.length - 2] ?? cleanedRegion;
    }
    return lastSegment;
  }
  return cleanedRegion;
}
