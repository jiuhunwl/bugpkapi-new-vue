<script lang="ts" setup>
import type { PaymentConfigApi } from '#/api/system/payment';

import { computed, onMounted, ref, shallowRef } from 'vue';

import { Page } from '@vben/common-ui';
import { useAccessStore, useUserStore } from '@vben/stores';

import {
  Alert,
  Button,
  Card,
  Input,
  InputNumber,
  message,
  Radio,
  RadioGroup,
  Select,
  Switch,
  TabPane,
  Tabs,
  Tag,
} from 'ant-design-vue';

import { useVbenForm, z } from '#/adapter/form';
import {
  getAlipayConfig,
  getBep20Config,
  getHupijiaoConfig,
  getPaymentCurrency,
  getPaymentMethods,
  getSponsorRoleConfig,
  getTrc20Config,
  getWechatConfig,
  updateAlipayConfig,
  updateBep20Config,
  updatePaymentCurrency,
  updatePaymentMethods,
  updateSponsorRoleConfig,
  updateTrc20Config,
  validateAlipayConfig,
} from '#/api/system/payment';
import { getRoleOptions } from '#/api/system/role';
import { refreshSettlementCurrency } from '#/composables/use-settlement-currency';
import { $t } from '#/locales';

import {
  PAYMENT_NOTIFY_PATHS,
  suggestedNotifyUrl,
  suggestedReturnUrl,
} from './auto-fill';
import HupijiaoChannelCard from './components/HupijiaoChannelCard.vue';
import WechatChannelCard from './components/WechatChannelCard.vue';
import {
  normalizePaymentMethodsForSave,
  sortPaymentMethods,
} from './payment-methods';

const loading = shallowRef(false);
const validateLoading = shallowRef(false);
const alipayEnabled = shallowRef(false);
const activeTab = shallowRef('methods');
const methodSaving = shallowRef(false);
const paymentMethods = ref<PaymentConfigApi.PaymentMethod[]>([]);
// 站点结算货币（CNY/USD）：保存后全局展示口径随之切换。
const currencySaving = shallowRef(false);
const currencyForm = ref<PaymentConfigApi.CurrencyConfig>({
  currency: 'CNY',
  displayName: '',
  goodsName: '',
  usdCnyRate: '7.2000',
});

// 货币展示名称：只替换用户端 ¥/人民币 的称呼，不参与金额与汇率换算。
type CurrencyDisplayPreset = 'CUSTOM' | 'POINTS' | 'SETTLEMENT' | 'SPONSOR';
const currencyDisplayPreset = shallowRef<CurrencyDisplayPreset>('SETTLEMENT');

const currencyDisplayPresetOptions = () => [
  {
    label: $t('system.payment.currencyDisplayPresetSettlement'),
    value: 'SETTLEMENT',
  },
  {
    label: $t('system.payment.currencyDisplayPresetPoints'),
    value: 'POINTS',
  },
  {
    label: $t('system.payment.currencyDisplayPresetSponsor'),
    value: 'SPONSOR',
  },
  {
    label: $t('system.payment.currencyDisplayPresetCustom'),
    value: 'CUSTOM',
  },
];

function resolveCurrencyDisplayPreset(
  name?: string,
): CurrencyDisplayPreset {
  const value = String(name ?? '').trim();
  if (!value) {
    return 'SETTLEMENT';
  }
  if (value === $t('system.payment.currencyDisplayPresetPoints')) {
    return 'POINTS';
  }
  if (value === $t('system.payment.currencyDisplayPresetSponsor')) {
    return 'SPONSOR';
  }
  return 'CUSTOM';
}

function onCurrencyDisplayPresetChange(value: unknown) {
  const preset = String(value ?? '') as CurrencyDisplayPreset;
  if (preset === 'SETTLEMENT') {
    currencyForm.value.displayName = '';
    return;
  }
  if (preset === 'POINTS') {
    currencyForm.value.displayName = $t(
      'system.payment.currencyDisplayPresetPoints',
    );
    return;
  }
  if (preset === 'SPONSOR') {
    currencyForm.value.displayName = $t(
      'system.payment.currencyDisplayPresetSponsor',
    );
  }
}

