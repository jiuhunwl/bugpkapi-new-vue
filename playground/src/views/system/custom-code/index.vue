<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue';

import { Page } from '@vben/common-ui';
import { RotateCw } from '@vben/icons';
import { useAccessStore, useUserStore } from '@vben/stores';

import {
  Alert,
  Button,
  Input,
  message,
  Spin,
  Switch,
  TabPane,
  Tabs,
  Tag,
} from 'ant-design-vue';

import {
  getCustomCodeConfig,
  updateCustomCodeConfig,
} from '#/api/system/custom-code';
import { $t } from '#/locales';

import { hasCompleteCustomCodeTags } from './tag-validation';

const MAX_CODE_BYTES = 256 * 1024;

const accessStore = useAccessStore();
const userStore = useUserStore();
const loading = shallowRef(false);
const saving = shallowRef(false);
const enabled = shallowRef(false);
const cssCode = shallowRef('');
const jsCode = shallowRef('');
const updateTime = shallowRef('');

const isAdmin = computed(() => userStore.userRoles.includes('admin'));
const canUpdate = computed(
  () =>
    isAdmin.value ||
    accessStore.accessCodes.includes('system:custom-code:update'),
);
const cssBytes = computed(() => byteLength(cssCode.value));
const jsBytes = computed(() => byteLength(jsCode.value));

async function loadConfig() {
  loading.value = true;
  try {
    const config = await getCustomCodeConfig();
    enabled.value = config.enabled === 1;
    cssCode.value = config.cssCode ?? '';
    jsCode.value = config.jsCode ?? '';
    updateTime.value = config.updateTime ?? '';
  } finally {
    loading.value = false;
  }
}

async function saveConfig() {
  if (!canUpdate.value || saving.value) return;
  if (cssBytes.value > MAX_CODE_BYTES || jsBytes.value > MAX_CODE_BYTES) {
    message.error($t('customCode.messages.tooLarge'));
    return;
  }
  if (!hasCompleteCustomCodeTags(cssCode.value, 'style')) {
    message.error($t('customCode.messages.cssTagsRequired'));
    return;
  }
  if (!hasCompleteCustomCodeTags(jsCode.value, 'script')) {
    message.error($t('customCode.messages.jsTagsRequired'));
    return;
  }
  saving.value = true;
  try {
    await updateCustomCodeConfig({
      cssCode: cssCode.value,
      enabled: enabled.value ? 1 : 0,
      jsCode: jsCode.value,
      updateTime: '',
    });
    message.success($t('customCode.messages.saved'));
    await loadConfig();
  } finally {
    saving.value = false;
  }
}

function byteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

onMounted(() => void loadConfig());
</script>

<template>
  <Page auto-content-height>
    <Spin :spinning="loading">
      <div class="custom-code-page">
        <header class="custom-code-header">
          <div>
            <h1>{{ $t('customCode.title') }}</h1>
            <p>{{ $t('customCode.description') }}</p>
          </div>
          <div class="custom-code-header__status">
            <Tag :color="enabled ? 'success' : 'default'">
              {{ enabled ? $t('common.enabled') : $t('common.disabled') }}
            </Tag>
            <span v-if="updateTime">
              {{ $t('customCode.updatedAt', [updateTime]) }}
            </span>
          </div>
        </header>

        <Alert
          :description="$t('customCode.warning')"
          show-icon
          type="warning"
        />

        <section class="custom-code-panel">
          <div class="custom-code-switch">
            <div>
              <strong>{{ $t('customCode.enabled') }}</strong>
              <p v-if="!enabled">{{ $t('customCode.disabledHint') }}</p>
            </div>
            <Switch
              v-model:checked="enabled"
              :disabled="!canUpdate"
              :checked-children="$t('common.enabled')"
              :un-checked-children="$t('common.disabled')"
            />
          </div>

          <Tabs>
            <TabPane key="css" :tab="$t('customCode.cssTitle')">
              <div class="custom-code-editor">
                <div class="custom-code-editor__meta">
                  <span>{{ $t('customCode.cssTagHelp') }}</span>
                  <span :class="{ 'is-over-limit': cssBytes > MAX_CODE_BYTES }">
                    {{ $t('customCode.size', [formatBytes(cssBytes)]) }}
                  </span>
                </div>
                <Input.TextArea
                  v-model:value="cssCode"
                  class="custom-code-textarea"
                  :disabled="!canUpdate"
                  :rows="20"
                  spellcheck="false"
                />
              </div>
            </TabPane>
            <TabPane key="javascript" :tab="$t('customCode.jsTitle')">
              <div class="custom-code-editor">
                <div class="custom-code-editor__meta">
                  <span>{{ $t('customCode.jsTagHelp') }}</span>
                  <span :class="{ 'is-over-limit': jsBytes > MAX_CODE_BYTES }">
                    {{ $t('customCode.size', [formatBytes(jsBytes)]) }}
                  </span>
                </div>
                <Input.TextArea
                  v-model:value="jsCode"
                  class="custom-code-textarea"
                  :disabled="!canUpdate"
                  :rows="20"
                  spellcheck="false"
                />
              </div>
            </TabPane>
          </Tabs>

          <footer class="custom-code-actions">
            <Button :disabled="loading" @click="loadConfig">
              <template #icon><RotateCw class="size-4" /></template>
              {{ $t('customCode.refresh') }}
            </Button>
            <Button
              :disabled="!canUpdate"
              :loading="saving"
              type="primary"
              @click="saveConfig"
            >
              {{ $t('customCode.save') }}
            </Button>
          </footer>
        </section>
      </div>
    </Spin>
  </Page>
</template>

<style scoped>
.custom-code-page {
  display: grid;
  gap: 18px;
  padding: 20px;
}

.custom-code-header {
  display: flex;
  gap: 24px;
  align-items: flex-start;
  justify-content: space-between;
}

.custom-code-header h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: hsl(var(--foreground));
}

.custom-code-header p,
.custom-code-switch p {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.65;
  color: hsl(var(--muted-foreground));
}

.custom-code-header__status {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.custom-code-panel {
  padding: 20px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.custom-code-switch {
  display: flex;
  gap: 20px;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  margin-bottom: 16px;
  background: hsl(var(--muted) / 45%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.custom-code-editor {
  display: grid;
  gap: 10px;
}

.custom-code-editor__meta {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.custom-code-editor__meta .is-over-limit {
  font-weight: 700;
  color: #dc2626;
}

.custom-code-textarea {
  font-family: 'Cascadia Code', 'JetBrains Mono', Consolas, monospace;
  font-size: 13px;
  line-height: 1.65;
  tab-size: 2;
}

.custom-code-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding-top: 18px;
}

@media (max-width: 640px) {
  .custom-code-page {
    padding: 12px;
  }

  .custom-code-header,
  .custom-code-switch,
  .custom-code-editor__meta {
    align-items: flex-start;
    flex-direction: column;
  }

  .custom-code-header__status {
    justify-content: flex-start;
  }

  .custom-code-switch :deep(.ant-switch) {
    align-self: flex-end;
  }
}
</style>
