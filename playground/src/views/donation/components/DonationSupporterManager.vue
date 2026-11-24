<script setup lang="ts">
import type { DonationApi } from '#/api/donation';

import { onMounted, reactive, shallowRef } from 'vue';

import { IconifyIcon, RotateCw } from '@vben/icons';

import { Alert, Button, Card, message } from 'ant-design-vue';

import { createDonationSupporter, getDonationSupporters } from '#/api/donation';
import { $t } from '#/locales';

import DonationSupporterForm from './DonationSupporterForm.vue';
import DonationSupporterTable from './DonationSupporterTable.vue';

const props = defineProps<{
  canCreate: boolean;
}>();

const createOpen = shallowRef(false);
const items = shallowRef<DonationApi.Supporter[]>([]);
const loadError = shallowRef<Error | null>(null);
const loading = shallowRef(false);
const submitting = shallowRef(false);
const page = reactive({ current: 1, pageSize: 10, total: 0 });

async function loadSupporters() {
  loading.value = true;
  loadError.value = null;
  try {
    const result = await getDonationSupporters({
      page: page.current,
      pageSize: page.pageSize,
    });
    items.value = [...(result.items ?? [])];
    page.total = Number(result.total ?? 0);
  } catch (cause) {
    loadError.value = cause instanceof Error ? cause : new Error(String(cause));
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  if (!props.canCreate) return;
  createOpen.value = true;
}

async function createSupporter(payload: DonationApi.CreateSupporterPayload) {
  if (!props.canCreate || submitting.value) return;
  submitting.value = true;
  try {
    await createDonationSupporter(payload);
    message.success($t('donationSettings.supporters.messages.created'));
    createOpen.value = false;
    page.current = 1;
    await loadSupporters();
  } finally {
    submitting.value = false;
  }
}

function changePage(current: number, pageSize: number) {
  page.current = pageSize === page.pageSize ? current : 1;
  page.pageSize = pageSize;
  void loadSupporters();
}

onMounted(() => void loadSupporters());
</script>

<template>
  <Card class="supporter-manager">
    <template #title>
      <div class="supporter-manager-title">
        <span>{{ $t('donationSettings.supporters.title') }}</span>
        <small>{{ $t('donationSettings.supporters.description') }}</small>
      </div>
    </template>
    <template #extra>
      <div class="supporter-manager-actions">
        <Button :disabled="loading" @click="loadSupporters">
          <template #icon><RotateCw class="size-4" /></template>
          {{ $t('donationSettings.supporters.actions.reload') }}
        </Button>
        <Button v-if="props.canCreate" type="primary" @click="openCreate">
          <template #icon>
            <IconifyIcon icon="mdi:account-plus-outline" />
          </template>
          {{ $t('donationSettings.supporters.actions.add') }}
        </Button>
      </div>
    </template>

    <Alert
      v-if="!props.canCreate"
      class="supporter-manager-alert"
      show-icon
      type="info"
      :message="$t('donationSettings.supporters.readOnly')"
    />
    <Alert
      v-if="loadError"
      class="supporter-manager-alert"
      closable
      show-icon
      type="error"
      :description="$t('donationSettings.supporters.loadErrorDescription')"
      :message="$t('donationSettings.supporters.loadErrorTitle')"
      @close="loadError = null"
    />

    <DonationSupporterTable
      :items="items"
      :loading="loading"
      :page="page"
      @page-change="changePage"
    />
    <DonationSupporterForm
      v-if="props.canCreate"
      v-model:open="createOpen"
      :submitting="submitting"
      @submit="createSupporter"
    />
  </Card>
</template>

<style scoped>
.supporter-manager {
  border-color: hsl(var(--border));
  border-radius: 8px;
}

.supporter-manager-title span,
.supporter-manager-title small {
  display: block;
}

.supporter-manager-title small {
  margin-top: 4px;
  font-size: 12px;
  font-weight: 400;
  color: hsl(var(--muted-foreground));
}

.supporter-manager-actions {
  display: flex;
  gap: 8px;
}

.supporter-manager-alert {
  margin-bottom: 14px;
}

@media (max-width: 720px) {
  .supporter-manager-actions {
    flex-direction: column;
  }
}
</style>
