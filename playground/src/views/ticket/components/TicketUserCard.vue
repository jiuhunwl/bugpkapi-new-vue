<script lang="ts" setup>
import type { TicketApi } from '#/api/ticket';

import { computed, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { Avatar, Popover, Spin, Tag } from 'ant-design-vue';

import { getTicketUserProfile } from '#/api/ticket';
import { formatSettlementPrice } from '#/composables/use-settlement-currency';
import { $t } from '#/locales';

interface Props {
  enabled?: boolean;
  fallbackName?: string;
  userId: string;
}

const props = withDefaults(defineProps<Props>(), {
  enabled: true,
  fallbackName: '',
});

const open = ref(false);
const loading = ref(false);
const error = ref('');
const profile = ref<TicketApi.UserProfile>();
const loadedId = ref('');

watch(
  () => props.userId,
  () => {
    profile.value = undefined;
    loadedId.value = '';
    error.value = '';
    loading.value = false;
  },
);

watch(open, (value) => {
  if (value) {
    void loadProfile();
  }
});

async function loadProfile() {
  if (!props.userId || loadedId.value === props.userId) return;
  const requestedId = props.userId;
  loading.value = true;
  error.value = '';
  try {
    const result = await getTicketUserProfile(requestedId);
    if (requestedId !== props.userId) return;
    profile.value = result;
    loadedId.value = requestedId;
  } catch {
    if (requestedId === props.userId) {
      error.value = $t('ticket.errors.userDetailFailed');
    }
  } finally {
    if (requestedId === props.userId) {
      loading.value = false;
    }
  }
}

const displayName = computed(
  () =>
    profile.value?.displayName ||
    profile.value?.username ||
    props.fallbackName ||
    `#${props.userId}`,
);

const initial = computed(() => {
  const chars = Array.from(displayName.value.trim());
  if (chars.length === 0) return '?';
  return /^\d/.test(chars[0]!)
    ? chars.slice(0, 2).join('')
    : (chars[0]?.toUpperCase() ?? '?');
});

const avatarStyle = computed(() => {
  let hash = 0;
  for (const char of displayName.value) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 360;
  }
  return { background: `hsl(${hash} 58% 48%)` };
});

function maskDash(value?: string) {
  return value?.trim() ? value : '-';
}
</script>

<template>
  <Popover
    v-if="enabled"
    v-model:open="open"
    overlay-class-name="ticket-user-card-popover"
    placement="rightTop"
    trigger="click"
  >
    <template #content>
      <div class="ticket-user-card" data-testid="ticket-user-card">
        <Spin :spinning="loading" size="small">
          <template v-if="profile">
            <header class="ticket-user-card__head">
              <Avatar
                :size="50"
                :src="profile.avatar || undefined"
                :style="avatarStyle"
                class="ticket-user-card__avatar"
              >
                {{ initial }}
              </Avatar>
              <div class="ticket-user-card__identity">
                <div class="ticket-user-card__name-line">
                  <strong>{{ displayName }}</strong>
                  <Tag
                    :color="profile.status === 1 ? 'success' : 'error'"
                    class="ticket-user-card__status"
                  >
                    {{
                      profile.status === 1
                        ? $t('ticket.userCard.statusActive')
                        : $t('ticket.userCard.statusBanned')
                    }}
                  </Tag>
                </div>
                <span class="ticket-user-card__handle">
                  @{{ profile.username }}
                </span>
                <div v-if="profile.roles.length > 0" class="ticket-user-card__roles">
                  <Tag v-for="role in profile.roles" :key="role">
                    {{ role }}
                  </Tag>
                </div>
              </div>
            </header>

            <dl class="ticket-user-card__rows">
              <div class="ticket-user-card__row">
                <dt>
                  <IconifyIcon icon="lucide:hash" />
                  {{ $t('ticket.userCard.id') }}
                </dt>
                <dd>#{{ profile.id }}</dd>
              </div>
              <div class="ticket-user-card__row">
                <dt>
                  <IconifyIcon icon="lucide:mail" />
                  {{ $t('ticket.userCard.email') }}
                </dt>
                <dd>{{ maskDash(profile.email) }}</dd>
              </div>
              <div class="ticket-user-card__row">
                <dt>
                  <IconifyIcon icon="lucide:smartphone" />
                  {{ $t('ticket.userCard.mobile') }}
                </dt>
                <dd>{{ maskDash(profile.mobile) }}</dd>
              </div>
              <div class="ticket-user-card__row">
                <dt>
                  <IconifyIcon icon="lucide:calendar-clock" />
                  {{ $t('ticket.userCard.registeredAt') }}
                </dt>
                <dd>{{ maskDash(profile.createTime) }}</dd>
              </div>
              <div class="ticket-user-card__row">
                <dt>
                  <IconifyIcon icon="lucide:history" />
                  {{ $t('ticket.userCard.lastLoginAt') }}
                </dt>
                <dd>{{ maskDash(profile.lastLoginTime) }}</dd>
              </div>
            </dl>

            <div class="ticket-user-card__stats">
              <div class="ticket-user-card__stat">
                <span>{{ $t('ticket.userCard.balance') }}</span>
                <strong>{{ formatSettlementPrice(profile.balance, 4) }}</strong>
              </div>
              <div class="ticket-user-card__stat">
                <span>{{ $t('ticket.userCard.points') }}</span>
                <strong>{{ Number(profile.points).toLocaleString() }}</strong>
              </div>
            </div>
          </template>
          <p v-else-if="error" class="ticket-user-card__error">
            {{ error }}
          </p>
          <p v-else class="ticket-user-card__loading">
            {{ $t('ticket.userCard.loading') }}
          </p>
        </Spin>
      </div>
    </template>
    <slot></slot>
  </Popover>
  <slot v-else></slot>
