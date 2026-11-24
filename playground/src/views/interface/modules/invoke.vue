<script lang="ts" setup>
import type { InterfaceApi } from '#/api/interface';

import { computed, nextTick, onBeforeUnmount, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { Button, Empty, message, Select } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { getInterfaceInvokeKeys, invokeInterface } from '#/api/interface';
import { $t } from '#/locales';

import { invokeMethodOptions, useInvokeSchema } from '../data';

const current = ref<InterfaceApi.InterfaceItem>();
const result = ref<InterfaceApi.InvokeResult>();

const keyOptions = ref<Array<{ label: string; value: string }>>([]);
const selectedKeyId = ref<string>();
const keyLoading = ref(false);
const keyError = ref('');
const keyKeyword = ref('');
let keyRequestSequence = 0;
let keySearchTimer: ReturnType<typeof setTimeout> | undefined;

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
  },
  layout: 'horizontal',
  schema: useInvokeSchema(),
  showDefaultActions: false,
});

const [Drawer, drawerApi] = useVbenDrawer({
  async onConfirm() {
    if (!current.value) return;
    const { valid } = await formApi.validate();
    if (!valid) return;

    const values = await formApi.getValues<any>();
    let body: Record<string, any>;
    let queryParams: Record<string, any>;
    try {
      body = parseJsonObject(
        values.bodyText,
        $t('system.interface.bodyParams'),
      );
      queryParams = parseJsonObject(
        values.queryParamsText,
        $t('system.interface.queryParams'),
      );
    } catch {
      return;
    }
    const payload: InterfaceApi.InvokePayload = {
      body,
      keyId: selectedKeyId.value ? Number(selectedKeyId.value) : 0,
      method: values.method,
      queryParams,
    };

    drawerApi.lock();
    try {
      result.value = await invokeInterface(current.value.id, payload);
      message.success($t('system.interface.invokeSuccess'));
    } finally {
      drawerApi.unlock();
    }
  },

  async onOpenChange(isOpen) {
    if (!isOpen) return;

    const data = drawerApi.getData<InterfaceApi.InterfaceItem>();
    current.value = data;
    result.value = undefined;
    selectedKeyId.value = undefined;
    keyKeyword.value = '';
    formApi.resetForm();

    void loadKeys('');

    await nextTick();
    const options =
      data.requestMethod === 'GET_POST'
        ? invokeMethodOptions
        : invokeMethodOptions.filter(
            (item) => item.value === data.requestMethod,
          );
    formApi.updateSchema([
      {
        componentProps: {
          disabled: data.requestMethod !== 'GET_POST',
          options,
        },
        fieldName: 'method',
      },
    ]);
    formApi.setValues({
      bodyText: '',
      method: data.requestMethod === 'POST' ? 'POST' : 'GET',
      queryParamsText: buildQueryParamExample(data.requestUrl),
    });
  },
});

async function loadKeys(keyword = keyKeyword.value) {
  const interfaceId = current.value?.id;
  if (!interfaceId) return;
  const sequence = ++keyRequestSequence;
  keyLoading.value = true;
  keyError.value = '';
  try {
    const items = await getInterfaceInvokeKeys(interfaceId, keyword);
    if (sequence !== keyRequestSequence) return;
    keyOptions.value = items.map((item) => ({
      label: item.name,
      value: String(item.id),
    }));
    if (
      selectedKeyId.value &&
      !keyOptions.value.some((item) => item.value === selectedKeyId.value)
    ) {
      selectedKeyId.value = undefined;
    }
  } catch {
    if (sequence !== keyRequestSequence) return;
    keyOptions.value = [];
    keyError.value = $t('system.interface.invokeKeyLoadFailed');
  } finally {
    if (sequence === keyRequestSequence) {
      keyLoading.value = false;
    }
  }
}

function onKeySearch(input: string) {
  keyKeyword.value = String(input || '').trim();
  if (keySearchTimer) clearTimeout(keySearchTimer);
  keySearchTimer = setTimeout(() => {
    void loadKeys(keyKeyword.value);
  }, 280);
}

onBeforeUnmount(() => {
  keyRequestSequence += 1;
  if (keySearchTimer) clearTimeout(keySearchTimer);
});

const drawerTitle = computed(() =>
  $t('system.interface.invokeTitle', [current.value?.name ?? '']),
);

function parseJsonObject(value: string | undefined, fieldName: string) {
  const text = String(value ?? '').trim();
  if (!text) {
    return {};
  }
  try {
    const parsed = JSON.parse(text);
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      throw new Error('not object');
    }
    return parsed;
  } catch {
    message.warning($t('system.interface.jsonObjectRequired', [fieldName]));
    throw new Error('invalid json');
  }
}

