<script lang="ts" setup>
/**
 * 二维码栅栏：未同意协议时不隐藏二维码（隐藏会让人以为加载失败），
 * 而是把它虚化 + 半透明，并叠一个锁层。用户仍然能看出「这里有个码」，
 * 但扫不出来——扫码入口本身被协议同意状态严格绑定。
 *
 * 为什么用 filter 而不是 opacity 覆盖：二维码是 canvas，直接降透明度会
 * 让它与页面背景混在一起发灰，视觉上像坏图；blur + saturate 先降低可辨识度，
 * 再配合白底容器保留「这里是一张码」的形状。
 */
import { IconifyIcon } from '@vben/icons';

import { $t } from '#/locales';

defineOptions({ name: 'PaymentQrShield' });

const props = withDefaults(
  defineProps<{
    locked?: boolean;
  }>(),
  { locked: true },
);

const emit = defineEmits<{
  unlock: [];
}>();
</script>

<template>
  <div class="qr-shield" :class="{ 'is-locked': props.locked }">
    <div class="qr-shield__code" aria-hidden="false">
      <slot></slot>
    </div>

    <button
      v-if="props.locked"
      type="button"
      class="qr-shield__lock"
      @click="emit('unlock')"
    >
      <span class="qr-shield__badge">
        <IconifyIcon class="size-5" icon="lucide:lock-keyhole" />
      </span>
      <strong>{{ $t('paymentAgreement.qrcodeLocked') }}</strong>
      <em>{{ $t('paymentAgreement.qrcodeLockedHint') }}</em>
    </button>
  </div>
</template>

<style scoped>
.qr-shield {
  position: relative;
  display: inline-grid;
  place-items: center;
  padding: 12px;
  background: #fff;
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.qr-shield__code {
  display: grid;
  place-items: center;
  transition:
    filter 0.28s ease,
    opacity 0.28s ease,
    transform 0.28s ease;
}

.qr-shield.is-locked .qr-shield__code {
  filter: blur(5px) saturate(0.45);
  opacity: 0.42;
  transform: scale(0.99);
  pointer-events: none;
  user-select: none;
}

.qr-shield__lock {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
  justify-content: center;
  padding: 12px;
  cursor: pointer;
  background: rgb(255 255 255 / 42%);
  border: 0;
  border-radius: inherit;
  backdrop-filter: blur(1px);
  transition: background-color 0.2s ease;
}

.qr-shield__lock:hover {
  background: rgb(255 255 255 / 28%);
}

.qr-shield__badge {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  color: #fff;
  background: linear-gradient(135deg, #3b82f6, #6366f1);
  border-radius: 50%;
  box-shadow: 0 6px 16px rgb(59 130 246 / 38%);
}

.qr-shield__lock strong {
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 800;
  line-height: 18px;
  color: #1e293b;
  background: rgb(255 255 255 / 92%);
  border-radius: 999px;
}

.qr-shield__lock em {
  font-size: 11px;
  font-style: normal;
  line-height: 16px;
  color: #475569;
  text-decoration: underline;
}
</style>
