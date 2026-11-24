<script setup lang="ts">
import type { LegalDocumentType } from '../types';

import { RouterLink } from 'vue-router';

import { IconifyIcon } from '@vben/icons';

import { $t } from '#/locales';

defineProps<{
  documentType: LegalDocumentType;
  effectiveDate?: string;
  eyebrow: string;
  summary: string;
  title: string;
  updatedDate?: string;
  version?: string;
}>();
</script>

<template>
  <header class="legal-hero">
    <span class="legal-hero-watermark" aria-hidden="true">LEGAL</span>

    <div class="legal-hero-grid">
      <div class="legal-heading">
        <span class="legal-eyebrow">
          <span class="legal-eyebrow-dot" aria-hidden="true" />
          {{ eyebrow }}
        </span>
        <h1 data-testid="legal-document-title">{{ title }}</h1>
        <p>{{ summary }}</p>
        <div class="legal-meta">
          <span>
            <IconifyIcon icon="lucide:calendar-check" />
            {{ $t('legal.common.effectiveDate') }}：
            {{ effectiveDate || $t('legal.common.effectiveDateValue') }}
          </span>
          <span>
            <IconifyIcon icon="lucide:file-clock" />
            {{ $t('legal.common.updatedDate') }}：
            {{ updatedDate || $t('legal.common.updatedDateValue') }}
          </span>
          <span>
            <IconifyIcon icon="lucide:badge-check" />
            {{ $t('legal.common.versionLabel') }}
            {{ version || $t('legal.common.versionValue') }}
          </span>
        </div>
      </div>

      <div class="legal-hero-side">
        <div class="legal-stamp" aria-hidden="true">
          <span>LEGAL</span>
          <strong>{{ version || $t('legal.common.versionValue') }}</strong>
          <i class="legal-stamp-dot" />
        </div>

        <nav
          class="document-switcher"
          :aria-label="$t('legal.common.legalCenter')"
        >
          <RouterLink
            :class="{ active: documentType === 'privacy' }"
            to="/privacy-policy"
          >
            <span class="switcher-icon" aria-hidden="true">
              <IconifyIcon icon="lucide:shield-check" />
            </span>
            <span class="switcher-label">
              {{ $t('legal.common.privacyPolicy') }}
            </span>
            <IconifyIcon class="switcher-arrow" icon="lucide:arrow-right" />
          </RouterLink>
          <RouterLink
            :class="{ active: documentType === 'terms' }"
            to="/terms-of-service"
          >
            <span class="switcher-icon" aria-hidden="true">
              <IconifyIcon icon="lucide:scroll-text" />
            </span>
            <span class="switcher-label">
              {{ $t('legal.common.termsOfService') }}
            </span>
            <IconifyIcon class="switcher-arrow" icon="lucide:arrow-right" />
          </RouterLink>
          <RouterLink
            :class="{ active: documentType === 'payment' }"
            to="/payment-agreement"
          >
            <span class="switcher-icon" aria-hidden="true">
              <IconifyIcon icon="lucide:handshake" />
            </span>
            <span class="switcher-label">
              {{ $t('legal.common.paymentAgreement') }}
            </span>
            <IconifyIcon class="switcher-arrow" icon="lucide:arrow-right" />
          </RouterLink>
        </nav>
      </div>
    </div>
  </header>
</template>
