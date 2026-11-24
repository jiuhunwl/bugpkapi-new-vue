<script lang="ts" setup>
import type { UploadFile } from 'ant-design-vue';

import type { VbenFormSchema } from '#/adapter/form';
import type {
  GlobalLoadingPreset,
  LoadingAnimationPreset,
} from '#/api/system/site';

import { computed, onMounted, ref, shallowRef } from 'vue';

import { Page } from '@vben/common-ui';
import { useAccessStore, useUserStore } from '@vben/stores';

import {
  Button,
  Card,
  Checkbox,
  CheckboxGroup,
  message,
  Spin,
  TabPane,
  Tabs,
  Tag,
} from 'ant-design-vue';

import { useVbenForm, z } from '#/adapter/form';
import {
  DEFAULT_GLOBAL_LOADING_PRESET,
  DEFAULT_LOADING_ANIMATION_PRESET,
  getSiteConfig,
  GLOBAL_LOADING_PRESETS,
  LOADING_ANIMATION_PRESETS,
  normalizeGlobalLoadingPreset,
  normalizeLoadingAnimationPreset,
  updateSiteConfig,
  uploadLoadingAnimation,
  uploadSiteLogo,
} from '#/api/system/site';
import { $t } from '#/locales';
import { applySiteBrand } from '#/site-brand';

import SitePreviewRail from './SitePreviewRail.vue';

defineOptions({ name: 'SystemSiteConfig' });

const MAX_ANALYTICS_CODE_BYTES = 256 * 1024;
const DEFAULT_PREVIEW_SITE_NAME = 'BugPk-Api';
/** 双列表单：短字段并排，长字段（URL / 描述）自己占一行 */
const GRID_TWO = 'grid-cols-1 gap-x-4 gap-y-2 md:grid-cols-2';
const GRID_ONE = 'grid-cols-1 gap-x-4 gap-y-2';
/** 一个分组 = 一张卡片 = 一个表单，卡片之间互不打断 */
type SectionKey =
  | 'analytics'
  | 'branding'
  | 'contact'
  | 'globalLoading'
  | 'identity'
  | 'seo'
  | 'show'
  | 'startup';
type TabKey = 'basic' | 'display' | 'public';

const TAB_OF_SECTION: Record<SectionKey, TabKey> = {
  analytics: 'display',
  branding: 'public',
  contact: 'basic',
  globalLoading: 'display',
  identity: 'basic',
  seo: 'display',
  show: 'public',
  startup: 'display',
};
const SECTION_KEYS = Object.keys(TAB_OF_SECTION) as SectionKey[];
/** 公开预览面板关心的是「前台会不会变」，与字段属于哪个表单无关 */
const PREVIEW_FIELDS = [
  'contactEmail',
  'contactPhone',
  'contactQq',
  'contactWechat',
  'copyright',
  'description',
  'githubUrl',
  'icp',
  'logoUrl',
  'ogImage',
  'seoKeywords',
  'seoTitle',
  'siteName',
  'siteUrl',
  'slogan',
];

const loading = shallowRef(false);
const saving = shallowRef(false);
const activeTab = shallowRef<TabKey>('basic');
const updateTime = ref<null | string>(null);
const accessStore = useAccessStore();
const userStore = useUserStore();
const isAdmin = computed(() => userStore.userRoles.includes('admin'));
const hasCode = (code: string) =>
  isAdmin.value || accessStore.accessCodes.includes(code);
const canUpdate = computed(() => hasCode('site:config:update'));
const canUploadLogo = computed(() => hasCode('site:upload-logo'));
const canUploadLoadingAnimation = computed(() =>
  hasCode('site:upload-loading-animation'),
);

const enabledSections = ref<Record<SectionKey, boolean>>({
  analytics: true,
  branding: true,
  contact: true,
  globalLoading: true,
  identity: true,
  seo: true,
  show: true,
  startup: true,
});
const enabledSectionOptions = computed(() =>
  SECTION_KEYS.map((section) => ({
    label: $t(`siteSettings.groups.${section}.title`),
    value: section,
  })),
);
const enabledSectionKeys = computed({
  get: () => SECTION_KEYS.filter((section) => enabledSections.value[section]),
  set: (keys) => {
    SECTION_KEYS.forEach((section) => {
      enabledSections.value[section] = keys.includes(section);
    });
  },
});

