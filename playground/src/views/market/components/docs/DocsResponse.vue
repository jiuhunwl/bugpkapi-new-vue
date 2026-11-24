<script setup lang="ts">
import type { MarketApi } from '#/api/market';

import { computed, ref, watch } from 'vue';

import { $t } from '#/locales';
import DocsCodeBlock from './DocsCodeBlock.vue';

const props = defineProps<{
  detail: MarketApi.ApiDetail;
}>();

type FormatEntry = {
  example: string;
  type: string;
};

const activeType = ref('');

const responseFormats = computed<FormatEntry[]>(() => {
  const declared = (props.detail.responseFormats ?? [])
    .map((item) => ({
      example: String(item.example ?? ''),
      type: String(item.type || '').trim().toUpperCase(),
    }))
    .filter((item) => item.type.length > 0);
  if (declared.length > 0) return declared;
  const legacyExample = String(props.detail.responseExample || '').trim();
  if (!legacyExample && !String(props.detail.responseType || '').trim()) {
    return [];
  }
  return [
    {
      example: legacyExample,
      type: String(props.detail.responseType || 'JSON')
        .trim()
        .toUpperCase(),
    },
  ];
});

const activeFormat = computed(
  () =>
    responseFormats.value.find((item) => item.type === activeType.value) ??
    responseFormats.value[0],
);

watch(
  () => responseFormats.value.map((item) => item.type).join('|'),
  () => {
    activeType.value = responseFormats.value[0]?.type ?? '';
  },
  { immediate: true },
);

function prettyExample(format: FormatEntry | undefined) {
  const value = String(format?.example || '').trim();
  if (!value || format?.type !== 'JSON') return value;
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function statusTone(code: number | string) {
  const value = Number(code);
  if (value < 300) return 'ok';
  if (value < 500) return 'warn';
  return 'bad';
}
</script>

<template>
  <section id="response" class="doc-card docs-response">
    <div class="doc-card__head">
      <h2>{{ $t('page.public.marketDocs.concise.response.title') }}</h2>
      <p class="hint">
        {{ $t('page.public.marketDocs.concise.response.description') }}
      </p>
    </div>
    <div class="response-layout">
      <div class="response-fields">
        <h3>{{ $t('page.public.marketDocs.design.responseFields') }}</h3>
        <dl v-if="props.detail.responseFields.length">
          <div
            v-for="item in props.detail.responseFields"
            :key="item.name"
            class="response-field"
          >
            <dt>
              <code>{{ item.name }}</code
              ><span>{{ item.type || 'string' }}</span>
            </dt>
            <dd>{{ item.description || '—' }}</dd>
          </div>
        </dl>
        <p v-else class="docs-response__empty">
          {{ $t('page.public.marketDocs.concise.response.emptyFields') }}
        </p>
      </div>
      <div v-if="activeFormat" class="response-examples">
        <div
          v-if="responseFormats.length > 1"
          class="response-format-tabs"
          role="tablist"
        >
          <button
            v-for="format in responseFormats"
            :key="format.type"
            :class="{ active: format.type === activeFormat?.type }"
            :aria-selected="format.type === activeFormat?.type"
            role="tab"
            type="button"
            @click="activeType = format.type"
          >
            {{ format.type }}
          </button>
        </div>
        <DocsCodeBlock
          :code="prettyExample(activeFormat)"
          :title="$t('page.public.marketDocs.concise.response.example')"
          :language="activeFormat.type"
        />
      </div>
      <p v-else class="docs-response__empty">
        {{ $t('page.public.marketDocs.concise.response.emptyExample') }}
      </p>
    </div>
    <h3 class="status-title">
      {{ $t('page.public.marketDocs.concise.response.statuses') }}
    </h3>
    <dl v-if="props.detail.statusCodes.length" class="status-list">
      <div v-for="item in props.detail.statusCodes" :key="item.code">
        <dt :class="statusTone(item.code)">{{ item.code }}</dt>
        <dd>{{ item.description || '—' }}</dd>
      </div>
    </dl>
    <p v-else class="docs-response__empty">
      {{ $t('page.public.marketDocs.concise.response.emptyStatuses') }}
    </p>
  </section>
</template>
<style scoped>
.response-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 28px;
  align-items: start;
}
.response-fields {
  min-width: 0;
}
.response-examples {
  min-width: 0;
}
.response-format-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.response-format-tabs button {
  font:
    600 12px ui-monospace,
    monospace;
  color: var(--home-muted);
  padding: 5px 12px;
  border: 1px solid var(--home-border);
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
  transition:
    color 0.15s ease,
    border-color 0.15s ease,
    background 0.15s ease;
}
.response-format-tabs button:hover {
  color: var(--home-heading);
  border-color: var(--home-heading);
}
.response-format-tabs button.active {
  color: var(--home-heading);
  border-color: var(--home-heading);
  background: var(--home-surface);
}
.response-fields h3,
.status-title {
  color: var(--home-heading);
  font-size: 13px;
  font-weight: 600;
  margin: 0 0 14px;
}
.response-fields dl {
  margin: 0;
  border-top: 1px solid var(--home-border);
}
.response-field {
  padding: 13px 0;
  border-bottom: 1px solid var(--home-border);
}
.response-field:last-child {
  border-bottom: 0;
}
.response-field dt {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 9px;
}
.response-field code {
  color: var(--home-heading);
  font:
    13px ui-monospace,
    monospace;
  overflow-wrap: anywhere;
}
.response-field span {
  color: var(--home-muted);
  font:
    11px ui-monospace,
    monospace;
}
.response-field dd {
  color: var(--home-muted);
  font-size: 13px;
  margin: 6px 0 0;
  line-height: 1.8;
  overflow-wrap: anywhere;
}
.status-title {
  margin-top: 26px;
}
.status-list {
  margin: 0;
  border: 1px solid var(--home-border);
  border-radius: 7px;
  padding: 0 15px;
}
.status-list > div {
  display: flex;
  gap: 16px;
  align-items: baseline;
  padding: 12px 0;
  border-bottom: 1px solid var(--home-border);
}
.status-list > div:last-child {
  border-bottom: 0;
}
.status-list dt {
  flex: none;
  font:
    600 12px ui-monospace,
    monospace;
  padding: 3px 7px;
  border-radius: 4px;
}
.status-list dd {
  color: var(--home-muted);
  font-size: 13px;
  margin: 0;
  overflow-wrap: anywhere;
}
.ok {
  color: var(--home-success);
  background: var(--home-success-soft);
}
.warn {
  color: var(--home-warning);
  background: var(--home-warning-soft);
}
.bad {
  color: var(--home-danger);
  background: var(--home-danger-soft);
}
.docs-response__empty {
  color: var(--home-muted);
  font-size: 13px;
  padding: 17px;
  background: var(--home-surface);
  border-radius: 6px;
  margin: 0;
}
@media (max-width: 1050px) {
  .response-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: 20px;
  }
}
</style>
