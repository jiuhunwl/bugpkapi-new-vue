<script setup lang="ts">
import { RouterLink, useRouter } from 'vue-router';

import PublicSiteShell from '#/components/public-site-shell.vue';
import { usePublicSeo } from '#/composables/use-public-seo';
import { $t } from '#/locales';

const router = useRouter();

usePublicSeo({
  title: $t('page.public.notFound.title'),
  description: $t('page.public.notFound.description'),
  canonicalPath: '/',
  noindex: true,
});

function goBack() {
  router.back();
}
</script>

<template>
  <PublicSiteShell active-key="home">
    <section class="ps-not-found" data-testid="public-not-found">
      <p class="ps-not-found__eyebrow">{{ $t('page.public.notFound.eyebrow') }}</p>
      <h1>{{ $t('page.public.notFound.title') }}</h1>
      <p class="ps-not-found__description">{{ $t('page.public.notFound.description') }}</p>
      <div class="ps-not-found__actions">
        <RouterLink class="ps-not-found__action ps-not-found__action--primary" to="/">
          {{ $t('page.public.notFound.actions.home') }}
        </RouterLink>
        <RouterLink class="ps-not-found__action" to="/apilist">
          {{ $t('page.public.notFound.actions.market') }}
        </RouterLink>
        <button class="ps-not-found__action" type="button" @click="goBack">
          {{ $t('page.public.notFound.actions.back') }}
        </button>
      </div>
    </section>
  </PublicSiteShell>
</template>

<style scoped>
.ps-not-found {
  display: grid;
  min-height: 58vh;
  place-content: center;
  gap: 16px;
  padding: 80px 0;
  text-align: center;
}

.ps-not-found__eyebrow {
  margin: 0;
  color: var(--ps-primary, var(--home-primary));
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.ps-not-found h1 {
  margin: 0;
  color: var(--ps-text, var(--home-text));
  font-size: clamp(34px, 6vw, 64px);
  line-height: 1.1;
}

.ps-not-found__description {
  max-width: 48ch;
  margin: 0 auto;
  color: var(--ps-muted, var(--home-muted));
  line-height: 1.7;
}

.ps-not-found__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  margin-top: 12px;
}

.ps-not-found__action {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  padding: 0 18px;
  color: var(--ps-text, var(--home-text));
  cursor: pointer;
  background: var(--ps-surface, var(--home-surface));
  border: 1px solid var(--ps-border, var(--home-border));
  border-radius: 8px;
  text-decoration: none;
}

.ps-not-found__action--primary {
  color: #fff;
  background: var(--ps-primary, var(--home-primary));
  border-color: transparent;
}
</style>
