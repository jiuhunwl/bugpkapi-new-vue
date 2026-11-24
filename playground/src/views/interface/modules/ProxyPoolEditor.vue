<script setup lang="ts">
import type { InterfaceApi } from '#/api/interface';

import { computed, ref, shallowRef, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  AutoComplete,
  Button,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Radio,
  Select,
  SelectOption,
  Switch,
  Tooltip,
} from 'ant-design-vue';

import {
  inspectInterfaceProxyPool,
  testInterfaceProxyPool,
} from '#/api/interface';
import { $t } from '#/locales';

import {
  clearProxyPoolConfig,
  clearProxyPoolPassword,
  normalizeProxyPoolDraft,
} from '../proxy-pool';

interface HeaderRow extends InterfaceApi.ProxyHeader {
  clientId: string;
}

const props = defineProps<{
  interfaceId?: string;
}>();

const model = defineModel<InterfaceApi.ProxyPoolConfig>({ required: true });
const headerRows = ref<HeaderRow[]>([]);
const candidates = ref<InterfaceApi.ProxyPoolCandidate[]>([]);
const inspecting = shallowRef(false);
const inspectionText = shallowRef('');
const testing = shallowRef(false);
const testText = shallowRef('');
const testTarget = ref<InterfaceApi.ProxyPoolTestTarget>('bilibili');
const customTestUrl = ref('');

const candidateOptions = computed(() =>
  candidates.value.map((item) => ({
    label: `${item.path} · ${item.value}`,
    value: item.path,
  })),
);
const passwordPlaceholder = computed(() =>
  model.value.passwordConfigured
    ? $t('polling.proxy.passwordConfigured')
    : $t('polling.proxy.passwordPlaceholder'),
);
const configurationDisabled = computed(() => model.value.enabled !== 1);

watch(
  () => model.value.apiHeaders,
  (items) => {
    const nextSignature = JSON.stringify(items || []);
    const currentSignature = JSON.stringify(
      headerRows.value.map(({ name, value }) => ({ name, value })),
    );
    if (nextSignature === currentSignature) return;
    headerRows.value = (items || []).map((item) => ({
      ...item,
      clientId: crypto.randomUUID(),
    }));
  },
  { deep: true, immediate: true },
);

function patchModel(patch: Partial<InterfaceApi.ProxyPoolConfig>) {
  model.value = { ...model.value, ...patch };
  inspectionText.value = '';
  testText.value = '';
}

function setEnabled(checked: boolean | number | string) {
  patchModel({ enabled: checked === true ? 1 : 0 });
}

function setSource(value: unknown) {
  patchModel({ source: value === 'API' ? 'API' : 'FIXED' });
}

function setProtocol(value: unknown) {
  const protocol =
    value === 'HTTPS' || value === 'SOCKS5' ? value : 'HTTP';
  patchModel({ protocol });
}

function clearPassword() {
  model.value = clearProxyPoolPassword(model.value);
  inspectionText.value = '';
}

function clearConfiguration() {
  Modal.confirm({
    content: $t('polling.proxy.clearDescription'),
    okButtonProps: { danger: true },
    okText: $t('polling.proxy.clear'),
    title: $t('polling.proxy.clearConfirm'),
    onOk: () => {
      model.value = clearProxyPoolConfig();
      candidates.value = [];
      inspectionText.value = '';
      testText.value = '';
    },
  });
}

function addHeader() {
  headerRows.value.push({
    clientId: crypto.randomUUID(),
    name: '',
    value: '',
  });
  syncHeaders();
}

function updateHeader(
  index: number,
  field: keyof InterfaceApi.ProxyHeader,
  value: string,
) {
  const row = headerRows.value[index];
  if (!row) return;
  row[field] = value;
  syncHeaders();
}

function removeHeader(index: number) {
  headerRows.value.splice(index, 1);
  syncHeaders();
}

function syncHeaders() {
  patchModel({
    apiHeaders: headerRows.value.map(({ name, value }) => ({ name, value })),
  });
}

async function inspectPool() {
  if (inspecting.value) return;
  inspecting.value = true;
  inspectionText.value = '';
  try {
    const result = await inspectInterfaceProxyPool(
      props.interfaceId,
      normalizeProxyPoolDraft(model.value),
    );
    candidates.value = result.candidates || [];
    patchModel({ jsonPath: result.detectedPath || model.value.jsonPath });
    inspectionText.value = `${result.host}:${result.port} · ${result.protocol}`;
    message.success($t('polling.proxy.inspectDone'));
  } catch {
    message.error($t('polling.proxy.inspectFailed'));
  } finally {
    inspecting.value = false;
  }
}

async function testProxy() {
  if (testing.value) return;
  testing.value = true;
  testText.value = '';
  try {
    const result = await testInterfaceProxyPool(
      props.interfaceId,
      normalizeProxyPoolDraft(model.value),
      testTarget.value,
      testTarget.value === 'custom' ? customTestUrl.value : '',
    );
    const targetLabel = result.target
      ? ` · ${result.target}`
      : '';
    testText.value = `${result.exitIp} · ${result.proxyAddress} · ${result.elapsedMs}ms${targetLabel}`;
    message.success($t('polling.proxy.testDone'));
  } catch {
    message.error($t('polling.proxy.testFailed'));
  } finally {
    testing.value = false;
  }
}
</script>

