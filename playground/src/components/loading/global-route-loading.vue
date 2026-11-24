<script lang="ts" setup>
import { computed, onBeforeUnmount, ref } from 'vue';

import { normalizeGlobalLoadingPreset } from '#/api/system/site';
import { $t } from '#/locales';
import { router } from '#/router';
import { useSiteBrand } from '#/site-brand';

import LoadingPresetAnimation from './loading-preset-animation.vue';

/**
 * 全局路由加载指示器（后台「站点配置 → 全局加载动画」的运行时载体）。
 *
 * 工作方式：
 *   - router.beforeEach 计数 +1，afterEach / onError 计数 -1；
 *   - 挂起超过 SHOW_DELAY 才显示——瞬时导航（已缓存页面）不闪；
 *   - 一旦显示至少停留 MIN_VISIBLE——避免「闪一下就消失」的破碎感；
 *   - bar 预设 = 顶部 3px 进度条（不遮挡内容）；其余预设 = 居中深色舞台卡。
 *
 * 指示器接管后，框架默认的路由 spinner 已在 preferences.ts 关闭
 * （transition.loading=false），两套加载 UI 不会叠加。
 */
const SHOW_DELAY = 140;
const MIN_VISIBLE = 300;

const siteBrand = useSiteBrand();
const preset = computed(() =>
  normalizeGlobalLoadingPreset(siteBrand.globalLoadingPreset),
);

const visible = ref(false);
let pending = 0;
let showTimer = 0;
let hideTimer = 0;
let shownAt = 0;

function clearTimers() {
  window.clearTimeout(showTimer);
  window.clearTimeout(hideTimer);
}

function start() {
  pending += 1;
  if (pending === 1) {
    clearTimers();
    showTimer = window.setTimeout(() => {
      visible.value = true;
      shownAt = Date.now();
    }, SHOW_DELAY);
  }
}

function end() {
  pending = Math.max(0, pending - 1);
  if (pending === 0) {
    clearTimers();
    if (visible.value) {
      // 已显示过则至少停留 MIN_VISIBLE，消除闪烁感
      const remain = MIN_VISIBLE - (Date.now() - shownAt);
      hideTimer = window.setTimeout(() => {
        visible.value = false;
      }, Math.max(0, remain));
    }
  }
}

const offBeforeEach = router.beforeEach(() => {
  start();
});
const offAfterEach = router.afterEach(() => {
  end();
});
const offError = router.onError(() => {
  end();
});

onBeforeUnmount(() => {
  offBeforeEach();
  offAfterEach();
  offError();
  clearTimers();
});
</script>

<template>
  <Transition name="bpgl">
    <div
      v-if="visible"
      class="bpgl"
      :class="`bpgl--${preset}`"
      role="status"
      :aria-label="$t('siteSettings.loading.routeLoadingAria')"
    >
      <!-- bar 预设：顶部进度条，不遮挡内容 -->
      <div v-if="preset === 'bar'" class="bpgl__bar">
        <span class="bp-ld__bar"><i></i></span>
      </div>

      <!-- 其余预设：居中舞台卡（深色底，明暗主题下观感一致） -->
      <div v-else class="bpgl__overlay">
        <div class="bpgl__stage">
          <LoadingPresetAnimation kind="loading" :loading-preset="preset" />
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.bpgl__bar {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 3000;
  height: 3px;
  pointer-events: none;
}

.bpgl__overlay {
  position: fixed;
  inset: 0;
  z-index: 2500;
  display: grid;
  place-items: center;
  pointer-events: none;
  background: hsl(var(--background) / 45%);
}

.bpgl__stage {
  width: 150px;
  padding: 18px 22px 12px;
  background: rgb(11 18 32 / 95%);
  border: 1px solid rgb(56 189 248 / 22%);
  border-radius: 18px;
  box-shadow: 0 18px 44px rgb(2 6 18 / 45%);
}

/* 渲染器的 .bp-ld 默认是 absolute 舞台；在固定尺寸的舞台卡里改为随内容撑开 */
.bpgl__stage :deep(.bp-ld) {
  position: relative;
  inset: auto;
  width: 100%;
  min-height: 96px;
}

.bpgl-enter-active,
.bpgl-leave-active {
  transition: opacity 0.18s ease;
}

.bpgl-enter-from,
.bpgl-leave-to {
  opacity: 0;
}
</style>
