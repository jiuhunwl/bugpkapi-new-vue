<script lang="ts" setup>
import type { AgreementApi } from '#/api/system/agreement';
import type { LegalContactItem, LegalDocumentType } from './types';

import type { SiteConfigApi } from '#/api/system/site';

import { computed, onMounted, ref, watch } from 'vue';

import { getPublicAgreement } from '#/api/system/agreement';
import { getPublicSiteConfig } from '#/api/system/site';
import PublicSiteFooter from '#/components/public-site-footer.vue';
import PublicSiteHeader from '#/components/public-site-header.vue';
import { usePublicSiteTheme } from '#/composables/use-public-site-theme';
import { $t, useI18n } from '#/locales';
import { DEFAULT_SITE_NAME, useSiteBrand } from '#/site-brand';

import { parseAgreementTemplateHtml } from './agreement-template';
import LegalAgreementTemplate from './components/LegalAgreementTemplate.vue';
import LegalDocumentArticle from './components/LegalDocumentArticle.vue';
import LegalDocumentHero from './components/LegalDocumentHero.vue';
import LegalInstancePanel from './components/LegalInstancePanel.vue';
import LegalToc from './components/LegalToc.vue';
import { useLegalDocument } from './use-legal-document';

const props = withDefaults(
  defineProps<{
    documentType?: LegalDocumentType;
  }>(),
  {
    documentType: 'privacy',
  },
);

const { siteThemeVars } = usePublicSiteTheme();
const siteBrand = useSiteBrand();
const siteConfig = ref<Partial<SiteConfigApi.Config>>({});

const siteName = computed(
  () =>
    String(
      siteConfig.value.siteName || siteBrand.siteName || DEFAULT_SITE_NAME,
    ).trim() || DEFAULT_SITE_NAME,
);
const siteUrl = computed(() => {
  const configured = String(siteConfig.value.siteUrl || '').trim();
  if (configured) return configured;
  return typeof window === 'undefined' ? '' : window.location.origin;
});
const siteUrlHref = computed(() =>
  /^https?:\/\//i.test(siteUrl.value) ? siteUrl.value : '',
);
const copyrightText = computed(
  () =>
    String(siteConfig.value.copyright || siteBrand.copyright || '').trim() ||
    $t('page.public.footer.defaultCopyright', [siteName.value]),
);
const operatorDescription = computed(() =>
  $t('legal.common.operatorValue', [siteName.value]),
);
const repositoryUrl = computed(() =>
  String(siteConfig.value.githubUrl || siteBrand.githubUrl || '').trim(),
);
const repositoryReference = computed(
  () => repositoryUrl.value || $t('legal.common.repositoryNotConfigured'),
);

const contactItems = computed<LegalContactItem[]>(() =>
  [
    {
      href: siteConfig.value.contactEmail
        ? `mailto:${String(siteConfig.value.contactEmail).trim()}`
        : '',
      icon: 'lucide:mail',
      label: $t('page.public.footer.contact.email'),
      value: String(siteConfig.value.contactEmail || '').trim(),
    },
    {
      href: siteConfig.value.contactPhone
        ? `tel:${String(siteConfig.value.contactPhone).trim()}`
        : '',
      icon: 'lucide:phone',
      label: $t('page.public.footer.contact.phone'),
      value: String(siteConfig.value.contactPhone || '').trim(),
    },
    {
      icon: 'lucide:message-circle',
      label: 'QQ',
      value: String(siteConfig.value.contactQq || '').trim(),
    },
    {
      icon: 'lucide:message-square',
      label: $t('page.public.footer.contact.wechat'),
      value: String(siteConfig.value.contactWechat || '').trim(),
    },
    {
      icon: 'lucide:map-pin',
      label: $t('page.public.footer.contact.address'),
      value: String(siteConfig.value.contactAddress || '').trim(),
    },
  ].filter((item) => item.value),
);

