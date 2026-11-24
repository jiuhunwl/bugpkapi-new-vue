<script setup lang="ts">
import type { GeoJSONFeature } from './geo-utils';

import type { AdminAccessLocation } from '#/api/core/user';

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { $t } from '#/locales';

import {
  accessLocationLabel,
  asLines,
  asRings,
  chinaProvinceLabel,
  featureCenter,
  featureLabel,
  isChinaWorldFeature,
  validCoordinate,
} from './geo-utils';
import {
  chinaMaritimeBoundaryFeatures,
  chinaMaritimeIslandFeatures,
  chinaProvinceFeatures,
  officialWorldFeatures,
} from './map-geo-data';

const props = withDefaults(
  defineProps<{
    locations: readonly AdminAccessLocation[];
    metric?: 'calls' | 'failures';
  }>(),
  {
    metric: 'calls',
  },
);

const emit = defineEmits<{
  /** 省份点击下钻（3D 地球省份点击后触发，由 AdminAccessAtlas 统一处理切换到 2D 下钻） */
  drill: [payload: { adcode: string; label: string; granularity: 'province' }];
}>();

const root = ref<HTMLDivElement>();
const canvas = ref<HTMLCanvasElement>();
const unavailable = ref(false);
const hovered = ref<AdminAccessLocation | null>(null);
const tooltip = ref({ x: 0, y: 0 });
const hoveredLabel = computed(() =>
  hovered.value ? accessLocationLabel(hovered.value) : '',
);

const worldFeatures = officialWorldFeatures;
const provinceCount = chinaProvinceFeatures.length;

let renderer: THREE.WebGLRenderer | undefined;
let scene: THREE.Scene | undefined;
let camera: THREE.PerspectiveCamera | undefined;
let controls: OrbitControls | undefined;
let globeGroup: THREE.Group | undefined;
let hotspotGroup: THREE.Group | undefined;
let animationFrame = 0;
let resizeObserver: ResizeObserver | undefined;
let pointerMoveHandler: ((event: PointerEvent) => void) | undefined;
let raycaster: THREE.Raycaster | undefined;
let hotspotObjects: THREE.Object3D[] = [];
let labelSprites: THREE.Sprite[] = [];
let provinceLineObjects: THREE.Line[] = [];
let disposed = false;
const clock = new THREE.Clock();

const EARTH_RADIUS = 1;
const DEG2RAD = Math.PI / 180;

onMounted(() => {
  initialize();
});

watch(
  () => [props.locations, props.metric],
  () => {
    if (!disposed) renderHotspots();
  },
  { deep: true },
);

onBeforeUnmount(() => {
  disposed = true;
  if (animationFrame) cancelAnimationFrame(animationFrame);
  resizeObserver?.disconnect();
  if (canvas.value) {
    if (pointerMoveHandler) {
      canvas.value.removeEventListener('pointermove', pointerMoveHandler);
    }
    canvas.value.removeEventListener('click', handleProvinceClick);
  }
  controls?.dispose();
  disposeObject(scene);
  renderer?.dispose();
  renderer = undefined;
  scene = undefined;
  camera = undefined;
});

function initialize() {
  const canvasElement = canvas.value;
  const rootElement = root.value;
  if (!canvasElement || !rootElement) return;
  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      canvas: canvasElement,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    camera.position.set(0, 0.18, 3.15);
    controls = new OrbitControls(camera, canvasElement);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 2.1;
    controls.maxDistance = 5.2;
    controls.autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)')
      .matches;
    controls.autoRotateSpeed = 0.22;

    const ambient = new THREE.AmbientLight(0x9bdcf3, 1.55);
    scene.add(ambient);
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
    keyLight.position.set(3, 2, 4);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x2dd4bf, 1.2);
    rimLight.position.set(-4, 1, -3);
    scene.add(rimLight);

    globeGroup = new THREE.Group();
    scene.add(globeGroup);
    createEarthSurface(globeGroup);
    createCoordinateGrid(globeGroup);
    createCountryBoundaries(globeGroup);
    createCountryLabels(globeGroup);
    createChinaProvinceBoundaries(globeGroup);
    createChinaMaritimeBoundaries(globeGroup);
    createChinaProvinceLabels(globeGroup);

    hotspotGroup = new THREE.Group();
    globeGroup.add(hotspotGroup);
    renderHotspots();

    raycaster = new THREE.Raycaster();
    pointerMoveHandler = (event) => handlePointerMove(event);
    canvasElement.addEventListener('pointermove', pointerMoveHandler);
    canvasElement.addEventListener('pointerleave', () => {
      hovered.value = null;
    });
    // 省份点击下钻：检测射线是否击中中国省份线段
    canvasElement.addEventListener('click', handleProvinceClick);

    resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(rootElement);
    resize();
    animate();
  } catch (error) {
    console.warn('[AdminGlobe3D] WebGL initialization failed', error);
    unavailable.value = true;
  }
}

