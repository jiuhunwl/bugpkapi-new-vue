<script lang="ts" setup>
import type { CaptchaConfigApi } from '#/api';

import { computed, onMounted, ref, shallowRef } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon, RotateCw } from '@vben/icons';
import { useAccessStore, useUserStore } from '@vben/stores';

import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  FormItem,
  Input,
  InputNumber,
  message,
  Radio,
  Select,
  Slider,
  Spin,
  Switch,
  Tag,
} from 'ant-design-vue';

import {
  getCaptchaConfigApi,
  updateCaptchaConfigApi,
  updateCaptchaGlobalApi,
  updateCaptchaScenesApi,
} from '#/api/system/captcha-config';
import { $t } from '#/locales';

import CaptchaSceneSelector from './components/CaptchaSceneSelector.vue';

defineOptions({ name: 'SystemCaptchaConfig' });

const loading = ref(false);
const loadError = ref(false);
const saving = ref(false);
const sceneSaving = ref(false);
const globalSaving = ref(false);
const accessStore = useAccessStore();
const userStore = useUserStore();
const isAdmin = computed(() => userStore.userRoles.includes('admin'));
const hasCode = (code: string) =>
  isAdmin.value || accessStore.accessCodes.includes(code);
const canUpdate = computed(() => hasCode('system:captcha-config:update'));

const scenes = ref<string[]>([]);
const providers = ref<CaptchaConfigApi.ProviderOption[]>([]);
const configs = shallowRef<Record<string, CaptchaConfigApi.SceneConfig>>({});
const enabledScenes = ref<string[]>([]);
const savedEnabledScenes = ref<string[]>([]);
const globalEnabled = ref(true);
const scene = ref('default');
const provider = ref('pow');
const difficulty = ref(3);
const captchaId = ref('');
const apiKey = ref('');
const siteKey = ref('');
const secretKey = ref('');
const product = ref<'bind' | 'float' | 'popup'>('float');
const language = ref('');
const action = ref('');
const hostname = ref('');
const cdata = ref('');
const timeoutMs = ref(3000);
// 当前场景没有独立配置、沿用默认场景的 Provider
const inherited = ref(false);

const POW_PROVIDER = 'pow';
const GEETEST4_PROVIDER = 'geetest4';
const CLOUDFLARE_PROVIDER = 'cloudflare';

const isPow = computed(() => provider.value === POW_PROVIDER);
const isGeeTest4 = computed(() => provider.value === GEETEST4_PROVIDER);
const isCloudflare = computed(() => provider.value === CLOUDFLARE_PROVIDER);
const productOptions = computed(() => [
  { label: $t('captchaConfig.products.float'), value: 'float' },
  { label: $t('captchaConfig.products.popup'), value: 'popup' },
  { label: $t('captchaConfig.products.bind'), value: 'bind' },
]);
const activeProvider = computed(() =>
  providers.value.find((item) => item.key === provider.value),
);

function applyConfig(cfg?: CaptchaConfigApi.SceneConfig) {
  provider.value = cfg?.provider || POW_PROVIDER;
  inherited.value = cfg?.inherited === true;
  difficulty.value = cfg?.difficulty ?? 3;
  captchaId.value = cfg?.captchaId || '';
  apiKey.value = cfg?.apiKey || '';
  siteKey.value = cfg?.siteKey || '';
  secretKey.value = cfg?.secretKey || '';
  product.value = cfg?.product || 'float';
  language.value = cfg?.language || '';
  action.value = cfg?.action || '';
  hostname.value = cfg?.hostname || '';
  cdata.value = cfg?.cdata || '';
  timeoutMs.value = cfg?.timeoutMs || 3000;
}

async function loadConfig() {
  loading.value = true;
  loadError.value = false;
  try {
    const result = await getCaptchaConfigApi();
    scenes.value = result.scenes || [];
    providers.value = result.providers || [];
    configs.value = result.configs || {};
    globalEnabled.value = result.globalEnabled !== false;
    const selectedScenes =
      result.enabledScenes ||
      scenes.value.filter((item) => result.configs?.[item]?.enabled === 1);
    enabledScenes.value = [...selectedScenes];
    savedEnabledScenes.value = [...selectedScenes];
    if (!scenes.value.includes(scene.value)) {
      scene.value = scenes.value[0] || 'default';
    }
    applyConfig(configs.value[scene.value]);
  } catch {
    loadError.value = true;
    message.error($t('captchaConfig.loadFailed'));
  } finally {
    loading.value = false;
  }
}

