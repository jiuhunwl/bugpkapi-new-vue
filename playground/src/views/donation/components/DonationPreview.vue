<script setup lang="ts">
import type { DonationApi } from '#/api/donation';

import { computed } from 'vue';

import { IconifyIcon, SvgWeChatIcon } from '@vben/icons';

import { $t } from '#/locales';

const props = defineProps<{
  config: DonationApi.Config;
}>();

const visibleMethods = computed(() =>
  props.config.methods
    .filter((method) => method.enabled === 1)
    .sort((first, second) => first.sortNo - second.sortNo),
);

function isWeChatIcon(icon: string) {
  return icon === 'simple-icons:wechat' || icon === 'svg:wechat';
}
</script>

<template>
  <aside class="preview-panel">
    <header class="preview-heading">
      <div>
        <h2>{{ $t('donationSettings.preview.title') }}</h2>
        <p>{{ $t('donationSettings.preview.description') }}</p>
      </div>
      <span class="preview-status" :class="{ published: config.enabled === 1 }">
        {{
          config.enabled === 1
            ? $t('donationSettings.status.published')
            : $t('donationSettings.status.unpublished')
        }}
      </span>
    </header>

    <div class="preview-canvas">
      <div class="preview-eyebrow">
        <IconifyIcon icon="lucide:heart" />
        {{ config.eyebrow || $t('donationSettings.preview.eyebrowFallback') }}
      </div>
      <h3>
        {{ config.title || $t('donationSettings.preview.titleFallback') }}
      </h3>
      <p class="preview-description">
        {{
          config.description ||
          $t('donationSettings.preview.descriptionFallback')
        }}
      </p>

      <section class="preview-methods">
        <div class="preview-methods-heading">
          <strong>
            {{
              config.scanTitle || $t('donationSettings.preview.scanFallback')
            }}
          </strong>
          <span>{{ config.scanDescription }}</span>
        </div>

        <div v-if="visibleMethods.length" class="preview-method-list">
          <article
            v-for="method in visibleMethods"
            :key="method.key"
            class="preview-method"
          >
            <span
              class="preview-method-name"
              :style="{
                backgroundColor: `${method.color}18`,
                color: method.color,
              }"
            >
              <SvgWeChatIcon v-if="isWeChatIcon(method.icon)" />
              <IconifyIcon v-else :icon="method.icon" />
              {{ method.name }}
            </span>
            <div class="preview-qr">
              <img
                v-if="method.qrCodeUrl"
                :alt="$t('donationSettings.preview.qrAlt', [method.name])"
                :src="method.qrCodeUrl"
              />
              <IconifyIcon v-else icon="lucide:qr-code" />
            </div>
            <small>{{ method.tip }}</small>
          </article>
        </div>
        <div v-else class="preview-empty">
          <IconifyIcon icon="lucide:qr-code" />
          {{ $t('donationSettings.preview.empty') }}
        </div>
      </section>

      <footer v-if="config.thanks" class="preview-thanks">
        <IconifyIcon icon="lucide:sparkles" />
        {{ config.thanks }}
      </footer>
    </div>
  </aside>
</template>

<style scoped>
.preview-panel {
  min-width: 0;
}

.preview-heading {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 14px;
}

.preview-heading h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0;
}

.preview-heading p {
  margin: 5px 0 0;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.preview-status {
  flex: 0 0 auto;
  padding: 3px 8px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
  border-radius: 6px;
}

.preview-status.published {
  color: #15803d;
  background: #dcfce7;
}

.preview-canvas {
  padding: 24px 20px;
  text-align: center;
  background:
    linear-gradient(hsl(var(--border) / 30%) 1px, transparent 1px),
    linear-gradient(90deg, hsl(var(--border) / 30%) 1px, transparent 1px),
    hsl(var(--background));
  background-size: 40px 40px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.preview-eyebrow,
.preview-method-name,
.preview-thanks {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}

.preview-eyebrow {
  font-size: 12px;
  font-weight: 700;
  color: hsl(var(--primary));
}

.preview-canvas h3 {
  margin: 10px 0 6px;
  font-size: 24px;
  font-weight: 750;
  letter-spacing: 0;
}

.preview-description {
  margin: 0 auto;
  font-size: 13px;
  line-height: 1.65;
  color: hsl(var(--muted-foreground));
}

.preview-methods {
  padding-top: 18px;
  margin-top: 18px;
  border-top: 1px solid hsl(var(--border));
}

.preview-methods-heading {
  display: grid;
  gap: 3px;
}

.preview-methods-heading strong {
  font-size: 15px;
}

.preview-methods-heading span {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.preview-method-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.preview-method {
  display: grid;
  gap: 8px;
  place-items: center;
  min-width: 0;
  padding: 12px 8px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 7px;
}

.preview-method-name {
  max-width: 100%;
  padding: 3px 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  border-radius: 5px;
}

.preview-qr {
  display: grid;
  place-items: center;
  width: 104px;
  height: 104px;
  overflow: hidden;
  font-size: 28px;
  color: hsl(var(--muted-foreground));
  background: #fff;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.preview-qr img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.preview-method small {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.preview-empty {
  display: grid;
  gap: 6px;
  place-items: center;
  min-height: 130px;
  margin-top: 14px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  border: 1px dashed hsl(var(--border));
  border-radius: 7px;
}

.preview-empty svg {
  font-size: 26px;
}

.preview-thanks {
  margin-top: 16px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

@media (max-width: 480px) {
  .preview-method-list {
    grid-template-columns: 1fr;
  }
}
</style>