const footerSiteConfig = computed(() => ({
  ...siteConfig.value,
  copyright: copyrightText.value,
  description: siteConfig.value.description || siteBrand.description || '',
  githubUrl: repositoryUrl.value,
  logoUrl: siteConfig.value.logoUrl || siteBrand.logoUrl || '',
  siteName: siteName.value,
  slogan: siteConfig.value.slogan || siteBrand.slogan || '',
}));

const { currentDocument } = useLegalDocument(
  () => props.documentType,
  siteName,
  repositoryReference,
);

const { locale } = useI18n();
const agreementTemplate = ref<AgreementApi.PublicDocument | null>(null);

const parsedAgreementTemplate = computed(() =>
  agreementTemplate.value?.configured
    ? parseAgreementTemplateHtml(agreementTemplate.value.contentHtml ?? '')
    : null,
);
const usingAgreementTemplate = computed(() =>
  Boolean(
    agreementTemplate.value?.configured && parsedAgreementTemplate.value?.html,
  ),
);
const displayTitle = computed(() =>
  usingAgreementTemplate.value
    ? agreementTemplate.value?.title || currentDocument.value.title
    : currentDocument.value.title,
);
const displaySummary = computed(() =>
  usingAgreementTemplate.value
    ? agreementTemplate.value?.summary || currentDocument.value.summary
    : currentDocument.value.summary,
);
const tocSections = computed(() =>
  usingAgreementTemplate.value
    ? (parsedAgreementTemplate.value?.sections ?? [])
    : currentDocument.value.sections,
);
const templateVersion = computed(() =>
  usingAgreementTemplate.value ? agreementTemplate.value?.version : undefined,
);
const templateEffectiveDate = computed(() =>
  usingAgreementTemplate.value
    ? agreementTemplate.value?.effectiveDate || undefined
    : undefined,
);
const templateUpdatedDate = computed(() => {
  if (!usingAgreementTemplate.value) return undefined;
  return agreementTemplate.value?.updateTime?.slice(0, 10) || undefined;
});

async function loadAgreementTemplate() {
  try {
    agreementTemplate.value = await getPublicAgreement(
      props.documentType,
      locale.value,
    );
  } catch {
    agreementTemplate.value = null;
  }
}

watch([() => props.documentType, locale], () => {
  void loadAgreementTemplate();
});

onMounted(async () => {
  try {
    siteConfig.value = await getPublicSiteConfig();
  } catch {
    siteConfig.value = {};
  }
  await loadAgreementTemplate();
});
</script>

<template>
  <div class="legal-page" :style="siteThemeVars">
    <PublicSiteHeader active-key="legal" :repository-url="repositoryUrl" />

    <main>
      <LegalDocumentHero
        :document-type="props.documentType"
        :effective-date="templateEffectiveDate"
        :eyebrow="currentDocument.eyebrow"
        :summary="displaySummary"
        :title="displayTitle"
        :updated-date="templateUpdatedDate"
        :version="templateVersion"
      />

      <div
        class="legal-shell"
        :class="{ 'is-single-column': tocSections.length === 0 }"
      >
        <LegalToc v-if="tocSections.length > 0" :sections="tocSections" />

        <article class="legal-article">
          <LegalInstancePanel
            :author-url="String(siteConfig.authorUrl || '').trim()"
            :contact-items="contactItems"
            :copyright-text="copyrightText"
            :github-url="repositoryUrl"
            :license-type="String(siteConfig.licenseType || '').trim()"
            :operator-description="operatorDescription"
            :site-name="siteName"
            :site-url="siteUrl"
            :site-url-href="siteUrlHref"
          />
          <LegalAgreementTemplate
            v-if="usingAgreementTemplate"
            :html="parsedAgreementTemplate?.html || ''"
          />
          <LegalDocumentArticle
            v-else
            :notice="currentDocument.notice"
            :sections="currentDocument.sections"
          />
        </article>
      </div>
    </main>

    <PublicSiteFooter :site-config="footerSiteConfig" />
  </div>
</template>

