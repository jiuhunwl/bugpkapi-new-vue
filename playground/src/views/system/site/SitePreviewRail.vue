<script lang="ts" setup>
import type {
  GlobalLoadingPreset,
  LoadingAnimationPreset,
} from '#/api/system/site';

import { computed } from 'vue';

import { Card } from 'ant-design-vue';

import { $t } from '#/locales';

import LoadingAnimationPreview from './LoadingAnimationPreview.vue';

defineOptions({ name: 'SitePreviewRail' });

const props = withDefaults(
  defineProps<{
    globalPreset?: GlobalLoadingPreset;
    loadingEnabled?: boolean;
    loadingPreset?: LoadingAnimationPreset;
    loadingSiteName?: string;
    loadingUrl?: string;
    show?: PreviewBlock[];
    values?: Record<string, any>;
  }>(),
  {
    globalPreset: undefined,
    loadingEnabled: false,
    loadingPreset: undefined,
    loadingSiteName: '',
    loadingUrl: '',
    show: () => ['hero', 'loading', 'footer', 'share'],
    values: () => ({}),
  },
);

/** 预览块：基础信息页只要页头与页脚，公开站点页四块全给 */
type PreviewBlock = 'footer' | 'hero' | 'loading' | 'share';

const DEFAULT_PREVIEW_SITE_NAME = 'BugPk-Api';

const stringValue = (value: unknown) => String(value ?? '').trim();
const has = (block: PreviewBlock) => props.show.includes(block);

const logoUrl = computed(() => stringValue(props.values.logoUrl));
const siteName = computed(
  () => stringValue(props.values.siteName) || DEFAULT_PREVIEW_SITE_NAME,
);
const slogan = computed(() => stringValue(props.values.slogan));
const description = computed(() => stringValue(props.values.description));
const contactLines = computed(() => {
  const lines = [
    {
      label: $t('siteSettings.fields.email'),
      value: stringValue(props.values.contactEmail),
    },
    {
      label: $t('siteSettings.fields.phone'),
      value: stringValue(props.values.contactPhone),
    },
    {
      label: $t('siteSettings.fields.qq'),
      value: stringValue(props.values.contactQq),
    },
    {
      label: $t('siteSettings.fields.wechat'),
      value: stringValue(props.values.contactWechat),
    },
  ];
  return lines.filter((line) => line.value);
});
const legalLines = computed(() => {
  const lines = [
    stringValue(props.values.icp),
    stringValue(props.values.copyright),
  ];
  return lines.filter(Boolean);
});
const repository = computed(() => stringValue(props.values.githubUrl));
const shareTitle = computed(
  () =>
    stringValue(props.values.seoTitle) ||
    stringValue(props.values.siteName) ||
    DEFAULT_PREVIEW_SITE_NAME,
);
const shareDescription = computed(
  () =>
    stringValue(props.values.description) ||
    $t('siteSettings.public.preview.emptyDescription'),
);
const shareImage = computed(() => stringValue(props.values.ogImage));
const shareUrl = computed(
  () =>
    stringValue(props.values.siteUrl).replace(/^https?:\/\//, '') ||
    $t('siteSettings.public.preview.emptyUrl'),
);
</script>

<template>
  <Card v-if="has('hero')" :bordered="true" size="small">
    <template #title>
      <div class="rail-card-title">
        <span>{{ $t('siteSettings.public.preview.heroTitle') }}</span>
        <small>{{ $t('siteSettings.public.preview.heroHint') }}</small>
      </div>
    </template>
    <div class="demo-header">
      <img
        v-if="logoUrl"
        class="demo-logo"
        :src="logoUrl"
        :alt="$t('siteSettings.loading.previewAlt')"
        referrerpolicy="no-referrer"
      />
      <span v-else class="demo-logo demo-logo--fallback">
        {{ siteName.slice(0, 1) }}
      </span>
      <span class="demo-name">{{ siteName }}</span>
      <span v-if="slogan" class="demo-slogan">{{ slogan }}</span>
    </div>
    <p v-if="description" class="demo-desc">{{ description }}</p>
  </Card>

  <Card v-if="has('loading')" :bordered="true" size="small" class="rail-loading">
    <template #title>
      <div class="rail-card-title">
        <span>{{ $t('siteSettings.loading.previewTitle') }}</span>
        <small>{{ $t('siteSettings.loading.previewDescription') }}</small>
      </div>
    </template>
    <LoadingAnimationPreview
      :enabled="loadingEnabled"
      kind="splash"
      :preset="loadingPreset"
      :site-name="loadingSiteName"
      :url="loadingUrl"
    />
    <div class="rail-global">
      <h4>{{ $t('siteSettings.loading.globalPreviewTitle') }}</h4>
      <LoadingAnimationPreview :global-preset="globalPreset" kind="loading" />
    </div>
  </Card>

  <Card v-if="has('footer')" :bordered="true" size="small">
    <template #title>
      <div class="rail-card-title">
        <span>{{ $t('siteSettings.public.preview.footerTitle') }}</span>
        <small>{{ $t('siteSettings.public.preview.footerHint') }}</small>
      </div>
    </template>
    <div class="demo-footer">
      <p class="demo-footer-name">{{ siteName }}</p>
      <ul v-if="contactLines.length > 0">
        <li v-for="line in contactLines" :key="line.label">
          <span>{{ line.label }}</span>
          {{ line.value }}
        </li>
      </ul>
      <p v-if="repository" class="demo-repo">{{ repository }}</p>
      <p v-if="legalLines.length > 0" class="demo-legal">
        {{ legalLines.join(' · ') }}
      </p>
    </div>
  </Card>

  <Card v-if="has('share')" :bordered="true" size="small">
    <template #title>
      <div class="rail-card-title">
        <span>{{ $t('siteSettings.public.preview.shareTitle') }}</span>
        <small>{{ $t('siteSettings.public.preview.shareHint') }}</small>
      </div>
    </template>
    <div class="demo-share">
      <div
        v-if="shareImage"
        class="demo-share-image"
        :style="{ backgroundImage: `url(${shareImage})` }"
      ></div>
      <div v-else class="demo-share-image demo-share-image--empty">
        {{ $t('siteSettings.public.preview.emptyImage') }}
      </div>
      <div class="demo-share-body">
        <p class="demo-share-url">{{ shareUrl }}</p>
        <p class="demo-share-title">{{ shareTitle }}</p>
        <p class="demo-share-desc">{{ shareDescription }}</p>
      </div>
    </div>
  </Card>
</template>

<style scoped>
.rail-card-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-weight: 600;
  line-height: 1.4;
}

