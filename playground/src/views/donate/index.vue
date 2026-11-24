<script setup lang="ts">
import type { DonationApi } from '#/api/donation';

import { computed, onMounted, shallowRef } from 'vue';

import {
  hasOfflineIcon,
  IconifyIcon,
  resolveFallbackName,
  resolveLocalIcon,
  RotateCw,
  SvgQQChatIcon,
  SvgWeChatIcon,
} from '@vben/icons';

import PublicSiteShell from '#/components/public-site-shell.vue';
import { usePublicDonation } from '#/composables/use-public-donation';
import { usePublicDonationSupporters } from '#/composables/use-public-donation-supporters';
import { $t } from '#/locales';
import { DEFAULT_SITE_NAME, useSiteBrand } from '#/site-brand';

import DonationSupporterList from './components/DonationSupporterList.vue';

const siteBrand = useSiteBrand();
const { config, error, load, loading } = usePublicDonation();
const {
  error: supporterError,
  hasMore: hasMoreSupporters,
  items: supporters,
  loadMore: loadMoreSupporters,
  loading: supportersLoading,
  loadingMore: supportersLoadingMore,
  reload: reloadSupporters,
  total: supporterTotal,
} = usePublicDonationSupporters();

const brandName = computed(() => siteBrand.siteName || DEFAULT_SITE_NAME);

const footerSiteConfig = computed(() => ({
  description: '',
  logoUrl: siteBrand.logoUrl || '',
  siteName: brandName.value,
}));

const preview = shallowRef<null | {
  name: string;
  qrCodeUrl: string;
  tip: string;
}>(null);

const pageCopy = computed(() => ({
  description:
    config.value?.description || $t('page.public.donate.description'),
  eyebrow: config.value?.eyebrow || $t('page.public.donate.eyebrow'),
  scanDescription:
    config.value?.scanDescription || $t('page.public.donate.scanDescription'),
  scanTitle: config.value?.scanTitle || $t('page.public.donate.scanTitle'),
  thanks: config.value?.thanks || $t('page.public.donate.thanks'),
  title: config.value?.title || $t('page.public.donate.title'),
}));

const isPublished = computed(() => config.value?.enabled === 1);
const methods = computed(() =>
  (config.value?.methods ?? [])
    .filter((method) => method.enabled === 1 && method.qrCodeUrl)
    .sort((first, second) => first.sortNo - second.sortNo),
);

const heroFigures = computed(() => [
  {
    key: 'methods',
    label: $t('page.public.donate.stats.methods'),
    value: String(methods.value.length),
  },
  {
    key: 'supporters',
    label: $t('page.public.donate.stats.supporters'),
    value: String(supporterTotal.value),
  },
]);

// 赞赏方式的图标名来自数据库，离线构建里 simple-icons 这类前缀并不存在，
// 未命中时会静默渲染空白；空白时用名称首字兜底，保证渠道卡永远有视觉锚点。
function glyphKind(method: DonationApi.Method): 'icon' | 'initial' | 'qq' {
  const name = method.icon.trim();
  if (name === 'simple-icons:wechat' || name === 'svg:wechat') return 'icon';
  if (name === 'simple-icons:tencentqq' || name === 'svg:qq') return 'qq';
  if (!name) return 'initial';
  const exists = (candidate: string) =>
    Boolean(resolveLocalIcon(candidate)) || hasOfflineIcon(candidate);
  return exists(name) || exists(resolveFallbackName(name, exists) ?? '')
    ? 'icon'
    : 'initial';
}

function isWeChatIcon(method: DonationApi.Method) {
  const name = method.icon.trim();
  return name === 'simple-icons:wechat' || name === 'svg:wechat';
}

function methodInitial(name: string) {
  return Array.from(name.trim())[0]?.toLocaleUpperCase() || '?';
}

// 后台允许填任意颜色串，直接拼进 CSS 会变成声明注入，只接受十六进制色值。
function brandTint(color: string) {
  return /^#[\da-f]{3,8}$/i.test(color.trim()) ? color.trim() : '';
}

