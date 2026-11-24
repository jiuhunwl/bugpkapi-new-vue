<script setup lang="ts">
import type { RiskControlApi } from '#/api/risk-control';

import { computed } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { $t } from '#/locales';

import RiskEventEvidence from './RiskEventEvidence.vue';

const props = defineProps<{
  events: RiskControlApi.RiskEvent[];
}>();

const visibleEvents = computed(() => props.events ?? []);

function eventTypeText(type: RiskControlApi.RiskEventType) {
  const keys: Record<RiskControlApi.RiskEventType, string> = {
    DISTRIBUTED_SAME_PARAMS: 'system.riskControl.events.distributedType',
    PROXY_POOL_SAME_PARAMS: 'system.riskControl.events.proxyPoolType',
    SINGLE_IP_CC: 'system.riskControl.events.singleIpType',
  };
  return $t(keys[type]);
}

function severityText(level: RiskControlApi.RiskLevel) {
  return $t(`system.riskControl.levels.${level.toLowerCase()}`);
}

function eventReasonText(type: RiskControlApi.RiskEventType) {
  const keys: Record<RiskControlApi.RiskEventType, string> = {
    DISTRIBUTED_SAME_PARAMS: 'system.riskControl.events.distributedReason',
    PROXY_POOL_SAME_PARAMS: 'system.riskControl.events.proxyPoolReason',
    SINGLE_IP_CC: 'system.riskControl.events.singleIpReason',
  };
  return $t(keys[type]);
}

function eventIcon(type: RiskControlApi.RiskEventType) {
  const icons: Record<RiskControlApi.RiskEventType, string> = {
    DISTRIBUTED_SAME_PARAMS: 'lucide:waypoints',
    PROXY_POOL_SAME_PARAMS: 'lucide:network',
    SINGLE_IP_CC: 'lucide:radar',
  };
  return icons[type];
}

function eventKey(event: RiskControlApi.RiskEvent) {
  return [
    event.eventType,
    event.interfaceId || event.apiCode || 'unknown-api',
    event.paramSignature,
    event.clientIp || 'pool',
    event.firstSeen,
    event.lastSeen,
  ].join(':');
}
</script>

<template>
  <section class="risk-event-feed">
    <div class="risk-event-feed__head">
      <div>
        <h3>{{ $t('system.riskControl.events.title') }}</h3>
        <p>{{ $t('system.riskControl.events.description') }}</p>
      </div>
      <span>
        {{ $t('system.riskControl.events.count', [visibleEvents.length]) }}
      </span>
    </div>

    <div v-if="visibleEvents.length" class="risk-event-list">
      <article
        v-for="event in visibleEvents"
        :key="eventKey(event)"
        class="risk-event"
        :class="`is-${event.severity.toLowerCase()}`"
      >
        <div class="risk-event__marker">
          <IconifyIcon :icon="eventIcon(event.eventType)" />
        </div>
        <div class="risk-event__main">
          <div class="risk-event__title-row">
            <strong>{{ eventTypeText(event.eventType) }}</strong>
            <span>{{ severityText(event.severity) }} · {{ event.riskScore }}</span>
          </div>
          <p class="risk-event__reason">
            {{ eventReasonText(event.eventType) }}
          </p>
          <div class="risk-event__facts">
            <span>{{ event.interfaceName || event.apiCode || '-' }}</span>
            <span>
              {{
                $t('system.riskControl.events.requestCount', [
                  event.requestCount.toLocaleString(),
                ])
              }}
            </span>
            <span>
              {{
                $t('system.riskControl.events.ipCount', [
                  event.uniqueIpCount.toLocaleString(),
                ])
              }}
            </span>
            <span v-if="event.uniqueUserCount > 0">
              {{
                $t('system.riskControl.events.userCount', [
                  event.uniqueUserCount.toLocaleString(),
                ])
              }}
            </span>
            <span v-if="event.uniqueKeyCount > 0">
              {{
                $t('system.riskControl.events.keyCount', [
                  event.uniqueKeyCount.toLocaleString(),
                ])
              }}
            </span>
            <span v-if="event.region">{{ event.region }}</span>
          </div>
          <RiskEventEvidence :event="event" />
          <code v-if="event.requestSample">{{ event.requestSample }}</code>
          <small>{{ event.firstSeen }} - {{ event.lastSeen }}</small>
        </div>
      </article>
    </div>

    <div v-else class="risk-event-empty">
      <IconifyIcon icon="lucide:shield-check" />
      <span>{{ $t('system.riskControl.events.empty') }}</span>
    </div>
  </section>
</template>

<style scoped>
.risk-event-feed {
  min-width: 0;
  padding: 18px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.risk-event-feed__head {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 14px;
}

.risk-event-feed__head h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 800;
  line-height: 24px;
  color: hsl(var(--foreground));
}

.risk-event-feed__head p {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 20px;
  color: rgb(100 116 139);
}

.risk-event-feed__head span {
  flex: 0 0 auto;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 700;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
  border-radius: 9px;
}

.risk-event-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.risk-event {
  display: flex;
  gap: 12px;
  min-width: 0;
  padding: 14px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.risk-event.is-critical {
  border-color: rgb(220 38 38 / 52%);
}

.risk-event.is-high {
  border-color: rgb(249 115 22 / 50%);
}

.risk-event.is-medium {
  border-color: rgb(234 179 8 / 50%);
}

.risk-event__marker {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  font-size: 18px;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
  border-radius: 12px;
}

.risk-event__main {
  flex: 1 1 auto;
  min-width: 0;
}

.risk-event__title-row {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
}

.risk-event__title-row strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 15px;
  line-height: 22px;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.risk-event__title-row span {
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 800;
  color: rgb(220 38 38);
}

.risk-event__reason {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 20px;
  color: rgb(100 116 139);
}

.risk-event__facts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.risk-event__facts span {
  max-width: 240px;
  padding: 3px 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  line-height: 18px;
  color: rgb(51 65 85);
  white-space: nowrap;
  background: hsl(var(--muted) / 58%);
  border-radius: 9px;
}

.risk-event code {
  display: block;
  padding: 10px;
  margin-top: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  line-height: 18px;
  color: hsl(var(--foreground));
  white-space: nowrap;
  background: hsl(var(--muted) / 45%);
  border: 1px solid hsl(var(--border));
  border-radius: 9px;
}

.risk-event small {
  display: block;
  margin-top: 8px;
  font-size: 12px;
  color: rgb(100 116 139);
}

.risk-event-empty {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  justify-content: center;
  min-height: 240px;
  color: rgb(100 116 139);
}

.risk-event-empty svg {
  width: 42px;
  height: 42px;
  padding: 10px;
  color: #16a34a;
  background: rgb(22 163 74 / 10%);
  border-radius: 12px;
}

html.dark .risk-event-feed__head p,
html.dark .risk-event__reason,
html.dark .risk-event small,
html.dark .risk-event-empty {
  color: rgb(148 163 184);
}

html.dark .risk-event__facts span {
  color: rgb(203 213 225);
}
</style>
