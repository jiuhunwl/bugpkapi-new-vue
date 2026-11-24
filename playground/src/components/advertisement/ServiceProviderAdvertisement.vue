<script setup lang="ts">
import type { AdvertisementApi } from '#/api/advertisement';

import { computed } from 'vue';

import { useAdvertisements } from '#/composables/use-advertisements';
import { $t } from '#/locales';

const { items } = useAdvertisements('SERVICE_PROVIDER');
const provider = computed(() => items.value[0]);

function linkRel(item: AdvertisementApi.PublicAdvertisement) {
  return item.linkTarget === '_blank'
    ? 'noopener noreferrer sponsored'
    : 'sponsored';
}
</script>

<template>
  <span
    v-if="provider"
    class="service-provider-ad"
    :title="provider.description || provider.title"
  >
    <span>{{ $t('page.public.footer.serviceProviderPrefix') }}</span>
    <component
      :is="provider.linkUrl ? 'a' : 'strong'"
      class="service-provider-ad__name"
      :href="provider.linkUrl || undefined"
      :rel="provider.linkUrl ? linkRel(provider) : undefined"
      :target="provider.linkUrl ? provider.linkTarget : undefined"
    >
      {{ provider.title }}
    </component>
    <span v-if="$t('page.public.footer.serviceProviderSuffix')">
      {{ $t('page.public.footer.serviceProviderSuffix') }}
    </span>
  </span>
</template>

<style scoped>
.service-provider-ad {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  justify-content: center;
  min-width: 0;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.5;
  color: inherit;
  text-align: center;
}

.service-provider-ad__name {
  min-width: 0;
  overflow: hidden;
  font-weight: 900;
  color: hsl(var(--primary));
  text-overflow: ellipsis;
  text-decoration: none;
  white-space: nowrap;
}

a.service-provider-ad__name:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

a.service-provider-ad__name:focus-visible {
  outline: 2px solid hsl(var(--primary) / 45%);
  outline-offset: 2px;
  border-radius: 3px;
}
</style>