const loadingPreviewEnabled = ref(false);
const loadingPreviewPreset = ref<LoadingAnimationPreset>(
  DEFAULT_LOADING_ANIMATION_PRESET,
);
const globalLoadingPreview = ref<GlobalLoadingPreset>(
  DEFAULT_GLOBAL_LOADING_PRESET,
);
const loadingPreviewSiteName = ref(DEFAULT_PREVIEW_SITE_NAME);
const loadingPreviewUrl = ref('');
const previewValues = ref<Record<string, any>>({});

const dirtySections = ref<Record<SectionKey, boolean>>({
  analytics: false,
  branding: false,
  contact: false,
  globalLoading: false,
  identity: false,
  seo: false,
  show: false,
  startup: false,
});
const baselineSnapshots = ref<Partial<Record<SectionKey, string>>>({});

function stringValue(value: unknown) {
  return String(value ?? '').trim();
}

function snapshotOf(values: Record<string, any>) {
  return JSON.stringify(values, (key, value) =>
    key === 'originFileObj' ? undefined : value,
  );
}

function extractLogoUrl(values: Record<string, any>) {
  const files = (values.logoFile ?? []) as UploadFile[];
  const uploadedUrl = (files[0]?.response as undefined | { url?: string })?.url;
  return uploadedUrl || stringValue(values.logoUrl) || files[0]?.url || '';
}

function extractLoadingAnimationUrl(values: Record<string, any>) {
  const files = (values.loadingAnimationFile ?? []) as UploadFile[];
  const uploadedUrl = (files[0]?.response as undefined | { url?: string })?.url;
  return (
    uploadedUrl ||
    stringValue(values.loadingAnimationUrl) ||
    files[0]?.url ||
    ''
  );
}

/**
 * 任一表单改动都要同时喂两个预览：启动动画预览取站点名称与素材，
 * 公开页预览取会被前台读到的字段。用 `in` 判断而不是直接赋值，
 * 否则 A 表单变更会把 B 表单已经同步好的预览值抹成空。
 */
function syncPreview(values: Record<string, any>) {
  const merged = { ...previewValues.value };
  for (const field of PREVIEW_FIELDS) {
    if (field in values) {
      merged[field] = values[field];
    }
  }
  if ('logoFile' in values || 'logoUrl' in values) {
    merged.logoUrl = extractLogoUrl(values);
  }
  previewValues.value = merged;

  if ('siteName' in values) {
    loadingPreviewSiteName.value =
      stringValue(values.siteName) || DEFAULT_PREVIEW_SITE_NAME;
  }
  if ('loadingAnimationEnabled' in values) {
    loadingPreviewEnabled.value = Boolean(values.loadingAnimationEnabled);
  }
  if ('loadingAnimationPreset' in values) {
    loadingPreviewPreset.value = normalizeLoadingAnimationPreset(
      values.loadingAnimationPreset,
    );
  }
  if ('globalLoadingPreset' in values) {
    globalLoadingPreview.value = normalizeGlobalLoadingPreset(
      values.globalLoadingPreset,
    );
  }
  if ('loadingAnimationUrl' in values || 'loadingAnimationFile' in values) {
    loadingPreviewUrl.value = extractLoadingAnimationUrl(values);
  }
}

const sectionFormConfigs: Record<
  SectionKey,
  { schema: VbenFormSchema[]; wrapperClass: string }
