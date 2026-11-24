<script setup lang="ts">
import { RouterLink } from 'vue-router';

import { usePublicSiteTheme } from '#/composables/use-public-site-theme';
import { $t } from '#/locales';

withDefaults(
  defineProps<{
    consoleNavigating?: boolean;
    signedIn?: boolean;
  }>(),
  { consoleNavigating: false, signedIn: false },
);

const emit = defineEmits<{ 'enter-console': [] }>();

const { siteThemeVars } = usePublicSiteTheme();

const DEFAULT_OPEN_SOURCE_URL =
  'https://github.com/search?q=BugPk-Api&type=repositories';
</script>

<template>
  <section class="section" :style="siteThemeVars" data-testid="home-cta">
    <div class="cta reveal">
      <h2>{{ $t('page.public.home.v3.cta.title') }}</h2>
      <p>{{ $t('page.public.home.v3.cta.sub') }}</p>
      <div class="btns">
        <button
          v-if="signedIn"
          class="btn btn-white btn-lg"
          :disabled="consoleNavigating"
          type="button"
          @click="emit('enter-console')"
        >
          {{ $t('page.public.actions.consoleFull') }}
        </button>
        <RouterLink v-else class="btn btn-white btn-lg" to="/auth/register">
          {{ $t('page.public.home.v3.cta.register') }}
        </RouterLink>
        <a
          class="btn btn-outline btn-lg"
          :href="DEFAULT_OPEN_SOURCE_URL"
          rel="noopener noreferrer"
          target="_blank"
        >
          {{ $t('page.public.home.v3.cta.github') }}
        </a>
      </div>
    </div>
  </section>
</template>

<style scoped>
.section { padding: 70px 0 0; }
@media (max-width: 768px) { .section { padding: 52px 0 0; } }
@media (max-width: 420px) { .section { padding: 42px 0 0; } }
.cta {
  position: relative;
  overflow: hidden;
  padding: clamp(34px, 5vw, 54px) clamp(22px, 4vw, 40px);
  text-align: center;
  background: var(--home-grad);
  border-radius: 22px;
  box-shadow: 0 24px 60px rgb(79 140 255 / 35%);
}
.cta::before {
  position: absolute;
  inset: 0;
  content: '';
  opacity: 0.5;
  background-image: radial-gradient(rgb(255 255 255 / 16%) 1px, transparent 1px);
  background-size: 22px 22px;
}
.cta h2 {
  position: relative;
  font-size: clamp(21px, 3.4vw, 36px);
  font-weight: 800;
  letter-spacing: -0.3px;
  color: #fff;
  text-wrap: balance;
}
.cta p {
  position: relative;
  margin-top: 10px;
  font-size: 14.5px;
  color: rgb(255 255 255 / 85%);
}
.cta .btns {
  position: relative;
  display: flex;
  gap: 13px;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 26px;
}
@media (max-width: 420px) { .cta .btns .btn { flex: 1 1 100%; } }
.btn {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 0 26px;
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
  text-decoration: none;
  cursor: pointer;
  border: 0;
  border-radius: 13px;
  transition: transform 0.2s cubic-bezier(0.22, 0.61, 0.36, 1), background 0.2s;
}
.btn:disabled { cursor: wait; opacity: 0.75; }
.btn-white {
  color: #1d4ed8;
  background: #fff;
  box-shadow: 0 10px 26px rgb(2 6 18 / 30%);
}
.btn-white:hover { transform: translateY(-2px); }
.btn-outline {
  color: #fff;
  background: rgb(255 255 255 / 12%);
  border: 1px solid rgb(255 255 255 / 45%);
}
.btn-outline:hover { background: rgb(255 255 255 / 22%); }
@media (prefers-reduced-motion: reduce) { .btn { transition: none; } }
</style>
