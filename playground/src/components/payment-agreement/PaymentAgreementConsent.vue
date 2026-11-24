<script lang="ts" setup>
/**
 * 支付协议勾选行。勾选状态由父组件持有（v-model:checked），
 * 因为父组件需要用它来决定是否解锁支付二维码。
 *
 * 勾选本身即时生效——这与主流程一致：用户在支付页勾选即构成对协议条款的同意，
 * 协议弹窗是「可随时查阅」的阅读入口，不强制先读后勾，避免把支付流程做成
 * 多层阻断而把正常用户挡在门外。
 */
import { computed, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { Checkbox } from 'ant-design-vue';

import { $t } from '#/locales';

import PaymentAgreementDialog from './PaymentAgreementDialog.vue';

defineOptions({ name: 'PaymentAgreementConsent' });

const props = withDefaults(
  defineProps<{
    checked?: boolean;
    disabled?: boolean;
  }>(),
  { checked: false, disabled: false },
);

const emit = defineEmits<{
  'update:checked': [boolean];
}>();

const dialogOpen = ref(false);

const innerChecked = computed({
  get: () => props.checked,
  set: (value: boolean) => emit('update:checked', value),
});

function openReader() {
  dialogOpen.value = true;
}

function handleAgree() {
  innerChecked.value = true;
}

defineExpose({ openReader });
</script>

<template>
  <div class="agreement-consent" :class="{ 'is-checked': checked }">
    <p class="agreement-consent__nature">
      <IconifyIcon class="size-3.5" icon="lucide:heart-handshake" />
      <span>{{ $t('paymentAgreement.sponsorNatureHint') }}</span>
    </p>

    <Checkbox
      v-model:checked="innerChecked"
      :disabled="disabled"
      class="agreement-consent__box"
    >
      <span class="agreement-consent__text">
        {{ $t('paymentAgreement.consentPrefix') }}
        <!-- 用 button 而不是 a：这里不跳路由，只开弹窗，
             且需要阻止 label 的默认勾选行为 -->
        <button
          type="button"
          class="agreement-consent__link"
          @click.prevent.stop="openReader"
        >
          {{ $t('paymentAgreement.consentLink') }}
        </button>
        {{ $t('paymentAgreement.consentSuffix') }}
      </span>
    </Checkbox>

    <PaymentAgreementDialog v-model:open="dialogOpen" @agree="handleAgree" />
  </div>
</template>

<style scoped>
.agreement-consent {
  padding: 10px 12px;
  background: hsl(var(--muted) / 35%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease;
}

.agreement-consent.is-checked {
  background: hsl(var(--success) / 8%);
  border-color: hsl(var(--success) / 40%);
}

.agreement-consent__nature {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  margin: 0 0 8px;
  font-size: 12px;
  line-height: 18px;
  color: hsl(var(--muted-foreground));
}

.agreement-consent__nature :deep(svg) {
  flex-shrink: 0;
  margin-top: 2px;
  color: hsl(var(--primary));
}

.agreement-consent__box {
  align-items: flex-start;
  line-height: 20px;
  white-space: normal;
}

.agreement-consent__box :deep(.ant-checkbox) {
  margin-top: 2px;
}

.agreement-consent__text {
  font-size: 12px;
  line-height: 20px;
  color: hsl(var(--foreground) / 76%);
}

.agreement-consent__link {
  padding: 0;
  font-size: 12px;
  font-weight: 700;
  color: hsl(var(--primary));
  cursor: pointer;
  background: none;
  border: 0;
}

.agreement-consent__link:hover {
  text-decoration: underline;
}
</style>
