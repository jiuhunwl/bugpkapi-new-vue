<script lang="ts" setup>
import type { IpConfigApi } from '#/api/system/ip-config';
import type { IpFieldKey } from './mapping';

import { computed, onMounted, reactive, ref, shallowRef } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon, RotateCw } from '@vben/icons';
import { useAccessStore, useUserStore } from '@vben/stores';

import {
  Alert,
  AutoComplete,
  Button,
  Card,
  Input,
  message,
  Tag,
} from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  getIpSourceConfig,
  testIpSource,
  updateIpSourceConfig,
} from '#/api/system/ip-config';
import { $t } from '#/locales';

import {
  configuredIpFields,
  emptyIpFieldMappings,
  IP_FIELD_KEYS,
  missingCoordinatePairFields,
  parseIpFieldMappings,
  serializeIpFieldMappings,
} from './mapping';

type SourceType = 'bilibili' | 'custom' | 'default';

const DEFAULT_PARSE_RULE =
  'country=$.country, province=$.region, city=$.city, isp=$.connection.isp, latitude=$.latitude, longitude=$.longitude';
const BILIBILI_API_URL =
  'https://api.live.bilibili.com/ip_service/v1/ip_service/get_ip_addr?ip={ip}';
const BILIBILI_PARSE_RULE =
  'country=$.data.country, province=$.data.province, city=$.data.city, isp=$.data.isp, latitude=$.data.latitude, longitude=$.data.longitude';

const loading = shallowRef(false);
const saving = shallowRef(false);
const testing = shallowRef(false);
const sourceType = ref<SourceType>('default');
const testIp = ref('8.8.8.8');
const currentApiUrl = shallowRef('');
const fieldMappings = reactive(emptyIpFieldMappings());
const discoveredFields = ref<IpConfigApi.SourceFieldOption[]>([]);
const sourcePreview = ref<IpConfigApi.SourcePreview>();
const invalidFields = ref<string[]>([]);
const missingPairFields = ref<string[]>([]);
const testedRequestFingerprint = shallowRef<string>();
const accessStore = useAccessStore();
const userStore = useUserStore();
const isAdmin = computed(() => userStore.userRoles.includes('admin'));
const hasCode = (code: string) =>
  isAdmin.value || accessStore.accessCodes.includes(code);
const canUpdate = computed(() => hasCode('system:ip-config:update'));
const sourceCards = computed(() => [
  {
    description: $t('ipConfig.sourceDefaultDescription'),
    icon: 'lucide:badge-check',
    title: $t('ipConfig.sourceDefaultCard'),
    type: 'default' as const,
  },
  {
    description: $t('ipConfig.sourceBilibiliDescription'),
    icon: 'lucide:radio-tower',
    title: $t('ipConfig.sourceBilibiliCard'),
    type: 'bilibili' as const,
  },
  {
    description: $t('ipConfig.sourceCustomDescription'),
    icon: 'lucide:settings-2',
    title: $t('ipConfig.sourceCustomCard'),
    type: 'custom' as const,
  },
]);
const mappingFields = computed<
  Array<{
    description: string;
    key: IpFieldKey;
    label: string;
    coordinatePair: boolean;
  }>
>(() =>
  IP_FIELD_KEYS.map((key) => ({
    description: $t(`ipConfig.mapping.fields.${key}.description`),
    key,
    label: $t(`ipConfig.mapping.fields.${key}.label`),
    coordinatePair: ['latitude', 'longitude'].includes(key),
  })),
);

function createTestRequestFingerprint(
  apiUrl: unknown,
  ip: string,
  mappings: Record<IpFieldKey, string>,
) {
  return JSON.stringify([
    String(apiUrl ?? '').trim(),
    ip.trim(),
    serializeIpFieldMappings(mappings),
  ]);
}

const currentTestRequestFingerprint = computed(() =>
  createTestRequestFingerprint(
    currentApiUrl.value,
    testIp.value,
    fieldMappings,
  ),
);
const hasCurrentTestResult = computed(
  () =>
    testedRequestFingerprint.value !== undefined &&
    testedRequestFingerprint.value === currentTestRequestFingerprint.value,
);
const mappingOptions = computed(() =>
  hasCurrentTestResult.value
    ? discoveredFields.value.map((field) => ({
        label: `${field.path} · ${field.valuePreview || field.valueType}`,
        value: field.path,
      }))
    : [],
);
const visibleInvalidFields = computed(() =>
  hasCurrentTestResult.value ? invalidFields.value : [],
);
const visibleMissingPairFields = computed(() =>
  hasCurrentTestResult.value ? missingPairFields.value : [],
);
const visibleSourcePreview = computed(() =>
  hasCurrentTestResult.value ? sourcePreview.value : undefined,
);

