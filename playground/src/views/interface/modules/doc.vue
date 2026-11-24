<script lang="ts" setup>
import type { Sortable } from '@vben/hooks';

import type { InterfaceApi } from '#/api/interface';

import { computed, nextTick, reactive, ref, watch } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { useSortable } from '@vben/hooks';
import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Input,
  message,
  Select,
  Switch,
  Tag,
  Tooltip,
} from 'ant-design-vue';

import { getInterfaceDoc, updateInterfaceDoc } from '#/api/interface';
import { $t } from '#/locales';

type DocParameter = {
  description: string;
  exampleValue: string;
  id: string;
  location: 'Body' | 'Header' | 'Path' | 'Query';
  name: string;
  placeholder: string;
  required: boolean;
  type: string;
};

type DocResponseField = {
  description: string;
  id: string;
  name: string;
  type: string;
};

type DocStatusCode = {
  code: string;
  description: string;
  id: string;
};

type DocResponseFormatRow = {
  example: string;
  id: string;
  type: InterfaceApi.InterfaceDocResponseFormat['type'];
};

const emits = defineEmits(['success']);

const Textarea = Input.TextArea;

const docPreviewPlaceholder = '{"code":200,"msg":"success","data":{}}';

const rowSeed = ref(0);
const formData = ref<{
  apiCode?: string;
  name?: string;
  requestMethod?: string;
}>();
const id = ref<string>();
const requestParams = ref<DocParameter[]>([]);
const responseFields = ref<DocResponseField[]>([]);
const responseFormats = ref<DocResponseFormatRow[]>([]);
const responseFieldListRef = ref<HTMLElement>();
const statusCodes = ref<DocStatusCode[]>([]);
const templateParameters = ref<string[]>([]);
const responseFieldSortable = ref<null | Sortable>(null);

const baseForm = reactive({
  docNotice: '',
  docPreferredMethod: '' as '' | InterfaceApi.InvokeMethod,
  docResponseExample: '',
  docResponseType: 'JSON' as NonNullable<
    InterfaceApi.InterfaceDocConfig['docResponseType']
  >,
  docSummary: '',
});

const responseTypeOptions = [
  { label: 'JSON', value: 'JSON' },
  { label: 'TEXT', value: 'TEXT' },
  { label: 'XML', value: 'XML' },
  { label: 'HTML', value: 'HTML' },
  { label: 'FILE', value: 'FILE' },
  { label: 'SSE', value: 'SSE' },
];

const locationOptions = computed(() => [
  { label: $t('page.interface.docConfig.location.query'), value: 'Query' },
  { label: $t('page.interface.docConfig.location.body'), value: 'Body' },
  { label: $t('page.interface.docConfig.location.header'), value: 'Header' },
  { label: $t('page.interface.docConfig.location.path'), value: 'Path' },
]);

const typeOptions = computed(() => [
  { label: $t('page.interface.docConfig.types.string'), value: 'string' },
  { label: $t('page.interface.docConfig.types.number'), value: 'number' },
  { label: $t('page.interface.docConfig.types.boolean'), value: 'boolean' },
  { label: $t('page.interface.docConfig.types.object'), value: 'object' },
  { label: $t('page.interface.docConfig.types.array'), value: 'array' },
  { label: $t('page.interface.docConfig.types.file'), value: 'file' },
]);

const preferredMethodOptions = computed(() => {
  const method = formData.value?.requestMethod;
  const options = [{ label: $t('page.interface.docConfig.followInterfaceMethod'), value: '' }];
  if (method === 'GET_POST') {
    options.push(
      { label: 'GET', value: 'GET' },
      { label: 'POST', value: 'POST' },
    );
    return options;
  }
  if (method === 'GET' || method === 'POST') {
    options.push({ label: method, value: method });
  }
  return options;
});

