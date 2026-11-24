<script lang="ts" setup>
defineOptions({ name: 'LegalAgreementTemplate' });

defineProps<{
  html: string;
}>();
</script>

<template>
  <section class="legal-template-content" v-html="html"></section>
</template>

<style scoped>
.legal-template-content {
  display: block;
}

.legal-template-content :deep(h2) {
  position: relative;
  padding-left: 20px;
  margin: 36px 0 14px;
  font-family: ui-serif, 'Noto Serif SC', 'Songti SC', Georgia, serif;
  font-size: 23px;
  font-weight: 900;
  line-height: 1.45;
  letter-spacing: -0.015em;
  color: var(--home-heading);
  scroll-margin-top: 96px;
}

.legal-template-content :deep(h2:first-child) {
  margin-top: 0;
}

.legal-template-content :deep(h2::before) {
  position: absolute;
  top: 0.22em;
  bottom: 0.22em;
  left: 0;
  width: 4px;
  content: '';
  background: var(--home-grad);
  border-radius: 999px;
}

.legal-template-content :deep(h3) {
  margin: 24px 0 10px;
  font-family: ui-serif, 'Noto Serif SC', 'Songti SC', Georgia, serif;
  font-size: 18px;
  font-weight: 850;
  line-height: 1.5;
  color: var(--home-heading);
  scroll-margin-top: 96px;
}

.legal-template-content :deep(p) {
  margin: 0 0 14px;
  font-size: 14px;
  font-weight: 650;
  line-height: 1.95;
  color: var(--home-subtle);
}

.legal-template-content :deep(ul),
.legal-template-content :deep(ol) {
  display: grid;
  gap: 9px;
  padding-left: 22px;
  margin: 0 0 16px;
}

.legal-template-content :deep(li) {
  font-size: 14px;
  font-weight: 650;
  line-height: 1.92;
  color: var(--home-muted);
}

.legal-template-content :deep(li::marker) {
  color: var(--home-primary);
}

.legal-template-content :deep(strong) {
  font-weight: 850;
  color: var(--home-heading);
}

.legal-template-content :deep(a) {
  color: var(--home-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.legal-template-content :deep(blockquote) {
  padding: 14px 16px;
  margin: 16px 0;
  color: var(--home-muted);
  background: var(--home-primary-soft);
  border-left: 4px solid var(--home-primary);
  border-radius: 0 12px 12px 0;
}

.legal-template-content :deep(table) {
  width: 100%;
  margin: 0 0 16px;
  overflow: hidden;
  font-size: 13px;
  border-collapse: collapse;
  border: 1px solid var(--home-border);
  border-radius: 12px;
}

.legal-template-content :deep(th),
.legal-template-content :deep(td) {
  padding: 10px 12px;
  line-height: 1.7;
  text-align: left;
  border-bottom: 1px solid var(--home-border);
}

.legal-template-content :deep(th) {
  font-weight: 800;
  color: var(--home-heading);
  background: var(--home-surface-soft);
}

.legal-template-content :deep(hr) {
  height: 1px;
  margin: 24px 0;
  background: var(--home-border);
  border: 0;
}

.legal-template-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 12px;
}
</style>
