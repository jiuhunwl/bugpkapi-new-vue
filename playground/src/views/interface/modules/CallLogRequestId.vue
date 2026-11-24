<script setup lang="ts">
import { IconifyIcon } from '@vben/icons';
import { Button, message, Tooltip } from 'ant-design-vue';
import { $t } from '#/locales';
import { copyText } from '#/utils/copy-text';

defineProps<{ id?: string }>();
async function copy(id: string) {
  try {
    await copyText(id);
    message.success($t('system.interface.requestIdCopied'));
  } catch {
    message.error($t('system.interface.requestIdCopyFailed'));
  }
}
</script>

<template>
  <span
    v-if="id"
    class="inline-flex max-w-full items-center gap-1"
    data-testid="call-log-request-id"
  >
    <code class="min-w-0 select-text break-all text-xs" :title="id">{{
      id
    }}</code>
    <Tooltip :title="$t('system.interface.copyRequestId')">
      <Button
        type="text"
        size="small"
        class="shrink-0"
        :aria-label="$t('system.interface.copyRequestId')"
        @click.stop="copy(id)"
      >
        <template #icon
          ><IconifyIcon icon="lucide:copy" class="size-3.5"
        /></template>
      </Button>
    </Tooltip>
  </span>
  <span v-else class="text-muted-foreground">—</span>
</template>
