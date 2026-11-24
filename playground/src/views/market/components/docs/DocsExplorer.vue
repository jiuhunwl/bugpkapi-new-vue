<script setup lang="ts">
import type { MarketApi } from '#/api/market';

import { computed, reactive, ref, shallowRef, watch } from 'vue';
import { RouterLink } from 'vue-router';

import { IconifyIcon } from '@vben/icons';
import { useAccessStore } from '@vben/stores';

import { getKeySecret } from '#/api/key';
import { getMarketApiTestKey } from '#/api/market';
import { $t } from '#/locales';
import { cleanLinkParameter } from '#/utils/link-parameter';

type AuthMode = 'header' | 'query';

const props = defineProps<{
  detail: MarketApi.ApiDetail;
  endpoint: string;
  methods: Array<'GET' | 'POST'>;
  parameters: MarketApi.ApiParameter[];
}>();

const accessStore = useAccessStore();
const authMode = shallowRef<AuthMode>('header');
const method = shallowRef<'GET' | 'POST'>('GET');
const selectedKeyId = shallowRef('');
const secretKey = shallowRef('');
const keyOptions = ref<MarketApi.ApiTestKeyOption[]>([]);
const keyLoading = shallowRef(false);
const keyMessage = shallowRef('');
const testing = shallowRef(false);
const resultText = shallowRef('');
const errorText = shallowRef('');
const status = shallowRef<null | number>(null);
const elapsedMs = shallowRef<null | number>(null);
const copied = shallowRef(false);
const copyFailed = shallowRef(false);
const parameterValues = reactive<Record<string, string>>({});
let keyRequestSequence = 0;

const isSignedIn = computed(() => Boolean(accessStore.accessToken));
const resultMeta = computed(() => {
  if (testing.value)
    return $t('page.public.marketDocs.concise.explorer.sending');
  if (status.value !== null && elapsedMs.value !== null) {
    return `HTTP ${status.value} · ${elapsedMs.value}ms`;
  }
  return $t('page.public.marketDocs.concise.explorer.noOutput');
});
const requestPreview = computed(() =>
  buildRequestUrl('YOUR_API_KEY', authMode.value),
);

watch(
  () => props.detail.id,
  () => {
    method.value = preferredMethod();
    resetParameters();
    resetResult();
  },
  { immediate: true },
);

watch(
  [() => props.detail.id, () => accessStore.accessToken],
  () => {
    void loadTestKeys();
  },
  { immediate: true },
);

function preferredMethod(): 'GET' | 'POST' {
  if (
    props.detail.preferredMethod === 'POST' &&
    props.methods.includes('POST')
  ) {
    return 'POST';
  }
  return props.methods[0] ?? 'GET';
}

function resetParameters() {
  for (const name of Object.keys(parameterValues)) {
    delete parameterValues[name];
  }
  for (const item of props.parameters) {
    parameterValues[item.name] = String(item.exampleValue || '').trim();
  }
}

function resetResult() {
  copyFailed.value = false;
  resultText.value = '';
  errorText.value = '';
  status.value = null;
  elapsedMs.value = null;
}

async function loadTestKeys() {
  const sequence = ++keyRequestSequence;
  selectedKeyId.value = '';
  secretKey.value = '';
  keyOptions.value = [];
  keyMessage.value = '';
  if (!isSignedIn.value) {
    keyMessage.value = $t(
      'page.public.marketDocs.concise.explorer.loginRequired',
    );
    return;
  }

  keyLoading.value = true;
  try {
    const result = await getMarketApiTestKey(props.detail.id);
    if (sequence !== keyRequestSequence) return;
    keyOptions.value = result.keys ?? [];
    const recoverableCount = keyOptions.value.filter(
      (item) => item.secretAvailable,
    ).length;
    keyMessage.value =
      recoverableCount > 0
        ? $t('page.public.marketDocs.concise.explorer.selectHint')
        : result.hasKey
          ? $t('page.public.marketDocs.concise.explorer.unavailable')
          : result.message ||
            $t('page.public.marketDocs.concise.explorer.createFirst');
  } catch {
    if (sequence !== keyRequestSequence) return;
    keyMessage.value = $t(
      'page.public.marketDocs.concise.explorer.keyLoadFailed',
    );
  } finally {
    if (sequence === keyRequestSequence) keyLoading.value = false;
  }
}

