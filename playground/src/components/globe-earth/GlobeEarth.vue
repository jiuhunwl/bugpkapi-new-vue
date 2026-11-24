<script setup lang="ts">
import type { Object3D } from 'three';
import type { GlobeLocation, ResolvedMarker } from './globe-location';

import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  useTemplateRef,
  watch,
} from 'vue';

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { getGeoIP } from '#/api/system';
import { $t } from '#/locales';
import { resolveGlobeLocation } from './globe-location';

export interface GlobeHotspot {
  callCount?: number;
  failedCalls?: number;
  latitude: number | string;
  longitude: number | string;
  region: string;
  riskHits?: number;
  riskLevel?: 'CRITICAL' | 'HIGH' | 'LOW' | 'MEDIUM';
  successCalls?: number;
}

/**
 * GlobeEarth — 自研 Three.js 3D 地球组件。
 *
 * 特性：
 * - 本地程序化世界纹理 + 经纬网线（无 CDN 依赖，离线可用）
 * - 缓慢自转（拖拽时暂停，尊重 prefers-reduced-motion）
 * - 日光照耀 + 环境光 + 星空粒子
 * - OrbitControls 拖拽旋转 / 滚轮缩放（限制距离与倾角）
 * - 点击球面 → 射线检测 + 点击标记 + 经纬度 tooltip
 * - IP 定位联动：标记脉冲点 + 光柱 + 地区名称 Sprite 标签
 * - 移动端 reduced 模式（DPR 上限、几何分段、粒子数、材质简化）
 * - WebGL 不可用时降级为静态占位，不报错不白屏
 * - 组件销毁时释放全部 GPU 资源；页面隐藏时暂停渲染循环
 */

const props = withDefaults(
  defineProps<{
    /** 是否在挂载后自动调用 GET /system-api/geoip 定位 */
    autoLocate?: boolean;
    /** 缓慢自转（拖拽时暂停） */
    autoRotate?: boolean;
    /** 由父级预先获取的 IP 定位结果（提供后不再自动请求） */
    location?: GlobeLocation | null;
    /** 业务热点（调用量、风险等级等），用于首页/风控态势叠加 */
    hotspots?: GlobeHotspot[];
    /** 强制精简模式（移动端/低性能设备） */
    reduced?: boolean;
  }>(),
  {
    autoLocate: true,
    autoRotate: true,
    hotspots: () => [],
    location: null,
    reduced: false,
  },
);

const emit = defineEmits<{
  located: [marker: ResolvedMarker | null];
}>();

const root = useTemplateRef<HTMLDivElement>('root');

const renderUnavailable = ref(false);
const locating = ref(false);
const marker = ref<ResolvedMarker | null>(null);
const tooltip = ref<{
  content: string;
  visible: boolean;
  x: number;
  y: number;
}>({
  content: '',
  visible: false,
  x: 0,
  y: 0,
});
const markerPrecisionLabel = computed(() => {
  if (!marker.value)
    return locating.value ? $t('globeEarth.scanning') : $t('globeEarth.standby');
  switch (marker.value.precision) {
    case 'coordinates': {
      return $t('globeEarth.precisionCoordinates');
    }
    case 'city': {
      return $t('globeEarth.precisionCity');
    }
    case 'province': {
      return $t('globeEarth.precisionProvince');
    }
    default: {
      return $t('globeEarth.precisionCountry');
    }
  }
});
const accessibleLabel = computed(() =>
  marker.value
    ? $t('globeEarth.accessibleWithLocation', [
        marker.value.label,
        formatLatLon(marker.value.latitude, marker.value.longitude),
      ])
    : $t('globeEarth.accessibleNoLocation'),
);

const scene = shallowRef<THREE.Scene>();
const camera = shallowRef<THREE.PerspectiveCamera>();
const renderer = shallowRef<THREE.WebGLRenderer>();
const controls = shallowRef<OrbitControls>();
const earthGroup = shallowRef<THREE.Group>();
const earthMesh = shallowRef<THREE.Mesh>();
const wireframeGrid = shallowRef<THREE.LineSegments>();
const ipMarkerGroup = shallowRef<THREE.Group>();
const hotspotLayer = shallowRef<THREE.Group>();

let animationFrame = 0;
let resizeFrame = 0;
let resizeObserver: ResizeObserver | undefined;
let intersectionObserver: IntersectionObserver | undefined;
let clock: THREE.Clock | undefined;
let raycaster: THREE.Raycaster | undefined;
let isInteracting = false;
let isIntersecting = true;
let disposed = false;
let lastWidth = 0;
let lastHeight = 0;
let lastPixelRatio = 0;
let lastRenderTime = 0;
let tooltipTimer: number | undefined;
let lastHoverTime = 0;
let pointerDownX = 0;
let pointerDownY = 0;
let pointerDownTime = 0;
interface MarkerAnimation {
  kind: 'beam' | 'pulse' | 'ring';
  material: THREE.MeshBasicMaterial;
  mesh: THREE.Object3D;
  phase: number;
}

let ipMarkerAnims: MarkerAnimation[] = [];
let clickMarkerAnims: MarkerAnimation[] = [];
let hotspotMarkerAnims: MarkerAnimation[] = [];
let clickMarkerObjects: THREE.Object3D[] = [];
let trackedTextures = new Set<THREE.Texture>();
let motionQuery: MediaQueryList | undefined;
let focusAnimation:
  | {
      duration: number;
      from: THREE.Quaternion;
      startedAt: number;
      to: THREE.Quaternion;
    }
  | undefined;
let autoRotateResumeAt = 0;

const EARTH_RADIUS = 1;
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const CHINA_CENTER = { lat: 39.9, lng: 116.4, name: '中国' };
const reducedMotion = ref(false);
const HOTSPOT_COLORS = {
  CRITICAL: 0xef4444,
  HIGH: 0xf97316,
  LOW: 0x22c55e,
  MEDIUM: 0xeab308,
} as const;

type LonLat = readonly [longitude: number, latitude: number];

const LANDMASSES: readonly (readonly LonLat[])[] = [
  [
    [-168, 72], [-145, 70], [-125, 58], [-130, 49], [-123, 38],
    [-112, 29], [-100, 19], [-88, 20], [-81, 26], [-79, 35],
    [-69, 47], [-58, 53], [-63, 63], [-83, 69], [-108, 73], [-140, 75],
  ],
  [
    [-81, 12], [-70, 10], [-58, 4], [-48, -8], [-44, -22],
    [-52, -38], [-65, -56], [-73, -48], [-77, -28], [-79, -8],
  ],
  [
    [-11, 36], [2, 44], [17, 47], [31, 57], [48, 55], [65, 61],
    [88, 71], [120, 70], [154, 61], [178, 51], [159, 39], [139, 25],
    [124, 8], [105, 5], [94, 19], [78, 25], [66, 31], [53, 27],
    [43, 39], [30, 35], [20, 31], [10, 36],
  ],
  [
    [-18, 35], [4, 37], [22, 32], [38, 23], [48, 8], [42, -12],
    [30, -31], [18, -35], [4, -27], [-7, -8], [-15, 12],
  ],
  [
    [112, -10], [130, -11], [146, -18], [154, -31], [145, -43],
    [125, -38], [113, -25],
  ],
  [[-73, 60], [-46, 59], [-20, 70], [-35, 82], [-61, 80]],
  [[-180, -69], [-120, -72], [-60, -70], [0, -73], [60, -70], [120, -72], [180, -69]],
  [[130, 32], [142, 34], [146, 43], [139, 46], [133, 39]],
  [[95, 6], [108, 3], [119, -5], [113, -9], [101, -3]],
];

/* ------------------------------------------------------------------ */
/* 设备能力与精简模式                                                    */
/* ------------------------------------------------------------------ */

const isReduced = computed(() => {
  if (props.reduced) {
    return true;
  }
  if (typeof window === 'undefined') {
    return false;
  }
  return (
    window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768
  );
});

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      canvas.getContext('webgl2') || canvas.getContext('webgl'),
    );
  } catch {
    return false;
  }
}

function prefersReducedMotion() {
  return reducedMotion.value;
}

function onMotionPreferenceChange(event: MediaQueryListEvent) {
  reducedMotion.value = event.matches;
}

/* ------------------------------------------------------------------ */
/* 经纬度映射（国家 → 首都/中心，中国 → 省会，常用城市兜底）                */
/* ------------------------------------------------------------------ */

const COUNTRY_COORDS: Record<
  string,
  { lat: number; lng: number; name: string }
