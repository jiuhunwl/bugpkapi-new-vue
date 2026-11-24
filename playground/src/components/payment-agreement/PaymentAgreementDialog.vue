<script lang="ts" setup>
/**
 * 支付（赞助）协议阅读弹窗。
 *
 * 与普通「点一下就看到」的弹窗相比，这里强制把正文滚到底部才能点确认：
 * 赞助属于不可逆的资金行为，退款还要扣第三方费用，事后争议里最容易出现
 * 「我没看见/没人告诉我」的抗辩。滚动到底 + 确认按钮是成本最低的举证方式。
 */
import type { AgreementApi } from '#/api/system/agreement';
import type { PaymentAgreementDoc } from './content';

import { computed, nextTick, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { Button, Modal } from 'ant-design-vue';

import { getPublicAgreement } from '#/api/system/agreement';
import { $t, useI18n } from '#/locales';
import { sanitizeRichTextHtml } from '#/utils/sanitize-rich-text-html';

import { resolvePaymentAgreementDoc } from './content';

defineOptions({ name: 'PaymentAgreementDialog' });

const props = withDefaults(
  defineProps<{
    open?: boolean;
  }>(),
  { open: false },
);

const emit = defineEmits<{
  agree: [];
  'update:open': [boolean];
}>();

const { locale } = useI18n();

const doc = computed<PaymentAgreementDoc>(() =>
  resolvePaymentAgreementDoc(locale.value),
);

const agreementTemplate = ref<AgreementApi.PublicDocument | null>(null);
const templateHtml = computed(() =>
  agreementTemplate.value?.configured
    ? sanitizeRichTextHtml(agreementTemplate.value.contentHtml ?? '')
    : '',
);
const usingTemplate = computed(() => Boolean(templateHtml.value));
const metaVersion = computed(() =>
  usingTemplate.value
    ? agreementTemplate.value?.version || doc.value.version
    : doc.value.version,
);
const metaEffectiveDate = computed(() =>
  usingTemplate.value
    ? agreementTemplate.value?.effectiveDate || doc.value.effectiveDate
    : doc.value.effectiveDate,
);

let templateLoadedFor = '';

async function loadAgreementTemplate(force = false) {
  if (!force && templateLoadedFor === locale.value) return;
  try {
    agreementTemplate.value = await getPublicAgreement(
      'payment',
      locale.value,
    );
    templateLoadedFor = locale.value;
  } catch {
    agreementTemplate.value = null;
  }
}

const bodyRef = ref<HTMLElement>();
const readToEnd = ref(false);

const dialogOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
});

/**
 * 内容不足一屏时没有滚动条，scrollHeight === clientHeight，
 * 此时应直接视为「已读到底」，否则确认按钮永远点不动。
 */
function isScrolledToEnd(element?: HTMLElement | null) {
  if (!element) return false;
  return (
    element.scrollHeight - element.scrollTop - element.clientHeight <= 24
  );
}

function syncReadState() {
  if (isScrolledToEnd(bodyRef.value)) {
    readToEnd.value = true;
  }
}

function handleScroll() {
  syncReadState();
}

watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    readToEnd.value = false;
    await loadAgreementTemplate();
    await nextTick();
    // 弹窗动画期间高度可能未定，再等一帧后判定
    await nextTick();
    syncReadState();
  },
);

watch(locale, () => {
  templateLoadedFor = '';
  if (props.open) {
    void loadAgreementTemplate(true);
  }
});

watch(usingTemplate, async () => {
  // 模板可能在弹窗打开后异步到达；正文长度变化时重新判定是否读到底。
  readToEnd.value = false;
  await nextTick();
  syncReadState();
});

function close() {
  dialogOpen.value = false;
}

function confirm() {
  if (!readToEnd.value) return;
  emit('agree');
  close();
}
</script>

