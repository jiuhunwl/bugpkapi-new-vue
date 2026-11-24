<script setup lang="ts">
import type { KeyApi } from '#/api/key';

import { computed, ref, shallowRef } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Descriptions,
  Empty,
  message,
  Skeleton,
  Tag,
  Tooltip,
} from 'ant-design-vue';

import { getKeyDetail, getKeyInterfaceOptions, getKeySecret } from '#/api/key';
import { $t } from '#/locales';
import { copyText } from '#/utils/copy-text';

const MASKED_PLACEHOLDER = '••••••••';

const current = ref<KeyApi.KeyItem>();
const detail = ref<KeyApi.KeyItem>();
const loading = shallowRef(false);
const copied = shallowRef(false);
const secretKey = shallowRef('');
const secretLoading = shallowRef(false);
const secretVisible = shallowRef(false);
const interfaceOptions = ref<KeyApi.InterfaceOption[]>([]);
let detailRequestVersion = 0;
let secretRequestVersion = 0;
const interfaceNames = computed(() => {
  const ids = (detail.value?.interfaceIds ?? [])
    .map((item) => String(item))
    .filter(Boolean);
  if (ids.length === 0) return [];
  const nameById = new Map(
    interfaceOptions.value.map((item) => [String(item.id), item.name]),
  );
  return ids.map((id) => nameById.get(id) || id);
});
const displayKeyValue = computed(() =>
  secretVisible.value && secretKey.value
    ? secretKey.value
    : detail.value?.maskedKey || MASKED_PLACEHOLDER,
);
const isGlobal = computed(() => detail.value?.keyScope === 'GLOBAL');
const statusText = computed(() =>
  detail.value?.status === 1 ? $t('common.enabled') : $t('common.disabled'),
);

const [Drawer, drawerApi] = useVbenDrawer({
  async onOpenChange(isOpen) {
    const requestVersion = ++detailRequestVersion;
    secretRequestVersion += 1;
    secretLoading.value = false;
    if (!isOpen) {
      loading.value = false;
      secretKey.value = '';
      secretVisible.value = false;
      return;
    }
    const row = drawerApi.getData<KeyApi.KeyItem>();
    current.value = row;
    detail.value = undefined;
    copied.value = false;
    secretKey.value = '';
    secretVisible.value = false;
    interfaceOptions.value = [];
    if (!row?.id) return;
    loading.value = true;
    try {
      const item = await getKeyDetail(row.id);
      if (requestVersion !== detailRequestVersion) return;
      detail.value = item;
      if (item.keyScope !== 'GLOBAL') {
        try {
          const options = await getKeyInterfaceOptions();
          if (requestVersion !== detailRequestVersion) return;
          interfaceOptions.value = options;
        } catch {
          if (requestVersion === detailRequestVersion) {
            interfaceOptions.value = [];
          }
        }
      }
    } catch {
      if (requestVersion !== detailRequestVersion) return;
      message.error($t('system.key.detailLoadFailed'));
      drawerApi.close();
    } finally {
      if (requestVersion === detailRequestVersion) {
        loading.value = false;
      }
    }
  },
});

const drawerTitle = computed(() =>
  current.value?.name
    ? $t('system.key.detailTitleWithName', [current.value.name])
    : $t('system.key.detailTitle'),
);

async function ensureSecretLoaded() {
  if (secretKey.value) return true;
  const keyId = detail.value?.id;
  if (!keyId || !detail.value?.secretAvailable || secretLoading.value) {
    return false;
  }
  const requestVersion = ++secretRequestVersion;
  secretLoading.value = true;
  try {
    const result = await getKeySecret(keyId);
    if (requestVersion !== secretRequestVersion || detail.value?.id !== keyId) {
      return false;
    }
    secretKey.value = String(result.secretKey || '').trim();
    return Boolean(secretKey.value);
  } catch {
    if (requestVersion === secretRequestVersion) {
      message.error($t('system.key.secretRevealFailed'));
    }
    return false;
  } finally {
    if (requestVersion === secretRequestVersion) {
      secretLoading.value = false;
    }
  }
}

async function toggleSecretVisibility() {
  if (secretVisible.value) {
    secretVisible.value = false;
    return;
  }
  if (await ensureSecretLoaded()) {
    secretVisible.value = true;
  }
}

async function copyKeyValue() {
  if (!(await ensureSecretLoaded())) return;
  const value = secretKey.value;
  if (!value) return;
  try {
    await copyText(value);
    copied.value = true;
    message.success($t('system.key.detailCopied'));
    window.setTimeout(() => {
      copied.value = false;
    }, 1500);
  } catch {
    message.error($t('system.key.copySecretFailed'));
  }
}
</script>

