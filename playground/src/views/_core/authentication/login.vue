<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';
import type { Recordable } from '@vben/types';

import type { AuthApi } from '#/api';

import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  useTemplateRef,
} from 'vue';
import { RouterLink, useRoute } from 'vue-router';

import { AuthenticationLogin, z } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { Input, message, Modal } from 'ant-design-vue';

import {
  getCaptchaApi,
  isCaptchaEnabled,
  loginApi,
  loginTwoFAApi,
  verifyCaptchaApi,
} from '#/api';
import CaptchaWidget from '#/components/captcha-widget/CaptchaWidget.vue';
import OAuthProviderButtons from '#/components/oauth/OAuthProviderButtons.vue';
import { useAuthStore } from '#/store';
import { safeInternalRedirect } from '#/utils/safe-internal-redirect';

import { loadWithCaptchaRetry } from './captcha-retry';

defineOptions({ name: 'Login' });

const authStore = useAuthStore();
const route = useRoute();
const captchaWidgetRef =
  useTemplateRef<InstanceType<typeof CaptchaWidget>>('captchaWidgetRef');
const captchaId = shallowRef('');
const captcha = shallowRef<AuthApi.CaptchaResult | null>(null);
const captchaChecking = shallowRef(false);
const captchaVerified = shallowRef(false);
/**
 * idle = 还没开始拉；loading = 正在拉（或正在退避重试）；
 * ready = 挑战已就绪（enabled=false 时也算就绪）；error = 重试用尽仍失败。
 */
const captchaStatus = shallowRef<'error' | 'idle' | 'loading' | 'ready'>(
  'idle',
);
const captchaRequired = computed(() => isCaptchaEnabled(captcha.value));

/**
 * 被「登录过期 → 登录页」带来的 redirect。登录成功后回到原页面，
 * 而不是永远落到默认首页。
 */
const redirectTarget = computed(() => {
  const raw = route.query.redirect;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) {
    return '';
  }
  const target = safeInternalRedirect(value, '');
  return target === '/' ? '' : target;
});

// ---- 2FA 第二步 ----
const twoFAModalOpen = ref(false);
const twoFAChallengeToken = ref('');
const twoFACode = ref('');
const twoFASubmitting = ref(false);

async function completeTwoFALogin() {
  const code = twoFACode.value.trim();
  if (!code) {
    message.warning($t('page.auth.twoFA.codeRequired'));
    return;
  }
  if (twoFASubmitting.value) return;
  twoFASubmitting.value = true;
  try {
    const result = await loginTwoFAApi(twoFAChallengeToken.value, code);
    twoFAModalOpen.value = false;
    twoFAChallengeToken.value = '';
    twoFACode.value = '';
    // 正式令牌已就绪，复用登录后的统一会话建立逻辑。
    await authStore.authLoginByAccessToken(
      result.accessToken,
      redirectTarget.value || undefined,
    );
  } catch {
    // 失败提示由全局请求拦截器展示；清空输入方便重试。
    twoFACode.value = '';
  } finally {
    twoFASubmitting.value = false;
  }
}

function cancelTwoFALogin() {
  twoFAModalOpen.value = false;
  twoFAChallengeToken.value = '';
  twoFACode.value = '';
  void resetCaptcha(true);
}

// 并发保护：重试/手动重载/自动重载可能交错，只认最后一次发起的结果，
// 避免旧请求把已经加载好的挑战覆盖成「失败」状态。
let captchaLoadSeq = 0;
// 正常加载只要一两百毫秒，过早显示「正在加载」会闪一下；超过 400ms 再提示。
const showCaptchaLoading = shallowRef(false);
let captchaLoadingTimer: null | ReturnType<typeof setTimeout> = null;

function setCaptchaLoadingVisible(visible: boolean) {
  if (captchaLoadingTimer !== null) {
    clearTimeout(captchaLoadingTimer);
    captchaLoadingTimer = null;
  }
  if (!visible) {
    showCaptchaLoading.value = false;
    return;
  }
  captchaLoadingTimer = setTimeout(() => {
    captchaLoadingTimer = null;
    showCaptchaLoading.value = true;
  }, 400);
}

/**
 * 拉取登录验证码挑战。
 *
 * 5xx / 网关 429 / 网络中断 / 会话切换打断都会自动退避重试（最多 4 次尝试）。
 * 登录过期被踢回登录页时，浏览器仍在收尾上一个会话的请求，这一层重试可以
 * 把「验证组件加载失败」从死路变成一次几百毫秒的等待。
 */
async function loadCaptcha() {
  const seq = ++captchaLoadSeq;
  captchaStatus.value = 'loading';
  setCaptchaLoadingVisible(true);
  try {
    const res = await loadWithCaptchaRetry(() => getCaptchaApi('login'));
    if (seq !== captchaLoadSeq) return;
    captcha.value = res;
    captchaId.value = res.captchaId;
    captchaVerified.value = !isCaptchaEnabled(res);
    captchaStatus.value = 'ready';
  } catch {
    if (seq !== captchaLoadSeq) return;
    captcha.value = null;
    captchaId.value = '';
    captchaVerified.value = false;
    captchaStatus.value = 'error';
  } finally {
    if (seq === captchaLoadSeq) {
      setCaptchaLoadingVisible(false);
    }
  }
}

async function retryCaptcha() {
  if (captchaStatus.value === 'loading') {
    return;
  }
  captchaVerified.value = false;
  captcha.value = null;
  captchaId.value = '';
  await loadCaptcha();
}

async function resetCaptcha(reload = false) {
  captchaVerified.value = false;
  captchaWidgetRef.value?.resume();
  if (reload) {
    captcha.value = null;
    captchaId.value = '';
    await loadCaptcha();
  }
}

