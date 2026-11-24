<script lang="ts" setup>
import type { SystemRoleApi } from '#/api/system/role';

import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Alert, Button, message } from 'ant-design-vue';

import { useVbenForm, z } from '#/adapter/form';
import {
  getEmailDomainRules,
  getRegisterOpenConfig,
  updateEmailDomainRules,
  updateRegisterOpenConfig,
} from '#/api/system/register';
import { getRoleOptions } from '#/api/system/role';
import { $t } from '#/locales';

const openLoading = ref(false);
const registerRoleOptions = ref<SystemRoleApi.RoleOption[]>([]);
const selectedDefaultRoleId = ref('');
const selectedDefaultRole = computed(() =>
  registerRoleOptions.value.find(
    (role) => String(role.id) === selectedDefaultRoleId.value,
  ),
);

const [OpenForm, openFormApi] = useVbenForm({
  commonConfig: {
    colon: true,
    componentProps: { class: 'w-full' },
    formItemClass: 'col-span-1',
    labelWidth: 150,
  },
  layout: 'horizontal',
  schema: [
    {
      component: 'Switch',
      componentProps: {
        checkedChildren: $t('system.register.enableAction'),
        class: 'w-auto',
        unCheckedChildren: $t('system.register.disableAction'),
      },
      defaultValue: true,
      fieldName: 'registerEnabled',
      label: $t('system.register.openRegister'),
    },
    {
      component: 'Select',
      componentProps: () => ({
        options: registerRoleOptions.value.map((role) => ({
          label: `${role.name} · ${Number(role.qpsLimit).toLocaleString()} QPS`,
          value: String(role.id),
        })),
        placeholder: $t('system.register.defaultRolePlaceholder'),
      }),
      fieldName: 'defaultRoleId',
      label: $t('system.register.defaultRole'),
      rules: 'selectRequired',
    },
    {
      component: 'InputNumber',
      componentProps: { max: 1_000_000_000, min: 0, precision: 0, step: 100 },
      defaultValue: 0,
      fieldName: 'registerGiftPoints',
      label: $t('system.register.registerGiftPoints'),
      rules: z.number().min(0).max(1_000_000_000),
    },
    {
      component: 'InputNumber',
      componentProps: { max: 1_000_000, min: 0, precision: 0, step: 1 },
      defaultValue: 5,
      fieldName: 'verificationCodeIpMinuteLimit',
      label: $t('system.register.verificationCodeIpMinuteLimit'),
      rules: z.number().min(0).max(1_000_000),
    },
    {
      component: 'InputNumber',
      componentProps: { max: 1_000_000, min: 0, precision: 0, step: 1 },
      defaultValue: 20,
      fieldName: 'verificationCodeIpHourLimit',
      label: $t('system.register.verificationCodeIpHourLimit'),
      rules: z.number().min(0).max(1_000_000),
    },
    {
      component: 'InputNumber',
      componentProps: { max: 1_000_000, min: 0, precision: 0, step: 1 },
      defaultValue: 50,
      fieldName: 'verificationCodeIpDayLimit',
      label: $t('system.register.verificationCodeIpDayLimit'),
      rules: z.number().min(0).max(1_000_000),
    },
    {
      component: 'InputNumber',
      componentProps: { max: 1_000_000, min: 0, precision: 0, step: 1 },
      defaultValue: 10,
      fieldName: 'registerIpHourLimit',
      label: $t('system.register.registerIpHourLimit'),
      rules: z.number().min(0).max(1_000_000),
    },
    {
      component: 'InputNumber',
      componentProps: { max: 1_000_000, min: 0, precision: 0, step: 1 },
      defaultValue: 0,
      fieldName: 'registerIpDayLimit',
      label: $t('system.register.registerIpDayLimit'),
      rules: z.number().min(0).max(1_000_000),
    },
    {
      component: 'InputNumber',
      componentProps: { max: 1_000_000, min: 0, precision: 0, step: 1 },
      defaultValue: 0,
      fieldName: 'registerIpMaxAccounts',
      label: $t('system.register.registerIpMaxAccounts'),
      rules: z.number().min(0).max(1_000_000),
    },
    {
      component: 'InputNumber',
      componentProps: { max: 100_000_000, min: 0, precision: 0, step: 100 },
      defaultValue: 0,
      fieldName: 'newAccountDayLimit',
      help: $t('system.register.newAccountDayLimitHelp'),
      label: $t('system.register.newAccountDayLimit'),
      rules: z.number().min(0).max(100_000_000),
    },
    {
      component: 'InputNumber',
      componentProps: { max: 1_000_000, min: 0, precision: 0, step: 1 },
      defaultValue: 5,
      fieldName: 'registerDeviceDayLimit',
      help: $t('system.register.registerDeviceDayLimitHelp'),
      label: $t('system.register.registerDeviceDayLimit'),
      rules: z.number().min(0).max(1_000_000),
    },
    {
      component: 'InputNumber',
      componentProps: { max: 1_000_000, min: 0, precision: 0, step: 1 },
      defaultValue: 10,
      fieldName: 'registerIpPrefixDayLimit',
      help: $t('system.register.registerIpPrefixDayLimitHelp'),
      label: $t('system.register.registerIpPrefixDayLimit'),
      rules: z.number().min(0).max(1_000_000),
    },
    {
      component: 'Switch',
      componentProps: {
        checkedChildren: $t('system.register.enableAction'),
        class: 'w-auto',
        unCheckedChildren: $t('system.register.disableAction'),
      },
      defaultValue: true,
      fieldName: 'registerRiskEnabled',
      help: $t('system.register.registerRiskEnabledHelp'),
      label: $t('system.register.registerRiskEnabled'),
    },
    {
      component: 'Switch',
      componentProps: {
        checkedChildren: $t('system.register.enableAction'),
        class: 'w-auto',
        unCheckedChildren: $t('system.register.disableAction'),
      },
      defaultValue: true,
      fieldName: 'registerRiskShadowMode',
      help: $t('system.register.registerRiskShadowModeHelp'),
      label: $t('system.register.registerRiskShadowMode'),
    },
    {
      component: 'InputNumber',
      componentProps: { max: 200, min: 0, precision: 0, step: 5 },
      defaultValue: 40,
      fieldName: 'registerRiskQuarantineScore',
      help: $t('system.register.registerRiskScoreHelp'),
      label: $t('system.register.registerRiskQuarantineScore'),
      rules: z.number().min(0).max(200),
    },
    {
      component: 'InputNumber',
      componentProps: { max: 200, min: 0, precision: 0, step: 5 },
      defaultValue: 75,
      fieldName: 'registerRiskRejectScore',
      help: $t('system.register.registerRiskScoreHelp'),
      label: $t('system.register.registerRiskRejectScore'),
      rules: z.number().min(0).max(200),
    },
    {
      component: 'Switch',
      componentProps: {
        checkedChildren: $t('system.register.enableAction'),
        class: 'w-auto',
        unCheckedChildren: $t('system.register.disableAction'),
      },
      defaultValue: true,
      fieldName: 'oauthRegisterEnabled',
      label: $t('system.register.oauthRegisterEnabled'),
    },
    {
      component: 'Select',
      componentProps: {
        options: [
          { label: $t('system.register.oauthModeOff'), value: 'off' },
          { label: $t('system.register.oauthModeConfirm'), value: 'confirm' },
          { label: $t('system.register.oauthModeAuto'), value: 'auto' },
        ],
      },
      defaultValue: 'confirm',
      fieldName: 'oauthRegisterModeDefault',
      label: $t('system.register.oauthRegisterModeDefault'),
    },
    {
      component: 'InputNumber',
      componentProps: { max: 1_000_000, min: 0, precision: 0, step: 1 },
      defaultValue: 0,
      fieldName: 'oauthRegisterIpHourLimit',
      label: $t('system.register.oauthRegisterIpHourLimit'),
      rules: z.number().min(0).max(1_000_000),
    },
    {
      component: 'InputNumber',
      componentProps: { max: 1_000_000, min: 0, precision: 0, step: 1 },
      defaultValue: 10,
      fieldName: 'oauthRegisterIpDayLimit',
      label: $t('system.register.oauthRegisterIpDayLimit'),
      rules: z.number().min(0).max(1_000_000),
    },
    {
      component: 'InputNumber',
      componentProps: { max: 1_000_000, min: 0, precision: 0, step: 1 },
      defaultValue: 0,
      fieldName: 'oauthRegisterIpMaxAccounts',
      label: $t('system.register.oauthRegisterIpMaxAccounts'),
      rules: z.number().min(0).max(1_000_000),
    },
    {
      component: 'Switch',
      componentProps: {
        checkedChildren: $t('system.register.enableAction'),
        class: 'w-auto',
        unCheckedChildren: $t('system.register.disableAction'),
      },
      defaultValue: false,
      fieldName: 'oauthRequireVerifiedEmail',
      label: $t('system.register.oauthRequireVerifiedEmail'),
    },
    {
      component: 'Textarea',
      componentProps: {
        placeholder: $t('system.register.emailWhitelistHint'),
        rows: 4,
      },
      defaultValue: '',
      fieldName: 'emailWhitelistDomains',
      formItemClass: 'col-span-2',
      label: $t('system.register.emailWhitelistDomains'),
    },
    {
      component: 'Textarea',
      componentProps: {
        placeholder: $t('system.register.emailBlacklistHint'),
        rows: 4,
      },
      defaultValue: '',
      fieldName: 'emailBlacklistDomains',
      formItemClass: 'col-span-2',
      label: $t('system.register.emailBlacklistDomains'),
    },
  ],
  handleValuesChange(values) {
    selectedDefaultRoleId.value = String(values.defaultRoleId ?? '');
  },
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 gap-x-4 gap-y-2 md:grid-cols-2',
});

