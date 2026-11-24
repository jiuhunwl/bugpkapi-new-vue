<script lang="ts" setup>
import type {
  AgreementApi,
  AgreementDocKey,
  AgreementLang,
  AgreementMode,
} from '#/api/system/agreement';

import { computed, onMounted, reactive, ref, shallowRef, watch } from 'vue';

import { Page } from '@vben/common-ui';
import { useAccessStore, useUserStore } from '@vben/stores';

import {
  Alert,
  Button,
  Card,
  Input,
  message,
  Radio,
  RadioGroup,
  Select,
  SelectOption,
  Spin,
  Switch,
  Tag,
} from 'ant-design-vue';

import {
  getAdminAgreements,
  normalizeAgreementLang,
  saveAgreementMode,
  saveAgreementTemplate,
} from '#/api/system/agreement';
import RichTextPreview from '#/components/rich-text-preview/index.vue';
import { $t, useI18n } from '#/locales';

defineOptions({ name: 'SystemAgreementConfig' });

const MAX_CONTENT_BYTES = 1024 * 1024;

interface EditorForm {
  contentHtml: string;
  effectiveDate: string;
  status: boolean;
  summary: string;
  title: string;
  version: string;
}

const accessStore = useAccessStore();
const userStore = useUserStore();
const { locale } = useI18n();

const loading = shallowRef(false);
const saving = shallowRef(false);
const savingMode = shallowRef(false);
const previewVisible = shallowRef(false);
const lastSavedAt = shallowRef('');

const overview = ref<AgreementApi.AdminOverview>({
  activeMode: 'welfare',
  items: [],
});
const activeMode = ref<AgreementMode>('welfare');
const editMode = ref<AgreementMode>('welfare');
const activeDoc = ref<AgreementDocKey>('payment');
const lang = ref<AgreementLang>(normalizeAgreementLang(locale.value));

const form = reactive<EditorForm>({
  contentHtml: '',
  effectiveDate: '',
  status: true,
  summary: '',
  title: '',
  version: 'v1.0',
});

let initialized = false;

const isAdmin = computed(() => userStore.userRoles.includes('admin'));
const canUpdate = computed(
  () =>
    isAdmin.value ||
    accessStore.accessCodes.includes('system:agreement:update'),
);
const contentBytes = computed(() =>
  new TextEncoder().encode(form.contentHtml).byteLength,
);
const contentTooLarge = computed(() => contentBytes.value > MAX_CONTENT_BYTES);

const currentItem = computed(() =>
  overview.value.items.find(
    (item) =>
      item.docKey === activeDoc.value &&
      item.mode === editMode.value &&
      item.lang === lang.value,
  ),
);

const publicPath = computed(() => {
  switch (activeDoc.value) {
    case 'privacy': {
      return '/privacy-policy';
    }
    case 'terms': {
      return '/terms-of-service';
    }
    default: {
      return '/payment-agreement';
    }
  }
});

const docOptions = computed<{ key: AgreementDocKey; label: string }[]>(() => [
  { key: 'payment', label: $t('agreementConfig.docs.payment') },
  { key: 'privacy', label: $t('agreementConfig.docs.privacy') },
  { key: 'terms', label: $t('agreementConfig.docs.terms') },
]);

const modeOptions = computed<{ key: AgreementMode; label: string }[]>(() => [
  { key: 'welfare', label: $t('agreementConfig.modes.welfare') },
  { key: 'commercial', label: $t('agreementConfig.modes.commercial') },
]);

const languageOptions = computed<{ key: AgreementLang; label: string }[]>(
  () => [
    { key: 'zh-CN', label: $t('agreementConfig.langs.zh-CN') },
    { key: 'en-US', label: $t('agreementConfig.langs.en-US') },
  ],
);