async function onSaveGlobal() {
  if (!canUpdate.value) {
    message.warning($t('captchaConfig.noPermission'));
    return;
  }
  globalSaving.value = true;
  try {
    await updateCaptchaGlobalApi({ enabled: globalEnabled.value });
    message.success(
      $t(
        globalEnabled.value
          ? 'captchaConfig.globalEnabledMessage'
          : 'captchaConfig.globalDisabledMessage',
      ),
    );
  } catch {
    globalEnabled.value = !globalEnabled.value;
  } finally {
    globalSaving.value = false;
  }
}

function onSceneChange(value: string) {
  scene.value = value;
  applyConfig(configs.value[value]);
}

async function onSaveScenes() {
  if (!canUpdate.value) {
    message.warning($t('captchaConfig.noPermission'));
    return;
  }
  sceneSaving.value = true;
  try {
    await updateCaptchaScenesApi({ scenes: enabledScenes.value });
    savedEnabledScenes.value = [...enabledScenes.value];
    message.success($t('captchaConfig.scenesUpdated'));
    await loadConfig();
  } finally {
    sceneSaving.value = false;
  }
}

async function onSave() {
  if (!canUpdate.value) {
    message.warning($t('captchaConfig.noPermission'));
    return;
  }
  saving.value = true;
  try {
    const payload: CaptchaConfigApi.SaveParams = {
      scene: scene.value,
      provider: provider.value,
      enabled: savedEnabledScenes.value.includes(scene.value) ? 1 : 0,
      difficulty: difficulty.value,
      timeoutMs: timeoutMs.value,
      failurePolicy: 'deny',
    };
    if (isGeeTest4.value) {
      payload.captchaId = captchaId.value.trim();
      payload.apiKey = apiKey.value.trim();
      payload.product = product.value;
      payload.language = language.value.trim();
    }
    if (isCloudflare.value) {
      payload.siteKey = siteKey.value.trim();
      payload.secretKey = secretKey.value.trim();
      payload.action = action.value.trim();
      payload.hostname = hostname.value.trim();
      payload.cdata = cdata.value.trim();
    }
    await updateCaptchaConfigApi(payload);
    message.success($t('captchaConfig.saveSuccess'));
    const pendingSceneSelection = [...enabledScenes.value];
    await loadConfig();
    enabledScenes.value = pendingSceneSelection;
  } finally {
    saving.value = false;
  }
}

onMounted(loadConfig);
</script>

