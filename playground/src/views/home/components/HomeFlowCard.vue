<script setup lang="ts">
import { computed } from 'vue';

import { usePublicSiteTheme } from '#/composables/use-public-site-theme';
import { $t } from '#/locales';

const props = withDefaults(
  defineProps<{
    callCount?: number;
    failed?: boolean;
    availability?: number | string;
    loading?: boolean;
  }>(),
  { availability: undefined, callCount: undefined, failed: false, loading: false },
);

const { siteThemeVars } = usePublicSiteTheme();

const flowLines = computed(() => [
  { icon: '🔑', name: $t('page.public.home.v3.flow.auth'), width: '18%' },
  { icon: '🛡', name: $t('page.public.home.v3.flow.qps'), width: '30%' },
  { icon: '☁', name: $t('page.public.home.v3.flow.upstream'), width: '86%' },
  { icon: '⚡', name: $t('page.public.home.v3.flow.cache'), width: '46%' },
]);
const resultLine = computed(() =>
  $t('page.public.home.v3.flow.result', [
    props.failed || props.loading ? '—' : formatCount(props.callCount),
    props.failed || props.loading ? '—' : formatAvailability(props.availability),
  ]),
);

function formatCount(value?: number) {
  if (value === undefined || !Number.isFinite(value)) return '—';
  if (value >= 10_000) return `${(value / 10_000).toFixed(1)}w`;
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(value);
}

function formatAvailability(value?: number | string) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(2)}%` : '—';
}
</script>

<template>
  <div class="flow-card" :style="siteThemeVars" aria-hidden="true" data-testid="home-flow-card">
    <div class="flow-head">
      <span class="dots"><i></i><i></i><i></i></span>
      <span>{{ $t('page.public.home.v3.flow.endpoint') }} — {{ $t('page.public.home.v3.flow.title') }}</span>
      <span class="live"><i></i>LIVE</span>
    </div>
    <div class="flow-body">
      <div v-for="(line, index) in flowLines" :key="line.name" class="flow-line" :style="{ '--delay': `${0.15 + index * 0.4}s`, '--bar-delay': `${0.3 + index * 0.4}s` }">
        <span class="flow-step">{{ line.icon }}</span>
        <span class="name">{{ line.name }}</span>
        <span class="bar"><i :style="{ '--w': line.width }"></i></span>
        <span class="ok">✓</span>
      </div>
      <div class="flow-result">
        <span class="code">200 OK</span>
        <span class="u">{{ $t('page.public.home.v3.flow.request') }}</span>
        <span class="free">{{ resultLine }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.flow-card {
  position: relative;
  min-width: 0;
  overflow: hidden;
  background: var(--home-surface-strong);
  border: 1px solid var(--home-border-strong);
  border-radius: 22px;
  box-shadow: var(--home-card-shadow), var(--home-glow);
}
.flow-head {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 13px 16px;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 12px;
  color: var(--home-text-faint);
  border-bottom: 1px solid var(--home-border);
}
.flow-head .dots { display: flex; gap: 6px; }
.flow-head .dots i {
  width: 10px;
  height: 10px;
  background: var(--home-border-strong);
  border-radius: 50%;
}
.flow-head .dots i:first-child { background: rgb(248 113 113 / 65%); }
.flow-head .dots i:nth-child(2) { background: rgb(251 191 36 / 65%); }
.flow-head .dots i:last-child { background: rgb(52 211 153 / 65%); }
.flow-head .live {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-left: auto;
  color: var(--home-success);
}
.flow-head .live i {
  width: 6px;
  height: 6px;
  background: var(--home-success);
  border-radius: 50%;
  animation: flow-pulse 1.6s infinite;
}
.flow-body {
  padding: 18px 16px 20px;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 12.8px;
}
@media (max-width: 420px) { .flow-body { padding: 14px 12px 16px; font-size: 11.8px; } }
.flow-line {
  display: flex;
  gap: 11px;
  align-items: center;
  min-width: 0;
  margin-bottom: 10px;
  padding: 11px 13px;
  background: var(--home-surface);
  border: 1px solid var(--home-border);
  border-radius: 12px;
  opacity: 0;
  transform: translateY(8px);
  animation: flow-in 0.5s cubic-bezier(0.22, 0.61, 0.36, 1) var(--delay) forwards;
}
@keyframes flow-in { to { opacity: 1; transform: none; } }
.flow-step {
  display: grid;
  flex: none;
  place-items: center;
  width: 26px;
  height: 26px;
  font-size: 12px;
  color: #fff;
  background: var(--home-grad);
  border-radius: 8px;
}
.flow-line .name {
  font-family: var(--font-sans, system-ui, sans-serif);
  font-size: 12.5px;
  font-weight: 600;
  white-space: nowrap;
  color: var(--home-muted);
}
.flow-line .bar {
  flex: 1;
  min-width: 24px;
  height: 6px;
  overflow: hidden;
  background: rgb(148 163 184 / 14%);
  border-radius: 4px;
}
.flow-line .bar i {
  display: block;
  width: 0;
  height: 100%;
  background: var(--home-grad);
  border-radius: 4px;
  animation: bar-grow 1.4s cubic-bezier(0.22, 0.61, 0.36, 1) var(--bar-delay) forwards;
}
@keyframes bar-grow { to { width: var(--w); } }
.flow-line .ms { flex: none; font-size: 11.5px; color: var(--home-text-faint); }
.flow-line .ok { flex: none; font-weight: 700; color: var(--home-success); }
.flow-result {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 14px;
  padding: 13px 14px;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 12.5px;
  background: rgb(52 211 153 / 8%);
  border: 1px solid rgb(52 211 153 / 30%);
  border-radius: 12px;
  opacity: 0;
  animation: flow-in 0.5s cubic-bezier(0.22, 0.61, 0.36, 1) 1.8s forwards;
}
.flow-result .code { font-weight: 800; color: var(--home-success); }
.flow-result .u {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  color: var(--home-text-faint);
  text-overflow: ellipsis;
}
.flow-result .free {
  flex: none;
  margin-left: auto;
  padding: 3px 10px;
  font-family: var(--font-sans, system-ui, sans-serif);
  font-size: 11px;
  font-weight: 700;
  color: var(--home-success);
  background: rgb(52 211 153 / 12%);
  border: 1px solid rgb(52 211 153 / 35%);
  border-radius: 999px;
}
@media (max-width: 520px) {
  .flow-result .u { order: 3; flex-basis: 100%; }
}
@media (prefers-reduced-motion: reduce) {
  .flow-line,
  .flow-line .bar i,
  .flow-result {
    animation-duration: 0.01s;
    animation-delay: 0s;
  }
  .flow-line .bar i { width: var(--w); }
  .flow-head .live i { animation: none; }
}
@keyframes flow-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
</style>