> = {
  identity: {
    wrapperClass: GRID_TWO,
    schema: [
      {
        component: 'Input',
        componentProps: { maxlength: 64, placeholder: DEFAULT_PREVIEW_SITE_NAME },
        fieldName: 'siteName',
        label: $t('siteSettings.fields.name'),
        rules: z
          .string()
          .min(1, $t('siteSettings.validation.nameRequired'))
          .max(64),
      },
      {
        component: 'Input',
        componentProps: {
          maxlength: 120,
          placeholder: $t('siteSettings.placeholders.slogan'),
        },
        fieldName: 'slogan',
        label: $t('siteSettings.fields.slogan'),
      },
      {
        component: 'Input',
        componentProps: {
          maxlength: 1024,
          placeholder: $t('siteSettings.placeholders.logo'),
        },
        fieldName: 'logoUrl',
        formItemClass: 'col-span-1 md:col-span-2',
        label: $t('siteSettings.fields.logo'),
      },
      {
        component: 'Upload',
        componentProps: {
          accept: '.png,.jpg,.jpeg,.webp,.gif',
          customRequest: uploadSiteLogo,
          disabled: !canUploadLogo.value,
          listType: 'picture-card',
          maxCount: 1,
          maxSize: 2,
          multiple: false,
          showUploadList: true,
        },
        fieldName: 'logoFile',
        formItemClass: 'col-span-1 md:col-span-2',
        label: $t('siteSettings.fields.uploadLogo'),
        renderComponentContent: () => ({
          default: () => $t('siteSettings.actions.upload'),
        }),
      },
      {
        component: 'Textarea',
        componentProps: { maxlength: 255, rows: 3, showCount: true },
        fieldName: 'description',
        formItemClass: 'col-span-1 md:col-span-2',
        label: $t('siteSettings.fields.description'),
      },
    ],
  },
  contact: {
    wrapperClass: GRID_ONE,
    schema: [
      {
        component: 'Input',
        componentProps: { maxlength: 128 },
        fieldName: 'icp',
        label: $t('siteSettings.fields.icp'),
      },
      {
        component: 'Input',
        componentProps: { maxlength: 128 },
        fieldName: 'copyright',
        label: $t('siteSettings.fields.copyright'),
      },
    ],
  },
  startup: {
    wrapperClass: GRID_TWO,
    schema: [
      {
        component: 'Select',
        componentProps: {
          options: LOADING_ANIMATION_PRESETS.map((preset) => ({
            label: $t(`siteSettings.loading.presets.${preset}`),
            value: preset,
          })),
        },
        defaultValue: DEFAULT_LOADING_ANIMATION_PRESET,
        description: $t('siteSettings.loading.presetHelp'),
        fieldName: 'loadingAnimationPreset',
        label: $t('siteSettings.loading.fields.preset'),
        rules: 'selectRequired',
      },
      {
        component: 'Switch',
        componentProps: {
          checkedChildren: $t('siteSettings.loading.switch.custom'),
          class: 'w-auto',
          unCheckedChildren: $t('siteSettings.loading.switch.default'),
        },
        fieldName: 'loadingAnimationEnabled',
        label: $t('siteSettings.loading.fields.enabled'),
      },
      {
        component: 'Input',
        componentProps: {
          maxlength: 1024,
          placeholder: $t('siteSettings.loading.placeholders.url'),
        },
        description: $t('siteSettings.loading.help'),
        fieldName: 'loadingAnimationUrl',
        formItemClass: 'col-span-1 md:col-span-2',
        label: $t('siteSettings.loading.fields.url'),
      },
      {
        component: 'Upload',
        componentProps: {
          accept: '.png,.jpg,.jpeg,.webp,.gif',
          customRequest: uploadLoadingAnimation,
          disabled: !canUploadLoadingAnimation.value,
          listType: 'picture-card',
          maxCount: 1,
          maxSize: 2,
          multiple: false,
          showUploadList: true,
        },
        fieldName: 'loadingAnimationFile',
        formItemClass: 'col-span-1 md:col-span-2',
        label: $t('siteSettings.loading.fields.upload'),
        renderComponentContent: () => ({
          default: () => $t('siteSettings.actions.upload'),
        }),
      },
    ],
  },
  globalLoading: {
    wrapperClass: GRID_ONE,
    schema: [
      {
        component: 'Select',
        componentProps: {
          options: GLOBAL_LOADING_PRESETS.map((preset) => ({
            label: $t(`siteSettings.loading.globalPresets.${preset}`),
            value: preset,
          })),
        },
        defaultValue: DEFAULT_GLOBAL_LOADING_PRESET,
        description: $t('siteSettings.loading.globalHelp'),
        fieldName: 'globalLoadingPreset',
        label: $t('siteSettings.loading.fields.globalPreset'),
        rules: 'selectRequired',
      },
    ],
  },
  branding: {
    wrapperClass: GRID_TWO,
    schema: [
      {
        component: 'Input',
        componentProps: { maxlength: 128 },
        fieldName: 'authorName',
        label: $t('siteSettings.branding.fields.authorName'),
      },
      {
        component: 'Input',
        componentProps: {
          maxlength: 1024,
          placeholder: 'https://example.com',
        },
        fieldName: 'authorUrl',
        label: $t('siteSettings.branding.fields.authorUrl'),
      },
      {
        component: 'Input',
        componentProps: { maxlength: 64, placeholder: 'MIT' },
        fieldName: 'licenseType',
        label: $t('siteSettings.branding.fields.licenseType'),
      },
      {
        component: 'Input',
        componentProps: {
          maxlength: 1024,
          placeholder: 'https://example.com/LICENSE',
        },
        fieldName: 'licenseUrl',
        label: $t('siteSettings.branding.fields.licenseUrl'),
      },
    ],
  },
  seo: {
    wrapperClass: GRID_ONE,
    schema: [
      {
        component: 'Input',
        componentProps: {
          maxlength: 128,
          placeholder: $t('siteSettings.seo.placeholders.title'),
        },
        fieldName: 'seoTitle',
        label: $t('siteSettings.seo.fields.title'),
      },
      {
        component: 'Input',
        componentProps: {
          maxlength: 512,
          placeholder: $t('siteSettings.seo.placeholders.keywords'),
        },
        fieldName: 'seoKeywords',
        label: $t('siteSettings.seo.fields.keywords'),
      },
      {
        component: 'Switch',
        componentProps: {
          checkedChildren: $t('siteSettings.seo.switch.on'),
          class: 'w-auto',
          unCheckedChildren: $t('siteSettings.seo.switch.off'),
        },
        fieldName: 'noindex',
        label: $t('siteSettings.seo.fields.noindex'),
      },
    ],
  },
  analytics: {
    wrapperClass: GRID_ONE,
    schema: [
      {
        component: 'Textarea',
        componentProps: {
          autoSize: { maxRows: 18, minRows: 8 },
          maxlength: MAX_ANALYTICS_CODE_BYTES,
          placeholder: $t('siteSettings.analytics.placeholder'),
          showCount: true,
          spellcheck: false,
        },
        description: $t('siteSettings.analytics.help'),
        fieldName: 'analyticsCode',
        label: $t('siteSettings.analytics.fields.code'),
        rules: z
          .string()
          .optional()
          .refine(
            (value) =>
              new TextEncoder().encode(value ?? '').byteLength <=
              MAX_ANALYTICS_CODE_BYTES,
            $t('siteSettings.analytics.tooLarge'),
          ),
      },
    ],
  },
  show: {
    wrapperClass: GRID_TWO,
    schema: [
      {
        component: 'Input',
        componentProps: { maxlength: 128, placeholder: 'contact@example.com' },
        fieldName: 'contactEmail',
        label: $t('siteSettings.fields.email'),
      },
      {
        component: 'Input',
        componentProps: {
          maxlength: 64,
          placeholder: $t('siteSettings.placeholders.phone'),
        },
        fieldName: 'contactPhone',
        label: $t('siteSettings.fields.phone'),
      },
      {
        component: 'Input',
        componentProps: { maxlength: 64 },
        fieldName: 'contactQq',
        label: $t('siteSettings.fields.qq'),
      },
      {
        component: 'Input',
        componentProps: { maxlength: 64 },
        fieldName: 'contactWechat',
        label: $t('siteSettings.fields.wechat'),
      },
      {
        component: 'Input',
        componentProps: { maxlength: 255 },
        fieldName: 'contactAddress',
        formItemClass: 'col-span-1 md:col-span-2',
        label: $t('siteSettings.fields.address'),
      },
      {
        component: 'Input',
        componentProps: {
          maxlength: 1024,
          placeholder: 'https://github.com/owner/repository',
        },
        fieldName: 'githubUrl',
        formItemClass: 'col-span-1 md:col-span-2',
        label: $t('siteSettings.branding.fields.githubUrl'),
      },
      {
        component: 'Input',
        componentProps: {
          maxlength: 1024,
          placeholder: $t('siteSettings.seo.placeholders.ogImage'),
        },
        fieldName: 'ogImage',
        formItemClass: 'col-span-1 md:col-span-2',
        label: $t('siteSettings.seo.fields.ogImage'),
      },
    ],
  },
};