const interfaceMeta = computed(() => {
  const data = formData.value;
  if (!data) return '';
  const code = data.apiCode
    ? $t('page.interface.docConfig.meta.code', [data.apiCode])
    : '';
  const method = data.requestMethod
    ? $t('page.interface.docConfig.meta.method', [
        data.requestMethod === 'GET_POST' ? 'GET/POST' : data.requestMethod,
      ])
    : '';
  return [code, method].filter(Boolean).join(' / ');
});

const hasTemplateParameters = computed(
  () => templateParameters.value.length > 0,
);

const [Drawer, drawerApi] = useVbenDrawer({
  class: 'w-220! max-w-[calc(100vw-32px)]!',

  async onConfirm() {
    if (!id.value) return;

    const payload = buildPayload();
    if (!payload) return;

    drawerApi.lock();
    updateInterfaceDoc(id.value, payload)
      .then(() => {
        emits('success');
        message.success($t('page.interface.docConfig.messages.saved'));
        drawerApi.close();
      })
      .catch(() => {
        drawerApi.unlock();
        message.error($t('page.interface.docConfig.messages.saveFailed'));
      });
  },

  async onOpenChange(isOpen) {
    if (!isOpen) {
      destroyResponseFieldSortable();
      return;
    }

    const row = drawerApi.getData<InterfaceApi.InterfaceItem>();
    resetState(row);

    if (!row?.id) return;

    const data = await getInterfaceDoc(row.id);
    formData.value = data;
    baseForm.docSummary = data.docSummary ?? '';
    baseForm.docResponseType = data.docResponseType ?? 'JSON';
    baseForm.docPreferredMethod = data.docPreferredMethod ?? '';
    baseForm.docResponseExample = data.docResponseExample ?? '';
    baseForm.docNotice = data.docNotice ?? '';
    responseFormats.value = parseResponseFormats(data);
    templateParameters.value = normalizeNames(
      data.templateParameters?.length
        ? data.templateParameters
        : parameterNamesFromTemplate(data.requestUrl || row.requestUrl || ''),
    );
    requestParams.value = parseRequestParams(data.docRequestParams);
    responseFields.value = parseResponseFields(data.docResponseFields);
    statusCodes.value = parseStatusCodes(data.docStatusCodes);
    fillTemplateParameters(false);
    void initResponseFieldSortable();
  },
});

const drawerTitle = computed(() =>
  formData.value?.name
    ? $t('page.interface.docConfig.drawerTitleWithName', [formData.value.name])
    : $t('page.interface.docConfig.drawerTitle'),
);

function resetState(row?: InterfaceApi.InterfaceItem) {
  id.value = row?.id;
  formData.value = row;
  baseForm.docSummary = '';
  baseForm.docResponseType = 'JSON';
  baseForm.docPreferredMethod = '';
  baseForm.docResponseExample = '';
  baseForm.docNotice = '';
  requestParams.value = [];
  responseFields.value = [];
  responseFormats.value = [];
  statusCodes.value = [];
  templateParameters.value = [];
}

function rowId() {
  rowSeed.value += 1;
  return `doc-row-${Date.now()}-${rowSeed.value}`;
}

function createRequestParam(name = ''): DocParameter {
  return {
    description: name ? $t('page.interface.docConfig.defaultParamDescription', [name]) : '',
    exampleValue: '',
    id: rowId(),
    location: 'Query',
    name,
    placeholder: name ? $t('page.interface.docConfig.defaultParamPlaceholder', [name]) : '',
    required: true,
    type: 'string',
  };
}

function createResponseField(): DocResponseField {
  return {
    description: '',
    id: rowId(),
    name: '',
    type: 'string',
  };
}

function createStatusCode(code = '', description = ''): DocStatusCode {
  return {
    code,
    description,
    id: rowId(),
  };
}

function addRequestParam() {
  requestParams.value.push(createRequestParam());
}

function addResponseField() {
  responseFields.value.push(createResponseField());
  void initResponseFieldSortable();
}

function addStatusCode() {
  statusCodes.value.push(createStatusCode());
}

