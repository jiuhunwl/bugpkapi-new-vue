<script setup lang="ts">
import type { TicketApi } from '#/api/ticket';

import { computed, ref, shallowRef, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Input,
  Popover,
  RadioButton,
  RadioGroup,
  Select,
  Tooltip,
} from 'ant-design-vue';

import { $t } from '#/locales';

import TicketAttachmentImage from './TicketAttachmentImage.vue';

type ComposerMode = 'note' | 'reply';

interface Props {
  canManageQuickReplies: boolean;
  canUploadFiles?: boolean;
  canUploadImages: boolean;
  category: TicketApi.Category;
  closed: boolean;
  fileUploadLoading?: boolean;
  imageUploadLoading: boolean;
  images: TicketApi.Attachment[];
  isAdmin: boolean;
  language: 'en' | 'zh';
  loading: boolean;
  notePermitted: boolean;
  permitted: boolean;
  quickReplies: TicketApi.QuickReply[];
  quickRepliesLoading: boolean;
  ticketId: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  fileUpload: [files: File[]];
  imageRemove: [attachment: TicketApi.Attachment];
  imageUpload: [files: File[]];
  manageQuickReplies: [];
  submit: [mode: ComposerMode];
}>();
const content = defineModel<string>({ default: '' });
const mode = defineModel<ComposerMode>('mode', { default: 'reply' });

const selectedQuickReplyId = shallowRef<string>();
const imageInput = ref<HTMLInputElement>();
const fileInput = ref<HTMLInputElement>();

const emojis = [
  '😀',
  '😄',
  '😊',
  '😉',
  '😍',
  '🤔',
  '😂',
  '🙂',
  '😎',
  '😭',
  '😅',
  '😳',
  '😡',
  '😴',
  '🤗',
  '🤭',
  '👍',
  '👎',
  '🙏',
  '👏',
  '💪',
  '🎉',
  '✅',
  '❌',
  '⚠️',
  '📌',
  '🚀',
  '🔥',
  '💯',
  '❤️',
  '💔',
  '⭐',
];

const availableQuickReplies = computed(() =>
  props.quickReplies
    .filter(
      (item) =>
        item.status === 1 &&
        (item.category === props.category || item.category === 'GENERAL'),
    )
    .map((item) => ({ label: item.title, value: item.id })),
);

const currentPermitted = computed(() =>
  mode.value === 'note' ? props.notePermitted : props.permitted,
);

const disabledReason = computed(() => {
  if (props.closed) {
    return $t('ticket.composer.closed');
  }
  if (!currentPermitted.value) {
    return $t('ticket.composer.noPermission');
  }
  return '';
});

const placeholder = computed(() =>
  $t(
    mode.value === 'note'
      ? 'ticket.composer.notePlaceholder'
      : 'ticket.composer.placeholder',
  ),
);

const submitLabel = computed(() =>
  $t(
    mode.value === 'note' ? 'ticket.composer.addNote' : 'ticket.composer.send',
  ),
);

const canSubmit = computed(
  () =>
    !props.closed &&
    !props.loading &&
    !props.imageUploadLoading &&
    !props.fileUploadLoading &&
    currentPermitted.value &&
    (content.value.trim().length > 0 || props.images.length > 0),
);

const imageUploadEnabled = computed(
  () =>
    props.canUploadImages &&
    !props.closed &&
    !props.imageUploadLoading &&
    !props.fileUploadLoading &&
    currentPermitted.value,
);

const fileUploadEnabled = computed(
  () =>
    props.canUploadFiles &&
    !props.closed &&
    !props.imageUploadLoading &&
    !props.fileUploadLoading &&
    currentPermitted.value,
);

function selectImages() {
  if (imageUploadEnabled.value) {
    imageInput.value?.click();
  }
}

function handleImages(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  input.value = '';
  if (files.length > 0 && imageUploadEnabled.value) {
    emit('imageUpload', files);
  }
}

function selectFiles() {
  if (fileUploadEnabled.value) {
    fileInput.value?.click();
  }
}

function handleFiles(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  input.value = '';
  if (files.length > 0 && fileUploadEnabled.value) {
    emit('fileUpload', files);
  }
}

function appendEmoji(emoji: string) {
  if (!disabledReason.value) {
    content.value = `${content.value}${emoji}`;
  }
}