function createSectionForm(section: SectionKey) {
  const { schema, wrapperClass } = sectionFormConfigs[section];
  return useVbenForm({
    commonConfig: {
      colon: true,
      componentProps: { class: 'w-full' },
      formItemClass: 'col-span-1',
      // 窄卡片里 flex 会压缩 label 导致换行，锁住宽度让输入区自己收缩
      labelClass: 'shrink-0',
      labelWidth: 120,
    },
    layout: 'horizontal',
    handleValuesChange(values) {
      dirtySections.value[section] =
        snapshotOf(values) !== baselineSnapshots.value[section];
      syncPreview(values);
    },
    schema,
    showDefaultActions: false,
    wrapperClass,
  });
}

const [IdentityForm, identityFormApi] = createSectionForm('identity');
const [ContactForm, contactFormApi] = createSectionForm('contact');
const [StartupForm, startupFormApi] = createSectionForm('startup');
const [GlobalLoadingForm, globalLoadingFormApi] =
  createSectionForm('globalLoading');
const [BrandingForm, brandingFormApi] = createSectionForm('branding');
const [SeoForm, seoFormApi] = createSectionForm('seo');
const [AnalyticsForm, analyticsFormApi] = createSectionForm('analytics');
const [ShowForm, showFormApi] = createSectionForm('show');