<style>
/* ============== Page shell ============== */
.legal-page {
  position: relative;
  min-height: 100vh;
  overflow-x: clip;
  color: var(--home-text);
  background:
    radial-gradient(
      ellipse 62% 36% at 50% 0%,
      rgb(var(--home-primary-rgb) / 10%),
      transparent 70%
    ),
    linear-gradient(var(--home-grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--home-grid-line) 1px, transparent 1px),
    linear-gradient(
      180deg,
      var(--home-background) 0%,
      var(--home-background-mid) 100%
    );
  background-size:
    auto,
    96px 96px,
    96px 96px,
    auto;
}

.legal-page main {
  min-height: 70vh;
  padding-bottom: 84px;
}

/* ============== Hero ============== */
.legal-hero {
  position: relative;
  width: min(1240px, calc(100% - 80px));
  padding: 66px 0 44px;
  margin: 0 auto;
  overflow: hidden;
}

.legal-hero::after {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 1px;
  content: '';
  background: linear-gradient(90deg, transparent, var(--home-border-strong), transparent);
}

.legal-hero-watermark {
  position: absolute;
  top: 10px;
  right: 0;
  font-family: ui-serif, 'Noto Serif SC', 'Songti SC', Georgia, serif;
  font-size: clamp(72px, 13vw, 170px);
  font-weight: 900;
  line-height: 1;
  letter-spacing: -0.06em;
  color: var(--home-heading);
  pointer-events: none;
  user-select: none;
  opacity: 0.04;
}

.legal-hero-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 56px;
  align-items: end;
}

.legal-eyebrow {
  display: inline-flex;
  gap: 9px;
  align-items: center;
  padding: 7px 14px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.18em;
  color: var(--home-primary);
  background: var(--home-grad-soft);
  border: 1px solid rgb(var(--home-primary-rgb) / 18%);
  border-radius: 999px;
}

.legal-eyebrow-dot {
  width: 6px;
  height: 6px;
  background: var(--home-primary);
  border-radius: 50%;
  box-shadow: 0 0 0 4px rgb(var(--home-primary-rgb) / 12%);
}

.legal-heading h1 {
  margin: 16px 0 0;
  font-family: ui-serif, 'Noto Serif SC', 'Songti SC', Georgia, serif;
  font-size: clamp(38px, 4.6vw, 62px);
  font-weight: 900;
  line-height: 1.08;
  letter-spacing: -0.04em;
  color: var(--home-heading);
  text-wrap: balance;
}

.legal-heading > p {
  max-width: 34em;
  margin: 18px 0 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.9;
  color: var(--home-subtle);
}

.legal-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 24px;
}

.legal-meta span {
  display: inline-flex;
  gap: 7px;
  align-items: center;
  padding: 8px 13px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  font-weight: 750;
  line-height: 1.45;
  color: var(--home-muted);
  background: var(--home-surface-strong);
  border: 1px solid var(--home-border);
  border-radius: 999px;
  box-shadow: 0 6px 18px var(--home-shadow-soft);
}

.legal-meta svg {
  flex: none;
  font-size: 14px;
  color: var(--home-primary);
}

/* ============== Hero side: seal + document switcher ============== */
.legal-hero-side {
  display: grid;
  gap: 18px;
  justify-items: end;
}

.legal-stamp {
  position: relative;
  display: grid;
  place-content: center;
  width: 118px;
  height: 118px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: var(--home-primary);
  background: var(--home-surface);
  border: 1px solid rgb(var(--home-primary-rgb) / 28%);
  border-radius: 50%;
  box-shadow:
    inset 0 0 0 6px var(--home-surface-strong),
    inset 0 0 0 7px rgb(var(--home-primary-rgb) / 14%),
    0 16px 36px var(--home-shadow-soft);
  transform: rotate(-8deg);
}

.legal-stamp span {
  display: block;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.28em;
  text-align: center;
}

.legal-stamp strong {
  display: block;
  margin-top: 4px;
  font-size: 26px;
  font-weight: 900;
  letter-spacing: 0.02em;
  text-align: center;
  color: var(--home-primary);
}