function applyQuickReply(value: unknown) {
  selectedQuickReplyId.value = typeof value === 'string' ? value : undefined;
  const item = props.quickReplies.find(
    (quickReply) => quickReply.id === selectedQuickReplyId.value,
  );
  if (!item) {
    return;
  }
  content.value = props.language === 'en' ? item.contentEn : item.contentZh;
}

function submit() {
  if (canSubmit.value) {
    emit('submit', mode.value);
  }
}

watch(
  () => props.notePermitted,
  (permitted) => {
    if (!permitted && mode.value === 'note') {
      mode.value = 'reply';
    }
  },
  { immediate: true },
);

watch([mode, () => props.category], () => {
  selectedQuickReplyId.value = undefined;
});
</script>

<template>
  <div
    class="ticket-composer"
    :class="{
      'is-disabled': !!disabledReason,
      'is-note': mode === 'note',
    }"
  >
    <div
      v-if="isAdmin && (notePermitted || canManageQuickReplies)"
      class="ticket-composer__toolbar"
    >
      <RadioGroup
        v-if="notePermitted"
        v-model:value="mode"
        button-style="solid"
        class="ticket-composer__tabs"
        size="small"
      >
        <RadioButton value="reply">
          {{ $t('ticket.composer.publicReply') }}
        </RadioButton>
        <RadioButton value="note">
          {{ $t('ticket.composer.internalNote') }}
        </RadioButton>
      </RadioGroup>
      <span v-else></span>

      <div class="ticket-composer__quick-actions">
        <Select
          v-if="availableQuickReplies.length > 0"
          :disabled="closed"
          :loading="quickRepliesLoading"
          :options="availableQuickReplies"
          :placeholder="$t('ticket.quickReplies.select')"
          :value="selectedQuickReplyId"
          allow-clear
          show-search
          option-filter-prop="label"
          @change="applyQuickReply"
        />
        <Tooltip
          v-if="canManageQuickReplies"
          :title="$t('ticket.quickReplies.manage')"
        >
          <Button
            :aria-label="$t('ticket.quickReplies.manage')"
            class="ticket-composer__tool"
            shape="circle"
            size="small"
            type="text"
            @click="emit('manageQuickReplies')"
          >
            <template #icon>
              <IconifyIcon icon="lucide:settings-2" />
            </template>
          </Button>
        </Tooltip>
      </div>
    </div>

    <div v-if="mode === 'note'" class="ticket-composer__note-hint">
      <IconifyIcon icon="lucide:shield-check" />
      {{ $t('ticket.composer.noteHint') }}
    </div>

    <div v-if="images.length > 0" class="ticket-composer__images">
      <div
        v-for="image in images"
        :key="image.id"
        class="ticket-composer__image"
      >
        <TicketAttachmentImage :attachment="image" :ticket-id="ticketId" />
        <Button
          :aria-label="$t('ticket.composer.removeImage')"
          class="ticket-composer__image-remove"
          danger
          shape="circle"
          size="small"
          type="text"
          @click="emit('imageRemove', image)"
        >
          <template #icon><IconifyIcon icon="lucide:x" /></template>
        </Button>
      </div>
    </div>

    <div class="ticket-composer__editor">
      <Input.TextArea
        v-model:value="content"
        :auto-size="{ maxRows: 5, minRows: 2 }"
        :disabled="!!disabledReason"
        :maxlength="4000"
        :placeholder="placeholder"
        show-count
        @keydown.ctrl.enter.prevent="submit"
        @keydown.meta.enter.prevent="submit"
      />
    </div>

    <div class="ticket-composer__footer">
      <div class="ticket-composer__footer-start">
        <div class="ticket-composer__tools">
          <Popover
            overlay-class-name="ticket-composer__emoji-popover"
            placement="topLeft"
            trigger="click"
          >
            <template #content>
              <div class="ticket-composer__emoji-grid">
                <button
                  v-for="emoji in emojis"
                  :key="emoji"
                  :aria-label="emoji"
                  class="ticket-composer__emoji"
                  type="button"
                  @click="appendEmoji(emoji)"
                >
                  {{ emoji }}
                </button>
              </div>
            </template>
            <Button
              :aria-label="$t('ticket.composer.emoji')"
              :disabled="!!disabledReason"
              :title="$t('ticket.composer.emoji')"
              class="ticket-composer__tool"
              type="text"
            >
              <template #icon>
                <svg
                  aria-hidden="true"
                  class="ticket-composer__emoji-icon"
                  fill="none"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.8"
                  viewBox="0 0 24 24"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M8.5 14.4s1.25 2.1 3.5 2.1 3.5-2.1 3.5-2.1" />
                  <path d="M9 9.2h.01M15 9.2h.01" />
                </svg>
              </template>
            </Button>
          </Popover>

          <Tooltip
            v-if="canUploadImages"
            :title="
              imageUploadEnabled
                ? $t('ticket.composer.addImage')
                : $t('ticket.composer.imageUnavailable')
            "
          >
            <Button
              :aria-label="$t('ticket.composer.addImage')"
              :disabled="!imageUploadEnabled"
              :loading="imageUploadLoading"
              class="ticket-composer__tool"
              type="text"
              @click="selectImages"
            >
              <template #icon>
                <IconifyIcon icon="lucide:image" />
              </template>
            </Button>
          </Tooltip>
          <input
            ref="imageInput"
            accept=".gif,.jpeg,.jpg,.png,.webp"
            class="ticket-composer__file-input"
            multiple
            type="file"
            @change="handleImages"
          />

          <Tooltip
            v-if="canUploadFiles"
            :title="
              fileUploadEnabled
                ? $t('ticket.composer.addFile')
                : $t('ticket.composer.fileUnavailable')
            "
          >
            <Button
              :aria-label="$t('ticket.composer.addFile')"
              :disabled="!fileUploadEnabled"
              :loading="fileUploadLoading"
              class="ticket-composer__tool"
              type="text"
              @click="selectFiles"
            >
              <template #icon><IconifyIcon icon="lucide:paperclip" /></template>
            </Button>
          </Tooltip>
          <input
            ref="fileInput"
            accept=".csv,.json,.log,.pdf,.txt,.zip"
            class="ticket-composer__file-input"
            multiple
            type="file"
            @change="handleFiles"
          />
        </div>

        <span class="ticket-composer__hint">
          <IconifyIcon
            :icon="disabledReason ? 'lucide:circle-slash-2' : 'lucide:keyboard'"
          />
          {{ disabledReason || $t('ticket.composer.shortcut') }}
        </span>
      </div>

      <Button
        :danger="mode === 'note'"
        :disabled="!canSubmit"
        :loading="loading"
        :type="mode === 'note' ? 'default' : 'primary'"
        class="ticket-composer__send"
        @click="submit"
      >
        <template #icon>
          <IconifyIcon
            :icon="
              mode === 'note' ? 'lucide:notebook-pen' : 'lucide:send-horizontal'
            "
          />
        </template>
        {{ submitLabel }}
      </Button>
    </div>
  </div>