const [IpSourceForm, ipSourceFormApi] = useVbenForm({
  commonConfig: {
    colon: true,
    componentProps: { class: 'w-full' },
    formItemClass: 'col-span-1',
    labelWidth: 120,
  },
  layout: 'horizontal',
  schema: [
    {
      component: 'Select',
      componentProps: {
        options: [
          { label: $t('ipConfig.sourceDefault'), value: 'default' },
          { label: $t('ipConfig.sourceBilibili'), value: 'bilibili' },
          { label: $t('ipConfig.sourceCustom'), value: 'custom' },
        ],
      },
      defaultValue: 'default',
      fieldName: 'sourceType',
      formItemClass: 'hidden',
      label: $t('ipConfig.sourceType'),
    },
    {
      component: 'Input',
      componentProps: {
        maxlength: 64,
        placeholder: $t('ipConfig.sourceNamePlaceholder'),
      },
      defaultValue: 'default',
      dependencies: {
        if: (values) => values.sourceType === 'custom',
        triggerFields: ['sourceType'],
      },
      fieldName: 'dataSourceName',
      label: $t('ipConfig.sourceName'),
    },
    {
      component: 'Switch',
      componentProps: {
        checkedChildren: $t('ipConfig.enabledOn'),
        unCheckedChildren: $t('ipConfig.enabledOff'),
      },
      defaultValue: true,
      fieldName: 'enabled',
      label: $t('ipConfig.enabled'),
    },
    {
      component: 'Input',
      componentProps: {
        maxlength: 1024,
        placeholder: BILIBILI_API_URL,
      },
      dependencies: {
        if: (values) => values.sourceType === 'custom',
        triggerFields: ['sourceType'],
      },
      fieldName: 'apiUrl',
      label: $t('ipConfig.apiUrl'),
    },
    {
      component: 'Textarea',
      componentProps: { maxlength: 255, rows: 2, showCount: true },
      fieldName: 'remark',
      formItemClass: 'col-span-1 md:col-span-2',
      label: $t('ipConfig.remark'),
    },
  ],
  handleValuesChange(values) {
    currentApiUrl.value = String(values.apiUrl ?? '');
  },
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 gap-x-4 gap-y-2 md:grid-cols-2',
});

function replaceFieldMappings(rule: string) {
  Object.assign(fieldMappings, parseIpFieldMappings(rule));
  discoveredFields.value = [];
  sourcePreview.value = undefined;
  invalidFields.value = [];
  missingPairFields.value = [];
  testedRequestFingerprint.value = undefined;
}

function parseSourceType(name: string): SourceType {
  const trimmed = String(name ?? '')
    .trim()
    .toLowerCase();
  if (trimmed === '' || trimmed === 'default') return 'default';
  return trimmed === 'bilibili' ? 'bilibili' : 'custom';
}

async function setSourcePreset(nextSourceType: SourceType) {
  if (loading.value || saving.value || testing.value) return;
  sourceType.value = nextSourceType;
  if (nextSourceType === 'default') {
    replaceFieldMappings(DEFAULT_PARSE_RULE);
    await ipSourceFormApi.setValues({
      apiUrl: '',
      dataSourceName: 'default',
      sourceType: nextSourceType,
    });
    return;
  }
  if (nextSourceType === 'bilibili') {
    replaceFieldMappings(BILIBILI_PARSE_RULE);
    await ipSourceFormApi.setValues({
      apiUrl: BILIBILI_API_URL,
      dataSourceName: 'bilibili',
      sourceType: nextSourceType,
    });
    return;
  }
  const values = await ipSourceFormApi.getValues();
  const currentName = String(values.dataSourceName ?? '')
    .trim()
    .toLowerCase();
  await ipSourceFormApi.setValues({
    dataSourceName:
      currentName === '' ||
      currentName === 'default' ||
      currentName === 'bilibili'
        ? 'custom_source'
        : currentName,
    sourceType: nextSourceType,
  });
}