.legal-stamp-dot {
  position: absolute;
  right: 16px;
  bottom: 16px;
  width: 8px;
  height: 8px;
  background: var(--home-primary);
  border-radius: 50%;
  box-shadow: 0 0 0 5px rgb(var(--home-primary-rgb) / 12%);
}

.document-switcher {
  display: grid;
  gap: 6px;
  width: 288px;
  padding: 8px;
  background: var(--home-surface-strong);
  border: 1px solid var(--home-border);
  border-radius: 18px;
  box-shadow: 0 18px 44px var(--home-shadow-soft);
  backdrop-filter: blur(16px);
}

.document-switcher a {
  display: flex;
  gap: 11px;
  align-items: center;
  min-width: 0;
  min-height: 50px;
  padding: 0 14px;
  font-size: 13px;
  font-weight: 800;
  color: var(--home-muted);
  text-decoration: none;
  border-radius: 12px;
  transition:
    color 0.18s ease,
    background 0.18s ease,
    box-shadow 0.18s ease;
}

.document-switcher a:hover {
  color: var(--home-heading);
  background: var(--home-surface-soft);
}

.document-switcher a.active {
  color: var(--home-primary);
  background: var(--home-grad-soft);
  box-shadow: inset 0 0 0 1px rgb(var(--home-primary-rgb) / 22%);
}

.switcher-icon {
  display: grid;
  flex: none;
  place-items: center;
  width: 30px;
  height: 30px;
  font-size: 16px;
  color: var(--home-muted);
  background: var(--home-surface);
  border: 1px solid var(--home-border);
  border-radius: 9px;
  transition:
    color 0.18s ease,
    background 0.18s ease,
    border-color 0.18s ease;
}

.document-switcher a.active .switcher-icon {
  color: #fff;
  background: var(--home-grad);
  border-color: transparent;
}

.switcher-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.switcher-arrow {
  flex: none;
  margin-left: auto;
  font-size: 14px;
  opacity: 0.35;
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.document-switcher a:hover .switcher-arrow {
  opacity: 0.65;
  transform: translateX(2px);
}

/* ============== Content layout ============== */
.legal-shell {
  display: grid;
  grid-template-columns: 272px minmax(0, 1fr);
  gap: 26px;
  align-items: start;
  width: min(1240px, calc(100% - 80px));
  margin: 38px auto 0;
}

.legal-shell.is-single-column {
  grid-template-columns: minmax(0, 1fr);
  max-width: 1000px;
}

/* ============== Table of contents ============== */
.legal-toc {
  position: sticky;
  top: 88px;
  max-height: calc(100vh - 116px);
  padding: 12px;
  overflow: auto;
  background: var(--home-surface-strong);
  border: 1px solid var(--home-border);
  border-radius: 18px;
  box-shadow: 0 18px 44px var(--home-shadow-soft);
  backdrop-filter: blur(16px);
  scrollbar-color: rgb(var(--home-primary-rgb) / 30%) transparent;
  scrollbar-width: thin;
}

.toc-head {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px 12px;
  margin-bottom: 6px;
  border-bottom: 1px solid var(--home-border);
}

.toc-title {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 12.5px;
  font-weight: 900;
  color: var(--home-heading);
}

.toc-title svg {
  font-size: 15px;
  color: var(--home-primary);
}

.toc-count {
  display: grid;
  place-items: center;
  min-width: 28px;
  height: 22px;
  padding: 0 7px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 10.5px;
  font-weight: 800;
  color: var(--home-primary);
  background: var(--home-primary-soft);
  border-radius: 7px;
}

.legal-toc nav {
  display: grid;
  gap: 2px;
}

.legal-toc a {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  gap: 7px;
  align-items: center;
  padding: 9px 10px;
  font-size: 12px;
  font-weight: 650;
  line-height: 1.5;
  color: var(--home-subtle);
  text-decoration: none;
  border-radius: 10px;
  transition:
    color 0.16s ease,
    background 0.16s ease;
}

.legal-toc a:hover {
  color: var(--home-heading);
  background: var(--home-surface-soft);
}

.legal-toc a.is-active {
  font-weight: 800;
  color: var(--home-primary);
  background: var(--home-grad-soft);
}

.toc-index {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.05em;
  color: var(--home-text-faint);
  transition: color 0.16s ease;
}

.legal-toc a.is-active .toc-index {
  color: var(--home-primary);
}

.toc-label {
  min-width: 0;
}

/* ============== Article sheet ============== */
.legal-article {
  position: relative;
  min-width: 0;
  padding: 38px 46px 56px;
  overflow: hidden;
  background: var(--home-surface-strong);
  border: 1px solid var(--home-border);
  border-radius: 22px;
  box-shadow: 0 28px 68px var(--home-shadow);
  backdrop-filter: blur(18px);
}

.legal-article::before {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: 3px;
  content: '';
  background: var(--home-grad);
}

/* ============== Instance panel ============== */
.instance-panel {
  padding-bottom: 32px;
  margin-bottom: 6px;
  border-bottom: 1px dashed var(--home-border);
}

.panel-heading {
  display: flex;
  gap: 14px;
  align-items: center;
  margin-bottom: 22px;
}

.panel-icon {
  display: grid;
  flex: none;
  place-items: center;
  width: 48px;
  height: 48px;
  font-size: 22px;
  color: #fff;
  background: var(--home-grad);
  border-radius: 14px;
  box-shadow: 0 12px 26px rgb(var(--home-primary-rgb) / 26%);
}

.panel-heading-text {
  min-width: 0;
}

.panel-heading-text p {
  margin: 0 0 2px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 10px;
  font-weight: 850;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--home-primary);
}

