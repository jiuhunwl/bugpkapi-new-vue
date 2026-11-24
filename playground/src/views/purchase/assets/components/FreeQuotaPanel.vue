<script setup lang="ts">
import type { QuotaApi } from '#/api/quota';

import { computed } from 'vue';

import { Card, Progress, Tag } from 'ant-design-vue';

import { $t } from '#/locales';

const props = defineProps<{
  loading: boolean;
  overview?: QuotaApi.Overview;
}>();

const windows = computed(() =>
  (props.overview?.free ?? []).filter((item) => item.window !== 'new-account'),
);
const role = computed(() => props.overview?.role);
const newAccount = computed(() => props.overview?.newAccount);
const counterAvailable = computed(() => props.overview?.counterAvailable !== false);

const windowLabels: Record<string, string> = {
  day: 'windowDay',
  hour: 'windowHour',
  minute: 'windowMinute',
  month: 'windowMonth',
};

// 语言中立的连接符：全角冒号在英文界面里很丑，标签与角色名用中点分隔。
const roleLabelText = computed(() =>
  role.value
    ? `${$t('system.package.assets.roleLabel')} · ${role.value.name}`
    : '',
);

function label(window: string) {
  const key = windowLabels[window];
  return key ? $t(`system.package.assets.${key}`) : window;
}

// 进度条只表达「这个窗口里已经花掉多少」。不限量窗口没有分母，固定 0%。
function percent(item: QuotaApi.WindowUsage) {
  if (item.limit <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((item.used / item.limit) * 100));
}

function progressStatus(item: QuotaApi.WindowUsage) {
  return item.exhausted ? 'exception' : 'normal';
}

function usageText(item: QuotaApi.WindowUsage) {
  if (item.limit <= 0) {
    return $t('system.package.assets.windowUnlimited');
  }
  return $t('system.package.assets.windowUsed', [
    item.used.toLocaleString(),
    item.limit.toLocaleString(),
  ]);
}

function remainingText(item: QuotaApi.WindowUsage) {
  if (item.limit <= 0) {
    return $t('system.package.assets.windowUnlimited');
  }
  return $t('system.package.assets.windowRemaining', [
    item.remaining.toLocaleString(),
  ]);
}
</script>

<template>
  <Card class="quota-panel" :loading="loading">
    <template #title>
      <span class="quota-panel__title">
        {{ $t('system.package.assets.freeQuotaTitle') }}
        <Tag v-if="role" color="blue">
          {{ roleLabelText }}
        </Tag>
        <Tag v-if="role && !role.quotaEnabled" color="default">
          {{ $t('system.package.assets.quotaDisabled') }}
        </Tag>
      </span>
    </template>

    <p class="quota-panel__hint">
      {{ $t('system.package.assets.freeQuotaHint') }}
    </p>

    <div v-if="!counterAvailable" class="quota-panel__notice">
      {{ $t('system.package.assets.counterUnavailable') }}
    </div>
    <div
      v-else-if="role && !role.quotaEnabled"
      class="quota-panel__notice"
    >
      {{ $t('system.package.assets.quotaDisabled') }}
    </div>
    <div v-else class="quota-grid">
      <div v-for="item in windows" :key="item.window" class="quota-card">
        <div class="quota-card__head">
          <span class="quota-card__name">{{ label(item.window) }}</span>
          <Tag v-if="item.exhausted" color="red">
            {{ $t('system.package.assets.windowExhausted') }}
          </Tag>
        </div>
        <Progress
          :percent="percent(item)"
          :show-info="false"
          :status="progressStatus(item)"
          size="small"
        />
        <div class="quota-card__numbers">
          <span>{{ usageText(item) }}</span>
          <span class="quota-card__remaining">{{ remainingText(item) }}</span>
        </div>
        <div class="quota-card__meta">
          {{ $t('system.package.assets.windowResetAt', [item.resetAt]) }}
        </div>
      </div>
    </div>

    <div v-if="newAccount" class="quota-panel__new">
      <div class="quota-panel__new-head">
        <span>{{ $t('system.package.assets.newAccountQuota') }}</span>
        <Tag v-if="newAccount.exhausted" color="red">
          {{ $t('system.package.assets.windowExhausted') }}
        </Tag>
      </div>
      <Progress
        :percent="percent(newAccount)"
        :show-info="false"
        :status="progressStatus(newAccount)"
        size="small"
      />
      <div class="quota-card__numbers">
        <span>{{ usageText(newAccount) }}</span>
        <span class="quota-card__remaining">{{ remainingText(newAccount) }}</span>
      </div>
      <div class="quota-card__meta">
        {{ $t('system.package.assets.newAccountHint') }}
      </div>
    </div>
  </Card>
</template>

<style scoped>
.quota-panel {
  background: hsl(var(--card));
  border-color: hsl(var(--border));
  border-radius: 8px;
}

.quota-panel__title {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.quota-panel__hint {
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 1.6;
  color: hsl(var(--muted-foreground));
}

.quota-panel__notice {
  padding: 10px 12px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 60%);
  border-radius: 6px;
}

.quota-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.quota-card {
  padding: 12px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.quota-card__head {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.quota-card__name {
  font-size: 13px;
  font-weight: 600;
}

.quota-card__numbers {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: space-between;
  font-size: 12px;
  color: hsl(var(--foreground));
}

.quota-card__remaining {
  color: hsl(var(--muted-foreground));
}

.quota-card__meta {
  margin-top: 4px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.quota-panel__new {
  padding: 12px;
  margin-top: 12px;
  border: 1px dashed hsl(var(--border));
  border-radius: 8px;
}

.quota-panel__new-head {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
}
</style>