const sectionApis: { api: typeof identityFormApi; key: SectionKey }[] = [
  { api: identityFormApi, key: 'identity' },
  { api: contactFormApi, key: 'contact' },
  { api: startupFormApi, key: 'startup' },
  { api: globalLoadingFormApi, key: 'globalLoading' },
  { api: brandingFormApi, key: 'branding' },
  { api: seoFormApi, key: 'seo' },
  { api: analyticsFormApi, key: 'analytics' },
  { api: showFormApi, key: 'show' },
];

const dirtyTabs = computed(() => {
  const result: Record<TabKey, boolean> = {
    basic: false,
    display: false,
    public: false,
  };
  for (const section of SECTION_KEYS) {
    if (dirtySections.value[section]) {
      result[TAB_OF_SECTION[section]] = true;
    }
  }
  return result;
});
const isDirty = computed(() =>
  SECTION_KEYS.some((section) => dirtySections.value[section]),
);

async function captureBaselines() {
  const snapshots: Partial<Record<SectionKey, string>> = {};
  for (const { api, key } of sectionApis) {
    snapshots[key] = snapshotOf(await api.getValues());
    dirtySections.value[key] = false;
  }
  baselineSnapshots.value = snapshots;
}

async function loadConfig() {
  loading.value = true;
  try {
    const config = await getSiteConfig();
    await applySiteBrand(config);
    updateTime.value = config.updateTime ?? null;
    const formValues = {
      ...config,
      // Switch 使用 checked 绑定，需把后端 0/1 转为布尔
      noindex: Number(config.noindex) === 1,
      loadingAnimationEnabled: Number(config.loadingAnimationEnabled) === 1,
      loadingAnimationPreset: normalizeLoadingAnimationPreset(
        config.loadingAnimationPreset,
      ),
      globalLoadingPreset: normalizeGlobalLoadingPreset(
        config.globalLoadingPreset,
      ),
      loadingAnimationFile: config.loadingAnimationUrl
        ? [
            {
              name: 'loading-animation',
              status: 'done',
              uid: '-2',
              url: config.loadingAnimationUrl,
            },
          ]
        : [],
      logoFile: config.logoUrl
        ? [
            {
              name: 'site-logo',
              status: 'done',
              uid: '-1',
              url: config.logoUrl,
            },
          ]
        : [],
    };
    // setValues 会过滤掉不属于本表单 schema 的字段，所以整份配置可以重复下发
    for (const { api } of sectionApis) {
      await api.setValues(formValues);
    }
    previewValues.value = { ...formValues };
    syncPreview(formValues);
    await captureBaselines();
  } finally {
    loading.value = false;
  }
}

