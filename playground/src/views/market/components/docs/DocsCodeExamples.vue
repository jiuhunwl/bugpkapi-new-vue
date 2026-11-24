<script setup lang="ts">
import type { MarketApi } from '#/api/market';

import { computed, shallowRef } from 'vue';

import DocsCodeBlock from './DocsCodeBlock.vue';

import { $t } from '#/locales';

type AuthMode = 'header' | 'query';
type Language = 'curl' | 'go' | 'javascript' | 'python';

const props = defineProps<{
  endpoint: string;
  method: 'GET' | 'POST';
  parameters: MarketApi.ApiParameter[];
}>();

const languages: Array<{ label: string; value: Language }> = [
  { label: 'cURL', value: 'curl' },
  { label: 'JavaScript', value: 'javascript' },
  { label: 'Python', value: 'python' },
  { label: 'Go', value: 'go' },
];

const language = shallowRef<Language>('curl');
const authMode = shallowRef<AuthMode>('header');
const activeCode = computed(() => buildSample(language.value));

function sampleValue(item: MarketApi.ApiParameter) {
  const configured = String(item.exampleValue || '').trim();
  if (configured) return configured;
  const name = item.name.toLowerCase();
  if (name.includes('url') || name.includes('link'))
    return 'https://example.com';
  if (name.includes('phone') || name.includes('mobile')) return '13800138000';
  if (name.includes('id')) return 'demo_id';
  return `{${item.name}}`;
}

function sampleEntries(includeKey = false) {
  const entries: Array<[string, string]> = props.parameters.map((item) => [
    item.name,
    sampleValue(item),
  ]);
  if (includeKey) entries.unshift(['key', 'YOUR_API_KEY']);
  return entries;
}