<template>
  <Page
    auto-content-height
    class="captcha-page"
    :description="$t('captchaConfig.description')"
    :title="$t('captchaConfig.title')"
  >
    <template #extra>
      <div class="captcha-page-actions">
        <Tag :color="globalEnabled ? 'green' : 'default'">
          {{
            $t(
              globalEnabled
                ? 'captchaConfig.globalOn'
                : 'captchaConfig.globalOff',
            )
          }}
        </Tag>
        <Button :loading="loading" @click="loadConfig">
          <template #icon>
            <RotateCw class="size-4" />
          </template>
          {{ $t('captchaConfig.refresh') }}
        </Button>
      </div>
    </template>

    <Spin :spinning="loading">
      <div class="captcha-shell">
        <Alert
          v-if="loadError"
          :description="$t('captchaConfig.loadFailed')"
          :message="$t('captchaConfig.loadFailedTitle')"
          show-icon
          type="error"
        >
          <template #action>
            <Button size="small" @click="loadConfig">
              {{ $t('captchaConfig.refresh') }}
            </Button>
          </template>
        </Alert>

        <Empty
          v-if="!loadError && (!scenes.length || !providers.length)"
          :description="$t('page.dashboard.workbench.notice.empty')"
        />

        <Card class="captcha-card captcha-global-card" :bordered="false">
          <section class="captcha-global-switch">
            <span class="captcha-section-icon">
              <IconifyIcon icon="lucide:shield-check" />
            </span>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <strong>{{ $t('captchaConfig.globalTitle') }}</strong>
                <Tag :color="globalEnabled ? 'green' : 'default'">
                  {{
                    $t(
                      globalEnabled
                        ? 'captchaConfig.globalOn'
                        : 'captchaConfig.globalOff',
                    )
                  }}
                </Tag>
              </div>
              <p>{{ $t('captchaConfig.globalDescription') }}</p>
            </div>
            <Switch
              v-model:checked="globalEnabled"
              :disabled="!canUpdate || loading || globalSaving"
              :loading="globalSaving"
              @change="onSaveGlobal"
            />
          </section>
        </Card>

        <Alert
          v-if="!globalEnabled"
          :description="$t('captchaConfig.globalDisabledDescription')"
          :message="$t('captchaConfig.globalDisabledTitle')"
          show-icon
          type="warning"
        />

        <div
          v-if="!loadError && scenes.length && providers.length"
          class="captcha-layout transition-opacity"
          :class="{ 'pointer-events-none opacity-50': !globalEnabled }"
        >
          <Card class="captcha-card captcha-scene-card" :bordered="false">
            <template #title>
              <div class="captcha-card-title">
                <span>{{ $t('captchaConfig.sceneSectionTitle') }}</span>
                <small>{{ $t('captchaConfig.sceneDescription') }}</small>
              </div>
            </template>
            <CaptchaSceneSelector
              :active-scene="scene"
              :disabled="!canUpdate || loading || sceneSaving || !globalEnabled"
              :enabled-scenes="enabledScenes"
              :scenes="scenes"
              @update:active-scene="onSceneChange"
              @update:enabled-scenes="enabledScenes = $event"
            />
            <div class="captcha-card-actions">
              <Button
                :disabled="!canUpdate || loading || !globalEnabled"
                :loading="sceneSaving"
                type="primary"
                @click="onSaveScenes"
              >
                {{ $t('captchaConfig.saveSceneScope') }}
              </Button>
            </div>
          </Card>

          <Card class="captcha-card captcha-provider-card" :bordered="false">
            <template #title>
              <div class="captcha-card-title">
                <span>{{ $t('captchaConfig.provider') }}</span>
                <small>{{ $t('captchaConfig.providerDescription') }}</small>
              </div>
            </template>

            <div class="captcha-provider-summary">
              <div>
                <span>{{ $t('captchaConfig.currentProvider') }}</span>
                <strong>{{ activeProvider?.name || provider }}</strong>
                <p>{{ activeProvider?.description }}</p>
              </div>
              <div class="captcha-tags">
                <Tag v-if="inherited" color="cyan">
                  {{ $t('captchaConfig.inheritedHint') }}
                </Tag>
                <Tag color="green">{{ $t('captchaConfig.tags.pow') }}</Tag>
                <Tag color="blue">{{ $t('captchaConfig.tags.geetest') }}</Tag>
                <Tag color="purple">
                  {{ $t('captchaConfig.tags.cloudflare') }}
                </Tag>
              </div>
            </div>

            <Radio.Group
              v-model:value="provider"
              class="captcha-provider-options"
              :disabled="!canUpdate || !globalEnabled"
            >
              <label
                v-for="item in providers"
                :key="item.key"
                class="captcha-provider-option"
                :class="{ 'is-active': provider === item.key }"
              >
                <Radio :value="item.key">
                  <span class="font-medium">{{ item.name }}</span>
                </Radio>
                <span>{{ item.description }}</span>
              </label>
            </Radio.Group>

            <Form class="captcha-form" layout="vertical">
              <FormItem
                v-if="isPow"
                :label="$t('captchaConfig.difficultyLabel', [difficulty])"
              >
                <Slider
                  v-model:value="difficulty"
                  :disabled="!canUpdate || !globalEnabled"
                  :max="6"
                  :min="1"
                  :step="1"
                />
                <div class="captcha-field-help">
                  {{ $t('captchaConfig.difficultyTip') }}
                </div>
              </FormItem>

              <div v-if="isGeeTest4" class="captcha-form-grid">
                <FormItem :label="$t('captchaConfig.captchaIdLabel')" required>
                  <Input
                    v-model:value="captchaId"
                    :disabled="!canUpdate || !globalEnabled"
                    :maxlength="128"
                    :placeholder="$t('captchaConfig.captchaIdPlaceholder')"
                  />
                </FormItem>
                <FormItem :label="$t('captchaConfig.apiKeyLabel')" required>
                  <Input.Password
                    v-model:value="apiKey"
                    :disabled="!canUpdate || !globalEnabled"
                    :maxlength="128"
                    :placeholder="$t('captchaConfig.apiKeyPlaceholder')"
                  />
                </FormItem>
                <FormItem :label="$t('captchaConfig.productLabel')">
                  <Select
                    v-model:value="product"
                    :disabled="!canUpdate || !globalEnabled"
                    :options="productOptions"
                  />
                </FormItem>
                <FormItem :label="$t('captchaConfig.languageLabel')">
                  <Input
                    v-model:value="language"
                    :disabled="!canUpdate || !globalEnabled"
                    :maxlength="32"
                    :placeholder="$t('captchaConfig.languagePlaceholder')"
                  />
                </FormItem>
              </div>

              <div v-if="isCloudflare" class="captcha-form-grid">
                <FormItem :label="$t('captchaConfig.siteKeyLabel')" required>
                  <Input
                    v-model:value="siteKey"
                    :disabled="!canUpdate || !globalEnabled"
                    :maxlength="128"
                    :placeholder="$t('captchaConfig.siteKeyPlaceholder')"
                  />
                </FormItem>
                <FormItem :label="$t('captchaConfig.secretKeyLabel')" required>
                  <Input.Password
                    v-model:value="secretKey"
                    :disabled="!canUpdate || !globalEnabled"
                    :maxlength="128"
                    :placeholder="$t('captchaConfig.secretKeyPlaceholder')"
                  />
                </FormItem>
                <FormItem :label="$t('captchaConfig.actionLabel')">
                  <Input
                    v-model:value="action"
                    :disabled="!canUpdate || !globalEnabled"
                    :maxlength="32"
                    :placeholder="$t('captchaConfig.actionPlaceholder')"
                  />
                </FormItem>
                <FormItem :label="$t('captchaConfig.hostnameLabel')">
                  <Input
                    v-model:value="hostname"
                    :disabled="!canUpdate || !globalEnabled"
                    :maxlength="253"
                    :placeholder="$t('captchaConfig.hostnamePlaceholder')"
                  />
                </FormItem>
                <FormItem
                  class="captcha-form-wide"
                  :label="$t('captchaConfig.cdataLabel')"
                >
                  <Input
                    v-model:value="cdata"
                    :disabled="!canUpdate || !globalEnabled"
                    :maxlength="128"
                    :placeholder="$t('captchaConfig.cdataPlaceholder')"
                  />
                </FormItem>
              </div>

              <FormItem v-if="!isPow" :label="$t('captchaConfig.timeoutLabel')">
                <InputNumber
                  v-model:value="timeoutMs"
                  class="w-full"
                  :disabled="!canUpdate || !globalEnabled"
                  :max="30_000"
                  :min="100"
                  :step="100"
                />
              </FormItem>
            </Form>

            <Alert
              v-if="!isPow"
              :description="$t('captchaConfig.thirdPartyDescription')"
              :message="$t('captchaConfig.thirdPartyEnabled')"
              show-icon
              type="info"
            />

            <div class="captcha-card-actions">
              <Button
                :disabled="!canUpdate || !globalEnabled"
                :loading="saving"
                type="primary"
                @click="onSave"
              >
                {{ $t('captchaConfig.save') }}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </Spin>
  </Page>