async function loadConfig() {
  loading.value = true;
  try {
    const config = await getIpSourceConfig();
    const nextSourceType = parseSourceType(config.dataSourceName);
    sourceType.value = nextSourceType;
    await ipSourceFormApi.setValues({
      apiUrl: config.apiUrl || '',
      dataSourceName: config.dataSourceName || 'default',
      enabled: config.enabled === 1,
      remark: config.remark || '',
      sourceType: nextSourceType,
    });
    replaceFieldMappings(config.parseRule || DEFAULT_PARSE_RULE);
  } finally {
    loading.value = false;
  }
}

async function onSave() {
  if (saving.value) return;
  if (!canUpdate.value) {
    message.warning($t('ipConfig.noPermission'));
    return;
  }
  saving.value = true;
  try {
    const values = await ipSourceFormApi.getValues();
    const selectedSource = sourceType.value;
    if (selectedSource === 'custom') {
      if (configuredIpFields(fieldMappings).length === 0) {
        message.error($t('ipConfig.mapping.atLeastOneError'));
        return;
      }
      const missingPair = missingCoordinatePairFields(fieldMappings);
      if (missingPair.length > 0) {
        message.error(
          $t('ipConfig.mapping.coordinatePairError', [
            missingPair
              .map((field) => $t(`ipConfig.mapping.fields.${field}.label`))
              .join(' / '),
          ]),
        );
        return;
      }
    }
    const sourceValues = (() => {
      switch (selectedSource) {
        case 'bilibili': {
          return {
            apiUrl: BILIBILI_API_URL,
            dataSourceName: 'bilibili',
            parseRule: BILIBILI_PARSE_RULE,
          };
        }
        case 'custom': {
          return {
            apiUrl: String(values.apiUrl ?? '').trim(),
            dataSourceName:
              String(values.dataSourceName ?? '').trim() || 'custom_source',
            parseRule: serializeIpFieldMappings(fieldMappings),
          };
        }
        default: {
          return {
            apiUrl: '',
            dataSourceName: 'default',
            parseRule: DEFAULT_PARSE_RULE,
          };
        }
      }
    })();
    await updateIpSourceConfig({
      enabled: values.enabled ? 1 : 0,
      remark: String(values.remark ?? '').trim(),
      ...sourceValues,
    });
    message.success($t('ipConfig.saveSuccess'));
    await loadConfig();
  } finally {
    saving.value = false;
  }
}

async function onTestSource() {
  if (!canUpdate.value) {
    message.warning($t('ipConfig.noPermission'));
    return;
  }
  const values = await ipSourceFormApi.getValues();
  const apiUrl = String(values.apiUrl ?? '').trim();
  currentApiUrl.value = apiUrl;
  const requestFieldMappings = { ...fieldMappings };
  const requestTestIp = testIp.value.trim();
  const requestFingerprint = createTestRequestFingerprint(
    apiUrl,
    requestTestIp,
    requestFieldMappings,
  );
  testing.value = true;
  try {
    const result = await testIpSource({
      apiUrl,
      fieldMappings: requestFieldMappings,
      testIp: requestTestIp,
    });
    discoveredFields.value = result.fields || [];
    sourcePreview.value = result.preview;
    invalidFields.value = result.invalidFields || [];
    missingPairFields.value = result.missingPairFields || [];
    testedRequestFingerprint.value = requestFingerprint;
    if (invalidFields.value.length > 0 || missingPairFields.value.length > 0) {
      message.warning($t('ipConfig.mapping.testInvalid'));
    } else if (configuredIpFields(fieldMappings).length === 0) {
      message.info($t('ipConfig.mapping.testChooseMapping'));
    } else {
      message.success($t('ipConfig.mapping.testSuccess'));
    }
  } finally {
    testing.value = false;
  }
}

onMounted(loadConfig);
</script>

