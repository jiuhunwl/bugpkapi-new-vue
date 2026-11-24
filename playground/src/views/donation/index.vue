<script setup lang="ts">
import type { DonationApi } from '#/api/donation';

import { computed, onMounted, ref, shallowRef } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon, RotateCw } from '@vben/icons';
import { useAccessStore, useUserStore } from '@vben/stores';

import { Alert, Button, Card, message, Spin, Tag } from 'ant-design-vue';

import { getDonationConfig, updateDonationConfig } from '#/api/donation';
import { $t } from '#/locales';

import DonationCopyForm from './components/DonationCopyForm.vue';
import DonationMethodEditor from './components/DonationMethodEditor.vue';
import DonationPreview from './components/DonationPreview.vue';
import DonationSupporterManager from './components/DonationSupporterManager.vue';
import {
  createDefaultDonationConfig,
  normalizeDonationConfig,
  validateDonationConfig,
} from './model';

const config = ref<DonationApi.Config>(createDefaultDonationConfig());
const loading = shallowRef(false);
const saving = shallowRef(false);
const loadError = shallowRef<Error | null>(null);
const accessStore = useAccessStore();
const userStore = useUserStore();
const isAdmin = computed(() => userStore.userRoles.includes('admin'));
const hasCode = (code: string) =>
  isAdmin.value || accessStore.accessCodes.includes(code);
const canUpdate = computed(() => hasCode('donation:config:update'));
const canUpload = computed(() => hasCode('donation:upload-qr'));
const canListSupporters = computed(() => hasCode('donation:supporter:list'));
const canCreateSupporter = computed(() => hasCode('donation:supporter:create'));
const statusColor = computed(() =>
  config.value.enabled === 1 ? 'success' : 'default',
);

function applyConfig(next: DonationApi.Config) {
  config.value = {
    ...next,
    methods: [...(next.methods ?? [])].sort(
      (first, second) => first.sortNo - second.sortNo,
    ),
  };
}

function applyMethods(methods: DonationApi.Method[]) {
  config.value = { ...config.value, methods };
}

async function loadConfig() {
  loading.value = true;
  loadError.value = null;
  try {
    applyConfig(await getDonationConfig());
  } catch (cause) {
    loadError.value = cause instanceof Error ? cause : new Error(String(cause));
  } finally {
    loading.value = false;
  }
}

async function saveConfig() {
  if (!canUpdate.value || saving.value) return;
  const issue = validateDonationConfig(config.value);
  if (issue) {
    const methodNumber = (issue.methodIndex ?? 0) + 1;
    message.error(
      $t(`donationSettings.validation.${issue.code}`, [methodNumber]),
    );
    return;
  }
  saving.value = true;
  try {
    await updateDonationConfig(normalizeDonationConfig(config.value));
    message.success($t('donationSettings.messages.saved'));
    await loadConfig();
  } finally {
    saving.value = false;
  }
}

onMounted(() => void loadConfig());
</script>

<template>
  <Page
    auto-content-height
    :description="$t('donationSettings.description')"
    :title="$t('donationSettings.title')"
  >
    <template #extra>
      <div class="page-actions">
        <Tag :color="statusColor">
          {{
            config.enabled === 1
              ? $t('donationSettings.status.published')
              : $t('donationSettings.status.unpublished')
          }}
        </Tag>
        <div class="page-actions__buttons">
          <Button :disabled="loading" @click="loadConfig">
            <template #icon><RotateCw class="size-4" /></template>
            {{ $t('donationSettings.actions.reload') }}
          </Button>
          <Button
            v-if="canUpdate"
            :loading="saving"
            type="primary"
            @click="saveConfig"
          >
            <template #icon><IconifyIcon icon="lucide:save" /></template>
            {{ $t('donationSettings.actions.save') }}
          </Button>
        </div>
      </div>
    </template>

    <div class="donation-settings-page">
      <Alert
        v-if="!canUpdate"
        show-icon
        type="info"
        :message="$t('donationSettings.readOnly.title')"
        :description="$t('donationSettings.readOnly.description')"
      />

      <Alert
        v-if="loadError"
        closable
        show-icon
        type="error"
        :message="$t('donationSettings.loadError.title')"
        :description="$t('donationSettings.loadError.description')"
        @close="loadError = null"
      />

      <Spin :spinning="loading">
        <div class="settings-layout">
          <main class="settings-editor">
            <Card class="settings-card" :bordered="false">
              <DonationCopyForm
                :disabled="!canUpdate"
                :model-value="config"
                @update:model-value="applyConfig"
              />
            </Card>
            <Card class="settings-card" :bordered="false">
              <DonationMethodEditor
                :can-upload="canUpload"
                :disabled="!canUpdate"
                :methods="config.methods"
                @update:methods="applyMethods"
              />
            </Card>
          </main>
          <Card class="settings-card preview-card" :bordered="false">
            <DonationPreview :config="config" />
          </Card>
        </div>
      </Spin>

      <div class="update-hint">
        <IconifyIcon icon="lucide:clock-3" />
        <span>
          {{
            $t('donationSettings.lastUpdated', [
              config.updateTime || $t('donationSettings.never'),
            ])
          }}
        </span>
      </div>

      <DonationSupporterManager
        v-if="canListSupporters"
        :can-create="canCreateSupporter"
      />
    </div>
  </Page>
</template>

<style scoped>
.donation-settings-page {
  display: grid;
  gap: 16px;
  width: 100%;
  max-width: 1440px;
  margin: 0 auto;
}

.page-actions,
.page-actions__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.settings-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(340px, 0.75fr);
  gap: 16px;
  align-items: start;
}

.settings-editor {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.settings-card {
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
  box-shadow: none;
}

.preview-card {
  position: sticky;
  top: 16px;
}

.update-hint {
  display: flex;
  gap: 7px;
  align-items: center;
  justify-content: flex-end;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.update-hint svg {
  flex: 0 0 auto;
}

@media (max-width: 1100px) {
  .settings-layout {
    grid-template-columns: 1fr;
  }

  .preview-card {
    position: static;
  }
}

@media (max-width: 720px) {
  .page-actions {
    align-items: stretch;
    width: 100%;
  }

  .page-actions__buttons,
  .page-actions__buttons :deep(.ant-btn) {
    width: 100%;
  }

  .page-actions__buttons :deep(.ant-btn) {
    flex: 1;
  }

  .update-hint {
    justify-content: flex-start;
  }
}
</style>
