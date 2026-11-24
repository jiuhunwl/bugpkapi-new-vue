<script setup lang="ts">
import type { DonationApi } from '#/api/donation';

import { shallowRef } from 'vue';

import { IconifyIcon, RotateCw } from '@vben/icons';

import { $t } from '#/locales';

const props = defineProps<{
  error: Error | null;
  hasMore: boolean;
  items: readonly DonationApi.Supporter[];
  loading: boolean;
  loadingMore: boolean;
  total: number;
}>();

const emit = defineEmits<{
  loadMore: [];
  retry: [];
}>();

const failedAvatarIds = shallowRef(new Set<string>());

function supporterInitial(nickname: string) {
  return Array.from(nickname.trim())[0]?.toLocaleUpperCase() || '?';
}

function markAvatarFailed(id: string) {
  const next = new Set(failedAvatarIds.value);
  next.add(id);
  failedAvatarIds.value = next;
}

function showAvatar(item: DonationApi.Supporter) {
  return Boolean(item.avatarUrl) && !failedAvatarIds.value.has(item.id);
}

function displayAmount(amount: string) {
  return `¥${amount}`;
}
</script>

<template>
  <section
    class="su-section"
    aria-labelledby="donation-supporter-title"
  >
    <header class="su-head">
      <div class="su-head-title">
        <span class="su-kicker">
          <IconifyIcon aria-hidden="true" icon="lucide:users" />
          {{ $t('page.public.donate.supporters.kicker') }}
        </span>
        <h2 id="donation-supporter-title">
          {{ $t('page.public.donate.supporters.title') }}
        </h2>
        <p>{{ $t('page.public.donate.supporters.description') }}</p>
      </div>
      <span v-if="props.total > 0" class="su-chip">
        {{ $t('page.public.donate.supporters.total', [props.total]) }}
      </span>
    </header>

    <div v-if="props.loading" class="su-state" aria-live="polite">
      <IconifyIcon class="su-state-icon is-spinning" icon="lucide:loader-circle" />
      <span>{{ $t('page.public.donate.supporters.loading') }}</span>
    </div>

    <div v-else-if="props.error" class="su-state" role="alert">
      <IconifyIcon class="su-state-icon" icon="lucide:cloud-off" />
      <strong>{{ $t('page.public.donate.supporters.errorTitle') }}</strong>
      <span>{{ $t('page.public.donate.supporters.errorDescription') }}</span>
      <button class="su-btn su-btn-ghost su-btn-sm" type="button" @click="emit('retry')">
        <RotateCw class="size-4" />
        {{ $t('page.public.donate.supporters.retry') }}
      </button>
    </div>

    <div v-else-if="props.items.length === 0" class="su-state">
      <IconifyIcon class="su-state-icon" icon="lucide:heart" />
      <strong>{{ $t('page.public.donate.supporters.emptyTitle') }}</strong>
      <span>{{ $t('page.public.donate.supporters.emptyDescription') }}</span>
    </div>

    <div v-else>
      <ul class="su-grid">
        <li
          v-for="item in props.items"
          :key="item.id"
          class="su-card"
          :data-testid="`supporter-${item.id}`"
        >
          <span class="su-avatar">
            <span
              v-if="!showAvatar(item)"
              :data-testid="`supporter-fallback-${item.id}`"
              class="su-avatar-fallback"
            >
              {{ supporterInitial(item.nickname) }}
            </span>
            <img
              v-else
              :alt="$t('page.public.donate.supporters.avatarAlt', [item.nickname])"
              :data-testid="`supporter-avatar-${item.id}`"
              class="su-avatar-img"
              loading="lazy"
              referrerpolicy="no-referrer"
              :src="item.avatarUrl"
              @error="markAvatarFailed(item.id)"
            />
          </span>

          <div class="su-body">
            <div class="su-line">
              <strong>{{ item.nickname }}</strong>
              <span class="su-amount">{{ displayAmount(item.amount) }}</span>
            </div>
            <p v-if="item.message" class="su-message">{{ item.message }}</p>
            <span class="su-date">{{ item.donatedAt }}</span>
          </div>
        </li>
      </ul>

      <div v-if="props.hasMore" class="su-more">
        <button
          class="su-btn su-btn-ghost"
          data-testid="supporter-load-more"
          :disabled="props.loadingMore"
          type="button"
          @click="emit('loadMore')"
        >
          <IconifyIcon
            :class="{ 'is-spinning': props.loadingMore }"
            :icon="
              props.loadingMore ? 'lucide:loader-circle' : 'lucide:chevron-down'
            "
          />
          {{
            props.loadingMore
              ? $t('page.public.donate.supporters.loadingMore')
              : $t('page.public.donate.supporters.loadMore')
          }}
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.su-section {
  padding-top: 34px;
}