function createEarthSurface(parent: THREE.Group) {
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_RADIUS, 96, 64),
    new THREE.MeshPhongMaterial({
      color: 0x0c2b44,
      emissive: 0x061521,
      emissiveIntensity: 0.85,
      shininess: 18,
    }),
  );
  parent.add(earth);

  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.045, 64, 48),
    new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      opacity: 0.09,
      side: THREE.BackSide,
      transparent: true,
    }),
  );
  parent.add(atmosphere);
}

function createCoordinateGrid(parent: THREE.Group) {
  const gridMaterial = new THREE.LineBasicMaterial({
    color: 0x4b8ba4,
    opacity: 0.22,
    transparent: true,
  });
  for (let latitude = -60; latitude <= 60; latitude += 30) {
    const points: THREE.Vector3[] = [];
    for (let longitude = -180; longitude <= 180; longitude += 4) {
      points.push(toSphere(longitude, latitude, 1.004));
    }
    parent.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        gridMaterial,
      ),
    );
  }
  for (let longitude = -180; longitude < 180; longitude += 30) {
    const points: THREE.Vector3[] = [];
    for (let latitude = -90; latitude <= 90; latitude += 4) {
      points.push(toSphere(longitude, latitude, 1.004));
    }
    parent.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        gridMaterial,
      ),
    );
  }
}

function createCountryBoundaries(parent: THREE.Group) {
  const material = new THREE.LineBasicMaterial({
    color: 0x9be7f4,
    opacity: 0.7,
    transparent: true,
  });
  for (const feature of worldFeatures) {
    for (const ring of asRings(feature)) {
      for (const segment of splitAtDateLine(ring)) {
        if (segment.length < 2) continue;
        const points = segment.map(([longitude, latitude]) =>
          toSphere(longitude, latitude, 1.008),
        );
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(points),
          material,
        );
        line.userData.country = featureLabel(feature);
        parent.add(line);
      }
    }
  }
}

function createCountryLabels(parent: THREE.Group) {
  for (const feature of worldFeatures) {
    if (isChinaWorldFeature(feature)) continue;
    const [longitude, latitude] = featureCenter(feature);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) continue;
    const label = featureLabel(feature);
    const sprite = new THREE.Sprite(createLabelMaterial(label));
    sprite.position.copy(toSphere(longitude, latitude, 1.075));
    const length = Math.max(2, label.length);
    sprite.scale.set(0.075 + length * 0.008, 0.028 + length * 0.002, 1);
    sprite.userData.country = label;
    sprite.userData.facingThreshold = 0.08;
    parent.add(sprite);
    labelSprites.push(sprite);
  }
}

function createChinaProvinceBoundaries(parent: THREE.Group) {
  provinceLineObjects = [];
  const provinceMaterial = new THREE.LineBasicMaterial({
    color: 0x5eead4,
    opacity: 0.82,
    transparent: true,
  });
  for (const feature of chinaProvinceFeatures) {
    const label = chinaProvinceLabel(feature);
    const adcode = String(feature.properties?.adcode ?? '');
    for (const ring of asRings(feature)) {
      for (const segment of splitAtDateLine(ring)) {
        if (segment.length < 2) continue;
        const points = segment.map(([longitude, latitude]) =>
          toSphere(longitude, latitude, 1.012),
        );
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(points),
          provinceMaterial,
        );
        line.userData.province = label;
        line.userData.adcode = adcode;
        parent.add(line);
        provinceLineObjects.push(line);
      }
    }
  }
}