<template>
  <Page
    auto-content-height
    class="ip-config-page"
    :description="$t('ipConfig.description')"
    :title="$t('ipConfig.title')"
  >
    <template #extra>
      <div class="ip-page-actions">
        <Tag :color="sourceType === 'default' ? 'green' : 'blue'">
          {{ $t(`ipConfig.active.${sourceType}`) }}
        </Tag>
        <Button :disabled="loading || saving || testing" @click="loadConfig">
          <template #icon><RotateCw class="size-4" /></template>
          {{ $t('ipConfig.refresh') }}
        </Button>
        <Button
          :disabled="loading || testing"
          :loading="saving"
          type="primary"
          @click="onSave"
        >
          {{ $t('ipConfig.save') }}
        </Button>
      </div>
    </template>
    <div class="ip-config-shell">
      <Card class="ip-source-panel" :title="$t('ipConfig.chooseTitle')">
        <template #extra>
          <div class="ip-source-badges">
            <Tag color="green">{{ $t('ipConfig.tags.fields') }}</Tag>
            <Tag>{{ $t('ipConfig.tags.cache') }}</Tag>
            <Tag>{{ $t('ipConfig.tags.timeout') }}</Tag>
          </div>
        </template>

        <p class="ip-source-panel__description">
          {{ $t('ipConfig.chooseDescription') }}
        </p>

        <div class="ip-source-options">
          <button
            v-for="item in sourceCards"
            :key="item.type"
            :class="{ 'is-active': sourceType === item.type }"
            :disabled="loading || saving || testing"
            type="button"
            @click="setSourcePreset(item.type)"
          >
            <span><IconifyIcon :icon="item.icon" /></span>
            <strong>{{ item.title }}</strong>
            <small>{{ item.description }}</small>
            <IconifyIcon
              v-if="sourceType === item.type"
              class="ip-source-option__check"
              icon="lucide:circle-check-big"
            />
          </button>
        </div>

        <Alert
          v-if="sourceType !== 'custom'"
          :description="$t(`ipConfig.presetDescription.${sourceType}`)"
          :message="$t('ipConfig.presetManaged')"
          show-icon
          type="info"
        />

        <div
          class="ip-source-form"
          :class="{ 'is-custom': sourceType === 'custom' }"
        >
          <IpSourceForm />
        </div>

        <section v-if="sourceType === 'custom'" class="ip-mapping-panel">
          <div class="ip-mapping-panel__head">
            <div>
              <h3>{{ $t('ipConfig.mapping.title') }}</h3>
              <p>{{ $t('ipConfig.mapping.description') }}</p>
            </div>
            <Tag color="blue">{{ $t('ipConfig.mapping.jsonPathTag') }}</Tag>
          </div>

          <Alert
            :description="$t('ipConfig.mapping.guideDescription')"
            :message="$t('ipConfig.mapping.guideTitle')"
            show-icon
            type="info"
          />

          <div class="ip-source-testbar">
            <div>
              <label>{{ $t('ipConfig.mapping.testIp') }}</label>
              <Input
                v-model:value="testIp"
                :placeholder="$t('ipConfig.mapping.testIpPlaceholder')"
              />
            </div>
            <Button
              :disabled="loading || saving"
              :loading="testing"
              type="primary"
              @click="onTestSource"
            >
              {{ $t('ipConfig.mapping.testButton') }}
            </Button>
            <span>{{ $t('ipConfig.mapping.testHint') }}</span>
          </div>

          <div class="ip-field-mapping-list">
            <div
              v-for="item in mappingFields"
              :key="item.key"
              class="ip-field-mapping-row"
              :class="{
                'has-error': visibleInvalidFields.includes(item.key),
                'is-missing': visibleMissingPairFields.includes(item.key),
              }"
            >
              <div class="ip-field-mapping-row__label">
                <strong>{{ item.label }}</strong>
                <Tag v-if="item.coordinatePair" color="blue">
                  {{ $t('ipConfig.mapping.coordinatePair') }}
                </Tag>
                <Tag v-else>{{ $t('ipConfig.mapping.optional') }}</Tag>
                <small>{{ item.description }}</small>
              </div>
              <AutoComplete
                v-model:value="fieldMappings[item.key]"
                :options="mappingOptions"
                :placeholder="$t('ipConfig.mapping.pathPlaceholder')"
                allow-clear
                class="w-full"
                option-label-prop="value"
              />
            </div>
          </div>

          <div v-if="visibleSourcePreview" class="ip-source-preview">
            <div>
              <span>{{ $t('ipConfig.mapping.previewLocation') }}</span>
              <strong>
                {{
                  [
                    visibleSourcePreview.country,
                    visibleSourcePreview.province,
                    visibleSourcePreview.city,
                  ]
                    .filter(Boolean)
                    .join(' / ') || '-'
                }}
              </strong>
            </div>
            <div>
              <span>{{ $t('ipConfig.mapping.previewCoordinates') }}</span>
              <strong>
                {{
                  visibleSourcePreview.latitude !== undefined &&
                  visibleSourcePreview.longitude !== undefined
                    ? `${visibleSourcePreview.latitude}, ${
                        visibleSourcePreview.longitude
                      }`
                    : '-'
                }}
              </strong>
            </div>
            <div>
              <span>ISP</span>
              <strong>{{ visibleSourcePreview.isp || '-' }}</strong>
            </div>
          </div>
        </section>
      </Card>
    </div>
  </Page>
