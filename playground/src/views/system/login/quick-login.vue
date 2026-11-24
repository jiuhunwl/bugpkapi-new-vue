<script lang="ts" setup>
import type { OAuthApi } from '#/api';

import { computed, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  Drawer,
  Form,
  FormItem,
  Input,
  InputNumber,
  InputPassword,
  Select,
  Spin,
  Switch,
  Tag,
  message,
} from 'ant-design-vue';

import {
  createOAuthProviderApi,
  getOAuthAdminConfigApi,
  getRoleOptions,
  saveOAuthAdminGlobalApi,
  testOAuthProviderApi,
  updateOAuthProviderApi,
} from '#/api';
import OAuthProviderIcon from '#/components/oauth/OAuthProviderIcon.vue';
import { $t } from '#/locales';

defineOptions({ name: 'SystemQuickLoginConfig' });

const loading = ref(true);
const config = ref<null | OAuthApi.AdminConfig>(null);
const globalForm = reactive<OAuthApi.AdminGlobalConfig>({
  frontendBaseUrl: '',
});
const savingGlobal = ref(false);
const roleOptions = ref<Array<{ label: string; value: string }>>([]);

const drawerOpen = ref(false);
const editing = ref<null | OAuthApi.AdminProvider>(null);
const savingProvider = ref(false);
const testingProvider = ref('');
const form = reactive<OAuthApi.ProviderSaveParams>(defaultProviderForm());

const providers = computed(() => config.value?.providers || []);
const isEditing = computed(() => !!editing.value);
const isGenericDriver = computed(
  () => form.driver === 'oauth2' || form.driver === 'oidc',
);
const cannotRequireEmail = computed(
  () => form.driver === 'qq' || form.driver === 'wechat',
);

const iconOptions = computed(() => [
  { label: 'QQ', value: 'qq' },
  { label: $t('oauthSettings.form.wechat'), value: 'wechat' },
  { label: 'GitHub', value: 'github' },
  { label: 'LinuxDo', value: 'linuxdo' },
  { label: $t('oauthSettings.form.generic'), value: 'generic' },
]);
const driverOptions = computed(() => [
  { label: 'QQ', value: 'qq' },
  { label: $t('oauthSettings.form.wechat'), value: 'wechat' },
  { label: 'GitHub', value: 'github' },
  { label: $t('oauthSettings.form.genericOAuth2'), value: 'oauth2' },
]);
const registerModeOptions = [
  { label: $t('oauthSettings.form.registerModeInherit'), value: 'inherit' },
  { label: $t('oauthSettings.form.registerModeOff'), value: 'off' },
  { label: $t('oauthSettings.form.registerModeConfirm'), value: 'confirm' },
  { label: $t('oauthSettings.form.registerModeAuto'), value: 'auto' },
];
const requireVerifiedEmailOptions = [
  { label: $t('oauthSettings.form.emailModeInherit'), value: -1 },
  { label: $t('oauthSettings.form.emailModeNotRequired'), value: 0 },
  { label: $t('oauthSettings.form.emailModeRequired'), value: 1 },
];

function defaultProviderForm(): OAuthApi.ProviderSaveParams {
  return {
    authorizationEndpoint: '',
    clearClientSecret: false,
    clientId: '',
    clientSecret: '',
    defaultRoleId: '0',
    displayName: '',
    driver: 'oauth2',
    enabled: false,
    extraConfig: '',
    iconKey: 'generic',
    issuer: '',
    jwksUri: '',
    minAccountAgeDays: 0,
    minTrustLevel: 0,
    providerGroup: '',
    providerKey: '',
    redirectUri: '',
    registerGiftPoints: -1,
    registerIpHourLimit: -1,
    registerIpDayLimit: -1,
    registerIpMaxAccounts: -1,
    registerMode: 'inherit',
    requireActive: true,
    requireVerifiedEmailMode: -1,
    rejectSilenced: true,
    scopes: '',
    sortNo: 100,
    tokenEndpoint: '',
    userinfoEndpoint: '',
  };
}

