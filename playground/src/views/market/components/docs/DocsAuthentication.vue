<script setup lang="ts">
import { computed } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { $t } from '#/locales';

const props = defineProps<{
  endpoint: string;
}>();

const queryExample = computed(() => {
  if (!props.endpoint) return '?key=YOUR_API_KEY';
  return `${props.endpoint}${props.endpoint.includes('?') ? '&' : '?'}key=YOUR_API_KEY`;
});
</script>

<template>
  <section id="authentication" class="doc-card docs-auth" data-no="02">
    <div class="doc-card__head">
      <h2>
        {{ $t('page.public.marketDocs.design.authentication') }}
      </h2>
      <p class="hint">
        {{ $t('page.public.marketDocs.concise.auth.description') }}
      </p>
    </div>

    <div class="doc-block auth-modes">
      <article class="auth-mode is-recommended">
        <div class="m-title">
          <IconifyIcon icon="lucide:key-round" />
          {{ $t('page.public.marketDocs.concise.auth.headerTitle') }}
          <span class="badge-rec">{{
            $t('page.public.marketDocs.concise.auth.recommended')
          }}</span>
        </div>
        <p>{{ $t('page.public.marketDocs.concise.auth.headerDescription') }}</p>
        <code>X-API-Key: YOUR_API_KEY</code>
      </article>

      <article class="auth-mode">
        <div class="m-title">
          <IconifyIcon icon="lucide:send" />
          {{ $t('page.public.marketDocs.concise.auth.queryTitle') }}
        </div>
        <p>{{ $t('page.public.marketDocs.concise.auth.queryDescription') }}</p>
        <code>{{ queryExample }}</code>
      </article>
    </div>

    <div class="docs-auth__rule">
      <IconifyIcon icon="lucide:triangle-alert" />
      <div>
        <strong>{{
          $t('page.public.marketDocs.concise.auth.conflictTitle')
        }}</strong>
        <p>
          {{ $t('page.public.marketDocs.concise.auth.conflictDescription') }}
        </p>
      </div>
      <code>HTTP 400</code>
    </div>
  </section>
</template>

<style scoped>
.auth-modes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.auth-mode {
  min-width: 0;
  padding: 20px;
  border: 1px solid var(--home-border);
  border-radius: 8px;
  background: var(--home-surface-strong);
}
.auth-mode.is-recommended {
  border-color: rgb(var(--home-primary-rgb) / 30%);
  background: rgb(var(--home-primary-rgb) / 3%);
}
.m-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 14px;
  font-weight: 600;
  color: var(--home-heading);
}
.m-title svg {
  width: 17px;
  height: 17px;
  color: var(--home-primary);
}
.badge-rec {
  font-size: 10px;
  font-weight: 500;
  margin-left: auto;
  padding: 2px 6px;
  border-radius: 4px;
  color: var(--home-primary);
  background: rgb(var(--home-primary-rgb) / 8%);
}
.auth-mode p {
  color: var(--home-muted);
  font-size: 13px;
  line-height: 1.85;
  margin: 13px 0;
}
.auth-mode code {
  display: block;
  padding: 10px 12px;
  background: var(--home-surface);
  color: var(--home-heading);
  border: 1px solid var(--home-border);
  border-radius: 5px;
  font:
    12px/1.8 ui-monospace,
    monospace;
  overflow-wrap: anywhere;
}
.docs-auth__rule {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 16px;
  font-size: 12px;
  line-height: 1.9;
  color: var(--home-muted);
}
.docs-auth__rule > svg {
  flex: none;
  width: 15px;
  height: 15px;
  margin-top: 5px;
  color: var(--home-warning);
}
.docs-auth__rule strong {
  font-weight: 500;
  color: var(--home-heading);
}
.docs-auth__rule p {
  margin: 2px 0 0;
}
.docs-auth__rule > code {
  flex: none;
  font:
    10px ui-monospace,
    monospace;
  padding: 4px 6px;
  border-radius: 4px;
  border: 1px solid var(--home-border);
  margin-left: auto;
}
@media (max-width: 640px) {
  .auth-modes {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }
  .auth-mode {
    padding: 17px;
  }
  .docs-auth__rule {
    flex-wrap: wrap;
  }
  .docs-auth__rule > div {
    flex: 1;
    min-width: 200px;
  }
  .docs-auth__rule > code {
    display: none;
  }
}
</style>