> = {
  china: { lat: 39.9, lng: 116.4, name: '中国' },
  usa: { lat: 40.7, lng: -74.0, name: '美国' },
  japan: { lat: 35.7, lng: 139.7, name: '日本' },
  'south-korea': { lat: 37.57, lng: 126.98, name: '韩国' },
  'north-korea': { lat: 39.03, lng: 125.75, name: '朝鲜' },
  singapore: { lat: 1.35, lng: 103.82, name: '新加坡' },
  uk: { lat: 51.51, lng: -0.13, name: '英国' },
  germany: { lat: 52.52, lng: 13.4, name: '德国' },
  france: { lat: 48.86, lng: 2.35, name: '法国' },
  russia: { lat: 55.75, lng: 37.62, name: '俄罗斯' },
  canada: { lat: 43.65, lng: -79.38, name: '加拿大' },
  australia: { lat: -33.87, lng: 151.21, name: '澳大利亚' },
  india: { lat: 28.6, lng: 77.2, name: '印度' },
  brazil: { lat: -23.55, lng: -46.63, name: '巴西' },
  netherlands: { lat: 52.37, lng: 4.9, name: '荷兰' },
  italy: { lat: 41.9, lng: 12.5, name: '意大利' },
  spain: { lat: 40.42, lng: -3.7, name: '西班牙' },
  thailand: { lat: 13.75, lng: 100.5, name: '泰国' },
  vietnam: { lat: 21.03, lng: 105.85, name: '越南' },
  malaysia: { lat: 3.14, lng: 101.69, name: '马来西亚' },
  indonesia: { lat: -6.21, lng: 106.85, name: '印度尼西亚' },
  philippines: { lat: 14.6, lng: 120.98, name: '菲律宾' },
  uae: { lat: 25.2, lng: 55.3, name: '阿联酋' },
  'saudi-arabia': { lat: 24.71, lng: 46.68, name: '沙特阿拉伯' },
  turkey: { lat: 39.93, lng: 32.86, name: '土耳其' },
  egypt: { lat: 30.04, lng: 31.24, name: '埃及' },
  'south-africa': { lat: -33.92, lng: 18.42, name: '南非' },
  mexico: { lat: 19.43, lng: -99.13, name: '墨西哥' },
  argentina: { lat: -34.6, lng: -58.38, name: '阿根廷' },
  'new-zealand': { lat: -36.85, lng: 174.76, name: '新西兰' },
  ireland: { lat: 53.35, lng: -6.26, name: '爱尔兰' },
  sweden: { lat: 59.33, lng: 18.07, name: '瑞典' },
  switzerland: { lat: 46.95, lng: 7.45, name: '瑞士' },
  poland: { lat: 52.23, lng: 21.01, name: '波兰' },
  ukraine: { lat: 50.45, lng: 30.52, name: '乌克兰' },
  'hong-kong': { lat: 22.32, lng: 114.17, name: '中国香港' },
  taiwan: { lat: 25.03, lng: 121.56, name: '中国台湾' },
  macau: { lat: 22.2, lng: 113.55, name: '中国澳门' },
};

const CHINA_PROVINCE_COORDS: Record<string, { lat: number; lng: number; name: string }> = {
  北京: { lat: 39.9, lng: 116.4, name: '北京' },
  上海: { lat: 31.23, lng: 121.47, name: '上海' },
  天津: { lat: 39.13, lng: 117.2, name: '天津' },
  重庆: { lat: 29.56, lng: 106.55, name: '重庆' },
  河北: { lat: 38.04, lng: 114.51, name: '河北' },
  山西: { lat: 37.87, lng: 112.55, name: '山西' },
  内蒙古: { lat: 40.84, lng: 111.75, name: '内蒙古' },
  辽宁: { lat: 41.8, lng: 123.43, name: '辽宁' },
  吉林: { lat: 43.9, lng: 125.32, name: '吉林' },
  黑龙江: { lat: 45.8, lng: 126.53, name: '黑龙江' },
  江苏: { lat: 32.06, lng: 118.8, name: '江苏' },
  浙江: { lat: 30.28, lng: 120.15, name: '浙江' },
  安徽: { lat: 31.86, lng: 117.28, name: '安徽' },
  福建: { lat: 26.08, lng: 119.3, name: '福建' },
  江西: { lat: 28.68, lng: 115.86, name: '江西' },
  山东: { lat: 36.65, lng: 117.0, name: '山东' },
  河南: { lat: 34.75, lng: 113.63, name: '河南' },
  湖北: { lat: 30.59, lng: 114.3, name: '湖北' },
  湖南: { lat: 28.23, lng: 112.94, name: '湖南' },
  广东: { lat: 23.13, lng: 113.26, name: '广东' },
  广西: { lat: 22.82, lng: 108.32, name: '广西' },
  海南: { lat: 20.03, lng: 110.32, name: '海南' },
  四川: { lat: 30.67, lng: 104.07, name: '四川' },
  贵州: { lat: 26.65, lng: 106.63, name: '贵州' },
  云南: { lat: 24.88, lng: 102.83, name: '云南' },
  西藏: { lat: 29.65, lng: 91.13, name: '西藏' },
  陕西: { lat: 34.34, lng: 108.94, name: '陕西' },
  甘肃: { lat: 36.06, lng: 103.83, name: '甘肃' },
  青海: { lat: 36.62, lng: 101.78, name: '青海' },
  宁夏: { lat: 38.49, lng: 106.23, name: '宁夏' },
  新疆: { lat: 43.82, lng: 87.62, name: '新疆' },
  新疆维吾尔: { lat: 43.82, lng: 87.62, name: '新疆' },
  广西壮族: { lat: 22.82, lng: 108.32, name: '广西' },
  宁夏回族: { lat: 38.49, lng: 106.23, name: '宁夏' },
  香港: { lat: 22.32, lng: 114.17, name: '香港' },
  澳门: { lat: 22.2, lng: 113.55, name: '澳门' },
  台湾: { lat: 25.03, lng: 121.56, name: '台湾' },
};

const STATE_COORDS: Record<string, { lat: number; lng: number; name: string }> = {
  california: { lat: 34.05, lng: -118.24, name: '加利福尼亚' },
  newyork: { lat: 40.71, lng: -74.01, name: '纽约州' },
  texas: { lat: 29.76, lng: -95.37, name: '得克萨斯' },
  washington: { lat: 47.61, lng: -122.33, name: '华盛顿州' },
  florida: { lat: 25.76, lng: -80.19, name: '佛罗里达' },
  illinois: { lat: 41.88, lng: -87.63, name: '伊利诺伊' },
  massachusetts: { lat: 42.36, lng: -71.06, name: '马萨诸塞' },
  ontario: { lat: 43.65, lng: -79.38, name: '安大略' },
  'british columbia': { lat: 49.28, lng: -123.12, name: '不列颠哥伦比亚' },
  'new south wales': { lat: -33.87, lng: 151.21, name: '新南威尔士' },
  victoria: { lat: -37.81, lng: 144.96, name: '维多利亚州' },
};

