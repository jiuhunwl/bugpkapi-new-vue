<script setup lang="ts">
import type { TicketApi } from '#/api/ticket';

import { computed, reactive, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';
import { i18n } from '@vben/locales';

import { Form, Input, Modal, Select } from 'ant-design-vue';

import { $t } from '#/locales';

interface Props {
  saving: boolean;
}

defineProps<Props>();
const emit = defineEmits<{ submit: [payload: TicketApi.CreateRequest] }>();
const open = defineModel<boolean>('open', { default: false });

const form = reactive<TicketApi.CreateRequest>({
  category: 'GENERAL',
  content: '',
  language: currentLanguage(),
  priority: 'NORMAL',
  subject: '',
});

const categoryOptions = computed(() =>
  (['GENERAL', 'API', 'BILLING', 'ACCOUNT', 'BUG', 'OTHER'] as const).map(
    (value) => ({ label: $t(`ticket.category.${value}`), value }),
  ),
);

const priorityOptions = computed(() =>
  (['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const).map((value) => ({
    label: $t(`ticket.priority.${value}`),
    value,
  })),
);

const canSubmit = computed(
  () => form.subject.trim().length > 0 && form.content.trim().length > 0,
);

function submit() {
  if (!canSubmit.value) {
    return;
  }
  emit('submit', {
    category: form.category,
    content: form.content.trim(),
    language: currentLanguage(),
    priority: form.priority,
    subject: form.subject.trim(),
  });
}

function reset() {
  form.subject = '';
  form.content = '';
  form.category = 'GENERAL';
  form.language = currentLanguage();
  form.priority = 'NORMAL';
}

watch(open, (visible) => {
  if (!visible) {
    reset();
  }
});

function currentLanguage(): 'en' | 'zh' {
  return String(i18n.global.locale.value || '').toLowerCase().startsWith('en')
    ? 'en'
    : 'zh';
}
</script>

<template>
  <Modal
    v-model:open="open"
    :confirm-loading="saving"
    :ok-button-props="{ disabled: !canSubmit }"
    :ok-text="$t('ticket.create.submit')"
    :title="$t('ticket.create.title')"
    :width="620"
    destroy-on-close
    @ok="submit"
  >
    <div class="create-ticket-intro">
      <span class="create-ticket-intro__icon">
        <IconifyIcon icon="lucide:messages-square" />
      </span>
      <p>{{ $t('ticket.create.description') }}</p>
    </div>
    <Form :model="form" layout="vertical" class="create-ticket-form">
      <Form.Item :label="$t('ticket.create.subject')" required>
        <Input
          v-model:value="form.subject"
          :maxlength="128"
          :placeholder="$t('ticket.create.subjectPlaceholder')"
          show-count
        />
      </Form.Item>
      <div class="create-ticket-form__row">
        <Form.Item :label="$t('ticket.create.category')">
          <Select
            v-model:value="form.category"
            :options="categoryOptions"
          />
        </Form.Item>
        <Form.Item :label="$t('ticket.create.priority')">
          <Select
            v-model:value="form.priority"
            :options="priorityOptions"
          />
        </Form.Item>
      </div>
      <Form.Item :label="$t('ticket.create.content')" required>
        <Input.TextArea
          v-model:value="form.content"
          :maxlength="4000"
          :placeholder="$t('ticket.create.contentPlaceholder')"
          :rows="8"
          show-count
        />
      </Form.Item>
    </Form>
  </Modal>
</template>

<style scoped>
.create-ticket-intro {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 13px 14px;
  margin-bottom: 18px;
  background: hsl(var(--primary) / 6%);
  border: 1px solid hsl(var(--primary) / 14%);
  border-radius: 12px;
}

.create-ticket-intro__icon {
  display: inline-flex;
  flex: 0 0 36px;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
  border-radius: 10px;
}

.create-ticket-intro__icon svg {
  width: 18px;
  height: 18px;
}

.create-ticket-intro p {
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  color: hsl(var(--muted-foreground));
}

.create-ticket-form__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.create-ticket-form__row :deep(.ant-select) {
  width: 100%;
}

@media (max-width: 560px) {
  .create-ticket-form__row {
    grid-template-columns: 1fr;
    gap: 0;
  }
}
</style>