</template>

<style scoped>
.ticket-user-card {
  width: 292px;
  padding: 2px;
  font-size: 12px;
}

.ticket-user-card__head {
  display: flex;
  gap: 11px;
  align-items: flex-start;
  padding-bottom: 11px;
  border-bottom: 1px solid hsl(var(--border) / 70%);
}

.ticket-user-card__avatar {
  flex: none;
  font-size: 17px;
  font-weight: 700;
  color: #fff;
}

.ticket-user-card__identity {
  min-width: 0;
}

.ticket-user-card__name-line {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.ticket-user-card__name-line strong {
  overflow: hidden;
  font-size: 14px;
  line-height: 20px;
  color: hsl(var(--foreground));
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ticket-user-card__status {
  margin-inline-end: 0;
}

.ticket-user-card__handle {
  display: block;
  overflow: hidden;
  font-size: 11.5px;
  color: hsl(var(--muted-foreground));
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ticket-user-card__roles {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 5px;
}

.ticket-user-card__roles :deep(.ant-tag) {
  margin-inline-end: 0;
  font-size: 10.5px;
  line-height: 16px;
}

.ticket-user-card__rows {
  display: grid;
  gap: 6px;
  padding: 10px 0;
  margin: 0;
  border-bottom: 1px solid hsl(var(--border) / 70%);
}

.ticket-user-card__row {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
}

.ticket-user-card__row dt {
  display: inline-flex;
  flex: none;
  gap: 5px;
  align-items: center;
  color: hsl(var(--muted-foreground));
}

.ticket-user-card__row dt svg {
  width: 12px;
  height: 12px;
}

.ticket-user-card__row dd {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 11px;
  color: hsl(var(--foreground));
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ticket-user-card__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding-top: 10px;
}

.ticket-user-card__stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 7px 9px;
  background: hsl(var(--muted) / 45%);
  border: 1px solid hsl(var(--border) / 70%);
  border-radius: 8px;
}

.ticket-user-card__stat span {
  font-size: 10.5px;
  color: hsl(var(--muted-foreground));
}

.ticket-user-card__stat strong {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--foreground));
}

.ticket-user-card__loading,
.ticket-user-card__error {
  padding: 18px 6px;
  margin: 0;
  text-align: center;
}

.ticket-user-card__loading {
  color: hsl(var(--muted-foreground));
}

.ticket-user-card__error {
  color: hsl(var(--destructive));
}
</style>
