<script setup lang="ts">
import type { Object3D } from 'three';

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

export interface MonitoringGlobePoint {
  callCount: number;
  latitude: number | string;
  longitude: number | string;
  region: string;
  riskHits?: number;
  riskLevel?: 'CRITICAL' | 'HIGH' | 'LOW' | 'MEDIUM';
}

const props = withDefaults(
  defineProps<{
    autoRotate?: boolean;
    emptyLabel?: string;
    points: MonitoringGlobePoint[];
    unavailableLabel?: string;
  }>(),
  {
    autoRotate: true,
    emptyLabel: '',
    unavailableLabel: '',
  },
);

const root = useTemplateRef<HTMLDivElement>('root');
const renderer = shallowRef<THREE.WebGLRenderer>();
const scene = shallowRef<THREE.Scene>();
const camera = shallowRef<THREE.PerspectiveCamera>();
const controls = shallowRef<OrbitControls>();
const globeGroup = shallowRef<THREE.Group>();
const hasPoints = computed(() => props.points.length > 0);
const renderUnavailable = ref(false);

let animationFrame = 0;
let resizeFrame = 0;
let resizeObserver: ResizeObserver | undefined;
let themeObserver: MutationObserver | undefined;
let lastHeight = 0;
let lastPixelRatio = 0;
let lastWidth = 0;
let pointMeshes: THREE.Mesh[] = [];
let pointMaterials: THREE.MeshBasicMaterial[] = [];
let pointSource: Object3D | undefined;
let clock: THREE.Clock | undefined;

const COLORS = {
  CRITICAL: 0xef4444,
  HIGH: 0xf97316,
  MEDIUM: 0xeab308,
  LOW: 0x22c55e,
};

function colorFor(point: MonitoringGlobePoint) {
  return COLORS[point.riskLevel ?? 'LOW'];
}

function latLonToVector3(latitude: number, longitude: number, radius: number) {
  const phi = (90 - latitude) * (Math.PI / 180);
  const theta = (longitude + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function clearPointLayer() {
  if (!globeGroup.value) return;
  for (const mesh of pointMeshes) {
    globeGroup.value.remove(mesh);
    mesh.geometry.dispose();
  }
  for (const material of pointMaterials) material.dispose();
  pointMeshes = [];
  pointMaterials = [];
  if (!pointSource) return;
  globeGroup.value.remove(pointSource);
  pointSource.traverse((child) => {
    if (child instanceof THREE.Line) {
      child.geometry.dispose();
      (child.material as THREE.Material).dispose();
    }
  });
  pointSource = undefined;
}

function rebuildPointLayer() {
  if (!globeGroup.value) return;
  clearPointLayer();
  pointSource = new THREE.Group();
  const source = pointSource;
  const gateway = latLonToVector3(30, 110, 1.015);

  for (const point of props.points) {
    const latitude = Number(point.latitude);
    const longitude = Number(point.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    const position = latLonToVector3(latitude, longitude, 1.04);
    const size = Math.max(
      0.018,
      Math.min(0.06, Math.sqrt(point.callCount || 1) / 400),
    );
    const material = new THREE.MeshBasicMaterial({
      color: colorFor(point),
      transparent: true,
      opacity: 0.95,
    });
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(size, 12, 8),
      material,
    );
    mesh.position.copy(position);
    mesh.userData.point = point;
    globeGroup.value.add(mesh);
    pointMeshes.push(mesh);
    pointMaterials.push(material);

    const midpoint = position.clone().add(gateway).multiplyScalar(0.5);
    midpoint.normalize().multiplyScalar(1.28);
    const curve = new THREE.QuadraticBezierCurve3(position, midpoint, gateway);
    source.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(curve.getPoints(24)),
        new THREE.LineBasicMaterial({
          color: colorFor(point),
          transparent: true,
          opacity: 0.42,
        }),
      ),
    );
  }
  globeGroup.value.add(source);
}

function updateTheme() {
  const dark = document.documentElement.classList.contains('dark');
  if (scene.value) {
    scene.value.fog = new THREE.Fog(dark ? 0x020617 : 0xf8fafc, 3, 7);
  }
  const globeMaterial = globeGroup.value?.userData
    .globeMaterial as THREE.LineBasicMaterial | undefined;
  globeMaterial?.color.setHex(dark ? 0x38bdf8 : 0x0284c7);
}

function resize() {
  const element = root.value;
  if (!element || !camera.value || !renderer.value) return;
  const width = Math.max(1, Math.round(element.clientWidth));
  const height = Math.max(1, Math.round(element.clientHeight));
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
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
  if (resizeFrame) return;
  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = 0;
    resize();
  });
}