const CITY_COORDS: Record<string, { lat: number; lng: number; name: string }> = {
  北京: { lat: 39.9, lng: 116.4, name: '北京' },
  上海: { lat: 31.23, lng: 121.47, name: '上海' },
  广州: { lat: 23.13, lng: 113.26, name: '广州' },
  深圳: { lat: 22.54, lng: 114.06, name: '深圳' },
  杭州: { lat: 30.28, lng: 120.15, name: '杭州' },
  成都: { lat: 30.67, lng: 104.07, name: '成都' },
  武汉: { lat: 30.59, lng: 114.3, name: '武汉' },
  南京: { lat: 32.06, lng: 118.8, name: '南京' },
  西安: { lat: 34.34, lng: 108.94, name: '西安' },
  重庆: { lat: 29.56, lng: 106.55, name: '重庆' },
  天津: { lat: 39.13, lng: 117.2, name: '天津' },
  苏州: { lat: 31.3, lng: 120.62, name: '苏州' },
  长沙: { lat: 28.23, lng: 112.94, name: '长沙' },
  郑州: { lat: 34.75, lng: 113.63, name: '郑州' },
  沈阳: { lat: 41.8, lng: 123.43, name: '沈阳' },
  青岛: { lat: 36.07, lng: 120.38, name: '青岛' },
  香港: { lat: 22.32, lng: 114.17, name: '香港' },
  台北: { lat: 25.03, lng: 121.56, name: '台北' },
  纽约: { lat: 40.71, lng: -74.01, name: '纽约' },
  洛杉矶: { lat: 34.05, lng: -118.24, name: '洛杉矶' },
  旧金山: { lat: 37.77, lng: -122.42, name: '旧金山' },
  西雅图: { lat: 47.61, lng: -122.33, name: '西雅图' },
  芝加哥: { lat: 41.88, lng: -87.63, name: '芝加哥' },
  休斯顿: { lat: 29.76, lng: -95.37, name: '休斯顿' },
  伦敦: { lat: 51.51, lng: -0.13, name: '伦敦' },
  巴黎: { lat: 48.86, lng: 2.35, name: '巴黎' },
  柏林: { lat: 52.52, lng: 13.4, name: '柏林' },
  东京: { lat: 35.68, lng: 139.69, name: '东京' },
  大阪: { lat: 34.69, lng: 135.5, name: '大阪' },
  首尔: { lat: 37.57, lng: 126.98, name: '首尔' },
  新加坡: { lat: 1.35, lng: 103.82, name: '新加坡' },
  悉尼: { lat: -33.87, lng: 151.21, name: '悉尼' },
  墨尔本: { lat: -37.81, lng: 144.96, name: '墨尔本' },
  莫斯科: { lat: 55.75, lng: 37.62, name: '莫斯科' },
  迪拜: { lat: 25.2, lng: 55.3, name: '迪拜' },
  曼谷: { lat: 13.75, lng: 100.5, name: '曼谷' },
  多伦多: { lat: 43.65, lng: -79.38, name: '多伦多' },
  温哥华: { lat: 49.28, lng: -123.12, name: '温哥华' },
  圣保罗: { lat: -23.55, lng: -46.63, name: '圣保罗' },
  新德里: { lat: 28.61, lng: 77.21, name: '新德里' },
  孟买: { lat: 19.08, lng: 72.88, name: '孟买' },
  雅加达: { lat: -6.21, lng: 106.85, name: '雅加达' },
  吉隆坡: { lat: 3.14, lng: 101.69, name: '吉隆坡' },
  河内: { lat: 21.03, lng: 105.85, name: '河内' },
  马尼拉: { lat: 14.6, lng: 120.98, name: '马尼拉' },
  罗马: { lat: 41.9, lng: 12.5, name: '罗马' },
  阿姆斯特丹: { lat: 52.37, lng: 4.9, name: '阿姆斯特丹' },
  马德里: { lat: 40.42, lng: -3.7, name: '马德里' },
  beijing: { lat: 39.9, lng: 116.4, name: '北京' },
  shanghai: { lat: 31.23, lng: 121.47, name: '上海' },
  shenzhen: { lat: 22.54, lng: 114.06, name: '深圳' },
  guangzhou: { lat: 23.13, lng: 113.26, name: '广州' },
  hangzhou: { lat: 30.28, lng: 120.15, name: '杭州' },
  tokyo: { lat: 35.68, lng: 139.69, name: '东京' },
  osaka: { lat: 34.69, lng: 135.5, name: '大阪' },
  seoul: { lat: 37.57, lng: 126.98, name: '首尔' },
  singapore: { lat: 1.35, lng: 103.82, name: '新加坡' },
  'new york': { lat: 40.71, lng: -74.01, name: '纽约' },
  'los angeles': { lat: 34.05, lng: -118.24, name: '洛杉矶' },
  'san francisco': { lat: 37.77, lng: -122.42, name: '旧金山' },
  seattle: { lat: 47.61, lng: -122.33, name: '西雅图' },
  chicago: { lat: 41.88, lng: -87.63, name: '芝加哥' },
  houston: { lat: 29.76, lng: -95.37, name: '休斯顿' },
  london: { lat: 51.51, lng: -0.13, name: '伦敦' },
  paris: { lat: 48.86, lng: 2.35, name: '巴黎' },
  berlin: { lat: 52.52, lng: 13.4, name: '柏林' },
  sydney: { lat: -33.87, lng: 151.21, name: '悉尼' },
  melbourne: { lat: -37.81, lng: 144.96, name: '墨尔本' },
  moscow: { lat: 55.75, lng: 37.62, name: '莫斯科' },
  dubai: { lat: 25.2, lng: 55.3, name: '迪拜' },
  bangkok: { lat: 13.75, lng: 100.5, name: '曼谷' },
  toronto: { lat: 43.65, lng: -79.38, name: '多伦多' },
  vancouver: { lat: 49.28, lng: -123.12, name: '温哥华' },
  'hong kong': { lat: 22.32, lng: 114.17, name: '香港' },
  taipei: { lat: 25.03, lng: 121.56, name: '台北' },
  'new delhi': { lat: 28.61, lng: 77.21, name: '新德里' },
  jakarta: { lat: -6.21, lng: 106.85, name: '雅加达' },
  'kuala lumpur': { lat: 3.14, lng: 101.69, name: '吉隆坡' },
  manila: { lat: 14.6, lng: 120.98, name: '马尼拉' },
  rome: { lat: 41.9, lng: 12.5, name: '罗马' },
  madrid: { lat: 40.42, lng: -3.7, name: '马德里' },
};

const COUNTRY_ALIASES: Record<string, string> = {
  中国: 'china',
  中华人民共和国: 'china',
  china: 'china',
  cn: 'china',
  美国: 'usa',
  美利坚合众国: 'usa',
  'united states': 'usa',
  'united states of america': 'usa',
  usa: 'usa',
  us: 'usa',
  america: 'usa',
  日本: 'japan',
  japan: 'japan',
  jp: 'japan',
  韩国: 'south-korea',
  大韩民国: 'south-korea',
  'south korea': 'south-korea',
  korea: 'south-korea',
  kr: 'south-korea',
  朝鲜: 'north-korea',
  'north korea': 'north-korea',
  kp: 'north-korea',
  新加坡: 'singapore',
  singapore: 'singapore',
  sg: 'singapore',
  英国: 'uk',
  联合王国: 'uk',
  'united kingdom': 'uk',
  uk: 'uk',
  gb: 'uk',
  england: 'uk',
  英格兰: 'uk',
  德国: 'germany',
  德意志联邦共和国: 'germany',
  germany: 'germany',
  de: 'germany',
  法国: 'france',
  法兰西共和国: 'france',
  france: 'france',
  fr: 'france',
  俄罗斯: 'russia',
  俄罗斯联邦: 'russia',
  russia: 'russia',
  ru: 'russia',
  加拿大: 'canada',
  canada: 'canada',
  ca: 'canada',
  澳大利亚: 'australia',
  australia: 'australia',
  au: 'australia',
  印度: 'india',
  印度共和国: 'india',
  india: 'india',
  in: 'india',
  巴西: 'brazil',
  巴西联邦共和国: 'brazil',
  brazil: 'brazil',
  br: 'brazil',
  荷兰: 'netherlands',
  尼德兰: 'netherlands',
  netherlands: 'netherlands',
  nl: 'netherlands',
  holland: 'netherlands',
  意大利: 'italy',
  意大利共和国: 'italy',
  italy: 'italy',
  it: 'italy',
  西班牙: 'spain',
  西班牙王国: 'spain',
  spain: 'spain',
  es: 'spain',
  泰国: 'thailand',
  泰王国: 'thailand',
  thailand: 'thailand',
  th: 'thailand',
  越南: 'vietnam',
  越南社会主义共和国: 'vietnam',
  vietnam: 'vietnam',
  vn: 'vietnam',
  马来西亚: 'malaysia',
  马来西亚联邦: 'malaysia',
  malaysia: 'malaysia',
  my: 'malaysia',
  印度尼西亚: 'indonesia',
  印尼: 'indonesia',
  indonesia: 'indonesia',
  id: 'indonesia',
  菲律宾: 'philippines',
  菲律宾共和国: 'philippines',
  philippines: 'philippines',
  ph: 'philippines',
  阿联酋: 'uae',
  阿拉伯联合酋长国: 'uae',
  'united arab emirates': 'uae',
  uae: 'uae',
  ae: 'uae',
  沙特阿拉伯: 'saudi-arabia',
  沙特: 'saudi-arabia',
  'saudi arabia': 'saudi-arabia',
  sa: 'saudi-arabia',
  土耳其: 'turkey',
  土耳其共和国: 'turkey',
  turkey: 'turkey',
  tr: 'turkey',
  埃及: 'egypt',
  阿拉伯埃及共和国: 'egypt',
  egypt: 'egypt',
  eg: 'egypt',
  南非: 'south-africa',
  'south africa': 'south-africa',
  za: 'south-africa',
  墨西哥: 'mexico',
  墨西哥合众国: 'mexico',
  mexico: 'mexico',
  mx: 'mexico',
  阿根廷: 'argentina',
  阿根廷共和国: 'argentina',
  argentina: 'argentina',
  ar: 'argentina',
  新西兰: 'new-zealand',
  'new zealand': 'new-zealand',
  nz: 'new-zealand',
  爱尔兰: 'ireland',
  爱尔兰共和国: 'ireland',
  ireland: 'ireland',
  ie: 'ireland',
  瑞典: 'sweden',
  瑞典王国: 'sweden',
  sweden: 'sweden',
  se: 'sweden',
  瑞士: 'switzerland',
  瑞士联邦: 'switzerland',
  switzerland: 'switzerland',
  ch: 'switzerland',
  波兰: 'poland',
  波兰共和国: 'poland',
  poland: 'poland',
  pl: 'poland',
  乌克兰: 'ukraine',
  ukraine: 'ukraine',
  ua: 'ukraine',
  中国香港: 'hong-kong',
  香港: 'hong-kong',
  'hong kong': 'hong-kong',
  hk: 'hong-kong',
  中国台湾: 'taiwan',
  台湾: 'taiwan',
  taiwan: 'taiwan',
  tw: 'taiwan',
  中国澳门: 'macau',
  澳门: 'macau',
  macau: 'macau',
  mo: 'macau',
};