<template>
  <section class="proxy-panel">
    <header class="proxy-header">
      <div>
        <strong>{{ $t('polling.proxy.title') }}</strong>
        <p>{{ $t('polling.proxy.description') }}</p>
      </div>
      <div class="proxy-actions">
        <Button danger size="small" @click="clearConfiguration">
          <IconifyIcon class="size-4" icon="lucide:eraser" />
          {{ $t('polling.proxy.clear') }}
        </Button>
        <Select
          class="proxy-test-target"
          :value="testTarget"
          size="small"
          @update:value="(value: any) => { if (value) { testTarget = value as InterfaceApi.ProxyPoolTestTarget; testText = ''; } }"
        >
          <SelectOption value="bilibili">{{ $t('polling.proxy.testTargetBilibili') }}</SelectOption>
          <SelectOption value="baidu">{{ $t('polling.proxy.testTargetBaidu') }}</SelectOption>
          <SelectOption value="douyin">{{ $t('polling.proxy.testTargetDouyin') }}</SelectOption>
          <SelectOption value="kuaishou">{{ $t('polling.proxy.testTargetKuaishou') }}</SelectOption>
          <SelectOption value="taobao">{{ $t('polling.proxy.testTargetTaobao') }}</SelectOption>
          <SelectOption value="custom">{{ $t('polling.proxy.testTargetCustom') }}</SelectOption>
        </Select>
        <Button :loading="testing" size="small" @click="testProxy">
          <IconifyIcon class="size-4" icon="lucide:activity" />
          {{ $t('polling.proxy.test') }}
        </Button>
        <Switch
          :checked="model.enabled === 1"
          :checked-children="$t('polling.enabled')"
          :un-checked-children="$t('polling.disabled')"
          @change="setEnabled"
        />
      </div>
    </header>

    <div v-if="testText" class="proxy-test-result">{{ testText }}</div>

    <div v-if="testTarget === 'custom'" class="proxy-custom-test-row">
      <Input
        :placeholder="$t('polling.proxy.customTestUrlPlaceholder')"
        :value="customTestUrl"
        size="small"
        @update:value="(value: string) => { customTestUrl = value; testText = ''; }"
      />
    </div>

    <fieldset class="proxy-content" :disabled="configurationDisabled">
      <Form layout="vertical">
        <div class="mode-grid">
          <Form.Item :label="$t('polling.proxy.source')">
            <Radio.Group
              button-style="solid"
              option-type="button"
              :value="model.source"
              @update:value="setSource"
            >
              <Radio.Button value="FIXED">
                {{ $t('polling.proxy.sources.fixed') }}
              </Radio.Button>
              <Radio.Button value="API">
                {{ $t('polling.proxy.sources.api') }}
              </Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item :label="$t('polling.proxy.protocol')">
            <Radio.Group
              button-style="solid"
              option-type="button"
              :value="model.protocol"
              @update:value="setProtocol"
            >
              <Radio.Button value="HTTP">HTTP</Radio.Button>
              <Radio.Button value="HTTPS">HTTPS</Radio.Button>
              <Radio.Button value="SOCKS5">SOCKS5</Radio.Button>
            </Radio.Group>
          </Form.Item>
        </div>

        <div v-if="model.source === 'FIXED'" class="field-grid address-grid">
          <Form.Item :label="$t('polling.proxy.host')" required>
            <Input
              :placeholder="$t('polling.proxy.hostPlaceholder')"
              :value="model.host"
              @update:value="patchModel({ host: $event })"
            />
          </Form.Item>
          <Form.Item :label="$t('polling.proxy.port')" required>
            <InputNumber
              class="w-full"
              :max="65535"
              :min="1"
              :value="model.port || undefined"
              @update:value="patchModel({ port: Number($event || 0) })"
            />
          </Form.Item>
        </div>

        <template v-else>
          <div class="field-grid api-grid">
            <Form.Item :label="$t('polling.proxy.apiUrl')" required>
              <Input
                :placeholder="$t('polling.proxy.apiUrlPlaceholder')"
                :value="model.apiUrl"
                @update:value="patchModel({ apiUrl: $event })"
              />
            </Form.Item>
            <Form.Item :label="$t('polling.proxy.refreshSeconds')">
              <InputNumber
                class="w-full"
                :max="3600"
                :min="5"
                :value="model.refreshSeconds"
                @update:value="
                  patchModel({ refreshSeconds: Number($event || 30) })
                "
              />
            </Form.Item>
          </div>

          <div class="header-editor">
            <div class="subheader">
              <span>{{ $t('polling.proxy.headers') }}</span>
              <Button size="small" @click="addHeader">
                <IconifyIcon class="size-4" icon="lucide:plus" />
                {{ $t('polling.proxy.addHeader') }}
              </Button>
            </div>
            <div v-if="headerRows.length" class="header-list">
              <div
                v-for="(item, index) in headerRows"
                :key="item.clientId"
                class="header-row"
              >
                <Input
                  :placeholder="$t('polling.proxy.headerName')"
                  :value="item.name"
                  @update:value="updateHeader(index, 'name', $event)"
                />
                <Input
                  :placeholder="$t('polling.proxy.headerValue')"
                  :value="item.value"
                  @update:value="updateHeader(index, 'value', $event)"
                />
                <Tooltip :title="$t('polling.proxy.removeHeader')">
                  <Button
                    danger
                    type="text"
                    :aria-label="$t('polling.proxy.removeHeader')"
                    @click="removeHeader(index)"
                  >
                    <IconifyIcon class="size-4" icon="lucide:trash-2" />
                  </Button>
                </Tooltip>
              </div>
            </div>
          </div>

          <Form.Item :label="$t('polling.proxy.jsonPath')">
            <div class="inspect-row">
              <AutoComplete
                class="w-full"
                :options="candidateOptions"
                :placeholder="$t('polling.proxy.jsonPathPlaceholder')"
                :value="model.jsonPath"
                @update:value="patchModel({ jsonPath: String($event || '') })"
              />
              <Button :loading="inspecting" @click="inspectPool">
                <IconifyIcon class="size-4" icon="lucide:scan-search" />
                {{ $t('polling.proxy.inspect') }}
              </Button>
            </div>
            <div v-if="inspectionText" class="inspection-result">
              {{ inspectionText }}
            </div>
          </Form.Item>
        </template>

        <div class="field-grid credential-grid">
          <Form.Item :label="$t('polling.proxy.username')">
            <Input
              autocomplete="off"
              :placeholder="$t('polling.proxy.usernamePlaceholder')"
              :value="model.username"
              @update:value="patchModel({ username: $event })"
            />
          </Form.Item>
          <Form.Item :label="$t('polling.proxy.password')">
            <div class="password-field">
              <Input.Password
                autocomplete="new-password"
                :placeholder="passwordPlaceholder"
                :value="model.password"
                @update:value="patchModel({ password: $event })"
              />
              <Button
                v-if="model.passwordConfigured"
                class="clear-password-button"
                danger
                size="small"
                type="link"
                @click="clearPassword"
              >
                <IconifyIcon class="size-4" icon="lucide:key-round" />
                {{ $t('polling.proxy.clearPassword') }}
              </Button>
            </div>
          </Form.Item>
        </div>
      </Form>
    </fieldset>
  </section>
