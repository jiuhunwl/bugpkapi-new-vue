<script setup lang="ts">
import type { TicketApi } from '#/api/ticket';

import { computed } from 'vue';

import { IconifyIcon } from '@vben/icons';

import dayjs from 'dayjs';

import { $t } from '#/locales';

interface Props {
  activities: TicketApi.Activity[];
}

const props = defineProps<Props>();

const items = computed(() =>
  [...props.activities].reverse().map((item) => ({
    ...item,
    icon: activityIcon(item.action),
    label: $t(`ticket.activity.actions.${item.action}`),
    time: dayjs(item.createdAt).format('MM-DD HH:mm'),
  })),
);

function activityIcon(action: string) {
  const icons: Record<string, string> = {
    ASSIGNED: 'lucide:user-round-check',
    ATTACHMENT_ADDED: 'lucide:paperclip',
    ATTACHMENT_REMOVED: 'lucide:paperclip-off',
    CLOSED: 'lucide:archive',
    CREATED: 'lucide:circle-plus',
    INTERNAL_NOTE_ADDED: 'lucide:notebook-pen',
    REPLIED: 'lucide:message-circle-reply',
    STATUS_CHANGED: 'lucide:git-compare-arrows',
    TAGS_UPDATED: 'lucide:tags',
  };
  return icons[action] ?? 'lucide:activity';
}
</script>

<template>
  <section v-if="items.length > 0" class="ticket-activity">
    <header>
      <IconifyIcon icon="lucide:history" />
      <strong>{{ $t('ticket.activity.title') }}</strong>
    </header>
    <ol>
      <li v-for="item in items" :key="item.id">
        <span><IconifyIcon :icon="item.icon" /></span>
        <div>
          <strong>{{ item.label }}</strong>
          <small>{{ item.actorName }} · {{ item.time }}</small>
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.ticket-activity {
  padding: 14px;
  background: hsl(var(--muted) / 22%);
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.ticket-activity header,
.ticket-activity li {
  display: flex;
  gap: 8px;
  align-items: center;
}

.ticket-activity header { margin-bottom: 10px; }

.ticket-activity header svg { color: hsl(var(--primary)); }

.ticket-activity ol { display: grid; gap: 8px; padding: 0; margin: 0; list-style: none; }

.ticket-activity li > span { display: inline-flex; color: hsl(var(--muted-foreground)); }

.ticket-activity li div { display: grid; gap: 1px; min-width: 0; }

.ticket-activity li strong { font-size: 11px; }

.ticket-activity li small { font-size: 10px; color: hsl(var(--muted-foreground)); }
</style>