function createResponseFormat(
  type: DocResponseFormatRow['type'] = 'JSON',
  example = '',
): DocResponseFormatRow {
  return { example, id: rowId(), type };
}

function addResponseFormat() {
  responseFormats.value.push(createResponseFormat());
}

function removeResponseFormat(index: number) {
  responseFormats.value.splice(index, 1);
}

function parseResponseFormats(
  data: InterfaceApi.InterfaceDocConfig,
): DocResponseFormatRow[] {
  const declared = (data.docResponseFormats ?? [])
    .map((item) =>
      createResponseFormat(
        (item.type || 'JSON') as DocResponseFormatRow['type'],
        item.example ?? '',
      ),
    )
    .filter((item) => responseTypeOptions.some((option) => option.value === item.type));
  if (declared.length > 0) return declared;
  // Legacy interfaces configured through the single type/example pair keep
  // rendering it as one editable row.
  return [
    createResponseFormat(
      (data.docResponseType || 'JSON') as DocResponseFormatRow['type'],
      data.docResponseExample ?? '',
    ),
  ];
}

function fillSuccessExample() {
  const target =
    responseFormats.value.find((item) => item.type === 'JSON') ??
    responseFormats.value[0];
  if (!target) {
    message.warning($t('page.interface.docConfig.responseFormats.missingFormat'));
    return;
  }
  target.example = JSON.stringify(
    {
      code: 200,
      data: {},
      msg: $t('page.interface.docConfig.responseExampleSuccessMessage'),
    },
    null,
    2,
  );
}

function formatResponseExample(index: number) {
  const target = responseFormats.value[index];
  if (!target) return;
  const text = target.example.trim();
  if (!text) return;
  try {
    target.example = JSON.stringify(JSON.parse(text), null, 2);
    message.success($t('page.interface.docConfig.messages.responseFormatted'));
  } catch {
    message.warning($t('page.interface.docConfig.messages.responseInvalidJson'));
  }
}

function removeRequestParam(index: number) {
  requestParams.value.splice(index, 1);
}

function removeResponseField(index: number) {
  responseFields.value.splice(index, 1);
  void initResponseFieldSortable();
}

function removeStatusCode(index: number) {
  statusCodes.value.splice(index, 1);
}

function fillTemplateParameters(showTip = true) {
  const existed = new Set(
    requestParams.value.map((item) => item.name.trim()).filter(Boolean),
  );
  const added = templateParameters.value.filter((name) => !existed.has(name));
  requestParams.value.push(...added.map((name) => createRequestParam(name)));
  if (showTip) {
    message.success(
      added.length > 0
        ? $t('page.interface.docConfig.messages.templateAdded', [added.length])
        : $t('page.interface.docConfig.messages.templateAlreadyExists'),
    );
  }
}

function fillCommonStatusCodes() {
  statusCodes.value = [
    createStatusCode('200', $t('page.interface.docConfig.statusDefaults.success')),
    createStatusCode('401', $t('page.interface.docConfig.statusDefaults.invalidKey')),
    createStatusCode('403', $t('page.interface.docConfig.statusDefaults.insufficientQuota')),
    createStatusCode('429', $t('page.interface.docConfig.statusDefaults.rateLimited')),
    createStatusCode('500', $t('page.interface.docConfig.statusDefaults.serverError')),
  ];
}

function buildPayload():
  | InterfaceApi.InterfaceDocConfig
  | undefined {
  const params = normalizeRequestParams();
  const fields = normalizeResponseFields();
  const codes = normalizeStatusCodes();
  if (!params || !fields || !codes) return undefined;

  const formats = normalizeResponseFormats();
  if (!formats) return undefined;

  return {
    docNotice: blankToUndefined(baseForm.docNotice),
    docPreferredMethod: baseForm.docPreferredMethod || '',
    docRequestParams: params.length > 0 ? JSON.stringify(params, null, 2) : '',
    docResponseExample:
      blankToUndefined(formats[0]?.example ?? '') ?? undefined,
    docResponseFields: fields.length > 0 ? JSON.stringify(fields, null, 2) : '',
    docResponseType: formats[0]?.type || 'JSON',
    docResponseFormats: formats.map((item) => ({
      example: (item.example ?? '').trim(),
      type: item.type,
    })),
    docStatusCodes: codes.length > 0 ? JSON.stringify(codes, null, 2) : '',
    docSummary: blankToUndefined(baseForm.docSummary),
  };
}