function createChinaMaritimeBoundaries(parent: THREE.Group) {
  const material = new THREE.LineBasicMaterial({
    color: 0x5eead4,
    opacity: 0.82,
    transparent: true,
  });
  for (const feature of [
    ...chinaMaritimeIslandFeatures,
    ...chinaMaritimeBoundaryFeatures,
  ]) {
    for (const lineCoordinates of asLines(feature)) {
      for (const segment of splitAtDateLine(lineCoordinates)) {
        if (segment.length < 2) continue;
        parent.add(
          new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(
              segment.map(([longitude, latitude]) =>
                toSphere(longitude, latitude, 1.012),
              ),
            ),
            material,
          ),
        );
      }
    }
  }
}

function createChinaProvinceLabels(parent: THREE.Group) {
  for (const feature of chinaProvinceFeatures) {
    const [centerLongitude, centerLatitude] = featureCenter(feature);
    if (!Number.isFinite(centerLongitude) || !Number.isFinite(centerLatitude)) {
      continue;
    }
    const label = chinaProvinceLabel(feature);
    const [longitude, latitude] = chinaProvinceLabelPosition(
      feature,
      centerLongitude,
      centerLatitude,
    );
    const sprite = new THREE.Sprite(
      createLabelMaterial(label, {
        color: 'rgba(207, 250, 254, 0.9)',
        fontSize: 20,
        opacity: 0.9,
      }),
    );
    sprite.position.copy(toSphere(longitude, latitude, 1.082));
    const length = Math.max(2, label.length);
    sprite.scale.set(0.052 + length * 0.0065, 0.021 + length * 0.0014, 1);
    sprite.userData.facingThreshold = 0.14;
    sprite.userData.province = label;
    sprite.userData.scope = 'china-province';
    parent.add(sprite);
    labelSprites.push(sprite);
  }
}

