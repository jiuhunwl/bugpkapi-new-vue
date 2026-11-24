<script setup lang="ts">
import type { RiskControlApi } from '#/api/risk-control';

import { computed } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { $t } from '#/locales';

const props = defineProps<{
  accounts: RiskControlApi.FailedAccountRank[];
  canBan?: boolean;
  failedRequests: number;
  ips: RiskControlApi.FailedIPRank[];
}>();

const emit = defineEmits<{
  ban: [account: RiskControlApi.FailedAccountRank];
}>();

const visibleIPs = computed(() => props.ips ?? []);
const visibleAccounts = computed(() => props.accounts ?? []);
const maxIPFailures = computed(() =>
  Math.max(1, ...visibleIPs.value.map((item) => item.failedCalls)),
);
const maxAccountFailures = computed(() =>
  Math.max(1, ...visibleAccounts.value.map((item) => item.failedCalls)),
);

function formatCount(value: number | string) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue.toLocaleString() : '0';
}

function failureRate(failedCalls: number, totalCalls: number) {
  if (!totalCalls) return '0%';
  return `${Math.round((failedCalls / totalCalls) * 1000) / 10}%`;
}

function barWidth(value: number, maximum: number) {
  return `${Math.max(8, Math.min(100, (value / maximum) * 100))}%`;
}

function accountName(account: RiskControlApi.FailedAccountRank) {
  return (
    account.displayName?.trim() ||
    account.username?.trim() ||
    `#${account.userId}`
  );
}

function accountStatusText(status: number) {
  return status === 1
    ? $t('system.riskControl.failureRankings.accountEnabled')
    : $t('system.riskControl.failureRankings.accountDisabled');
}

function accountStatusClass(status: number) {
  return status === 1 ? 'is-enabled' : 'is-disabled';
}

function interfaceLabel(
  item: RiskControlApi.FailedAccountRank | RiskControlApi.FailedIPRank,
) {
  return (
    item.interfaceName?.trim() ||
    item.apiCode?.trim() ||
    (item.interfaceId ? `API #${item.interfaceId}` : '') ||
    $t('system.riskControl.failureRankings.unknownInterface')
  );
}
</script>

