<script setup lang="ts">
import type { EchartsUIType } from '@vben/plugins/echarts';

import type { RiskControlApi } from '#/api/risk-control';

import { computed, nextTick, shallowRef, watch } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon, RotateCw } from '@vben/icons';
import { i18n } from '@vben/locales';
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';
import { usePreferences } from '@vben/preferences';
import { useAccessStore, useUserStore } from '@vben/stores';

import { Alert, Button, Select, Spin } from 'ant-design-vue';

import { $t } from '#/locales';

import RiskAccountBanDialog from './components/RiskAccountBanDialog.vue';
import RiskEventFeed from './components/RiskEventFeed.vue';
import RiskFailureRankings from './components/RiskFailureRankings.vue';
import RiskMetricCard from './components/RiskMetricCard.vue';
import { useRiskAutoRefresh } from './composables/use-risk-auto-refresh';
import { useRiskControl } from './composables/use-risk-control';

const windowOptions = computed(() => [
  { label: $t('system.riskControl.windows.minute10'), value: 10 },
  { label: $t('system.riskControl.windows.minute30'), value: 30 },
  { label: $t('system.riskControl.windows.hour1'), value: 60 },
  { label: $t('system.riskControl.windows.hour24'), value: 1440 },
]);

const {
  events,
  lastUpdatedAt,
  loadOverview,
  loadError,
  loading,
  overview,
  setWindowMinutes,
  topEvents,
  windowMinutes,
} = useRiskControl(10);

const trendChartRef = shallowRef<EchartsUIType>();
const { renderEcharts } = useEcharts(trendChartRef);
const { isDark } = usePreferences();
const accessStore = useAccessStore();
const userStore = useUserStore();
const canBanAccounts = computed(
  () =>
    userStore.userRoles.includes('admin') ||
    accessStore.accessCodes.includes('risk-control:user:ban'),
);
const banDialogOpen = shallowRef(false);
const banAccount = shallowRef<RiskControlApi.FailedAccountRank>();

const lastUpdatedText = computed(() =>
  lastUpdatedAt.value
    ? lastUpdatedAt.value.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '-',
);

const riskLevelText = computed(() => {
  const score = overview.value?.riskScore ?? 0;
  if (score >= 80) {
    return $t('system.riskControl.levels.critical');
  }
  if (score >= 60) {
    return $t('system.riskControl.levels.high');
  }
  if (score >= 40) {
    return $t('system.riskControl.levels.medium');
  }
  return $t('system.riskControl.levels.stable');
});

const riskLevelClass = computed(() => {
  const score = overview.value?.riskScore ?? 0;
  if (score >= 80) {
    return 'is-critical';
  }
  if (score >= 60) {
    return 'is-high';
  }
  if (score >= 40) {
    return 'is-medium';
  }
  return 'is-low';
});

// 评分可视化：0-100 映射为进度条宽度（越界钳制，后端异常值不至于撑破）
const riskScorePercent = computed(() => {
  const score = Number(overview.value?.riskScore ?? 0);
  return `${Math.min(100, Math.max(0, score))}%`;
});

const metricCards = computed(() => [
  {
    accent: '#ef4444',
    icon: 'lucide:shield-alert',
    label: $t('system.riskControl.metrics.riskScore'),
    meta: riskLevelText.value,
    value: overview.value?.riskScore ?? 0,
  },
  {
    accent: '#f97316',
    icon: 'lucide:radar',
    label: $t('system.riskControl.metrics.riskyRequests'),
    meta: $t('system.riskControl.metrics.windowMinutes', [
      overview.value?.windowMinutes ?? windowMinutes.value,
    ]),
    value: formatCount(overview.value?.riskyRequests ?? 0),
  },
  {
    accent: '#2563eb',
    icon: 'lucide:network',
    label: $t('system.riskControl.metrics.proxyPoolEvents'),
    meta: $t('system.riskControl.metrics.proxyPoolMeta'),
    value: overview.value?.proxyPoolEvents ?? 0,
  },
  {
    accent: '#a855f7',
    icon: 'lucide:waypoints',
    label: $t('system.riskControl.metrics.distributedEvents'),
    meta: $t('system.riskControl.metrics.distributedMeta'),
    value: overview.value?.distributedEvents ?? 0,
  },
  {
    accent: '#dc2626',
    icon: 'lucide:key-round',
    label: $t('system.riskControl.metrics.invalidKeyAttempts'),
    meta: $t('system.riskControl.metrics.invalidKeyBlocked', [
      formatCount(overview.value?.invalidKeyBlocked ?? 0),
    ]),
    value: formatCount(overview.value?.invalidKeyAttempts ?? 0),
  },
  {
    accent: '#e11d48',
    icon: 'lucide:triangle-alert',
    label: $t('system.riskControl.metrics.failedRequests'),
    meta: $t('system.riskControl.metrics.failedRequestsMeta'),
    value: formatCount(overview.value?.failedRequests ?? 0),
  },
]);

