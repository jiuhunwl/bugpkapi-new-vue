<script lang="ts" setup>
import { computed } from 'vue';

import { useTimestamp } from '@vueuse/core';

import { IconifyIcon, RotateCw } from '@vben/icons';

import { Button, Select, Tooltip } from 'ant-design-vue';

import { $t } from '#/locales';

/**
 * 工作台刷新控件：现代 UX 形态。
 * - 自动刷新开关（Select 档位切换，0 关闭）+ 间隔选择
 * - 手动「立即刷新」按钮（带 loading 态）
 * - 上次成功刷新时间 + 失败警告（错误时显示警示与可重试）
 * 完全由外部 hook 驱动，本组件只做展示与事件转发，保持单一职责。
 */

const props = defineProps<{
  /** 当前自动刷新间隔（秒），0 表示关闭自动刷新 */
  intervalSeconds: number;
  /** 是否有刷新在途 */
  refreshing: boolean;
  /** 上次成功刷新时间戳（毫秒），null 表示尚未成功 */
  lastSuccessAt: number | null;
  /** 最近一次错误消息（空串表示无错误） */
  errorMessage?: string;
}>();

const emit = defineEmits<{
  (event: 'update:intervalSeconds', value: number): void;
  (event: 'refresh'): void;
}>();

const presetOptions = [0, 10, 30, 60, 300, 600].map((value) => ({
  label:
    value === 0
      ? $t('page.dashboard.workbench.admin.autoRefresh.reset')
      : value < 60
      ? `${value}s`
      : `${Math.round(value / 60)}m`,
  value,
}));

const currentPreset = computed(() => {
  const matched = presetOptions.find(
    (item) => item.value === props.intervalSeconds,
  );
  return matched ? matched.value : props.intervalSeconds;
});

// A reactive clock updates the age even when the next request is delayed.
const now = useTimestamp({ interval: 1000 });

/** 上次成功时间的友好文案 */
const lastRefreshLabel = computed(() => {
  if (props.lastSuccessAt === null) return null;
  const diff = now.value - props.lastSuccessAt;
  if (diff < 0) return $t('page.dashboard.workbench.admin.autoRefresh.justNow');
  const seconds = Math.round(diff / 1000);
  if (seconds < 60)
    return `${seconds}s ${$t(
      'page.dashboard.workbench.admin.autoRefresh.ago',
    )}`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60)
    return `${minutes}min ${$t(
      'page.dashboard.workbench.admin.autoRefresh.ago',
    )}`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ${$t('page.dashboard.workbench.admin.autoRefresh.ago')}`;
});

const hasError = computed(() => Boolean(props.errorMessage));

function changeInterval(value: any) {
  if (typeof value === 'number') {
    emit('update:intervalSeconds', value);
  }
}
</script>

<template>
  <div class="admin-refresh-control">
    <div class="admin-refresh-status">
      <IconifyIcon
        v-if="hasError"
        class="admin-refresh-status-icon error"
        icon="lucide:circle-alert"
      />
      <IconifyIcon
        v-else-if="refreshing"
        class="admin-refresh-status-icon spinning"
        icon="lucide:loader-circle"
      />
      <IconifyIcon
        v-else
        class="admin-refresh-status-icon"
        icon="lucide:activity"
      />
      <span
        v-if="hasError"
        class="admin-refresh-status-text error"
        role="alert"
      >
        {{ errorMessage }}
      </span>
      <span
        v-else-if="lastSuccessAt !== null"
        class="admin-refresh-status-text"
      >
        {{ $t('page.dashboard.workbench.admin.autoRefresh.updatedAt') }}
        {{ lastRefreshLabel }}
      </span>
      <span v-else class="admin-refresh-status-text">
        {{ $t('page.dashboard.workbench.admin.autoRefresh.never') }}
      </span>
    </div>

    <Tooltip :title="$t('page.dashboard.workbench.admin.autoRefresh.interval')">
      <Select
        class="admin-refresh-interval"
        :options="presetOptions"
        :value="currentPreset"
        size="small"
        @update:value="changeInterval"
      />
    </Tooltip>

    <Tooltip :title="$t('page.dashboard.workbench.admin.module.refresh')">
      <Button
        class="admin-refresh-now"
        :loading="refreshing"
        size="small"
        :aria-label="$t('page.dashboard.workbench.admin.module.refresh')"
        @click="emit('refresh')"
      >
        <RotateCw class="size-4" />
      </Button>
    </Tooltip>
  </div>
</template>

<style scoped>
.admin-refresh-control {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
  min-height: 32px;
  font-size: 12px;
}

.admin-refresh-status {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  color: hsl(var(--muted-foreground));
}

.admin-refresh-status-icon {
  color: hsl(var(--success));
}

.admin-refresh-status-icon.spinning {
  animation: spin 0.9s linear infinite;
}

.admin-refresh-status-icon.error {
  color: hsl(var(--destructive) / 0.9);
}

.admin-refresh-status-text {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-refresh-status-text.error {
  color: hsl(var(--destructive));
}

.admin-refresh-interval {
  width: 92px;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