function buildQueryParamExample(requestUrl?: string) {
  const keys = extractTemplateParamKeys(requestUrl);
  if (keys.length === 0) {
    return '';
  }
  const params = keys.reduce<Record<string, string>>((result, key) => {
    result[key] = key.toLowerCase().includes('url')
      ? 'https://example.com'
      : 'test';
    return result;
  }, {});
  return JSON.stringify(params, null, 2);
}

function extractTemplateParamKeys(requestUrl?: string) {
  const template = String(requestUrl ?? '');
  const keys: string[] = [];
  const placeholderReg = /\{([A-Za-z][\w]*)}/g;
  let match: null | RegExpExecArray;
  while ((match = placeholderReg.exec(template))) {
    const placeholder = match[1];
    const queryKey =
      placeholder === 'text'
        ? queryKeyBeforePlaceholder(template, match.index)
        : placeholder;
    if (queryKey && !keys.includes(queryKey)) {
      keys.push(queryKey);
    }
  }
  return keys;
}

function queryKeyBeforePlaceholder(template: string, placeholderIndex: number) {
  const equalsIndex = template.lastIndexOf('=', placeholderIndex);
  if (equalsIndex < 0) return '';
  const questionIndex = template.lastIndexOf('?', equalsIndex);
  const ampIndex = template.lastIndexOf('&', equalsIndex);
  const startIndex = Math.max(questionIndex, ampIndex) + 1;
  if (startIndex <= 0 || startIndex >= equalsIndex) return '';
  const key = template.slice(startIndex, equalsIndex);
  if (key.includes('=')) return '';
  try {
    return decodeURIComponent(key);
  } catch {
    return key;
  }
}
</script>

<template>
  <Drawer :title="drawerTitle">
    <div class="invoke-key-section">
      <div class="invoke-key-label">
        {{ $t('system.interface.invokeKey') }}
        <span v-if="selectedKeyId" class="invoke-key-selected">
          {{ $t('system.interface.invokeKeySelected') }}
        </span>
      </div>
      <Select
        v-model:value="selectedKeyId"
        :loading="keyLoading"
        :options="keyOptions"
        :placeholder="$t('system.interface.invokeKeyPlaceholder')"
        :filter-option="false"
        allow-clear
        class="w-full"
        show-search
        @search="onKeySearch"
      />
      <div v-if="keyError" class="invoke-key-state">
        <span class="invoke-key-error">{{ keyError }}</span>
        <Button size="small" @click="loadKeys()">
          {{ $t('system.interface.invokeKeyRetry') }}
        </Button>
      </div>
      <div
        v-else-if="!keyLoading && !selectedKeyId && keyOptions.length === 0"
        class="invoke-key-state"
      >
        <Empty
          :description="
            keyKeyword
              ? $t('system.interface.invokeKeyNoMatch')
              : $t('system.interface.invokeKeyEmpty')
          "
          :image="Empty.PRESENTED_IMAGE_SIMPLE"
        />
      </div>
    </div>
    <Form />
    <div v-if="result" class="mt-4 rounded-md border p-4">
      <div class="mb-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <div class="text-muted-foreground">
            {{ $t('system.interface.statusCode') }}
          </div>
          <div class="font-medium">{{ result.statusCode }}</div>
        </div>
        <div>
          <div class="text-muted-foreground">
            {{ $t('system.interface.elapsedMs') }}
          </div>
          <div class="font-medium">{{ result.elapsedMs }}ms</div>
        </div>
        <div>
          <div class="text-muted-foreground">
            {{ $t('system.interface.price') }}
          </div>
          <div class="font-medium">{{ result.price }}</div>
        </div>
        <div>
          <div class="text-muted-foreground">
            {{ $t('system.interface.pointPrice') }}
          </div>
          <div class="font-medium">{{ result.pointPrice ?? 0 }}</div>
        </div>
      </div>
      <div class="text-muted-foreground mb-2 text-sm">
        {{ $t('system.interface.responseBody') }}
      </div>
      <pre
        class="bg-muted max-h-80 overflow-auto rounded p-3 text-xs leading-5"
      >{{ result.body }}</pre>
    </div>
  </Drawer>
</template>

<style scoped>
.invoke-key-section {
  padding-bottom: 14px;
  margin-bottom: 14px;
  border-bottom: 1px dashed hsl(var(--border));
}

.invoke-key-label {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.invoke-key-selected {
  padding: 1px 8px;
  font-size: 12px;
  font-weight: 500;
  color: hsl(var(--success-foreground));
  background: hsl(var(--success) / 15%);
  border-radius: 999px;
}

.invoke-key-state {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  padding-top: 8px;
}

.invoke-key-error {
  font-size: 12px;
  color: hsl(var(--destructive));
}
</style>