const currencyDisplayPreview = computed(() => {
  const name = String(currencyForm.value.displayName ?? '').trim();
  return name
    ? $t('system.payment.currencyDisplayPreview', ['50', name])
    : '';
});
// 充值赞助自动升级用户组：充值到账即切换主用户组。
const sponsorSaving = shallowRef(false);
const sponsorForm = ref<PaymentConfigApi.SponsorRoleConfig>({
  enabled: false,
  roleId: 0,
  roleName: '',
});
const sponsorRoleOptions = ref<{ label: string; value: number }[]>([]);
// TRC20/USDT 链上充值（海外站）：收款地址、API Key、金额范围与确认数。
const trc20Saving = shallowRef(false);
const trc20Form = ref<PaymentConfigApi.SaveTrc20Config>({
  address: '',
  apiKey: '',
  confirmations: 1,
  enabled: false,
  maxAmount: '10000',
  minAmount: '5',
});
const trc20ApiKeyConfigured = shallowRef(false);
// BEP20/USDT 链上充值（BSC）：收款地址、RPC 节点、金额范围与确认数。
const bep20Saving = shallowRef(false);
const bep20Form = ref<PaymentConfigApi.SaveBep20Config>({
  address: '',
  confirmations: 15,
  enabled: false,
  maxAmount: '10000',
  minAmount: '5',
  rpcUrl: 'https://bsc-rpc.publicnode.com',
});
const wechatConfig = ref<PaymentConfigApi.WechatConfig>({
  appId: '',
  enabled: false,
  mchid: '',
  mode: 'PRODUCTION',
});
const hupijiaoConfig = ref<PaymentConfigApi.HupijiaoConfig>({
  alipay: {
    appId: '',
    createUrl: 'https://api.xunhupay.com/payment/do.html',
    enabled: false,
    method: 'ALIPAY',
    queryUrl: 'https://api.xunhupay.com/payment/query.html',
  },
  wechat: {
    appId: '',
    createUrl: 'https://api.xunhupay.com/payment/do.html',
    enabled: false,
    method: 'WECHAT',
    queryUrl: 'https://api.xunhupay.com/payment/query.html',
  },
});
const accessStore = useAccessStore();
const userStore = useUserStore();
const isAdmin = computed(() => userStore.userRoles.includes('admin'));
const canUpdate = computed(
  () =>
    isAdmin.value || accessStore.accessCodes.includes('payment:config:update'),
);
const canUpdateHupijiao = computed(
  () =>
    isAdmin.value ||
    accessStore.accessCodes.includes('payment:hupijiao:update'),
);
const canUpdateWechat = computed(
  () =>
    isAdmin.value || accessStore.accessCodes.includes('payment:wechat:update'),
);
const canUpdateMethods = computed(
  () =>
    isAdmin.value || accessStore.accessCodes.includes('payment:method:update'),
);

const currentEnabled = computed(() => alipayEnabled.value);

const currentTitle = computed(() => $t('system.payment.alipayTitle'));

const currentDescription = computed(() =>
  $t('system.payment.alipayDescription'),
);

const currentTip = computed(() => $t('system.payment.officialTip'));

const currentTipDescription = computed(() =>
  $t('system.payment.officialDescription'),
);

const [AlipayForm, alipayFormApi] = useVbenForm({
  commonConfig: {
    colon: true,
    componentProps: {
      class: 'w-full',
    },
    formItemClass: 'col-span-1 xl:col-span-3',
    labelClass: 'payment-config-label',
    labelWidth: 136,
  },
  layout: 'horizontal',
  schema: [
    {
      component: 'Switch',
      componentProps: {
        checkedChildren: $t('system.payment.enableAction'),
        class: 'w-auto',
        unCheckedChildren: $t('system.payment.disableAction'),
      },
      defaultValue: false,
      fieldName: 'enabled',
      label: $t('system.payment.alipayEnabled'),
    },
    {
      component: 'Select',
      componentProps: () => ({
        options: [
          {
            label: $t('system.payment.sandboxMode'),
            value: 'SANDBOX',
          },
          {
            label: $t('system.payment.productionMode'),
            value: 'PRODUCTION',
          },
        ],
      }),
      defaultValue: 'SANDBOX',
      fieldName: 'mode',
      help: $t('system.payment.modeHelp'),
      label: $t('system.payment.mode'),
    },
    {
      component: 'Input',
      fieldName: 'appId',
      label: $t('system.payment.appId'),
      rules: z.string().min(1, $t('system.payment.appIdRequired')),
    },
    {
      component: 'Textarea',
      componentProps: {
        autoSize: { maxRows: 8, minRows: 5 },
        placeholder: $t('system.payment.privateKeyPlaceholder'),
      },
      fieldName: 'appPrivateKey',
      help: $t('system.payment.privateKeyRetainHelp'),
      label: $t('system.payment.merchantPrivateKey'),
    },
    {
      component: 'Textarea',
      componentProps: {
        autoSize: { maxRows: 8, minRows: 5 },
        placeholder: $t('system.payment.publicKeyPlaceholder'),
      },
      fieldName: 'alipayPublicKey',
      label: $t('system.payment.alipayPublicKey'),
      rules: z.string().min(1, $t('system.payment.publicKeyRequired')),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('system.payment.gatewayUrlPlaceholder'),
      },
      fieldName: 'gatewayUrl',
      help: $t('system.payment.gatewayUrlHelp'),
      label: $t('system.payment.gatewayUrl'),
      rules: z.string().url().or(z.literal('')).optional(),
    },
    {
      component: 'Input',
      fieldName: 'sellerId',
      help: $t('system.payment.sellerIdHelp'),
      label: $t('system.payment.sellerId'),
      rules: z.string().min(1, $t('system.payment.sellerIdRequired')),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('system.payment.notifyUrlPlaceholder'),
      },
      fieldName: 'notifyUrl',
      help: $t('system.payment.notifyUrlHelp'),
      label: $t('system.payment.notifyUrl'),
      rules: z.string().url().or(z.literal('')).optional(),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('system.payment.returnUrlPlaceholder'),
      },
      fieldName: 'returnUrl',
      help: $t('system.payment.returnUrlHelp'),
      label: $t('system.payment.returnUrl'),
      rules: z.string().url().or(z.literal('')).optional(),
    },
  ],
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 gap-x-4 md:grid-cols-2 xl:grid-cols-6',
});