function platStyle(method: DonationApi.Method) {
  const color = brandTint(method.color);
  return color
    ? { color, '--dm-brand': color }
    : { '--dm-brand': 'var(--home-primary)' };
}

function openPreview(method: DonationApi.Method) {
  preview.value = {
    name: method.name,
    qrCodeUrl: method.qrCodeUrl,
    tip: method.tip,
  };
}

function closePreview() {
  preview.value = null;
}

function reloadPage() {
  void load();
  void reloadSupporters();
}

onMounted(reloadPage);
</script>

<template>
  <PublicSiteShell
    active-key="donate"
    class="donate-page"
    :site-config="footerSiteConfig"
  >
    <section class="dt-head">
      <div class="dt-head-copy">
        <span class="dt-eyebrow">
          <IconifyIcon aria-hidden="true" icon="lucide:heart" />
          {{ pageCopy.eyebrow }}
        </span>
        <h1>{{ pageCopy.title }}</h1>
        <p>{{ pageCopy.description }}</p>
        <div v-if="isPublished && methods.length > 0" class="dt-ctas">
          <a class="dt-btn dt-btn-primary" href="#dt-methods">
            {{ pageCopy.scanTitle }} →
          </a>
          <a class="dt-btn dt-btn-ghost" href="#dt-supporters">
            {{ $t('page.public.donate.supporters.title') }}
          </a>
        </div>
      </div>

      <dl v-if="isPublished" class="dt-figures">
        <div v-for="figure in heroFigures" :key="figure.key" class="dt-figure">
          <dd>{{ figure.value }}</dd>
          <dt>{{ figure.label }}</dt>
        </div>
      </dl>
    </section>

    <section class="dt-body">
      <section class="dt-section" id="dt-methods">
        <header class="dt-sec-head">
          <div class="dt-sec-title">
            <h2>{{ pageCopy.scanTitle }}</h2>
            <p>{{ pageCopy.scanDescription }}</p>
          </div>
          <span v-if="isPublished && methods.length > 0" class="dt-chip">
            <IconifyIcon aria-hidden="true" icon="lucide:maximize-2" />
            {{ $t('page.public.donate.previewHint') }}
          </span>
        </header>

        <div v-if="loading" class="dt-state" aria-live="polite">
          <IconifyIcon
            class="dt-state-icon is-spinning"
            icon="lucide:loader-circle"
          />
          <strong>{{ $t('page.public.donate.states.loadingTitle') }}</strong>
          <span>{{ $t('page.public.donate.states.loadingDescription') }}</span>
        </div>

        <div v-else-if="error" class="dt-state" role="alert">
          <IconifyIcon class="dt-state-icon" icon="lucide:cloud-off" />
          <strong>{{ $t('page.public.donate.states.errorTitle') }}</strong>
          <span>{{ $t('page.public.donate.states.errorDescription') }}</span>
          <button class="dt-btn dt-btn-ghost dt-btn-sm" type="button" @click="reloadPage">
            <RotateCw class="size-4" />
            {{ $t('page.public.donate.states.retry') }}
          </button>
        </div>

        <div v-else-if="!isPublished" class="dt-state">
          <IconifyIcon class="dt-state-icon" icon="lucide:heart-off" />
          <strong>{{ $t('page.public.donate.states.disabledTitle') }}</strong>
          <span>{{ $t('page.public.donate.states.disabledDescription') }}</span>
        </div>

        <div v-else-if="methods.length === 0" class="dt-state">
          <IconifyIcon class="dt-state-icon" icon="lucide:qr-code" />
          <strong>{{ $t('page.public.donate.states.emptyTitle') }}</strong>
          <span>{{ $t('page.public.donate.states.emptyDescription') }}</span>
        </div>

        <ul v-else class="dt-methods" :data-count="Math.min(methods.length, 3)">
          <li
            v-for="(method, index) in methods"
            :key="method.key"
            class="dt-card dm-card"
            data-testid="donate-method-card"
          >
            <div class="dm-head">
              <span class="dm-plat" :style="platStyle(method)">
                <SvgWeChatIcon v-if="isWeChatIcon(method)" />
                <SvgQQChatIcon v-else-if="glyphKind(method) === 'qq'" />
                <IconifyIcon
                  v-else-if="glyphKind(method) === 'icon'"
                  aria-hidden="true"
                  :icon="method.icon"
                />
                <span v-else class="dm-initial">{{ methodInitial(method.name) }}</span>
              </span>
              <h3 class="dm-name">{{ method.name }}</h3>
              <span
                v-if="index === 0 && methods.length > 1"
                class="dm-rec"
              >
                {{ $t('page.public.donate.recommended') }}
              </span>
            </div>

            <button
              class="dm-qr"
              type="button"
              :aria-label="$t('page.public.donate.aria.previewCode', [method.name])"
              @click="openPreview(method)"
            >
              <img
                :alt="$t('page.public.donate.aria.payCode', [method.name])"
                class="dm-qr-img"
                loading="lazy"
                :src="method.qrCodeUrl"
              />
              <span class="dm-qr-mask">
                <IconifyIcon aria-hidden="true" icon="lucide:maximize-2" />
                {{ $t('page.public.donate.previewHint') }}
              </span>
            </button>

            <p v-if="method.tip" class="dm-tip">
              <IconifyIcon aria-hidden="true" icon="lucide:smartphone" />
              <span>{{ method.tip }}</span>
            </p>
          </li>
        </ul>

        <div v-if="!loading && !error && isPublished" class="dt-note">
          <span class="dt-note-head">
            <IconifyIcon aria-hidden="true" icon="lucide:info" />
            {{ $t('page.public.donate.note.title') }}
          </span>
          <p>{{ $t('page.public.donate.note.usage') }}</p>
        </div>
      </section>

      <DonationSupporterList
        v-if="isPublished"
        id="dt-supporters"
        :error="supporterError"
        :has-more="hasMoreSupporters"
        :items="supporters"
        :loading="supportersLoading"
        :loading-more="supportersLoadingMore"
        :total="supporterTotal"
        @load-more="loadMoreSupporters"
        @retry="reloadSupporters"
      />

      <p v-if="!loading && !error && isPublished" class="dt-thanks">
        <IconifyIcon aria-hidden="true" icon="lucide:heart" />
        {{ pageCopy.thanks }}
      </p>
    </section>

    <Transition name="dt-fade">
      <div
        v-if="preview"
        class="dt-overlay"
        aria-modal="true"
        role="dialog"
        :aria-label="$t('page.public.donate.aria.viewPayCode', [preview.name])"
        @click.self="closePreview"
      >
        <div class="dt-modal">
          <header class="dt-modal-head">
            <IconifyIcon aria-hidden="true" icon="lucide:qr-code" />
            <strong>{{ $t('page.public.donate.payCodeTitle', [preview.name]) }}</strong>
            <button
              class="dt-modal-close"
              type="button"
              :aria-label="$t('page.public.donate.aria.closePreview')"
              @click="closePreview"
            >
              <IconifyIcon aria-hidden="true" icon="lucide:x" />
            </button>
          </header>
          <div class="dt-modal-body">
            <img
              :alt="$t('page.public.donate.aria.payCode', [preview.name])"
              class="dt-modal-qr"
              :src="preview.qrCodeUrl"
            />
          </div>
          <p v-if="preview.tip" class="dt-modal-foot">
            <IconifyIcon aria-hidden="true" icon="lucide:smartphone" />
            {{ preview.tip }}
          </p>
        </div>
      </div>
    </Transition>
  </PublicSiteShell>
