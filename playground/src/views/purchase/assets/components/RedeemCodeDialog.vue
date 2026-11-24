<script lang="ts" setup>
import type { RedeemApi } from '#/api/redeem';

import { computed, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { Button, Input, Modal } from 'ant-design-vue';

import { redeemCode } from '#/api/redeem';
import { useSettlementCurrency } from '#/composables/use-settlement-currency';
import { $t } from '#/locales';

const emits = defineEmits<{ success: [] }>();

const { priceText } = useSettlementCurrency();

const open = defineModel<boolean>('open', { default: false });

const code = ref('');
const submitting = ref(false);
const succeeded = ref(false);
const result = ref<RedeemApi.RedeemResult>();

const normalizedCode = computed(() =>
  code.value.replaceAll(/[\s-]/g, '').toUpperCase(),
);

function formatCode(value: string) {
  // 仅保留字母与数字，转大写后按 4 位分组展示
  const cleaned = value.replaceAll(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return cleaned.replace(/(.{4})/g, '$1-').replace(/-$/, '');
}

function onCodeInput(value: string) {
  code.value = formatCode(value);
}

function resetState() {
  code.value = '';
  submitting.value = false;
  succeeded.value = false;
  result.value = undefined;
}

watch(open, (isOpen) => {
  if (!isOpen) resetState();
});

function rewardTypeLabel(value: RedeemApi.RewardType) {
  switch (value) {
    case 1: {
      return $t('system.redeem.type.rewardTypePoints');
    }
    case 2: {
      return $t('system.redeem.type.rewardTypeBalance');
    }
    case 3: {
      return $t('system.redeem.type.rewardTypeGlobalPackage');
    }
    case 4: {
      return $t('system.redeem.type.rewardTypeInterfaceSpec');
    }
    default: {
      return $t('system.redeem.type.rewardTypeCombo');
    }
  }
}

async function onSubmit() {
  if (submitting.value) return;
  const finalCode = normalizedCode.value;
  if (!finalCode) {
    code.value = '';
    return;
  }
  submitting.value = true;
  try {
    const redeemResult = await redeemCode(finalCode);
    result.value = redeemResult;
    succeeded.value = true;
    emits('success');
  } catch {
    // 失败提示由 requestClient 统一处理，保持输入状态便于重试
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Modal
    v-model:open="open"
    :cancel-text="$t('common.cancel')"
    :footer="null"
    :title="$t('system.redeem.dialog.title')"
    :width="420"
  >
    <div v-if="!succeeded" class="redeem-dialog-body">
      <div class="redeem-hint">
        {{ $t('system.redeem.dialog.hint') }}
      </div>
      <Input
        class="redeem-input"
        :placeholder="$t('system.redeem.dialog.placeholder')"
        size="large"
        :value="code"
        @update:value="onCodeInput"
        @press-enter="onSubmit"
      >
        <template #prefix>
          <IconifyIcon icon="lucide:ticket-percent" />
        </template>
      </Input>
      <div class="redeem-actions">
        <Button :disabled="submitting" @click="open = false">
          {{ $t('common.cancel') }}
        </Button>
        <Button
          :disabled="!normalizedCode"
          :loading="submitting"
          type="primary"
          @click="onSubmit"
        >
          {{ $t('system.redeem.dialog.submit') }}
        </Button>
      </div>
    </div>
    <div v-else class="redeem-result">
      <div class="redeem-result-title">
        <IconifyIcon class="redeem-result-icon" icon="lucide:circle-check" />
        {{ $t('system.redeem.dialog.successTitle') }}
      </div>
      <ul v-if="result" class="redeem-result-list">
        <li>
          <span>{{ $t('system.redeem.record.rewardType') }}</span>
          <strong>{{ rewardTypeLabel(result.rewardType) }}</strong>
        </li>
        <li v-if="result.rewardName">
          <span>{{ $t('system.redeem.record.rewardName') }}</span>
          <strong>{{ result.rewardName }}</strong>
        </li>
        <li v-if="result.rewardType === 1 || result.rewardType === 5">
          <span>{{ $t('system.redeem.record.rewardPoints') }}</span>
          <strong>{{ Number(result.rewardPoints ?? 0).toLocaleString() }}</strong>
        </li>
        <li v-if="result.rewardType === 2 || result.rewardType === 5">
          <span>{{ $t('system.redeem.record.rewardBalance') }}</span>
          <strong>{{ priceText(result.rewardBalance ?? 0) }}</strong>
        </li>
        <li v-if="result.rewardType === 3 || result.rewardType === 4">
          <span>{{ $t('system.redeem.record.validDays') }}</span>
          <strong>{{ result.validDays ?? '-' }}</strong>
        </li>
        <li>
          <span>{{ $t('system.redeem.dialog.pointsAfter') }}</span>
          <strong>{{ Number(result.pointsAfter ?? 0).toLocaleString() }}</strong>
        </li>
        <li>
          <span>{{ $t('system.redeem.dialog.balanceAfter') }}</span>
          <strong>{{ priceText(result.balanceAfter ?? 0) }}</strong>
        </li>
      </ul>
      <div class="redeem-actions">
        <Button type="primary" @click="open = false">
          {{ $t('common.confirm') }}
        </Button>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.redeem-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 8px 0 4px;
}

.redeem-hint {
  font-size: 13px;
  color: var(--vben-text-secondary-color);
}

.redeem-input {
  letter-spacing: 0.08em;
}

.redeem-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 4px;
}

.redeem-result {
  padding: 8px 0 4px;
}

.redeem-result-title {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 16px;
  font-weight: 600;
  color: var(--success, #52c41a);
}

.redeem-result-icon {
  font-size: 20px;
}

.redeem-result-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 0 0;
  margin: 0;
  list-style: none;
}

.redeem-result-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 36px;
  padding: 0 12px;
  font-size: 13px;
  background: var(--vben-bg-color);
  border: 1px solid var(--vben-border-color);
  border-radius: 6px;
}

.redeem-result-list li span {
  color: var(--vben-text-secondary-color);
}
</style>