async function loadConfig() {
  loading.value = true;
  try {
    const [
      alipayConfig,
      officialWechatConfig,
      hpConfig,
      methods,
      currency,
      sponsor,
      trc20,
      bep20,
    ] = await Promise.all([
      getAlipayConfig(),
      getWechatConfig(),
      getHupijiaoConfig(),
      getPaymentMethods(),
      getPaymentCurrency(),
      getSponsorRoleConfig(),
      getTrc20Config(),
      getBep20Config(),
    ]);
    wechatConfig.value = officialWechatConfig;
    hupijiaoConfig.value = hpConfig;
    paymentMethods.value = sortPaymentMethods(methods);
    currencyForm.value = {
      currency: currency.currency === 'USD' ? 'USD' : 'CNY',
      displayName: String(currency.displayName ?? ''),
      goodsName: String(currency.goodsName ?? ''),
      usdCnyRate: String(currency.usdCnyRate ?? '7.2000'),
    };
    currencyDisplayPreset.value = resolveCurrencyDisplayPreset(
      currency.displayName,
    );
    sponsorForm.value = {
      enabled: sponsor.enabled,
      roleId: Number(sponsor.roleId ?? 0),
      roleName: sponsor.roleName ?? '',
    };
    trc20Form.value = {
      address: trc20.address,
      apiKey: '',
      confirmations: trc20.confirmations,
      enabled: trc20.enabled,
      maxAmount: trc20.maxAmount,
      minAmount: trc20.minAmount,
    };
    trc20ApiKeyConfigured.value = trc20.apiKeyConfigured;
    bep20Form.value = {
      address: bep20.address,
      confirmations: bep20.confirmations,
      enabled: bep20.enabled,
      maxAmount: bep20.maxAmount,
      minAmount: bep20.minAmount,
      rpcUrl: bep20.rpcUrl,
    };
    void loadSponsorRoleOptions();
    alipayEnabled.value =
      alipayConfig.enabled === true || alipayConfig.enabled === 1;
    await alipayFormApi.setValues({
      alipayPublicKey: alipayConfig.alipayPublicKey ?? '',
      appId: alipayConfig.appId ?? '',
      appPrivateKey: alipayConfig.appPrivateKey ?? '',
      enabled: alipayConfig.enabled === true || alipayConfig.enabled === 1,
      gatewayUrl: alipayConfig.gatewayUrl ?? '',
      mode: alipayConfig.mode ?? 'SANDBOX',
      notifyUrl:
        String(alipayConfig.notifyUrl ?? '').trim() ||
        suggestedNotifyUrl(PAYMENT_NOTIFY_PATHS.alipay),
      returnUrl:
        String(alipayConfig.returnUrl ?? '').trim() || suggestedReturnUrl(),
      sellerId: alipayConfig.sellerId ?? '',
    });
  } finally {
    loading.value = false;
  }
}

function methodTitle(code: PaymentConfigApi.PaymentMethodCode) {
  return {
    ALIPAY: $t('system.payment.methodAlipay'),
    BALANCE: $t('system.payment.methodBalance'),
    BEP20: $t('system.payment.methodBep20'),
    HUPIJIAO_ALIPAY: $t('system.payment.methodHupijiaoAlipay'),
    HUPIJIAO_WECHAT: $t('system.payment.methodHupijiaoWechat'),
    TRC20: $t('system.payment.methodTrc20'),
    WECHAT: $t('system.payment.methodWechat'),
  }[code];
}

function methodDescription(code: PaymentConfigApi.PaymentMethodCode) {
  if (code === 'BALANCE') return $t('system.payment.methodBalanceDescription');
  if (code === 'HUPIJIAO_ALIPAY') {
    return $t('system.payment.methodHupijiaoAlipayDescription');
  }
  if (code === 'HUPIJIAO_WECHAT') {
    return $t('system.payment.methodHupijiaoWechatDescription');
  }
  if (code === 'TRC20') return $t('system.payment.methodTrc20Description');
  if (code === 'BEP20') return $t('system.payment.methodBep20Description');
  if (code === 'WECHAT') return $t('system.payment.methodWechatDescription');
  return $t('system.payment.methodAlipayDescription');
}