function createLabelMaterial(
  label: string,
  options: {
    color?: string;
    fontSize?: number;
    opacity?: number;
  } = {},
) {
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 256;
  labelCanvas.height = 64;
  const context = labelCanvas.getContext('2d');
  if (context) {
    context.clearRect(0, 0, labelCanvas.width, labelCanvas.height);
    context.font = `600 ${options.fontSize ?? 24}px "Microsoft YaHei", "PingFang SC", sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = options.color ?? 'rgba(226, 245, 250, 0.86)';
    context.strokeStyle = 'rgba(3, 18, 29, 0.85)';
    context.lineWidth = 5;
    context.strokeText(label, 128, 32);
    context.fillText(label, 128, 32);
  }
  const texture = new THREE.CanvasTexture(labelCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.SpriteMaterial({
    depthTest: false,
    map: texture,
    opacity: options.opacity ?? 0.88,
    transparent: true,
  });
}

function chinaProvinceLabelPosition(
  feature: GeoJSONFeature,
  longitude: number,
  latitude: number,
): [number, number] {
  const adcode = String(feature.properties?.adcode ?? '');
  if (adcode === '810000') return [116.1, 23.15];
  if (adcode === '820000') return [111.65, 21.35];
  return [longitude, latitude];
}

function renderHotspots() {
  if (!hotspotGroup) return;
  for (const child of [...hotspotGroup.children]) {
    disposeObject(child);
    hotspotGroup.remove(child);
  }
  hotspotObjects = [];
  const values = props.locations.map((item) =>
    props.metric === 'failures' ? item.failedCalls : item.callCount,
  );
  const maxValue = Math.max(1, ...values);
  const locations = props.locations.slice(0, 500);
  for (const location of locations) {
    const latitude = validCoordinate(location.latitude, -90, 90);
    const longitude = validCoordinate(location.longitude, -180, 180);
    if (latitude === null || longitude === null) continue;
    const value =
      props.metric === 'failures' ? location.failedCalls : location.callCount;
    const color = props.metric === 'failures' ? 0xfb7185 : 0x67e8f9;
    const point = toSphere(longitude, latitude, 1.045);
    const marker = new THREE.Group();
    marker.position.copy(point);
    marker.userData.location = location;
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(
        0.012 + Math.sqrt(value / maxValue) * 0.04,
        16,
        12,
      ),
      new THREE.MeshBasicMaterial({ color }),
    );
    marker.add(core);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.028, 0.033, 32),
      new THREE.MeshBasicMaterial({
        color,
        opacity: 0.72,
        side: THREE.DoubleSide,
        transparent: true,
      }),
    );
    ring.lookAt(point.clone().multiplyScalar(2));
    marker.add(ring);
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0025, 0.0025, 0.13, 8),
      new THREE.MeshBasicMaterial({ color, opacity: 0.6, transparent: true }),
    );
    stem.position.copy(point.clone().normalize().multiplyScalar(0.065));
    stem.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      point.clone().normalize(),
    );
    marker.add(stem);
    marker.userData.phase = Math.random() * Math.PI * 2;
    hotspotGroup.add(marker);
    hotspotObjects.push(marker);
  }
}

function handlePointerMove(event: PointerEvent) {
  if (!raycaster || !camera || !canvas.value || !root.value) return;
  const rect = canvas.value.getBoundingClientRect();
  const pointer = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
  raycaster.setFromCamera(pointer, camera);
  const intersections = raycaster.intersectObjects(hotspotObjects, true);
  const target = intersections[0]?.object;
  let marker: THREE.Object3D | undefined = target;
  while (marker && !marker.userData.location)
    marker = marker.parent ?? undefined;
  hovered.value =
    (marker?.userData.location as AdminAccessLocation | undefined) ?? null;
  if (hovered.value) {
    const rootRect = root.value.getBoundingClientRect();
    tooltip.value = {
      x: event.clientX - rootRect.left + 12,
      y: event.clientY - rootRect.top + 12,
    };
  }
}

/**
 * 省份点击下钻检测：使用射线找到最近的省份线段，并 emit drill 事件。
 * 线段本身的射线检测精度较低，所以使用线段端点与射线的距离做近似判断。
 */
function handleProvinceClick(event: MouseEvent) {
  if (!raycaster || !camera || !canvas.value) return;
  if (provinceLineObjects.length === 0) return;
  const rect = canvas.value.getBoundingClientRect();
  const pointer = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
  raycaster.setFromCamera(pointer, camera);
  raycaster.params.Line = { threshold: 0.02 };

  // 收集所有省份线段对象，检测最近的命中
  const provinceHits = raycaster.intersectObjects(provinceLineObjects, false);
  if (provinceHits.length > 0) {
    const hit = provinceHits[0];
    if (!hit) return;
    const object = hit.object;
    const province = String(object.userData.province ?? '');
    const adcode = String(object.userData.adcode ?? '');
    if (province && adcode) {
      emit('drill', { adcode, granularity: 'province', label: province });
    }
  }
}

function resize() {
  if (!renderer || !camera || !root.value) return;
  const width = Math.max(280, root.value.clientWidth);
  const height = Math.max(300, root.value.clientHeight);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function animate() {
  if (disposed || !renderer || !scene || !camera) return;
  animationFrame = requestAnimationFrame(animate);
  const elapsed = clock.getElapsedTime();
  controls?.update();
  for (const marker of hotspotObjects) {
    const phase = Number(marker.userData.phase ?? 0);
    const pulse = 1 + Math.sin(elapsed * 2.1 + phase) * 0.18;
    marker.children[1]?.scale.setScalar(pulse);
  }
  for (const label of labelSprites) {
    const worldPosition = label
      .getWorldPosition(new THREE.Vector3())
      .normalize();
    const cameraDirection = camera.position.clone().normalize();
    const facingThreshold = Number(label.userData.facingThreshold ?? 0.08);
    const closeEnough =
      label.userData.scope !== 'china-province' ||
      camera.position.length() <= 4;
    label.visible =
      closeEnough && cameraDirection.dot(worldPosition) > facingThreshold;
  }
  renderer.render(scene, camera);
}

function toSphere(longitude: number, latitude: number, radius: number) {
  const latitudeRadians = latitude * DEG2RAD;
  const longitudeRadians = longitude * DEG2RAD;
  return new THREE.Vector3(
    radius * Math.cos(latitudeRadians) * Math.sin(longitudeRadians),
    radius * Math.sin(latitudeRadians),
    radius * Math.cos(latitudeRadians) * Math.cos(longitudeRadians),
  );
}

function splitAtDateLine(points: readonly (readonly [number, number])[]) {
  const segments: Array<Array<[number, number]>> = [];
  let current: Array<[number, number]> = [];
  for (const point of points) {
    const next: [number, number] = [point[0], point[1]];
    const previous = current[current.length - 1];
    if (previous && Math.abs(next[0] - previous[0]) > 180) {
      if (current.length > 1) segments.push(current);
      current = [];
    }
    current.push(next);
  }
  if (current.length > 1) segments.push(current);
  return segments;
}

function disposeObject(object?: null | THREE.Object3D) {
  if (!object) return;
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) {
      material.forEach(disposeMaterial);
    } else if (material) {
      disposeMaterial(material);
    }
  });
}

function disposeMaterial(material: THREE.Material) {
  const texture = (material as THREE.MeshBasicMaterial).map;
  texture?.dispose();
  material.dispose();
}
</script>

<template>
  <div ref="root" class="admin-globe-3d">
    <canvas ref="canvas" class="admin-globe-3d__canvas"></canvas>
    <div v-if="unavailable" class="admin-globe-3d__fallback">
      {{ $t('adminAccess.map.globeFallback') }}
    </div>
    <div
      v-if="hovered"
      class="admin-globe-3d__tooltip"
      :style="{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }"
    >
      <strong>{{ hoveredLabel }}</strong>
      <span>{{ $t('adminAccess.callsCount', [hovered.callCount.toLocaleString()]) }}</span>
      <span
        >{{ $t('adminAccess.ipsCount', [hovered.uniqueIps.toLocaleString()]) }} ·
        {{ hovered.isp || $t('adminAccess.ispUnknown') }}</span
      >
    </div>
    <div class="admin-globe-3d__meta">
      <span>{{ $t('adminAccess.map.globeWorldBoundary') }}</span>
      <span>{{ $t('adminAccess.map.globeChinaBoundary', [provinceCount]) }}</span>
      <span>{{ $t('adminAccess.map.globeHint') }}</span>
    </div>
  </div>
</template>

<style scoped>
.admin-globe-3d {
  position: relative;
  width: 100%;
  min-height: 420px;
  overflow: hidden;
  border-radius: 14px;
  background:
    radial-gradient(circle at 50% 44%, rgb(21 79 108 / 40%), transparent 42%),
    radial-gradient(circle at 15% 10%, rgb(34 211 238 / 10%), transparent 38%),
    #06121e;
}

.admin-globe-3d::before,
.admin-globe-3d::after {
  position: absolute;
  content: '';
  pointer-events: none;
}

.admin-globe-3d::before {
  inset: 0;
  opacity: 0.42;
  background-image: radial-gradient(
    rgb(148 163 184 / 26%) 0.7px,
    transparent 0.7px
  );
  background-size: 22px 22px;
  mask-image: linear-gradient(
    to bottom,
    transparent,
    #000 30%,
    #000 70%,
    transparent
  );
}

.admin-globe-3d::after {
  inset: 8% 16%;
  border: 1px solid rgb(103 232 249 / 16%);
  border-radius: 50%;
  box-shadow: 0 0 80px rgb(34 211 238 / 9%);
}

.admin-globe-3d__canvas {
  position: relative;
  z-index: 1;
  display: block;
  width: 100%;
  min-height: 420px;
  cursor: grab;
}

.admin-globe-3d__canvas:active {
  cursor: grabbing;
}

.admin-globe-3d__tooltip,
.admin-globe-3d__meta {
  position: absolute;
  z-index: 2;
  border: 1px solid rgb(148 163 184 / 28%);
  border-radius: 9px;
  background: rgb(5 18 30 / 88%);
  box-shadow: 0 10px 28px rgb(0 0 0 / 26%);
  backdrop-filter: blur(10px);
}

.admin-globe-3d__tooltip {
  display: grid;
  gap: 3px;
  min-width: 160px;
  padding: 9px 11px;
  color: #cbd5e1;
  font-size: 11px;
  pointer-events: none;
}

.admin-globe-3d__tooltip strong {
  color: #f8fafc;
  font-size: 13px;
}

.admin-globe-3d__meta {
  right: 14px;
  bottom: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 7px 10px;
  color: rgb(186 230 253 / 76%);
  font-size: 10px;
}

.admin-globe-3d__fallback {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: grid;
  place-items: center;
  padding: 30px;
  color: #cbd5e1;
  text-align: center;
  background: rgb(6 18 30 / 94%);
}

@media (max-width: 767px) {
  .admin-globe-3d,
  .admin-globe-3d__canvas {
    min-height: 310px;
  }

  .admin-globe-3d__meta {
    right: 8px;
    bottom: 8px;
    left: 8px;
    justify-content: center;
  }
}
</style>