.panel-heading-text h2 {
  margin: 0;
  font-family: ui-serif, 'Noto Serif SC', 'Songti SC', Georgia, serif;
  font-size: 23px;
  font-weight: 900;
  color: var(--home-heading);
}

.instance-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 0;
}

.instance-grid > div {
  min-width: 0;
  padding: 14px 16px;
  background: var(--home-surface-soft);
  border: 1px solid var(--home-border);
  border-radius: 14px;
}

.instance-grid .instance-grid-wide {
  grid-column: 1 / -1;
}

.instance-grid dt {
  margin-bottom: 5px;
  font-size: 10.5px;
  font-weight: 850;
  letter-spacing: 0.04em;
  color: var(--home-text-faint);
}

.instance-grid dd {
  margin: 0;
  font-size: 13px;
  font-weight: 750;
  line-height: 1.65;
  color: var(--home-heading);
  overflow-wrap: anywhere;
}

.instance-grid a {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  color: var(--home-primary);
  text-decoration: none;
}

.instance-grid a:hover {
  text-decoration: underline;
}

.instance-grid a svg {
  flex: 0 0 auto;
  font-size: 13px;
}

/* ============== Contact chips ============== */
.contact-panel {
  padding: 16px;
  margin-top: 14px;
  background: var(--home-grad-soft);
  border: 1px solid rgb(var(--home-primary-rgb) / 16%);
  border-radius: 14px;
}

.contact-title {
  display: flex;
  gap: 7px;
  align-items: center;
  margin-bottom: 12px;
  font-size: 12px;
  font-weight: 900;
  color: var(--home-heading);
}

.contact-title svg {
  color: var(--home-primary);
}

.contact-list {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
}

.contact-list a,
.contact-list span {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  max-width: 100%;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--home-muted);
  text-decoration: none;
  background: var(--home-surface-strong);
  border: 1px solid var(--home-border);
  border-radius: 999px;
  transition:
    border-color 0.18s ease,
    color 0.18s ease;
}

.contact-list a:hover {
  color: var(--home-primary);
  border-color: rgb(var(--home-primary-rgb) / 32%);
}

.contact-list svg {
  flex: 0 0 auto;
  color: var(--home-primary);
}

.contact-list strong {
  white-space: nowrap;
}