async function savePaymentMethods() {
  if (!canUpdateMethods.value) return;
  methodSaving.value = true;
  try {
    await updatePaymentMethods(
      normalizePaymentMethodsForSave(paymentMethods.value),
    );
    message.success($t('system.payment.methodsSaveSuccess'));
    paymentMethods.value = sortPaymentMethods(await getPaymentMethods());
  } finally {
    methodSaving.value = false;
  }
}

async function saveCurrency() {
  if (!canUpdate.value) return;
  const rate = Number(currencyForm.value.usdCnyRate);
  if (
    currencyForm.value.currency === 'USD' &&
    (!Number.isFinite(rate) || rate <= 0)
  ) {
    message.error($t('system.payment.currencyRateInvalid'));
    return;
  }
  // 渠道侧上限按字节算（虎皮椒 title ≤127 字节），中文一名 3 字节，
  // 只按字符数放行会在下单时才被渠道拒，这里提前拦住。
  if (new TextEncoder().encode(currencyForm.value.goodsName ?? '').length > 127) {
    message.error($t('system.payment.goodsNameTooLong'));
    return;
  }
  const displayName = String(currencyForm.value.displayName ?? '').trim();
  if (Array.from(displayName).length > 16) {
    message.error($t('system.payment.currencyDisplayNameTooLong'));
    return;
  }
  currencyForm.value.displayName = displayName;
  currencySaving.value = true;
  try {
    currencyForm.value = await updatePaymentCurrency(currencyForm.value);
    // 站点货币是全局展示口径，保存后立即让缓存失效重建。
    await refreshSettlementCurrency();
    message.success($t('system.payment.currencySaveSuccess'));
  } finally {
    currencySaving.value = false;
  }
}

async function loadSponsorRoleOptions() {
  try {
    const roles = await getRoleOptions();
    // 只列启用中的非管理员组：与后端保存校验口径一致。
    sponsorRoleOptions.value = roles
      .filter((role) => role.status === 1 && role.roleKey !== 'admin')
      .map((role) => ({ label: role.name, value: Number(role.id) }));
    // 当前配置的组如果不在过滤结果里（如已停用），补一项保证回显不丢。
    const current = sponsorForm.value.roleId;
    if (
      current > 0 &&
      !sponsorRoleOptions.value.some((option) => option.value === current)
    ) {
      sponsorRoleOptions.value.unshift({
        label:
          sponsorForm.value.roleName ||
          `${$t('system.payment.sponsorRoleLabel')} #${current}`,
        value: current,
      });
    }
  } catch {
    message.error($t('system.payment.sponsorLoadFailed'));
  }
}

async function saveTrc20() {
  if (!canUpdate.value) return;
  const address = trc20Form.value.address.trim();
  if (trc20Form.value.enabled && !address) {
    message.error($t('system.payment.trc20AddressRequired'));
    return;
  }
  if (address && !/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) {
    message.error($t('system.payment.trc20AddressInvalid'));
    return;
  }
  const min = Number(trc20Form.value.minAmount);
  const max = Number(trc20Form.value.maxAmount);
  if (
    !Number.isFinite(min) ||
    min <= 0 ||
    !Number.isFinite(max) ||
    max < min
  ) {
    message.error($t('system.payment.trc20AmountInvalid'));
    return;
  }
  trc20Saving.value = true;
  try {
    await updateTrc20Config(trc20Form.value);
    const fresh = await getTrc20Config();
    trc20Form.value = {
      address: fresh.address,
      apiKey: '',
      confirmations: fresh.confirmations,
      enabled: fresh.enabled,
      maxAmount: fresh.maxAmount,
      minAmount: fresh.minAmount,
    };
    trc20ApiKeyConfigured.value = fresh.apiKeyConfigured;
    message.success($t('system.payment.trc20SaveSuccess'));
  } finally {
    trc20Saving.value = false;
  }
}

async function saveBep20() {
  if (!canUpdate.value) return;
  const address = bep20Form.value.address.trim();
  if (bep20Form.value.enabled && !address) {
    message.error($t('system.payment.bep20AddressRequired'));
    return;
  }
  if (address && !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    message.error($t('system.payment.bep20AddressInvalid'));
    return;
  }
  const rpcUrl = bep20Form.value.rpcUrl.trim();
  if (!/^https:\/\//i.test(rpcUrl)) {
    message.error($t('system.payment.bep20RpcUrlInvalid'));
    return;
  }
  const min = Number(bep20Form.value.minAmount);
  const max = Number(bep20Form.value.maxAmount);
  if (
    !Number.isFinite(min) ||
    min <= 0 ||
    !Number.isFinite(max) ||
    max < min
  ) {
    message.error($t('system.payment.bep20AmountInvalid'));
    return;
  }
  const confirmations = Number(bep20Form.value.confirmations);
  if (
    !Number.isInteger(confirmations) ||
    confirmations < 1 ||
    confirmations > 100
  ) {
    message.error($t('system.payment.bep20ConfirmationsInvalid'));
    return;
  }
  bep20Saving.value = true;
  try {
    await updateBep20Config(bep20Form.value);
    const fresh = await getBep20Config();
    bep20Form.value = {
      address: fresh.address,
      confirmations: fresh.confirmations,
      enabled: fresh.enabled,
      maxAmount: fresh.maxAmount,
      minAmount: fresh.minAmount,
      rpcUrl: fresh.rpcUrl,
    };
    message.success($t('system.payment.bep20SaveSuccess'));
  } finally {
    bep20Saving.value = false;
  }
}