<template>
  <Modal
    v-model:open="dialogOpen"
    :footer="null"
    :mask-closable="false"
    :width="760"
    destroy-on-close
  >
    <template #title>
      <div class="agreement__title">
        <IconifyIcon class="size-5" icon="lucide:shield-check" />
        <div>
          <strong>{{ $t('paymentAgreement.dialogTitle') }}</strong>
          <em>{{ $t('paymentAgreement.dialogSubtitle') }}</em>
        </div>
      </div>
    </template>

    <div class="agreement">
      <div class="agreement__meta">
        <span>{{ $t('paymentAgreement.metaVersion', [metaVersion]) }}</span>
        <span>
          {{ $t('paymentAgreement.metaEffective', [metaEffectiveDate]) }}
        </span>
      </div>

      <p v-if="!usingTemplate" class="agreement__summary">{{ doc.summary }}</p>

      <div v-if="!usingTemplate" class="agreement__notice">
        <IconifyIcon class="size-4" icon="lucide:alert-triangle" />
        <div>
          <strong>{{ $t('paymentAgreement.noticeTitle') }}</strong>
          <p>{{ doc.notice }}</p>
        </div>
      </div>

      <div
        ref="bodyRef"
        class="agreement__body"
        role="region"
        tabindex="0"
        @scroll.passive="handleScroll"
      >
        <div
          v-if="usingTemplate"
          class="agreement__template"
          v-html="templateHtml"
        ></div>
        <template v-else>
          <section
            v-for="section in doc.sections"
            :key="section.id"
            class="agreement__section"
            :class="{ 'is-highlight': section.highlight }"
          >
            <h4>{{ section.title }}</h4>
            <p v-if="section.intro" class="agreement__intro">
              {{ section.intro }}
            </p>
            <ul>
              <li v-for="(item, index) in section.items" :key="index">
                {{ item }}
              </li>
            </ul>
            <p v-if="section.outro" class="agreement__outro">
              {{ section.outro }}
            </p>
          </section>

          <div class="agreement__ack">
            <strong>{{ $t('paymentAgreement.ackTitle') }}</strong>
            <p>{{ doc.ack }}</p>
          </div>
        </template>
      </div>

      <div class="agreement__footer">
        <span class="agreement__hint">
          <IconifyIcon
            :icon="readToEnd ? 'lucide:check-circle-2' : 'lucide:scroll-text'"
          />
          {{ $t('paymentAgreement.scrollHint') }}
        </span>
        <div class="agreement__actions">
          <Button @click="close">
            {{ $t('paymentAgreement.actionsClose') }}
          </Button>
          <Button type="primary" :disabled="!readToEnd" @click="confirm">
            {{ $t('paymentAgreement.actionsAgree') }}
          </Button>
        </div>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.agreement__title {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.agreement__title :deep(svg) {
  margin-top: 2px;
  color: hsl(var(--primary));
}

.agreement__title strong {
  display: block;
  font-size: 16px;
  font-weight: 800;
  line-height: 22px;
  color: hsl(var(--foreground));
}

.agreement__title em {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: 18px;
  color: hsl(var(--muted-foreground));
}

.agreement {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.agreement__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.agreement__summary {
  padding: 10px 12px;
  margin: 0;
  font-size: 13px;
  line-height: 21px;
  color: hsl(var(--foreground) / 82%);
  background: hsl(var(--muted) / 45%);
  border-radius: 8px;
}

.agreement__notice {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr);
  gap: 8px;
  padding: 10px 12px;
  color: #b36b00;
  background: #fff8e8;
  border: 1px solid #f6c56b;
  border-radius: 8px;
}

.agreement__notice strong {
  font-size: 13px;
  font-weight: 800;
}

.agreement__notice p {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 20px;
  color: #8a5a00;
}

.agreement__body {
  max-height: min(56vh, 520px);
  padding: 2px 14px 2px 2px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scroll-behavior: smooth;
}

.agreement__body:focus-visible {
  outline: 2px solid hsl(var(--primary) / 45%);
  outline-offset: 2px;
  border-radius: 8px;
}

.agreement__section {
  padding: 12px 0;
  border-bottom: 1px dashed hsl(var(--border));
}

.agreement__section:last-of-type {
  border-bottom: 0;
}

.agreement__section h4 {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 800;
  line-height: 21px;
  color: hsl(var(--foreground));
}

.agreement__section.is-highlight h4 {
  padding-left: 8px;
  color: hsl(var(--primary));
  border-left: 3px solid hsl(var(--primary));
}

.agreement__intro,
.agreement__outro {
  margin: 0 0 8px;
  font-size: 13px;
  line-height: 21px;
  color: hsl(var(--foreground) / 72%);
}

.agreement__outro {
  padding: 8px 10px;
  margin: 8px 0 0;
  color: #8a5a00;
  background: #fffaf0;
  border-radius: 6px;
}

.agreement__section ul {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.agreement__section li {
  position: relative;
  padding-left: 14px;
  font-size: 13px;
  line-height: 21px;
  color: hsl(var(--foreground) / 82%);
}

.agreement__section li::before {
  position: absolute;
  top: 9px;
  left: 2px;
  width: 4px;
  height: 4px;
  content: '';
  background: hsl(var(--primary) / 60%);
  border-radius: 50%;
}

.agreement__ack {
  padding: 12px;
  margin-top: 12px;
  background: hsl(var(--primary) / 6%);
  border: 1px solid hsl(var(--primary) / 24%);
  border-radius: 8px;
}

.agreement__ack strong {
  display: block;
  font-size: 13px;
  font-weight: 800;
  color: hsl(var(--primary));
}

.agreement__ack p {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 21px;
  color: hsl(var(--foreground) / 80%);
}

.agreement__footer {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding-top: 12px;
  border-top: 1px solid hsl(var(--border));
}

.agreement__hint {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.agreement__actions {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
}

.agreement__template :deep(h2) {
  padding-bottom: 8px;
  margin: 18px 0 10px;
  font-size: 15px;
  font-weight: 800;
  line-height: 22px;
  color: hsl(var(--foreground));
  border-bottom: 1px dashed hsl(var(--border));
}

.agreement__template :deep(h2:first-child) {
  margin-top: 0;
}

.agreement__template :deep(h3) {
  margin: 14px 0 8px;
  font-size: 14px;
  font-weight: 800;
  line-height: 21px;
  color: hsl(var(--foreground));
}

.agreement__template :deep(p) {
  margin: 0 0 10px;
  font-size: 13px;
  line-height: 21px;
  color: hsl(var(--foreground) / 78%);
}

.agreement__template :deep(ul),
.agreement__template :deep(ol) {
  display: grid;
  gap: 6px;
  padding-left: 20px;
  margin: 0 0 12px;
}

.agreement__template :deep(li) {
  font-size: 13px;
  line-height: 20px;
  color: hsl(var(--foreground) / 72%);
}

.agreement__template :deep(li::marker) {
  color: hsl(var(--primary));
}

.agreement__template :deep(strong) {
  color: hsl(var(--foreground));
}

.agreement__template :deep(a) {
  color: hsl(var(--primary));
  text-decoration: underline;
}

.agreement__template :deep(table) {
  width: 100%;
  margin-bottom: 12px;
  font-size: 12px;
  border-collapse: collapse;
}

.agreement__template :deep(th),
.agreement__template :deep(td) {
  padding: 8px 10px;
  border: 1px solid hsl(var(--border));
}

.agreement__template :deep(blockquote) {
  padding: 8px 12px;
  margin: 10px 0;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 40%);
  border-left: 3px solid hsl(var(--primary));
}

html.dark .agreement__notice {
  color: #ffd591;
  background: rgb(54 40 16 / 85%);
  border-color: rgb(173 124 32 / 60%);
}

html.dark .agreement__notice p,
html.dark .agreement__outro {
  color: #ffd591;
}

html.dark .agreement__outro {
  background: rgb(48 38 20 / 80%);
}

@media (max-width: 640px) {
  .agreement__body {
    max-height: 52vh;
  }

  .agreement__footer {
    flex-direction: column;
    align-items: stretch;
  }

  .agreement__actions {
    justify-content: flex-end;
  }
}
</style>