.contact-list em {
  min-width: 0;
  overflow: hidden;
  font-style: normal;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.contact-fallback {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.7;
  color: var(--home-subtle);
}

/* ============== Notice ============== */
.legal-notice {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 14px;
  padding: 18px 20px;
  margin: 26px 0 4px;
  color: var(--home-muted);
  background: var(--home-warning-soft);
  border: 1px solid rgb(245 158 11 / 24%);
  border-radius: 16px;
}

.notice-icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  font-size: 20px;
  color: var(--home-warning);
  background: rgb(245 158 11 / 11%);
  border-radius: 12px;
}

.notice-body strong {
  font-size: 13px;
  font-weight: 900;
  color: var(--home-heading);
}

.notice-body p {
  margin: 6px 0 0;
  font-size: 13px;
  font-weight: 650;
  line-height: 1.8;
}

/* ============== Sections ============== */
.legal-section {
  padding-top: 34px;
  scroll-margin-top: 96px;
}

.legal-section + .legal-section {
  padding-top: 34px;
  margin-top: 34px;
  border-top: 1px solid var(--home-border);
}

.legal-section h2 {
  position: relative;
  padding-left: 20px;
  margin: 0 0 14px;
  font-family: ui-serif, 'Noto Serif SC', 'Songti SC', Georgia, serif;
  font-size: 23px;
  font-weight: 900;
  line-height: 1.45;
  letter-spacing: -0.015em;
  color: var(--home-heading);
}

.legal-section h2::before {
  position: absolute;
  top: 0.22em;
  bottom: 0.22em;
  left: 0;
  width: 4px;
  content: '';
  background: var(--home-grad);
  border-radius: 999px;
}

.legal-section > p {
  margin: 0 0 14px;
  font-size: 14px;
  font-weight: 650;
  line-height: 1.95;
  color: var(--home-subtle);
}

.legal-section ol {
  display: grid;
  gap: 12px;
  padding: 0;
  margin: 0;
  list-style: none;
  counter-reset: legal-clause;
}

.legal-section li {
  position: relative;
  padding-left: 38px;
  font-size: 14px;
  font-weight: 650;
  line-height: 1.92;
  color: var(--home-muted);
  counter-increment: legal-clause;
}

.legal-section li::before {
  position: absolute;
  top: 0.38em;
  left: 0;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 10px;
  font-weight: 800;
  color: var(--home-primary);
  content: counter(legal-clause, decimal-leading-zero);
  background: var(--home-primary-soft);
  border: 1px solid rgb(var(--home-primary-rgb) / 12%);
  border-radius: 8px;
}

.legal-section-highlight {
  padding: 26px 24px;
  margin-top: 36px;
  background:
    linear-gradient(180deg, var(--home-warning-soft), transparent 82%),
    var(--home-surface-soft);
  border: 1px solid rgb(245 158 11 / 22%);
  border-radius: 18px;
}

.legal-section-highlight + .legal-section {
  border-top: 0;
}

.legal-section-highlight h2::before {
  background: linear-gradient(180deg, var(--home-warning), rgb(245 158 11 / 28%));
}

.section-warning {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  gap: 10px;
  padding: 14px 16px;
  margin-top: 18px;
  font-size: 13px;
  font-weight: 750;
  line-height: 1.75;
  color: var(--home-muted);
  background: var(--home-danger-soft);
  border: 1px solid rgb(220 38 38 / 18%);
  border-radius: 12px;
}

.section-warning svg {
  margin-top: 2px;
  font-size: 18px;
  color: var(--home-danger);
}

/* ============== Responsive ============== */
@media (max-width: 1080px) {
  .legal-hero-grid {
    gap: 32px;
  }

  .legal-shell {
    grid-template-columns: 244px minmax(0, 1fr);
    gap: 22px;
  }

  .legal-article {
    padding: 34px 34px 48px;
  }

  .document-switcher {
    width: 264px;
  }
}

@media (max-width: 980px) {
  .legal-hero-grid {
    grid-template-columns: 1fr;
    gap: 30px;
  }

  .legal-hero-side {
    display: flex;
    gap: 18px;
    align-items: center;
    justify-content: space-between;
  }

  .document-switcher {
    width: min(100%, 340px);
  }

  .legal-stamp {
    flex: none;
  }
}