async function loadSelectedKey() {
  const selected = keyOptions.value.find(
    (item) => item.id === selectedKeyId.value,
  );
  const sequence = ++keyRequestSequence;
  secretKey.value = '';
  if (!selected) {
    keyMessage.value = $t('page.public.marketDocs.concise.explorer.selectHint');
    return;
  }
  if (!selected.secretAvailable) {
    keyMessage.value = $t(
      'page.public.marketDocs.concise.explorer.unavailable',
    );
    return;
  }

  keyLoading.value = true;
  try {
    const result = await getKeySecret(selected.id);
    if (sequence !== keyRequestSequence) return;
    secretKey.value = String(result.secretKey || '').trim();
    keyMessage.value = secretKey.value
      ? $t('page.public.marketDocs.concise.explorer.selected', [selected.name])
      : $t('page.public.marketDocs.concise.explorer.unavailable');
  } catch {
    if (sequence !== keyRequestSequence) return;
    keyMessage.value = $t(
      'page.public.marketDocs.concise.explorer.keyLoadFailed',
    );
  } finally {
    if (sequence === keyRequestSequence) keyLoading.value = false;
  }
}

function cleanParameter(name: string) {
  parameterValues[name] = cleanLinkParameter(String(parameterValues[name] ?? ''), name);
}
function cleanPastedParameter(name: string) {
  window.setTimeout(() => cleanParameter(name), 0);
}

function buildRequestUrl(key: string, mode: AuthMode) {
  if (!props.endpoint) return '';
  const base =
    typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
  const url = new URL(props.endpoint, base);
  if (mode === 'query' && key) url.searchParams.set('key', key);
  for (const item of props.parameters) {
    const value = cleanLinkParameter(String(parameterValues[item.name] ?? ''), item.name);
    if (value) url.searchParams.set(item.name, value);
  }
  return url.toString();
}

async function sendTest() {
  for (const item of props.parameters) cleanParameter(item.name);
  resetResult();
  if (!isSignedIn.value) {
    errorText.value = $t(
      'page.public.marketDocs.concise.explorer.loginRequired',
    );
    return;
  }
  const key = secretKey.value.trim();
  if (!key) {
    errorText.value =
      keyMessage.value ||
      $t('page.public.marketDocs.concise.explorer.selectHint');
    return;
  }
  const missing = props.parameters.find(
    (item) => item.required && !String(parameterValues[item.name] || '').trim(),
  );
  if (missing) {
    errorText.value = $t(
      'page.public.marketDocs.concise.explorer.missingParam',
      [missing.name],
    );
    return;
  }

  testing.value = true;
  const startedAt = Date.now();
  try {
    const response = await fetch(buildRequestUrl(key, authMode.value), {
      headers: authMode.value === 'header' ? { 'X-API-Key': key } : undefined,
      method: method.value,
    });
    const body = await response.text();
    status.value = response.status;
    resultText.value =
      formatMaybeJson(body) ||
      $t('page.public.marketDocs.concise.explorer.emptyResponse');
  } catch (error) {
    errorText.value =
      error instanceof Error
        ? error.message
        : $t('page.public.marketDocs.concise.explorer.failed');
  } finally {
    elapsedMs.value = Date.now() - startedAt;
    testing.value = false;
  }
}

async function copyResult() {
  const value = resultText.value || errorText.value;
  if (!value || typeof navigator === 'undefined') return;
  try {
    await navigator.clipboard.writeText(value);
    copyFailed.value = false;
  } catch {
    copyFailed.value = true;
    return;
  }
  copied.value = true;
  window.setTimeout(() => {
    copied.value = false;
  }, 1400);
}

function formatMaybeJson(value: string) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}
</script>

