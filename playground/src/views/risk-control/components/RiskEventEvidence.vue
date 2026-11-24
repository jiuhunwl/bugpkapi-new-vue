<script setup lang="ts">
import type { RiskControlApi } from '#/api/risk-control';

import { computed } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { $t } from '#/locales';

const props = defineProps<{
  event: RiskControlApi.RiskEvent;
}>();

const accounts = computed(() => props.event.accounts ?? []);
const apiKeys = computed(() => props.event.apiKeys ?? []);
const requestIps = computed(() => {
  if (props.event.requestIps?.length) return props.event.requestIps;
  return props.event.clientIp ? [props.event.clientIp] : [];
});
const requestMethods = computed(() => props.event.requestMethods ?? []);
const hasIdentityEvidence = computed(
  () =>
    accounts.value.length > 0 ||
    apiKeys.value.length > 0 ||
    requestIps.value.length > 0 ||
    requestMethods.value.length > 0,
);

function accountLabel(account: RiskControlApi.RiskAccount) {
  if (account.username) return `${account.username} (#${account.id})`;
  return $t('system.riskControl.events.evidence.unknownAccount', [account.id]);
}

function formatCount(value: number) {
  return Number(value || 0).toLocaleString();
}
</script>

<template>
  <section class="risk-evidence">
    <header class="risk-evidence__head">
      <div class="risk-evidence__title">
        <IconifyIcon icon="lucide:fingerprint" />
        <span>{{ $t('system.riskControl.events.evidence.title') }}</span>
      </div>
      <div class="risk-evidence__outcome">
        <span class="is-success">
          {{
            $t('system.riskControl.events.evidence.successCount', [
              formatCount(event.successCount),
            ])
          }}
        </span>
        <span class="is-failed">
          {{
            $t('system.riskControl.events.evidence.failedCount', [
              formatCount(event.failedCount),
            ])
          }}
        </span>
        <span>
          {{
            $t('system.riskControl.events.evidence.latency', [
              formatCount(event.avgElapsedMs),
            ])
          }}
        </span>
      </div>
    </header>

    <div v-if="hasIdentityEvidence" class="risk-evidence__grid">
      <article v-if="accounts.length" class="risk-evidence__group">
        <span class="risk-evidence__label">
          <IconifyIcon icon="lucide:user-round-search" />
          {{ $t('system.riskControl.events.evidence.accounts') }}
        </span>
        <div class="risk-evidence__values">
          <code
            v-for="account in accounts"
            :key="`${account.id}:${account.username || ''}`"
            :title="accountLabel(account)"
          >
            {{ accountLabel(account) }}
          </code>
        </div>
      </article>

      <article v-if="requestIps.length" class="risk-evidence__group">
        <span class="risk-evidence__label">
          <IconifyIcon icon="lucide:network" />
          {{ $t('system.riskControl.events.evidence.requestIps') }}
        </span>
        <div class="risk-evidence__values">
          <code v-for="ip in requestIps" :key="ip" :title="ip">{{ ip }}</code>
        </div>
      </article>

      <article v-if="apiKeys.length" class="risk-evidence__group">
        <span class="risk-evidence__label">
          <IconifyIcon icon="lucide:key-round" />
          {{ $t('system.riskControl.events.evidence.apiKeys') }}
        </span>
        <div class="risk-evidence__values">
          <code v-for="apiKey in apiKeys" :key="apiKey" :title="apiKey">
            {{ apiKey }}
          </code>
        </div>
      </article>

      <article v-if="requestMethods.length" class="risk-evidence__group">
        <span class="risk-evidence__label">
          <IconifyIcon icon="lucide:send" />
          {{ $t('system.riskControl.events.evidence.requestMethods') }}
        </span>
        <div class="risk-evidence__values">
          <code v-for="method in requestMethods" :key="method">
            {{ method }}
          </code>
        </div>
      </article>
    </div>

    <p v-else class="risk-evidence__empty">
      {{ $t('system.riskControl.events.evidence.empty') }}
    </p>
  </section>
</template>

<style scoped>
.risk-evidence {
  padding: 12px;
  margin-top: 12px;
  background:
    linear-gradient(90deg, hsl(var(--primary) / 8%), transparent 38%),
    hsl(var(--muted) / 30%);
  border: 1px solid hsl(var(--border));
  border-left: 3px solid hsl(var(--primary));
  border-radius: 7px;
}

.risk-evidence__head {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.risk-evidence__title,
.risk-evidence__outcome,
.risk-evidence__label,
.risk-evidence__values {
  display: flex;
  align-items: center;
}

.risk-evidence__title {
  gap: 7px;
  font-size: 12px;
  font-weight: 800;
  color: hsl(var(--foreground));
  letter-spacing: 0.04em;
}

.risk-evidence__title svg {
  width: 16px;
  height: 16px;
  color: hsl(var(--primary));
}

.risk-evidence__outcome {
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}

.risk-evidence__outcome span {
  padding: 2px 7px;
  font-size: 11px;
  font-weight: 700;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--background) / 76%);
  border: 1px solid hsl(var(--border));
  border-radius: 5px;
}

.risk-evidence__outcome .is-success {
  color: #15803d;
  border-color: rgb(22 163 74 / 28%);
}

.risk-evidence__outcome .is-failed {
  color: #dc2626;
  border-color: rgb(220 38 38 / 28%);
}

.risk-evidence__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 14px;
  margin-top: 11px;
}

.risk-evidence__group {
  min-width: 0;
}

.risk-evidence__label {
  gap: 5px;
  margin-bottom: 6px;
  font-size: 11px;
  font-weight: 700;
  color: hsl(var(--muted-foreground));
}

.risk-evidence__label svg {
  width: 13px;
  height: 13px;
}

.risk-evidence__values {
  flex-wrap: wrap;
  gap: 5px;
}

.risk-evidence__values code {
  max-width: 100%;
  padding: 3px 7px;
  overflow: hidden;
  font-size: 11px;
  line-height: 17px;
  color: hsl(var(--foreground));
  text-overflow: ellipsis;
  white-space: nowrap;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 5px;
}

.risk-evidence__empty {
  margin: 10px 0 0;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

html.dark .risk-evidence__outcome .is-success {
  color: #4ade80;
}

html.dark .risk-evidence__outcome .is-failed {
  color: #f87171;
}

@media (max-width: 760px) {
  .risk-evidence__head {
    align-items: flex-start;
    flex-direction: column;
  }

  .risk-evidence__outcome {
    justify-content: flex-start;
  }

  .risk-evidence__grid {
    grid-template-columns: 1fr;
  }
}
</style>