/** 归一化地区名：小写、去空格/连字符、去中文字尾（省/市/自治区…） */
function normalizeName(raw?: string | null): string {
  const value = String(raw ?? '').trim();
  if (!value) {
    return '';
  }
  return value
    .toLowerCase()
    .replace(/[\s\-_·]+/g, '')
    .replace(/[省市自治区特别行政区州郡县镇地区]+$/g, '');
}

function normalizeCountry(raw?: string | null): string {
  const value = String(raw ?? '').trim().toLowerCase();
  if (!value) {
    return '';
  }
  return COUNTRY_ALIASES[value] ?? '';
}

/**
 * 将 IP 定位结果映射为球面坐标。
 * 优先级：常用城市 → 中国省会（按省份） → 国家中心 → 海外州/省 → null。
 * 映射不到时返回 null（不标记、不报错）。
 */
function resolveLegacyLocation(
  location?: GlobeLocation | null,
): ResolvedMarker | null {
  if (!location) {
    return null;
  }
  const country = String(location.country ?? '').trim();
  const province = String(location.province ?? '').trim();
  const city = String(location.city ?? '').trim();

  // 1) 常用城市精确匹配
  const cityKey = normalizeName(city || province || country);
  const cityEntry = CITY_COORDS[cityKey];
  if (cityEntry) {
    return {
      label: cityEntry.name,
      latitude: cityEntry.lat,
      longitude: cityEntry.lng,
    };
  }

  const countryKey = normalizeCountry(country || province || city);

  // 2) 中国 → 省会映射（映射不到用北京兜底）
  if (countryKey === 'china') {
    const provinceKey = normalizeName(province);
    const provinceEntry = CHINA_PROVINCE_COORDS[provinceKey];
    if (provinceEntry) {
      return {
        label: provinceEntry.name,
        latitude: provinceEntry.lat,
        longitude: provinceEntry.lng,
      };
    }
    return {
      label: CHINA_CENTER.name,
      latitude: CHINA_CENTER.lat,
      longitude: CHINA_CENTER.lng,
    };
  }

  // 3) 国家中心点
  const countryEntry = countryKey ? COUNTRY_COORDS[countryKey] : undefined;
  if (countryEntry) {
    return {
      label: countryEntry.name,
      latitude: countryEntry.lat,
      longitude: countryEntry.lng,
    };
  }

  // 4) 海外州/省
  const stateKey = normalizeName(province);
  const stateEntry = STATE_COORDS[stateKey];
  if (stateEntry) {
    return {
      label: stateEntry.name,
      latitude: stateEntry.lat,
      longitude: stateEntry.lng,
    };
  }

  return null;
}

function resolveLocation(location?: GlobeLocation | null) {
  return resolveGlobeLocation(location) ?? resolveLegacyLocation(location);
}

