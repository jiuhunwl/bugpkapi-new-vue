<script lang="ts" setup>
import { onMounted, ref } from 'vue';

import { Button, message } from 'ant-design-vue';

import { useVbenForm, z } from '#/adapter/form';
import {
  getAdminFriendLinkConfig,
  updateAdminFriendLinkConfig,
} from '#/api/friend-link';
import RichTextPreview from '#/components/rich-text-preview/index.vue';
import { $t } from '#/locales';

const emits = defineEmits<{ saved: [enabled: boolean] }>();

const loading = ref(false);
const updateTime = ref<null | string>(null);
const previewEnabled = ref(false);
const previewNotice = ref('');

const [ConfigForm, configFormApi] = useVbenForm({
  commonConfig: {
    colon: true,
    componentProps: { class: 'w-full' },
    formItemClass: 'col-span-1',
    labelWidth: 132,
  },
  handleValuesChange(values) {
    const notice = values.applyNotice;
    previewNotice.value = typeof notice === 'string' ? notice : '';
    previewEnabled.value = Boolean(values.applyEnabled);
  },
  layout: 'horizontal',
  schema: [
    {
      component: 'Switch',
      componentProps: {
        checkedChildren: $t('friendLinkReview.enabled'),
        class: 'w-auto',
        unCheckedChildren: $t('friendLinkReview.disabled'),
      },
      defaultValue: false,
      fieldName: 'applyEnabled',
      label: $t('friendLinkReview.hub.config.switchLabel'),
      help: $t('friendLinkReview.hub.config.switchHint'),
    },
    {
      // 原生富文本：支持换行/加粗/列表/链接/图片，前台原样渲染；历史纯文本自动兼容
      component: 'RichEditor',
      componentProps: {
        placeholder: $t('friendLinkReview.applyNotice.placeholder'),
      },
      fieldName: 'applyNotice',
      formItemClass: 'friend-link-notice-editor',
      label: $t('friendLinkReview.hub.config.noticeLabel'),
      rules: z.string().max(20_000),
    },
  ],
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 gap-x-4 gap-y-5',
});

async function loadConfig() {
  loading.value = true;
  try {
    const config = await getAdminFriendLinkConfig();
    updateTime.value = config.updateTime ?? null;
    previewEnabled.value = config.applyEnabled === 1;
    previewNotice.value = config.applyNotice ?? '';
    await configFormApi.setValues({
      applyEnabled: config.applyEnabled === 1,
      applyNotice: config.applyNotice ?? '',
    });
  } finally {
    loading.value = false;
  }
}

async function onSubmit() {
  const { valid } = await configFormApi.validate();
  if (!valid) return;
  const values = await configFormApi.getValues();
  loading.value = true;
  try {
    await updateAdminFriendLinkConfig({
      applyEnabled: values.applyEnabled ? 1 : 0,
      applyNotice: String(values.applyNotice ?? '').trim(),
    });
    message.success($t('friendLinkReview.hub.config.saved'));
    emits('saved', Boolean(values.applyEnabled));
    await loadConfig();
  } catch {
    message.error($t('friendLinkReview.messages.configFailed'));
  } finally {
    loading.value = false;
  }
}

onMounted(() => void loadConfig());
</script>

<template>
  <div class="fl-config">
    <section class="fl-config__panel">
      <header class="fl-config__head">
        <div class="min-w-0">
          <h2 class="fl-config__title">
            {{ $t('friendLinkReview.hub.config.title') }}
          </h2>
          <p class="fl-config__desc">
            {{ $t('friendLinkReview.hub.config.description') }}
          </p>
        </div>
        <span
          class="fl-config__state"
          :class="previewEnabled ? 'is-on' : 'is-off'"
        >
          <i class="fl-config__dot"></i>
          {{
            previewEnabled
              ? $t('friendLinkReview.hub.config.previewStatusOn')
              : $t('friendLinkReview.hub.config.previewStatusOff')
          }}
        </span>
      </header>

      <div class="fl-config__form">
        <ConfigForm :loading="loading" />
      </div>

      <footer class="fl-config__foot">
        <span v-if="updateTime" class="fl-config__time">
          {{ $t('friendLinkReview.hub.config.updatedAt', [updateTime]) }}
        </span>
        <span v-else class="fl-config__time">
          {{ $t('friendLinkReview.hub.config.notSaved') }}
        </span>
        <Button :loading="loading" type="primary" @click="onSubmit">
          {{ $t('friendLinkReview.save') }}
        </Button>
      </footer>
    </section>

    <aside class="fl-config__preview">
      <header class="fl-preview__head">
        <span class="fl-preview__eyebrow">PUBLIC APPLY</span>
        <h3 class="fl-preview__title">
          {{ $t('friendLinkReview.hub.config.previewTitle') }}
        </h3>
      </header>

      <div class="fl-preview__frame">
        <div class="fl-preview__bar">
          <i></i>
          <i></i>
          <i></i>
        </div>
        <div class="fl-preview__body">
          <span
            class="fl-preview__status"
            :class="previewEnabled ? 'is-on' : 'is-off'"
          >
            <i class="fl-preview__dot"></i>
            {{
              previewEnabled
                ? $t('friendLinkReview.hub.config.previewStatusOn')
                : $t('friendLinkReview.hub.config.previewStatusOff')
            }}
          </span>
          <strong class="fl-preview__heading">
            {{ $t('friendLinkReview.hub.config.previewHeading') }}
          </strong>
          <RichTextPreview
            v-if="previewNotice"
            class="fl-preview__notice"
            :content="previewNotice"
            :min-height="0"
          />
          <p v-else class="fl-preview__empty">
            {{ $t('friendLinkReview.hub.config.previewEmpty') }}
          </p>
        </div>
      </div>

      <p class="fl-preview__hint">
        {{ $t('friendLinkReview.hub.config.previewHint') }}
      </p>
    </aside>
  </div>