function normalizeRequestParams() {
  const result = [];
  for (const item of requestParams.value) {
    const name = item.name.trim();
    const description = item.description.trim();
    const exampleValue = item.exampleValue.trim();
    const placeholder = item.placeholder.trim();
    const touched = name || description || exampleValue || placeholder;
    if (!touched) continue;
    if (!name) {
      message.error($t('page.interface.docConfig.messages.missingParamName'));
      return undefined;
    }
    result.push({
      description,
      exampleValue,
      location: item.location || 'Query',
      name,
      placeholder,
      required: !!item.required,
      type: item.type || 'string',
    });
  }
  return result;
}

function normalizeResponseFields() {
  const result = [];
  for (const item of responseFields.value) {
    const name = item.name.trim();
    const description = item.description.trim();
    const touched = name || description;
    if (!touched) continue;
    if (!name) {
      message.error($t('page.interface.docConfig.messages.missingFieldName'));
      return undefined;
    }
    result.push({
      description,
      name,
      type: item.type || 'string',
    });
  }
  return result;
}

function normalizeStatusCodes() {
  const result = [];
  for (const item of statusCodes.value) {
    const code = item.code.trim();
    const description = item.description.trim();
    const touched = code || description;
    if (!touched) continue;
    if (!code) {
      message.error($t('page.interface.docConfig.messages.missingStatusCode'));
      return undefined;
    }
    result.push({
      code: Number.isNaN(Number(code)) ? code : Number(code),
      description,
    });
  }
  return result;
}

function normalizeResponseFormats(): InterfaceApi.InterfaceDocResponseFormat[] | undefined {
  if (responseFormats.value.length === 0) {
    message.error($t('page.interface.docConfig.responseFormats.missingFormat'));
    return undefined;
  }
  const seen = new Set<string>();
  for (const item of responseFormats.value) {
    if (seen.has(item.type)) {
      message.error(
        $t('page.interface.docConfig.responseFormats.duplicateType', [item.type]),
      );
      return undefined;
    }
    seen.add(item.type);
  }
  return responseFormats.value.map((item) => ({
    example: item.example.trim(),
    type: item.type,
  }));
}

function parseRequestParams(text?: string): DocParameter[] {
  return parseArray(text).map((item) => ({
    description: stringValue(item.description),
    exampleValue: stringValue(item.exampleValue),
    id: rowId(),
    location: normalizeLocation(item.location),
    name: stringValue(item.name),
    placeholder: stringValue(item.placeholder),
    required: item.required !== false,
    type: stringValue(item.type) || 'string',
  }));
}

function parseResponseFields(text?: string): DocResponseField[] {
  return parseArray(text).map((item) => ({
    description: stringValue(item.description),
    id: rowId(),
    name: stringValue(item.name),
    type: stringValue(item.type) || 'string',
  }));
}

function parseStatusCodes(text?: string): DocStatusCode[] {
  return parseArray(text).map((item) => ({
    code: stringValue(item.code),
    description: stringValue(item.description),
    id: rowId(),
  }));
}