/* ------------------------------------------------------------------ */
/* 数学工具                                                             */
/* ------------------------------------------------------------------ */

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** 经纬度 → 球面局部坐标（与地球组 Y 轴自转坐标系一致） */
function latLonToVector3(latitude: number, longitude: number, radius: number) {
  const phi = (90 - latitude) * DEG2RAD;
  const theta = (longitude + 180) * DEG2RAD;
  return new THREE.Vector3(
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

/** 球面局部坐标 → 经纬度 */
function vector3ToLatLon(position: THREE.Vector3) {
  const normalized = position.clone().normalize();
  const latitude = 90 - Math.acos(clamp(normalized.y, -1, 1)) * RAD2DEG;
  const longitude = Math.atan2(normalized.z, -normalized.x) * RAD2DEG - 180;
  return {
    latitude,
    longitude: ((longitude + 540) % 360) - 180,
  };
}

function formatLatLon(latitude: number, longitude: number) {
  const latDir = latitude >= 0 ? 'N' : 'S';
  const lonDir = longitude >= 0 ? 'E' : 'W';
  return `${Math.abs(latitude).toFixed(2)}°${latDir} ${Math.abs(longitude).toFixed(2)}°${lonDir}`;
}

function worldAngularDistance(a: THREE.Vector3, b: THREE.Vector3) {
  const da = a.clone().normalize();
  const db = b.clone().normalize();
  return Math.acos(clamp(da.dot(db), -1, 1));
}

function focusMarker(resolved: ResolvedMarker) {
  const group = earthGroup.value;
  const cam = camera.value;
  if (!group || !cam) return;
  const localDirection = latLonToVector3(
    resolved.latitude,
    resolved.longitude,
    1,
  ).normalize();
  const viewDirection = cam.position.clone().normalize();
  focusAnimation = {
    duration: 900,
    from: group.quaternion.clone(),
    startedAt: performance.now(),
    to: new THREE.Quaternion().setFromUnitVectors(
      localDirection,
      viewDirection,
    ),
  };
  autoRotateResumeAt = performance.now() + 3200;
}

/* ------------------------------------------------------------------ */
/* 资源创建                                                             */
/* ------------------------------------------------------------------ */

function createEarthMaterial(texture: THREE.Texture | null) {
  if (texture) {
    return isReduced.value
      ? new THREE.MeshPhongMaterial({
          map: texture,
          shininess: 5,
          specular: new THREE.Color(0x111111),
        })
      : new THREE.MeshStandardMaterial({
          map: texture,
          metalness: 0.02,
          roughness: 0.74,
        });
  }
  // 离线/加载失败兜底：深海程序化材质 + 遥感经纬网。
  return isReduced.value
    ? new THREE.MeshPhongMaterial({
        color: 0x082f49,
        emissive: 0x031525,
        shininess: 22,
        specular: new THREE.Color(0x0e7490),
      })
    : new THREE.MeshStandardMaterial({
        color: 0x082f49,
        emissive: 0x031525,
        metalness: 0.08,
        roughness: 0.58,
      });
}

function texturePoint(
  longitude: number,
  latitude: number,
  width: number,
  height: number,
) {
  return {
    x: ((longitude + 180) / 360) * width,
    y: ((90 - latitude) / 180) * height,
  };
}

function createLandPath(
  points: readonly LonLat[],
  width: number,
  height: number,
) {
  const path = new Path2D();
  points.forEach(([longitude, latitude], index) => {
    const point = texturePoint(longitude, latitude, width, height);
    if (index === 0) path.moveTo(point.x, point.y);
    else path.lineTo(point.x, point.y);
  });
  path.closePath();
  return path;
}

/**
 * Creates a deterministic, local equirectangular texture. The stylized land
 * shapes keep the globe recognizable even on isolated enterprise networks.
 */
function createProceduralEarthTexture() {
  const width = isReduced.value ? 512 : 1024;
  const height = width / 2;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const ocean = ctx.createLinearGradient(0, 0, width, height);
  ocean.addColorStop(0, '#04192d');
  ocean.addColorStop(0.42, '#075985');
  ocean.addColorStop(0.72, '#0c4a6e');
  ocean.addColorStop(1, '#031525');
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, width, height);

  const oceanGlow = ctx.createRadialGradient(
    width * 0.62,
    height * 0.32,
    0,
    width * 0.62,
    height * 0.32,
    width * 0.52,
  );
  oceanGlow.addColorStop(0, 'rgba(103, 232, 249, 0.18)');
  oceanGlow.addColorStop(0.55, 'rgba(14, 116, 144, 0.06)');
  oceanGlow.addColorStop(1, 'rgba(2, 6, 23, 0.42)');
  ctx.fillStyle = oceanGlow;
  ctx.fillRect(0, 0, width, height);

  ctx.lineWidth = Math.max(0.7, width / 1024);
  ctx.strokeStyle = 'rgba(125, 211, 252, 0.1)';
  for (let longitude = -150; longitude <= 150; longitude += 30) {
    const x = texturePoint(longitude, 0, width, height).x;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let latitude = -60; latitude <= 60; latitude += 30) {
    const y = texturePoint(0, latitude, width, height).y;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  const landPaths = LANDMASSES.map((points) =>
    createLandPath(points, width, height),
  );
  const land = ctx.createLinearGradient(0, height * 0.15, 0, height * 0.88);
  land.addColorStop(0, '#d7f6de');
  land.addColorStop(0.34, '#5eead4');
  land.addColorStop(0.66, '#16a34a');
  land.addColorStop(1, '#14532d');
  ctx.save();
  ctx.shadowColor = 'rgba(34, 211, 238, 0.72)';
  ctx.shadowBlur = width / 90;
  ctx.fillStyle = land;
  ctx.strokeStyle = 'rgba(207, 250, 254, 0.92)';
  ctx.lineWidth = Math.max(1.2, width / 560);
  for (const path of landPaths) {
    ctx.fill(path);
    ctx.stroke(path);
  }
  ctx.restore();

  // Deterministic terrain/city speckles add texture without runtime randomness.
  let seed = 0x6d2b_79f5;
  const random = () => {
    seed = Math.imul(seed ^ (seed >>> 15), seed | 1);
    seed ^= seed + Math.imul(seed ^ (seed >>> 7), seed | 61);
    return ((seed ^ (seed >>> 14)) >>> 0) / 4_294_967_296;
  };
  for (let index = 0; index < (isReduced.value ? 180 : 420); index += 1) {
    const x = random() * width;
    const y = random() * height;
    if (!landPaths.some((path) => ctx.isPointInPath(path, x, y))) continue;
    const radius = 0.45 + random() * (isReduced.value ? 0.8 : 1.25);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle =
      index % 5 === 0
        ? 'rgba(254, 240, 138, 0.9)'
        : 'rgba(240, 253, 250, 0.32)';
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  trackedTextures.add(texture);
  return texture;
}

function createEarthMesh() {
  const segments = isReduced.value ? 32 : 64;
  const geometry = new THREE.SphereGeometry(
    EARTH_RADIUS,
    segments,
    Math.floor(segments / 2),
  );
  const mesh = new THREE.Mesh(
    geometry,
    createEarthMaterial(createProceduralEarthTexture()),
  );
  mesh.name = 'earth-mesh';
  return mesh;
}

function createWireframeGrid() {
  const positions: number[] = [];
  const radius = EARTH_RADIUS * 1.004;
  const addSegment = (start: THREE.Vector3, end: THREE.Vector3) => {
    positions.push(start.x, start.y, start.z, end.x, end.y, end.z);
  };
  const step = isReduced.value ? 10 : 5;
  for (let latitude = -60; latitude <= 60; latitude += 30) {
    for (let longitude = -180; longitude < 180; longitude += step) {
      addSegment(
        latLonToVector3(latitude, longitude, radius),
        latLonToVector3(latitude, longitude + step, radius),
      );
    }
  }
  for (let longitude = -150; longitude <= 180; longitude += 30) {
    for (let latitude = -90; latitude < 90; latitude += step) {
      addSegment(
        latLonToVector3(latitude, longitude, radius),
        latLonToVector3(latitude + step, longitude, radius),
      );
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  const material = new THREE.LineBasicMaterial({
    color: 0xbae6fd,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
  });
  const grid = new THREE.LineSegments(geometry, material);
  grid.name = 'earth-wireframe';
  return grid;
}

function createGlowSprite() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(56, 189, 248, 0.55)');
    gradient.addColorStop(0.45, 'rgba(56, 189, 248, 0.18)');
    gradient.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  trackedTextures.add(texture);
  const material = new THREE.SpriteMaterial({
    map: texture,
    color: 0x7dd3fc,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.8, 2.8, 1);
  return sprite;
}

function createStars(count: number) {
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const radius = 25 + Math.random() * 35;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[index * 3 + 1] = radius * Math.cos(phi);
    positions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: isReduced.value ? 0.045 : 0.06,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.name = 'stars';
  return points;
}

function createOrbitRings() {
  const group = new THREE.Group();
  group.name = 'telemetry-orbits';
  const ringConfigs: Array<{
    color: number;
    opacity: number;
    rotation: [number, number, number];
  }> = [
    { color: 0x22d3ee, opacity: 0.16, rotation: [1.12, 0.28, 0.18] },
    { color: 0x38bdf8, opacity: 0.1, rotation: [0.32, 1.04, -0.42] },
  ];
  for (const config of ringConfigs) {
    const material = new THREE.MeshBasicMaterial({
      color: config.color,
      depthWrite: false,
      opacity: config.opacity,
      transparent: true,
    });
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.32, isReduced.value ? 0.002 : 0.0035, 4, 160),
      material,
    );
    ring.rotation.set(...config.rotation);
    group.add(ring);
  }
  return group;
}

function createLabelSprite(text: string) {
  const canvas = document.createElement('canvas');
  const scale = 2;
  canvas.width = 256 * scale;
  canvas.height = 64 * scale;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.scale(scale, scale);
    ctx.clearRect(0, 0, 256, 64);
    ctx.font = 'bold 30px system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(8, 145, 178, 0.95)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
    ctx.fillText(text, 128, 32);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  trackedTextures.add(texture);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.95, 0.24, 1);
  return sprite;
}

/* ------------------------------------------------------------------ */
/* 标记（IP 定位标记 + 点击标记）                                        */
/* ------------------------------------------------------------------ */

function disposeObject(obj: Object3D) {
  obj.traverse((child) => {
    const target = child as unknown as {
      geometry?: { dispose(): void };
      material?: THREE.Material | THREE.Material[];
    };
    target.geometry?.dispose();
    const material = target.material;
    const materials = Array.isArray(material) ? material : material ? [material] : [];
    for (const item of materials) {
      const withMap = item as THREE.Material & { map?: THREE.Texture | null };
      withMap.map?.dispose();
      item.dispose();
    }
  });
}

function clearIpMarker() {
  const group = earthGroup.value;
  if (!group) {
    return;
  }
  if (ipMarkerGroup.value) {
    group.remove(ipMarkerGroup.value);
    disposeObject(ipMarkerGroup.value);
    ipMarkerGroup.value = undefined;
  }
  ipMarkerAnims = [];
}

function rebuildIpMarker(resolved: ResolvedMarker) {
  const group = earthGroup.value;
  if (!group) {
    return;
  }
  clearIpMarker();

  const position = latLonToVector3(
    resolved.latitude,
    resolved.longitude,
    EARTH_RADIUS,
  );
  const markerGroup = new THREE.Group();
  markerGroup.name = 'ip-marker';
  markerGroup.position.copy(position);
  const outward = position.clone().normalize();
  markerGroup.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    outward,
  );

  // 高亮点
  const pointMaterial = new THREE.MeshBasicMaterial({
    color: 0x22d3ee,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  const point = new THREE.Mesh(
    new THREE.SphereGeometry(isReduced.value ? 0.035 : 0.045, 14, 10),
    pointMaterial,
  );
  point.position.set(0, 0.03, 0);
  markerGroup.add(point);
  ipMarkerAnims.push({ kind: 'pulse', material: pointMaterial, mesh: point, phase: 0 });

  // 脉冲光环
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0x67e8f9,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.07, 0.12, 32),
    ringMaterial,
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, 0.012, 0);
  markerGroup.add(ring);
  ipMarkerAnims.push({ kind: 'ring', material: ringMaterial, mesh: ring, phase: 0.5 });

  // 光柱（球心连线可视化为向外光柱）
  const beamMaterial = new THREE.MeshBasicMaterial({
    color: 0x22d3ee,
    transparent: true,
    opacity: 0.42,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.016, 0.55, 8, 1, true),
    beamMaterial,
  );
  beam.position.set(0, 0.02 + 0.275, 0);
  markerGroup.add(beam);
  ipMarkerAnims.push({ kind: 'beam', material: beamMaterial, mesh: beam, phase: 1.2 });

  // 地区名称 Sprite 标签
  const label = createLabelSprite(
    resolved.precision === 'coordinates'
      ? `${resolved.label} · GEO`
      : resolved.label,
  );
  label.position.set(0, 0.85, 0);
  markerGroup.add(label);

  ipMarkerGroup.value = markerGroup;
  group.add(markerGroup);
  focusMarker(resolved);
}

function clearHotspotLayer() {
  const group = earthGroup.value;
  const layer = hotspotLayer.value;
  if (group && layer) {
    group.remove(layer);
    disposeObject(layer);
  }
  hotspotLayer.value = undefined;
  hotspotMarkerAnims = [];
}

function hotspotColor(point: GlobeHotspot) {
  return HOTSPOT_COLORS[point.riskLevel ?? 'LOW'];
}

function hotspotSummary(point: GlobeHotspot) {
  const calls = Math.max(0, Number(point.callCount) || 0);
  const risks = Math.max(0, Number(point.riskHits) || 0);
  return `${point.region} · ${$t('globeEarth.callsCount', [calls.toLocaleString()])} · ${$t('globeEarth.riskHitsCount', [risks.toLocaleString()])}`;
}

function rebuildHotspotLayer() {
  const group = earthGroup.value;
  if (!group) return;
  clearHotspotLayer();

  const layer = new THREE.Group();
  layer.name = 'business-hotspots';
  const points = props.hotspots.slice(0, isReduced.value ? 12 : 28);
  const gateway = latLonToVector3(
    CHINA_CENTER.lat,
    CHINA_CENTER.lng,
    EARTH_RADIUS * 1.018,
  );

  points.forEach((point, index) => {
    const latitude = Number(point.latitude);
    const longitude = Number(point.longitude);
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return;
    }

    const color = hotspotColor(point);
    const position = latLonToVector3(
      latitude,
      longitude,
      EARTH_RADIUS * 1.018,
    );
    const markerGroup = new THREE.Group();
    markerGroup.name = `business-hotspot-${index}`;
    markerGroup.userData.hotspot = point;
    markerGroup.position.copy(position);
    markerGroup.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      position.clone().normalize(),
    );

    const volume = Math.max(1, Number(point.callCount) || 1);
    const size = clamp(0.018 + Math.log10(volume + 1) * 0.008, 0.02, 0.052);
    const dotMaterial = new THREE.MeshBasicMaterial({
      color,
      depthWrite: false,
      opacity: 0.96,
      transparent: true,
    });
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(size, isReduced.value ? 8 : 12, 8),
      dotMaterial,
    );
    dot.position.y = 0.025;
    markerGroup.add(dot);
    hotspotMarkerAnims.push({
      kind: 'pulse',
      material: dotMaterial,
      mesh: dot,
      phase: index * 0.48,
    });

    const ringMaterial = new THREE.MeshBasicMaterial({
      color,
      depthWrite: false,
      opacity: 0.5,
      side: THREE.DoubleSide,
      transparent: true,
    });
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(size * 1.5, size * 2.8, 24),
      ringMaterial,
    );
    ring.position.y = 0.01;
    ring.rotation.x = Math.PI / 2;
    markerGroup.add(ring);
    hotspotMarkerAnims.push({
      kind: 'ring',
      material: ringMaterial,
      mesh: ring,
      phase: index * 0.52 + 0.8,
    });
    layer.add(markerGroup);

    if (worldAngularDistance(position, gateway) > 0.08) {
      const midpoint = position.clone().add(gateway).multiplyScalar(0.5);
      midpoint.normalize().multiplyScalar(EARTH_RADIUS * 1.3);
      const curve = new THREE.QuadraticBezierCurve3(
        position,
        midpoint,
        gateway,
      );
      const arc = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(
          curve.getPoints(isReduced.value ? 18 : 32),
        ),
        new THREE.LineBasicMaterial({
          color,
          depthWrite: false,
          opacity: 0.3,
          transparent: true,
        }),
      );
      arc.name = `business-arc-${index}`;
      layer.add(arc);
    }
  });

  if (layer.children.length === 0) {
    disposeObject(layer);
    return;
  }
  hotspotLayer.value = layer;
  group.add(layer);
}

