<script setup lang="ts">
import { onBeforeUnmount, shallowRef, watch } from 'vue';
import { IconifyIcon } from '@vben/icons';
import { $t } from '#/locales';
const props = withDefaults(
  defineProps<{ code: string; title: string; language?: string }>(),
  { language: '' },
);
const copied = shallowRef(false);
const failed = shallowRef(false);
let timer: ReturnType<typeof setTimeout> | undefined;
let revision = 0;
function reset() {
  revision++;
  copied.value = false;
  failed.value = false;
  if (timer) clearTimeout(timer);
}
watch(() => props.code, reset);
onBeforeUnmount(reset);
async function copy() {
  const current = revision;
  try {
    await navigator.clipboard.writeText(props.code);
    if (current !== revision) return;
    copied.value = true;
    failed.value = false;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      copied.value = false;
    }, 1600);
  } catch {
    if (current === revision) failed.value = true;
  }
}
</script>
<template>
  <div class="docs-code-block">
    <div class="docs-code-block__bar">
      <span class="docs-code-block__title">{{ title }}</span
      ><span v-if="language" class="docs-code-block__language">{{
        language
      }}</span
      ><button
        type="button"
        :disabled="!code"
        :aria-label="$t('page.public.marketDocs.concise.examples.copy')"
        @click="copy"
      >
        <IconifyIcon :icon="copied ? 'lucide:check' : 'lucide:copy'" /><span>{{
          $t(
            copied
              ? 'page.public.marketDocs.design.copied'
              : 'page.public.marketDocs.concise.examples.copy',
          )
        }}</span>
      </button>
    </div>
    <pre tabindex="0" :aria-label="title"><code>{{ code }}</code></pre>
    <p v-if="failed" class="docs-code-block__feedback" role="status">
      {{ $t('page.public.marketDocs.design.copyFailed') }}
    </p>
    <span class="sr-only" role="status">{{
      copied ? $t('page.public.marketDocs.design.copied') : ''
    }}</span>
  </div>
</template>
<style scoped>
.docs-code-block {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--home-code-border);
  border-radius: 8px;
  background: var(--home-code-background);
}
.docs-code-block__bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  min-height: 46px;
  padding: 7px 15px;
  background: var(--home-code-header);
  border-bottom: 1px solid var(--home-code-border);
}
.docs-code-block__title {
  color: var(--home-code-text);
  font-size: 12px;
  font-weight: 500;
}
.docs-code-block__language {
  font-size: 10px;
  color: var(--home-code-muted);
}
.docs-code-block__bar button {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  margin-left: auto;
  min-height: 30px;
  padding: 4px 8px;
  font-size: 11px;
  border: 1px solid var(--home-code-border);
  color: var(--home-code-text);
  border-radius: 5px;
  cursor: pointer;
}
.docs-code-block__bar button svg {
  width: 13px;
  height: 13px;
}
.docs-code-block__bar button:disabled {
  opacity: 0.5;
  cursor: default;
}
.docs-code-block pre {
  max-height: 520px;
  margin: 0;
  padding: 21px;
  overflow: auto;
  font:
    13px/1.9 ui-monospace,
    SFMono-Regular,
    Consolas,
    monospace;
  color: var(--home-code-text);
  tab-size: 2;
  scrollbar-width: thin;
}
.docs-code-block code {
  font: inherit;
  white-space: pre;
}
.docs-code-block__feedback {
  margin: 0;
  padding: 10px 16px;
  border-top: 1px solid var(--home-code-border);
  color: var(--home-code-text);
  font-size: 12px;
}
@media (max-width: 640px) {
  .docs-code-block pre {
    padding: 16px;
    font-size: 12px;
  }
  .docs-code-block__bar {
    padding-inline: 12px;
  }
}
</style>
