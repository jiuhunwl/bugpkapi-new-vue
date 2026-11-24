<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';

import type { AuthApi } from '#/api';

import { computed, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { AuthenticationForgetPassword, z } from '@vben/common-ui';

import { message, Modal } from 'ant-design-vue';

import {
  checkPasswordResetAccountApi,
  getCaptchaApi,
  isCaptchaEnabled,
  resetPasswordApi,
  sendPasswordResetEmailCodeApi,
  verifyCaptchaApi,
  verifyPasswordResetCodeApi,
} from '#/api';
import CaptchaWidget from '#/components/captcha-widget/CaptchaWidget.vue';
import { $t } from '#/locales';
import { isValidPassword } from '#/utils/password-policy';

defineOptions({ name: 'ForgetPassword' });

type ResetStep = 'account' | 'reset' | 'verify';

const router = useRouter();
const step = ref<ResetStep>('account');
const loading = ref(false);
const sendingCode = ref(false);
const codeCountdown = ref(0);
const account = ref('');
const maskedEmail = ref('');
const resetToken = ref('');
const captchaModalOpen = ref(false);
const captchaModalKey = ref(0);
const captchaChecking = ref(false);
const captcha = ref<AuthApi.CaptchaResult | null>(null);
let countdownTimer: null | number = null;

const text = (key: string, args?: string[]) =>
  args
    ? $t(`page.auth.passwordReset.${key}`, args)
    : $t(`page.auth.passwordReset.${key}`);

const pageTitle = computed(() => text(`title.${step.value}`));
const pageSubTitle = computed(() =>
  step.value === 'verify'
    ? text('subtitle.verify', [maskedEmail.value])
    : text(`subtitle.${step.value}`),
);
const submitButtonText = computed(() => text(`actions.${step.value}`));
const sendCodeText = computed(() => {
  if (codeCountdown.value > 0) {
    return text('actions.resendAfter', [String(codeCountdown.value)]);
  }
  return text(sendingCode.value ? 'actions.sending' : 'actions.sendCode');
});

const formSchema = computed((): VbenFormSchema[] => {
  if (step.value === 'verify') {
    return [
      {
        component: 'VbenInput',
        componentProps: {
          maxlength: 6,
          placeholder: text('fields.codePlaceholder'),
        },
        fieldName: 'code',
        label: text('fields.code'),
        rules: z
          .string({ required_error: text('validation.code') })
          .regex(/^\d{6}$/, { message: text('validation.code') }),
      },
      {
        // 启用了 2FA 的账号（如管理员）在邮箱验证码之外还必须提交认证器
        // 动态码。服务端为防枚举不预告该账号是否启用 2FA，因此这里以
        // 可选字段呈现：未启用时留空即可，启用时未填会在服务端被拒。
        component: 'VbenInput',
        componentProps: {
          maxlength: 11,
          placeholder: text('fields.totpPlaceholder'),
        },
        fieldName: 'totpCode',
        label: text('fields.totp'),
      },
    ];
  }
  if (step.value === 'reset') {
    return [
      {
        component: 'VbenInputPassword',
        componentProps: {
          passwordStrength: true,
          placeholder: text('fields.passwordPlaceholder'),
        },
        fieldName: 'password',
        label: text('fields.password'),
        rules: z
          .string({ required_error: text('validation.passwordRequired') })
          .refine(isValidPassword, {
            message: text('validation.passwordPolicy'),
          }),
      },
      {
        component: 'VbenInputPassword',
        componentProps: {
          placeholder: text('fields.confirmPasswordPlaceholder'),
        },
        dependencies: {
          rules(values) {
            return z
              .string({ required_error: text('validation.confirmPassword') })
              .min(1, { message: text('validation.confirmPassword') })
              .refine((value) => value === values.password, {
                message: text('validation.passwordMismatch'),
              });
          },
          triggerFields: ['password'],
        },
        fieldName: 'confirmPassword',
        label: text('fields.confirmPassword'),
      },
    ];
  }
  return [
    {
      component: 'VbenInput',
      componentProps: { placeholder: text('fields.accountPlaceholder') },
      defaultValue: account.value,
      fieldName: 'account',
      label: text('fields.account'),
      rules: z
        .string({ required_error: text('validation.accountRequired') })
        .min(1, { message: text('validation.accountRequired') })
        .max(128, { message: text('validation.accountMax') }),
    },
  ];
});

function startCountdown() {
  codeCountdown.value = 60;
  if (countdownTimer !== null) window.clearInterval(countdownTimer);
  countdownTimer = window.setInterval(() => {
    codeCountdown.value -= 1;
    if (codeCountdown.value <= 0 && countdownTimer !== null) {
      window.clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }, 1000);
}

async function sendCode() {
  if (account.value && !sendingCode.value && codeCountdown.value <= 0) {
    await openSendCodeCaptcha();
  }
}

async function sendPasswordResetCode(captchaId: string) {
  sendingCode.value = true;
  try {
    await sendPasswordResetEmailCodeApi(account.value, captchaId);
    message.success(text('messages.codeSent'));
    startCountdown();
  } finally {
    sendingCode.value = false;
  }
}

async function openSendCodeCaptcha() {
  try {
    const result = await getCaptchaApi('password_reset');
    if (!isCaptchaEnabled(result)) {
      captcha.value = null;
      await sendPasswordResetCode('');
      return;
    }
    captcha.value = result;
    captchaModalKey.value++;
    captchaModalOpen.value = true;
  } catch {
    captcha.value = null;
    message.error(text('messages.captchaLoadFailed'));
  }
}

function closeSendCodeCaptcha() {
  if (captchaChecking.value) return;
  captchaModalOpen.value = false;
  captcha.value = null;
}

async function reloadSendCodeCaptcha() {
  try {
    const result = await getCaptchaApi('password_reset');
    if (!isCaptchaEnabled(result)) {
      captchaModalOpen.value = false;
      captcha.value = null;
      await sendPasswordResetCode('');
      return;
    }
    captcha.value = result;
    captchaModalKey.value++;
  } catch {
    captchaModalOpen.value = false;
    captcha.value = null;
    message.error(text('messages.captchaLoadFailed'));
  }
}

async function onSendCodeCaptchaSuccess(values: AuthApi.CaptchaVerifyPayload) {
  if (!captcha.value || captchaChecking.value) return;
  captchaChecking.value = true;
  const currentCaptcha = captcha.value;
  try {
    await verifyCaptchaApi(currentCaptcha, values);
  } catch {
    await reloadSendCodeCaptcha();
    captchaChecking.value = false;
    return;
  }
  captchaChecking.value = false;
  captchaModalOpen.value = false;
  captcha.value = null;
  try {
    await sendPasswordResetCode(currentCaptcha.captchaId);
  } catch {
    // The shared request client displays the backend error.
  } finally {
    sendingCode.value = false;
  }
}

function backToAccount() {
  step.value = 'account';
  maskedEmail.value = '';
  resetToken.value = '';
  codeCountdown.value = 0;
  if (countdownTimer !== null) {
    window.clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

async function handleSubmit(value: Record<string, unknown>) {
  if (loading.value) return;
  loading.value = true;
  try {
    if (step.value === 'account') {
      const nextAccount = String(value.account ?? '').trim();
      const result = await checkPasswordResetAccountApi(nextAccount);
      account.value = nextAccount;
      maskedEmail.value = result.maskedEmail;
      step.value = 'verify';
      message.success(text('messages.accountAccepted'));
      return;
    }
    if (step.value === 'verify') {
      const result = await verifyPasswordResetCodeApi(
        account.value,
        String(value.code ?? '').trim(),
        String(value.totpCode ?? '').trim() || undefined,
      );
      resetToken.value = result.resetToken;
      step.value = 'reset';
      message.success(text('messages.codeVerified'));
      return;
    }
    await resetPasswordApi(
      resetToken.value,
      String(value.password ?? ''),
      String(value.confirmPassword ?? ''),
    );
    message.success(text('messages.passwordChanged'));
    await router.push('/auth/login');
  } finally {
    loading.value = false;
  }
}

onUnmounted(() => {
  if (countdownTimer !== null) window.clearInterval(countdownTimer);
  captchaModalOpen.value = false;
  captcha.value = null;
});
</script>

<template>
  <div class="forget-password-page">
    <AuthenticationForgetPassword
      :key="step"
      :form-schema="formSchema"
      :loading="loading"
      :submit-button-text="submitButtonText"
      :sub-title="pageSubTitle"
      :title="pageTitle"
      @submit="handleSubmit"
    >
      <div v-if="step !== 'account'" class="reset-step-card">
        <div>
          <div class="reset-step-card__label">
            {{ text('labels.currentAccount') }}
          </div>
          <div class="reset-step-card__value">{{ account }}</div>
        </div>
        <button
          class="reset-step-card__link"
          type="button"
          @click="backToAccount"
        >
          {{ text('actions.reenter') }}
        </button>
      </div>

      <div v-if="step === 'verify'" class="reset-email-card">
        <div>
          <div class="reset-email-card__label">
            {{ text('labels.secureEmail') }}
          </div>
          <div class="reset-email-card__value">{{ maskedEmail }}</div>
        </div>
        <button
          class="reset-email-card__button"
          :disabled="sendingCode || codeCountdown > 0"
          type="button"
          @click="sendCode"
        >
          {{ sendCodeText }}
        </button>
      </div>
    </AuthenticationForgetPassword>

    <Modal
      :closable="!captchaChecking"
      :footer="null"
      :mask-closable="false"
      :open="captchaModalOpen"
      :title="text('captcha.title')"
      width="380px"
      @cancel="closeSendCodeCaptcha"
    >
      <div class="space-y-4 py-2">
        <p class="text-sm text-gray-500">{{ text('captcha.description') }}</p>
        <CaptchaWidget
          :key="captchaModalKey"
          :challenge="captcha"
          @success="onSendCodeCaptchaSuccess"
        />
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.reset-step-card,
.reset-email-card {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  margin-bottom: 14px;
  background: hsl(var(--muted) / 32%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.reset-email-card {
  background: hsl(var(--primary) / 6%);
  border-color: hsl(var(--primary) / 18%);
}

.reset-step-card__label,
.reset-email-card__label {
  margin-bottom: 3px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.reset-step-card__value,
.reset-email-card__value {
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
  font-weight: 700;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.reset-step-card__link,
.reset-email-card__button {
  flex: 0 0 auto;
  height: 32px;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 700;
  color: hsl(var(--primary));
  cursor: pointer;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 7px;
}

.reset-email-card__button {
  color: hsl(var(--primary-foreground));
  background: hsl(var(--primary));
  border-color: hsl(var(--primary));
}

.reset-email-card__button:disabled {
  color: hsl(var(--muted-foreground));
  cursor: not-allowed;
  background: hsl(var(--muted));
  border-color: hsl(var(--border));
}

@media (max-width: 479px) {
  .reset-step-card,
  .reset-email-card {
    flex-direction: column;
    align-items: stretch;
  }

  .reset-step-card__value,
  .reset-email-card__value {
    max-width: 100%;
  }

  .reset-step-card__link,
  .reset-email-card__button {
    width: 100%;
    min-height: 44px;
  }
}
</style>