.rail-card-title small {
  font-size: 12px;
  font-weight: 400;
  color: hsl(var(--muted-foreground));
}

.rail-loading :deep(.loading-preview) {
  min-height: 160px;
}

.rail-loading :deep(.loading-preview .bp-sp),
.rail-loading :deep(.loading-preview .bp-ld) {
  min-height: 160px;
}

.rail-global {
  margin-top: 16px;
}

.rail-global h4 {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
}

.demo-header {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  padding: 12px;
  background: hsl(var(--accent) / 45%);
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
}

.demo-logo {
  width: 30px;
  height: 30px;
  object-fit: contain;
  border-radius: 8px;
}

.demo-logo--fallback {
  display: grid;
  font-size: 14px;
  font-weight: 700;
  color: hsl(var(--primary-foreground));
  background: hsl(var(--primary));
  place-items: center;
}

.demo-name {
  font-size: 15px;
  font-weight: 700;
}

.demo-slogan,
.demo-desc {
  margin: 0;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.demo-slogan {
  flex-basis: 100%;
}

.demo-desc {
  margin-top: 10px;
  line-height: 1.6;
}

.demo-footer {
  display: grid;
  gap: 10px;
  font-size: 12px;
}

.demo-footer-name {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
}

.demo-footer ul {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.demo-footer li {
  display: flex;
  gap: 8px;
  align-items: baseline;
}

.demo-footer li span {
  flex-shrink: 0;
  color: hsl(var(--muted-foreground));
}

.demo-repo,
.demo-legal {
  margin: 0;
  overflow-wrap: anywhere;
  color: hsl(var(--muted-foreground));
}

.demo-share {
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
}

.demo-share-image {
  height: 120px;
  background: hsl(var(--accent));
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
}

.demo-share-image--empty {
  display: grid;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  place-items: center;
}

.demo-share-body {
  padding: 10px 12px 12px;
}

.demo-share-url {
  margin: 0 0 4px;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
}

.demo-share-title {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 600;
}

.demo-share-desc {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
</style>