</template>

<style scoped>
.fl-config {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 330px;
  gap: 14px;
  height: 100%;
  min-height: 0;
}

.fl-config__panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 16px 18px;
  overflow-y: auto;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.fl-config__head {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  padding-bottom: 14px;
  margin-bottom: 4px;
  border-bottom: 1px solid hsl(var(--border));
}

.fl-config__title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.2px;
  color: hsl(var(--foreground));
}

.fl-config__desc {
  max-width: 64ch;
  margin: 4px 0 0;
  font-size: 12.5px;
  line-height: 1.65;
  color: hsl(var(--muted-foreground));
}

.fl-config__state {
  display: inline-flex;
  flex: none;
  gap: 6px;
  align-items: center;
  padding: 3px 10px;
  font-size: 11.5px;
  font-weight: 600;
  border-radius: 999px;
}

.fl-config__dot {
  width: 6px;
  height: 6px;
  background: currentColor;
  border-radius: 50%;
}

.fl-config__state.is-on {
  color: #047857;
  background: rgb(16 185 129 / 14%);
}

.fl-config__state.is-off {
  color: #b91c1c;
  background: rgb(244 63 94 / 12%);
}

.fl-config__form {
  flex: 1;
  min-height: 0;
  padding: 14px 0 4px;
}

.fl-config__foot {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding-top: 14px;
  margin-top: 10px;
  border-top: 1px solid hsl(var(--border));
}

.fl-config__time {
  font-size: 11.5px;
  color: hsl(var(--muted-foreground));
}

.fl-config__preview {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 16px 18px;
  overflow-y: auto;
  background:
    radial-gradient(
      420px 140px at 100% 0%,
      hsl(var(--primary) / 10%),
      transparent 70%
    ),
    hsl(var(--muted) / 30%);
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.fl-preview__eyebrow {
  font-size: 10px;
  font-weight: 700;
  color: hsl(var(--primary));
  letter-spacing: 0.14em;
}

.fl-preview__title {
  margin: 3px 0 0;
  font-size: 14px;
  font-weight: 700;
  color: hsl(var(--foreground));
}

.fl-preview__head {
  flex: none;
  margin-bottom: 12px;
}

.fl-preview__frame {
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
  box-shadow: 0 10px 28px rgb(0 0 0 / 6%);
}

.fl-preview__bar {
  display: flex;
  gap: 5px;
  padding: 8px 10px;
  background: hsl(var(--muted) / 50%);
  border-bottom: 1px solid hsl(var(--border));
}

.fl-preview__bar i {
  width: 7px;
  height: 7px;
  background: hsl(var(--border));
  border-radius: 50%;
}

.fl-preview__body {
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 14px;
}

.fl-preview__status {
  display: inline-flex;
  align-self: flex-start;
  gap: 5px;
  align-items: center;
  padding: 1px 8px;
  font-size: 10.5px;
  font-weight: 600;
  border-radius: 999px;
}

.fl-preview__dot {
  width: 5px;
  height: 5px;
  background: currentColor;
  border-radius: 50%;
}

.fl-preview__status.is-on {
  color: #047857;
  background: rgb(16 185 129 / 14%);
}

.fl-preview__status.is-off {
  color: #b91c1c;
  background: rgb(244 63 94 / 12%);
}

.fl-preview__heading {
  font-size: 13.5px;
  font-weight: 700;
  color: hsl(var(--foreground));
}

.fl-preview__notice {
  font-size: 12px;
  line-height: 1.75;
  color: hsl(var(--muted-foreground));
}

.fl-preview__empty {
  padding: 12px;
  margin: 0;
  font-size: 11.5px;
  line-height: 1.6;
  color: hsl(var(--muted-foreground));
  text-align: center;
  background: hsl(var(--muted) / 40%);
  border: 1px dashed hsl(var(--border));
  border-radius: 8px;
}

.fl-preview__hint {
  margin: 12px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: hsl(var(--muted-foreground));
}

:deep(.friend-link-notice-editor .vben-tiptap) {
  min-height: 220px;
}

:global(html.dark) .fl-config__state.is-on,
:global(html.dark) .fl-preview__status.is-on {
  color: #34d399;
}

:global(html.dark) .fl-config__state.is-off,
:global(html.dark) .fl-preview__status.is-off {
  color: #fb7185;
}

@media (max-width: 1100px) {
  .fl-config {
    grid-template-columns: minmax(0, 1fr);
    height: auto;
  }
}

@media (max-width: 640px) {
  .fl-config__panel,
  .fl-config__preview {
    padding: 14px;
  }
}
</style>