async function saveSponsor() {
  if (!canUpdate.value) return;
  if (sponsorForm.value.enabled && !sponsorForm.value.roleId) {
    message.error($t('system.payment.sponsorRoleRequired'));
    return;
  }
  sponsorSaving.value = true;
  try {
    await updateSponsorRoleConfig({
      enabled: sponsorForm.value.enabled,
      roleId: sponsorForm.value.roleId,
    });
    message.success($t('system.payment.sponsorSaveSuccess'));
    const fresh = await getSponsorRoleConfig();
    sponsorForm.value = {
      enabled: fresh.enabled,
      roleId: Number(fresh.roleId ?? 0),
      roleName: fresh.roleName ?? '',
    };
  } finally {
    sponsorSaving.value = false;
  }
}

async function buildAlipayPayload(): Promise<PaymentConfigApi.AlipayConfig> {
  const values = await alipayFormApi.getValues();
  return {
    alipayPublicKey: String(values.alipayPublicKey ?? '').trim(),
    appId: String(values.appId ?? '').trim(),
    appPrivateKey: String(values.appPrivateKey ?? '').trim(),
    enabled: values.enabled ? 1 : 0,
    gatewayUrl: String(values.gatewayUrl ?? '').trim(),
    mode: values.mode === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX',
    notifyUrl: String(values.notifyUrl ?? '').trim(),
    returnUrl: String(values.returnUrl ?? '').trim(),
    sellerId: String(values.sellerId ?? '').trim(),
  };
}

async function onValidate() {
  if (!canUpdate.value) return;
  const { valid } = await alipayFormApi.validate();
  if (!valid) return;

  validateLoading.value = true;
  try {
    await validateAlipayConfig(await buildAlipayPayload());
    message.success($t('system.payment.validateSuccess'));
  } finally {
    validateLoading.value = false;
  }
}

async function onSubmit() {
  if (!canUpdate.value) return;
  const { valid } = await alipayFormApi.validate();
  if (!valid) return;

  loading.value = true;
  try {
    await updateAlipayConfig(await buildAlipayPayload());
    message.success($t('system.payment.saveSuccess'));
    await loadConfig();
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void loadConfig();
});
</script>

