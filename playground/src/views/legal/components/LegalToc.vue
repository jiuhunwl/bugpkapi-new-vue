<script setup lang="ts">
import type { LegalSection } from '../types';

import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { $t } from '#/locales';

const props = defineProps<{
  sections: LegalSection[];
}>();

const activeId = ref('');

function updateActiveSection() {
  if (props.sections.length === 0) {
    activeId.value = '';
    return;
  }
  let current = props.sections[0]!.id;
  for (const section of props.sections) {
    const element = document.getElementById(section.id);
    if (!element) continue;
    if (element.getBoundingClientRect().top <= 132) {
      current = section.id;
    } else {
      break;
    }
  }
  activeId.value = current;
}

function handleScroll() {
  updateActiveSection();
}

onMounted(() => {
  updateActiveSection();
  window.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener('resize', handleScroll);
});

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll);
  window.removeEventListener('resize', handleScroll);
});

watch(
  () => props.sections,
  async () => {
    await nextTick();
    updateActiveSection();
  },
  { flush: 'post' },
);
</script>

<template>
  <aside class="legal-toc">
    <div class="toc-head">
      <div class="toc-title">
        <IconifyIcon icon="lucide:list-tree" />
        {{ $t('legal.common.tableOfContents') }}
      </div>
      <span class="toc-count" aria-hidden="true">
        {{ String(props.sections.length).padStart(2, '0') }}
      </span>
    </div>
    <nav>
      <a
        v-for="(section, index) in props.sections"
        :key="section.id"
        :class="{ 'is-active': activeId === section.id }"
        :href="`#${section.id}`"
      >
        <span class="toc-index" aria-hidden="true">
          {{ String(index + 1).padStart(2, '0') }}
        </span>
        <span class="toc-label">{{ section.title }}</span>
      </a>
    </nav>
  </aside>
</template>
