<script setup lang="ts">
import type { RiskControlApi } from '#/api/risk-control';

import { computed, shallowRef, watch } from 'vue';

import { DatePicker, Input, message, Modal, Select } from 'ant-design-vue';

import { banRiskAccount } from '#/api/risk-control';
import { $t } from '#/locales';

const props = defineProps<{
  account?: RiskControlApi.FailedAccountRank;
  open: boolean;
}>();

const emit = defineEmits<{
  success: [];
  'update:open': [value: boolean];
}>();

const mode = shallowRef<RiskControlApi.BanMode>('TEMPORARY');
const banUntil = shallowRef<string>();
const reason = shallowRef('');
const submitting = shallowRef(false);

const accountLabel = computed(
  () => props.account?.displayName || props.account?.username || `#${props.account?.userId ?? '-'}`,
);

watch(
  () => props.open,
  (open) => {
    if (open) {
      mode.value = 'TEMPORARY';
      banUntil.value = undefined;
      reason.value = '';
    }
  },
);

function close() {
  if (!submitting.value) emit('update:open', false);
}

function onDateChange(value: any) {
  banUntil.value = value ? String(value) : undefined;
}

async function submit() {
  const userId = props.account?.userId;
  const trimmedReason = reason.value.trim();
  if (!userId || !trimmedReason) {
    message.warning($t('system.user.banReasonRequired'));
    return;
  }
  if (mode.value === 'TEMPORARY' && !banUntil.value) {
    message.warning($t('system.user.banEndTimeRequired'));
    return;
  }
  submitting.value = true;
  try {
    await banRiskAccount({
      banUntil: mode.value === 'TEMPORARY' ? banUntil.value : undefined,
      mode: mode.value,
      reason: trimmedReason,
      userId,
    });
    message.success($t('system.user.banSuccess'));
    emit('update:open', false);
    emit('success');
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Modal
    :open="open"
    :title="$t('system.user.banAccountTitle', [accountLabel])"
    :confirm-loading="submitting"
    :ok-text="$t('system.user.banConfirmAction')"
    :cancel-text="$t('common.cancel')"
    @cancel="close"
    @ok="submit"
  >
    <div class="ban-dialog__form">
      <label>
        <span>{{ $t('system.user.banType') }}</span>
        <Select
          v-model:value="mode"
          :options="[
            { label: $t('system.user.banTemporary'), value: 'TEMPORARY' },
            { label: $t('system.user.banPermanent'), value: 'PERMANENT' },
          ]"
        />
      </label>
      <label v-if="mode === 'TEMPORARY'">
        <span>{{ $t('system.user.banUntil') }}</span>
        <DatePicker
          show-time
          value-format="YYYY-MM-DD HH:mm:ss"
          @change="onDateChange"
        />
      </label>
      <label>
        <span>{{ $t('system.user.banReason') }}</span>
        <Input.TextArea
          v-model:value="reason"
          :maxlength="100"
          :rows="2"
          show-count
          :placeholder="$t('system.user.banReasonPlaceholder')"
        />
      </label>
    </div>
  </Modal>
</template>

<style scoped>
.ban-dialog__form {
  display: grid;
  gap: 16px;
}

.ban-dialog__form label {
  display: grid;
  gap: 7px;
}

.ban-dialog__form label > span {
  color: var(--vben-text-color);
  font-size: 13px;
  font-weight: 600;
}

.ban-dialog__form :deep(.ant-select),
.ban-dialog__form :deep(.ant-picker) {
  width: 100%;
}
</style>