const detectionRules = computed(() => {
  const policy = overview.value?.policy;
  return [
    {
      icon: 'lucide:scan-line',
      title: $t('system.riskControl.policy.singleIpTitle'),
      value: $t('system.riskControl.policy.singleIpValue', [
        policy?.burstWindowMinutes ?? 5,
        policy?.singleIpRequests ?? 8,
      ]),
    },
    {
      icon: 'lucide:network',
      title: $t('system.riskControl.policy.proxyPoolTitle'),
      value: $t('system.riskControl.policy.proxyPoolValue', [
        policy?.burstWindowMinutes ?? 5,
        policy?.proxyPoolIps ?? 5,
        policy?.proxyPoolRequests ?? 12,
      ]),
    },
    {
      icon: 'lucide:waypoints',
      title: $t('system.riskControl.policy.distributedTitle'),
      value: $t('system.riskControl.policy.distributedValue', [
        policy?.burstWindowMinutes ?? 5,
        policy?.distributedIps ?? 12,
        policy?.distributedRequests ?? 30,
      ]),
    },
  ];
});

function formatCount(value: number | string) {
  const numberValue = Number(value ?? 0);
  if (!Number.isFinite(numberValue)) {
    return '0';
  }
  return numberValue.toLocaleString();
}

function renderTrend() {
  const trend = overview.value?.trend ?? [];
  const riskEventsLabel = $t('system.riskControl.trend.riskEvents');
  const totalCallsLabel = $t('system.riskControl.trend.totalCalls');
  const chartTheme = isDark.value
    ? {
        axis: '#94a3b8',
        axisLine: 'rgb(148 163 184 / 28%)',
        splitLine: 'rgb(148 163 184 / 14%)',
        tooltipBackground: 'rgb(15 23 42 / 96%)',
        tooltipBorder: 'rgb(148 163 184 / 22%)',
        tooltipText: '#e5edf7',
      }
    : {
        axis: '#64748b',
        axisLine: '#dbe5f2',
        splitLine: 'rgb(148 163 184 / 18%)',
        tooltipBackground: 'rgb(255 255 255 / 96%)',
        tooltipBorder: '#d8e2f0',
        tooltipText: '#0f172a',
      };
  renderEcharts({
    color: ['#ef4444', '#38bdf8'],
    grid: {
      bottom: 24,
      left: 36,
      right: 20,
      top: 28,
    },
    legend: {
      data: [riskEventsLabel, totalCallsLabel],
      textStyle: { color: chartTheme.axis },
      top: 0,
    },
    tooltip: {
      backgroundColor: chartTheme.tooltipBackground,
      borderColor: chartTheme.tooltipBorder,
      textStyle: { color: chartTheme.tooltipText },
      trigger: 'axis',
    },
    xAxis: {
      axisLabel: { color: chartTheme.axis },
      axisLine: { lineStyle: { color: chartTheme.axisLine } },
      axisTick: { show: false },
      data: trend.map((item) => item.label),
      type: 'category',
    },
    yAxis: {
      axisLabel: { color: chartTheme.axis },
      splitLine: { lineStyle: { color: chartTheme.splitLine } },
      type: 'value',
    },
    series: [
      {
        areaStyle: { opacity: 0.16 },
        data: trend.map((item) => item.riskyEvents),
        name: riskEventsLabel,
        smooth: true,
        type: 'line',
      },
      {
        data: trend.map((item) => item.totalCalls),
        name: totalCallsLabel,
        smooth: true,
        type: 'line',
      },
    ],
  });
}

