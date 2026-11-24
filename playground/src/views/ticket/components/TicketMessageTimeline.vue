<script setup lang="ts">
import type { TicketApi } from '#/api/ticket';

import { computed } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { Empty } from 'ant-design-vue';
import dayjs from 'dayjs';

import { $t } from '#/locales';

import TicketAttachmentImage from './TicketAttachmentImage.vue';
import TicketUserCard from './TicketUserCard.vue';

const props = defineProps<Props>();

/** 同一发送方在该时间窗内的连续消息合并展示，减少重复头像与署名。 */
const GROUP_WINDOW_MINUTES = 5;

interface Props {
  attachments: TicketApi.Attachment[];
  isAdmin: boolean;
  messages: TicketApi.Message[];
  ticketId: string;
}

function messageRole(message: TicketApi.Message): string {
  if (message.internalNote) {
    return $t('ticket.messages.internalNote');
  }
  return message.senderType === 'STAFF'
    ? $t('ticket.messages.staff')
    : $t('ticket.messages.user');
}

function messageBadgeIcon(message: TicketApi.Message): string {
  if (message.internalNote) {
    return 'lucide:notebook-pen';
  }
  return message.senderType === 'STAFF'
    ? 'lucide:headset'
    : 'lucide:user-round';
}

function avatarText(value: string) {
  const chars = Array.from(value.trim());
  if (chars.length === 0) {
    return '?';
  }
  return /^\d/.test(chars[0]!)
    ? chars.slice(0, 2).join('')
    : (chars[0]?.toUpperCase() ?? '?');
}

function avatarHue(value: string) {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 360;
  }
  return hash;
}

function dividerLabel(created: dayjs.Dayjs) {
  return created.isSame(dayjs(), 'day')
    ? created.format('HH:mm')
    : created.format('MM-DD HH:mm');
}

const timelineItems = computed(() =>
  props.messages.map((message, index) => {
    const created = dayjs(message.createdAt);
    const prev = props.messages[index - 1];
    const prevCreated = prev ? dayjs(prev.createdAt) : undefined;
    const gapMinutes = prevCreated ? created.diff(prevCreated, 'minute') : 0;
    const sameDay = prevCreated ? created.isSame(prevCreated, 'day') : true;
    const showDivider =
      !prevCreated || !sameDay || gapMinutes >= GROUP_WINDOW_MINUTES;
    const grouped =
      !!prev &&
      !showDivider &&
      prev.senderType === message.senderType &&
      prev.internalNote === message.internalNote;
    const ownSide = props.isAdmin
      ? message.senderType === 'STAFF'
      : message.senderType === 'USER';
    const attachments = props.attachments.filter(
      (attachment) => attachment.messageId === message.id,
    );
    const isStaff = message.senderType === 'STAFF';
    const displayName = message.senderName || messageRole(message);

    return {
      ...message,
      attachments,
      avatarStyle:
        !isStaff && !message.internalNote
          ? {
              background: `hsl(${avatarHue(message.senderId || displayName)} 62% 52%)`,
            }
          : undefined,
      avatarText: avatarText(displayName),
      badgeIcon: messageBadgeIcon(message),
      dividerLabel: showDivider ? dividerLabel(created) : '',
      files: attachments.filter(
        (item) => !item.contentType.startsWith('image/'),
      ),
      fullTime: created.format('YYYY-MM-DD HH:mm:ss'),
      grouped,
      images: attachments.filter((item) =>
        item.contentType.startsWith('image/'),
      ),
      label: messageRole(message),
      ownSide,
      showDivider,
      time: created.format('HH:mm'),
    };
  }),
);
</script>

