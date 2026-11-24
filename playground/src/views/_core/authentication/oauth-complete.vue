<script lang="ts" setup>
import type { OAuthApi } from '#/api';

import { onMounted, reactive, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';

import {
  Alert,
  Button,
  Form,
  FormItem,
  Input,
  InputPassword,
  Result,
  Spin,
  Tag,
  message,
} from 'ant-design-vue';

import { completeOAuthApi, getOAuthCompleteInfoApi } from '#/api';
import OAuthProviderIcon from '#/components/oauth/OAuthProviderIcon.vue';
import { $t } from '#/locales';
import { useAuthStore } from '#/store';
import { isValidPassword } from '#/utils/password-policy';

defineOptions({ name: 'OAuthComplete' });

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const ticket = typeof route.query.ticket === 'string' ? route.query.ticket : '';
const info = ref<null | OAuthApi.CompleteInfo>(null);
const loading = ref(true);
const submitting = ref(false);
const failed = ref(false);
const form = reactive({
  confirmPassword: '',
  password: '',
  username: '',
  website: '',
});

async function load() {
  if (!ticket) {
    failed.value = true;
    loading.value = false;
    return;
  }
  try {
    const result = await getOAuthCompleteInfoApi(ticket);
    info.value = result;
    form.username = result.suggestedUsername || '';
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}

async function submit() {
  if (submitting.value || !info.value) return;
  const username = form.username.trim();
  if (!/^[A-Za-z0-9_-]{3,32}$/.test(username)) {
    message.warning($t('oauth.complete.usernameInvalid'));
    return;
  }
  if (!isValidPassword(form.password)) {
    message.warning($t('oauth.complete.passwordInvalid'));
    return;
  }
  if (form.password !== form.confirmPassword) {
    message.warning($t('oauth.complete.passwordMismatch'));
    return;
  }
  submitting.value = true;
  try {
    const result = await completeOAuthApi({
      confirmPassword: form.confirmPassword,
      password: form.password,
      ticket,
      username,
      website: form.website,
    });
    await authStore.authLoginByAccessToken(
      result.accessToken,
      result.redirect,
    );
  } catch (error) {
    message.error(backendMessage(error) || $t('oauth.errors.generic'));
  } finally {
    submitting.value = false;
  }
}

function backendMessage(error: unknown) {
  const value = error as {
    message?: string;
    response?: { data?: { message?: string } };
  };
  return value?.response?.data?.message || value?.message || '';
}

function goLogin() {
  router.replace('/auth/login');
}

onMounted(load);
</script>

<template>
  <div class="flex min-h-[60vh] items-center justify-center p-4">
    <div v-if="loading" class="flex flex-col items-center gap-4">
      <Spin size="large" />
      <p class="text-muted-foreground text-sm">
        {{ $t('oauth.complete.loading') }}
      </p>
    </div>
    <Result
      v-else-if="failed || !info"
      status="error"
      :title="$t('oauth.complete.invalidTitle')"
      :sub-title="$t('oauth.complete.invalidDescription')"
    >
      <template #extra>
        <Button type="primary" @click="goLogin">
          {{ $t('oauth.actions.backToLogin') }}
        </Button>
      </template>
    </Result>
    <div
      v-else
      class="border-border bg-card w-full max-w-md rounded-xl border p-6 shadow-sm"
    >
      <h2 class="mb-4 text-lg font-semibold">
        {{ $t('oauth.complete.title') }}
      </h2>
      <div class="mb-5 flex items-center gap-3">
        <img
          v-if="info.avatar"
          :src="info.avatar"
          alt=""
          class="size-12 rounded-full object-cover"
        />
        <div
          v-else
          class="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full"
        >
          <OAuthProviderIcon
            :display-name="info.displayName"
            :icon-key="info.iconKey"
          />
        </div>
        <div>
          <div class="flex items-center gap-2 font-semibold">
            {{ info.displayName }}
            <Tag color="blue">{{ $t('oauth.complete.newAccount') }}</Tag>
          </div>
          <p class="text-muted-foreground mt-1 text-sm">
            {{ info.nickname || info.suggestedUsername }}
          </p>
        </div>
      </div>

      <Alert
        v-if="info.email && info.emailVerified"
        :message="$t('oauth.complete.verifiedEmail', [info.email])"
        class="mb-4"
        type="info"
        show-icon
      />
      <Alert
        v-else-if="info.requiresVerifiedEmail"
        :message="$t('oauth.complete.emailRequired')"
        class="mb-4"
        type="warning"
        show-icon
      />

      <Form layout="vertical" @submit.prevent="submit">
        <input
          v-model="form.website"
          aria-hidden="true"
          autocomplete="off"
          class="oauth-complete-honeypot"
          name="website"
          tabindex="-1"
          type="text"
        />
        <FormItem :label="$t('oauth.complete.username')" required>
          <Input
            v-model:value="form.username"
            :maxlength="32"
            autocomplete="username"
            :placeholder="$t('oauth.complete.usernamePlaceholder')"
          />
        </FormItem>
        <FormItem :label="$t('oauth.complete.password')" required>
          <InputPassword
            v-model:value="form.password"
            autocomplete="new-password"
            :placeholder="$t('oauth.complete.passwordPlaceholder')"
          />
        </FormItem>
        <FormItem :label="$t('oauth.complete.confirmPassword')" required>
          <InputPassword
            v-model:value="form.confirmPassword"
            autocomplete="new-password"
            :placeholder="$t('oauth.complete.confirmPasswordPlaceholder')"
            @press-enter="submit"
          />
        </FormItem>
        <Button
          block
          :loading="submitting"
          type="primary"
          @click="submit"
        >
          {{ $t('oauth.complete.submit') }}
        </Button>
      </Form>
      <p class="text-muted-foreground mt-4 text-center text-xs leading-5">
        {{ $t('legal.auth.loginNoticePrefix') }}
        <RouterLink class="text-primary hover:underline" to="/privacy-policy">
          {{ $t('legal.common.privacyPolicy') }}
        </RouterLink>
        {{ $t('legal.auth.separator') }}
        <RouterLink class="text-primary hover:underline" to="/terms-of-service">
          {{ $t('legal.common.termsOfService') }}
        </RouterLink>
      </p>
    </div>
  </div>
</template>

<style scoped>
.oauth-complete-honeypot {
  position: absolute;
  top: -9999px;
  left: -9999px;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}
</style>