</template>

<style scoped>
.proxy-panel {
  display: grid;
  gap: 14px;
  padding: 14px;
  margin-bottom: 18px;
  color: hsl(var(--foreground));
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.proxy-header,
.subheader {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
}

.proxy-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 8px;
  align-items: center;
}

.proxy-header p {
  margin-top: 4px;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.proxy-content {
  min-width: 0;
  padding-top: 2px;
  margin: 0;
  border: 0;
  border-top: 1px solid hsl(var(--border));
}

.proxy-content:disabled {
  opacity: 0.58;
}

.proxy-test-result {
  padding: 8px 10px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 40%);
  border: 1px solid hsl(var(--border));
  border-radius: 4px;
}

.proxy-test-target {
  min-width: 84px;
}

.proxy-custom-test-row {
  display: grid;
  margin-top: 8px;
}

.mode-grid,
.field-grid {
  display: grid;
  gap: 12px;
}

.mode-grid,
.credential-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.address-grid,
.api-grid {
  grid-template-columns: minmax(0, 1fr) minmax(140px, 0.32fr);
}

.header-editor {
  display: grid;
  gap: 8px;
  margin-bottom: 18px;
}

.subheader {
  align-items: center;
  min-height: 32px;
}

.header-list {
  display: grid;
  gap: 8px;
}

.header-row {
  display: grid;
  grid-template-columns: minmax(120px, 0.7fr) minmax(0, 1.3fr) 36px;
  gap: 8px;
  align-items: center;
}

.inspect-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

.inspection-result {
  margin-top: 7px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.password-field {
  display: grid;
  gap: 6px;
}

.clear-password-button {
  justify-self: start;
  padding-inline: 0;
}

@media (max-width: 720px) {
  .proxy-header {
    align-items: flex-start;
  }

  .proxy-actions {
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .mode-grid,
  .field-grid,
  .address-grid,
  .api-grid,
  .credential-grid,
  .header-row,
  .inspect-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .mode-grid :deep(.ant-radio-group) {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .mode-grid :deep(.ant-radio-button-wrapper) {
    padding-inline: 8px;
    overflow: hidden;
    text-align: center;
    text-overflow: ellipsis;
  }

  .header-row :deep(.ant-btn) {
    justify-self: end;
  }

  .inspect-row :deep(.ant-btn) {
    width: 100%;
  }
}
</style>

