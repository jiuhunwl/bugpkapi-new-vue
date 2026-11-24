<script setup lang="ts">
import type { HomeApi } from '#/api/home';

import { onBeforeUnmount, onMounted, shallowRef } from 'vue';

import PublicSiteFooter from '#/components/public-site-footer.vue';
import PublicSiteHeader from '#/components/public-site-header.vue';
import { usePublicSiteTheme } from '#/composables/use-public-site-theme';
import { $t } from '#/locales';
import type { VNode } from 'vue';

type PublicNavKey =
  | 'apis'
  | 'donate'
  | 'home'
  | 'legal'
  | 'links'
  | 'market'
  | 'opensource';

const props = withDefaults(
  defineProps<{
    activeKey?: PublicNavKey;
    announcement?: string;
    mainId?: string;
    repositoryUrl?: string;
    siteConfig?: Partial<HomeApi.SiteConfig>;
  }>(),
  { activeKey: 'home', announcement: '', mainId: 'main-content', repositoryUrl: '' },
);

defineSlots<{
  default?: () => VNode[];
  'after-main'?: () => VNode[];
  'before-main'?: () => VNode[];
}>();

const { siteThemeVars } = usePublicSiteTheme();
const noticeVisible = shallowRef(true);

onMounted(() => {
  document.documentElement.dataset.publicSite = 'active';
});

onBeforeUnmount(() => {
  delete document.documentElement.dataset.publicSite;
});
</script>

<template>
  <div class="public-site-shell" :style="siteThemeVars">
    <div class="bg-deco" aria-hidden="true">
      <div class="bg-grid"></div>
      <div class="bg-aurora a1"></div>
      <div class="bg-aurora a2"></div>
      <div class="bg-aurora a3"></div>
    </div>

    <slot name="before-main">
      <div v-if="props.announcement && noticeVisible" class="notice" role="status">
        <span class="dot"></span>
        <span class="notice-label">{{ $t('page.public.home.v3.notice.label') }}</span>
        <div class="marquee" aria-live="polite">
          <div class="marquee-track">
            <span>{{ props.announcement }}</span>
            <span aria-hidden="true">{{ props.announcement }}</span>
          </div>
        </div>
        <button
          class="notice-close"
          :aria-label="$t('page.public.home.v3.notice.close')"
          type="button"
          @click="noticeVisible = false"
        >
          ✕
        </button>
      </div>
    </slot>
    <PublicSiteHeader
      :active-key="props.activeKey"
      :repository-url="props.repositoryUrl"
    />
    <main
      :id="props.mainId"
      class="public-site-main"
      :aria-label="$t('page.public.shell.mainLabel')"
    >
      <slot />
    </main>
    <slot name="after-main" />
    <PublicSiteFooter :site-config="props.siteConfig" />
  </div>
</template>

<style scoped>
.public-site-shell {
  position: relative;
  min-height: 100vh;
  overflow-x: clip;
  color: var(--ps-text, var(--home-text));
  background: var(--ps-bg, var(--home-background));
}