</template>

<style scoped>
.captcha-shell {
  display: grid;
  gap: 16px;
  width: 100%;
  max-width: 1360px;
  margin: 0 auto;
}

.captcha-page-actions,
.captcha-card-actions,
.captcha-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.captcha-card {
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  box-shadow: none;
}

.captcha-global-switch {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
}

.captcha-section-icon {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  width: 44px;
  height: 44px;
  font-size: 21px;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 9%);
  border: 1px solid hsl(var(--primary) / 16%);
  border-radius: 10px;
}

.captcha-global-switch > div {
  flex: 1;
  min-width: 0;
}

.captcha-layout {
  display: grid;
  grid-template-columns: minmax(300px, 0.72fr) minmax(0, 1.45fr);
  gap: 16px;
  align-items: start;
}

.captcha-scene-card {
  position: sticky;
  top: 16px;
}

.captcha-card-title span,
.captcha-card-title small {
  display: block;
}

.captcha-card-title small {
  margin-top: 4px;
  font-size: 12px;
  font-weight: 400;
  color: hsl(var(--muted-foreground));
}

.captcha-provider-summary {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
  padding: 14px;
  margin-bottom: 16px;
  background: hsl(var(--muted) / 45%);
  border-radius: 12px;
}

.captcha-provider-summary > span {
  font-size: 11px;
  font-weight: 750;
  color: hsl(var(--primary));
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.captcha-provider-summary strong {
  display: block;
  margin-top: 6px;
  color: hsl(var(--foreground));
}

.captcha-provider-summary p,
.captcha-global-switch p {
  margin: 5px 0 0;
  font-size: 12px;
  line-height: 19px;
  color: hsl(var(--muted-foreground));
}

.captcha-tags :deep(.ant-tag) {
  margin-inline-end: 0;
}

.captcha-provider-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  width: 100%;
  margin-bottom: 18px;
}