</template>

<style scoped>
.ticket-composer {
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 10px 12px 12px;
  background: hsl(var(--muted) / 16%);
  border: 1px solid hsl(var(--border));
  border-radius: 16px;
}

.ticket-composer.is-disabled {
  opacity: 0.72;
}

.ticket-composer.is-note {
  background: hsl(var(--warning) / 5%);
  border-color: hsl(var(--warning) / 30%);
}

.ticket-composer__toolbar,
.ticket-composer__quick-actions,
.ticket-composer__footer,
.ticket-composer__footer-start,
.ticket-composer__note-hint,
.ticket-composer__hint,
.ticket-composer__tools {
  display: flex;
  align-items: center;
}

.ticket-composer__tabs {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 999px;
}

.ticket-composer__tabs :deep(.ant-radio-button-wrapper) {
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  background: transparent;
  border: 0;
  border-radius: 999px !important;
  box-shadow: none !important;
}

.ticket-composer__tabs :deep(.ant-radio-button-wrapper::before) {
  display: none;
}

.ticket-composer__tabs :deep(.ant-radio-button-wrapper-checked) {
  color: white;
  background: hsl(var(--primary));
  box-shadow: 0 3px 10px hsl(var(--primary) / 22%) !important;
}

.ticket-composer__tabs :deep(.ant-radio-button-wrapper:hover) {
  color: hsl(var(--primary));
}