<template>
  <Drawer :title="drawerTitle">
    <Skeleton v-if="loading" active :paragraph="{ rows: 8 }" />
    <template v-else-if="detail">
      <div class="detail-secret">
        <div class="detail-secret-label">
          {{ $t('system.key.secretKey') }}
        </div>
        <div class="detail-secret-row">
          <button
            class="detail-secret-value"
            :disabled="!detail.secretAvailable"
            type="button"
            @click="copyKeyValue"
          >
            <code>{{ displayKeyValue }}</code>
          </button>
          <Tooltip
            :title="
              detail.secretAvailable
                ? secretVisible
                  ? $t('system.key.detailHide')
                  : $t('system.key.detailShow')
                : $t('system.key.secretUnavailable')
            "
          >
            <Button
              :aria-label="
                secretVisible
                  ? $t('system.key.detailHide')
                  : $t('system.key.detailShow')
              "
              :disabled="!detail.secretAvailable"
              :loading="secretLoading"
              shape="circle"
              size="small"
              type="text"
              @click="toggleSecretVisibility"
            >
              <template #icon>
                <IconifyIcon
                  :icon="secretVisible ? 'lucide:eye-off' : 'lucide:eye'"
                  class="size-4"
                />
              </template>
            </Button>
          </Tooltip>
          <Button
            :disabled="!detail.secretAvailable"
            size="small"
            type="primary"
            @click="copyKeyValue"
          >
            {{
              copied
                ? $t('system.key.detailCopied')
                : $t('system.key.detailCopy')
            }}
          </Button>
        </div>
        <div class="detail-secret-hint">
          {{
            detail.secretAvailable
              ? $t('system.key.detailPlaintextHint')
              : $t('system.key.secretUnavailable')
          }}
        </div>
      </div>

      <Descriptions
        :column="1"
        class="detail-descriptions"
        :label-style="{ width: 130 }"
        size="middle"
      >
        <Descriptions.Item :label="$t('system.key.name')">
          {{ detail.name }}
        </Descriptions.Item>
        <Descriptions.Item :label="$t('system.key.keyScope')">
          <Tag :color="isGlobal ? 'success' : 'processing'">
            {{
              isGlobal
                ? $t('system.key.scopeGlobal')
                : $t('system.key.scopeInterface')
            }}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item :label="$t('system.key.status')">
          <Tag :color="detail.status === 1 ? 'success' : 'default'">
            {{ statusText }}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item :label="$t('system.key.interfaceName')">
          <template v-if="isGlobal">
            {{ $t('system.key.scopeGlobal') }}
          </template>
          <template v-else-if="interfaceNames.length > 0">
            <div class="detail-interface-list">
              <Tag v-for="name in interfaceNames" :key="name">
                {{ name }}
              </Tag>
            </div>
          </template>
          <span v-else>-</span>
        </Descriptions.Item>
        <Descriptions.Item :label="$t('system.key.ipWhitelist')">
          <template v-if="detail.ipWhitelist && detail.ipWhitelist.trim()">
            <pre class="detail-whitelist">{{ detail.ipWhitelist }}</pre>
          </template>
          <span v-else>-</span>
        </Descriptions.Item>
        <Descriptions.Item :label="$t('system.key.createTime')">
          {{ detail.createTime || '-' }}
        </Descriptions.Item>
        <Descriptions.Item :label="$t('system.key.lastUsedAt')">
          {{ detail.lastUsedAt || '-' }}
        </Descriptions.Item>
        <Descriptions.Item :label="$t('system.key.expiresAt')">
          {{ detail.expiresAt || $t('system.key.neverExpires') }}
        </Descriptions.Item>
      </Descriptions>

      <div class="detail-empty" v-if="!isGlobal && interfaceNames.length === 0">
        <Empty
          :description="$t('system.key.detailNoInterface')"
          :image="Empty.PRESENTED_IMAGE_SIMPLE"
        />
      </div>
    </template>
  </Drawer>
</template>

<style scoped>
.detail-secret {
  padding: 14px;
  margin-bottom: 16px;
  background: hsl(var(--muted) / 35%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.detail-secret-label {
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 700;
  color: hsl(var(--muted-foreground));
}

.detail-secret-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.detail-secret-value {
  flex: 1 1 auto;
  min-width: 0;
  padding: 6px 10px;
  font-size: 13px;
  color: inherit;
  text-align: left;
  cursor: copy;
  overflow-wrap: anywhere;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.detail-secret-value:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.detail-secret-hint {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.7;
  color: hsl(var(--muted-foreground));
}

.detail-interface-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.detail-whitelist {
  margin: 0;
  font-size: 12px;
  line-height: 1.7;
  color: hsl(var(--muted-foreground));
  white-space: pre-wrap;
}

.detail-empty {
  padding-top: 8px;
}

@media (max-width: 767px) {
  .detail-secret-value {
    flex-basis: 100%;
  }

  .detail-descriptions :deep(.ant-descriptions-row) {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .detail-descriptions :deep(.ant-descriptions-item-label) {
    width: 100% !important;
    padding-bottom: 4px;
  }
}
</style>
