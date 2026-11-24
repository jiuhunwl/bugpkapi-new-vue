<script setup lang="ts">
import type { TicketApi } from '#/api/ticket';

import { computed } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { $t } from '#/locales';
const props = defineProps<{ loading: boolean; summary?: TicketApi.Summary; }>();
const items = computed(() => [
  { key: 'all', icon: 'lucide:inbox', value: props.summary?.all },
  {
    key: 'active',
    icon: 'lucide:clock-3',
    value: props.summary
      ? props.summary.open +
        props.summary.processing +
        props.summary.waitingUser
      : undefined,
  },
  {
    key: 'unread',
    icon: 'lucide:messages-square',
    value: props.summary?.unread,
  },
  {
    key: 'done',
    icon: 'lucide:circle-check',
    value: props.summary
      ? props.summary.resolved + props.summary.closed
      : undefined,
  },
]);
</script>
<template>
  <ul
    class="ticket-summary"
    :aria-label="$t('ticket.layout.summary')"
    :aria-busy="loading"
  >
    <li
      v-for="item in items"
      :key="item.key"
      :class="{ 'is-unread': item.key === 'unread' }"
    >
      <span class="ticket-summary__icon" aria-hidden="true">
        <IconifyIcon :icon="item.icon" />
      </span>
      <span class="ticket-summary__label">{{
        $t(`ticket.layout.${item.key}`)
      }}</span>
      <strong>{{
        loading || item.value === undefined ? '—' : item.value
      }}</strong>
    </li>
  </ul>
</template>
<style scoped>
.ticket-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  padding: 4px 0;
  margin: 0;
  overflow: hidden;
  list-style: none;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.ticket-summary li {
  display: flex;
  gap: 12px;
  align-items: center;
  min-width: 0;
  padding: 14px 22px;
}

.ticket-summary li + li {
  border-left: 1px solid hsl(var(--border));
}

.ticket-summary__icon {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 45%);
  border-radius: 10px;
}

.ticket-summary__icon svg {
  width: 17px;
  height: 17px;
}

.ticket-summary__label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.ticket-summary strong {
  flex: none;
  margin-left: auto;
  font-size: 22px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.25;
  color: hsl(var(--foreground));
}

.ticket-summary .is-unread strong {
  color: hsl(var(--primary));
}

.ticket-summary .is-unread .ticket-summary__icon {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
}

@media (max-width: 900px) {
  .ticket-summary li {
    flex-direction: column;
    gap: 6px;
    align-items: flex-start;
    padding: 12px 14px;
  }

  .ticket-summary strong {
    margin-left: 0;
    font-size: 19px;
  }
}

@media (max-width: 640px) {
  .ticket-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ticket-summary li:nth-child(odd) {
    border-left: 0;
  }

  .ticket-summary li:nth-child(n + 3) {
    border-top: 1px solid hsl(var(--border));
  }

  .ticket-summary li {
    flex-direction: row;
    align-items: center;
  }

  .ticket-summary__icon {
    width: 30px;
    height: 30px;
  }

  .ticket-summary strong {
    margin-left: auto;
    font-size: 18px;
  }
}
</style>
