<script lang="ts" setup>
import { onMounted, ref } from 'vue';

import { Button, message } from 'ant-design-vue';

import { useVbenForm, z } from '#/adapter/form';
import { getHomeNoticeConfig, updateHomeNoticeConfig } from '#/api/notice/home-notice';
import { $t } from '#/locales';

const emits = defineEmits<{ saved: [] }>();

const loading = ref(false);
const noticeId = ref<null | string>(null);
const updateTime = ref<null | string>(null);

const [NoticeForm, noticeFormApi] = useVbenForm({
  commonConfig: { colon: true, componentProps: { class: 'w-full' }, formItemClass: 'col-span-1', labelWidth: 112 },
  layout: 'horizontal',
  schema: [
    {
      component: 'Switch',
      componentProps: { checkedChildren: $t('homeNotice.enabled'), class: 'w-auto', unCheckedChildren: $t('homeNotice.disabled') },
      defaultValue: false,
      fieldName: 'enabled',
      label: $t('homeNotice.fields.enabled'),
    },
    {
      component: 'Textarea',
      componentProps: { maxlength: 300, placeholder: $t('homeNotice.placeholder'), rows: 4, showCount: true },
      fieldName: 'content',
      label: $t('homeNotice.fields.content'),
      rules: z.string().max(300, $t('homeNotice.validation.maxLength')),
    },
  ],
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 gap-x-4 gap-y-2',
});

async function loadConfig() {
  loading.value = true;
  try {
    const config = await getHomeNoticeConfig();
    noticeId.value = config.noticeId ?? null;
    updateTime.value = config.updateTime ?? null;
    await noticeFormApi.setValues({ content: config.content ?? '', enabled: config.enabled === 1 });
  } finally { loading.value = false; }
}

async function onSubmit() {
  const { valid } = await noticeFormApi.validate();
  if (!valid) return;
  const values = await noticeFormApi.getValues();
  const content = String(values.content ?? '').trim();
  if (values.enabled && !content) {
    message.warning($t('homeNotice.validation.requiredWhenEnabled'));
    return;
  }
  loading.value = true;
  try {
    await updateHomeNoticeConfig({ content, enabled: values.enabled ? 1 : 0 });
    message.success($t('homeNotice.saved'));
    await loadConfig();
    emits('saved');
  } finally { loading.value = false; }
}

onMounted(() => void loadConfig());
</script>

<template>
  <div class="nh-ticker">
    <header class="nh-ticker__head">
      <h2 class="nh-ticker__title">{{ $t('homeNotice.title') }}</h2>
      <p class="nh-ticker__desc">{{ $t('homeNotice.description') }}</p>
    </header>
    <NoticeForm />
    <footer class="nh-ticker__foot">
      <div class="nh-ticker__meta">
        <span>{{ $t('homeNotice.lastUpdated', [updateTime || $t('homeNotice.never')]) }}</span>
        <span v-if="noticeId">{{ $t('homeNotice.storedAsNotice', [noticeId]) }}</span>
      </div>
      <Button type="primary" :loading="loading" @click="onSubmit">{{ $t('homeNotice.save') }}</Button>
    </footer>
  </div>
</template>

<style scoped>
.nh-ticker {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.nh-ticker__head {
  flex: none;
}

.nh-ticker__title {
  font-size: 15px;
  font-weight: 700;
  color: hsl(var(--foreground));
}

.nh-ticker__desc {
  margin-top: 4px;
  font-size: 12.5px;
  color: hsl(var(--muted-foreground));
}

.nh-ticker__foot {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding-top: 12px;
  margin-top: 4px;
  border-top: 1px solid hsl(var(--border));
}

.nh-ticker__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  font-size: 12.5px;
  color: hsl(var(--muted-foreground));
}
</style>
