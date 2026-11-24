<script setup lang="ts">
import type { LegalSection } from '../types';

import { IconifyIcon } from '@vben/icons';

import { $t } from '#/locales';

defineProps<{
  notice: string;
  sections: LegalSection[];
}>();
</script>

<template>
  <section class="legal-notice">
    <span class="notice-icon" aria-hidden="true">
      <IconifyIcon icon="lucide:triangle-alert" />
    </span>
    <div class="notice-body">
      <strong>{{ $t('legal.common.readNotice') }}</strong>
      <p>{{ notice }}</p>
    </div>
  </section>

  <section
    v-for="section in sections"
    :id="section.id"
    :key="section.id"
    class="legal-section"
    :class="{ 'legal-section-highlight': section.highlight }"
  >
    <h2>{{ section.title }}</h2>
    <p v-if="section.intro">{{ section.intro }}</p>
    <ol>
      <li
        v-for="(item, index) in section.items"
        :key="`${section.id}-${index}`"
      >
        {{ item }}
      </li>
    </ol>
    <p v-if="section.outro">{{ section.outro }}</p>
    <div v-if="section.warning" class="section-warning">
      <IconifyIcon icon="lucide:shield-alert" />
      <span>{{ section.warning }}</span>
    </div>
  </section>
</template>