async function refresh() {
  await loadOverview();
}

const { refreshNow } = useRiskAutoRefresh(refresh, { intervalMs: 10_000 });

function onWindowChange(value: unknown) {
  const nextWindow = Number(value);
  if (!Number.isFinite(nextWindow)) {
    return;
  }
  setWindowMinutes(nextWindow);
  void refreshNow();
}

function openBanDialog(account: RiskControlApi.FailedAccountRank) {
  if (!canBanAccounts.value) return;
  banAccount.value = account;
  banDialogOpen.value = true;
}

watch([overview, isDark, () => i18n.global.locale.value], async () => {
  await nextTick();
  renderTrend();
});
</script>

<template>
  <Page>
    <div class="risk-dashboard">
      <section class="risk-hero" :class="riskLevelClass">
        <div class="risk-hero__main">
          <span class="risk-hero__eyebrow">
            {{ $t('system.riskControl.dashboard.eyebrow') }}
          </span>
          <h1>{{ $t('system.riskControl.dashboard.title') }}</h1>
          <p>{{ $t('system.riskControl.dashboard.description') }}</p>
          <div class="risk-hero__facts">
            <span>
              {{ $t('system.riskControl.dashboard.totalRequests') }}
              {{ formatCount(overview?.totalRequests ?? 0) }}
            </span>
            <span>
              {{ $t('system.riskControl.dashboard.uniqueIps') }}
              {{ formatCount(overview?.uniqueIps ?? 0) }}
            </span>
            <span>
              {{ $t('system.riskControl.dashboard.paramSignatures') }}
              {{ formatCount(overview?.uniqueParamSignatures ?? 0) }}
            </span>
          </div>
        </div>
        <div class="risk-hero__score">
          <small>{{ $t('system.riskControl.dashboard.realtimeRisk') }}</small>
          <strong>{{ overview?.riskScore ?? 0 }}</strong>
          <span class="risk-hero__level">{{ riskLevelText }}</span>
          <!-- 评分可视化：宽度 = riskScore%，颜色随等级（迁移自 console-preview 设计稿） -->
          <div
            aria-valuemax="100"
            :aria-valuemin="0"
            :aria-valuenow="overview?.riskScore ?? 0"
            class="risk-hero__meter"
            role="progressbar"
            :aria-label="$t('system.riskControl.dashboard.realtimeRisk')"
          >
            <i :style="{ width: riskScorePercent }"></i>
          </div>
        </div>
      </section>

      <div class="risk-toolbar">
        <span class="risk-toolbar__updated">
          {{ $t('riskControlRuntime.lastUpdated') }}
          {{ lastUpdatedText }}
        </span>
        <Select
          :value="windowMinutes"
          :options="windowOptions"
          class="risk-toolbar__select"
          @change="onWindowChange"
        />
        <Button :loading="loading" type="primary" @click="refreshNow">
          <template #icon>
            <RotateCw />
          </template>
          {{ $t('system.riskControl.refresh') }}
        </Button>
      </div>

      <Alert
        v-if="loadError"
        closable
        show-icon
        type="error"
        :description="loadError"
        :message="$t('riskControlRuntime.loadError')"
      >
        <template #action>
          <Button size="small" @click="refreshNow">
            <template #icon><RotateCw class="size-4" /></template>
            {{ $t('system.riskControl.refresh') }}
          </Button>
        </template>
      </Alert>

      <Spin :spinning="loading">
        <div class="risk-metrics">
          <RiskMetricCard
            v-for="card in metricCards"
            :key="card.label"
            v-bind="card"
          />
        </div>

        <section class="risk-policy">
          <div class="risk-panel__head">
            <div>
              <h3>{{ $t('system.riskControl.policy.title') }}</h3>
              <p>{{ $t('system.riskControl.policy.description') }}</p>
            </div>
          </div>
          <div class="risk-policy__grid">
            <div v-for="rule in detectionRules" :key="rule.title">
              <IconifyIcon :icon="rule.icon" />
              <strong>{{ rule.title }}</strong>
              <span>{{ rule.value }}</span>
            </div>
          </div>
        </section>

        <div class="risk-grid">
          <section class="risk-panel">
            <div class="risk-panel__head">
              <div>
                <h3>{{ $t('system.riskControl.trend.title') }}</h3>
                <p>{{ $t('system.riskControl.trend.description') }}</p>
              </div>
            </div>
            <EchartsUI ref="trendChartRef" class="risk-trend-chart" />
          </section>

          <section class="risk-panel">
            <div class="risk-panel__head">
              <div>
                <h3>{{ $t('system.riskControl.clues.title') }}</h3>
                <p>{{ $t('system.riskControl.clues.description') }}</p>
              </div>
            </div>
            <div class="risk-clues">
              <div>
                <span>{{ $t('system.riskControl.clues.topIp') }}</span>
                <strong>{{ overview?.topAttackIp || '-' }}</strong>
              </div>
              <div>
                <span>{{ $t('system.riskControl.clues.topParam') }}</span>
                <code>
                  {{
                    overview?.topAttackParam ||
                    $t('system.riskControl.clues.noRiskParam')
                  }}
                </code>
              </div>
              <div>
                <span>{{ $t('system.riskControl.clues.singleIpEvents') }}</span>
                <strong>{{ overview?.singleIpEvents ?? 0 }}</strong>
              </div>
              <div>
                <span>{{
                  $t('system.riskControl.clues.proxyPoolEvents')
                }}</span>
                <strong>{{ overview?.proxyPoolEvents ?? 0 }}</strong>
              </div>
              <div>
                <span>{{
                  $t('system.riskControl.clues.distributedEvents')
                }}</span>
                <strong>{{ overview?.distributedEvents ?? 0 }}</strong>
              </div>
            </div>
          </section>
        </div>

        <RiskFailureRankings
          :accounts="overview?.topFailedAccounts ?? []"
          :can-ban="canBanAccounts"
          :failed-requests="overview?.failedRequests ?? 0"
          :ips="overview?.topFailedIps ?? []"
          @ban="openBanDialog"
        />

        <RiskEventFeed :events="topEvents.length ? topEvents : events" />
      </Spin>
      <RiskAccountBanDialog
        v-model:open="banDialogOpen"
        :account="banAccount"
        @success="refreshNow"
      />
    </div>
  </Page>