function animate() {
  if (!scene.value || !camera.value || !renderer.value || !globeGroup.value) {
    return;
  }
  const elapsed = clock?.getElapsedTime() ?? 0;
  if (
    props.autoRotate &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    globeGroup.value.rotation.y += 0.0018;
  }
  pointMeshes.forEach((mesh, index) => {
    mesh.scale.setScalar(1 + Math.sin(elapsed * 2.4 + index * 0.8) * 0.14);
  });
  controls.value?.update();
  renderer.value.render(scene.value, camera.value);
  animationFrame = requestAnimationFrame(animate);
}

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

function disposeScene() {
  cancelAnimationFrame(animationFrame);
  cancelAnimationFrame(resizeFrame);
  resizeObserver?.disconnect();
  themeObserver?.disconnect();
  window.removeEventListener('resize', scheduleResize);
  clearPointLayer();
  controls.value?.dispose();
  globeGroup.value?.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
      child.geometry.dispose();
      (child.material as THREE.Material).dispose();
    }
  });
  renderer.value?.dispose();
  root.value?.replaceChildren();
  lastHeight = 0;
  lastPixelRatio = 0;
  lastWidth = 0;
}

onMounted(() => {
  if (!root.value) return;
  if (!supportsWebGL()) {
    renderUnavailable.value = true;
    return;
  }
  try {
    const nextScene = new THREE.Scene();
    const nextCamera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
    nextCamera.position.set(0, 0.05, 3.4);
    const nextRenderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    nextRenderer.outputColorSpace = THREE.SRGBColorSpace;
    root.value.append(nextRenderer.domElement);

    const group = new THREE.Group();
    const globe = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.SphereGeometry(1, 28, 18)),
      new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.36,
      }),
    );
    group.add(globe);
    group.userData.globeMaterial = globe.material;
    group.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(0.985, 32, 20),
        new THREE.MeshBasicMaterial({
          color: 0x0f172a,
          transparent: true,
          opacity: 0.24,
        }),
      ),
    );
    nextScene.add(group);
    nextScene.add(new THREE.AmbientLight(0xffffff, 1));
    nextScene.fog = new THREE.Fog(0x020617, 3, 7);

    const nextControls = new OrbitControls(nextCamera, nextRenderer.domElement);
    nextControls.enablePan = false;
    nextControls.enableZoom = true;
    nextControls.enableDamping = true;
    nextControls.dampingFactor = 0.05;
    nextControls.minDistance = 2.65;
    nextControls.maxDistance = 4.6;

    scene.value = nextScene;
    camera.value = nextCamera;
    renderer.value = nextRenderer;
    controls.value = nextControls;
    globeGroup.value = group;
    clock = new THREE.Clock();
    resizeObserver = new ResizeObserver(scheduleResize);
    resizeObserver.observe(root.value);
    window.addEventListener('resize', scheduleResize, { passive: true });
    themeObserver = new MutationObserver(updateTheme);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    updateTheme();
    rebuildPointLayer();
    scheduleResize();
    animate();
  } catch {
    disposeScene();
    renderUnavailable.value = true;
  }
});

watch(() => props.points, rebuildPointLayer, { deep: true });
onBeforeUnmount(disposeScene);
</script>

<template>
  <div ref="root" class="monitoring-globe" role="img" :aria-label="emptyLabel">
    <div v-if="renderUnavailable" class="monitoring-globe__fallback">
      <div class="monitoring-globe__fallback-visual" aria-hidden="true"></div>
      <span>{{ unavailableLabel || emptyLabel }}</span>
    </div>
    <div v-else-if="!hasPoints" class="monitoring-globe__empty">
      {{ emptyLabel }}
    </div>
  </div>
</template>

<style scoped>
.monitoring-globe {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 320px;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 45%, rgb(14 165 233 / 16%), transparent 48%),
    linear-gradient(180deg, hsl(var(--card)), hsl(var(--background)));
}

.monitoring-globe :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}

.monitoring-globe__empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  font-size: 13px;
  color: rgb(100 116 139);
  pointer-events: none;
}

.monitoring-globe__fallback {
  position: absolute;
  inset: 0;
  z-index: 1;
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

.monitoring-globe__fallback-visual {
  width: min(48vw, 210px);
  aspect-ratio: 1;
  background:
    linear-gradient(90deg, transparent 48%, rgb(14 165 233 / 42%) 50%, transparent 52%),
    linear-gradient(transparent 48%, rgb(14 165 233 / 42%) 50%, transparent 52%),
    repeating-radial-gradient(circle, transparent 0 20%, rgb(14 165 233 / 28%) 21% 22%);
  border: 1px solid rgb(14 165 233 / 52%);
  border-radius: 50%;
  box-shadow: inset 0 0 42px rgb(14 165 233 / 14%);
}

html.dark .monitoring-globe__empty {
  color: rgb(148 163 184);
}

html.dark .monitoring-globe__fallback {
  color: rgb(148 163 184);
}
</style>