<template>
  <section id="online-test" class="doc-card docs-explorer" data-no="06">
    <div class="doc-card__head">
      <h2>
        {{ $t('page.public.marketDocs.design.try') }}
      </h2>
      <p class="hint">
        {{ $t('page.public.marketDocs.concise.explorer.description') }}
      </p>
    </div>

    <p class="docs-explorer__billing">
      <IconifyIcon icon="lucide:info" />{{
        $t('page.public.marketDocs.design.liveRequest')
      }}
    </p>
    <div class="docs-explorer__workspace">
      <div class="request-builder">
        <div class="request-builder__toolbar">
          <label>
            <span>{{
              $t('page.public.marketDocs.concise.explorer.mode')
            }}</span>
            <div class="segmented-control">
              <button
                :class="{ 'is-active': authMode === 'header' }"
                type="button"
                @click="authMode = 'header'"
              >
                Header
              </button>
              <button
                :class="{ 'is-active': authMode === 'query' }"
                type="button"
                @click="authMode = 'query'"
              >
                Query
              </button>
            </div>
          </label>

          <label>
            <span>{{
              $t('page.public.marketDocs.concise.explorer.method')
            }}</span>
            <select v-model="method">
              <option v-for="item in props.methods" :key="item" :value="item">
                {{ item }}
              </option>
            </select>
          </label>
        </div>

        <div class="request-preview">
          <span>{{ method }}</span>
          <code>{{ requestPreview }}</code>
        </div>

        <label class="key-field">
          <span>{{ $t('page.public.marketDocs.concise.explorer.key') }}</span>
          <select
            v-model="selectedKeyId"
            :disabled="!isSignedIn || keyLoading"
            @change="loadSelectedKey"
          >
            <option value="">
              {{
                keyLoading
                  ? $t('page.public.marketDocs.concise.explorer.loading')
                  : $t(
                      'page.public.marketDocs.concise.explorer.selectPlaceholder',
                    )
              }}
            </option>
            <option
              v-for="item in keyOptions"
              :key="item.id"
              :disabled="!item.secretAvailable"
              :value="item.id"
            >
              {{ item.name }} · {{ item.maskedKey }}
            </option>
          </select>
        </label>
        <p class="key-message">
          {{ keyMessage }}
          <RouterLink v-if="!isSignedIn" to="/auth/login">
            {{ $t('page.public.marketDocs.concise.explorer.login') }}
          </RouterLink>
          <RouterLink v-else-if="!keyOptions.length" to="/key">
            {{ $t('page.public.marketDocs.concise.explorer.createKey') }}
          </RouterLink>
        </p>

        <div v-if="props.parameters.length" class="parameter-fields">
          <label
            v-for="item in props.parameters"
            :key="item.name"
            class="parameter-field"
          >
            <span>
              <code>{{ item.name }}</code>
              <em v-if="item.required">*</em>
            </span>
            <input
              v-model="parameterValues[item.name]"
              @paste="cleanPastedParameter(item.name)"
              @blur="cleanParameter(item.name)"
              :placeholder="item.placeholder || item.description"
              type="text"
            />
          </label>
        </div>

        <button
          class="send-button"
          :disabled="testing || keyLoading"
          type="button"
          @click="sendTest"
        >
          <IconifyIcon
            :class="{ 'is-spinning': testing }"
            :icon="testing ? 'lucide:loader-circle' : 'lucide:send'"
          />
          {{
            testing
              ? $t('page.public.marketDocs.concise.explorer.sending')
              : $t('page.public.marketDocs.concise.explorer.send')
          }}
        </button>
      </div>

      <aside class="response-console" :aria-busy="testing">
        <div class="response-console__top">
          <div>
            <i :class="{ 'is-error': status !== null && status >= 400 }"></i>
            <span>{{
              $t('page.public.marketDocs.concise.explorer.result')
            }}</span>
          </div>
          <code>{{ resultMeta }}</code>
          <button
            :aria-label="$t('page.public.marketDocs.concise.examples.copy')"
            :disabled="!resultText && !errorText"
            type="button"
            @click="copyResult"
          >
            <IconifyIcon :icon="copied ? 'lucide:check' : 'lucide:copy'" />
          </button>
        </div>
        <div
          v-if="!resultText && !errorText && !testing"
          class="response-console__empty"
        >
          <IconifyIcon icon="lucide:terminal" /><strong>{{
            $t('page.public.marketDocs.design.responseReady')
          }}</strong>
          <p>{{ $t('page.public.marketDocs.design.responseHint') }}</p>
        </div>
        <pre
          v-else
          :class="{ 'is-error': Boolean(errorText) }"
        ><code>{{ errorText || resultText || $t('page.public.marketDocs.concise.explorer.noOutput') }}</code></pre>
        <p v-if="copyFailed" class="response-copy-error" role="status">
          {{ $t('page.public.marketDocs.design.copyFailed') }}
        </p>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.docs-explorer__workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 26px;
  margin-top: 20px;
}
.request-builder,
.response-console {
  min-width: 0;
}
.request-builder__toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 95px;
  gap: 12px;
}
.request-builder label > span {
  display: block;
  margin-bottom: 7px;
  font-size: 13px;
  color: var(--home-muted);
}
.segmented-control {
  display: flex;
  gap: 3px;
  padding: 3px;
  border-radius: 6px;
  background: var(--home-surface);
  border: 1px solid var(--home-border);
}
.segmented-control button {
  flex: 1;
  min-height: 30px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--home-muted);
  cursor: pointer;
}
.segmented-control button.is-active {
  color: var(--home-primary);
  background: rgb(var(--home-primary-rgb) / 8%);
}
.request-builder select,
.parameter-field input {
  display: block;
  width: 100%;
  min-width: 0;
  min-height: 38px;
  padding: 7px 10px;
  border: 1px solid var(--home-border);
  border-radius: 6px;
  background: var(--home-surface);
  color: var(--home-heading);
  font-size: 12px;
}
.request-builder select:focus,
.parameter-field input:focus {
  outline: 2px solid rgb(var(--home-primary-rgb) / 30%);
  border-color: var(--home-primary);
}
.request-preview {
  display: flex;
  gap: 9px;
  align-items: flex-start;
  padding: 11px;
  margin-top: 15px;
  border: 1px solid var(--home-border);
  border-radius: 6px;
  background: var(--home-surface);
}
.request-preview span {
  flex: none;
  font:
    11px/1.8 ui-monospace,
    monospace;
  color: var(--home-primary);
}
.request-preview code {
  min-width: 0;
  overflow-wrap: anywhere;
  font:
    11px/1.8 ui-monospace,
    monospace;
  color: var(--home-text);
}
.key-field {
  display: block;
  margin-top: 17px;
}
.key-message {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.8;
  color: var(--home-muted);
  overflow-wrap: anywhere;
}
.key-message a {
  margin-left: 5px;
  color: var(--home-primary);
}
.parameter-fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 14px;
  margin-top: 18px;
}
.parameter-field code {
  font:
    12px ui-monospace,
    monospace;
}
.parameter-field em {
  color: var(--home-danger);
  margin-left: 4px;
  font-style: normal;
}
.send-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 40px;
  margin-top: 20px;
  border-radius: 6px;
  background: var(--home-primary);
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}
.send-button:disabled {
  cursor: wait;
  opacity: 0.55;
}
.send-button svg {
  width: 16px;
  height: 16px;
}
.send-button svg.is-spinning {
  animation: explorer-spin 0.9s linear infinite;
}
.response-console {
  display: flex;
  flex-direction: column;
  min-height: 260px;
  border: 1px solid var(--home-code-border);
  border-radius: 6px;
  overflow: hidden;
  background: var(--home-code-background);
}
.response-console__top {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
  padding: 10px 12px;
  border-bottom: 1px solid var(--home-code-border);
  background: var(--home-code-header);
}
.response-console__top > div {
  display: flex;
  align-items: center;
  gap: 6px;
}
.response-console__top i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--home-success);
}
.response-console__top i.is-error {
  background: var(--home-danger);
}
.response-console__top span,
.response-console__top code {
  color: var(--home-code-muted);
  font-size: 12px;
}
.response-console__top code {
  margin-left: auto;
}
.response-console__top button {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  color: var(--home-code-muted);
  border: 1px solid var(--home-code-border);
  border-radius: 4px;
  cursor: pointer;
}
.response-console__top button:disabled {
  opacity: 0.4;
}
.response-console pre {
  flex: 1;
  min-width: 0;
  max-height: 540px;
  overflow: auto;
  padding: 15px;
  margin: 0;
}
.response-console pre code {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font:
    12px/1.8 ui-monospace,
    monospace;
  color: var(--home-code-text);
}
.response-console pre.is-error code {
  color: var(--home-danger);
}
.docs-explorer button:focus-visible {
  outline: 2px solid var(--home-primary);
  outline-offset: 3px;
}
@keyframes explorer-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .send-button svg.is-spinning {
    animation: none;
  }
}
@media (min-width: 900px) and (max-width: 1279px) {
  .docs-explorer__workspace {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
}

.docs-explorer__billing {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--home-muted);
  font-size: 12px;
  margin: -8px 0 21px;
}
.docs-explorer__billing svg {
  width: 14px;
  height: 14px;
  flex: none;
}
.request-builder {
  padding: 20px;
  border: 1px solid var(--home-border);
  border-radius: 8px;
  background: var(--home-surface-strong);
}
.response-console {
  border-radius: 8px;
}
.response-console__empty {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  gap: 13px;
  padding: 30px 24px;
  color: var(--home-code-muted);
}
.response-console__empty > svg {
  width: 28px;
  height: 28px;
}
.response-console__empty strong {
  color: var(--home-code-text);
  font-size: 14px;
  font-weight: 500;
}
.response-console__empty p {
  font-size: 12px;
  line-height: 1.85;
  margin: 0;
}
@media (max-width: 1050px) {
  .docs-explorer__workspace {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 480px) {
  .request-builder {
    padding: 16px;
  }
  .request-builder__toolbar {
    grid-template-columns: minmax(0, 1fr) 80px;
  }
}
.response-copy-error {
  padding: 10px 15px;
  margin: 0;
  color: var(--home-code-text);
  font-size: 12px;
  border-top: 1px solid var(--home-code-border);
}
</style>