function resetForm() {
  Object.assign(form, defaultProviderForm());
}

async function load() {
  loading.value = true;
  try {
    const [result, roles] = await Promise.all([
      getOAuthAdminConfigApi(),
      getRoleOptions(),
    ]);
    config.value = result;
    globalForm.frontendBaseUrl = result.global.frontendBaseUrl;
    roleOptions.value = [
      { label: $t('oauthSettings.form.roleInherit'), value: '0' },
      ...roles
        .filter(
          (role) =>
            role.status === 1 &&
            role.selfRegisterEnabled === 1 &&
            role.roleKey !== 'admin',
        )
        .map((role) => ({
          label: role.name,
          value: String(role.id),
        })),
    ];
  } finally {
    loading.value = false;
  }
}

async function saveGlobal() {
  savingGlobal.value = true;
  try {
    const result = await saveOAuthAdminGlobalApi({ ...globalForm });
    globalForm.frontendBaseUrl = result.frontendBaseUrl;
    message.success($t('oauthSettings.saved'));
    await load();
  } finally {
    savingGlobal.value = false;
  }
}

function openCreate() {
  editing.value = null;
  resetForm();
  drawerOpen.value = true;
}

function openEdit(provider: OAuthApi.AdminProvider) {
  editing.value = provider;
  resetForm();
  Object.assign(form, {
    authorizationEndpoint: provider.authorizationEndpoint,
    clientId: provider.clientId,
    clientSecret: '',
    defaultRoleId: String(provider.defaultRoleId ?? '0'),
    displayName: provider.displayName,
    driver: provider.driver,
    enabled: provider.enabled,
    extraConfig: provider.extraConfig,
    iconKey: provider.iconKey,
    issuer: provider.issuer,
    jwksUri: provider.jwksUri,
    minAccountAgeDays: provider.minAccountAgeDays,
    minTrustLevel: provider.minTrustLevel,
    providerGroup: provider.providerGroup,
    providerKey: provider.providerKey,
    redirectUri: provider.redirectUri,
    registerGiftPoints: provider.registerGiftPoints,
    registerIpHourLimit: provider.registerIpHourLimit,
    registerIpDayLimit: provider.registerIpDayLimit,
    registerIpMaxAccounts: provider.registerIpMaxAccounts,
    registerMode: provider.registerMode,
    requireActive: provider.requireActive,
    requireVerifiedEmailMode: provider.requireVerifiedEmailMode,
    rejectSilenced: provider.rejectSilenced,
    scopes: provider.scopes,
    sortNo: provider.sortNo,
    tokenEndpoint: provider.tokenEndpoint,
    userinfoEndpoint: provider.userinfoEndpoint,
  });
  drawerOpen.value = true;
}

function useSuggestedCallback() {
  if (!editing.value) return;
  form.redirectUri =
    `${window.location.origin}${editing.value.callbackPath}`;
}

async function copyCallback(provider: OAuthApi.AdminProvider) {
  const value = `${window.location.origin}${provider.callbackPath}`;
  try {
    await navigator.clipboard.writeText(value);
    message.success($t('oauthSettings.providers.copied'));
  } catch {
    message.info(value);
  }
}

async function saveProvider() {
  if (!form.displayName.trim()) {
    message.warning($t('oauthSettings.form.displayNameRequired'));
    return;
  }
  if (!isEditing.value && !/^[a-z][a-z0-9_]{1,31}$/.test(form.providerKey || '')) {
    message.warning($t('oauthSettings.form.providerKeyInvalid'));
    return;
  }
  savingProvider.value = true;
  try {
    const payload = {
      ...form,
      defaultRoleId: String(form.defaultRoleId ?? '0'),
    };
    if (isEditing.value) {
      await updateOAuthProviderApi(editing.value!.providerKey, payload);
    } else {
      await createOAuthProviderApi(payload);
    }
    message.success($t('oauthSettings.saved'));
    drawerOpen.value = false;
    await load();
  } finally {
    savingProvider.value = false;
  }
}