</template>

<style scoped>
.risk-dashboard {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.risk-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 170px;
  gap: 18px;
  align-items: stretch;
  min-height: 220px;
  padding: 26px;
  overflow: hidden;
  color: hsl(var(--foreground));
  background:
    linear-gradient(135deg, hsl(var(--card)), hsl(var(--background))),
    hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.risk-hero.is-critical {
  border-color: rgb(239 68 68 / 52%);
}

.risk-hero.is-high {
  border-color: rgb(249 115 22 / 50%);
}

.risk-hero.is-medium {
  border-color: rgb(234 179 8 / 50%);
}

/* ---------- 等级标签与评分进度条（迁移自 console-preview 设计稿）----------
   等级从纯文本升级为按级配色的胶囊标签；进度条宽度即 riskScore，
   填充色与等级一致，颜色语义在整页内自洽。 */
.risk-hero__level {
  padding: 4px 14px;
  font-size: 12.5px;
  font-weight: 800;
  color: hsl(var(--foreground) / 70%);
  background: hsl(var(--muted) / 70%);
  border-radius: 999px;
}

.risk-hero.is-critical .risk-hero__level {
  color: #ef4444;
  background: rgb(239 68 68 / 14%);
}

.risk-hero.is-high .risk-hero__level {
  color: #f97316;
  background: rgb(249 115 22 / 14%);
}

.risk-hero.is-medium .risk-hero__level {
  color: #eab308;
  background: rgb(234 179 8 / 15%);
}

.risk-hero__meter {
  width: min(220px, 78%);
  height: 6px;
  margin-top: 12px;
  overflow: hidden;
  background: hsl(var(--muted));
  border-radius: 999px;
}

.risk-hero__meter i {
  display: block;
  height: 100%;
  background: hsl(var(--primary));
  border-radius: 999px;
  transition: width 0.5s ease;
}

.risk-hero.is-critical .risk-hero__meter i {
  background: #ef4444;
}

.risk-hero.is-high .risk-hero__meter i {
  background: #f97316;
}

.risk-hero.is-medium .risk-hero__meter i {
  background: #eab308;
}

@media (prefers-reduced-motion: reduce) {
  .risk-hero__meter i {
    transition: none;
  }
}

.risk-hero__eyebrow {
  display: inline-flex;
  align-items: center;
  height: 26px;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 800;
  color: hsl(var(--primary));
  text-transform: uppercase;
  background: hsl(var(--primary) / 8%);
  border-radius: 9px;
}

.risk-hero h1 {
  margin: 18px 0 0;
  font-size: 42px;
  font-weight: 900;
  line-height: 1.1;
}

.risk-hero p {
  max-width: 720px;
  margin: 12px 0 0;
  font-size: 15px;
  line-height: 24px;
  color: rgb(100 116 139);
}

.risk-hero__facts {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 22px;
}

.risk-hero__facts span {
  padding: 7px 10px;
  font-size: 13px;
  font-weight: 700;
  color: rgb(51 65 85);
  background: hsl(var(--muted) / 58%);
  border-radius: 9px;
}

.risk-hero__score {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 0;
  background:
    radial-gradient(circle at 50% 38%, rgb(239 68 68 / 16%), transparent 54%),
    hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.risk-hero__score small,
.risk-hero__score span {
  font-size: 13px;
  color: rgb(100 116 139);
}

.risk-hero__score strong {
  margin: 6px 0;
  font-size: 58px;
  font-weight: 900;
  line-height: 1;
  color: #ef4444;
}

.risk-toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: flex-end;
}

.risk-toolbar__updated {
  margin-right: auto;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.risk-toolbar__select {
  width: 140px;
}

.risk-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 14px;
  margin-bottom: 18px;
}

.risk-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(320px, 0.8fr);
  gap: 18px;
  margin-bottom: 18px;
}