<template>
  <Page auto-content-height>
    <div class="payment-config-page">
      <div class="payment-config-header">
        <div>
          <div class="payment-config-title">
            {{ $t('system.payment.configTitle') }}
          </div>
          <div class="payment-config-desc">
            {{ $t('system.payment.configDescription') }}
          </div>
        </div>
      </div>

      <Alert
        class="payment-config-alert"
        show-icon
        type="info"
        :message="$t('system.payment.credentialIsolation')"
        :description="$t('system.payment.credentialIsolationDescription')"
      />

      <Tabs v-model:active-key="activeTab" class="payment-config-tabs">
        <TabPane key="currency" :tab="$t('system.payment.currencyTab')">
          <Card :title="$t('system.payment.currencyTitle')" class="payment-config-card">
            <Alert
              class="payment-config-alert"
              show-icon
              type="info"
              :message="$t('system.payment.currencyTip')"
            />
            <div class="payment-currency-form">
              <div class="payment-currency-field">
                <span class="payment-currency-label">
                  {{ $t('system.payment.currencyLabel') }}
                </span>
                <RadioGroup v-model:value="currencyForm.currency" :disabled="!canUpdate">
                  <Radio value="CNY">{{ $t('system.payment.currencyCNY') }}</Radio>
                  <Radio value="USD">{{ $t('system.payment.currencyUSD') }}</Radio>
                </RadioGroup>
              </div>
              <div class="payment-currency-field">
                <span class="payment-currency-label">
                  {{ $t('system.payment.currencyDisplayPresetLabel') }}
                </span>
                <Select
                  v-model:value="currencyDisplayPreset"
                  :disabled="!canUpdate"
                  :options="currencyDisplayPresetOptions()"
                  @change="onCurrencyDisplayPresetChange"
                />
                <span class="payment-currency-help">
                  {{ $t('system.payment.currencyDisplayNameHelp') }}
                </span>
              </div>
              <div
                v-if="currencyDisplayPreset !== 'SETTLEMENT'"
                class="payment-currency-field"
              >
                <span class="payment-currency-label">
                  {{ $t('system.payment.currencyDisplayNameLabel') }}
                </span>
                <Input
                  v-model:value="currencyForm.displayName"
                  allow-clear
                  :disabled="!canUpdate || currencyDisplayPreset !== 'CUSTOM'"
                  :maxlength="16"
                  :placeholder="$t('system.payment.currencyDisplayNamePlaceholder')"
                />
                <span v-if="currencyDisplayPreview" class="payment-currency-help">
                  {{ currencyDisplayPreview }}
                </span>
              </div>
              <div class="payment-currency-field">
                <span class="payment-currency-label">
                  {{ $t('system.payment.goodsNameLabel') }}
                </span>
                <Input
                  v-model:value="currencyForm.goodsName"
                  allow-clear
                  :disabled="!canUpdate"
                  :maxlength="60"
                  :placeholder="$t('system.payment.goodsNamePlaceholder')"
                />
                <span class="payment-currency-help">
                  {{ $t('system.payment.goodsNameHelp') }}
                </span>
              </div>
              <div v-if="currencyForm.currency === 'USD'" class="payment-currency-field">
                <span class="payment-currency-label">
                  {{ $t('system.payment.currencyRateLabel') }}
                </span>
                <InputNumber
                  v-model:value="currencyForm.usdCnyRate"
                  :disabled="!canUpdate"
                  :max="999999"
                  :min="0.0001"
                  :precision="4"
                  :step="0.01"
                />
                <span class="payment-currency-help">
                  {{ $t('system.payment.currencyRateHelp') }}
                </span>
              </div>
              <Button
                :disabled="!canUpdate"
                :loading="currencySaving"
                type="primary"
                @click="saveCurrency"
              >
                {{ $t('system.payment.currencySave') }}
              </Button>
            </div>
          </Card>
        </TabPane>
        <TabPane key="trc20" :tab="$t('system.payment.trc20Tab')">
          <Card :title="$t('system.payment.trc20Title')" class="payment-config-card">
            <Alert
              class="payment-config-channel-alert"
              show-icon
              type="info"
              :message="$t('system.payment.trc20Tip')"
            />
            <div class="payment-currency-form">
              <div class="payment-currency-field">
                <span class="payment-currency-label">
                  {{ $t('system.payment.trc20EnabledLabel') }}
                </span>
                <Switch v-model:checked="trc20Form.enabled" :disabled="!canUpdate" />
              </div>
              <div class="payment-currency-field">
                <span class="payment-currency-label">
                  {{ $t('system.payment.trc20AddressLabel') }}
                </span>
                <Input
                  v-model:value="trc20Form.address"
                  :disabled="!canUpdate"
                  :placeholder="$t('system.payment.trc20AddressPlaceholder')"
                />
                <span class="payment-currency-help">
                  {{ $t('system.payment.trc20AddressHelp') }}
                </span>
              </div>
              <div class="payment-currency-field">
                <span class="payment-currency-label">
                  {{ $t('system.payment.trc20ApiKeyLabel') }}
                </span>
                <Input
                  v-model:value="trc20Form.apiKey"
                  :disabled="!canUpdate"
                  :placeholder="
                    trc20ApiKeyConfigured
                      ? $t('system.payment.trc20ApiKeyConfigured')
                      : $t('system.payment.trc20ApiKeyPlaceholder')
                  "
                />
                <span class="payment-currency-help">
                  {{ $t('system.payment.trc20ApiKeyHelp') }}
                </span>
              </div>
              <div class="payment-currency-field">
                <span class="payment-currency-label">
                  {{ $t('system.payment.trc20MinAmountLabel') }}
                </span>
                <InputNumber
                  v-model:value="trc20Form.minAmount"
                  :disabled="!canUpdate"
                  :min="0.000001"
                  :precision="6"
                />
              </div>
              <div class="payment-currency-field">
                <span class="payment-currency-label">
                  {{ $t('system.payment.trc20MaxAmountLabel') }}
                </span>
                <InputNumber
                  v-model:value="trc20Form.maxAmount"
                  :disabled="!canUpdate"
                  :min="0.000001"
                  :precision="6"
                />
              </div>
              <div class="payment-currency-field">
                <span class="payment-currency-label">
                  {{ $t('system.payment.trc20ConfirmationsLabel') }}
                </span>
                <InputNumber
                  v-model:value="trc20Form.confirmations"
                  :disabled="!canUpdate"
                  :max="1"
                  :min="1"
                  :precision="0"
                />
                <span class="payment-currency-help">
                  {{ $t('system.payment.trc20ConfirmationsHelp') }}
                </span>
              </div>
              <Button
                :disabled="!canUpdate"
                :loading="trc20Saving"
                type="primary"
                @click="saveTrc20"
              >
                {{ $t('system.payment.trc20Save') }}
              </Button>
            </div>
          </Card>
        </TabPane>
        <TabPane key="bep20" :tab="$t('system.payment.bep20Tab')">
          <Card :title="$t('system.payment.bep20Title')" class="payment-config-card">
            <Alert
              class="payment-config-channel-alert"
              show-icon
              type="info"
              :message="$t('system.payment.bep20Tip')"
            />
            <div class="payment-currency-form">
              <div class="payment-currency-field">
                <span class="payment-currency-label">
                  {{ $t('system.payment.bep20EnabledLabel') }}
                </span>
                <Switch v-model:checked="bep20Form.enabled" :disabled="!canUpdate" />
              </div>
              <div class="payment-currency-field">
                <span class="payment-currency-label">
                  {{ $t('system.payment.bep20AddressLabel') }}
                </span>
                <Input
                  v-model:value="bep20Form.address"
                  :disabled="!canUpdate"
                  :placeholder="$t('system.payment.bep20AddressPlaceholder')"
                />
                <span class="payment-currency-help">
                  {{ $t('system.payment.bep20AddressHelp') }}
                </span>
              </div>
              <div class="payment-currency-field">
                <span class="payment-currency-label">
                  {{ $t('system.payment.bep20RpcUrlLabel') }}
                </span>
                <Input
                  v-model:value="bep20Form.rpcUrl"
                  :disabled="!canUpdate"
                  :placeholder="$t('system.payment.bep20RpcUrlPlaceholder')"
                />
                <span class="payment-currency-help">
                  {{ $t('system.payment.bep20RpcUrlHelp') }}
                </span>
              </div>
              <div class="payment-currency-field">
                <span class="payment-currency-label">
                  {{ $t('system.payment.bep20MinAmountLabel') }}
                </span>
                <InputNumber
                  v-model:value="bep20Form.minAmount"
                  :disabled="!canUpdate"
                  :min="0.000001"
                  :precision="6"
                />
              </div>
              <div class="payment-currency-field">
                <span class="payment-currency-label">
                  {{ $t('system.payment.bep20MaxAmountLabel') }}
                </span>
                <InputNumber
                  v-model:value="bep20Form.maxAmount"
                  :disabled="!canUpdate"
                  :min="0.000001"
                  :precision="6"
                />
              </div>
              <div class="payment-currency-field">
                <span class="payment-currency-label">
                  {{ $t('system.payment.bep20ConfirmationsLabel') }}
                </span>
                <InputNumber
                  v-model:value="bep20Form.confirmations"
                  :disabled="!canUpdate"
                  :max="100"
                  :min="1"
                  :precision="0"
                />
                <span class="payment-currency-help">
                  {{ $t('system.payment.bep20ConfirmationsHelp') }}
                </span>
              </div>
              <Button
                :disabled="!canUpdate"
                :loading="bep20Saving"
                type="primary"
                @click="saveBep20"
              >
                {{ $t('system.payment.bep20Save') }}
              </Button>
            </div>
          </Card>
        </TabPane>
        <TabPane key="sponsor" :tab="$t('system.payment.sponsorTab')">
          <Card :title="$t('system.payment.sponsorTitle')" class="payment-config-card">
            <Alert
              class="payment-config-channel-alert"
              show-icon
              type="info"
              :message="$t('system.payment.sponsorTip')"
            />
            <div class="payment-currency-form">
              <div class="payment-currency-field">
                <span class="payment-currency-label">
                  {{ $t('system.payment.sponsorEnabledLabel') }}
                </span>
                <Switch v-model:checked="sponsorForm.enabled" :disabled="!canUpdate" />
              </div>
              <div class="payment-currency-field">
                <span class="payment-currency-label">
                  {{ $t('system.payment.sponsorRoleLabel') }}
                </span>
                <Select
                  v-model:value="sponsorForm.roleId"
                  class="payment-sponsor-role-select"
                  :disabled="!canUpdate"
                  :options="sponsorRoleOptions"
                  :placeholder="$t('system.payment.sponsorRoleLabel')"
                  show-search
                  option-filter-prop="label"
                />
                <span class="payment-currency-help">
                  {{ $t('system.payment.sponsorRoleHelp') }}
                </span>
              </div>
              <Button
                :disabled="!canUpdate"
                :loading="sponsorSaving"
                type="primary"
                @click="saveSponsor"
              >
                {{ $t('system.payment.sponsorSave') }}
              </Button>
            </div>
          </Card>
        </TabPane>
        <TabPane key="methods" :tab="$t('system.payment.methodsTab')">
          <Card :title="$t('system.payment.checkoutMethods')" class="payment-config-card">
            <div class="payment-method-list">
              <div
                v-for="method in paymentMethods"
                :key="method.code"
                class="payment-method-row"
              >
                <div>
                  <strong>{{ methodTitle(method.code) }}</strong>
                  <p>{{ methodDescription(method.code) }}</p>
                </div>
                <div class="payment-method-controls">
                  <label class="payment-method-sort">
                    <span>{{ $t('system.payment.methodSortOrder') }}</span>
                    <InputNumber
                      v-model:value="method.sortOrder"
                      :disabled="!canUpdateMethods"
                      :max="1_000_000"
                      :min="0"
                      :precision="0"
                      :step="10"
                    />
                  </label>
                  <label class="payment-method-enabled">
                    <span>{{ $t('system.payment.methodEnabled') }}</span>
                    <Switch
                      v-model:checked="method.enabled"
                      :disabled="!canUpdateMethods"
                    />
                  </label>
                </div>
              </div>
            </div>
            <div v-if="canUpdateMethods" class="payment-config-actions">
              <Button type="primary" :loading="methodSaving" @click="savePaymentMethods">
                {{ $t('system.payment.saveMethods') }}
              </Button>
            </div>
          </Card>
        </TabPane>

        <TabPane key="alipay" :tab="$t('system.payment.alipayTab')">
          <div class="payment-config-card">
            <div class="payment-config-title payment-config-channel-title">
              {{ currentTitle }}
              <Tag :color="currentEnabled ? 'success' : 'default'">
                {{ currentEnabled ? $t('system.payment.enabledTag') : $t('system.payment.disabledTag') }}
              </Tag>
            </div>
            <p class="payment-config-desc">{{ currentDescription }}</p>
            <Alert
              class="payment-config-channel-alert"
              show-icon
              type="info"
              :message="currentTip"
              :description="currentTipDescription"
            />
            <AlipayForm />
            <div v-if="canUpdate" class="payment-config-actions">
              <Button :loading="validateLoading" @click="onValidate">
                {{ $t('system.payment.validate') }}
              </Button>
              <Button type="primary" :loading="loading" @click="onSubmit">
                {{ $t('system.payment.save') }}
              </Button>
            </div>
          </div>
        </TabPane>

        <TabPane key="wechat" :tab="$t('system.payment.wechatTab')">
          <WechatChannelCard
            :can-update="canUpdateWechat"
            :model-value="wechatConfig"
            @saved="loadConfig"
          />
        </TabPane>

        <TabPane key="hupijiao" :tab="$t('system.payment.hupijiaoTab')">
          <div class="hupijiao-grid">
            <HupijiaoChannelCard
              :can-update="canUpdateHupijiao"
              :model-value="hupijiaoConfig.alipay"
              :title="$t('system.payment.hupijiaoAlipayTitle')"
              @saved="loadConfig"
            />
            <HupijiaoChannelCard
              :can-update="canUpdateHupijiao"
              :model-value="hupijiaoConfig.wechat"
              :title="$t('system.payment.hupijiaoWechatTitle')"
              @saved="loadConfig"
            />
          </div>
        </TabPane>
      </Tabs>
    </div>
  </Page>