async function loadOpenConfig() {
  openLoading.value = true;
  try {
    const [config, roles] = await Promise.all([
      getRegisterOpenConfig(),
      getRoleOptions(),
    ]);
    registerRoleOptions.value = roles.filter(
      (role) =>
        role.status === 1 &&
        role.selfRegisterEnabled === 1 &&
        role.roleKey !== 'admin',
    );
    const configuredRoleId = String(config.defaultRoleId ?? '');
    const fallbackRole =
      registerRoleOptions.value.find((role) => role.roleKey === 'user') ??
      registerRoleOptions.value[0];
    selectedDefaultRoleId.value = registerRoleOptions.value.some(
      (role) => String(role.id) === configuredRoleId,
    )
      ? configuredRoleId
      : String(fallbackRole?.id ?? '');
    await openFormApi.setValues({
      defaultRoleId: selectedDefaultRoleId.value,
      registerIpHourLimit: Number(config.registerIpHourLimit ?? 10),
      registerIpDayLimit: Number(config.registerIpDayLimit ?? 0),
      registerIpMaxAccounts: Number(config.registerIpMaxAccounts ?? 0),
      newAccountDayLimit: Number(config.newAccountDayLimit ?? 0),
      registerDeviceDayLimit: Number(config.registerDeviceDayLimit ?? 5),
      registerIpPrefixDayLimit: Number(config.registerIpPrefixDayLimit ?? 10),
      registerRiskEnabled: (config.registerRiskEnabled ?? 1) === 1,
      registerRiskShadowMode: (config.registerRiskShadowMode ?? 1) === 1,
      registerRiskQuarantineScore: Number(config.registerRiskQuarantineScore ?? 40),
      registerRiskRejectScore: Number(config.registerRiskRejectScore ?? 75),
      registerEnabled: (config.registerEnabled ?? 1) === 1,
      registerGiftPoints: Number(config.registerGiftPoints ?? 0),
      oauthRegisterEnabled: (config.oauthRegisterEnabled ?? 1) === 1,
      oauthRegisterModeDefault: config.oauthRegisterModeDefault ?? 'confirm',
      oauthRegisterIpHourLimit: Number(config.oauthRegisterIpHourLimit ?? 0),
      oauthRegisterIpDayLimit: Number(config.oauthRegisterIpDayLimit ?? 10),
      oauthRegisterIpMaxAccounts: Number(
        config.oauthRegisterIpMaxAccounts ?? 0,
      ),
      oauthRequireVerifiedEmail: (config.oauthRequireVerifiedEmail ?? 0) === 1,
      verificationCodeIpDayLimit: Number(config.verificationCodeIpDayLimit ?? 50),
      verificationCodeIpHourLimit: Number(config.verificationCodeIpHourLimit ?? 20),
      verificationCodeIpMinuteLimit: Number(config.verificationCodeIpMinuteLimit ?? 5),
    });
    const domainRules = await getEmailDomainRules();
    await openFormApi.setValues({
      emailWhitelistDomains: (domainRules.whitelist ?? []).join('\n'),
      emailBlacklistDomains: (domainRules.blacklist ?? []).join('\n'),
    });
  } finally {
    openLoading.value = false;
  }
}