.ticket-composer__images {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.ticket-composer__image {
  position: relative;
  width: 78px;
  height: 78px;
}

.ticket-composer__image :deep(.ticket-image) {
  width: 78px;
  height: 78px;
}

.ticket-composer__image :deep(.ticket-image a) {
  width: 100%;
  height: 100%;
}

.ticket-composer__image :deep(.ticket-image img) {
  width: 100%;
  height: 100%;
  max-height: none;
  object-fit: cover;
}

.ticket-composer__image-remove {
  position: absolute;
  top: -7px;
  right: -7px;
  background: hsl(var(--card)) !important;
  border: 1px solid hsl(var(--border));
}

.ticket-composer__editor {
  padding: 8px 11px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.ticket-composer__editor:focus-within {
  border-color: hsl(var(--primary) / 45%);
  box-shadow: 0 0 0 3px hsl(var(--primary) / 10%);
}

.ticket-composer__editor :deep(.ant-input) {
  padding: 0;
  font-size: 13.5px;
  line-height: 1.7;
  background: transparent;
  border: 0;
  box-shadow: none !important;
  resize: none;
}

.ticket-composer__editor :deep(.ant-input-data-count) {
  font-size: 10px;
  color: hsl(var(--muted-foreground));
}

.ticket-composer__emoji-icon {
  width: 18px;
  height: 18px;
}

.ticket-composer__file-input {
  display: none;
}

.ticket-composer__footer-start {
  flex: 1 1 auto;
  gap: 8px;
  min-width: 0;
}

.ticket-composer__tools {
  flex: 0 0 auto;
  gap: 2px;
}

.ticket-composer__tool {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  color: hsl(var(--muted-foreground));
  border-radius: 50%;
}

.ticket-composer__tool :deep(.ant-btn-icon) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 0;
}

.ticket-composer__tool:hover {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
}

.ticket-composer__tool svg {
  width: 17px;
  height: 17px;
}

.ticket-composer__toolbar {
  gap: 12px;
  justify-content: space-between;
}

.ticket-composer__quick-actions {
  gap: 4px;
  min-width: 0;
}

.ticket-composer__quick-actions :deep(.ant-select) {
  width: min(240px, 34vw);
}

.ticket-composer__quick-actions :deep(.ant-select-selector) {
  font-size: 12px;
  background: hsl(var(--card)) !important;
  border-color: hsl(var(--border)) !important;
  border-radius: 999px !important;
}

.ticket-composer__note-hint {
  gap: 6px;
  padding: 6px 10px;
  font-size: 11px;
  color: hsl(var(--warning));
  background: hsl(var(--warning) / 8%);
  border-radius: 8px;
}

.ticket-composer__footer {
  gap: 10px;
  justify-content: space-between;
}

.ticket-composer__hint {
  gap: 6px;
  min-width: 0;
  overflow: hidden;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ticket-composer__hint svg {
  flex: 0 0 auto;
  width: 13px;
  height: 13px;
}

.ticket-composer__send {
  flex: 0 0 auto;
  height: 36px;
  padding: 0 16px;
  font-weight: 600;
  border-radius: 999px;
  box-shadow: 0 4px 12px hsl(var(--primary) / 18%);
}

.ticket-composer.is-note .ticket-composer__send {
  box-shadow: none;
}

.ticket-composer__emoji-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 2px;
  width: 286px;
}

:global(.ticket-composer__emoji-popover .ant-popover-inner) {
  padding: 8px;
  background: hsl(var(--card)) !important;
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  box-shadow: 0 14px 36px hsl(var(--foreground) / 14%);
}

:global(.ticket-composer__emoji-popover .ant-popover-inner-content) {
  padding: 0;
  background: hsl(var(--card));
}

:global(.ticket-composer__emoji-popover .ant-popover-arrow) {
  background: hsl(var(--card)) !important;
}

:global(.ticket-composer__emoji-popover .ant-popover-arrow::before) {
  background: hsl(var(--card)) !important;
}

.ticket-composer__emoji {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  padding: 0;
  font-size: 18px;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 8px;
}

.ticket-composer__emoji:hover {
  background: hsl(var(--muted));
}

@media (max-width: 680px) {
  .ticket-composer__toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .ticket-composer__quick-actions :deep(.ant-select) {
    flex: 1;
    width: auto;
  }
}

@media (max-width: 520px) {
  .ticket-composer {
    padding: 8px;
  }

  .ticket-composer__footer {
    align-items: flex-end;
  }

  .ticket-composer__hint {
    max-width: 170px;
  }
}
</style>