function readableUrl(includeKey = false) {
  const query = sampleEntries(includeKey)
    .map(
      ([name, value]) =>
        `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    )
    .join('&');
  if (!query) return props.endpoint;
  return `${props.endpoint}${props.endpoint.includes('?') ? '&' : '?'}${query}`;
}

function curlSample() {
  const header =
    authMode.value === 'header'
      ? " \\\n+  --header 'X-API-Key: YOUR_API_KEY'"
      : '';
  return `curl --request ${props.method} \\\n+  --url '${readableUrl(authMode.value === 'query')}'${header}`;
}

function javascriptSample() {
  const entries = sampleEntries(authMode.value === 'query')
    .map(
      ([name, value]) =>
        `url.searchParams.set(${JSON.stringify(name)}, ${JSON.stringify(value)});`,
    )
    .join('\n');
  const headers =
    authMode.value === 'header'
      ? "\n  headers: { 'X-API-Key': 'YOUR_API_KEY' },"
      : '';
  return `const url = new URL(${JSON.stringify(props.endpoint)});
${entries}

const response = await fetch(url, {
  method: '${props.method}',${headers}
});

if (!response.ok) {
  throw new Error(\`HTTP \${response.status}: \${await response.text()}\`);
}

console.log(await response.json());`;
}

function pythonSample() {
  const params = sampleEntries(authMode.value === 'query')
    .map(
      ([name, value]) =>
        `    ${JSON.stringify(name)}: ${JSON.stringify(value)},`,
    )
    .join('\n');
  const headers =
    authMode.value === 'header'
      ? '\nheaders = {"X-API-Key": "YOUR_API_KEY"}'
      : '\nheaders = {}';
  return `import requests

url = ${JSON.stringify(props.endpoint)}
params = {
${params}
}${headers}

response = requests.request(
    ${JSON.stringify(props.method)},
    url,
    params=params,
    headers=headers,
    timeout=30,
)
response.raise_for_status()
print(response.json())`;
}

function goSample() {
  const params = sampleEntries(authMode.value === 'query')
    .map(
      ([name, value]) =>
        `\tquery.Set(${JSON.stringify(name)}, ${JSON.stringify(value)})`,
    )
    .join('\n');
  const header =
    authMode.value === 'header'
      ? '\n\treq.Header.Set("X-API-Key", "YOUR_API_KEY")'
      : '';
  return `package main

import (
\t"fmt"
\t"io"
\t"net/http"
\t"net/url"
)

func main() {
\tendpoint, err := url.Parse(${JSON.stringify(props.endpoint)})
\tif err != nil {
\t\tpanic(err)
\t}

\tquery := endpoint.Query()
${params}
\tendpoint.RawQuery = query.Encode()

\treq, err := http.NewRequest(${JSON.stringify(props.method)}, endpoint.String(), nil)
\tif err != nil {
\t\tpanic(err)
\t}${header}

\tresp, err := http.DefaultClient.Do(req)
\tif err != nil {
\t\tpanic(err)
\t}
\tdefer resp.Body.Close()

\tbody, err := io.ReadAll(resp.Body)
\tif err != nil {
\t\tpanic(err)
\t}
\tfmt.Println(string(body))
}`;
}

function buildSample(value: Language) {
  if (value === 'javascript') return javascriptSample();
  if (value === 'python') return pythonSample();
  if (value === 'go') return goSample();
  return curlSample();
}
</script>

<template>
  <section id="examples" class="doc-card docs-examples">
    <div class="doc-card__head">
      <h2>{{ $t('page.public.marketDocs.concise.nav.examples') }}</h2>
      <p class="hint">
        {{ $t('page.public.marketDocs.concise.examples.description') }}
      </p>
    </div>
    <div class="docs-examples__toolbar">
      <div
        class="language-tabs"
        role="group"
        :aria-label="$t('page.public.marketDocs.concise.nav.examples')"
      >
        <button
          v-for="item in languages"
          :key="item.value"
          :class="{ 'is-active': language === item.value }"
          :aria-pressed="language === item.value"
          type="button"
          @click="language = item.value"
        >
          {{ item.label }}
        </button>
      </div>
      <div
        class="auth-tabs"
        role="group"
        :aria-label="$t('page.public.marketDocs.concise.examples.mode')"
      >
        <span>{{ $t('page.public.marketDocs.concise.examples.mode') }}</span
        ><button
          :aria-pressed="authMode === 'header'"
          :class="{ 'is-active': authMode === 'header' }"
          type="button"
          @click="authMode = 'header'"
        >
          Header</button
        ><button
          :aria-pressed="authMode === 'query'"
          :class="{ 'is-active': authMode === 'query' }"
          type="button"
          @click="authMode = 'query'"
        >
          Query
        </button>
      </div>
    </div>
    <DocsCodeBlock
      :code="activeCode"
      :title="
        languages.find((item) => item.value === language)?.label || language
      "
      :language="method"
    />
  </section>
</template>
<style scoped>
.docs-examples__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.language-tabs {
  display: flex;
  gap: 3px;
  padding: 4px;
  border-radius: 6px;
  background: var(--home-surface);
  border: 1px solid var(--home-border);
}
.language-tabs button,
.auth-tabs button {
  border: 0;
  background: transparent;
  color: var(--home-muted);
  font-size: 12px;
  padding: 7px 12px;
  min-height: 34px;
  border-radius: 4px;
  cursor: pointer;
}
.language-tabs button.is-active {
  color: var(--home-primary);
  background: var(--home-surface-strong);
  box-shadow: 0 1px 3px rgb(0 0 0 / 6%);
  font-weight: 600;
}
.auth-tabs {
  display: flex;
  align-items: center;
  gap: 3px;
}
.auth-tabs > span {
  font-size: 11px;
  color: var(--home-muted);
  margin-right: 8px;
}
.auth-tabs button.is-active {
  color: var(--home-primary);
  background: rgb(var(--home-primary-rgb) / 8%);
}
@media (max-width: 480px) {
  .language-tabs {
    width: 100%;
  }
  .language-tabs button {
    flex: 1;
    padding-inline: 8px;
  }
  .auth-tabs {
    margin-left: auto;
  }
}
</style>
