<script setup lang="ts">
import type { AdvertisementApi } from '#/api/advertisement';

import { computed } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { useAdvertisements } from '#/composables/use-advertisements';
import { $t } from '#/locales';

type AdvertisementVariant = 'banner' | 'inline' | 'panel';

interface Props {
  limit?: number;
  placement: AdvertisementApi.PublicPlacement;
  variant?: AdvertisementVariant;
}

const props = withDefaults(defineProps<Props>(), {
  limit: 3,
  variant: 'panel',
});

const { items } = useAdvertisements(() => props.placement);
const visibleAds = computed(() =>
  items.value.slice(0, Math.max(1, Math.min(10, props.limit))),
);
const slotClasses = computed(() => [
  'advertisement-slot',
  `advertisement-slot--${props.variant}`,
]);

function linkRel(item: AdvertisementApi.PublicAdvertisement) {
  return item.linkTarget === '_blank'
    ? 'noopener noreferrer sponsored'
    : 'sponsored';
}

function imageLoading(index: number): 'eager' | 'lazy' {
  return props.variant === 'banner' && index === 0 ? 'eager' : 'lazy';
}
</script>

<template>
  <section
    v-if="visibleAds.length"
    :class="slotClasses"
    :data-placement="placement"
    :aria-label="$t('page.public.advertisement.ariaLabel')"
  >
    <component
      :is="item.linkUrl ? 'a' : 'article'"
      v-for="(item, index) in visibleAds"
      :key="item.id"
      class="advertisement-card"
      :class="{ 'advertisement-card--with-media': item.imageUrl }"
      :aria-label="
        item.linkUrl
          ? $t('page.public.advertisement.openLink', [item.title])
          : item.title
      "
      :href="item.linkUrl || undefined"
      :rel="item.linkUrl ? linkRel(item) : undefined"
      :target="item.linkUrl ? item.linkTarget : undefined"
    >
      <div v-if="item.imageUrl" class="advertisement-card__media">
        <img
          :alt="item.title"
          decoding="async"
          :loading="imageLoading(index)"
          :src="item.imageUrl"
        />
      </div>
      <div class="advertisement-card__content">
        <div class="advertisement-card__meta">
          <span>{{ $t('page.public.advertisement.promoted') }}</span>
          <IconifyIcon
            v-if="item.linkUrl"
            class="advertisement-card__arrow"
            icon="lucide:arrow-up-right"
          />
        </div>
        <h2 class="advertisement-card__title">{{ item.title }}</h2>
        <p v-if="item.description" class="advertisement-card__description">
          {{ item.description }}
        </p>
      </div>
    </component>
  </section>
</template>

<style scoped>
.advertisement-slot {
  display: grid;
  gap: 12px;
  width: 100%;
}

.advertisement-slot--banner {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
  max-width: 1280px;
  padding: 0 28px;
  margin: 18px auto 0;
}

.advertisement-slot--panel {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
}

.advertisement-slot--inline {
  grid-template-columns: 1fr;
}

.advertisement-card {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  min-height: 112px;
  overflow: hidden;
  color: hsl(var(--foreground));
  text-decoration: none;
  background:
    linear-gradient(135deg, hsl(var(--primary) / 9%), transparent 58%),
    hsl(var(--card));
  border: 1px solid hsl(var(--primary) / 20%);
  border-radius: 10px;
  box-shadow: 0 10px 30px hsl(var(--foreground) / 5%);
  transition:
    border-color 180ms ease,
    box-shadow 180ms ease,
    transform 180ms ease;
}

a.advertisement-card:hover {
  color: hsl(var(--foreground));
  border-color: hsl(var(--primary) / 48%);
  box-shadow: 0 14px 34px hsl(var(--primary) / 12%);
  transform: translateY(-2px);
}

a.advertisement-card:focus-visible {
  outline: 3px solid hsl(var(--primary) / 34%);
  outline-offset: 2px;
}

.advertisement-card__media {
  min-height: 116px;
  overflow: hidden;
  background: hsl(var(--muted));
}

.advertisement-card__media img {
  width: 100%;
  height: 100%;
  max-height: 220px;
  object-fit: cover;
}

.advertisement-card__content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  padding: 16px 18px 18px;
}

.advertisement-card__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 11px;
  font-weight: 700;
  color: hsl(var(--primary));
  letter-spacing: 0.16em;
}

.advertisement-card__arrow {
  width: 16px;
  height: 16px;
  letter-spacing: normal;
  transition: transform 180ms ease;
}

a.advertisement-card:hover .advertisement-card__arrow {
  transform: translate(2px, -2px);
}

.advertisement-card__title {
  margin: 0;
  overflow: hidden;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.advertisement-card__description {
  display: -webkit-box;
  margin: 6px 0 0;
  overflow: hidden;
  font-size: 13px;
  line-height: 1.65;
  color: hsl(var(--muted-foreground));
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.advertisement-slot--inline .advertisement-card {
  grid-template-columns: minmax(112px, 22%) minmax(0, 1fr);
  min-height: 96px;
}

.advertisement-slot--inline .advertisement-card__media {
  min-height: 96px;
}

.advertisement-slot--inline .advertisement-card__media img {
  height: 100%;
}

@media (min-width: 760px) {
  .advertisement-slot--banner .advertisement-card--with-media,
  .advertisement-slot--panel .advertisement-card--with-media {
    grid-template-columns: minmax(150px, 34%) minmax(0, 1fr);
  }
}

@media (max-width: 640px) {
  .advertisement-slot--banner {
    padding: 0 16px;
    margin-top: 12px;
  }

  .advertisement-slot--inline .advertisement-card {
    grid-template-columns: 96px minmax(0, 1fr);
  }

  .advertisement-card__content {
    padding: 13px 14px 14px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .advertisement-card,
  .advertisement-card__arrow {
    transition: none;
  }
}
</style>