</template>

<style scoped>
/* ---------- 页头 ---------- */
.dt-head {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  align-items: end;
  justify-content: space-between;
  padding: 48px 0 4px;
}

.dt-head-copy {
  min-width: 0;
}

.dt-eyebrow {
  display: inline-flex;
  gap: 7px;
  align-items: center;
  margin-bottom: 12px;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--home-primary);
}

.dt-eyebrow svg {
  font-size: 13px;
}

.dt-head h1 {
  font-size: clamp(27px, 3.6vw, 42px);
  font-weight: 800;
  letter-spacing: -0.4px;
  line-height: 1.2;
  color: var(--home-heading);
}

.dt-head h1 span.grad,
.dt-head :deep(.grad) {
  background: var(--home-grad);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.dt-head p {
  max-width: 68ch;
  margin-top: 10px;
  font-size: 14px;
  line-height: 1.85;
  color: var(--home-muted);
}

.dt-ctas {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 22px;
}

.dt-figures {
  display: flex;
  gap: 12px;
  flex: none;
  margin: 0;
  padding: 0;
}

.dt-figure {
  min-width: 108px;
  padding: 14px 18px;
  background: var(--home-surface-strong);
  border: 1px solid var(--home-border);
  border-radius: 16px;
  box-shadow: var(--home-card-shadow);
}

.dt-figure dd {
  margin: 0;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 26px;
  font-weight: 800;
  line-height: 1.1;
  color: var(--home-primary);
  font-variant-numeric: tabular-nums;
}

.dt-figure dt {
  margin-top: 5px;
  font-size: 12px;
  color: var(--home-muted);
}

/* ---------- 正文容器 ---------- */
.dt-body {
  padding: 8px 0 56px;
}

.dt-section {
  padding-top: 34px;
}

.dt-sec-head {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.dt-sec-title h2 {
  font-size: clamp(19px, 2.4vw, 25px);
  font-weight: 800;
  letter-spacing: -0.3px;
  color: var(--home-heading);
}

.dt-sec-title p {
  margin-top: 6px;
  font-size: 13.5px;
  color: var(--home-muted);
}

.dt-chip {
  display: inline-flex;
  flex: none;
  gap: 7px;
  align-items: center;
  padding: 7px 14px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--home-primary);
  background: rgb(var(--home-primary-rgb) / 8%);
  border: 1px solid rgb(var(--home-primary-rgb) / 26%);
  border-radius: 999px;
}

.dt-chip svg {
  font-size: 14px;
}

/* ---------- 卡片通用 ---------- */
.dt-card {
  background: var(--home-surface-strong);
  border: 1px solid var(--home-border);
  border-radius: 16px;
  box-shadow: var(--home-card-shadow);
  transition:
    border-color 0.22s cubic-bezier(0.22, 0.61, 0.36, 1),
    box-shadow 0.22s cubic-bezier(0.22, 0.61, 0.36, 1),
    transform 0.22s cubic-bezier(0.22, 0.61, 0.36, 1);
}

.dt-card:hover {
  border-color: rgb(var(--home-primary-rgb) / 40%);
  box-shadow: 0 14px 34px var(--home-shadow);
  transform: translateY(-2px);
}

/* ---------- 按钮 ---------- */
.dt-btn {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 22px;
  font-size: 14.5px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  border: 0;
  border-radius: 13px;
  transition: all 0.2s cubic-bezier(0.22, 0.61, 0.36, 1);
}

.dt-btn-primary {
  color: #fff;
  background: var(--home-grad);
  box-shadow: 0 8px 24px rgb(var(--home-primary-rgb) / 34%);
}

.dt-btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 30px rgb(var(--home-primary-rgb) / 46%);
}

