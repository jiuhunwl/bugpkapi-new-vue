<script lang="ts" setup>
import { onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Alert, Button, message } from 'ant-design-vue';

import { useVbenForm, z } from '#/adapter/form';
import { getOpenApiConfig, updateOpenApiConfig } from '#/api/open-api';
import { $t } from '#/locales';

const MAX_EXPIRE_DAYS = 3650;
const MAX_IP_WHITELIST = 100;

const saving = ref(false);

const [ConfigForm, configFormApi] = useVbenForm({
  commonConfig: {
    colon: true,
    componentProps: { class: 'w-full' },
    formItemClass: 'col-span-1',
    labelWidth: 190,
  },
  layout: 'horizontal',
  schema: [
    {
      component: 'Switch',
      componentProps: {
        checkedChildren: $t('system.openApi.configEnabledOn'),
        class: 'w-auto',
        unCheckedChildren: $t('system.openApi.configEnabledOff'),
      },
      defaultValue: true,
      fieldName: 'enabled',
      help: $t('system.openApi.enabledHelp'),
      label: $t('system.openApi.enabled'),
    },
    {
      component: 'InputNumber',
      componentProps: {
        max: MAX_IP_WHITELIST,
        min: 0,
        precision: 0,
        step: 10,
      },
      fieldName: 'ipWhitelistMax',
      help: $t('system.openApi.ipWhitelistMaxHelp'),
      label: $t('system.openApi.ipWhitelistMax'),
      rules: z.number().min(0).max(MAX_IP_WHITELIST),
    },
    {
      component: 'InputNumber',
      componentProps: {
        max: MAX_EXPIRE_DAYS,
        min: 1,
        precision: 0,
        step: 30,
      },
      fieldName: 'keyDefaultExpireDays',
      help: $t('system.openApi.keyDefaultExpireDaysHelp'),
      label: $t('system.openApi.keyDefaultExpireDays'),
      rules: z.number().min(1).max(MAX_EXPIRE_DAYS),
    },
    {
      component: 'InputNumber',
      componentProps: {
        max: MAX_EXPIRE_DAYS,
        min: 1,
        precision: 0,
        step: 30,
      },
      fieldName: 'adminKeyExpireDays',
      help: $t('system.openApi.adminKeyExpireDaysHelp'),
      label: $t('system.openApi.adminKeyExpireDays'),
      rules: z.number().min(1).max(MAX_EXPIRE_DAYS),
    },
    {
      component: 'InputNumber',
      componentProps: {
        max: 1_000_000,
        min: 0,
        precision: 0,
        step: 60,
      },
      fieldName: 'rateLimitNormal',
      help: $t('system.openApi.rateLimitNormalHelp'),
      label: $t('system.openApi.rateLimitNormal'),
      rules: z.number().min(0).max(1_000_000),
    },
    {
      component: 'InputNumber',
      componentProps: {
        max: 1_000_000,
        min: 0,
        precision: 0,
        step: 60,
      },
      fieldName: 'rateLimitAdmin',
      help: $t('system.openApi.rateLimitAdminHelp'),
      label: $t('system.openApi.rateLimitAdmin'),
      rules: z.number().min(0).max(1_000_000),
    },
  ],
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 gap-x-4 gap-y-2 md:grid-cols-2',
});

async function loadConfig() {
  saving.value = true;
  try {
    const config = await getOpenApiConfig();
    await configFormApi.setValues({
      adminKeyExpireDays: Number(config.adminKeyExpireDays || 90),
      enabled: config.enabled !== false,
      ipWhitelistMax: Number(config.ipWhitelistMax ?? 20),
      keyDefaultExpireDays: Number(config.keyDefaultExpireDays || 30),
      rateLimitAdmin: Number(config.rateLimitAdmin ?? 0),
      rateLimitNormal: Number(config.rateLimitNormal ?? 0),
    });
  } finally {
    saving.value = false;
  }
}

async function onSubmit() {
  const { valid } = await configFormApi.validate();
  if (!valid) return;
  saving.value = true;
  try {
    const values = await configFormApi.getValues();
    await updateOpenApiConfig({
      adminKeyExpireDays: normalizeDay(values.adminKeyExpireDays, 90),
      enabled: Boolean(values.enabled),
      ipWhitelistMax: normalizeInt(values.ipWhitelistMax, 20),
      keyDefaultExpireDays: normalizeDay(values.keyDefaultExpireDays, 30),
      rateLimitAdmin: normalizeInt(values.rateLimitAdmin, 0),
      rateLimitNormal: normalizeInt(values.rateLimitNormal, 0),
    });
    message.success($t('system.openApi.configSaveSuccess'));
  } finally {
    saving.value = false;
  }
}

function normalizeInt(value: unknown, fallback: number) {
  const num = Number(value);
  return Number.isFinite(num) ? Math.max(0, Math.floor(num)) : fallback;
}

function normalizeDay(value: unknown, fallback: number) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(MAX_EXPIRE_DAYS, Math.max(1, Math.floor(num)));
}

onMounted(() => {
  void loadConfig();
});
</script>

<template>
  <Page auto-content-height>
    <div class="bg-card rounded-md p-6">
      <ConfigForm />
      <Alert
        class="mt-4"
        show-icon
        type="info"
        :message="$t('system.openApi.configTip')"
      />
      <div class="mt-4 flex justify-end">
        <Button :loading="saving" type="primary" @click="onSubmit">
          {{ $t('system.openApi.save') }}
        </Button>
      </div>
    </div>
  </Page>
</template>