function modeLabel(mode: AgreementMode) {
  return modeOptions.value.find((item) => item.key === mode)?.label ?? mode;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function hydrateEditor() {
  previewVisible.value = false;
  const item = currentItem.value;
  if (!item) {
    Object.assign(form, {
      contentHtml: '',
      effectiveDate: '',
      status: true,
      summary: '',
      title: '',
      version: 'v1.0',
    });
    lastSavedAt.value = '';
    return;
  }
  Object.assign(form, {
    contentHtml: item.contentHtml,
    effectiveDate: item.effectiveDate ?? '',
    status: item.status === 1,
    summary: item.summary,
    title: item.title,
    version: item.version,
  });
  lastSavedAt.value = item.updateTime ?? '';
}

async function load() {
  loading.value = true;
  try {
    const data = await getAdminAgreements();
    overview.value = data;
    activeMode.value = data.activeMode;
    if (!initialized) {
      editMode.value = data.activeMode;
      initialized = true;
    }
    hydrateEditor();
  } catch {
    message.error($t('agreementConfig.loadFailed'));
  } finally {
    loading.value = false;
  }
}

async function saveMode() {
  if (!canUpdate.value || savingMode.value) return;
  savingMode.value = true;
  try {
    await saveAgreementMode(activeMode.value);
    overview.value = { ...overview.value, activeMode: activeMode.value };
    message.success($t('agreementConfig.modeSaved'));
  } catch {
    message.error($t('agreementConfig.saveFailed'));
  } finally {
    savingMode.value = false;
  }
}

async function saveTemplate() {
  if (!canUpdate.value || saving.value) return;
  if (!form.title.trim()) {
    message.warning($t('agreementConfig.missingTitle'));
    return;
  }
  if (!form.contentHtml.trim()) {
    message.warning($t('agreementConfig.missingContent'));
    return;
  }
  if (contentTooLarge.value) {
    message.error($t('agreementConfig.contentTooLarge'));
    return;
  }
  saving.value = true;
  try {
    await saveAgreementTemplate(activeDoc.value, editMode.value, lang.value, {
      contentHtml: form.contentHtml,
      effectiveDate: form.effectiveDate.trim(),
      status: form.status ? 1 : 0,
      summary: form.summary.trim(),
      title: form.title.trim(),
      version: form.version.trim() || 'v1.0',
    });
    message.success($t('agreementConfig.saved'));
    await load();
  } catch {
    message.error($t('agreementConfig.saveFailed'));
  } finally {
    saving.value = false;
  }
}

watch([activeDoc, editMode, lang], hydrateEditor);

onMounted(load);
</script>

<template>
  <Page :title="$t('agreementConfig.title')" auto-content-height>
    <Spin :spinning="loading">
      <div class="agreement-config">
        <Card class="mb-4">
          <template #title>{{ $t('agreementConfig.modeTitle') }}</template>
          <Alert
            class="mb-4"
            show-icon
            type="info"
            :message="$t('agreementConfig.description')"
          />
          <div class="mode-row">
            <RadioGroup v-model:value="activeMode" :disabled="!canUpdate">
              <Radio value="welfare">
                <span class="mode-label">
                  {{ $t('agreementConfig.modes.welfare') }}
                </span>
                <span class="mode-desc">
                  {{ $t('agreementConfig.modeDescriptions.welfare') }}
                </span>
              </Radio>
              <Radio value="commercial">
                <span class="mode-label">
                  {{ $t('agreementConfig.modes.commercial') }}
                </span>
                <span class="mode-desc">
                  {{ $t('agreementConfig.modeDescriptions.commercial') }}
                </span>
              </Radio>
            </RadioGroup>
            <div class="mode-actions">
              <Tag color="success">
                {{
                  $t('agreementConfig.currentMode', [
                    modeLabel(overview.activeMode),
                  ])
                }}
              </Tag>
              <Button
                type="primary"
                :disabled="!canUpdate || activeMode === overview.activeMode"
                :loading="savingMode"
                @click="saveMode"
              >
                {{ $t('agreementConfig.saveMode') }}
              </Button>
            </div>
          </div>
          <p class="hint">{{ $t('agreementConfig.modeHint') }}</p>
        </Card>

        <Card>
          <div class="toolbar">
            <RadioGroup v-model:value="activeDoc" button-style="solid">
              <Radio v-for="doc in docOptions" :key="doc.key" :value="doc.key">
                {{ doc.label }}
              </Radio>
            </RadioGroup>
            <div class="toolbar-right">
              <span class="toolbar-label">
                {{ $t('agreementConfig.language') }}
              </span>
              <Select v-model:value="lang" style="width: 140px">
                <SelectOption
                  v-for="item in languageOptions"
                  :key="item.key"
                  :value="item.key"
                >
                  {{ item.label }}
                </SelectOption>
              </Select>
            </div>
          </div>

          <div class="mode-switch">
            <span class="toolbar-label">{{ $t('agreementConfig.editMode') }}</span>
            <RadioGroup v-model:value="editMode">
              <Radio
                v-for="mode in modeOptions"
                :key="mode.key"
                :value="mode.key"
              >
                {{ mode.label }}
              </Radio>
            </RadioGroup>
          </div>

          <Alert
            v-if="!currentItem"
            class="mb-4"
            show-icon
            type="warning"
            :message="$t('agreementConfig.empty')"
          />

          <div class="meta-grid">
            <label class="field field-title">
              <span>{{ $t('agreementConfig.fields.title') }}</span>
              <Input
                v-model:value="form.title"
                :disabled="!canUpdate"
                :maxlength="200"
                :placeholder="$t('agreementConfig.placeholders.title')"
              />
            </label>
            <label class="field field-version">
              <span>{{ $t('agreementConfig.fields.version') }}</span>
              <Input
                v-model:value="form.version"
                :disabled="!canUpdate"
                :maxlength="32"
                :placeholder="$t('agreementConfig.placeholders.version')"
              />
            </label>
            <label class="field field-date">
              <span>{{ $t('agreementConfig.fields.effectiveDate') }}</span>
              <Input
                v-model:value="form.effectiveDate"
                :disabled="!canUpdate"
                :maxlength="10"
                :placeholder="$t('agreementConfig.placeholders.effectiveDate')"
              />
            </label>
            <label class="field field-status">
              <span>{{ $t('agreementConfig.fields.status') }}</span>
              <Switch
                v-model:checked="form.status"
                :disabled="!canUpdate"
                :checked-children="$t('agreementConfig.statusEnabled')"
                :un-checked-children="$t('agreementConfig.statusDisabled')"
              />
            </label>
          </div>

          <label class="field mb-4">
            <span>{{ $t('agreementConfig.fields.summary') }}</span>
            <Input.TextArea
              v-model:value="form.summary"
              :disabled="!canUpdate"
              :maxlength="500"
              :placeholder="$t('agreementConfig.placeholders.summary')"
              :rows="2"
            />
          </label>

          <div class="field">
            <span class="content-label">
              <span>{{ $t('agreementConfig.fields.content') }}</span>
              <span :class="{ 'is-over': contentTooLarge }">
                {{
                  $t('agreementConfig.contentBytes', [
                    `${formatBytes(contentBytes)}`,
                  ])
                }}
              </span>
            </span>
            <Input.TextArea
              v-model:value="form.contentHtml"
              class="content-input"
              :disabled="!canUpdate"
              :placeholder="$t('agreementConfig.placeholders.content')"
              :rows="16"
              spellcheck="false"
            />
            <p class="hint">{{ $t('agreementConfig.contentHint') }}</p>
          </div>

          <div class="actions">
            <Button @click="previewVisible = !previewVisible">
              {{
                previewVisible
                  ? $t('agreementConfig.hidePreview')
                  : $t('agreementConfig.preview')
              }}
            </Button>
            <a :href="publicPath" rel="noopener noreferrer" target="_blank">
              {{ $t('agreementConfig.viewPublic') }}
            </a>
            <span v-if="lastSavedAt" class="updated-at">
              {{ $t('agreementConfig.updatedAt', [lastSavedAt]) }}
            </span>
            <span class="spacer" />
            <Button
              type="primary"
              :disabled="!canUpdate || contentTooLarge"
              :loading="saving"
              @click="saveTemplate"
            >
              {{ $t('agreementConfig.save') }}
            </Button>
          </div>

          <div v-if="previewVisible" class="preview-panel">
            <RichTextPreview :content="form.contentHtml" :min-height="320" />
          </div>
        </Card>
      </div>
    </Spin>
  </Page>
</template>

<style scoped>
.agreement-config {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mode-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
}

.mode-label {
  display: block;
  font-weight: 700;
}

.mode-desc {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.mode-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 14px;
  margin-bottom: 14px;
  border-bottom: 1px solid hsl(var(--border));
}

.toolbar-right,
.mode-switch {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.mode-switch {
  margin-bottom: 16px;
}

.toolbar-label {
  font-size: 13px;
  font-weight: 650;
  color: hsl(var(--muted-foreground));
}

.meta-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 140px 160px 160px;
  gap: 14px;
  margin-bottom: 14px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  font-weight: 650;
  color: hsl(var(--foreground) / 86%);
}

.field-status {
  min-width: 0;
}

.content-label {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
}

.content-label .is-over {
  font-weight: 800;
  color: hsl(var(--destructive));
}

.content-input {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  line-height: 1.7;
}

.hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.7;
  color: hsl(var(--muted-foreground));
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  align-items: center;
  padding-top: 16px;
  margin-top: 16px;
  border-top: 1px solid hsl(var(--border));
}

.actions .spacer {
  flex: 1;
}

.updated-at {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.preview-panel {
  padding: 16px;
  margin-top: 16px;
  background: hsl(var(--muted) / 35%);
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
}

@media (max-width: 1100px) {
  .meta-grid {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
}

@media (max-width: 640px) {
  .meta-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
