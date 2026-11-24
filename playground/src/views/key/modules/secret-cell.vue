<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { Button, message, Tooltip } from 'ant-design-vue';

import { getKeySecret } from '#/api/key';
import { $t } from '#/locales';
import { copyText } from '#/utils/copy-text';

interface Props {
  keyId: string;
  maskedKey: string;
  secretAvailable: boolean;
}

const props = defineProps<Props>();

const secretKey = shallowRef('');
const visible = shallowRef(false);
const loading = shallowRef(false);
let requestVersion = 0;

watch(
  () => [props.keyId, props.secretAvailable] as const,
  () => {
    requestVersion += 1;
    secretKey.value = '';
    visible.value = false;
    loading.value = false;
  },
);

const displayValue = computed(() =>
  visible.value && secretKey.value ? secretKey.value : props.maskedKey || '••••••••',
);
const toggleLabel = computed(() =>
  visible.value ? $t('system.key.detailHide') : $t('system.key.detailShow'),
);

async function ensureSecretLoaded() {
  if (!props.secretAvailable || loading.value) return false;
  if (!secretKey.value) {
    const version = ++requestVersion;
    loading.value = true;
    try {
      const result = await getKeySecret(props.keyId);
      if (version !== requestVersion) return;
      secretKey.value = String(result.secretKey || '').trim();
      if (!secretKey.value) {
        message.error($t('system.key.secretRevealFailed'));
        return false;
      }
    } catch {
      if (version === requestVersion) {
        message.error($t('system.key.secretRevealFailed'));
      }
      return false;
    } finally {
      if (version === requestVersion) {
        loading.value = false;
      }
    }
  }
  return Boolean(secretKey.value);
}

async function toggleSecret() {
  if (!props.secretAvailable || loading.value) return;
  if (visible.value) {
    visible.value = false;
    return;
  }
  if (!(await ensureSecretLoaded())) return;
  visible.value = true;
}

async function copySecret() {
  if (!(await ensureSecretLoaded())) return;
  try {
    await copyText(secretKey.value);
    message.success($t('system.key.copySecretSuccess'));
  } catch {
    message.error($t('system.key.copySecretFailed'));
  }
}
</script>

<template>
  <div class="secret-cell">
    <button
      class="secret-cell__value"
      :disabled="!secretAvailable"
      :title="$t('system.key.detailCopy')"
      type="button"
      @click="copySecret"
    >
      <code>{{ displayValue }}</code>
    </button>
    <Tooltip
      :title="
        secretAvailable
          ? toggleLabel
          : $t('system.key.secretUnavailable')
      "
    >
      <Button
        :aria-label="toggleLabel"
        :disabled="!secretAvailable"
        :loading="loading"
        shape="circle"
        size="small"
        type="text"
        @click="toggleSecret"
      >
        <template #icon>
          <IconifyIcon
            :icon="visible ? 'lucide:eye-off' : 'lucide:eye'"
            class="size-4"
          />
        </template>
      </Button>
    </Tooltip>
    <Tooltip :title="$t('system.key.detailCopy')">
      <Button
        :aria-label="$t('system.key.detailCopy')"
        :disabled="!secretAvailable"
        :loading="loading"
        shape="circle"
        size="small"
        type="text"
        @click="copySecret"
      >
        <template #icon>
          <IconifyIcon class="size-4" icon="lucide:copy" />
        </template>
      </Button>
    </Tooltip>
  </div>
</template>

<style scoped>
.secret-cell {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.secret-cell__value {
  display: block;
  min-width: 0;
  padding: 3px 6px;
  overflow: hidden;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: hsl(var(--muted));
  border: 0;
  border-radius: 4px;
  cursor: copy;
}

.secret-cell__value:disabled {
  cursor: not-allowed;
}

.secret-cell__value code {
  font: inherit;
}
</style>