.dt-btn-ghost {
  color: var(--home-text);
  background: var(--home-surface);
  border: 1px solid var(--home-border);
}

.dt-btn-ghost:hover {
  border-color: var(--home-border-strong);
  transform: translateY(-1px);
}

.dt-btn-sm {
  min-height: 38px;
  padding: 0 16px;
  font-size: 13px;
}

/* ---------- 赞赏渠道卡 ---------- */
.dt-methods {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(232px, 1fr));
  gap: 16px;
  padding: 0;
  margin: 0;
  list-style: none;
}

/* 只有 1-2 个渠道时撑满整行会变成两张巨型卡片，这里限宽保持居中节奏。 */
.dt-methods[data-count='2'] {
  grid-template-columns: repeat(2, minmax(0, 340px));
  justify-content: center;
}

.dt-methods[data-count='1'] {
  grid-template-columns: minmax(0, 340px);
  justify-content: center;
}

.dm-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  padding: 18px 18px 20px;
}

.dm-head {
  display: flex;
  gap: 11px;
  align-items: center;
  min-width: 0;
}

.dm-plat {
  display: grid;
  flex: none;
  place-items: center;
  width: 42px;
  height: 42px;
  overflow: hidden;
  color: var(--dm-brand, var(--home-primary));
  background: color-mix(in srgb, var(--dm-brand, var(--home-primary)) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--dm-brand, var(--home-primary)) 26%, transparent);
  border-radius: 12px;
}

