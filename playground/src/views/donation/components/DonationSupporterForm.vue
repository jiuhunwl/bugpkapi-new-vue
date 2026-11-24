<script setup lang="ts">
import type { DonationApi } from '#/api/donation';

import { computed, reactive, shallowRef, watch } from 'vue';

import {
  Alert,
  Avatar,
  DatePicker,
  Form,
  FormItem,
  Input,
  Modal,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { $t } from '#/locales';

import {
  normalizeDonationSupporter,
  validateDonationSupporter,
} from '../model';

const props = defineProps<{
  open: boolean;
  submitting: boolean;
}>();

const emit = defineEmits<{
  submit: [payload: DonationApi.CreateSupporterPayload];
  'update:open': [open: boolean];
}>();

function defaultForm(): DonationApi.CreateSupporterPayload {
  return {
    amount: '',
    avatarUrl: '',
    donatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    message: '',
    nickname: '',
  };
}

const form = reactive<DonationApi.CreateSupporterPayload>(defaultForm());
const validationMessage = shallowRef('');
const avatarFallback = computed(
  () => Array.from(form.nickname.trim())[0]?.toLocaleUpperCase() || '?',
);

function resetForm() {
  Object.assign(form, defaultForm());
  validationMessage.value = '';
}

function close() {
  if (props.submitting) return;
  emit('update:open', false);
}

function submit() {
  const issue = validateDonationSupporter(form);
  if (issue) {
    validationMessage.value = $t(
      `donationSettings.supporters.validation.${issue.code}`,
    );
    return;
  }
  validationMessage.value = '';
  emit('submit', normalizeDonationSupporter(form));
}

watch(
  () => props.open,
  (open) => {
    if (open) resetForm();
  },
);
</script>

<template>
  <Modal
    :cancel-text="$t('donationSettings.supporters.actions.cancel')"
    :confirm-loading="props.submitting"
    destroy-on-close
    :ok-text="$t('donationSettings.supporters.actions.submit')"
    :open="props.open"
    :title="$t('donationSettings.supporters.formTitle')"
    @cancel="close"
    @ok="submit"
  >
    <Alert
      v-if="validationMessage"
      class="supporter-form-alert"
      show-icon
      type="error"
      :message="validationMessage"
    />

    <Form layout="vertical">
      <div class="supporter-form-identity">
        <Avatar :size="56" :src="form.avatarUrl || undefined">
          {{ avatarFallback }}
        </Avatar>
        <div>
          <strong>{{ form.nickname || $t('donationSettings.supporters.previewName') }}</strong>
          <span>{{ form.amount ? `¥${form.amount}` : '¥0.00' }}</span>
        </div>
      </div>

      <FormItem :label="$t('donationSettings.supporters.fields.nickname')" required>
        <Input
          v-model:value="form.nickname"
          data-testid="supporter-nickname"
          :maxlength="64"
          :placeholder="$t('donationSettings.supporters.placeholders.nickname')"
          show-count
        />
      </FormItem>

      <FormItem :label="$t('donationSettings.supporters.fields.avatarUrl')">
        <Input
          v-model:value="form.avatarUrl"
          data-testid="supporter-avatar-url"
          :maxlength="1024"
          :placeholder="$t('donationSettings.supporters.placeholders.avatarUrl')"
        />
      </FormItem>

      <div class="supporter-form-row">
        <FormItem :label="$t('donationSettings.supporters.fields.amount')" required>
          <Input
            v-model:value="form.amount"
            data-testid="supporter-amount"
            inputmode="decimal"
            :maxlength="32"
            :placeholder="$t('donationSettings.supporters.placeholders.amount')"
            prefix="¥"
          />
        </FormItem>

        <FormItem :label="$t('donationSettings.supporters.fields.donatedAt')" required>
          <DatePicker
            v-model:value="form.donatedAt"
            class="supporter-date-picker"
            data-testid="supporter-donated-at"
            format="YYYY-MM-DD HH:mm:ss"
            show-time
            value-format="YYYY-MM-DD HH:mm:ss"
          />
        </FormItem>
      </div>

      <FormItem :label="$t('donationSettings.supporters.fields.message')">
        <Input.TextArea
          v-model:value="form.message"
          data-testid="supporter-message"
          :maxlength="255"
          :placeholder="$t('donationSettings.supporters.placeholders.message')"
          :rows="3"
          show-count
        />
      </FormItem>
    </Form>
  </Modal>
</template>

<style scoped>
.supporter-form-alert {
  margin-bottom: 16px;
}

.supporter-form-identity {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px;
  margin-bottom: 18px;
  background: hsl(var(--muted) / 40%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.supporter-form-identity strong,
.supporter-form-identity span {
  display: block;
}

.supporter-form-identity span {
  margin-top: 3px;
  font-size: 13px;
  font-weight: 700;
  color: hsl(var(--primary));
}

.supporter-form-row {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  gap: 14px;
}

.supporter-date-picker {
  width: 100%;
}

@media (max-width: 640px) {
  .supporter-form-row {
    grid-template-columns: 1fr;
    gap: 0;
  }
}
</style>