async function onSubmit() {
  if (!canUpdate.value) return;
  saving.value = true;
  try {
    for (const { api, key } of sectionApis) {
      const { valid } = await api.validate();
      if (!valid) {
        activeTab.value = TAB_OF_SECTION[key];
        message.error(
          $t('siteSettings.messages.invalidTab', [
            $t(`siteSettings.tabs.${TAB_OF_SECTION[key]}`),
          ]),
        );
        return;
      }
    }
    const values: Record<string, any> = {};
    for (const { api } of sectionApis) {
      Object.assign(values, await api.getValues());
    }
    const loadingAnimationUrl = extractLoadingAnimationUrl(values);
    if (values.loadingAnimationEnabled && !loadingAnimationUrl) {
      activeTab.value = TAB_OF_SECTION.startup;
      message.error($t('siteSettings.loading.urlRequired'));
      return;
    }
    await updateSiteConfig({
      analyticsCode: String(values.analyticsCode ?? ''),
      authorName: stringValue(values.authorName),
      authorUrl: stringValue(values.authorUrl),
      contactAddress: stringValue(values.contactAddress),
      contactEmail: stringValue(values.contactEmail),
      contactPhone: stringValue(values.contactPhone),
      contactQq: stringValue(values.contactQq),
      contactWechat: stringValue(values.contactWechat),
      copyright: stringValue(values.copyright),
      description: stringValue(values.description),
      githubUrl: stringValue(values.githubUrl),
      icp: stringValue(values.icp),
      licenseType: stringValue(values.licenseType),
      licenseUrl: stringValue(values.licenseUrl),
      logoUrl: extractLogoUrl(values),
      loadingAnimationEnabled: values.loadingAnimationEnabled ? 1 : 0,
      loadingAnimationPreset: normalizeLoadingAnimationPreset(
        values.loadingAnimationPreset,
      ),
      globalLoadingPreset: normalizeGlobalLoadingPreset(
        values.globalLoadingPreset,
      ),
      loadingAnimationUrl,
      noindex: values.noindex ? 1 : 0,
      ogImage: stringValue(values.ogImage),
      seoKeywords: stringValue(values.seoKeywords),
      seoTitle: stringValue(values.seoTitle),
      siteName: stringValue(values.siteName),
      siteUrl: stringValue(values.siteUrl),
      slogan: stringValue(values.slogan),
    });
    await loadConfig();
    message.success($t('siteSettings.messages.saved'));
  } finally {
    saving.value = false;
  }
}

async function revertChanges() {
  await loadConfig();
  message.info($t('siteSettings.messages.reverted'));
}

onMounted(() => void loadConfig());
</script>