.su-head {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.su-kicker {
  display: inline-flex;
  gap: 7px;
  align-items: center;
  margin-bottom: 9px;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--home-primary);
}

.su-kicker svg {
  font-size: 13px;
}

.su-head-title h2 {
  font-size: clamp(19px, 2.4vw, 25px);
  font-weight: 800;
  letter-spacing: -0.3px;
  color: var(--home-heading);
}

.su-head-title p {
  margin-top: 6px;
  font-size: 13.5px;
  color: var(--home-muted);
}

.su-chip {
  display: inline-flex;
  flex: none;
  gap: 7px;
  align-items: center;
  padding: 7px 14px;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 12.5px;
  font-weight: 700;
  color: var(--home-primary);
  background: rgb(var(--home-primary-rgb) / 8%);
  border: 1px solid rgb(var(--home-primary-rgb) / 26%);
  border-radius: 999px;
}

/* ---------- 支持者卡 ---------- */
.su-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(288px, 1fr));
  gap: 14px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.su-card {
  display: flex;
  gap: 13px;
  align-items: flex-start;
  min-width: 0;
  padding: 16px 18px;
  background: var(--home-surface-strong);
  border: 1px solid var(--home-border);
  border-radius: 16px;
  box-shadow: var(--home-card-shadow);
  transition:
    border-color 0.22s cubic-bezier(0.22, 0.61, 0.36, 1),
    box-shadow 0.22s cubic-bezier(0.22, 0.61, 0.36, 1),
    transform 0.22s cubic-bezier(0.22, 0.61, 0.36, 1);
}

.su-card:hover {
  border-color: rgb(var(--home-primary-rgb) / 40%);
  box-shadow: 0 14px 34px var(--home-shadow);
  transform: translateY(-2px);
}

.su-avatar {
  display: grid;
  flex: none;
  place-items: center;
  width: 44px;
  height: 44px;
  overflow: hidden;
  border-radius: 13px;
}

.su-avatar-fallback {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  font-size: 17px;
  font-weight: 800;
  color: var(--home-primary);
  background: rgb(var(--home-primary-rgb) / 10%);
}

.su-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.su-body {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 0;
  flex: 1;
}

.su-line {
  display: flex;
  gap: 10px;
  align-items: baseline;
  justify-content: space-between;
  min-width: 0;
}

.su-line strong {
  min-width: 0;
  overflow: hidden;
  font-size: 15px;
  font-weight: 700;
  color: var(--home-heading);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.su-amount {
  flex: none;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 14px;
  font-weight: 800;
  color: var(--home-primary);
  font-variant-numeric: tabular-nums;
}

.su-message {
  padding-left: 10px;
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--home-muted);
  overflow-wrap: anywhere;
  border-left: 2px solid rgb(var(--home-primary-rgb) / 22%);
}

.su-date {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 11.5px;
  color: var(--home-text-faint);
}

/* ---------- 状态 ---------- */
.su-state {
  display: grid;
  gap: 8px;
  place-items: center;
  min-height: 200px;
  padding: 32px 24px;
  text-align: center;
  background: var(--home-surface-subtle);
  border: 1px dashed var(--home-border-strong);
  border-radius: 16px;
}

.su-state strong {
  font-size: 16.5px;
  font-weight: 800;
  color: var(--home-heading);
}

.su-state span {
  max-width: 460px;
  font-size: 13px;
  line-height: 1.75;
  color: var(--home-muted);
}

.su-state-icon {
  margin-bottom: 2px;
  font-size: 28px;
  color: var(--home-primary);
}

.is-spinning {
  animation: su-spin 0.9s linear infinite;
}

@keyframes su-spin {
  to {
    transform: rotate(360deg);
  }
}

/* ---------- 按钮 ---------- */
.su-btn {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 0 20px;
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid var(--home-border);
  border-radius: 12px;
  transition: all 0.2s cubic-bezier(0.22, 0.61, 0.36, 1);
}

.su-btn-ghost {
  color: var(--home-text);
  background: var(--home-surface);
}

.su-btn-ghost:hover:not(:disabled) {
  border-color: rgb(var(--home-primary-rgb) / 40%);
  transform: translateY(-1px);
}

.su-btn-ghost:disabled {
  cursor: wait;
  opacity: 0.65;
}

.su-btn-sm {
  min-height: 38px;
  padding: 0 16px;
  font-size: 13px;
}

.su-more {
  display: flex;
  justify-content: center;
  padding-top: 22px;
}

/* ---------- 响应式 ---------- */
@media (max-width: 900px) {
  .su-grid {
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  }
}

@media (max-width: 640px) {
  .su-head {
    align-items: flex-start;
  }

  .su-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }

  .su-card {
    padding: 14px 16px;
  }
}

@media (hover: none) {
  .su-card:hover {
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .su-card,
  .su-btn,
  .is-spinning {
    transition: none;
    animation: none;
    transform: none;
  }
}
</style>