<template>
  <section class="risk-failure-rankings">
    <header class="risk-failure-rankings__head">
      <div class="risk-failure-rankings__title-wrap">
        <span class="risk-failure-rankings__icon">
          <IconifyIcon icon="lucide:triangle-alert" />
        </span>
        <div>
          <span class="risk-failure-rankings__eyebrow">FAILURE TRIAGE</span>
          <h3>{{ $t('system.riskControl.failureRankings.title') }}</h3>
          <p>{{ $t('system.riskControl.failureRankings.description') }}</p>
        </div>
      </div>
      <div class="risk-failure-rankings__total">
        <span>{{
          $t('system.riskControl.failureRankings.totalFailures')
        }}</span>
        <strong>{{ formatCount(props.failedRequests) }}</strong>
      </div>
    </header>

    <div class="risk-failure-rankings__grid">
      <article class="ranking-panel">
        <div class="ranking-panel__head">
          <div>
            <span class="ranking-panel__eyebrow">01 / NETWORK</span>
            <h4>{{ $t('system.riskControl.failureRankings.ipTitle') }}</h4>
            <p>{{ $t('system.riskControl.failureRankings.ipDescription') }}</p>
          </div>
          <IconifyIcon icon="lucide:network" />
        </div>

        <div v-if="visibleIPs.length" class="ranking-list">
          <article
            v-for="(item, index) in visibleIPs"
            :key="item.clientIp"
            class="ranking-row"
          >
            <span class="ranking-row__index">{{
              String(index + 1).padStart(2, '0')
            }}</span>
            <div class="ranking-row__main">
              <div class="ranking-row__label">
                <code>{{ item.clientIp }}</code>
                <span>{{
                  item.region ||
                  $t('system.riskControl.failureRankings.unknownRegion')
                }}</span>
              </div>
              <div class="ranking-row__bar" aria-hidden="true">
                <span
                  :style="{ width: barWidth(item.failedCalls, maxIPFailures) }"
                ></span>
              </div>
              <small>
                {{
                  $t('system.riskControl.failureRankings.failedTotal', [
                    formatCount(item.failedCalls),
                    formatCount(item.totalCalls),
                  ])
                }}
                ·
                {{
                  $t('system.riskControl.failureRankings.failureRate', [
                    failureRate(item.failedCalls, item.totalCalls),
                  ])
                }}
              </small>
              <div class="ranking-row__interface">
                <IconifyIcon icon="lucide:plug-zap" />
                <span>
                  {{ $t('system.riskControl.failureRankings.interfaceLabel') }}
                </span>
                <strong>{{ interfaceLabel(item) }}</strong>
                <code v-if="item.apiCode">{{ item.apiCode }}</code>
                <em>
                  {{
                    $t('system.riskControl.failureRankings.interfaceFailures', [
                      formatCount(item.interfaceFailedCalls),
                    ])
                  }}
                </em>
              </div>
            </div>
            <div class="ranking-row__meta">
              <strong>{{ formatCount(item.failedCalls) }}</strong>
              <span>{{
                $t('system.riskControl.failureRankings.riskHits', [
                  formatCount(item.riskHits),
                ])
              }}</span>
              <small>{{ item.lastSeen || '—' }}</small>
            </div>
          </article>
        </div>
        <div v-else class="ranking-empty">
          <IconifyIcon icon="lucide:shield-check" />
          <span>{{ $t('system.riskControl.failureRankings.empty') }}</span>
        </div>
      </article>

      <article class="ranking-panel">
        <div class="ranking-panel__head">
          <div>
            <span class="ranking-panel__eyebrow">02 / IDENTITY</span>
            <h4>{{ $t('system.riskControl.failureRankings.accountTitle') }}</h4>
            <p>
              {{ $t('system.riskControl.failureRankings.accountDescription') }}
            </p>
          </div>
          <IconifyIcon icon="lucide:user-round-search" />
        </div>

        <div v-if="visibleAccounts.length" class="ranking-list">
          <article
            v-for="(item, index) in visibleAccounts"
            :key="item.userId"
            class="ranking-row"
          >
            <span class="ranking-row__index">{{
              String(index + 1).padStart(2, '0')
            }}</span>
            <div class="ranking-row__main">
              <div class="ranking-row__label">
                <strong>{{ accountName(item) }}</strong>
                <button
                  v-if="props.canBan && item.status === 1"
                  class="ranking-row__ban"
                  type="button"
                  @click="emit('ban', item)"
                >
                  {{ $t('system.riskControl.failureRankings.banAccount') }}
                </button>
                <span>
                  {{ item.username || `ID ${item.userId}` }}
                  <i
                    class="account-status"
                    :class="accountStatusClass(item.status)"
                    >{{ accountStatusText(item.status) }}</i
                  >
                </span>
              </div>
              <div class="ranking-row__bar" aria-hidden="true">
                <span
                  :style="{
                    width: barWidth(item.failedCalls, maxAccountFailures),
                  }"
                ></span>
              </div>
              <small>
                {{
                  $t('system.riskControl.failureRankings.failedTotal', [
                    formatCount(item.failedCalls),
                    formatCount(item.totalCalls),
                  ])
                }}
                ·
                {{
                  $t('system.riskControl.failureRankings.ipCount', [
                    formatCount(item.uniqueIps),
                  ])
                }}
              </small>
              <div class="ranking-row__interface">
                <IconifyIcon icon="lucide:plug-zap" />
                <span>
                  {{ $t('system.riskControl.failureRankings.interfaceLabel') }}
                </span>
                <strong>{{ interfaceLabel(item) }}</strong>
                <code v-if="item.apiCode">{{ item.apiCode }}</code>
                <em>
                  {{
                    $t('system.riskControl.failureRankings.interfaceFailures', [
                      formatCount(item.interfaceFailedCalls),
                    ])
                  }}
                </em>
              </div>
            </div>
            <div class="ranking-row__meta">
              <strong>{{ formatCount(item.failedCalls) }}</strong>
              <span>{{
                $t('system.riskControl.failureRankings.riskHits', [
                  formatCount(item.riskHits),
                ])
              }}</span>
              <small>{{ item.lastSeen || '—' }}</small>
            </div>
          </article>
        </div>
        <div v-else class="ranking-empty">
          <IconifyIcon icon="lucide:users" />
          <span>{{ $t('system.riskControl.failureRankings.empty') }}</span>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.risk-failure-rankings {
  position: relative;
  overflow: hidden;
  padding: 20px;
  background:
    radial-gradient(circle at 84% 0%, rgb(244 63 94 / 11%), transparent 34%),
    linear-gradient(135deg, hsl(var(--card)), hsl(var(--background)));
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
}

.risk-failure-rankings__head {
  display: flex;
  gap: 18px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 18px;
}

.risk-failure-rankings__title-wrap {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  min-width: 0;
}

.risk-failure-rankings__icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  color: #fb7185;
  background: rgb(244 63 94 / 11%);
  border: 1px solid rgb(244 63 94 / 28%);
  border-radius: 9px;
  font-size: 20px;
}

.risk-failure-rankings__eyebrow,
.ranking-panel__eyebrow {
  display: block;
  color: #fb7185;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.16em;
}

.risk-failure-rankings h3,
.risk-failure-rankings h4,
.risk-failure-rankings p {
  margin: 0;
}

.risk-failure-rankings h3 {
  margin-top: 4px;
  font-size: 19px;
  font-weight: 850;
  line-height: 26px;
  color: hsl(var(--foreground));
}

.risk-failure-rankings__title-wrap p {
  margin-top: 4px;
  font-size: 13px;
  line-height: 20px;
  color: rgb(100 116 139);
}

.risk-failure-rankings__total {
  display: grid;
  flex: 0 0 auto;
  gap: 4px;
  min-width: 120px;
  padding: 10px 12px;
  text-align: right;
  background: rgb(244 63 94 / 7%);
  border: 1px solid rgb(244 63 94 / 22%);
  border-radius: 12px;
}

.risk-failure-rankings__total span {
  font-size: 11px;
  color: rgb(100 116 139);
}

