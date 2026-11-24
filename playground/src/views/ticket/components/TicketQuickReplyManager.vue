<script setup lang="ts">
import type { TicketApi } from '#/api/ticket';

import { computed, reactive, shallowRef, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Switch, Tag } from 'ant-design-vue';

import { $t } from '#/locales';

interface Props {
  quickReplies: TicketApi.QuickReply[];
  saving: boolean;
}

defineProps<Props>();
const emit = defineEmits<{
  delete: [id: string];
  save: [id: string | undefined, payload: TicketApi.SaveQuickReplyRequest];
}>();
const open = defineModel<boolean>('open', { default: false });

const selectedId = shallowRef<string>();
const form = reactive<TicketApi.SaveQuickReplyRequest>({
  category: 'GENERAL',
  contentEn: '',
  contentZh: '',
  sortNo: 0,
  status: 1,
  title: '',
});

const categoryOptions = computed(() =>
  (['GENERAL', 'API', 'BILLING', 'ACCOUNT', 'BUG', 'OTHER'] as const).map(
    (value) => ({ label: $t(`ticket.category.${value}`), value }),
  ),
);

const canSave = computed(
  () =>
    form.title.trim().length > 0 &&
    form.contentZh.trim().length > 0 &&
    form.contentEn.trim().length > 0,
);

function edit(item: TicketApi.QuickReply) {
  selectedId.value = item.id;
  form.title = item.title;
  form.contentZh = item.contentZh;
  form.contentEn = item.contentEn;
  form.category = item.category;
  form.sortNo = item.sortNo;
  form.status = item.status;
}

function reset() {
  selectedId.value = undefined;
  form.title = '';
  form.contentZh = '';
  form.contentEn = '';
  form.category = 'GENERAL';
  form.sortNo = 0;
  form.status = 1;
}

function save() {
  if (!canSave.value) return;
  emit('save', selectedId.value, {
    category: form.category,
    contentEn: form.contentEn.trim(),
    contentZh: form.contentZh.trim(),
    sortNo: form.sortNo,
    status: form.status,
    title: form.title.trim(),
  });
}

function changeEnabled(checked: unknown) {
  form.status = checked === true ? 1 : 0;
}

watch(open, (visible) => {
  if (!visible) reset();
});
</script>

<template>
  <Modal
    v-model:open="open"
    :footer="null"
    :title="$t('ticket.quickReplies.manageTitle')"
    :width="920"
    destroy-on-close
  >
    <div class="quick-reply-manager">
      <section class="quick-reply-manager__list">
        <header>
          <strong>{{ $t('ticket.quickReplies.templates') }}</strong>
          <Button size="small" @click="reset">
            <template #icon><IconifyIcon icon="lucide:plus" /></template>
            {{ $t('ticket.quickReplies.new') }}
          </Button>
        </header>
        <button
          v-for="item in quickReplies"
          :key="item.id"
          class="quick-reply-item"
          :class="{ 'is-selected': selectedId === item.id }"
          type="button"
          @click="edit(item)"
        >
          <span>
            <strong>{{ item.title }}</strong>
            <small>{{ $t(`ticket.category.${item.category}`) }}</small>
          </span>
          <Tag :color="item.status === 1 ? 'green' : 'default'">
            {{ item.status === 1 ? $t('common.enabled') : $t('common.disabled') }}
          </Tag>
        </button>
      </section>

      <Form class="quick-reply-manager__form" layout="vertical">
        <Form.Item :label="$t('ticket.quickReplies.title')" required>
          <Input v-model:value="form.title" :maxlength="80" show-count />
        </Form.Item>
        <div class="quick-reply-manager__row">
          <Form.Item :label="$t('ticket.quickReplies.category')">
            <Select v-model:value="form.category" :options="categoryOptions" />
          </Form.Item>
          <Form.Item :label="$t('ticket.quickReplies.sortNo')">
            <InputNumber v-model:value="form.sortNo" :min="0" :max="10000" />
          </Form.Item>
          <Form.Item :label="$t('ticket.quickReplies.enabled')">
            <Switch
              :checked="form.status === 1"
              @change="changeEnabled"
            />
          </Form.Item>
        </div>
        <Form.Item :label="$t('ticket.quickReplies.contentZh')" required>
          <Input.TextArea v-model:value="form.contentZh" :maxlength="4000" :rows="5" show-count />
        </Form.Item>
        <Form.Item :label="$t('ticket.quickReplies.contentEn')" required>
          <Input.TextArea v-model:value="form.contentEn" :maxlength="4000" :rows="5" show-count />
        </Form.Item>
        <footer>
          <Popconfirm
            v-if="selectedId"
            :title="$t('ticket.quickReplies.deleteConfirm')"
            @confirm="emit('delete', selectedId)"
          >
            <Button danger>{{ $t('common.delete') }}</Button>
          </Popconfirm>
          <span></span>
          <Button :disabled="!canSave" :loading="saving" type="primary" @click="save">
            {{ $t('ticket.quickReplies.save') }}
          </Button>
        </footer>
      </Form>
    </div>
  </Modal>
</template>

<style scoped>
.quick-reply-manager { display: grid; grid-template-columns: 290px minmax(0, 1fr); gap: 18px; min-height: 540px; }

.quick-reply-manager__list { padding-right: 14px; overflow: auto; border-right: 1px solid hsl(var(--border)); }

.quick-reply-manager__list header,
.quick-reply-manager__form footer { display: flex; gap: 10px; align-items: center; justify-content: space-between; }

.quick-reply-manager__list header { margin-bottom: 10px; }

.quick-reply-item { display: flex; gap: 8px; align-items: center; justify-content: space-between; width: 100%; padding: 10px; margin-bottom: 7px; color: inherit; text-align: left; cursor: pointer; background: hsl(var(--background)); border: 1px solid hsl(var(--border)); border-radius: 10px; }

.quick-reply-item.is-selected { background: hsl(var(--primary) / 6%); border-color: hsl(var(--primary) / 45%); }

.quick-reply-item > span { display: grid; min-width: 0; }

.quick-reply-item strong,
.quick-reply-item small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.quick-reply-item small { color: hsl(var(--muted-foreground)); }

.quick-reply-manager__row { display: grid; grid-template-columns: 1fr 120px 100px; gap: 10px; }

.quick-reply-manager__row :deep(.ant-select),
.quick-reply-manager__row :deep(.ant-input-number) { width: 100%; }

.quick-reply-manager__form footer span { flex: 1; }

@media (max-width: 760px) { .quick-reply-manager { grid-template-columns: 1fr; }

 .quick-reply-manager__list { max-height: 220px; padding-right: 0; border-right: 0; border-bottom: 1px solid hsl(var(--border)); }

 .quick-reply-manager__row { grid-template-columns: 1fr; } }
</style>
