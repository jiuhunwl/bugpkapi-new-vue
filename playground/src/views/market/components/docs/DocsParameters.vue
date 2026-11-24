<script setup lang="ts">
import type { MarketApi } from '#/api/market';

import { IconifyIcon } from '@vben/icons';

import { $t } from '#/locales';

const props = defineProps<{
  parameters: MarketApi.ApiParameter[];
}>();

function exampleValue(item: MarketApi.ApiParameter) {
  return String(item.exampleValue || item.placeholder || '').trim() || '—';
}
</script>

<template>
  <section id="parameters" class="doc-card docs-params">
    <div class="doc-card__head">
      <h2>
        {{ $t('page.public.marketDocs.concise.params.title') }}
        <span class="parameter-count">{{ props.parameters.length }}</span>
      </h2>
      <p class="hint">
        {{ $t('page.public.marketDocs.concise.params.description') }}
      </p>
    </div>
    <dl v-if="props.parameters.length" class="parameter-list">
      <div
        v-for="item in props.parameters"
        :key="`${item.location}:${item.name}`"
        class="parameter-row"
      >
        <dt>
          <code>{{ item.name }}</code
          ><span class="parameter-type">{{ item.type || 'string' }}</span
          ><span class="parameter-location">{{ item.location }}</span
          ><span
            class="parameter-required"
            :class="{ 'is-required': item.required }"
            >{{
              $t(
                item.required
                  ? 'page.public.marketDocs.design.required'
                  : 'page.public.marketDocs.design.optional',
              )
            }}</span
          >
        </dt>
        <dd>
          <p>{{ item.description || '—' }}</p>
          <div class="parameter-example">
            <span>{{
              $t('page.public.marketDocs.concise.params.example')
            }}</span
            ><code>{{ exampleValue(item) }}</code>
          </div>
        </dd>
      </div>
    </dl>
    <p v-else class="parameter-empty">
      <IconifyIcon icon="lucide:circle-check" />{{
        $t('page.public.marketDocs.concise.params.empty')
      }}
    </p>
  </section>
</template>
<style scoped>
.parameter-count {
  color: var(--home-muted);
  background: var(--home-surface);
  font:
    11px ui-monospace,
    monospace;
  padding: 3px 6px;
  border-radius: 4px;
}
.parameter-list {
  margin: 0;
  border-top: 1px solid var(--home-border);
}
.parameter-row {
  display: grid;
  grid-template-columns: minmax(180px, 0.8fr) minmax(0, 1.4fr);
  gap: 20px;
  padding: 20px 0;
  border-bottom: 1px solid var(--home-border);
}
.parameter-row:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}
.parameter-row dt {
  display: flex;
  align-items: baseline;
  align-content: flex-start;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}
.parameter-row dt > code {
  color: var(--home-heading);
  font:
    600 14px ui-monospace,
    monospace;
  overflow-wrap: anywhere;
}
.parameter-type {
  color: var(--home-muted);
  font:
    11px ui-monospace,
    monospace;
}
.parameter-location {
  color: var(--home-muted);
  font-size: 10px;
  border: 1px solid var(--home-border);
  border-radius: 3px;
  padding: 0 5px;
}
.parameter-required {
  font-size: 10px;
  color: var(--home-muted);
}
.parameter-required.is-required {
  color: var(--home-danger);
}
.parameter-row dd {
  margin: 0;
  min-width: 0;
}
.parameter-row p {
  margin: 0;
  font-size: 14px;
  color: var(--home-muted);
  line-height: 1.85;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.parameter-example {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-top: 9px;
  color: var(--home-text-faint);
  font-size: 11px;
}
.parameter-example > span {
  flex: none;
  padding-top: 2px;
}
.parameter-example code {
  padding: 3px 7px;
  border-radius: 4px;
  background: var(--home-surface);
  color: var(--home-muted);
  font:
    12px/1.5 ui-monospace,
    monospace;
  overflow-wrap: anywhere;
}
.parameter-empty {
  display: flex;
  gap: 9px;
  align-items: center;
  margin: 0;
  padding: 15px;
  color: var(--home-muted);
  background: var(--home-surface);
  border-radius: 6px;
  font-size: 13px;
}
.parameter-empty svg {
  width: 16px;
  height: 16px;
}
@media (max-width: 640px) {
  .parameter-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
    padding-block: 18px;
  }
  .parameter-row p {
    font-size: 13px;
  }
}
</style>