</template>

<style scoped>
.ip-config-shell {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
}

.ip-page-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
}

.ip-source-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}

.ip-source-badges :deep(.ant-tag) {
  margin-inline-end: 0;
}

.ip-source-panel__description {
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  color: hsl(var(--muted-foreground));
}

.ip-source-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin: 14px 0;
}

.ip-source-options button {
  position: relative;
  display: grid;
  gap: 7px;
  min-height: 142px;
  padding: 16px;
  color: inherit;
  text-align: left;
  cursor: pointer;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
  transition:
    border-color 160ms ease,
    background 160ms ease;
}

.ip-source-options button:hover,
.ip-source-options button.is-active {
  background: hsl(var(--primary) / 5%);
  border-color: hsl(var(--primary) / 42%);
}

.ip-source-options button:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.ip-source-options button > span {
  display: grid;
  width: 36px;
  height: 36px;
  font-size: 18px;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 9%);
  border-radius: 8px;
  place-items: center;
}

.ip-source-options strong {
  font-size: 14px;
  color: hsl(var(--foreground));
}

.ip-source-options small {
  font-size: 12px;
  line-height: 19px;
  color: hsl(var(--muted-foreground));
}

.ip-source-option__check {
  position: absolute;
  top: 14px;
  right: 14px;
  color: hsl(var(--primary));
}

.ip-source-form {
  max-width: 820px;
  padding-top: 18px;
}

.ip-source-form.is-custom {
  padding: 18px;
  margin-top: 16px;
  background: hsl(var(--muted) / 28%);
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
}

.ip-mapping-panel {
  padding: 18px;
  margin-top: 14px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
}

.ip-mapping-panel__head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 14px;
}

.ip-mapping-panel__head h3 {
  margin: 0;
  font-size: 16px;
  color: hsl(var(--foreground));
}

.ip-mapping-panel__head p {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 19px;
  color: hsl(var(--muted-foreground));
}

.ip-source-testbar {
  display: grid;
  grid-template-columns: minmax(220px, 320px) auto 1fr;
  gap: 10px;
  align-items: end;
  padding: 14px;
  margin-top: 14px;
  background: hsl(var(--muted) / 24%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.ip-source-testbar > div {
  display: grid;
  gap: 6px;
}

.ip-source-testbar label {
  font-size: 12px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.ip-source-testbar > span {
  align-self: center;
  font-size: 12px;
  line-height: 18px;
  color: hsl(var(--muted-foreground));
}

.ip-field-mapping-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.ip-field-mapping-row {
  display: grid;
  gap: 9px;
  min-width: 0;
  padding: 13px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.ip-field-mapping-row.has-error,
.ip-field-mapping-row.is-missing {
  border-color: hsl(var(--destructive) / 55%);
}

.ip-field-mapping-row__label {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.ip-field-mapping-row__label strong {
  font-size: 13px;
  color: hsl(var(--foreground));
}

.ip-field-mapping-row__label small {
  flex-basis: 100%;
  font-size: 11px;
  line-height: 17px;
  color: hsl(var(--muted-foreground));
}

.ip-field-mapping-row__label :deep(.ant-tag) {
  margin-inline-end: 0;
}

.ip-source-preview {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  padding-top: 14px;
  margin-top: 14px;
  border-top: 1px solid hsl(var(--border));
}

.ip-source-preview > div {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 10px 12px;
  background: hsl(var(--muted) / 24%);
  border-radius: 8px;
}

.ip-source-preview span {
  font-size: 11px;
  color: hsl(var(--muted-foreground));
}

.ip-source-preview strong {
  overflow: hidden;
  font-size: 13px;
  color: hsl(var(--foreground));
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 760px) {
  .ip-source-badges {
    display: none;
  }

  .ip-page-actions {
    justify-content: flex-start;
  }

  .ip-source-options {
    grid-template-columns: 1fr;
  }

  .ip-source-options button {
    min-height: 116px;
  }

  .ip-source-testbar,
  .ip-field-mapping-list,
  .ip-source-preview {
    grid-template-columns: 1fr;
  }

  .ip-source-testbar > span {
    align-self: start;
  }
}
</style>
