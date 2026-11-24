<script setup lang="ts">
import type { VbenFormSchema } from '#/adapter/form';
import type { AuthApi } from '#/api';

import { computed, ref } from 'vue';

import { ProfilePasswordSetting, z } from '@vben/common-ui';

import { Alert, Modal, message } from 'ant-design-vue';

import {
  getCaptchaApi,
  isCaptchaEnabled,
  setInitialPasswordApi,
  verifyCaptchaApi,
} from '#/api';
import CaptchaWidget from '#/components/captcha-widget/CaptchaWidget.vue';
import { $t } from '#/locales';
import { useAuthStore } from '#/store';
import { isValidPassword } from '#/utils/password-policy';

const emit = defineEmits<{ success: [] }>();

const authStore = useAuthStore();
const saving = ref(false);
const captchaModalOpen = ref(false);
const captchaId = ref('');
const captcha = ref<AuthApi.CaptchaResult | null>(null);
const captchaModalKey = ref(0);
let pendingValues: null | Record<string, any> = null;

function resetCaptcha() {
  captchaModalOpen.value = false;
  captcha.value = null;
  pendingValues = null;
}

async function loadAndShowCaptcha() {
  try {
    const result = await getCaptchaApi('change_password');
    if (!isCaptchaEnabled(result)) {
      const valuesToSubmit = pendingValues;
      pendingValues = null;
      captcha.value = null;
      captchaId.value = '';
      if (valuesToSubmit) {
        await doSetPassword(valuesToSubmit);
      }
      return;
    }
    captcha.value = result;
    captchaId.value = result.captchaId;
    captchaModalKey.value += 1;
    captchaModalOpen.value = true;
  } catch {
    pendingValues = null;
    message.error($t('profile.password.captchaLoadFailed'));
  }
}

async function onCaptchaSuccess(values: AuthApi.CaptchaVerifyPayload) {
  if (!captcha.value || !pendingValues) return;
  const valuesToSubmit = pendingValues;
  try {
    await verifyCaptchaApi(captcha.value, values);
  } catch {
    resetCaptcha();
    return;
  }
  captchaModalOpen.value = false;
  pendingValues = null;
  await doSetPassword(valuesToSubmit);
}

const formSchema = computed((): VbenFormSchema[] => [
  {
    fieldName: 'password',
    label: $t('profile.password.new'),
    component: 'VbenInputPassword',
    componentProps: {
      passwordStrength: true,
      placeholder: $t('profile.password.newPlaceholder'),
    },
    rules: z.string().refine(isValidPassword, {
      message: $t('profile.password.policy'),
    }),
  },
  {
    fieldName: 'confirmPassword',
    label: $t('profile.password.confirm'),
    component: 'VbenInputPassword',
    componentProps: { placeholder: $t('profile.password.confirmPlaceholder') },
    dependencies: {
      rules(values) {
        return z
          .string({ required_error: $t('profile.password.confirmRequired') })
          .min(1, { message: $t('profile.password.confirmRequired') })
          .refine((value) => value === values.password, {
            message: $t('profile.password.mismatch'),
          });
      },
      triggerFields: ['password'],
    },
  },
]);

async function handleSubmit(values: Record<string, any>) {
  pendingValues = values;
  await loadAndShowCaptcha();
}

async function doSetPassword(values: Record<string, any>) {
  saving.value = true;
  try {
    await setInitialPasswordApi({
      captchaId: captchaId.value,
      confirmPassword: values.confirmPassword,
      password: values.password,
    });
    await authStore.fetchUserInfo();
    message.success($t('profile.password.setSuccess'));
    emit('success');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="w-full md:max-w-xl">
    <Alert
      :message="$t('profile.password.setDescription')"
      class="mb-4"
      type="info"
      show-icon
    />
    <ProfilePasswordSetting
      :form-schema="formSchema"
      :loading="saving"
      @submit="handleSubmit"
    />
  </div>
  <Modal
    :open="captchaModalOpen"
    :closable="false"
    :mask-closable="false"
    :title="$t('profile.password.captchaTitle')"
    :footer="null"
    width="380px"
    @cancel="resetCaptcha"
  >
    <div class="space-y-4 py-2">
      <p class="text-muted-foreground text-sm">
        {{ $t('profile.password.captchaDescription') }}
      </p>
      <CaptchaWidget
        :key="captchaModalKey"
        :challenge="captcha"
        @success="onCaptchaSuccess"
      />
    </div>
  </Modal>
</template>