<script setup lang="ts">
import { computed } from 'vue';

import { usePublicSiteTheme } from '#/composables/use-public-site-theme';
import { $t } from '#/locales';

const { siteThemeVars } = usePublicSiteTheme();

const steps = computed(() => [
  {
    code: 'X-API-Key',
    desc: $t('page.public.home.v3.lifecycle.auth.desc'),
    icon: '🔑',
    key: 'auth',
    name: $t('page.public.home.v3.lifecycle.auth.name'),
  },
  {
    code: '',
    desc: $t('page.public.home.v3.lifecycle.qps.desc'),
    icon: '🛡',
    key: 'qps',
    name: $t('page.public.home.v3.lifecycle.qps.name'),
  },
  {
    code: '',
    desc: $t('page.public.home.v3.lifecycle.upstream.desc'),
    icon: '☁',
    key: 'upstream',
    name: $t('page.public.home.v3.lifecycle.upstream.name'),
  },
  {
    code: '',
    desc: $t('page.public.home.v3.lifecycle.response.desc'),
    icon: '⚡',
    key: 'response',
    name: $t('page.public.home.v3.lifecycle.response.name'),
  },
]);

function namePrefix(name: string, code: string) {
  if (!code) return name;
  const index = name.indexOf(code);
  return index > 0 ? name.slice(0, index).trimEnd() : '';
}
</script>

<template>
  <section class="section" :style="siteThemeVars" data-testid="home-lifecycle">
    <div class="sec-head reveal">
      <div>
        <span class="eyebrow">{{ $t('page.public.home.v3.lifecycle.eyebrow') }}</span>
        <h2>{{ $t('page.public.home.v3.lifecycle.title') }}</h2>
        <p>{{ $t('page.public.home.v3.lifecycle.desc') }}</p>
      </div>
    </div>
    <div class="lifecycle reveal">
      <div class="life-flow">
        <div v-for="step in steps" :key="step.key" class="life-step">
          <div class="life-icon">{{ step.icon }}</div>
          <h4>
            <template v-if="step.code && namePrefix(step.name, step.code)">
              {{ namePrefix(step.name, step.code) }} <code>{{ step.code }}</code>
            </template>
            <template v-else>{{ step.name }}</template>
          </h4>
          <p>{{ step.desc }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.section { padding: 70px 0 0; }
@media (max-width: 768px) { .section { padding: 52px 0 0; } }
@media (max-width: 420px) { .section { padding: 42px 0 0; } }
.sec-head {
  display: flex;
  gap: 16px;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  margin-bottom: 24px;
}
.sec-head .eyebrow {
  display: inline-block;
  margin-bottom: 9px;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--home-primary);
}
.sec-head h2 {
  font-size: clamp(21px, 3vw, 32px);
  font-weight: 800;
  letter-spacing: -0.3px;
  color: var(--home-heading);
}
.sec-head p {
  max-width: 60ch;
  margin-top: 8px;
  font-size: 14px;
  color: var(--home-muted);
}
.lifecycle {
  padding: 28px;
  background: var(--home-surface-strong);
  border: 1px solid var(--home-border);
  border-radius: 22px;
  box-shadow: var(--home-card-shadow);
}
@media (max-width: 640px) { .lifecycle { padding: 20px 18px; } }
.life-flow {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
}
.life-step { position: relative; min-width: 0; padding: 6px 20px; }
.life-step:not(:last-child)::after {
  position: absolute;
  top: 29px;
  right: -14px;
  width: 28px;
  height: 2px;
  content: '';
  background: linear-gradient(90deg, var(--home-primary), transparent);
}
@media (max-width: 920px) {
  .life-flow { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px 18px; }
  .life-step:nth-child(2)::after { display: none; }
}
@media (max-width: 480px) {
  .life-flow { grid-template-columns: 1fr; }
  .life-step { padding: 2px 0; }
  .life-step::after { display: none !important; }
  .life-step:not(:last-child) {
    margin-bottom: 16px;
    padding-bottom: 16px;
    border-bottom: 1px dashed var(--home-border);
  }
}
.life-icon {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  margin-bottom: 13px;
  font-size: 20px;
  background: var(--home-grad-soft);
  border: 1px solid rgb(var(--home-primary-rgb) / 30%);
  border-radius: 14px;
}
.life-step h4 {
  font-size: 14.5px;
  font-weight: 700;
  color: var(--home-heading);
  overflow-wrap: anywhere;
}
.life-step h4 code {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 12px;
  color: var(--home-primary);
}
.life-step p {
  margin-top: 6px;
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--home-muted);
}
</style>