function clearClickMarker() {
  const group = earthGroup.value;
  if (!group) {
    return;
  }
  for (const obj of clickMarkerObjects) {
    group.remove(obj);
    disposeObject(obj);
  }
  clickMarkerObjects = [];
  clickMarkerAnims = [];
}

function placeClickMarker(latitude: number, longitude: number) {
  const group = earthGroup.value;
  if (!group) {
    return;
  }
  clearClickMarker();
  const position = latLonToVector3(latitude, longitude, EARTH_RADIUS);
  const markerGroup = new THREE.Group();
  markerGroup.name = 'click-marker';
  markerGroup.position.copy(position);
  const outward = position.clone().normalize();
  markerGroup.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    outward,
  );

  const dotMaterial = new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.028, 12, 8),
    dotMaterial,
  );
  dot.position.set(0, 0.02, 0);
  markerGroup.add(dot);
  clickMarkerAnims.push({ kind: 'pulse', material: dotMaterial, mesh: dot, phase: 2 });

  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0.65,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.05, 0.09, 24),
    ringMaterial,
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, 0.01, 0);
  markerGroup.add(ring);
  clickMarkerAnims.push({ kind: 'ring', material: ringMaterial, mesh: ring, phase: 1 });

  clickMarkerObjects.push(markerGroup);
  group.add(markerGroup);
}

