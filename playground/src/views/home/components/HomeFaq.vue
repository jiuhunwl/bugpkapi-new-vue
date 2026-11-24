<script setup lang="ts">
import { computed, shallowRef } from 'vue';

import { usePublicSiteTheme } from '#/composables/use-public-site-theme';
import { $t } from '#/locales';

const { siteThemeVars } = usePublicSiteTheme();

const QQ_CONTACT_URL =
  'https://wpa.qq.com/msgrd?v=3&uin=10000000&site=qq&menu=yes';

type FaqCategory = 'all' | 'basic' | 'trouble' | 'usage';

const categories: Array<{ key: FaqCategory; label: string }> = [
  { key: 'all', label: $t('page.public.home.v3.faq.cat.all') },
  { key: 'basic', label: $t('page.public.home.v3.faq.cat.basic') },
  { key: 'usage', label: $t('page.public.home.v3.faq.cat.usage') },
  { key: 'trouble', label: $t('page.public.home.v3.faq.cat.trouble') },
];

const faqItems = computed(() =>
  [0, 1, 2, 3, 4, 5, 6].map((index) => ({
    answer: $t(`page.public.home.v3.faq.items.${index}.a`),
    category: $t(`page.public.home.v3.faq.items.${index}.cat`) as FaqCategory,
    id: index,
    question: $t(`page.public.home.v3.faq.items.${index}.q`),
  })),
);

const activeCategory = shallowRef<FaqCategory>('all');

const visibleItems = computed(() =>
  activeCategory.value === 'all'
    ? faqItems.value
    : faqItems.value.filter((item) => item.category === activeCategory.value),
);
</script>

<template>
  <section id="faq" class="section" :style="siteThemeVars" data-testid="home-faq">
    <div class="faq-layout reveal">
      <aside class="faq-side">
        <span class="eyebrow">{{ $t('page.public.home.v3.faq.eyebrow') }}</span>
        <h2>{{ $t('page.public.home.faq.title') }}</h2>
        <p class="faq-lead">{{ $t('page.public.home.v3.faq.lead') }}</p>
        <div class="faq-contact">
          <div class="fc-title">{{ $t('page.public.home.v3.faq.sideTitle') }}</div>
          <p>{{ $t('page.public.home.v3.faq.sideDesc') }}</p>
          <a
            class="btn btn-ghost"
            :href="QQ_CONTACT_URL"
            rel="noopener noreferrer"
            target="_blank"
          >
            {{ $t('page.public.home.v3.faq.sideCta') }}
          </a>
        </div>
      </aside>

      <div class="faq-main">
        <div class="faq-tabs" role="tablist" :aria-label="$t('page.public.home.faq.title')">
          <button
            v-for="cat in categories"
            :key="cat.key"
            :class="{ active: activeCategory === cat.key }"
            role="tab"
            :aria-selected="activeCategory === cat.key"
            type="button"
            @click="activeCategory = cat.key"
          >
            {{ cat.label }}
          </button>
        </div>
        <div class="faq-list">
          <details
            v-for="(item, index) in visibleItems"
            :key="item.id"
            class="faq-item"
            :data-fcat="item.category"
            :open="index === 0 && activeCategory === 'all'"
          >
            <summary>
              <span class="qno">{{ String(index + 1).padStart(2, '0') }}</span>
              <span class="qt">{{ item.question }}</span>
              <span class="chev" aria-hidden="true">▾</span>
            </summary>
            <div class="ans">{{ item.answer }}</div>
          </details>
          <div v-if="!visibleItems.length" class="faq-empty">
            {{ $t('page.public.home.v3.faq.empty') }}
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.section { padding: 70px 0 0; }
@media (max-width: 768px) { .section { padding: 52px 0 0; } }
@media (max-width: 420px) { .section { padding: 42px 0 0; } }
.faq-layout {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  gap: clamp(28px, 4vw, 56px);
  align-items: start;
}
@media (max-width: 920px) { .faq-layout { grid-template-columns: 1fr; gap: 26px; } }
.faq-side { position: sticky; top: 92px; }
@media (max-width: 920px) { .faq-side { position: static; } }
.faq-side .eyebrow {
  display: inline-block;
  margin-bottom: 9px;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--home-primary);
}
.faq-side h2 {
  font-size: clamp(24px, 3vw, 34px);
  font-weight: 800;
  letter-spacing: -0.3px;
  color: var(--home-heading);
}
.faq-side .faq-lead {
  max-width: 36ch;
  margin-top: 12px;
  font-size: 14px;
  line-height: 1.8;
  color: var(--home-muted);
}
.faq-contact {
  margin-top: 22px;
  padding: 18px 20px;
  background: var(--home-grad-soft);
  border: 1px solid rgb(var(--home-primary-rgb) / 30%);
  border-radius: 16px;
}
.faq-contact .fc-title { font-size: 14px; font-weight: 800; color: var(--home-heading); }
.faq-contact p { margin-top: 4px; font-size: 12.5px; color: var(--home-muted); }
.faq-contact .btn {
  width: 100%;
  min-height: 44px;
  margin-top: 14px;
  font-size: 13px;
}
.faq-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.faq-tabs button {
  min-height: 38px;
  padding: 0 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--home-muted);
  cursor: pointer;
  background: var(--home-surface);
  border: 1px solid var(--home-border);
  border-radius: 999px;
  transition: all 0.2s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.faq-tabs button:hover { color: var(--home-text); border-color: var(--home-border-strong); }
