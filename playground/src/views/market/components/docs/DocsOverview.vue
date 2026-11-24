<script setup lang="ts">
import type { MarketApi } from '#/api/market';

import { onBeforeUnmount, shallowRef } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { $t } from '#/locales';

const props = defineProps<{
  detail: MarketApi.ApiDetail;
  endpoint: string;
  methodLabel: string;
  priceLabel: string;
}>();

const emit = defineEmits<{ navigate: [section: string] }>();
const copied = shallowRef(false);
const copyFailed = shallowRef(false);
let copyTimer: ReturnType<typeof setTimeout> | undefined;
onBeforeUnmount(() => {
  if (copyTimer) clearTimeout(copyTimer);
});

async function copyEndpoint() {
  if (!props.endpoint || typeof navigator === 'undefined') return;
  try {
    await navigator.clipboard.writeText(props.endpoint);
  } catch {
    copyFailed.value = true;
    return;
  }
  copied.value = true;
  copyFailed.value = false;
  if (copyTimer) clearTimeout(copyTimer);
  copyTimer = setTimeout(() => {
    copied.value = false;
  }, 1400);
}

function formatCount(value: number | string) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return '0';
  if (number >= 10_000) return `${(number / 10_000).toFixed(1)}w`;
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(
    number,
  );
}
</script>

<template>
  <section id="overview" class="doc-card docs-overview">
    <div class="docs-overview__eyebrow">
      <IconifyIcon icon="lucide:book-open" />{{
        $t('page.public.marketDocs.design.reference')
      }}<span v-if="props.detail.apiCode">/ {{ props.detail.apiCode }}</span>
    </div>
    <div class="docs-overview__heading">
      <h1>{{ props.detail.name }}</h1>
      <img v-if="props.detail.avatarUrl" :src="props.detail.avatarUrl" alt="" />
    </div>
    <p class="docs-overview__description">
      {{
        props.detail.description ||
        $t('page.public.marketDocs.concise.overview.descriptionFallback')
      }}
    </p>
    <div class="docs-overview__actions">
      <a
        class="docs-primary-action"
        href="#online-test"
        @click="emit('navigate', 'online-test')"
        ><IconifyIcon icon="lucide:play" />{{
          $t('page.public.marketDocs.design.try')
        }}</a
      ><a
        class="docs-secondary-action"
        href="#examples"
        @click="emit('navigate', 'examples')"
        ><IconifyIcon icon="lucide:code-2" />{{
          $t('page.public.marketDocs.design.sample')
        }}<IconifyIcon icon="lucide:arrow-down"
      /></a>
    </div>
    <div class="docs-overview__endpoint">
      <span class="endpoint-method">{{ props.methodLabel }}</span
      ><code>{{ props.endpoint }}</code
      ><button
        type="button"
        :aria-label="$t('page.public.marketDocs.concise.overview.copy')"
        @click="copyEndpoint"
      >
        <IconifyIcon :icon="copied ? 'lucide:check' : 'lucide:copy'" />
      </button>
    </div>
    <p v-if="copyFailed" class="copy-feedback" role="status">
      {{ $t('page.public.marketDocs.design.copyFailed') }}
    </p>
    <span class="sr-only" role="status">{{
      copied ? $t('page.public.marketDocs.design.copied') : ''
    }}</span>
    <dl class="docs-overview__facts">
      <div>
        <dt>{{ $t('page.public.marketDocs.concise.overview.pricing') }}</dt>
        <dd>{{ props.priceLabel }}</dd>
      </div>
      <div>
        <dt>{{ $t('page.public.marketDocs.concise.overview.response') }}</dt>
        <dd>{{ props.detail.responseType || 'JSON' }}</dd>
      </div>
      <div>
        <dt>{{ $t('page.public.marketDocs.concise.overview.calls') }}</dt>
        <dd>{{ formatCount(props.detail.callCount) }}</dd>
      </div>
    </dl>
    <div v-if="props.detail.notice" class="docs-overview__notice">
      <IconifyIcon icon="lucide:info" />
      <div>
        <strong>{{
          $t('page.public.marketDocs.concise.overview.notice')
        }}</strong>
        <p>{{ props.detail.notice }}</p>
      </div>
    </div>
  </section>