function parseArray(text?: string): Record<string, any>[] {
  if (!text || !text.trim()) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parameterNamesFromTemplate(template: string) {
  const names: string[] = [];
  const regex = /\{([A-Za-z][A-Za-z0-9_]*)\}/g;
  let match: null | RegExpExecArray;
  while ((match = regex.exec(template))) {
    const before = template.slice(0, match.index);
    const queryKey = before.match(/[?&]([^=&?#]+)=$/)?.[1];
    names.push(queryKey ? decodeURIComponent(queryKey) : match[1] || '');
  }
  return normalizeNames(names);
}

function normalizeNames(names: string[] = []) {
  return [...new Set(names.map((name) => name.trim()).filter(Boolean))].filter(
    (name) => name !== 'key',
  );
}

function normalizeLocation(value: any): DocParameter['location'] {
  const text = stringValue(value).toLowerCase();
  if (text === 'body') return 'Body';
  if (text === 'header') return 'Header';
  if (text === 'path') return 'Path';
  return 'Query';
}

function blankToUndefined(value: string) {
  const text = value.trim();
  return text || undefined;
}

function stringValue(value: any) {
  return value === undefined || value === null ? '' : String(value);
}

async function initResponseFieldSortable() {
  await nextTick();
  const element = responseFieldListRef.value;
  if (!element || responseFields.value.length <= 1) {
    responseFieldSortable.value?.destroy();
    responseFieldSortable.value = null;
    return;
  }
  if (responseFieldSortable.value) {
    return;
  }
  const { initializeSortable } = useSortable(element, {
    animation: 180,
    ghostClass: 'response-field-row--ghost',
    handle: '.response-field-drag-handle',
    onEnd(event) {
      const { newIndex, oldIndex } = event;
      if (
        oldIndex === undefined ||
        newIndex === undefined ||
        oldIndex === newIndex
      ) {
        return;
      }
      moveResponseField(oldIndex, newIndex);
    },
  });
  responseFieldSortable.value = await initializeSortable();
}

function moveResponseField(oldIndex: number, newIndex: number) {
  const fields = [...responseFields.value];
  const [field] = fields.splice(oldIndex, 1);
  if (!field) return;
  fields.splice(newIndex, 0, field);
  responseFields.value = fields;
}

function destroyResponseFieldSortable() {
  responseFieldSortable.value?.destroy();
  responseFieldSortable.value = null;
}

watch(
  () => responseFields.value.length,
  () => {
    void initResponseFieldSortable();
  },
);
</script>

<template>
  <Drawer :title="drawerTitle">
    <div class="doc-config">
      <div class="doc-hero">
        <div>
          <div class="doc-hero__title">
            {{ $t('page.interface.docConfig.hero.title') }}
          </div>
          <div class="doc-hero__desc">
            {{ $t('page.interface.docConfig.hero.description') }}
          </div>
          <div v-if="interfaceMeta" class="doc-hero__meta">
            {{ interfaceMeta }}
          </div>
        </div>
        <Tag color="blue">{{ $t('page.interface.docConfig.hero.tag') }}</Tag>
      </div>

      <section class="doc-section">
        <div class="doc-section__head">
          <div>
            <h3>{{ $t('page.interface.docConfig.basic.title') }}</h3>
            <p>{{ $t('page.interface.docConfig.basic.description') }}</p>
          </div>
        </div>
        <div class="doc-form-grid">
          <label class="doc-field doc-field--full">
            <span>{{ $t('page.interface.docConfig.basic.docSummary') }}</span>
            <Textarea
              v-model:value="baseForm.docSummary"
              :rows="3"
              :placeholder="$t('page.interface.docConfig.basic.docSummaryPlaceholder')"
            />
          </label>
          <label class="doc-field">
            <span>{{ $t('page.interface.docConfig.basic.preferredMethod') }}</span>
            <Select
              v-model:value="baseForm.docPreferredMethod"
              :options="preferredMethodOptions"
            />
          </label>
        </div>
      </section>

      <section class="doc-section">
        <div class="doc-section__head">
          <div>
            <h3>{{ $t('page.interface.docConfig.params.title') }}</h3>
            <p>
              {{ $t('page.interface.docConfig.params.description') }}
            </p>
          </div>
          <div class="doc-actions">
            <Button
              v-if="hasTemplateParameters"
              @click="fillTemplateParameters()"
            >
              {{ $t('page.interface.docConfig.params.detectFromUrl') }}
            </Button>
            <Button type="primary" @click="addRequestParam">
              {{ $t('page.interface.docConfig.params.add') }}
            </Button>
          </div>
        </div>
        <div v-if="hasTemplateParameters" class="doc-tip">
          {{ $t('page.interface.docConfig.params.detectedPlaceholders') }}:
          <Tag v-for="name in templateParameters" :key="name" color="green">
            {{ name }}
          </Tag>
        </div>
        <div class="visual-table visual-table--params">
          <div class="visual-table__head">
            <span>{{ $t('page.interface.docConfig.params.name') }}</span>
            <span>{{ $t('page.interface.docConfig.params.location') }}</span>
            <span>{{ $t('page.interface.docConfig.params.type') }}</span>
            <span>{{ $t('page.interface.docConfig.params.required') }}</span>
            <span></span>
          </div>
          <div
            v-for="(item, index) in requestParams"
            :key="item.id"
            class="visual-table__row"
          >
            <div class="param-main">
              <Input v-model:value="item.name" placeholder="url" />
              <Select
                v-model:value="item.location"
                :options="locationOptions"
              />
              <Select v-model:value="item.type" :options="typeOptions" />
              <Switch v-model:checked="item.required" />
              <Button danger type="link" @click="removeRequestParam(index)">
                {{ $t('page.interface.docConfig.actions.delete') }}
              </Button>
            </div>
            <div class="param-extra">
              <label>
                <span>{{ $t('page.interface.docConfig.params.exampleValue') }}</span>
                <Input
                  v-model:value="item.exampleValue"
                  :placeholder="$t('page.interface.docConfig.params.exampleValuePlaceholder')"
                />
              </label>
              <label>
                <span>{{ $t('page.interface.docConfig.params.placeholderText') }}</span>
                <Input
                  v-model:value="item.placeholder"
                  :placeholder="$t('page.interface.docConfig.params.placeholderExample')"
                />
              </label>
              <label>
                <span>{{ $t('page.interface.docConfig.params.paramDescription') }}</span>
                <Input
                  v-model:value="item.description"
                  :placeholder="$t('page.interface.docConfig.params.paramDescriptionPlaceholder')"
                />
              </label>
            </div>
          </div>
          <div v-if="requestParams.length === 0" class="visual-empty">
            {{ $t('page.interface.docConfig.params.empty') }}
          </div>
        </div>
      </section>

      <section class="doc-section">
        <div class="doc-section__head">
          <div>
            <h3>{{ $t('page.interface.docConfig.responseFields.title') }}</h3>
            <p>{{ $t('page.interface.docConfig.responseFields.description') }}</p>
          </div>
          <Button type="primary" @click="addResponseField">
            {{ $t('page.interface.docConfig.responseFields.add') }}
          </Button>
        </div>
        <div class="visual-table visual-table--fields">
          <div class="visual-table__head">
            <span></span>
            <span>{{ $t('page.interface.docConfig.responseFields.name') }}</span>
            <span>{{ $t('page.interface.docConfig.responseFields.type') }}</span>
            <span>{{ $t('page.interface.docConfig.responseFields.descriptionColumn') }}</span>
            <span></span>
          </div>
          <div ref="responseFieldListRef" class="visual-table__body">
            <div
              v-for="(item, index) in responseFields"
              :key="item.id"
              class="visual-table__row response-field-row"
            >
              <Tooltip :title="$t('page.interface.docConfig.responseFields.dragTip')">
                <button class="response-field-drag-handle" type="button">
                  <IconifyIcon icon="lucide:grip-vertical" />
                </button>
              </Tooltip>
              <Input v-model:value="item.name" placeholder="data.url" />
              <Select v-model:value="item.type" :options="typeOptions" />
              <Input
                v-model:value="item.description"
                :placeholder="$t('page.interface.docConfig.responseFields.descriptionPlaceholder')"
              />
              <Button danger type="link" @click="removeResponseField(index)">
                {{ $t('page.interface.docConfig.actions.delete') }}
              </Button>
            </div>
          </div>
          <div v-if="responseFields.length === 0" class="visual-empty">
            {{ $t('page.interface.docConfig.responseFields.empty') }}
          </div>
        </div>
      </section>

      <section class="doc-section">
        <div class="doc-section__head">
          <div>
            <h3>{{ $t('page.interface.docConfig.responseFormats.title') }}</h3>
            <p>{{ $t('page.interface.docConfig.responseFormats.description') }}</p>
          </div>
          <div class="doc-actions">
            <Button @click="fillSuccessExample">
              {{ $t('page.interface.docConfig.responseFormats.fillExample') }}
            </Button>
            <Button type="primary" @click="addResponseFormat">
              {{ $t('page.interface.docConfig.responseFormats.add') }}
            </Button>
          </div>
        </div>
        <div
          v-for="(item, index) in responseFormats"
          :key="item.id"
          class="format-row"
        >
          <div class="format-row__head">
            <Select
              v-model:value="item.type"
              :options="responseTypeOptions"
              class="format-row__type"
            />
            <Button
              v-if="item.type === 'JSON'"
              @click="formatResponseExample(index)"
            >
              {{ $t('page.interface.docConfig.preview.formatJson') }}
            </Button>
            <Button
              danger
              :disabled="responseFormats.length <= 1"
              type="link"
              @click="removeResponseFormat(index)"
            >
              {{ $t('page.interface.docConfig.actions.delete') }}
            </Button>
          </div>
          <Textarea
            v-model:value="item.example"
            :rows="5"
            :placeholder="$t('page.interface.docConfig.preview.placeholder', [docPreviewPlaceholder])"
          />
        </div>
        <div v-if="responseFormats.length === 0" class="visual-empty">
          {{ $t('page.interface.docConfig.responseFormats.missingFormat') }}
        </div>
      </section>

      <section class="doc-section">
        <div class="doc-section__head">
          <div>
            <h3>{{ $t('page.interface.docConfig.status.title') }}</h3>
            <p>{{ $t('page.interface.docConfig.status.description') }}</p>
          </div>
          <div class="doc-actions">
            <Button @click="fillCommonStatusCodes">
              {{ $t('page.interface.docConfig.status.fillCommon') }}
            </Button>
            <Button type="primary" @click="addStatusCode">
              {{ $t('page.interface.docConfig.status.add') }}
            </Button>
          </div>
        </div>
        <div class="visual-table visual-table--status">
          <div class="visual-table__head">
            <span>{{ $t('page.interface.docConfig.status.code') }}</span>
            <span>{{ $t('page.interface.docConfig.status.descriptionColumn') }}</span>
            <span></span>
          </div>
          <div
            v-for="(item, index) in statusCodes"
            :key="item.id"
            class="visual-table__row"
          >
            <Input v-model:value="item.code" placeholder="200" />
            <Input
              v-model:value="item.description"
              :placeholder="$t('page.interface.docConfig.status.descriptionPlaceholder')"
            />
            <Button danger type="link" @click="removeStatusCode(index)">
              {{ $t('page.interface.docConfig.actions.delete') }}
            </Button>
          </div>
          <div v-if="statusCodes.length === 0" class="visual-empty">
            {{ $t('page.interface.docConfig.status.empty') }}
          </div>
        </div>
      </section>

      <section class="doc-section">
        <div class="doc-section__head">
          <div>
            <h3>{{ $t('page.interface.docConfig.notice.title') }}</h3>
            <p>{{ $t('page.interface.docConfig.notice.description') }}</p>
          </div>
        </div>
        <Textarea
          v-model:value="baseForm.docNotice"
          :rows="3"
          :placeholder="$t('page.interface.docConfig.notice.placeholder')"
        />
      </section>
    </div>
  </Drawer>
</template>

<style scoped>
.doc-config {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-bottom: 16px;
}

.doc-hero,
.doc-section {
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.doc-hero {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
  padding: 16px;
}

.doc-hero__title {
  font-size: 18px;
  font-weight: 700;
  color: hsl(var(--foreground));
}

.doc-hero__desc,
.doc-hero__meta,
.doc-section__head p,
.doc-tip,
.visual-empty {
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.doc-hero__desc {
  margin-top: 6px;
}

.doc-hero__meta {
  margin-top: 8px;
}

.doc-section {
  padding: 16px;
}

.doc-section__head {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 14px;
}

.doc-section__head h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: hsl(var(--foreground));
}

.doc-section__head p {
  margin: 5px 0 0;
}

.doc-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.doc-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.doc-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.doc-field--full {
  grid-column: 1 / -1;
}

.doc-tip {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  padding: 10px 12px;
  margin-bottom: 12px;
  background: hsl(var(--primary) / 5%);
  border: 1px dashed hsl(var(--primary) / 35%);
  border-radius: 8px;
}

.visual-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.visual-table__body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.visual-table__head,
.visual-table__row {
  display: grid;
  gap: 8px;
  align-items: center;
}

.visual-table__head {
  font-size: 12px;
  font-weight: 700;
  color: hsl(var(--muted-foreground));
}

.visual-table__row {
  padding: 10px;
  background: hsl(var(--muted) / 35%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.visual-table__row > * {
  min-width: 0;
}

.visual-table__row :deep(.ant-btn) {
  white-space: nowrap;
}

.visual-table--params .visual-table__head,
.visual-table--params .visual-table__row {
  grid-template-columns:
    minmax(132px, 1fr) minmax(150px, 1fr) minmax(140px, 0.9fr)
    76px 56px;
}

.visual-table--params .visual-table__row {
  display: block;
}

.param-main {
  display: grid;
  grid-template-columns:
    minmax(132px, 1fr) minmax(150px, 1fr) minmax(140px, 0.9fr)
    76px 56px;
  gap: 8px;
  align-items: center;
}

.param-main > * {
  min-width: 0;
}

.param-extra {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  padding-top: 10px;
  margin-top: 10px;
  border-top: 1px dashed hsl(var(--border));
}

.param-extra label {
  display: grid;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  color: hsl(var(--muted-foreground));
}

.visual-table--fields .visual-table__head,
.visual-table--fields .visual-table__row {
  grid-template-columns: 34px minmax(130px, 1fr) 120px minmax(180px, 1.5fr) 48px;
}

.response-field-row {
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.response-field-row--ghost {
  background: hsl(var(--primary) / 8%);
  border-color: hsl(var(--primary) / 65%);
  box-shadow: 0 8px 20px hsl(var(--primary) / 12%);
}

.response-field-drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  color: hsl(var(--muted-foreground));
  cursor: grab;
  background: transparent;
  border: 0;
  border-radius: 6px;
}

.response-field-drag-handle:hover {
  color: hsl(var(--foreground));
  background: hsl(var(--muted));
}

.response-field-drag-handle:active {
  cursor: grabbing;
}

.visual-table--status .visual-table__head,
.visual-table--status .visual-table__row {
  grid-template-columns: 120px minmax(180px, 1fr) 48px;
}

.visual-empty {
  padding: 18px;
  text-align: center;
  border: 1px dashed hsl(var(--border));
  border-radius: 8px;
}

.format-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  background: hsl(var(--muted) / 35%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.format-row + .format-row {
  margin-top: 8px;
}

.format-row__head {
  display: flex;
  gap: 8px;
  align-items: center;
}

.format-row__type {
  width: 160px;
}

.format-row :deep(.ant-btn) {
  white-space: nowrap;
}

.doc-config :deep(.ant-input),
.doc-config :deep(.ant-select),
.doc-config :deep(.ant-select-selector) {
  width: 100%;
}

@media (max-width: 1120px) {
  .doc-form-grid,
  .visual-table__head,
  .visual-table__row,
  .param-extra,
  .param-main {
    grid-template-columns: 1fr !important;
  }

  .visual-table__head {
    display: none;
  }
}
</style>