.faq-tabs button.active {
  color: var(--home-primary);
  background: rgb(var(--home-primary-rgb) / 10%);
  border-color: rgb(var(--home-primary-rgb) / 45%);
  box-shadow: inset 0 0 0 1px rgb(var(--home-primary-rgb) / 20%);
}
.faq-item {
  margin-bottom: 10px;
  padding: 0 20px;
  background: var(--home-surface-strong);
  border: 1px solid var(--home-border);
  border-radius: 14px;
  transition: border-color 0.25s cubic-bezier(0.22, 0.61, 0.36, 1), background 0.25s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.faq-item[open] {
  background:
    linear-gradient(180deg, rgb(var(--home-primary-rgb) / 5%), transparent 60%),
    var(--home-surface-strong);
  border-color: rgb(var(--home-primary-rgb) / 45%);
}
.faq-item summary {
  display: flex;
  gap: 15px;
  align-items: center;
  min-height: 44px;
  padding: 17px 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--home-heading);
  cursor: pointer;
  list-style: none;
}
.faq-item summary::-webkit-details-marker { display: none; }
.faq-item .qno {
  display: grid;
  flex: none;
  place-items: center;
  width: 34px;
  height: 26px;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 11.5px;
  font-weight: 800;
  color: var(--home-primary);
  background: rgb(var(--home-primary-rgb) / 10%);
  border: 1px solid rgb(var(--home-primary-rgb) / 28%);
  border-radius: 8px;
}
.faq-item .qt { flex: 1; min-width: 0; }
.faq-item .chev {
  display: grid;
  flex: none;
  place-items: center;
  width: 28px;
  height: 28px;
  font-size: 11px;
  color: var(--home-text-faint);
  background: var(--home-surface);
  border: 1px solid var(--home-border);
  border-radius: 50%;
  transition: transform 0.25s cubic-bezier(0.22, 0.61, 0.36, 1), color 0.2s;
}
.faq-item[open] .chev { color: var(--home-primary); transform: rotate(180deg); }
.faq-item .ans {
  padding: 0 44px 18px 49px;
  font-size: 13.5px;
  line-height: 1.85;
  color: var(--home-muted);
}
@media (max-width: 640px) { .faq-item .ans { padding-left: 20px; } }
.faq-empty {
  padding: 30px;
  font-size: 13px;
  text-align: center;
  color: var(--home-text-faint);
  border: 1px dashed var(--home-border-strong);
  border-radius: 14px;
}
.btn {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
  padding: 0 18px;
  font-size: 14px;
  font-weight: 600;
  color: var(--home-text);
  text-decoration: none;
  cursor: pointer;
  background: var(--home-surface);
  border: 1px solid var(--home-border);
  border-radius: 11px;
  transition: all 0.2s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.btn:hover { transform: translateY(-1px); border-color: var(--home-border-strong); }
@media (prefers-reduced-motion: reduce) { .faq-item, .faq-tabs button, .btn, .chev { transition: none; } }
</style>