<template>
  <div class="message-thread">
    <Empty
      v-if="timelineItems.length === 0"
      :description="$t('ticket.messages.empty')"
      class="message-thread__empty"
    />
    <ol v-else class="message-thread__list">
      <template v-for="item in timelineItems" :key="item.id">
        <li
          v-if="item.showDivider"
          class="message-thread__divider"
          role="separator"
        >
          <span>{{ item.dividerLabel }}</span>
        </li>
        <li
          class="message-thread__item"
          :class="{
            'is-internal': item.internalNote,
            'is-own': item.ownSide,
            'is-grouped': item.grouped,
          }"
        >
          <TicketUserCard
            :enabled="isAdmin && !item.internalNote"
            :fallback-name="item.senderName || item.label"
            :user-id="item.senderId"
          >
            <span
              :aria-label="item.senderName || item.label"
              :style="item.avatarStyle"
              :title="
                isAdmin && !item.internalNote
                  ? $t('ticket.userCard.clickHint')
                  : undefined
              "
              class="message-thread__avatar"
              :class="{
                'is-internal': item.internalNote,
                'is-staff': item.senderType === 'STAFF',
                'is-clickable': isAdmin && !item.internalNote,
              }"
              role="img"
            >
              <b>{{ item.avatarText }}</b>
              <em
                v-if="item.senderType === 'STAFF' || item.internalNote"
                aria-hidden="true"
                class="message-thread__avatar-badge"
              >
                <IconifyIcon :icon="item.badgeIcon" />
              </em>
              <i
                v-else
                aria-hidden="true"
                class="message-thread__avatar-online"
              />
            </span>
          </TicketUserCard>
          <div class="message-thread__bubble">
            <div v-if="!item.grouped" class="message-thread__meta">
              <strong>{{ item.senderName || item.label }}</strong>
              <span class="message-thread__role">{{ item.label }}</span>
            </div>
            <div
              class="message-thread__body"
              :class="{ 'is-media-only': !item.content }"
            >
              <p v-if="item.content" class="message-thread__content">
                {{ item.content }}
              </p>
              <div v-if="item.images.length > 0" class="message-thread__images">
                <TicketAttachmentImage
                  v-for="image in item.images"
                  :key="image.id"
                  :attachment="image"
                  :ticket-id="ticketId"
                />
              </div>
              <div v-if="item.files.length > 0" class="message-thread__files">
                <span
                  v-for="file in item.files"
                  :key="file.id"
                  class="message-thread__file"
                  :title="file.originalName"
                >
                  <span class="message-thread__file-icon">
                    <IconifyIcon icon="lucide:file-text" />
                  </span>
                  <span class="message-thread__file-name">
                    {{ file.originalName }}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </li>
      </template>
    </ol>
  </div>
</template>

<style scoped>
.message-thread {
  min-height: 150px;
}

.message-thread__empty {
  padding: 48px 0;
}

.message-thread__list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 960px;
  padding: 0;
  margin: 0 auto;
  list-style: none;
}

.message-thread__divider {
  display: flex;
  align-items: center;
  align-self: center;
  justify-content: center;
  padding-top: 2px;
}

.message-thread__divider span {
  padding: 3px 11px;
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--card) / 70%);
  border: 1px solid hsl(var(--border) / 70%);
  border-radius: 999px;
}

.message-thread__item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  width: 100%;
}

.message-thread__item.is-own {
  flex-direction: row-reverse;
}

.message-thread__item.is-grouped {
  margin-top: -6px;
}

.message-thread__avatar {
  position: relative;
  display: grid;
  flex: 0 0 34px;
  place-items: center;
  width: 34px;
  height: 34px;
  margin-top: 18px;
  color: white;
  background: hsl(var(--primary));
  border: 2px solid hsl(var(--card));
  border-radius: 50%;
  box-shadow: 0 3px 10px hsl(var(--primary) / 18%);
  transition:
    box-shadow 160ms ease,
    transform 160ms ease;
}

.message-thread__avatar.is-clickable {
  cursor: pointer;
}

.message-thread__avatar.is-clickable:hover,
.message-thread__avatar.is-clickable:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px hsl(var(--primary) / 22%);
  transform: translateY(-1px);
}

.message-thread__avatar b {
  font-size: 12.5px;
  font-weight: 700;
  line-height: 1;
}

.message-thread__avatar-badge {
  position: absolute;
  right: -4px;
  bottom: -3px;
  display: grid;
  place-items: center;
  width: 17px;
  height: 17px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 50%;
}

.message-thread__avatar-badge svg {
  width: 10px;
  height: 10px;
}

.message-thread__avatar-online {
  position: absolute;
  right: -2px;
  bottom: -1px;
  width: 9px;
  height: 9px;
  background: hsl(var(--success));
  border: 2px solid hsl(var(--card));
  border-radius: 50%;
}

.message-thread__avatar.is-internal {
  background: hsl(var(--warning));
  box-shadow: 0 3px 10px hsl(var(--warning) / 20%);
}

.message-thread__avatar.is-internal .message-thread__avatar-badge {
  color: hsl(var(--warning));
  border-color: hsl(var(--warning) / 30%);
}