<template>
  <Page
    auto-content-height
    :description="$t('siteSettings.description')"
    :title="$t('siteSettings.title')"
  >
    <template #extra>
      <Tag :color="isDirty ? 'warning' : 'success'" class="site-config-state">
        {{
          isDirty
            ? $t('siteSettings.unsaved')
            : $t('siteSettings.upToDate')
        }}
      </Tag>
    </template>

    <Spin :spinning="loading">
      <Tabs v-model:active-key="activeTab" class="site-config-tabs">
        <TabPane key="basic" force-render>
          <template #tab>
            <span class="site-config-tab">
              {{ $t('siteSettings.tabs.basic') }}
              <i v-if="dirtyTabs.basic" class="site-config-tab-dot"></i>
            </span>
          </template>

          <Card
            :bordered="true"
            size="small"
            class="site-config-switches"
            :title="$t('siteSettings.groups.switches.title')"
          >
            <template #extra>
              <span class="site-config-switches-hint">
                {{ $t('siteSettings.groups.switches.hint') }}
              </span>
            </template>
            <CheckboxGroup v-model:value="enabledSectionKeys">
              <label
                v-for="option in enabledSectionOptions"
                :key="option.value"
                class="site-config-switch"
                :class="{ 'is-active': enabledSections[option.value] }"
              >
                <Checkbox :value="option.value" />
                <span>{{ option.label }}</span>
              </label>
            </CheckboxGroup>
          </Card>

          <div class="site-config-basic-grid">
            <!-- v-show 而不是 v-if：表单卸载后 formApi 拿不到实例，保存链路会卡住 -->
            <Card
              v-show="enabledSections.identity"
              :bordered="true"
              size="small"
            >
              <template #title>
                <div class="site-config-card-title">
                  <span>{{ $t('siteSettings.groups.identity.title') }}</span>
                  <small>{{ $t('siteSettings.groups.identity.hint') }}</small>
                </div>
              </template>
              <IdentityForm />
            </Card>

            <div class="site-config-basic-side">
              <Card
                v-show="enabledSections.contact"
                :bordered="true"
                size="small"
              >
                <template #title>
                  <div class="site-config-card-title">
                    <span>{{ $t('siteSettings.groups.contact.title') }}</span>
                    <small>{{ $t('siteSettings.groups.contact.hint') }}</small>
                  </div>
                </template>
                <ContactForm />
              </Card>

              <div class="site-config-preview-sticky">
                <SitePreviewRail :show="['hero', 'footer']" :values="previewValues" />
              </div>
            </div>
          </div>
        </TabPane>

        <TabPane key="display" force-render>
          <template #tab>
            <span class="site-config-tab">
              {{ $t('siteSettings.tabs.display') }}
              <i v-if="dirtyTabs.display" class="site-config-tab-dot"></i>
            </span>
          </template>

          <div class="site-config-display-grid">
            <Card
              v-show="enabledSections.startup"
              :bordered="true"
              class="is-wide"
              size="small"
            >
              <template #title>
                <div class="site-config-card-title">
                  <span>{{ $t('siteSettings.loading.title') }}</span>
                  <small>{{ $t('siteSettings.groups.startup.hint') }}</small>
                </div>
              </template>
              <StartupForm />
            </Card>

            <Card
              v-show="enabledSections.globalLoading"
              :bordered="true"
              size="small"
            >
              <template #title>
                <div class="site-config-card-title">
                  <span>{{ $t('siteSettings.loading.globalTitle') }}</span>
                  <small>{{ $t('siteSettings.groups.globalLoading.hint') }}</small>
                </div>
              </template>
              <GlobalLoadingForm />
            </Card>

            <Card v-show="enabledSections.seo" :bordered="true" size="small">
              <template #title>
                <div class="site-config-card-title">
                  <span>{{ $t('siteSettings.seo.title') }}</span>
                  <small>{{ $t('siteSettings.groups.seo.hint') }}</small>
                </div>
              </template>
              <SeoForm />
            </Card>

            <Card
              v-show="enabledSections.analytics"
              :bordered="true"
              class="is-wide"
              size="small"
            >
              <template #title>
                <div class="site-config-card-title">
                  <span>{{ $t('siteSettings.analytics.title') }}</span>
                  <small>{{ $t('siteSettings.groups.analytics.hint') }}</small>
                </div>
              </template>
              <AnalyticsForm />
            </Card>
          </div>
        </TabPane>

        <TabPane key="public" force-render>
          <template #tab>
            <span class="site-config-tab">
              {{ $t('siteSettings.tabs.public') }}
              <i v-if="dirtyTabs.public" class="site-config-tab-dot"></i>
            </span>
          </template>

          <div class="site-config-public-grid">
            <div class="site-config-public-forms">
              <Card v-show="enabledSections.show" :bordered="true" size="small">
                <template #title>
                  <div class="site-config-card-title">
                    <span>{{ $t('siteSettings.groups.show.title') }}</span>
                    <small>{{ $t('siteSettings.groups.show.hint') }}</small>
                  </div>
                </template>
                <ShowForm />
              </Card>

              <Card
                v-show="enabledSections.branding"
                :bordered="true"
                size="small"
              >
                <template #title>
                  <div class="site-config-card-title">
                    <span>{{ $t('siteSettings.branding.title') }}</span>
                    <small>
                      {{ $t('siteSettings.groups.branding.hint') }}
                    </small>
                  </div>
                </template>
                <BrandingForm />
              </Card>
            </div>

            <div class="site-config-public-preview">
              <div class="site-config-preview-sticky">
                <SitePreviewRail
                  :global-preset="globalLoadingPreview"
                  :loading-enabled="loadingPreviewEnabled"
                  :loading-preset="loadingPreviewPreset"
                  :loading-site-name="loadingPreviewSiteName"
                  :loading-url="loadingPreviewUrl"
                  :values="previewValues"
                />
              </div>
            </div>
          </div>
        </TabPane>
      </Tabs>
    </Spin>

    <template #footer>
      <div class="site-config-footer">
        <span class="site-config-footer-time">
          {{
            $t('siteSettings.lastUpdated', [
              updateTime || $t('siteSettings.never'),
            ])
          }}
        </span>
        <div class="site-config-footer-actions">
          <Button :disabled="!isDirty || saving" @click="revertChanges">
            {{ $t('siteSettings.actions.revert') }}
          </Button>
          <Button
            v-if="canUpdate"
            type="primary"
            :loading="saving"
            @click="onSubmit"
          >
            {{ $t('siteSettings.actions.save') }}
          </Button>
        </div>
      </div>
    </template>
  </Page>