async function testProvider(provider: OAuthApi.AdminProvider) {
  if (testingProvider.value) return;
  testingProvider.value = provider.providerKey;
  try {
    const result = await testOAuthProviderApi(provider.providerKey);
    if (result.authorizeUrl) {
      window.open(result.authorizeUrl, '_blank', 'noopener,noreferrer');
      message.info($t('oauthSettings.providers.testOpened'));
    }
  } finally {
    testingProvider.value = '';
  }
}

onMounted(load);
</script>

<template>
  <Page auto-content-height>
    <div v-if="loading" class="flex h-full items-center justify-center">
      <Spin size="large" />
    </div>
    <div v-else class="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4">
      <div>
        <h2 class="text-xl font-semibold">
          {{ $t('oauthSettings.title') }}
        </h2>
        <p class="text-muted-foreground mt-1 text-sm">
          {{ $t('oauthSettings.description') }}
        </p>
      </div>

      <Alert
        :message="$t('oauthSettings.alert.title')"
        :description="$t('oauthSettings.alert.description')"
        type="warning"
        show-icon
      />

      <Card :title="$t('oauthSettings.global.title')">
        <Form layout="vertical">
          <FormItem :label="$t('oauthSettings.global.frontendBaseUrl')">
            <Input
              v-model:value="globalForm.frontendBaseUrl"
              :placeholder="
                $t('oauthSettings.global.frontendBaseUrlPlaceholder')
              "
            />
          </FormItem>
          <p class="text-muted-foreground -mt-2 mb-3 text-xs">
            {{ $t('oauthSettings.global.registrationMovedHint') }}
          </p>
          <Button
            :loading="savingGlobal"
            type="primary"
            @click="saveGlobal"
          >
            {{ $t('oauthSettings.global.save') }}
          </Button>
        </Form>
      </Card>

      <Card :title="$t('oauthSettings.providers.title')">
        <template #extra>
          <Button type="primary" @click="openCreate">
            {{ $t('oauthSettings.providers.add') }}
          </Button>
        </template>
        <div v-if="providers.length === 0" class="text-muted-foreground py-6 text-sm">
          {{ $t('oauthSettings.providers.empty') }}
        </div>
        <div v-else class="grid gap-3">
          <div
            v-for="provider in providers"
            :key="provider.providerKey"
            class="border-border flex flex-col gap-3 rounded-lg border p-4 lg:flex-row lg:items-center lg:justify-between"
          >
            <div class="flex items-start gap-3">
              <div
                class="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-full"
              >
                <OAuthProviderIcon
                  :display-name="provider.displayName"
                  :icon-key="provider.iconKey"
                />
              </div>
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-semibold">{{ provider.displayName }}</span>
                  <Tag :color="provider.enabled ? 'green' : 'default'">
                    {{
                      provider.enabled
                        ? $t('oauthSettings.providers.enabled')
                        : $t('oauthSettings.providers.disabled')
                    }}
                  </Tag>
                  <Tag>{{ provider.driver }}</Tag>
                  <Tag v-if="provider.registerMode === 'confirm'" color="blue">
                    {{ $t('oauthSettings.form.registerModeConfirm') }}
                  </Tag>
                </div>
                <p class="text-muted-foreground mt-1 break-all text-xs">
                  {{ provider.providerKey }} · {{ provider.clientId || '-' }}
                </p>
                <p class="text-muted-foreground mt-1 break-all text-xs">
                  {{ provider.redirectUri || $t('oauthSettings.providers.noRedirect') }}
                </p>
              </div>
            </div>
            <div class="flex shrink-0 flex-wrap gap-2">
              <Button @click="copyCallback(provider)">
                {{ $t('oauthSettings.providers.copyCallback') }}
              </Button>
              <Button
                :loading="testingProvider === provider.providerKey"
                @click="testProvider(provider)"
              >
                {{ $t('oauthSettings.providers.test') }}
              </Button>
              <Button type="primary" @click="openEdit(provider)">
                {{ $t('oauthSettings.providers.edit') }}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>

    <Drawer
      v-model:open="drawerOpen"
      :title="
        isEditing
          ? $t('oauthSettings.form.editTitle', [form.displayName])
          : $t('oauthSettings.form.createTitle')
      "
      width="620"
    >
      <Form layout="vertical">
        <div class="grid gap-4 md:grid-cols-2">
          <FormItem :label="$t('oauthSettings.form.providerKey')" required>
            <Input
              v-model:value="form.providerKey"
              :disabled="isEditing"
              placeholder="github"
            />
          </FormItem>
          <FormItem :label="$t('oauthSettings.form.displayName')" required>
            <Input v-model:value="form.displayName" placeholder="GitHub" />
          </FormItem>
          <FormItem :label="$t('oauthSettings.form.driver')">
            <Select
              v-model:value="form.driver"
              :options="driverOptions"
            />
          </FormItem>
          <FormItem :label="$t('oauthSettings.form.icon')">
            <Select v-model:value="form.iconKey" :options="iconOptions" />
          </FormItem>
          <FormItem :label="$t('oauthSettings.form.group')">
            <Input v-model:value="form.providerGroup" placeholder="github" />
          </FormItem>
          <FormItem :label="$t('oauthSettings.form.sortNo')">
            <InputNumber
              v-model:value="form.sortNo"
              :min="0"
              :max="9999"
              class="w-full"
            />
          </FormItem>
        </div>

        <div class="mb-4 flex flex-wrap items-center gap-6">
          <div class="flex items-center gap-2">
            <Switch v-model:checked="form.enabled" />
            <span>{{ $t('oauthSettings.form.enabled') }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span>{{ $t('oauthSettings.form.registerMode') }}</span>
            <Select
              v-model:value="form.registerMode"
              :options="registerModeOptions"
              class="w-44"
            />
          </div>
          <div class="flex items-center gap-2">
            <span>{{ $t('oauthSettings.form.requireVerifiedEmail') }}</span>
            <Select
              v-model:value="form.requireVerifiedEmailMode"
              :options="requireVerifiedEmailOptions"
              class="w-40"
            />
          </div>
        </div>
        <p v-if="cannotRequireEmail" class="mb-3 text-xs text-amber-600">
          {{ $t('oauthSettings.form.qqWechatEmailHint') }}
        </p>

        <div class="mb-4 grid gap-4 md:grid-cols-2">
          <FormItem :label="$t('oauthSettings.form.defaultRole')">
            <Select
              v-model:value="form.defaultRoleId"
              :options="roleOptions"
            />
          </FormItem>
          <FormItem :label="$t('oauthSettings.form.registerGiftPoints')">
            <InputNumber
              v-model:value="form.registerGiftPoints"
              :min="-1"
              :max="1000000000"
              class="w-full"
            />
          </FormItem>
          <FormItem :label="$t('oauthSettings.form.registerIpHourLimit')">
            <InputNumber
              v-model:value="form.registerIpHourLimit"
              :min="-1"
              :max="1000000"
              class="w-full"
            />
          </FormItem>
          <FormItem :label="$t('oauthSettings.form.registerIpDayLimit')">
            <InputNumber
              v-model:value="form.registerIpDayLimit"
              :min="-1"
              :max="1000000"
              class="w-full"
            />
          </FormItem>
          <FormItem :label="$t('oauthSettings.form.registerIpMaxAccounts')">
            <InputNumber
              v-model:value="form.registerIpMaxAccounts"
              :min="-1"
              :max="1000000"
              class="w-full"
            />
          </FormItem>
        </div>
        <p class="text-muted-foreground -mt-2 mb-4 text-xs">
          {{ $t('oauthSettings.form.inheritHint') }}
        </p>

        <div class="mb-4 grid gap-4 md:grid-cols-2">
          <FormItem :label="$t('oauthSettings.form.minAccountAgeDays')">
            <InputNumber
              v-model:value="form.minAccountAgeDays"
              :min="0"
              :max="36500"
              class="w-full"
            />
          </FormItem>
          <FormItem :label="$t('oauthSettings.form.minTrustLevel')">
            <InputNumber
              v-model:value="form.minTrustLevel"
              :min="0"
              :max="100"
              class="w-full"
            />
          </FormItem>
        </div>
        <div class="mb-4 flex flex-wrap items-center gap-6">
          <div class="flex items-center gap-2">
            <Switch v-model:checked="form.requireActive" />
            <span>{{ $t('oauthSettings.form.requireActive') }}</span>
          </div>
          <div class="flex items-center gap-2">
            <Switch v-model:checked="form.rejectSilenced" />
            <span>{{ $t('oauthSettings.form.rejectSilenced') }}</span>
          </div>
        </div>

        <FormItem :label="$t('oauthSettings.form.clientId')">
          <Input v-model:value="form.clientId" autocomplete="off" />
        </FormItem>
        <FormItem :label="$t('oauthSettings.form.clientSecret')">
          <InputPassword
            v-model:value="form.clientSecret"
            :disabled="form.clearClientSecret"
            :placeholder="
              editing?.hasClientSecret
                ? $t('oauthSettings.form.secretKeep')
                : $t('oauthSettings.form.secretPlaceholder')
            "
            autocomplete="new-password"
          />
          <div
            v-if="editing?.hasClientSecret"
            class="mt-2 flex items-center gap-2"
          >
            <Switch v-model:checked="form.clearClientSecret" size="small" />
            <span class="text-muted-foreground text-xs">
              {{ $t('oauthSettings.form.clearSecret') }}
            </span>
          </div>
        </FormItem>
        <FormItem :label="$t('oauthSettings.form.redirectUri')">
          <Input v-model:value="form.redirectUri" />
          <Button
            v-if="isEditing"
            class="mt-2"
            size="small"
            @click="useSuggestedCallback"
          >
            {{ $t('oauthSettings.form.useCallback') }}
          </Button>
        </FormItem>
        <FormItem :label="$t('oauthSettings.form.scopes')">
          <Input v-model:value="form.scopes" placeholder="read:user user:email" />
        </FormItem>

        <template v-if="isGenericDriver">
          <FormItem :label="$t('oauthSettings.form.issuer')">
            <Input v-model:value="form.issuer" placeholder="https://example.com" />
          </FormItem>
          <FormItem :label="$t('oauthSettings.form.authEndpoint')">
            <Input v-model:value="form.authorizationEndpoint" />
          </FormItem>
          <FormItem :label="$t('oauthSettings.form.tokenEndpoint')">
            <Input v-model:value="form.tokenEndpoint" />
          </FormItem>
          <FormItem :label="$t('oauthSettings.form.userinfoEndpoint')">
            <Input v-model:value="form.userinfoEndpoint" />
          </FormItem>
          <FormItem :label="$t('oauthSettings.form.jwksUri')">
            <Input v-model:value="form.jwksUri" />
          </FormItem>
          <p class="text-muted-foreground mb-4 text-xs">
            {{ $t('oauthSettings.form.extraConfigHint') }}
          </p>
        </template>
      </Form>
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button @click="drawerOpen = false">
            {{ $t('oauthSettings.form.cancel') }}
          </Button>
          <Button
            :loading="savingProvider"
            type="primary"
            @click="saveProvider"
          >
            {{ $t('oauthSettings.form.save') }}
          </Button>
        </div>
      </template>
    </Drawer>
  </Page>
</template>