function parseDomainLines(value: unknown): string[] {
  return String(value ?? '')
    .split(/[\n,;，；\s]+/)
    .map((line) => line.trim().toLowerCase().replace(/^@/, ''))
    .filter((line) => line.length > 0);
}

async function onOpenSubmit() {
  const { valid } = await openFormApi.validate();
  if (!valid) return;
  openLoading.value = true;
  try {
    const values = await openFormApi.getValues();
    const defaultRole = registerRoleOptions.value.find(
      (role) => String(role.id) === String(values.defaultRoleId ?? ''),
    );
    if (!defaultRole) {
      message.warning($t('system.register.defaultRoleRequired'));
      return;
    }
    const giftPoints = Number(values.registerGiftPoints ?? 0);
    const vcMinute = Number(values.verificationCodeIpMinuteLimit ?? 5);
    const vcHour = Number(values.verificationCodeIpHourLimit ?? 20);
    const vcDay = Number(values.verificationCodeIpDayLimit ?? 50);
    const regHour = Number(values.registerIpHourLimit ?? 10);
    const regDay = Number(values.registerIpDayLimit ?? 0);
    const ipMaxAccounts = Number(values.registerIpMaxAccounts ?? 0);
    const newAccountDayLimit = Number(values.newAccountDayLimit ?? 0);
    const registerDeviceDayLimit = Number(
      values.registerDeviceDayLimit ?? 5,
    );
    const registerIpPrefixDayLimit = Number(
      values.registerIpPrefixDayLimit ?? 10,
    );
    const registerRiskQuarantineScore = Number(
      values.registerRiskQuarantineScore ?? 40,
    );
    const registerRiskRejectScore = Number(
      values.registerRiskRejectScore ?? 75,
    );
    const oauthHour = Number(values.oauthRegisterIpHourLimit ?? 0);
    const oauthDay = Number(values.oauthRegisterIpDayLimit ?? 10);
    const oauthMax = Number(values.oauthRegisterIpMaxAccounts ?? 0);
    await updateRegisterOpenConfig({
      defaultRoleId: String(defaultRole.id),
      defaultRoleName: defaultRole.name,
      defaultRoleQps: defaultRole.qpsLimit,
      defaultUserQps: defaultRole.qpsLimit,
      registerIpHourLimit: Number.isFinite(regHour) ? Math.max(0, Math.floor(regHour)) : 10,
      registerIpDayLimit: Number.isFinite(regDay) ? Math.max(0, Math.floor(regDay)) : 0,
      registerIpMaxAccounts: Number.isFinite(ipMaxAccounts) ? Math.max(0, Math.floor(ipMaxAccounts)) : 0,
      newAccountDayLimit: Number.isFinite(newAccountDayLimit) ? Math.max(0, Math.floor(newAccountDayLimit)) : 0,
      registerDeviceDayLimit: Number.isFinite(registerDeviceDayLimit) ? Math.max(0, Math.floor(registerDeviceDayLimit)) : 5,
      registerIpPrefixDayLimit: Number.isFinite(registerIpPrefixDayLimit) ? Math.max(0, Math.floor(registerIpPrefixDayLimit)) : 10,
      registerRiskEnabled: values.registerRiskEnabled ? 1 : 0,
      registerRiskShadowMode: values.registerRiskShadowMode ? 1 : 0,
      registerRiskQuarantineScore: Number.isFinite(registerRiskQuarantineScore) ? Math.max(0, Math.floor(registerRiskQuarantineScore)) : 40,
      registerRiskRejectScore: Number.isFinite(registerRiskRejectScore) ? Math.max(0, Math.floor(registerRiskRejectScore)) : 75,
      oauthRegisterEnabled: values.oauthRegisterEnabled ? 1 : 0,
      oauthRegisterModeDefault: values.oauthRegisterModeDefault ?? 'confirm',
      oauthRegisterIpHourLimit: Number.isFinite(oauthHour) ? Math.max(0, Math.floor(oauthHour)) : 0,
      oauthRegisterIpDayLimit: Number.isFinite(oauthDay) ? Math.max(0, Math.floor(oauthDay)) : 10,
      oauthRegisterIpMaxAccounts: Number.isFinite(oauthMax) ? Math.max(0, Math.floor(oauthMax)) : 0,
      oauthRequireVerifiedEmail: values.oauthRequireVerifiedEmail ? 1 : 0,
      registerEnabled: values.registerEnabled ? 1 : 0,
      registerGiftPoints: Number.isFinite(giftPoints) ? Math.max(0, Math.floor(giftPoints)) : 0,
      verificationCodeIpDayLimit: Number.isFinite(vcDay) ? Math.max(0, Math.floor(vcDay)) : 50,
      verificationCodeIpHourLimit: Number.isFinite(vcHour) ? Math.max(0, Math.floor(vcHour)) : 20,
      verificationCodeIpMinuteLimit: Number.isFinite(vcMinute) ? Math.max(0, Math.floor(vcMinute)) : 5,
    });
    await updateEmailDomainRules({
      blacklist: parseDomainLines(values.emailBlacklistDomains),
      whitelist: parseDomainLines(values.emailWhitelistDomains),
    });
    message.success($t('system.register.saveSuccess'));
  } finally {
    openLoading.value = false;
  }
}

onMounted(() => {
  void loadOpenConfig();
});
</script>

<template>
  <Page auto-content-height>
    <div class="bg-card rounded-md p-6">
      <OpenForm />
      <Alert
        v-if="selectedDefaultRole"
        class="mt-4"
        show-icon
        type="info"
        :message="$t('system.register.defaultRoleQpsSummary', [selectedDefaultRole.name, Number(selectedDefaultRole.qpsLimit).toLocaleString()])"
      />
      <div class="mt-4 flex justify-end">
        <Button type="primary" :loading="openLoading" @click="onOpenSubmit">
          {{ $t('system.register.save') }}
        </Button>
      </div>
    </div>
  </Page>
</template>

