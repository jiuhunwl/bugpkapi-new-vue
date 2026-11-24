<script lang="ts" setup>
import type { OAuthApi } from '#/api';

import { computed, onMounted, ref } from 'vue';

import {
  Button,
  Input,
  InputPassword,
  Modal,
  Tag,
  message,
} from 'ant-design-vue';

import {
  authorizeOAuthBindApi,
  getOAuthBindingsApi,
  getUserInfoApi,
  sendBindEmailCodeApi,
  unbindOAuthApi,
} from '#/api';
import { $t } from '#/locales';

import OAuthProviderIcon from './OAuthProviderIcon.vue';

const bindings = ref<null | OAuthApi.Bindings>(null);
const loading = ref(true);
const activeProvider = ref('');
const email = ref('');
const unbindOpen = ref(false);
const unbindTarget = ref<null | OAuthApi.BindingProvider>(null);
const unbindPassword = ref('');
const unbindEmailCode = ref('');
const unbindLoading = ref(false);
const sendingCode = ref(false);

const hasPassword = computed(() => bindings.value?.hasPassword !== false);
const providers = computed(() => bindings.value?.providers || []);

async function load() {
  loading.value = true;
  try {
    const [result, userInfo] = await Promise.all([
      getOAuthBindingsApi(),
      getUserInfoApi(),
    ]);
    bindings.value = result;
    email.value = (userInfo as { email?: string }).email || '';
  } catch {
    bindings.value = null;
  } finally {
    loading.value = false;
  }
}

async function bind(provider: OAuthApi.BindingProvider) {
  if (activeProvider.value || !provider.enabled) return;
  activeProvider.value = provider.providerKey;
  try {
    const result = await authorizeOAuthBindApi(provider.providerKey);
    if (result?.url) {
      window.location.assign(result.url);
    }
  } finally {
    activeProvider.value = '';
  }
}

function openUnbind(provider: OAuthApi.BindingProvider) {
  unbindTarget.value = provider;
  unbindPassword.value = '';
  unbindEmailCode.value = '';
  unbindOpen.value = true;
}

async function sendCode() {
  if (!email.value || sendingCode.value) return;
  sendingCode.value = true;
  try {
    await sendBindEmailCodeApi(email.value);
    message.success($t('oauth.bindings.codeSent'));
  } finally {
    sendingCode.value = false;
  }
}

async function confirmUnbind() {
  if (!unbindTarget.value || unbindLoading.value) return;
  unbindLoading.value = true;
  try {
    await unbindOAuthApi(unbindTarget.value.providerKey, {
      emailCode: hasPassword.value ? undefined : unbindEmailCode.value,
      password: hasPassword.value ? unbindPassword.value : undefined,
    });
    message.success($t('oauth.bindings.unbound'));
    unbindOpen.value = false;
    await load();
  } finally {
    unbindLoading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section class="oauth-bindings">
    <div class="mb-4 flex flex-col gap-1">
      <h3 class="text-base font-semibold">{{ $t('oauth.bindings.title') }}</h3>
      <p class="text-muted-foreground text-sm">
        {{ $t('oauth.bindings.description') }}
      </p>
    </div>

    <div v-if="loading" class="text-muted-foreground py-6 text-sm">
      {{ $t('oauth.bindings.loading') }}
    </div>
    <div
      v-else-if="providers.length === 0"
      class="text-muted-foreground py-6 text-sm"
    >
      {{ $t('oauth.bindings.empty') }}
    </div>
    <div v-else class="grid gap-3">
      <div
        v-for="provider in providers"
        :key="provider.providerKey"
        class="border-border flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
      >
        <div class="flex items-center gap-3">
          <img
            v-if="provider.bound && provider.avatar"
            :src="provider.avatar"
            alt=""
            class="size-11 rounded-full object-cover"
          />
          <div
            v-else
            class="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-full"
          >
            <OAuthProviderIcon
              :display-name="provider.displayName"
              :icon-key="provider.iconKey"
            />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="font-semibold">{{ provider.displayName }}</span>
              <Tag v-if="provider.bound" color="green">
                {{ $t('oauth.bindings.bound') }}
              </Tag>
              <Tag v-else-if="!provider.enabled" color="default">
                {{ $t('oauth.bindings.disabled') }}
              </Tag>
              <Tag v-else color="blue">
                {{ $t('oauth.bindings.available') }}
              </Tag>
            </div>
            <p class="text-muted-foreground mt-1 text-sm">
              <template v-if="provider.bound">
                {{
                  $t('oauth.bindings.boundDetail', [
                    provider.nickname || provider.displayName,
                    provider.boundAt || '-',
                  ])
                }}
              </template>
              <template v-else-if="provider.enabled">
                {{ $t('oauth.bindings.bindHint', [provider.displayName]) }}
              </template>
              <template v-else>
                {{ $t('oauth.bindings.disabledHint') }}
              </template>
            </p>
          </div>
        </div>
        <div class="flex gap-2">
          <Button
            v-if="provider.enabled"
            :disabled="!!activeProvider && activeProvider !== provider.providerKey"
            :loading="activeProvider === provider.providerKey"
            @click="bind(provider)"
          >
            {{
              provider.bound
                ? $t('oauth.bindings.rebind')
                : $t('oauth.bindings.bind')
            }}
          </Button>
          <Button
            v-if="provider.bound"
            danger
            @click="openUnbind(provider)"
          >
            {{ $t('oauth.bindings.unbind') }}
          </Button>
        </div>
      </div>
    </div>

    <Modal
      v-model:open="unbindOpen"
      :confirm-loading="unbindLoading"
      :title="$t('oauth.bindings.unbindTitle', [unbindTarget?.displayName || ''])"
      :ok-text="$t('oauth.bindings.confirmUnbind')"
      :cancel-text="$t('oauth.actions.cancel')"
      @ok="confirmUnbind"
    >
      <div class="space-y-3 py-2">
        <p class="text-muted-foreground text-sm">
          {{ $t('oauth.bindings.unbindDescription') }}
        </p>
        <template v-if="hasPassword">
          <InputPassword
            v-model:value="unbindPassword"
            :placeholder="$t('oauth.bindings.currentPassword')"
            autocomplete="current-password"
          />
        </template>
        <template v-else-if="email">
          <div class="flex gap-2">
            <Input
              v-model:value="unbindEmailCode"
              :placeholder="$t('oauth.bindings.emailCode')"
              autocomplete="one-time-code"
            />
            <Button :loading="sendingCode" @click="sendCode">
              {{ $t('oauth.bindings.sendCode') }}
            </Button>
          </div>
          <p class="text-muted-foreground text-xs">
            {{ $t('oauth.bindings.codeSentTo', [email]) }}
          </p>
        </template>
        <p v-else class="text-sm text-amber-600">
          {{ $t('oauth.bindings.needProof') }}
        </p>
      </div>
    </Modal>
  </section>
</template>

<style scoped>
.oauth-bindings {
  padding: 20px 0;
}
</style>
