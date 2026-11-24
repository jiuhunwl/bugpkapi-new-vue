<script setup lang="ts">
import { computed } from 'vue';

import { IconifyIcon } from '@vben/icons';

const props = defineProps<{
  accent: string;
  icon: string;
  label: string;
  meta?: string;
  value: number | string;
}>();

const accentStyle = computed(() => ({
  '--risk-accent': props.accent,
}));
</script>

<template>
  <section class="risk-metric-card" :style="accentStyle">
    <div class="risk-metric-card__icon">
      <IconifyIcon :icon="icon" />
    </div>
    <div class="risk-metric-card__body">
      <span>{{ label }}</span>
      <strong>{{ value }}</strong>
      <small v-if="meta">{{ meta }}</small>
    </div>
  </section>
</template>

<style scoped>
.risk-metric-card {
  position: relative;
  display: flex;
  gap: 14px;
  align-items: center;
  min-width: 0;
  min-height: 116px;
  padding: 18px;
  overflow: hidden;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--risk-accent) 10%, hsl(var(--background))),
    hsl(var(--card))
  );
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
}

/* 指标卡原先没有任何悬浮反馈，鼠标扫过去毫无回应。这里补上与前台
   一致的「上移 2px + 描边提亮」，纯视觉增强，不改变任何交互语义。 */
.risk-metric-card:hover {
  border-color: color-mix(in srgb, var(--risk-accent) 45%, hsl(var(--border)));
  box-shadow: 0 10px 26px rgb(15 23 42 / 8%);
  transform: translateY(-2px);
}

@media (prefers-reduced-motion: reduce) {
  .risk-metric-card { transition: none; }
  .risk-metric-card:hover { transform: none; }
}


.risk-metric-card::before {
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  width: 4px;
  content: '';
  background: var(--risk-accent);
}

.risk-metric-card__icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  font-size: 23px;
  color: var(--risk-accent);
  background: color-mix(in srgb, var(--risk-accent) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--risk-accent) 24%, transparent);
  border-radius: 12px;
}

.risk-metric-card__body {
  min-width: 0;
}

.risk-metric-card__body span,
.risk-metric-card__body small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  line-height: 19px;
  color: rgb(100 116 139);
  white-space: nowrap;
}

.risk-metric-card__body strong {
  display: block;
  margin: 4px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 28px;
  font-weight: 800;
  line-height: 34px;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

html.dark .risk-metric-card__body span,
html.dark .risk-metric-card__body small {
  color: rgb(148 163 184);
}
</style>