</template>

<style scoped>
.payment-config-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.payment-config-header,
.payment-config-card,
.payment-config-alert,
.payment-config-tabs {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.payment-config-header {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
}

.payment-config-title {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  font-size: 20px;
  font-weight: 700;
  color: hsl(var(--foreground));
  letter-spacing: 0;
}

.payment-config-desc,
.payment-config-time {
  margin-top: 6px;
  font-size: 14px;
  color: hsl(var(--muted-foreground));
}

.payment-config-card {
  padding: 18px 24px 24px;
}

.payment-config-tabs {
  padding: 0 20px 20px;
}

.payment-config-channel-title {
  margin-bottom: 4px;
}

.payment-config-channel-alert {
  margin: 16px 0;
}

.payment-method-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.payment-method-row {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.payment-method-row strong {
  color: hsl(var(--foreground));
}

.payment-method-row p {
  margin: 4px 0 0;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.payment-currency-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 16px;
}

.payment-currency-field {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.payment-currency-label {
  min-width: 80px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.payment-currency-help {
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.payment-sponsor-role-select {
  min-width: 220px;
}

.payment-method-controls {
  display: flex;
  flex: 0 0 auto;
  gap: 16px;
  align-items: center;
}

.payment-method-sort,
.payment-method-enabled {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.payment-method-sort :deep(.ant-input-number) {
  width: 96px;
}

.hupijiao-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.payment-config-card :deep(.payment-config-label) {
  white-space: nowrap;
}

.payment-config-card :deep(.ant-form-item-control) {
  min-width: 0;
}

.payment-config-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 16px;
}

@media (max-width: 767px) {
  .payment-config-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .payment-config-card {
    padding: 14px 16px 16px;
  }

  .payment-method-list,
  .hupijiao-grid {
    grid-template-columns: 1fr;
  }

  .payment-method-row {
    align-items: flex-start;
  }

  .payment-method-controls {
    flex-direction: column;
    align-items: flex-end;
  }

  .payment-config-card :deep(.payment-config-label) {
    flex-basis: auto;
    max-width: none;
  }

  .payment-config-actions :deep(.ant-btn) {
    flex: 1 1 140px;
  }
}
</style>