function updateMarkerAnimations(elapsed: number) {
  const anims = [
    ...ipMarkerAnims,
    ...hotspotMarkerAnims,
    ...clickMarkerAnims,
  ];
  for (const anim of anims) {
    const t = (Math.sin(elapsed * 2.1 + anim.phase) + 1) / 2;
    if (anim.kind === 'ring') {
      const scale = 1 + t * 0.8;
      anim.mesh.scale.set(scale, scale, scale);
      anim.material.opacity = 0.55 * (1 - t * 0.7);
    } else if (anim.kind === 'pulse') {
      const scale = 1 + Math.sin(elapsed * 2.4 + anim.phase) * 0.18;
      anim.mesh.scale.setScalar(scale);
    } else {
      anim.material.opacity = 0.28 + ((Math.sin(elapsed * 2.8 + anim.phase) + 1) / 2) * 0.22;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Tooltip                                                             */
/* ------------------------------------------------------------------ */

function hideTooltip() {
  if (tooltipTimer) {
    window.clearTimeout(tooltipTimer);
    tooltipTimer = undefined;
  }
  tooltip.value.visible = false;
}

function showTooltipAt(content: string, worldPoint: THREE.Vector3) {
  const el = root.value;
  const cam = camera.value;
  if (!el || !cam) {
    return;
  }
  const projected = worldPoint.clone().project(cam);
  const width = Math.max(1, el.clientWidth);
  const height = Math.max(1, el.clientHeight);
  tooltip.value = {
    content,
    visible: true,
    x: (projected.x * 0.5 + 0.5) * width,
    y: (-projected.y * 0.5 + 0.5) * height,
  };
  if (tooltipTimer) {
    window.clearTimeout(tooltipTimer);
  }
  tooltipTimer = window.setTimeout(hideTooltip, 4000);
}

function ipMarkerWorldPosition() {
  const group = ipMarkerGroup.value;
  if (!group) {
    return null;
  }
  return group.getWorldPosition(new THREE.Vector3());
}

function hotspotFromObject(object: THREE.Object3D) {
  let current: THREE.Object3D | null = object;
  while (current) {
    const point = current.userData.hotspot as GlobeHotspot | undefined;
    if (point) {
      return {
        point,
        world: current.getWorldPosition(new THREE.Vector3()),
      };
    }
    current = current.parent;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* 交互（点击 / hover / 拖拽判定）                                       */
/* ------------------------------------------------------------------ */

function onPointerDown(event: PointerEvent) {
  pointerDownX = event.clientX;
  pointerDownY = event.clientY;
  pointerDownTime = Date.now();
}

function onPointerUp(event: PointerEvent) {
  const dx = event.clientX - pointerDownX;
  const dy = event.clientY - pointerDownY;
  if (Math.hypot(dx, dy) > 6 || Date.now() - pointerDownTime > 500) {
    return;
  }
  handleClick(event);
}

function handleClick(event: PointerEvent) {
  const el = root.value;
  const cam = camera.value;
  const group = earthGroup.value;
  const mesh = earthMesh.value;
  if (!el || !cam || !group || !mesh || !raycaster) {
    return;
  }
  const rect = el.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
  raycaster.setFromCamera(ndc, cam);

  // 先判断是否点到 IP 标记
  if (ipMarkerGroup.value && marker.value) {
    const markerHits = raycaster.intersectObjects([ipMarkerGroup.value], true);
    if (markerHits.length > 0) {
      const world = ipMarkerWorldPosition();
      if (world) {
        showTooltipAt(
          `${marker.value.label} · ${formatLatLon(marker.value.latitude, marker.value.longitude)}`,
          world,
        );
      }
      return;
    }
  }

  if (hotspotLayer.value) {
    const hotspotHit = raycaster
      .intersectObjects([hotspotLayer.value], true)
      .map((hit) => hotspotFromObject(hit.object))
      .find(Boolean);
    if (hotspotHit) {
      showTooltipAt(hotspotSummary(hotspotHit.point), hotspotHit.world);
      return;
    }
  }

  const hits = raycaster.intersectObjects([mesh], true);
  const firstHit = hits[0];
  if (!firstHit) {
    hideTooltip();
    clearClickMarker();
    return;
  }
  const hit = firstHit;
  const local = hit.point.clone();
  group.worldToLocal(local);
  const { latitude, longitude } = vector3ToLatLon(local);

  let content = $t('globeEarth.coordinates', [
    formatLatLon(latitude, longitude),
  ]);
  const ipWorld = ipMarkerWorldPosition();
  if (marker.value && ipWorld && worldAngularDistance(hit.point, ipWorld) < 0.25) {
    content = `${marker.value.label} · ${formatLatLon(latitude, longitude)}`;
  }

  placeClickMarker(latitude, longitude);
  showTooltipAt(content, hit.point);
}

function onPointerMove(event: PointerEvent) {
  if (!ipMarkerGroup.value && !hotspotLayer.value) {
    return;
  }
  const now = performance.now();
  if (now - lastHoverTime < 120) {
    return;
  }
  lastHoverTime = now;
  const el = root.value;
  const cam = camera.value;
  if (!el || !cam || !raycaster) {
    return;
  }
  const rect = el.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
  raycaster.setFromCamera(ndc, cam);
  if (hotspotLayer.value) {
    const hotspotHit = raycaster
      .intersectObjects([hotspotLayer.value], true)
      .map((hit) => hotspotFromObject(hit.object))
      .find(Boolean);
    if (hotspotHit) {
      showTooltipAt(hotspotSummary(hotspotHit.point), hotspotHit.world);
      return;
    }
  }
  const hits = ipMarkerGroup.value
    ? raycaster.intersectObjects([ipMarkerGroup.value], true)
    : [];
  if (hits.length > 0 && marker.value) {
    const world = ipMarkerWorldPosition();
    if (world) {
      showTooltipAt(
        `${marker.value.label} · ${formatLatLon(marker.value.latitude, marker.value.longitude)}`,
        world,
      );
    }
  } else {
    hideTooltip();
  }
}

function onKeydown(event: KeyboardEvent) {
  const group = earthGroup.value;
  const cam = camera.value;
  if (!group || !cam) return;
  const key = event.key;
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    event.preventDefault();
    focusAnimation = undefined;
    group.rotateY(key === 'ArrowLeft' ? -0.1 : 0.1);
  } else if (key === 'ArrowUp' || key === 'ArrowDown') {
    event.preventDefault();
    focusAnimation = undefined;
    group.rotateX(key === 'ArrowUp' ? -0.07 : 0.07);
  } else if (key === '+' || key === '=' || key === '-' || key === '_') {
    event.preventDefault();
    const distance = cam.position.length();
    const zoomIn = key === '+' || key === '=';
    cam.position.setLength(clamp(distance * (zoomIn ? 0.9 : 1.1), 1.9, 7));
    controls.value?.update();
  } else if (key === 'Enter' && marker.value) {
    event.preventDefault();
    const world = ipMarkerWorldPosition();
    if (world) {
      showTooltipAt(
        `${marker.value.label} · ${formatLatLon(marker.value.latitude, marker.value.longitude)}`,
        world,
      );
    }
  } else {
    return;
  }
  startAnimationLoop();
}

/* ------------------------------------------------------------------ */
/* 渲染循环 / 自适应 / 生命周期                                          */
/* ------------------------------------------------------------------ */

function resize() {
  const el = root.value;
  if (!el || !camera.value || !renderer.value || disposed) {
    return;
  }
  const width = Math.max(1, Math.round(el.clientWidth));
  const height = Math.max(1, Math.round(el.clientHeight));
  const pixelRatio = Math.min(
    window.devicePixelRatio || 1,
    isReduced.value ? 1.5 : 2,
  );
  if (
    width === lastWidth &&
    height === lastHeight &&
    pixelRatio === lastPixelRatio
  ) {
    return;
  }
  lastWidth = width;
  lastHeight = height;
  lastPixelRatio = pixelRatio;
  camera.value.aspect = width / height;
  camera.value.updateProjectionMatrix();
  renderer.value.setPixelRatio(pixelRatio);
  renderer.value.setSize(width, height, false);
}

function scheduleResize() {
  if (resizeFrame || disposed) {
    return;
  }
  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = 0;
    resize();
  });
}

function shouldAnimate() {
  return !disposed && !document.hidden && isIntersecting;
}

function animate(timestamp: number) {
  animationFrame = 0;
  if (!shouldAnimate()) return;
  animationFrame = requestAnimationFrame(animate);

  // 移动端/低性能模式保持约 30FPS，桌面端跟随屏幕刷新率。
  const minimumFrameInterval = isReduced.value ? 1000 / 30 : 0;
  if (
    minimumFrameInterval > 0 &&
    timestamp - lastRenderTime < minimumFrameInterval
  ) {
    return;
  }
  lastRenderTime = timestamp;
  const delta = Math.min(clock?.getDelta() ?? 0, 0.05);
  const elapsed = clock?.elapsedTime ?? 0;
  const group = earthGroup.value;

  if (focusAnimation && group) {
    const progress = clamp(
      (timestamp - focusAnimation.startedAt) / focusAnimation.duration,
      0,
      1,
    );
    const eased = 1 - (1 - progress) ** 3;
    group.quaternion.slerpQuaternions(
      focusAnimation.from,
      focusAnimation.to,
      eased,
    );
    if (progress >= 1) focusAnimation = undefined;
  } else if (
    props.autoRotate &&
    !isInteracting &&
    !prefersReducedMotion() &&
    timestamp >= autoRotateResumeAt &&
    group
  ) {
    // 基于时间增量自转，避免 60Hz/120Hz 设备速度不一致。
    group.rotateY(delta * (isReduced.value ? 0.065 : 0.095));
  }

  updateMarkerAnimations(elapsed);
  controls.value?.update();
  if (scene.value && camera.value && renderer.value) {
    renderer.value.render(scene.value, camera.value);
  }
}

function startAnimationLoop() {
  if (animationFrame || !shouldAnimate()) return;
  clock?.getDelta();
  lastRenderTime = 0;
  animationFrame = requestAnimationFrame(animate);
}

function stopAnimationLoop() {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = 0;
}

function syncAnimationLoop() {
  if (shouldAnimate()) startAnimationLoop();
  else stopAnimationLoop();
}

function onVisibilityChange() {
  syncAnimationLoop();
}

function onIntersection(entries: IntersectionObserverEntry[]) {
  isIntersecting = entries.some(
    (entry) => entry.isIntersecting && entry.intersectionRatio > 0,
  );
  syncAnimationLoop();
}

function onWebGLContextLost(event: Event) {
  event.preventDefault();
  renderUnavailable.value = true;
  stopAnimationLoop();
}

function disposeScene() {
  disposed = true;
  stopAnimationLoop();
  cancelAnimationFrame(resizeFrame);
  if (tooltipTimer) {
    window.clearTimeout(tooltipTimer);
    tooltipTimer = undefined;
  }
  resizeObserver?.disconnect();
  intersectionObserver?.disconnect();
  window.removeEventListener('resize', scheduleResize);
  document.removeEventListener('visibilitychange', onVisibilityChange);
  motionQuery?.removeEventListener('change', onMotionPreferenceChange);
  const el = root.value;
  if (el) {
    el.removeEventListener('pointerdown', onPointerDown);
    el.removeEventListener('pointerup', onPointerUp);
    el.removeEventListener('pointermove', onPointerMove);
  }
  controls.value?.dispose();
  if (scene.value) {
    // disposeObject 本身会递归 traverse，场景只调用一次，避免 O(n²) 重复释放。
    disposeObject(scene.value);
    for (const texture of trackedTextures) {
      texture.dispose();
    }
    trackedTextures.clear();
  }
  renderer.value?.domElement.removeEventListener(
    'webglcontextlost',
    onWebGLContextLost,
  );
  renderer.value?.renderLists.dispose();
  renderer.value?.dispose();
  if (renderer.value?.domElement && renderer.value.domElement.parentNode) {
    renderer.value.domElement.parentNode.removeChild(
      renderer.value.domElement,
    );
  }
  renderer.value = undefined;
  camera.value = undefined;
  scene.value = undefined;
  controls.value = undefined;
  earthGroup.value = undefined;
  earthMesh.value = undefined;
  wireframeGrid.value = undefined;
  ipMarkerGroup.value = undefined;
  hotspotLayer.value = undefined;
  ipMarkerAnims = [];
  hotspotMarkerAnims = [];
  clickMarkerAnims = [];
  clickMarkerObjects = [];
  clock = undefined;
  raycaster = undefined;
  focusAnimation = undefined;
  resizeObserver = undefined;
  intersectionObserver = undefined;
  motionQuery = undefined;
  isIntersecting = false;
  lastWidth = 0;
  lastHeight = 0;
  lastPixelRatio = 0;
  lastRenderTime = 0;
}

function initScene() {
  if (!root.value) {
    return;
  }
  if (!supportsWebGL()) {
    renderUnavailable.value = true;
    return;
  }
  try {
    disposed = false;
    renderUnavailable.value = false;
    motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion.value = motionQuery.matches;
    motionQuery.addEventListener('change', onMotionPreferenceChange);

    const nextScene = new THREE.Scene();
    const nextCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 120);
    nextCamera.position.set(0, 0.5, 3.4);

    const nextRenderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !isReduced.value,
      powerPreference: 'high-performance',
    });
    nextRenderer.outputColorSpace = THREE.SRGBColorSpace;
    nextRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    nextRenderer.toneMappingExposure = 1.08;
    nextRenderer.setClearColor(0x000000, 0);
    nextRenderer.domElement.addEventListener(
      'webglcontextlost',
      onWebGLContextLost,
    );
    root.value.append(nextRenderer.domElement);

    const group = new THREE.Group();
    const mesh = createEarthMesh();
    group.add(mesh);
    // 先加经纬网线，贴图加载成功后移除
    const grid = createWireframeGrid();
    wireframeGrid.value = grid;
    group.add(grid);

    nextScene.add(group);
    nextScene.add(new THREE.AmbientLight(0x315272, 0.62));
    nextScene.add(new THREE.HemisphereLight(0x67e8f9, 0x020617, 0.52));
    const sun = new THREE.DirectionalLight(0xe0f2fe, 2.15);
    sun.position.set(5, 3, 5);
    nextScene.add(sun);
    const rim = new THREE.DirectionalLight(0x22d3ee, 0.62);
    rim.position.set(-4, -1, -3);
    nextScene.add(rim);
    nextScene.add(createGlowSprite());
    nextScene.add(createOrbitRings());
    nextScene.add(createStars(isReduced.value ? 350 : 1200));

    const nextControls = new OrbitControls(nextCamera, nextRenderer.domElement);
    nextControls.enableDamping = true;
    nextControls.dampingFactor = 0.08;
    nextControls.enablePan = false;
    nextControls.minDistance = 1.9;
    nextControls.maxDistance = 7;
    nextControls.minPolarAngle = Math.PI * 0.15;
    nextControls.maxPolarAngle = Math.PI * 0.85;
    nextControls.rotateSpeed = 0.7;
    nextControls.zoomSpeed = 0.8;
    nextControls.addEventListener('start', () => {
      isInteracting = true;
      focusAnimation = undefined;
      hideTooltip();
    });
    nextControls.addEventListener('end', () => {
      isInteracting = false;
    });

    scene.value = nextScene;
    camera.value = nextCamera;
    renderer.value = nextRenderer;
    controls.value = nextControls;
    earthGroup.value = group;
    earthMesh.value = mesh;
    raycaster = new THREE.Raycaster();
    clock = new THREE.Clock();
    rebuildHotspotLayer();

    resizeObserver = new ResizeObserver(scheduleResize);
    resizeObserver.observe(root.value);
    if (typeof IntersectionObserver !== 'undefined') {
      intersectionObserver = new IntersectionObserver(onIntersection, {
        rootMargin: '120px 0px',
        threshold: [0, 0.01],
      });
      intersectionObserver.observe(root.value);
    }
    window.addEventListener('resize', scheduleResize, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);
    root.value.addEventListener('pointerdown', onPointerDown);
    root.value.addEventListener('pointerup', onPointerUp);
    root.value.addEventListener('pointermove', onPointerMove, { passive: true });

    scheduleResize();
    startAnimationLoop();
  } catch (error) {
    console.warn('[GlobeEarth] 初始化失败，降级为占位展示', error);
    disposeScene();
    renderUnavailable.value = true;
  }
}