.captcha-provider-option {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  cursor: pointer;
  border: 1px solid hsl(var(--border));
  border-radius: 9px;
  transition:
    border-color 160ms ease,
    background 160ms ease;
}

/* 这张卡本来就写了 cursor:pointer 和 border-color/background 的 transition，
   却一直没有 :hover 规则——过渡永远不会触发，鼠标扫过去毫无回应。
   补上悬浮态后，「可点击」这个暗示才算兑现（已选中态优先级更高，见下）。 */
.captcha-provider-option:hover {
  background: hsl(var(--muted) / 40%);
  border-color: hsl(var(--primary) / 32%);
}

.captcha-provider-option.is-active,
.captcha-provider-option.is-active:hover {
  background: hsl(var(--primary) / 5%);
  border-color: hsl(var(--primary) / 50%);
}

.captcha-provider-option:focus-within,
.captcha-global-switch :deep(.ant-switch:focus-visible),
.captcha-card-actions :deep(.ant-btn:focus-visible) {
  outline: 2px solid hsl(var(--primary) / 55%);
  outline-offset: 2px;
}

.captcha-provider-option > span {
  padding-left: 24px;
  font-size: 12px;
  line-height: 19px;
  color: hsl(var(--muted-foreground));
}

.captcha-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 16px;
}

.captcha-form-wide {
  grid-column: 1 / -1;
}

.captcha-field-help {
  margin-top: 6px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.captcha-card-actions {
  justify-content: flex-end;
  padding-top: 18px;
  margin-top: 18px;
  border-top: 1px solid hsl(var(--border));
}

.captcha-global-switch strong {
  font-size: 16px;
  color: hsl(var(--foreground));
}

.captcha-global-switch p {
  margin: 7px 0 0;
  font-size: 13px;
  line-height: 21px;
  color: hsl(var(--muted-foreground));
}

@media (max-width: 520px) {
  .captcha-global-switch {
    flex-wrap: wrap;
    align-items: flex-start;
  }
}

@media (max-width: 960px) {
  .captcha-layout {
    grid-template-columns: 1fr;
  }

  .captcha-scene-card {
    position: static;
  }
}

@media (max-width: 640px) {
  .captcha-page-actions {
    justify-content: space-between;
    width: 100%;
  }

  .captcha-provider-summary {
    flex-direction: column;
  }

  .captcha-provider-options,
  .captcha-form-grid {
    grid-template-columns: 1fr;
  }

  .captcha-form-wide {
    grid-column: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .captcha-provider-option {
    transition: none;
  }
}
</style>