.risk-failure-rankings__total strong {
  color: #e11d48;
  font-size: 23px;
  line-height: 1;
}

.risk-failure-rankings__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.ranking-panel {
  min-width: 0;
  padding: 16px;
  background: hsl(var(--background) / 72%);
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.ranking-panel__head {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
}

.ranking-panel__head > svg {
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  color: #fb7185;
}

.ranking-panel__head h4 {
  margin-top: 3px;
  color: hsl(var(--foreground));
  font-size: 15px;
  font-weight: 800;
  line-height: 21px;
}

.ranking-panel__head p {
  margin-top: 3px;
  color: rgb(100 116 139);
  font-size: 12px;
  line-height: 18px;
}

.ranking-list {
  display: grid;
  gap: 8px;
}

.ranking-row {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: start;
  min-width: 0;
  padding: 10px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 7px;
}

.ranking-row__index {
  padding-top: 1px;
  color: rgb(148 163 184);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
}

.ranking-row__main {
  min-width: 0;
}

.ranking-row__label {
  display: flex;
  gap: 8px;
  align-items: baseline;
  min-width: 0;
}

.ranking-row__label code,
.ranking-row__label strong {
  min-width: 0;
  overflow: hidden;
  color: hsl(var(--foreground));
  font-size: 12px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ranking-row__label code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.ranking-row__ban {
  flex: 0 0 auto;
  padding: 2px 6px;
  color: #b91c1c;
  font-size: 11px;
  background: rgb(239 68 68 / 10%);
  border: 1px solid rgb(239 68 68 / 24%);
  border-radius: 4px;
  cursor: pointer;
}

.ranking-row__ban:hover {
  background: rgb(239 68 68 / 18%);
}

.ranking-row__label > span {
  min-width: 0;
  overflow: hidden;
  color: rgb(100 116 139);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ranking-row__bar {
  height: 4px;
  margin-top: 8px;
  overflow: hidden;
  background: rgb(148 163 184 / 16%);
  border-radius: 999px;
}

.ranking-row__bar span {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #fb7185, #e11d48);
  border-radius: inherit;
}

.ranking-row__main small {
  display: block;
  margin-top: 5px;
  overflow: hidden;
  color: rgb(100 116 139);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ranking-row__interface {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) auto;
  gap: 4px 6px;
  align-items: center;
  min-width: 0;
  padding: 7px 8px;
  margin-top: 7px;
  color: rgb(100 116 139);
  background: hsl(var(--muted) / 34%);
  border-radius: 5px;
}

.ranking-row__interface > svg {
  width: 13px;
  height: 13px;
  color: hsl(var(--primary));
}

.ranking-row__interface > span,
.ranking-row__interface > em {
  font-size: 9px;
  font-style: normal;
  white-space: nowrap;
}

.ranking-row__interface > strong,
.ranking-row__interface > code {
  min-width: 0;
  overflow: hidden;
  color: hsl(var(--foreground));
  font-size: 10px;
  font-weight: 750;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ranking-row__interface > code {
  display: none;
}

.ranking-row__meta {
  display: grid;
  gap: 2px;
  min-width: 92px;
  text-align: right;
}

.ranking-row__meta strong {
  color: #e11d48;
  font-size: 14px;
  line-height: 18px;
}

.ranking-row__meta span,
.ranking-row__meta small {
  overflow: hidden;
  color: rgb(100 116 139);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-status {
  display: inline-flex;
  padding: 1px 4px;
  margin-left: 4px;
  font-size: 9px;
  font-style: normal;
  font-weight: 700;
  border-radius: 4px;
}

.account-status.is-enabled {
  color: #15803d;
  background: rgb(34 197 94 / 12%);
}

.account-status.is-disabled {
  color: #b91c1c;
  background: rgb(239 68 68 / 12%);
}

.ranking-empty {
  display: grid;
  min-height: 180px;
  place-content: center;
  gap: 8px;
  color: rgb(100 116 139);
  font-size: 12px;
  text-align: center;
}

.ranking-empty svg {
  width: 28px;
  height: 28px;
  margin: 0 auto;
  color: #22c55e;
}

html.dark .risk-failure-rankings__title-wrap p,
html.dark .risk-failure-rankings__total span,
html.dark .ranking-panel__head p,
html.dark .ranking-row__label > span,
html.dark .ranking-row__main small,
html.dark .ranking-row__interface,
html.dark .ranking-row__meta span,
html.dark .ranking-row__meta small,
html.dark .ranking-empty {
  color: rgb(148 163 184);
}

@media (max-width: 980px) {
  .risk-failure-rankings__grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 620px) {
  .risk-failure-rankings {
    padding: 14px;
  }

  .risk-failure-rankings__head {
    flex-direction: column;
  }

  .risk-failure-rankings__total {
    width: 100%;
    text-align: left;
  }

  .ranking-row {
    grid-template-columns: 22px minmax(0, 1fr);
  }

  .ranking-row__meta {
    grid-column: 2;
    display: flex;
    gap: 8px;
    min-width: 0;
    align-items: baseline;
    text-align: left;
  }
}
</style>