.message-thread__item.is-grouped .message-thread__avatar {
  visibility: hidden;
}

.message-thread__bubble {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
  max-width: min(76%, 68ch);
}

.message-thread__item.is-own .message-thread__bubble {
  align-items: flex-end;
}

.message-thread__meta {
  display: flex;
  gap: 6px;
  align-items: center;
  min-width: 0;
  padding: 0 4px;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
}

.message-thread__item.is-own .message-thread__meta {
  flex-direction: row-reverse;
}

.message-thread__meta strong {
  max-width: 14em;
  overflow: hidden;
  font-weight: 600;
  color: hsl(var(--foreground));
  text-overflow: ellipsis;
  white-space: nowrap;
}

.message-thread__role {
  flex: 0 0 auto;
  padding: 1px 6px;
  font-size: 9.5px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
  border-radius: 999px;
}

.message-thread__body {
  position: relative;
  width: fit-content;
  max-width: 100%;
  padding: 9px 13px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 16px 16px 16px 6px;
  box-shadow: 0 2px 8px hsl(var(--foreground) / 4%);
}

.message-thread__body::before {
  position: absolute;
  top: 13px;
  left: -6px;
  width: 0;
  height: 0;
  content: '';
  border-top: 5px solid transparent;
  border-right: 6px solid hsl(var(--card));
  border-bottom: 5px solid transparent;
}

.message-thread__item.is-own .message-thread__body {
  background: hsl(var(--primary) / 11%);
  border-color: hsl(var(--primary) / 23%);
  border-radius: 16px 16px 6px;
}

.message-thread__item.is-own .message-thread__body::before {
  right: -6px;
  left: auto;
  border-right: 0;
  border-left: 6px solid hsl(var(--primary) / 11%);
}

.message-thread__item.is-grouped .message-thread__body {
  border-radius: 16px;
}

.message-thread__item.is-grouped .message-thread__body::before {
  display: none;
}

.message-thread__body.is-media-only {
  padding: 5px;
}

.message-thread__content {
  padding: 0;
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: hsl(var(--foreground));
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.message-thread__images {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 6px;
  width: min(420px, 100%);
}

.message-thread__images :deep(.ticket-image) {
  border-color: hsl(var(--border) / 70%);
  border-radius: 11px;
}

.message-thread__files {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 180px;
}

.message-thread__file {
  display: flex;
  gap: 8px;
  align-items: center;
  max-width: 100%;
  padding: 5px 8px 5px 5px;
  overflow: hidden;
  font-size: 12px;
  color: hsl(var(--foreground));
  background: hsl(var(--muted) / 45%);
  border: 1px solid hsl(var(--border) / 70%);
  border-radius: 9px;
}

.message-thread__file-icon {
  display: grid;
  flex: 0 0 26px;
  place-items: center;
  width: 26px;
  height: 26px;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
  border-radius: 7px;
}

.message-thread__file-icon svg {
  width: 14px;
  height: 14px;
}

.message-thread__file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.message-thread__item.is-internal .message-thread__meta strong,
.message-thread__item.is-internal .message-thread__role {
  color: hsl(var(--warning));
}

.message-thread__item.is-internal .message-thread__role {
  background: hsl(var(--warning) / 10%);
}

.message-thread__item.is-internal .message-thread__body {
  background: hsl(var(--warning) / 7%);
  border: 1px dashed hsl(var(--warning) / 38%);
}

.message-thread__item.is-internal .message-thread__body::before {
  border-right-color: hsl(var(--warning) / 7%);
}

.message-thread__item.is-internal.is-own .message-thread__body {
  border: 1px dashed hsl(var(--warning) / 38%);
}

.message-thread__item.is-internal.is-own .message-thread__body::before {
  border-right: 0;
  border-left: 6px solid hsl(var(--warning) / 7%);
}

@media (max-width: 640px) {
  .message-thread__list {
    gap: 11px;
  }

  .message-thread__item {
    gap: 7px;
  }

  .message-thread__avatar {
    flex-basis: 30px;
    width: 30px;
    height: 30px;
    margin-top: 16px;
  }

  .message-thread__avatar b {
    font-size: 11.5px;
  }

  .message-thread__avatar-badge {
    width: 14px;
    height: 14px;
  }

  .message-thread__bubble {
    max-width: calc(100% - 37px);
  }

  .message-thread__body {
    padding: 8px 11px;
  }

  .message-thread__content {
    font-size: 13px;
  }
}
</style>
