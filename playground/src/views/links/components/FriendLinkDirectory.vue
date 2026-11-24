<script setup lang="ts">
import type { FriendLinkApi } from '#/api/friend-link';

import { shallowRef } from 'vue';

import { IconifyIcon } from '@vben/icons';

import PublicPageState from '#/components/public-page-state.vue';
import { $t } from '#/locales';

const props = defineProps<{
  error?: boolean;
  items: FriendLinkApi.FriendLinkItem[];
  loading: boolean;
}>();

const emit = defineEmits<{
  retry: [];
}>();

const failedLogos = shallowRef(new Set<string>());

function markLogoFailed(id: string) {
  const next = new Set(failedLogos.value);
  next.add(id);
  failedLogos.value = next;
}

function fallbackText(name: string) {
  return name.trim().slice(0, 1) || $t('page.public.links.defaultAvatar');
}
</script>

<template>
  <section class="friend-link-directory" data-testid="friend-link-directory">
    <PublicPageState
      v-if="props.error"
      icon="lucide:cloud-off"
      tone="danger"
      :title="$t('page.public.links.errorTitle')"
      :description="$t('page.public.links.errorDescription')"
    >
      <template #action>
        <button class="directory-action" type="button" @click="emit('retry')">
          {{ $t('page.public.links.retry') }}
        </button>
      </template>
    </PublicPageState>

    <PublicPageState
      v-else-if="props.loading"
      icon="lucide:loader-circle"
      :title="$t('page.public.links.loading')"
    />

    <PublicPageState
      v-else-if="props.items.length === 0"
      icon="lucide:link-2-off"
      :title="$t('page.public.links.empty')"
      :description="$t('page.public.links.emptyDescription')"
    />

    <div v-else class="friend-link-grid">
      <a
        v-for="item in props.items"
        :key="item.id"
        class="friend-link-entry"
        data-friend-link
        :href="item.siteUrl"
        rel="noopener noreferrer"
        target="_blank"
      >
        <span class="friend-link-logo">
          <img
            v-if="item.logoUrl && !failedLogos.has(item.id)"
            :alt="item.siteName"
            height="48"
            loading="lazy"
            :src="item.logoUrl"
            width="48"
            @error="markLogoFailed(item.id)"
          />
          <span v-else data-logo-fallback>{{ fallbackText(item.siteName) }}</span>
        </span>
        <span class="friend-link-copy">
          <strong>{{ item.siteName }}</strong>
          <span>{{ item.description || item.siteUrl }}</span>
        </span>
        <IconifyIcon class="friend-link-arrow" icon="lucide:arrow-up-right" />
      </a>
    </div>
  </section>
</template>

<style scoped>
.friend-link-directory {
  min-width: 0;
}

.friend-link-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.friend-link-entry {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  min-width: 0;
  min-height: 84px;
  padding: 16px;
  color: var(--ps-text, var(--home-text));
  text-decoration: none;
  background: var(--ps-surface, var(--home-surface));
  border: 1px solid var(--ps-border, var(--home-border));
  border-radius: 14px;
  transition: border-color 0.18s ease, transform 0.18s ease;
}

.friend-link-entry:hover {
  border-color: var(--ps-primary, var(--home-primary));
  transform: translateY(-2px);
}

.friend-link-entry:focus-visible,
.directory-action:focus-visible {
  outline: 2px solid var(--ps-primary, var(--home-primary));
  outline-offset: 3px;
}

.friend-link-logo {
  display: grid;
  flex: none;
  width: 48px;
  height: 48px;
  overflow: hidden;
  color: #fff;
  background: var(--ps-primary, var(--home-primary));
  border-radius: 13px;
  place-items: center;
}

.friend-link-logo img {
  width: 48px;
  height: 48px;
  object-fit: contain;
  background: #fff;
}

.friend-link-copy {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.friend-link-copy strong,
.friend-link-copy span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  overflow-wrap: anywhere;
}

.friend-link-copy strong {
  font-size: 14px;
}

.friend-link-copy span {
  color: var(--ps-muted, var(--home-muted));
  font-size: 12px;
  line-height: 1.5;
  white-space: nowrap;
}

.friend-link-arrow {
  flex: none;
  color: var(--ps-muted, var(--home-muted));
}

.directory-action {
  min-height: 44px;
  padding: 0 16px;
  color: #fff;
  cursor: pointer;
  background: var(--ps-primary, var(--home-primary));
  border: 0;
  border-radius: 8px;
}

@media (max-width: 1024px) {
  .friend-link-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 620px) {
  .friend-link-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .friend-link-entry {
    transition: none;
  }
}
</style>
