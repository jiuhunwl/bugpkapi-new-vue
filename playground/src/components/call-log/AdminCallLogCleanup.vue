<script setup lang="ts">
import type { Dayjs } from 'dayjs';

import type { UserLogCleanupApi } from '#/api/system/log-cleanup';

import { computed, shallowRef } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { Alert, Button, DatePicker, message, Modal } from 'ant-design-vue';
import dayjs from 'dayjs';

import { cleanupCallLogs } from '#/api/system/log-cleanup';
import { $t } from '#/locales';

defineOptions({ name: 'AdminCallLogCleanup' });

const emit = defineEmits<{
  cleaned: [result: UserLogCleanupApi.AdminCleanupResult];
}>();

const cleaning = shallowRef(false);
const cutoff = shallowRef<Dayjs | undefined>(
  dayjs().subtract(1, 'day').endOf('day'),
);
const lastResult = shallowRef<null | UserLogCleanupApi.AdminCleanupResult>(null);

const cutoffText = computed(() =>
  cutoff.value?.format('YYYY-MM-DD HH:mm:ss') ?? '',
);
const actionText = computed(() =>
  lastResult.value?.hasMore
    ? $t('system.logCleanup.admin.continueAction')
    : $t('system.logCleanup.admin.cleanupAction'),
);

function disabledDate(current: Dayjs) {
  return !current || current.isAfter(dayjs().subtract(1, 'day'), 'day');
}

function confirmCleanup() {
  if (!cutoff.value || cleaning.value) {
    if (!cutoff.value) {
      message.warning($t('system.logCleanup.admin.cutoffRequired'));
    }
    return;
  }
  Modal.confirm({
    title: $t('system.logCleanup.admin.confirmTitle'),
    content: $t('system.logCleanup.admin.confirmContent', [cutoffText.value]),
    okText: actionText.value,
    okType: 'danger',
    onOk: executeCleanup,
  });
}

async function executeCleanup() {
  if (!cutoffText.value || cleaning.value) {
    return;
  }
  cleaning.value = true;
  try {
    const result = await cleanupCallLogs(cutoffText.value);
    lastResult.value = result;
    emit('cleaned', result);
    message.success(
      $t('system.logCleanup.messages.cleanupCompleted', [
        result.deleted.toLocaleString(),
      ]),
    );
  } finally {
    cleaning.value = false;
  }
}
</script>

<template>
  <section class="cleanup-panel">
    <div class="panel-heading">
      <div>
        <h2>{{ $t('system.logCleanup.admin.title') }}</h2>
        <p>{{ $t('system.logCleanup.admin.description') }}</p>
      </div>
      <span class="danger-icon" aria-hidden="true">
        <IconifyIcon icon="lucide:trash-2" />
      </span>
    </div>

    <Alert
      :message="$t('system.logCleanup.admin.warning')"
      show-icon
      type="warning"
    />

    <div class="cleanup-controls">
      <label class="cutoff-field">
        <span>{{ $t('system.logCleanup.admin.cutoffLabel') }}</span>
        <DatePicker
          v-model:value="cutoff"
          class="w-full"
          :disabled-date="disabledDate"
          format="YYYY-MM-DD HH:mm:ss"
          show-time
        />
        <small>{{ $t('system.logCleanup.admin.cutoffHint') }}</small>
      </label>

      <Button danger :loading="cleaning" @click="confirmCleanup">
        <template #icon>
          <IconifyIcon icon="lucide:trash-2" />
        </template>
        {{ actionText }}
      </Button>
    </div>

    <Alert
      v-if="lastResult"
      class="mt-5"
      :message="$t('system.logCleanup.admin.resultTitle')"
      :description="
        lastResult.hasMore
          ? $t('system.logCleanup.admin.resultMore', [
              lastResult.deleted.toLocaleString(),
              lastResult.batchLimit.toLocaleString(),
            ])
          : $t('system.logCleanup.admin.resultDone', [
              lastResult.deleted.toLocaleString(),
            ])
      "
      show-icon
      :type="lastResult.hasMore ? 'warning' : 'success'"
    />
  </section>
</template>

<style scoped>
.cleanup-panel {
  padding: 24px;
  color: hsl(var(--foreground));
  background: hsl(var(--card));
  border: 1px solid hsl(var(--destructive) / 35%);
  border-radius: 8px;
}

.panel-heading {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
}

.panel-heading h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.panel-heading p {
  margin: 4px 0 20px;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.danger-icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 10%);
  border-radius: 8px;
}

.danger-icon :deep(svg) {
  width: 20px;
  height: 20px;
}

.cleanup-controls {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) auto;
  gap: 16px;
  align-items: end;
  margin-top: 20px;
}

.cutoff-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
}

.cutoff-field small {
  font-size: 12px;
  font-weight: 400;
  color: hsl(var(--muted-foreground));
}

@media (max-width: 640px) {
  .cleanup-controls {
    grid-template-columns: 1fr;
  }
}
</style>