@media (max-width: 820px) {
  .legal-hero,
  .legal-shell {
    width: min(100% - 32px, 760px);
  }

  .legal-hero {
    padding: 40px 0 26px;
  }

  .legal-hero-side {
    display: block;
  }

  .legal-stamp {
    display: none;
  }

  .document-switcher {
    width: 100%;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .document-switcher a {
    padding: 0 11px;
  }

  .switcher-arrow {
    display: none;
  }

  .legal-shell {
    grid-template-columns: 1fr;
    margin-top: 24px;
  }

  .legal-toc {
    position: static;
    max-height: none;
  }

  .legal-toc nav {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .legal-hero,
  .legal-shell {
    width: min(100% - 24px, 760px);
  }

  .legal-hero {
    padding: 28px 0 20px;
  }

  .legal-heading h1 {
    font-size: clamp(30px, 10vw, 38px);
    line-height: 1.16;
  }

  .legal-hero-watermark {
    display: none;
  }

  .legal-heading > p {
    margin-top: 12px;
    font-size: 14px;
    line-height: 1.8;
  }

  .legal-meta {
    gap: 6px;
    margin-top: 16px;
  }

  .legal-meta span {
    padding: 7px 10px;
    font-size: 10.5px;
  }

  .document-switcher {
    grid-template-columns: 1fr;
    min-width: 0;
    padding: 6px;
  }

  .document-switcher a {
    min-height: 46px;
    justify-content: flex-start;
    padding: 0 10px;
  }

  .legal-toc {
    padding: 12px;
    border-radius: 16px;
  }

  .legal-toc nav {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2px;
    max-height: 284px;
    padding-right: 3px;
    overflow-x: hidden;
    overflow-y: auto;
    scrollbar-width: thin;
  }

  .legal-toc a {
    width: 100%;
    padding: 9px 10px;
    background: transparent;
    border: 0;
  }

  .legal-article {
    padding: 22px 16px 34px 19px;
    border-radius: 16px;
  }

  .panel-heading {
    gap: 10px;
    margin-bottom: 16px;
  }

  .panel-icon {
    width: 42px;
    height: 42px;
    font-size: 19px;
    border-radius: 12px;
  }

  .instance-grid {
    grid-template-columns: 1fr;
    gap: 9px;
  }

  .instance-grid .instance-grid-wide {
    grid-column: auto;
  }

  .instance-grid > div,
  .contact-panel {
    padding: 12px;
  }

  .contact-list {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .contact-list a,
  .contact-list span {
    width: 100%;
    border-radius: 10px;
  }

  .contact-list em {
    overflow: visible;
    text-overflow: clip;
    overflow-wrap: anywhere;
    white-space: normal;
  }

  .legal-notice {
    grid-template-columns: 34px minmax(0, 1fr);
    gap: 10px;
    padding: 14px;
    margin-top: 22px;
  }

  .notice-icon {
    width: 34px;
    height: 34px;
    font-size: 17px;
    border-radius: 10px;
  }

  .panel-heading-text h2,
  .legal-section h2 {
    font-size: 20px;
  }

  .legal-section {
    padding-top: 28px;
  }

  .legal-section + .legal-section {
    padding-top: 28px;
    margin-top: 28px;
  }

  .legal-section li {
    padding-left: 34px;
    font-size: 14px;
    line-height: 1.85;
  }

  .legal-section > p {
    font-size: 14px;
    line-height: 1.85;
  }

  .legal-section-highlight {
    padding: 20px 14px 18px;
  }

  .section-warning {
    padding: 12px;
  }
}

@media (max-width: 380px) {
  .legal-hero,
  .legal-shell {
    width: min(100% - 20px, 760px);
  }

  .legal-heading h1 {
    font-size: 29px;
  }

  .legal-article {
    padding-right: 13px;
    padding-left: 16px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .document-switcher a,
  .document-switcher a .switcher-icon,
  .document-switcher a .switcher-arrow,
  .legal-toc a,
  .legal-toc .toc-index,
  .contact-list a {
    transition-duration: 0.001ms !important;
  }
}
</style>
