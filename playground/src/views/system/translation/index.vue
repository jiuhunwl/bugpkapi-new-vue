<script lang="ts" setup>
import type { TranslationApi } from '#/api/system/translation';

type FieldInfo = TranslationApi.FieldInfo;
type Locale = TranslationApi.Locale;
type ResourceItem = TranslationApi.ResourceItem;
type ResourceTypeInfo = TranslationApi.ResourceTypeInfo;

import { computed, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { RotateCw } from '@vben/icons';
import { useAccessStore, useUserStore } from '@vben/stores';

import {
  Button,
  Card,
  Drawer,
  Input,
  message,
  Pagination,
  Select,
  TabPane,
  Table,
  Tabs,
  Tag,
} from 'ant-design-vue';

import {
  getTranslationLocales,
  getTranslationResource,
  getTranslationResources,
  getTranslationResourceTypes,
  saveTranslationResource,
} from '#/api/system/translation';
import { $t } from '#/locales';

const accessStore = useAccessStore();
const userStore = useUserStore();
const loading = ref(false);
const saving = ref(false);
const resourceTypes = ref<ResourceTypeInfo[]>([]);
const locales = ref<Locale[]>([]);
const selectedType = ref('');
const keyword = ref('');
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const rows = ref<ResourceItem[]>([]);
const editorOpen = ref(false);
const current = ref<ResourceItem>();
const activeLocale = ref('');
const drafts = reactive<Record<string, Record<string, string>>>({});

const canUpdate = computed(
  () =>
    userStore.userRoles.includes('admin') ||
    accessStore.accessCodes.includes('system:i18n:update'),
);
const targetLocales = computed(() =>
  locales.value.filter((item) => item.enabled && !item.isDefault),
);
const currentType = computed(() =>
  resourceTypes.value.find((item) => item.type === selectedType.value),
);
const typeOptions = computed(() =>
  resourceTypes.value.map((item) => ({
    // count 由后端资源计数接口提供；旧后端无该字段时不显示括号。
    label:
      item.count && item.count > 0
        ? `${$t(item.labelKey)} (${item.count})`
        : $t(item.labelKey),
    value: item.type,
  })),
);
const columns = computed(() => [
  { dataIndex: 'displayName', key: 'resource', title: $t('translationAdmin.columns.resource') },
  { dataIndex: 'resourceKey', key: 'key', title: $t('translationAdmin.columns.key'), width: 150 },
  { key: 'baseValue', title: $t('translationAdmin.columns.baseValue') },
  { key: 'completeness', title: $t('translationAdmin.columns.completeness') },
  { key: 'actions', title: $t('translationAdmin.columns.actions'), width: 100 },
]);

async function loadMeta() {
  const [types, localeList] = await Promise.all([
    getTranslationResourceTypes(),
    getTranslationLocales(),
  ]);
  resourceTypes.value = types;
  locales.value = localeList;
  if (!selectedType.value && types.length > 0) {
    // 默认打开条目最多的资源：站点配置是单例只有 1 行，
    // 落在它上面会让整页看起来「字典只有一条翻译」。
    // 旧后端无 count 时（全 0）退化为第一个资源。
    const richest = [...types].sort((a, b) => (b.count ?? 0) - (a.count ?? 0))[0]!;
    selectedType.value = (richest.count ?? 0) > 0 ? richest.type : types[0]!.type;
  }
  await loadResources();
}

async function loadResources() {
  if (!selectedType.value) return;
  loading.value = true;
  try {
    const result = await getTranslationResources({
      keyword: keyword.value.trim(),
      page: page.value,
      pageSize: pageSize.value,
      resourceType: selectedType.value,
    });
    rows.value = result.items;
    total.value = result.total;
  } catch {
    message.error($t('translationAdmin.messages.loadFailed'));
  } finally {
    loading.value = false;
  }
}

function handleTypeChange() {
  page.value = 1;
  loadResources();
}

function handleSearch() {
  page.value = 1;
  loadResources();
}

function rowKey(record: any) {
  return `${record.resourceType}:${record.resourceKey}`;
}

function baseValue(record: any) {
  const field = record.fields[0];
  return (field && record.values[field]) || record.displayName;
}

function localeCompleteness(record: any, code: string) {
  return record.completeness?.[code] ?? { total: record.fields.length, translated: 0 };
}

function isStale(field: FieldInfo) {
  if (!current.value || !activeLocale.value) return false;
  return current.value.staleFields?.[activeLocale.value]?.includes(field.name) ?? false;
}

function resetDrafts(item?: ResourceItem) {
  Object.keys(drafts).forEach((key) => delete drafts[key]);
  for (const locale of targetLocales.value) {
    drafts[locale.code] = {};
    for (const field of currentType.value?.fields ?? []) {
      drafts[locale.code]![field.name] = item?.translations?.[locale.code]?.[field.name] ?? '';
    }
  }
}

async function openEditor(record: any) {
  if (!canUpdate.value) {
    message.warning($t('translationAdmin.messages.noUpdatePermission'));
    return;
  }
  editorOpen.value = true;
  activeLocale.value = targetLocales.value[0]?.code ?? '';
  try {
    const detail = await getTranslationResource(record.resourceType, record.resourceKey);
    current.value = detail;
  } catch {
    current.value = record;
  }
  resetDrafts(current.value);
}

function closeEditor() {
  editorOpen.value = false;
  current.value = undefined;
}

function copyDefault(localeCode: string) {
  const item = current.value;
  if (!item) return;
  drafts[localeCode] ??= {};
  for (const field of currentType.value?.fields ?? []) {
    drafts[localeCode]![field.name] = item.values[field.name] ?? '';
  }
}

function clearLocale(localeCode: string) {
  drafts[localeCode] ??= {};
  for (const field of currentType.value?.fields ?? []) {
    drafts[localeCode]![field.name] = '';
  }
}

async function save() {
  const item = current.value;
  if (!item || saving.value || !canUpdate.value) return;
  saving.value = true;
  try {
    const translations: Record<string, Record<string, string>> = {};
    for (const locale of targetLocales.value) {
      translations[locale.code] = { ...(drafts[locale.code] ?? {}) };
    }
    await saveTranslationResource(item.resourceType, item.resourceKey, {
      translations,
    });
    message.success($t('translationAdmin.messages.saved'));
    closeEditor();
    await loadResources();
  } finally {
    saving.value = false;
  }
}

onMounted(loadMeta);
</script>

<template>
  <Page auto-content-height>
    <div class="translation-page">
      <header class="translation-page__header">
        <div>
          <h1>{{ $t('translationAdmin.title') }}</h1>
          <p>{{ $t('translationAdmin.description') }}</p>
        </div>
      </header>

      <Card>
        <div class="translation-page__toolbar">
          <Select
            v-model:value="selectedType"
            :options="typeOptions"
            class="translation-page__type"
            :placeholder="$t('translationAdmin.resourceTypePlaceholder')"
            @change="handleTypeChange"
          />
          <Input
            v-model:value="keyword"
            allow-clear
            :placeholder="$t('translationAdmin.searchPlaceholder')"
            class="translation-page__search"
            @press-enter="handleSearch"
          />
          <Button type="primary" @click="handleSearch">
            {{ $t('common.search') }}
          </Button>
          <Button :loading="loading" @click="loadResources">
            <template #icon><RotateCw class="size-4" /></template>
            {{ $t('translationAdmin.refresh') }}
          </Button>
        </div>

        <Table
          :columns="columns"
          :data-source="rows"
          :loading="loading"
          :pagination="false"
          :row-key="rowKey"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'resource'">
              <div class="translation-page__resource">
                <strong>{{ record.displayName }}</strong>
                <Tag>{{ $t(resourceTypes.find((item) => item.type === record.resourceType)?.labelKey ?? record.resourceType) }}</Tag>
              </div>
            </template>
            <template v-else-if="column.key === 'key'">
              <code>{{ record.resourceKey }}</code>
            </template>
            <template v-else-if="column.key === 'baseValue'">
              <span class="translation-page__base-value">{{ baseValue(record) }}</span>
            </template>
            <template v-else-if="column.key === 'completeness'">
              <div class="translation-page__completeness">
                <Tag
                  v-for="locale in targetLocales"
                  :key="locale.code"
                  :color="localeCompleteness(record, locale.code).translated > 0 ? 'success' : 'default'"
                >
                  {{ locale.label }}
                  {{ localeCompleteness(record, locale.code).translated }}/{{ localeCompleteness(record, locale.code).total }}
                </Tag>
              </div>
            </template>
            <template v-else-if="column.key === 'actions'">
              <Button
                :disabled="!canUpdate"
                size="small"
                type="link"
                @click="openEditor(record)"
              >
                {{ $t('translationAdmin.actions.translate') }}
              </Button>
            </template>
          </template>
        </Table>

        <div class="translation-page__pager">
          <Pagination
            v-model:current="page"
            v-model:page-size="pageSize"
            :total="total"
            show-size-changer
            @change="loadResources"
          />
        </div>
      </Card>

      <Drawer
        :open="editorOpen"
        :title="$t('translationAdmin.editor.title', [current?.displayName ?? ''])"
        :width="760"
        @close="closeEditor"
      >
        <div v-if="targetLocales.length === 0" class="translation-page__empty">
          {{ $t('translationAdmin.editor.noTargetLocale') }}
        </div>
        <Tabs v-else v-model:active-key="activeLocale">
          <TabPane v-for="locale in targetLocales" :key="locale.code" :tab="locale.label">
            <div class="translation-editor__actions">
              <Button size="small" @click="copyDefault(locale.code)">
                {{ $t('translationAdmin.editor.copyDefault') }}
              </Button>
              <Button size="small" @click="clearLocale(locale.code)">
                {{ $t('translationAdmin.editor.clear') }}
              </Button>
            </div>
            <div
              v-for="field in currentType?.fields ?? []"
              :key="field.name"
              class="translation-editor__field"
            >
              <div class="translation-editor__field-header">
                <strong>{{ $t(field.labelKey) }}</strong>
                <Tag v-if="isStale(field)" color="warning">
                  {{ $t('translationAdmin.editor.stale') }}
                </Tag>
              </div>
              <div class="translation-editor__source">
                <span>{{ $t('translationAdmin.editor.baseValue') }}</span>
                <pre>{{ current?.values[field.name] || '-' }}</pre>
              </div>
              <Input.TextArea
                v-model:value="drafts[activeLocale]![field.name]"
                :maxlength="field.maxBytes"
                :rows="field.html ? 6 : 2"
                show-count
              />
            </div>
          </TabPane>
        </Tabs>

        <template #footer>
          <Button @click="closeEditor">
            {{ $t('translationAdmin.editor.cancel') }}
          </Button>
          <Button :disabled="!canUpdate" :loading="saving" type="primary" @click="save">
            {{ $t('translationAdmin.editor.save') }}
          </Button>
        </template>
      </Drawer>
    </div>
  </Page>
</template>

<style scoped>
.translation-page {
  display: grid;
  gap: 18px;
  padding: 20px;
}

.translation-page__header h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: hsl(var(--foreground));
}

.translation-page__header p {
  margin: 6px 0 0;
  color: hsl(var(--muted-foreground));
}

.translation-page__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
}

.translation-page__type {
  width: 220px;
}

.translation-page__search {
  width: 260px;
}

.translation-page__resource {
  display: flex;
  gap: 8px;
  align-items: center;
}

.translation-page__base-value {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.translation-page__completeness {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.translation-page__pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.translation-page__empty {
  padding: 24px 0;
  color: hsl(var(--muted-foreground));
  text-align: center;
}

.translation-editor__actions {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}

.translation-editor__field {
  display: grid;
  gap: 8px;
  padding: 12px 0;
  border-bottom: 1px solid hsl(var(--border));
}

.translation-editor__field-header {
  display: flex;
  gap: 8px;
  align-items: center;
}

.translation-editor__source {
  display: grid;
  gap: 4px;
}

.translation-editor__source span {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.translation-editor__source pre {
  max-height: 120px;
  padding: 8px;
  overflow: auto;
  font-family: inherit;
  white-space: pre-wrap;
  background: hsl(var(--muted));
  border-radius: 6px;
}
</style>