</template>
<style scoped>
.docs-overview.doc-card {
  padding-top: 0;
  padding-bottom: 30px;
}
.docs-overview__eyebrow {
  display: flex;
  gap: 7px;
  align-items: center;
  color: var(--home-primary);
  font-size: 12px;
  margin-bottom: 16px;
}
.docs-overview__eyebrow svg {
  width: 14px;
  height: 14px;
}
.docs-overview__eyebrow span {
  color: var(--home-muted);
  font:
    11px ui-monospace,
    monospace;
  overflow-wrap: anywhere;
}
.docs-overview__heading {
  display: flex;
  align-items: center;
  gap: 20px;
}
.docs-overview h1 {
  margin: 0;
  color: var(--home-heading);
  font-size: 36px;
  font-weight: 650;
  line-height: 1.4;
  letter-spacing: -1px;
  overflow-wrap: anywhere;
}
.docs-overview__heading img {
  width: 46px;
  height: 46px;
  object-fit: contain;
  border-radius: 10px;
  margin-left: auto;
}
.docs-overview__description {
  max-width: 760px;
  margin: 16px 0 23px;
  font-size: 15px;
  color: var(--home-muted);
  line-height: 1.9;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.docs-overview__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 25px;
}
.docs-overview__actions a {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 9px 15px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
}
.docs-overview__actions svg {
  width: 15px;
  height: 15px;
}
.docs-primary-action {
  color: #fff;
  background: var(--home-primary);
  border: 1px solid var(--home-primary);
}
.docs-secondary-action {
  color: var(--home-heading);
  background: var(--home-surface-strong);
  border: 1px solid var(--home-border);
}
.docs-overview__endpoint {
  display: flex;
  align-items: center;
  gap: 13px;
  min-width: 0;
  padding: 13px 15px;
  border: 1px solid var(--home-border);
  border-radius: 8px;
  background: var(--home-surface);
}
.endpoint-method {
  color: var(--home-primary);
  background: rgb(var(--home-primary-rgb) / 9%);
  border-radius: 4px;
  padding: 4px 7px;
  font:
    600 11px ui-monospace,
    monospace;
  flex: none;
}
.docs-overview__endpoint code {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--home-heading);
  font:
    13px/1.8 ui-monospace,
    monospace;
}
.docs-overview__endpoint button {
  display: grid;
  place-items: center;
  flex: none;
  width: 32px;
  height: 32px;
  border-radius: 5px;
  color: var(--home-muted);
  cursor: pointer;
}
.docs-overview__endpoint button:hover {
  color: var(--home-primary);
  background: rgb(var(--home-primary-rgb) / 8%);
}
.docs-overview__facts {
  display: flex;
  gap: 0;
  flex-wrap: wrap;
  margin: 17px 0 0;
  font-size: 12px;
}
.docs-overview__facts > div {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 0 21px;
  border-right: 1px solid var(--home-border);
}
.docs-overview__facts > div:first-child {
  padding-left: 0;
}
.docs-overview__facts > div:last-child {
  border: 0;
}
.docs-overview__facts dt {
  color: var(--home-muted);
}
.docs-overview__facts dd {
  margin: 0;
  color: var(--home-heading);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.docs-overview__notice {
  display: flex;
  gap: 10px;
  margin-top: 20px;
  padding: 14px;
  border-left: 2px solid var(--home-primary);
  background: rgb(var(--home-primary-rgb) / 5%);
  color: var(--home-muted);
  font-size: 13px;
  line-height: 1.85;
}
.docs-overview__notice svg {
  width: 16px;
  height: 16px;
  flex: none;
  margin-top: 3px;
}
.docs-overview__notice p {
  margin: 5px 0 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.copy-feedback {
  font-size: 12px;
  color: var(--home-muted);
  margin-top: 10px;
}
@media (max-width: 640px) {
  .docs-overview h1 {
    font-size: 28px;
    letter-spacing: -0.5px;
  }
  .docs-overview__description {
    font-size: 14px;
  }
  .docs-overview__endpoint {
    gap: 8px;
    padding: 10px;
  }
  .docs-overview__endpoint code {
    font-size: 12px;
  }
  .docs-overview__facts {
    gap: 9px 16px;
  }
  .docs-overview__facts > div {
    padding: 0;
    border: 0;
    gap: 6px;
    font-size: 11px;
  }
  .docs-overview__heading img {
    width: 36px;
    height: 36px;
  }
}
</style>