/* ---------- 背景装饰：网格 + 极光 ---------- */
.bg-deco {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}
.bg-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--home-grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--home-grid-line) 1px, transparent 1px);
  background-size: 56px 56px;
  -webkit-mask-image: radial-gradient(ellipse 90% 60% at 50% 0%, #000 30%, transparent 80%);
  mask-image: radial-gradient(ellipse 90% 60% at 50% 0%, #000 30%, transparent 80%);
}
.bg-aurora {
  position: absolute;
  border-radius: 50%;
  filter: blur(110px);
  opacity: 0.55;
}
.bg-aurora.a1 {
  top: -260px;
  left: -120px;
  width: 640px;
  height: 640px;
  background: radial-gradient(circle, rgb(79 140 255 / 50%), transparent 65%);
}
.bg-aurora.a2 {
  top: -180px;
  right: -100px;
  width: 520px;
  height: 520px;
  background: radial-gradient(circle, rgb(139 92 246 / 42%), transparent 65%);
}
.bg-aurora.a3 {
  top: 520px;
  left: 38%;
  width: 460px;
  height: 460px;
  background: radial-gradient(circle, rgb(34 211 238 / 24%), transparent 65%);
}
@media (max-width: 640px) {
  .bg-aurora { filter: blur(80px); }
  .bg-aurora.a1 { width: 420px; height: 420px; }
  .bg-aurora.a2 { width: 360px; height: 360px; }
}
@media (prefers-reduced-motion: reduce) {
  .bg-deco { display: none; }
}

.public-site-main {
  position: relative;
  z-index: 1;
  width: min(1200px, calc(100% - 40px));
  margin: 0 auto;
}

/* ---------- 滚动公告 ---------- */
.notice {
  position: relative;
  z-index: 50;
  display: flex;
  gap: 12px;
  align-items: center;
  height: 42px;
  padding: 0 40px 0 16px;
  font-size: 13px;
  color: var(--home-muted);
  background: linear-gradient(90deg, rgb(79 140 255 / 14%), rgb(139 92 246 / 12%), rgb(34 211 238 / 10%));
  border-bottom: 1px solid var(--home-border);
}
.notice .dot {
  flex: none;
  width: 7px;
  height: 7px;
  background: var(--home-success);
  border-radius: 50%;
  box-shadow: 0 0 10px var(--home-success);
  animation: notice-pulse 2.2s infinite;
}
.notice-label {
  flex: none;
  padding: 2px 9px;
  font-size: 11.5px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--home-primary);
  background: rgb(var(--home-primary-rgb) / 14%);
  border: 1px solid rgb(var(--home-primary-rgb) / 30%);
  border-radius: 999px;
}
.marquee {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 3%, #000 97%, transparent);
  mask-image: linear-gradient(90deg, transparent, #000 3%, #000 97%, transparent);
}
.marquee-track {
  display: flex;
  width: max-content;
  white-space: nowrap;
  animation: notice-marquee 36s linear infinite;
}
.marquee:hover .marquee-track,
.marquee:focus-within .marquee-track {
  animation-play-state: paused;
}
.marquee-track span {
  padding-right: 90px;
}
@keyframes notice-marquee {
  to { transform: translateX(-50%); }
}
@keyframes notice-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
.notice-close {
  position: absolute;
  top: 50%;
  right: 8px;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  font-size: 14px;
  color: var(--home-text-faint);
  cursor: pointer;
  background: none;
  border: 0;
  border-radius: 8px;
  translate: 0 -50%;
}
.notice-close:hover {
  color: var(--home-text);
  background: var(--home-surface);
}
@media (max-width: 520px) {
  .notice {
    gap: 9px;
    padding-right: 40px;
    font-size: 12px;
  }
  .notice-label { display: none; }
  .marquee-track span { padding-right: 56px; }
}
@media (prefers-reduced-motion: reduce) {
  .marquee-track { animation: none; }
  .notice .dot { animation: none; }
}
</style>

<style>
/* ---------- 公共页全局细节（覆盖 shell 内所有页面） ----------
   这几条来自已敲定的 v4 设计稿，此前只存在于 HTML 稿、未迁到 Vue：
   1. html 滚动行为：锚点跳转（如 hero 的「常见问题」按钮）平滑滚动，
      不再瞬移。reduced-motion 用户由 responsive.css 里既有的
      html { scroll-behavior: auto !important } 兜底关闭。
   2. 文字选中色：默认的系统蓝与品牌色无关，改为品牌主色 35% 透明度。
   3. 键盘焦点环：仅键盘聚焦（:focus-visible）时出现，鼠标点击不显示；
      outline 自动跟随各元素自身圆角，暗色模式经 siteThemeVars 自适配。
      裸 input/textarea 有意排除——搜索框由外层 :focus-within 提供焦点态、
      友链申请表单有自己的 :focus 规则，叠加会出现双环或特异性竞争。
      各页面已有的 focus-visible 规则（market 筛选条、donate、docs）
      特异性更高，优先生效。 */
html {
  scroll-behavior: smooth;
}

.public-site-shell ::selection {
  background: rgb(var(--home-primary-rgb) / 35%);
}

.public-site-shell :is(a, button, select, [tabindex]):focus-visible {
  outline: 2px solid rgb(var(--home-primary-rgb) / 60%);
  outline-offset: 2px;
}
</style>
