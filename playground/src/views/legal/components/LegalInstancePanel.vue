<script setup lang="ts">
import type { LegalContactItem } from '../types';

import { IconifyIcon } from '@vben/icons';

import { $t } from '#/locales';

defineProps<{
  authorUrl: string;
  contactItems: LegalContactItem[];
  copyrightText: string;
  githubUrl: string;
  licenseType: string;
  operatorDescription: string;
  siteName: string;
  siteUrl: string;
  siteUrlHref: string;
}>();
</script>

<template>
  <section class="instance-panel" aria-labelledby="instance-title">
    <div class="panel-heading">
      <span class="panel-icon" aria-hidden="true">
        <IconifyIcon icon="lucide:landmark" />
      </span>
      <div class="panel-heading-text">
        <p>{{ $t('legal.common.legalCenter') }}</p>
        <h2 id="instance-title">{{ $t('legal.common.currentInstance') }}</h2>
      </div>
    </div>

    <dl class="instance-grid">
      <div class="instance-grid-wide">
        <dt>{{ $t('legal.common.serviceName') }}</dt>
        <dd>{{ siteName }}</dd>
      </div>
      <div class="instance-grid-wide">
        <dt>{{ $t('legal.common.operator') }}</dt>
        <dd>{{ operatorDescription }}</dd>
      </div>
      <div>
        <dt>{{ $t('legal.common.author') }}</dt>
        <dd>
          <a
            v-if="authorUrl"
            :href="authorUrl"
            rel="noopener noreferrer"
            target="_blank"
          >
            {{ $t('legal.common.authorValue') }}
            <IconifyIcon icon="lucide:external-link" />
          </a>
          <span v-else>{{ $t('legal.common.authorValue') }}</span>
        </dd>
      </div>
      <div>
        <dt>{{ $t('legal.common.license') }}</dt>
        <dd>{{ licenseType || $t('legal.common.licenseValue') }}</dd>
      </div>
      <div>
        <dt>{{ $t('legal.common.projectRepository') }}</dt>
        <dd>
          <a
            v-if="githubUrl"
            :href="githubUrl"
            rel="noopener noreferrer"
            target="_blank"
          >
            {{ githubUrl.replace(/^https?:\/\//, '') }}
            <IconifyIcon icon="lucide:external-link" />
          </a>
          <span v-else>-</span>
        </dd>
      </div>
      <div>
        <dt>{{ $t('legal.common.siteUrl') }}</dt>
        <dd>
          <a
            v-if="siteUrlHref"
            :href="siteUrlHref"
            rel="noopener noreferrer"
            target="_blank"
          >
            {{ siteUrl }}
            <IconifyIcon icon="lucide:external-link" />
          </a>
          <span v-else>{{ siteUrl || '-' }}</span>
        </dd>
      </div>
      <div class="instance-grid-wide">
        <dt>{{ $t('legal.common.copyright') }}</dt>
        <dd>{{ copyrightText }}</dd>
      </div>
    </dl>

    <div class="contact-panel">
      <div class="contact-title">
        <IconifyIcon icon="lucide:messages-square" />
        {{ $t('legal.common.contact') }}
      </div>
      <div v-if="contactItems.length > 0" class="contact-list">
        <template
          v-for="item in contactItems"
          :key="`${item.label}-${item.value}`"
        >
          <a v-if="item.href" :href="item.href">
            <IconifyIcon :icon="item.icon" />
            <strong>{{ item.label }}</strong>
            <em>{{ item.value }}</em>
          </a>
          <span v-else>
            <IconifyIcon :icon="item.icon" />
            <strong>{{ item.label }}</strong>
            <em>{{ item.value }}</em>
          </span>
        </template>
      </div>
      <p v-else class="contact-fallback">
        {{ $t('legal.common.contactFallback') }}
      </p>
    </div>
  </section>
</template>
