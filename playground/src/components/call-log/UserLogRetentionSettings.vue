<script setup lang="ts">
import { onMounted, reactive, shallowRef } from 'vue';

import { Alert, Button, InputNumber, message, Switch } from 'ant-design-vue';

import {
  getUserLogCleanupConfig,
  updateUserLogCleanupConfig,
} from '#/api/system/log-cleanup';
import { $t } from '#/locales';

defineOptions({ name: 'UserLogRetentionSettings' });

const emit = defineEmits<{ saved: [] }>();
const loading = shallowRef(false);
const saving = shallowRef(false);
const form = reactive({
  enabled: false,
  lastRunTime: '',
  retentionDays: 90,
});

async function loadConfig() {
  loading.value = true;
  try {
    const config = await getUserLogCleanupConfig();
    form.enabled = config.enabled === 1;
    form.retentionDays = Number(config.retentionDays || 90);
    form.lastRunTime = config.lastRunTime || '';
  } finally {
    loading.value = false;
  }
}

async function saveConfig() {
  const retentionDays = Number(form.retentionDays);
  if (
    !Number.isInteger(retentionDays) ||
    retentionDays < 1 ||
    retentionDays > 3650
  ) {
    message.warning($t('system.logCleanup.validation.retentionDays'));
    return;
  }
  saving.value = true;
  try {
    await updateUserLogCleanupConfig({
      enabled: form.enabled ? 1 : 0,
      lastRunTime: form.lastRunTime || null,
      retentionDays,
    });
    message.success($t('system.logCleanup.messages.saved'));
    await loadConfig();
    emit('saved');
  } finally {
    saving.value = false;
  }
}

onMounted(() => void loadConfig());
</script>

<template>
  <section class="settings-panel">
    <div class="panel-heading">
      <div>
        <h2>{{ $t('system.logCleanup.userTitle') }}</h2>
        <p>{{ $t('system.logCleanup.userDescription') }}</p>
      </div>
    </div>

    <Alert
      class="mb-6"
      :message="$t('system.logCleanup.notice')"
      show-icon
      type="info"
    />

    <div class="settings-grid">
      <label class="config-item">
        <span class="config-label">
          {{ $t('system.logCleanup.enabledLabel') }}
        </span>
        <div class="flex items-center gap-3">
          <Switch
            v-model:checked="form.enabled"
            :checked-children="$t('system.logCleanup.enabled')"
            :un-checked-children="$t('system.logCleanup.disabled')"
          />
          <span class="text-sm text-muted-foreground">
            {{
              form.enabled
                ? $t('system.logCleanup.enabledDescription')
                : $t('system.logCleanup.disabledDescription')
            }}
          </span>
        </div>
      </label>

      <label class="config-item">
        <span class="config-label">
          {{ $t('system.logCleanup.retentionDays') }}
        </span>
        <InputNumber
          v-model:value="form.retentionDays"
          class="w-full"
          :max="3650"
          :min="1"
          :precision="0"
          :step="1"
        />
        <span class="text-xs text-muted-foreground">
          {{ $t('system.logCleanup.retentionHint') }}
        </span>
      </label>

      <div class="config-item settings-wide">
        <span class="config-label">
          {{ $t('system.logCleanup.lastRun') }}
        </span>
        <div class="last-run-value">
          {{ form.lastRunTime || $t('system.logCleanup.neverRun') }}
        </div>
      </div>
    </div>

    <div class="panel-actions">
      <Button
        type="primary"
        :loading="saving || loading"
        @click="saveConfig"
      >
        {{ $t('system.logCleanup.save') }}
      </Button>
    </div>
  </section>
</template>

<style scoped>
.settings-panel {
  padding: 24px;
  color: hsl(var(--foreground));
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
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

.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.config-label {
  font-size: 14px;
  font-weight: 600;
}

.settings-wide {
  grid-column: 1 / -1;
}

.last-run-value {
  padding: 12px 16px;
  font-size: 13px;
  background: hsl(var(--muted) / 20%);
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.panel-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 16px;
  margin-top: 24px;
  border-top: 1px solid hsl(var(--border));
}

@media (max-width: 768px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }

  .settings-wide {
    grid-column: auto;
  }
}
</style>
