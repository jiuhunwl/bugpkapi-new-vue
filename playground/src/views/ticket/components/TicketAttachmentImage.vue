<script setup lang="ts">
import type { TicketApi } from '#/api/ticket';

import { onBeforeUnmount, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { downloadTicketAttachment } from '#/api/ticket';
import { $t } from '#/locales';

interface Props {
  attachment: TicketApi.Attachment;
  ticketId: string;
}

const props = defineProps<Props>();

const imageURL = ref(props.attachment.url || '');
const loading = ref(false);
const failed = ref(false);
let objectURL = '';
let requestRevision = 0;

function releaseObjectURL() {
  if (objectURL) {
    URL.revokeObjectURL(objectURL);
    objectURL = '';
  }
}

async function loadLocalImage() {
  releaseObjectURL();
  failed.value = false;
  if (props.attachment.url) {
    imageURL.value = props.attachment.url;
    return;
  }
  if (!props.ticketId || !props.attachment.id) {
    imageURL.value = '';
    return;
  }
  const revision = ++requestRevision;
  loading.value = true;
  try {
    const blob = await downloadTicketAttachment(
      props.ticketId,
      props.attachment.id,
    );
    if (revision !== requestRevision) return;
    objectURL = URL.createObjectURL(blob);
    imageURL.value = objectURL;
  } catch {
    if (revision === requestRevision) {
      imageURL.value = '';
      failed.value = true;
    }
  } finally {
    if (revision === requestRevision) loading.value = false;
  }
}

watch(
  () => [props.ticketId, props.attachment.id, props.attachment.url] as const,
  () => void loadLocalImage(),
  { immediate: true },
);

onBeforeUnmount(() => {
  requestRevision++;
  releaseObjectURL();
});
</script>

<template>
  <span class="ticket-image" :class="{ 'is-loading': loading }">
    <a
      v-if="imageURL"
      :href="imageURL"
      :title="attachment.originalName"
      rel="noopener noreferrer"
      target="_blank"
    >
      <img
        :alt="attachment.originalName"
        :src="imageURL"
        loading="lazy"
        referrerpolicy="no-referrer"
        @error="
          failed = true;
          imageURL = '';
        "
      />
    </a>
    <span v-else class="ticket-image__state">
      <IconifyIcon
        :icon="failed ? 'lucide:image-off' : 'lucide:image'"
        aria-hidden="true"
      />
      <small>{{ failed ? $t('ticket.attachments.imageLoadFailed') : '…' }}</small>
    </span>
  </span>
</template>

<style scoped>
.ticket-image {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 72px;
  min-height: 72px;
  overflow: hidden;
  background: hsl(var(--muted) / 40%);
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
}

.ticket-image.is-loading {
  opacity: 0.72;
}

.ticket-image a {
  display: block;
  width: 100%;
}

.ticket-image img {
  display: block;
  width: 100%;
  max-height: 220px;
  object-fit: contain;
}

.ticket-image__state {
  display: grid;
  gap: 4px;
  place-items: center;
  padding: 10px;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
}

.ticket-image__state svg {
  width: 20px;
  height: 20px;
}
</style>