/* ------------------------------------------------------------------ */
/* IP 定位                                                             */
/* ------------------------------------------------------------------ */

function applyLocation(location: GlobeLocation | null | undefined) {
  const resolved = resolveLocation(location);
  marker.value = resolved;
  if (resolved) {
    rebuildIpMarker(resolved);
  } else {
    clearIpMarker();
  }
  emit('located', resolved);
}

async function locate() {
  if (locating.value) {
    return;
  }
  locating.value = true;
  try {
    const result = await getGeoIP();
    applyLocation({
      country: result.country,
      province: result.province,
      city: result.city,
      isp: result.isp,
      latitude: result.latitude,
      longitude: result.longitude,
      provider: result.provider,
      region: result.region,
      resolved: result.resolved,
      status: result.status,
    });
  } catch (error) {
    console.warn('[GlobeEarth] IP 定位失败，地球照常渲染', error);
    applyLocation(null);
  } finally {
    locating.value = false;
  }
}

onMounted(() => {
  initScene();
  if (props.location) {
    applyLocation(props.location);
  } else if (props.autoLocate) {
    void locate();
  }
});

watch(
  () => props.location,
  (location) => {
    applyLocation(location);
  },
);

watch(() => props.hotspots, rebuildHotspotLayer, { deep: true });

onBeforeUnmount(disposeScene);
</script>

<template>
  <div
    ref="root"
    class="globe-earth"
    :class="{ 'is-reduced': isReduced }"
    role="application"
    tabindex="0"
    :aria-label="accessibleLabel"
    @keydown="onKeydown"
  >
    <div v-if="renderUnavailable" class="globe-earth__fallback">
      <div class="globe-earth__fallback-visual" aria-hidden="true"></div>
      <span>{{ $t('globeEarth.webglFallback') }}</span>
    </div>
    <div
      v-show="!renderUnavailable"
      class="globe-earth__hint"
      aria-hidden="true"
    >
      <span>{{ $t('globeEarth.hint') }}</span>
      <span class="globe-earth__status">{{ markerPrecisionLabel }}</span>
    </div>
    <div v-if="marker" class="globe-earth__telemetry" aria-live="polite">
      <span class="globe-earth__telemetry-dot" />
      <span>{{ marker.label }}</span>
      <small>{{ markerPrecisionLabel }}</small>
    </div>
    <div
      v-show="tooltip.visible"
      class="globe-earth__tooltip"
      :style="{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }"
    >
      {{ tooltip.content }}
    </div>
  </div>
</template>

<style scoped>
.globe-earth {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 240px;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 43%, rgb(34 211 238 / 17%), transparent 48%),
    radial-gradient(circle at 14% 10%, rgb(37 99 235 / 12%), transparent 36%),
    linear-gradient(155deg, #020617 0%, #061526 55%, #020617 100%);
  isolation: isolate;
}

.globe-earth:focus-visible {
  outline: 2px solid rgb(34 211 238 / 72%);
  outline-offset: -2px;
}

.globe-earth::before {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  content: '';
  background-image:
    linear-gradient(rgb(34 211 238 / 3%) 1px, transparent 1px),
    linear-gradient(90deg, rgb(34 211 238 / 3%) 1px, transparent 1px);
  background-size: 32px 32px;
  mask-image: radial-gradient(circle at center, black, transparent 76%);
}

.globe-earth::after {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  content: '';
  background:
    linear-gradient(180deg, rgb(2 6 23 / 6%), rgb(2 6 23 / 42%)),
    radial-gradient(circle at 50% 45%, transparent 48%, rgb(2 6 23 / 54%));
}

.globe-earth :deep(canvas) {
  position: relative;
  z-index: 0;
  display: block;
  width: 100%;
  height: 100%;
}

.globe-earth__hint {
  position: absolute;
  bottom: 10px;
  left: 12px;
  z-index: 2;
  padding: 3px 8px;
  font-size: 11px;
  line-height: 1.4;
  display: inline-flex;
  gap: 8px;
  align-items: center;
  color: rgb(148 163 184);
  letter-spacing: 0.02em;
  pointer-events: none;
  border: 1px solid rgb(34 211 238 / 18%);
  border-radius: 999px;
  background: rgb(2 6 23 / 62%);
  backdrop-filter: blur(8px);
}

.globe-earth__status {
  color: #67e8f9;
}

.globe-earth__telemetry {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 3;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 1px 7px;
  align-items: center;
  max-width: min(72%, 420px);
  padding: 8px 11px;
  overflow: hidden;
  font-size: 12px;
  font-weight: 700;
  color: #e0f2fe;
  text-overflow: ellipsis;
  white-space: nowrap;
  pointer-events: none;
  border: 1px solid rgb(34 211 238 / 24%);
  border-radius: 9px;
  background: linear-gradient(135deg, rgb(2 6 23 / 84%), rgb(8 47 73 / 58%));
  box-shadow: 0 10px 28px rgb(0 0 0 / 22%);
  backdrop-filter: blur(10px);
}

.globe-earth__telemetry small {
  grid-column: 2;
  font-size: 10px;
  font-weight: 600;
  color: rgb(125 211 252 / 72%);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.globe-earth__telemetry-dot {
  grid-row: 1 / span 2;
  width: 8px;
  height: 8px;
  background: #22d3ee;
  border-radius: 999px;
  box-shadow: 0 0 0 4px rgb(34 211 238 / 12%), 0 0 18px #22d3ee;
}

.globe-earth__tooltip {
  position: absolute;
  z-index: 4;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  color: #e2e8f0;
  white-space: nowrap;
  pointer-events: none;
  border: 1px solid rgb(34 211 238 / 30%);
  border-radius: 8px;
  background: rgb(2 6 23 / 85%);
  box-shadow: 0 4px 16px rgb(0 0 0 / 28%);
  backdrop-filter: blur(6px);
  transform: translate(-50%, calc(-100% - 12px));
}

.globe-earth__fallback {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: grid;
  gap: 18px;
  place-content: center;
  justify-items: center;
  padding: 24px;
  font-size: 13px;
  font-weight: 700;
  color: rgb(100 116 139);
  text-align: center;
}

.globe-earth__fallback-visual {
  width: min(48vw, 180px);
  aspect-ratio: 1;
  background:
    linear-gradient(90deg, transparent 48%, rgb(14 165 233 / 42%) 50%, transparent 52%),
    linear-gradient(transparent 48%, rgb(14 165 233 / 42%) 50%, transparent 52%),
    repeating-radial-gradient(circle, transparent 0 20%, rgb(14 165 233 / 26%) 21% 22%);
  border: 1px solid rgb(14 165 233 / 52%);
  border-radius: 50%;
  box-shadow: inset 0 0 42px rgb(14 165 233 / 14%);
}

html.dark .globe-earth__hint {
  color: rgb(148 163 184);
  border-color: rgb(148 163 184 / 20%);
  background: rgb(15 23 42 / 55%);
}

@media (max-width: 640px) {
  .globe-earth__hint {
    right: 10px;
    left: 10px;
    justify-content: space-between;
  }

  .globe-earth__telemetry {
    max-width: calc(100% - 24px);
  }
}

html.dark .globe-earth__fallback {
  color: rgb(148 163 184);
}
</style>