async function onCaptchaSuccess(values: AuthApi.CaptchaVerifyPayload) {
  if (!captcha.value || captchaChecking.value) return;
  captchaChecking.value = true;
  try {
    await verifyCaptchaApi(captcha.value, values);
    captchaVerified.value = true;
  } catch {
    await resetCaptcha(true);
  } finally {
    captchaChecking.value = false;
  }
}

const formSchema = computed((): VbenFormSchema[] => [
  {
    component: 'VbenInput',
    componentProps: {
      placeholder: $t('authentication.loginAccountTip'),
    },
    fieldName: 'username',
    label: $t('authentication.loginAccount'),
    rules: z.string().min(1, { message: $t('authentication.loginAccountTip') }),
  },
  {
    component: 'VbenInputPassword',
    componentProps: {
      placeholder: $t('authentication.password'),
    },
    fieldName: 'password',
    label: $t('authentication.password'),
    rules: z.string().min(1, { message: $t('authentication.passwordTip') }),
  },
]);

async function onSubmit(params: Recordable<any>) {
  if (captchaChecking.value) {
    message.info($t('page.auth.loginCaptchaChecking'));
    return;
  }
  if (captchaRequired.value && !captchaVerified.value) {
    // 挑战没拿到（或正在重试）时不要只弹一句「请完成验证」把用户堵死：
    // 立刻再拉一次，并说明页面正在重新加载。
    if (captchaStatus.value !== 'ready') {
      void retryCaptcha();
      message.warning($t('captchaWidget.loading'));
      return;
    }
    message.warning($t('authentication.verifyRequiredTip'));
    return;
  }
  try {
    // 不再直接走 authStore.authLogin：需要先看登录结果是否要求 2FA。
    const result = await loginApi({
      ...params,
      captchaId: captchaId.value,
    });
    if (result.twoFARequired && result.challengeToken) {
      twoFAChallengeToken.value = result.challengeToken;
      twoFACode.value = '';
      twoFAModalOpen.value = true;
      return;
    }
    await authStore.authLoginByAccessToken(
      result.accessToken,
      redirectTarget.value || undefined,
    );
  } catch {
    await resetCaptcha(true);
  }
}

// 网络恢复或标签页重新可见时，把之前的失败状态自动补回来，
// 用户不用手动刷新整页。
function reloadCaptchaIfFailed() {
  if (captchaStatus.value === 'error') {
    void retryCaptcha();
  }
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    reloadCaptchaIfFailed();
  }
}

onMounted(() => {
  void loadCaptcha();
  window.addEventListener('online', reloadCaptchaIfFailed);
  document.addEventListener('visibilitychange', handleVisibilityChange);
});

onBeforeUnmount(() => {
  window.removeEventListener('online', reloadCaptchaIfFailed);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  // 让在途的重试结果失效，避免组件卸载后回写状态。
  captchaLoadSeq += 1;
  setCaptchaLoadingVisible(false);
});
</script>

<template>
  <AuthenticationLogin
    :form-schema="formSchema"
    :loading="authStore.loginLoading"
    :show-code-login="false"
    :show-qrcode-login="false"
    :show-third-party-login="false"
    @submit="onSubmit"
  >
    <template #form-after>
      <div
        v-if="captchaStatus === 'error'"
        class="mb-3 flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700"
      >
        <span>{{ $t('captchaWidget.loadFailed') }}</span>
        <button
          class="shrink-0 cursor-pointer font-medium text-primary underline"
          type="button"
          @click="retryCaptcha"
        >
          {{ $t('captchaWidget.retry') }}
        </button>
      </div>
      <div
        v-else-if="showCaptchaLoading && !captcha"
        class="text-muted-foreground mb-3 text-center text-xs"
      >
        {{ $t('captchaWidget.loading') }}
      </div>
      <CaptchaWidget
        v-if="captcha && captchaRequired"
        ref="captchaWidgetRef"
        class="mb-4"
        name="captcha"
        :challenge="captcha"
        :disabled="captchaChecking"
        @success="onCaptchaSuccess"
      />
      <OAuthProviderButtons />
      <p class="text-muted-foreground mb-4 text-center text-xs leading-5">
        {{ $t('legal.auth.loginNoticePrefix') }}
        <RouterLink class="text-primary hover:underline" to="/privacy-policy">
          {{ $t('legal.common.privacyPolicy') }}
        </RouterLink>
        {{ $t('legal.auth.separator') }}
        <RouterLink class="text-primary hover:underline" to="/terms-of-service">
          {{ $t('legal.common.termsOfService') }}
        </RouterLink>
      </p>
    </template>
  </AuthenticationLogin>

  <Modal
    :closable="!twoFASubmitting"
    :confirm-loading="twoFASubmitting"
    :keyboard="!twoFASubmitting"
    :mask-closable="false"
    :open="twoFAModalOpen"
    :ok-text="$t('page.auth.twoFA.verify')"
    :title="$t('page.auth.twoFA.title')"
    @cancel="cancelTwoFALogin"
    @ok="completeTwoFALogin"
  >
    <div class="space-y-3 py-2">
      <p class="text-sm text-gray-500">
        {{ $t('page.auth.twoFA.description') }}
      </p>
      <Input
        v-model:value="twoFACode"
        :disabled="twoFASubmitting"
        :maxlength="11"
        :placeholder="$t('page.auth.twoFA.placeholder')"
        autocomplete="one-time-code"
        inputmode="numeric"
        size="large"
        @keydown.enter="completeTwoFALogin"
      />
    </div>
  </Modal>
</template>
