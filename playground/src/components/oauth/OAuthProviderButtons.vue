<script lang="ts" setup>
import type { OAuthApi } from '#/api';

import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { IconifyIcon } from '@vben/icons';

import { Button } from 'ant-design-vue';

import { authorizeOAuthApi, getOAuthProvidersApi } from '#/api';
import { $t } from '#/locales';

import OAuthProviderIcon from './OAuthProviderIcon.vue';

const providers = ref<OAuthApi.Provider[]>([]);
const activeProvider = ref('');
const route = useRoute();
let redirectPath = '';

function resolveReturnPath() {
  const redirect = route.query.redirect;
  if (typeof redirect !== 'string') return undefined;
  let decoded = redirect;
  try {
    decoded = decodeURIComponent(redirect);
  } catch {
    decoded = redirect;
  }
  return decoded.startsWith('/') ? decoded : undefined;
}

async function loadProviders() {
  try {
    providers.value = await getOAuthProvidersApi();
  } catch {
    providers.value = [];
  }
}

async function start(provider: OAuthApi.Provider) {
  if (activeProvider.value) return;
  activeProvider.value = provider.providerKey;
  try {
    const result = await authorizeOAuthApi(provider.providerKey, {
      returnPath: redirectPath || undefined,
    });
    if (result?.url) {
      window.location.assign(result.url);
    }
  } finally {
    activeProvider.value = '';
  }
}

onMounted(async () => {
  redirectPath = resolveReturnPath() || '';
  await loadProviders();
});
</script>

<template>
  <div v-if="providers.length > 0" class="oauth-provider-buttons mt-5">
    <div class="mb-4 flex items-center gap-3">
      <span class="border-input h-px flex-1 border-b dark:border-gray-600"></span>
      <span class="text-muted-foreground text-xs uppercase">
        {{ $t('authentication.thirdPartyLogin') }}
      </span>
      <span class="border-input h-px flex-1 border-b dark:border-gray-600"></span>
    </div>
    <div class="grid w-full grid-cols-2 gap-2">
      <Button
        v-for="provider in providers"
        :key="provider.providerKey"
        :disabled="!!activeProvider && activeProvider !== provider.providerKey"
        class="oauth-provider-button"
        @click="start(provider)"
      >
        <div class="flex min-w-0 items-center justify-center gap-2">
          <!-- 图标位固定尺寸：Iconify 异步注入与点击反馈都不再引起行高变化 -->
          <span class="flex size-5 shrink-0 items-center justify-center">
            <IconifyIcon
              v-if="activeProvider === provider.providerKey"
              class="animate-spin text-lg"
              icon="lucide:loader-circle"
            />
            <OAuthProviderIcon
              v-else
              :display-name="provider.displayName"
              :icon-key="provider.iconKey"
            />
          </span>
          <span class="truncate">{{ provider.displayName }}</span>
        </div>
      </Button>
    </div>
  </div>
</template>

<style scoped>
.oauth-provider-button {
  min-width: 0;
}
</style>