</template>

<style scoped>
.site-config-state {
  margin-inline-end: 0;
}

.site-config-tab {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}

.site-config-tab-dot {
  width: 6px;
  height: 6px;
  background: hsl(var(--warning));
  border-radius: 50%;
}

.site-config-card-title {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  align-items: baseline;
  font-weight: 600;
  line-height: 1.4;
}

.site-config-card-title small {
  font-size: 12px;
  font-weight: 400;
  color: hsl(var(--muted-foreground));
}

/* 卡片宽度跟着内容量走：字段多的占两份，两个短字段只占一份，卡片内不再留大片空白 */
.site-config-basic-grid,
.site-config-display-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(0, 1fr);
  margin-top: 12px;
  align-items: start;
}

.site-config-switches {
  margin-bottom: 12px;
}

.site-config-switches-hint {
  font-size: 12px;
  font-weight: 400;
  color: hsl(var(--muted-foreground));
}

/* CheckboxGroup 的默认排布是 inline，这里改成等分栅格，保证「爆满」 */
.site-config-switches :deep(.ant-checkbox-group) {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr));
  width: 100%;
}

.site-config-switch {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 6px 10px;
  cursor: pointer;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  transition:
    background 0.2s,
    border-color 0.2s;
}

.site-config-switch.is-active {
  background: hsl(var(--primary) / 8%);
  border-color: hsl(var(--primary) / 45%);
}

.site-config-public-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(0, 1fr);
  margin-top: 12px;
  align-items: start;
}

.site-config-public-forms {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.site-config-public-preview {
  min-width: 0;
}

.site-config-preview-sticky {
  display: grid;
  gap: 16px;
  align-content: start;
}

.site-config-basic-side {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  align-self: stretch;
}

.site-config-footer {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.site-config-footer-time {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.site-config-footer-actions {
  display: flex;
  gap: 8px;
}

@media (min-width: 1024px) {
  .site-config-basic-grid {
    grid-template-columns: minmax(0, 2fr) minmax(300px, 1fr);
  }

  /* 两栏档：启动动画与统计代码通栏，全局加载和 SEO 并排 */
  .site-config-display-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .site-config-display-grid .is-wide {
    grid-column: span 2;
  }

  .site-config-public-grid {
    grid-template-columns: minmax(0, 1fr) minmax(320px, 400px);
  }

  /* 预览列跟随滚动，改哪项都能立刻看到前台效果 */
  .site-config-preview-sticky {
    position: sticky;
    top: 0;
    align-content: start;
  }
}

@media (min-width: 1600px) {
  /* 宽屏档：三栏并排，容纳更多设置而不拉长页面 */
  .site-config-display-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .site-config-display-grid .is-wide {
    grid-column: span 2;
  }
}

@media (max-width: 1279px) {
  .site-config-switches-hint {
    display: none;
  }
}
</style>