.dm-plat svg {
  width: 22px;
  height: 22px;
}

.dm-initial {
  font-size: 17px;
  font-weight: 800;
  line-height: 1;
}

.dm-name {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font-size: 15.5px;
  font-weight: 700;
  color: var(--home-heading);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dm-rec {
  flex: none;
  padding: 3px 9px;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 10.5px;
  font-weight: 700;
  color: var(--home-primary);
  background: rgb(var(--home-primary-rgb) / 10%);
  border: 1px solid rgb(var(--home-primary-rgb) / 30%);
  border-radius: 999px;
}

.dm-qr {
  position: relative;
  display: block;
  width: min(100%, 176px);
  padding: 10px;
  margin: 0 auto;
  overflow: hidden;
  cursor: zoom-in;
  background: var(--home-image-background);
  border: 1px solid var(--home-border);
  border-radius: 14px;
  transition: border-color 0.2s ease;
}

.dm-qr:hover {
  border-color: rgb(var(--home-primary-rgb) / 45%);
}

.dm-qr:focus-visible {
  outline: 2px solid rgb(var(--home-primary-rgb) / 60%);
  outline-offset: 3px;
}

.dm-qr-img {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  object-fit: contain;
}

.dm-qr-mask {
  position: absolute;
  inset: 10px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  pointer-events: none;
  background: rgb(12 20 40 / 62%);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.dm-qr-mask svg {
  font-size: 18px;
}

.dm-qr:hover .dm-qr-mask,
.dm-qr:focus-visible .dm-qr-mask {
  opacity: 1;
}

.dm-tip {
  display: flex;
  gap: 7px;
  align-items: flex-start;
  margin: 0;
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--home-muted);
}

.dm-tip svg {
  flex: none;
  margin-top: 3px;
  font-size: 13px;
  color: var(--home-primary);
}

/* ---------- 状态卡 ---------- */
.dt-state {
  display: grid;
  gap: 8px;
  place-items: center;
  min-height: 220px;
  padding: 34px 24px;
  text-align: center;
  background: var(--home-surface-subtle);
  border: 1px dashed var(--home-border-strong);
  border-radius: 16px;
}

.dt-state strong {
  font-size: 16.5px;
  font-weight: 800;
  color: var(--home-heading);
}

.dt-state span {
  max-width: 460px;
  font-size: 13px;
  line-height: 1.75;
  color: var(--home-muted);
}

.dt-state-icon {
  margin-bottom: 2px;
  font-size: 30px;
  color: var(--home-primary);
}

.dt-state-icon.is-spinning {
  animation: dt-spin 0.9s linear infinite;
}

@keyframes dt-spin {
  to {
    transform: rotate(360deg);
  }
}

/* ---------- 须知与致谢 ---------- */
.dt-note {
  margin-top: 20px;
  padding: 18px 20px;
  background: var(--home-surface);
  border: 1px solid var(--home-border);
  border-radius: 16px;
}

.dt-note-head {
  display: inline-flex;
  gap: 7px;
  align-items: center;
  font-size: 13px;
  font-weight: 800;
  color: var(--home-heading);
}

.dt-note-head svg {
  font-size: 15px;
  color: var(--home-primary);
}

.dt-note p {
  margin: 8px 0 0;
  font-size: 12.5px;
  line-height: 1.9;
  color: var(--home-muted);
}

.dt-thanks {
  display: flex;
  gap: 9px;
  align-items: center;
  justify-content: center;
  padding: 20px;
  margin: 34px 0 0;
  font-size: 14.5px;
  font-weight: 600;
  color: var(--home-primary);
  background: var(--home-grad-soft);
  border: 1.5px dashed rgb(var(--home-primary-rgb) / 40%);
  border-radius: 20px;
}

.dt-thanks svg {
  flex: none;
  font-size: 16px;
}

/* ---------- 收款码放大 ---------- */
.dt-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: grid;
  place-items: center;
  padding: 20px;
  background: var(--home-mask);
  backdrop-filter: blur(8px);
}