.risk-policy {
  min-width: 0;
  padding: 18px;
  margin-bottom: 18px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.risk-policy__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.risk-policy__grid > div {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 4px 10px;
  align-items: center;
  min-width: 0;
  padding: 14px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.risk-policy__grid svg {
  grid-row: span 2;
  width: 20px;
  height: 20px;
  color: hsl(var(--primary));
}

.risk-policy__grid strong,
.risk-policy__grid span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.risk-policy__grid strong {
  color: hsl(var(--foreground));
}

.risk-policy__grid span {
  font-size: 12px;
  color: rgb(100 116 139);
}

.risk-panel {
  min-width: 0;
  padding: 18px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
}

/* 原先整页没有任何 hover 反馈，鼠标划过分不清哪块可交互。这里只提亮描边、
   不做位移——面板内含表格与事件流，位移会让阅读位置跳动。 */
.risk-panel:hover {
  border-color: hsl(var(--foreground) / 22%);
}


.risk-panel__head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
}

.risk-panel__head h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 800;
  line-height: 24px;
}

.risk-panel__head p {
  margin: 4px 0 0;
  font-size: 13px;
  color: rgb(100 116 139);
}

.risk-trend-chart {
  height: 320px;
}

.risk-clues {
  display: grid;
  gap: 12px;
}

.risk-clues div {
  min-width: 0;
  padding: 14px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.risk-clues span {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  color: rgb(100 116 139);
}

.risk-clues strong,
.risk-clues code {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 18px;
  font-weight: 800;
  line-height: 24px;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.risk-clues code {
  font-size: 13px;
  font-weight: 700;
}

html.dark .risk-hero p,
html.dark .risk-hero__score small,
html.dark .risk-hero__score span,
html.dark .risk-panel__head p,
html.dark .risk-clues span {
  color: rgb(148 163 184);
}

html.dark .risk-policy__grid span {
  color: rgb(148 163 184);
}

html.dark .risk-hero__facts span {
  color: rgb(203 213 225);
}

@media (max-width: 1100px) {
  .risk-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .risk-grid {
    grid-template-columns: 1fr;
  }

  .risk-policy__grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 680px) {
  .risk-hero {
    grid-template-columns: 1fr;
  }

  .risk-hero h1 {
    font-size: 34px;
  }

  .risk-metrics {
    grid-template-columns: 1fr;
  }

  .risk-toolbar {
    flex-wrap: wrap;
    justify-content: stretch;
  }

  .risk-toolbar__updated {
    width: 100%;
  }

  .risk-toolbar__select {
    flex: 1;
  }
}
</style>
