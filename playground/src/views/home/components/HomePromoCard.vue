<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { useAdvertisements } from '#/composables/use-advertisements';
import { $t } from '#/locales';

const { items } = useAdvertisements('HOME');
const ads = computed(() => (items.value ?? []).filter((item) => item.title || item.description));
const activeIndex = shallowRef(0);
const swapping = shallowRef(false);
const paused = shallowRef(false);
let swapTimer: ReturnType<typeof setInterval> | undefined;
let swapTimeout: ReturnType<typeof setTimeout> | undefined;
const activeAd = computed(() => ads.value[activeIndex.value]);

watch(ads, (next) => { if (activeIndex.value >= next.length) activeIndex.value = 0; restartTimer(); });

function swapTo(index: number) {
  if (ads.value.length < 2 || swapping.value || paused.value) return;
  swapping.value = true;
  swapTimeout = setTimeout(() => { activeIndex.value = (index + ads.value.length) % ads.value.length; swapping.value = false; }, 450);
}
function restartTimer() {
  if (swapTimer) clearInterval(swapTimer);
  swapTimer = undefined;
  if (typeof window === 'undefined' || ads.value.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches || paused.value) return;
  swapTimer = setInterval(() => swapTo(activeIndex.value + 1), 6500);
}
function pauseTimer() { paused.value = true; if (swapTimer) clearInterval(swapTimer); swapTimer = undefined; }
function resumeTimer() { paused.value = false; restartTimer(); }

onMounted(restartTimer);
onBeforeUnmount(() => { if (swapTimer) clearInterval(swapTimer); if (swapTimeout) clearTimeout(swapTimeout); });
</script>

<template>
  <section v-if="activeAd" class="promo-slot" role="region" :aria-label="$t('page.public.home.v3.promo.tag')" @focusin="pauseTimer" @focusout="resumeTimer" @mouseenter="pauseTimer" @mouseleave="resumeTimer">
    <a v-if="activeAd.linkUrl" class="promo-card" :class="{ 'is-swapping': swapping }" :href="activeAd.linkUrl" :target="activeAd.linkTarget || '_self'" rel="noopener noreferrer">
      <span class="promo-logo promo-fade"><img v-if="activeAd.imageUrl" :alt="activeAd.title" :src="activeAd.imageUrl" loading="lazy" width="120" height="76" /><IconifyIcon v-else icon="lucide:megaphone" /></span>
      <span class="promo-body promo-fade">
        <span class="promo-title-row">
          <span class="promo-tag">{{ $t('page.public.home.v3.promo.tag') }}</span>
          <span class="promo-title">{{ activeAd.title }}</span>
        </span>
        <span class="promo-desc">{{ activeAd.description }}</span>
      </span>
    </a>
    <div v-else class="promo-card" :class="{ 'is-swapping': swapping }">
      <span class="promo-logo promo-fade"><img v-if="activeAd.imageUrl" :alt="activeAd.title" :src="activeAd.imageUrl" loading="lazy" width="120" height="76" /><IconifyIcon v-else icon="lucide:megaphone" /></span>
      <span class="promo-body promo-fade">
        <span class="promo-title-row">
          <span class="promo-tag">{{ $t('page.public.home.v3.promo.tag') }}</span>
          <span class="promo-title">{{ activeAd.title }}</span>
        </span>
        <span class="promo-desc">{{ activeAd.description }}</span>
      </span>
    </div>
  </section>
</template>

<style scoped>
.promo-slot { margin-top: 18px; }
.promo-card {
  position: relative;
  display: flex;
  gap: 22px;
  align-items: center;
  overflow: hidden;
  padding: 18px 22px;
  color: inherit;
  text-decoration: none;
  background: var(--home-surface-strong);
  border: 1px solid var(--home-border);
  border-radius: 18px;
  box-shadow: var(--home-card-shadow);
  transition: border-color 0.25s cubic-bezier(0.22, 0.61, 0.36, 1), transform 0.25s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.promo-card:hover {
  border-color: rgb(var(--home-primary-rgb) / 40%);
  transform: translateY(-2px);
}
.promo-card.is-swapping > * { opacity: 0; }
.promo-fade { transition: opacity 0.45s cubic-bezier(0.22, 0.61, 0.36, 1); }
.promo-logo {
  display: grid;
  flex: none;
  place-items: center;
  width: 120px;
  height: 76px;
  overflow: hidden;
  font-size: 30px;
  color: var(--home-primary);
  background: var(--home-image-background, #fff);
  border: 1px solid var(--home-border);
  border-radius: 14px;
}
.promo-logo img { width: 100%; height: 100%; object-fit: contain; }
.promo-logo svg { font-size: 30px; }
.promo-body { flex: 1; min-width: 0; }
.promo-title-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.promo-tag {
  flex: none;
  padding: 2px 9px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--home-primary);
  background: rgb(var(--home-primary-rgb) / 12%);
  border: 1px solid rgb(var(--home-primary-rgb) / 30%);
  border-radius: 7px;
}
.promo-title { font-size: 16.5px; font-weight: 800; color: var(--home-heading); }
.promo-desc {
  display: -webkit-box;
  margin-top: 6px;
  overflow: hidden;
  font-size: 13px;
  line-height: 1.7;
  color: var(--home-muted);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
@media (max-width: 760px) {
  .promo-card { gap: 14px; flex-wrap: wrap; padding: 16px; }
  .promo-logo { width: 56px; height: 56px; }
  .promo-body { flex: 1 1 0; min-width: 0; }
  .promo-title { font-size: 15px; }
  .promo-desc { display: none; }
}
@media (max-width: 640px) {
  .promo-logo { width: 64px; height: 64px; border-radius: 12px; }
}
@media (prefers-reduced-motion: reduce) { .promo-card, .promo-fade { transition: none; } }
</style>