.dt-modal {
  display: flex;
  flex-direction: column;
  width: min(100%, 380px);
  overflow: hidden;
  background: var(--home-surface-popover);
  border: 1px solid var(--home-border-strong);
  border-radius: 20px;
  box-shadow: 0 30px 80px var(--home-shadow-hover);
}

.dt-modal-head {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 16px 18px;
  border-bottom: 1px solid var(--home-border);
}

.dt-modal-head svg {
  flex: none;
  font-size: 18px;
  color: var(--home-primary);
}

.dt-modal-head strong {
  min-width: 0;
  overflow: hidden;
  font-size: 15.5px;
  font-weight: 800;
  color: var(--home-heading);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dt-modal-close {
  display: grid;
  flex: none;
  place-items: center;
  width: 34px;
  height: 34px;
  margin-left: auto;
  font-size: 17px;
  color: var(--home-muted);
  cursor: pointer;
  background: transparent;
  border: 1px solid var(--home-border);
  border-radius: 10px;
  transition: all 0.18s ease;
}

.dt-modal-close:hover {
  color: var(--home-primary);
  border-color: rgb(var(--home-primary-rgb) / 40%);
}

.dt-modal-body {
  display: flex;
  padding: 22px;
  background: var(--home-surface-subtle);
}

.dt-modal-qr {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  object-fit: contain;
  background: var(--home-image-background);
  border: 1px solid var(--home-border);
  border-radius: 14px;
}

.dt-modal-foot {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
  padding: 13px 18px;
  margin: 0;
  font-size: 12.5px;
  color: var(--home-muted);
  border-top: 1px solid var(--home-border);
}

.dt-modal-foot svg {
  font-size: 14px;
  color: var(--home-primary);
}

.dt-fade-enter-active,
.dt-fade-leave-active {
  transition: opacity 0.2s ease;
}

.dt-fade-enter-from,
.dt-fade-leave-to {
  opacity: 0;
}

/* ---------- 响应式 ---------- */
@media (max-width: 900px) {
  .dt-head {
    align-items: flex-start;
  }

  .dt-figures {
    width: 100%;
  }

  .dt-figure {
    flex: 1 1 0;
  }
}

@media (max-width: 640px) {
  .dt-head {
    flex-direction: column;
    align-items: center;
    padding-top: 34px;
    text-align: center;
  }

  .dt-head p,
  .dt-sec-title p {
    margin-inline: auto;
  }

  .dt-ctas {
    width: 100%;
    justify-content: center;
  }

  .dt-figures {
    justify-content: center;
  }

  .dt-methods,
  .dt-methods[data-count='2'],
  .dt-methods[data-count='1'] {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }

  .dm-qr {
    width: min(100%, 190px);
  }

  .dt-sec-head {
    align-items: flex-start;
  }
}

@media (max-width: 420px) {
  .dt-btn {
    flex: 1 1 100%;
  }
}

@media (hover: none) {
  .dt-card:hover {
    transform: none;
  }

  .dm-qr-mask {
    opacity: 1;
    background: rgb(12 20 40 / 45%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .dt-card,
  .dt-btn,
  .dt-state-icon.is-spinning {
    transition: none;
    animation: none;
    transform: none;
  }
}
</style>
