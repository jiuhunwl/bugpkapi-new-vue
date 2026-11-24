<script setup lang="ts">
import type { TicketApi } from '#/api/ticket';

import { computed, inject, useTemplateRef } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Empty,
  message,
  Popconfirm,
  Spin,
  Tag,
  Tooltip,
} from 'ant-design-vue';

import { $t } from '#/locales';

import {
  formatAttachmentLimit,
  ticketAttachmentPolicyKey,
  validateAttachmentFile,
} from '../attachment-policy';

interface Props {
  attachments: TicketApi.Attachment[];
  canDelete: boolean;
  canUpload: boolean;
  currentUserId?: string;
  isAdmin: boolean;
  loading: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  delete: [attachment: TicketApi.Attachment];
  download: [attachment: TicketApi.Attachment];
  upload: [files: File[]];
}>();

const fileInput = useTemplateRef<HTMLInputElement>('fileInput');

const policyContext = inject(ticketAttachmentPolicyKey, undefined);
const policy = computed(() => policyContext?.state.value.policy);
const policyLoading = computed(
  () => policyContext?.state.value.loading ?? false,
);
const policyError = computed(() => policyContext?.state.value.error ?? true);
const uploadEnabled = computed(
  () =>
    props.canUpload &&
    !props.loading &&
    !policyLoading.value &&
    !policyError.value &&
    !!policy.value &&
    policy.value.maxBytes > 0 &&
    policy.value.allowedExtensions.length > 0,
);
const accept = computed(() => policy.value?.allowedExtensions.join(',') ?? '');
let selectionRevision: number | undefined;

function selectFiles() {
  if (!uploadEnabled.value) return;
  selectionRevision = policyContext?.state.value.revision;
  fileInput.value?.click();
}

function handleFiles(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  input.value = '';
  if (
    !uploadEnabled.value ||
    selectionRevision !== policyContext?.state.value.revision
  )
    return;
  selectionRevision = undefined;
  for (const file of files) {
    const error = validateAttachmentFile(file, policy.value);
    if (error) {
      message.error($t(error.key, error.params));
      return;
    }
  }
  if (files.length > 0) emit('upload', files);
}

function canDeleteAttachment(item: TicketApi.Attachment) {
  return (
    props.canDelete &&
    (props.isAdmin || item.uploaderId === props.currentUserId)
  );
}

function formatSize(value: number) {
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${value} B`;
}

function fileIcon(contentType: string) {
  if (contentType.startsWith('image/')) return 'lucide:image';
  if (contentType.includes('pdf')) return 'lucide:file-text';
  if (contentType.includes('zip')) return 'lucide:file-archive';
  return 'lucide:file';
}
</script>

<template>
  <section class="ticket-attachments">
    <header class="ticket-attachments__header">
      <div>
        <IconifyIcon icon="lucide:paperclip" />
        <strong>{{ $t('ticket.attachments.title') }}</strong>
        <Tag>{{ attachments.length }}</Tag>
      </div>
      <Button
        v-if="canUpload"
        :disabled="!uploadEnabled"
        :loading="loading"
        size="small"
        @click="selectFiles"
      >
        <template #icon><IconifyIcon icon="lucide:upload" /></template>
        {{ $t('ticket.attachments.upload') }}
      </Button>
      <input
        ref="fileInput"
        :accept="accept"
        :disabled="!uploadEnabled"
        class="ticket-attachments__input"
        multiple
        type="file"
        @change="handleFiles"
      />
    </header>

    <Spin :spinning="loading">
      <div v-if="attachments.length > 0" class="ticket-attachments__list">
        <article
          v-for="item in attachments"
          :key="item.id"
          class="ticket-attachment"
        >
          <span class="ticket-attachment__icon">
            <IconifyIcon :icon="fileIcon(item.contentType)" />
          </span>
          <button
            class="ticket-attachment__name"
            type="button"
            @click="emit('download', item)"
          >
            <strong>{{ item.originalName }}</strong>
            <small>{{ formatSize(item.sizeBytes) }} · {{ item.uploaderName }}</small>
          </button>
          <Tooltip :title="$t('ticket.attachments.download')">
            <Button
              shape="circle"
              size="small"
              type="text"
              @click="emit('download', item)"
            >
              <template #icon><IconifyIcon icon="lucide:download" /></template>
            </Button>
          </Tooltip>
          <Popconfirm
            v-if="canDeleteAttachment(item)"
            :ok-text="$t('common.confirm')"
            :cancel-text="$t('common.cancel')"
            :title="$t('ticket.attachments.deleteConfirm')"
            @confirm="emit('delete', item)"
          >
            <Button danger shape="circle" size="small" type="text">
              <template #icon><IconifyIcon icon="lucide:trash-2" /></template>
            </Button>
          </Popconfirm>
        </article>
      </div>
      <Empty
        v-else
        :description="$t('ticket.attachments.empty')"
        class="ticket-attachments__empty"
      />
    </Spin>
    <div class="ticket-attachments__hint" aria-live="polite">
      <p v-if="policyLoading" role="status">
        {{ $t('ticket.attachments.policyLoading') }}
      </p>
      <div v-else-if="policyError || !policy" role="alert">
        <p>{{ $t('ticket.attachments.policyUnavailable') }}</p>
        <Button
          v-if="policyContext"
          size="small"
          @click="policyContext.retry()"
        >
          {{ $t('ticket.attachments.retryPolicy') }}
        </Button>
      </div>
      <template v-else>
        <p>
          {{
            $t('ticket.attachments.hint', [
              formatAttachmentLimit(policy.maxBytes),
              policy.allowedExtensions.join(', ') ||
                $t('ticket.attachments.noTypes'),
            ])
          }}
        </p>
        <p
          v-if="policy.maxBytes === 0 || policy.allowedExtensions.length === 0"
          role="status"
        >
          {{ $t('ticket.attachments.uploadUnavailable') }}
        </p>
      </template>
    </div>
  </section>
</template>

<style scoped>
.ticket-attachments {
  padding: 14px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.ticket-attachments__header,
.ticket-attachments__header > div,
.ticket-attachment {
  display: flex;
  gap: 8px;
  align-items: center;
}

.ticket-attachments__header {
  justify-content: space-between;
  margin-bottom: 10px;
}

.ticket-attachments__header > div {
  min-width: 0;
}

.ticket-attachments__header svg {
  color: hsl(var(--primary));
}

.ticket-attachments__header :deep(.ant-tag) {
  margin: 0;
}

.ticket-attachments__input {
  display: none;
}

.ticket-attachments__list {
  display: grid;
  gap: 7px;
}

.ticket-attachment {
  padding: 8px 9px;
  border: 1px solid hsl(var(--border));
  border-radius: 9px;
}

.ticket-attachment__icon {
  display: inline-flex;
  flex: 0 0 30px;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
  border-radius: 8px;
}

.ticket-attachment__name {
  display: grid;
  flex: 1;
  gap: 1px;
  min-width: 0;
  padding: 0;
  color: inherit;
  text-align: left;
  cursor: pointer;
  background: none;
  border: 0;
}

.ticket-attachment__name strong,
.ticket-attachment__name small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ticket-attachment__name strong {
  font-size: 12px;
}

.ticket-attachment__name small {
  font-size: 10px;
  color: hsl(var(--muted-foreground));
}

.ticket-attachments__empty {
  padding: 20px 0;
}

.ticket-attachments__hint {
  margin: 9px 0 0;
  font-size: 10px;
  color: hsl(var(--muted-foreground));
}
</style>
