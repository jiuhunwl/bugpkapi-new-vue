<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Button, Result, Spin } from 'ant-design-vue';

import { exchangeOAuthTicketApi } from '#/api';
import { $t } from '#/locales';
import { useAuthStore } from '#/store';

defineOptions({ name: 'OAuthCallback' });

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const status = ref<'error' | 'loading' | 'success'>('loading');
const errorCode = ref('');
const errorMessage = ref('');
const errorReason = ref('');

const errorKeys: Record<string, string> = {
  account_unavailable: 'oauth.errors.accountUnavailable',
  already_registered: 'oauth.errors.alreadyRegistered',
  banned: 'oauth.errors.banned',
  config_error: 'oauth.errors.configError',
  email_conflict: 'oauth.errors.emailConflict',
  email_required: 'oauth.errors.emailRequired',
  flow_invalid: 'oauth.errors.flowInvalid',
  identity_conflict: 'oauth.errors.identityConflict',
  internal_error: 'oauth.errors.generic',
  not_registered: 'oauth.errors.notRegistered',
  provider_denied: 'oauth.errors.providerDenied',
  provider_disabled: 'oauth.errors.providerDisabled',
  provider_error: 'oauth.errors.providerError',
  register_disabled: 'oauth.errors.registerDisabled',
  register_limited: 'oauth.errors.registerLimited',
  risk_blocked: 'oauth.errors.riskBlocked',
  state_invalid: 'oauth.errors.stateInvalid',
};

const displayError = computed(() => {
  if (errorMessage.value) return errorMessage.value;
  const key = errorKeys[errorCode.value];
  const base = key ? $t(key) : $t('oauth.errors.generic');
  return errorReason.value ? `${base}（${errorReason.value}）` : base;
});

/** 后端附带的上游脱敏原因，去掉控制字符并限长，防止异常参数撑爆界面 */
function sanitizeReason(raw: string) {
  return raw
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, 200);
}

function backendMessage(error: unknown) {
  const value = error as {
    message?: string;
    response?: { data?: { message?: string } };
  };
  return value?.response?.data?.message || value?.message || '';
}

onMounted(async () => {
  const ticket = route.query.ticket;
  const queryError = route.query.error;
  if (typeof queryError === 'string' && queryError) {
    errorCode.value = queryError;
    const reason = route.query.reason;
    if (typeof reason === 'string' && reason) {
      errorReason.value = sanitizeReason(reason);
    }
    status.value = 'error';
    return;
  }
  if (typeof ticket !== 'string' || !ticket) {
    errorCode.value = 'flow_invalid';
    status.value = 'error';
    return;
  }
  try {
    const result = await exchangeOAuthTicketApi(ticket);
    await authStore.authLoginByAccessToken(
      result.accessToken,
      result.redirect,
    );
    status.value = 'success';
  } catch (error) {
    errorMessage.value = backendMessage(error);
    errorCode.value = 'exchange_failed';
    status.value = 'error';
  }
});

function goLogin() {
  router.replace('/auth/login');
}

function goHome() {
  router.replace('/');
}
</script>

<template>
  <div class="flex min-h-[60vh] items-center justify-center p-4">
    <div
      v-if="status === 'loading'"
      class="flex flex-col items-center gap-4 text-center"
    >
      <Spin size="large" />
      <p class="text-muted-foreground text-sm">
        {{ $t('oauth.callback.processing') }}
      </p>
    </div>
    <Result
      v-else-if="status === 'success'"
      status="success"
      :title="$t('oauth.callback.successTitle')"
      :sub-title="$t('oauth.callback.successDescription')"
    >
      <template #extra>
        <Button type="primary" @click="goHome">
          {{ $t('oauth.actions.goHome') }}
        </Button>
      </template>
    </Result>
    <Result
      v-else
      status="error"
      :title="$t('oauth.callback.errorTitle')"
      :sub-title="displayError"
    >
      <template #extra>
        <Button type="primary" @click="goLogin">
          {{ $t('oauth.actions.backToLogin') }}
        </Button>
        <Button class="ml-2" @click="goHome">
          {{ $t('oauth.actions.goHome') }}
        </Button>
      </template>
    </Result>
  </div>
</template>
