<script setup lang="ts">
import type { ImageHostConfigApi } from '#/api/system/image-host';

import { computed, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { useAccessStore, useUserStore } from '@vben/stores';

import {
  Alert,
  Button,
  Card,
  Form,
  FormItem,
  Input,
  InputNumber,
  message,
  Select,
  Switch,
  Tag,
} from 'ant-design-vue';

import {
  getImageHostConfigApi,
  saveImageHostConfigApi,
  testImageHostConfigApi,
} from '#/api/system/image-host';
import { $t } from '#/locales';

defineOptions({ name: 'SystemImageHostConfig' });

const MIB = 1024 * 1024;

const loading = ref(true);
const saving = ref(false);
const testing = ref(false);
const testResult = ref('');
const accessStore = useAccessStore();
const userStore = useUserStore();
const isAdmin = computed(() => userStore.userRoles.includes('admin'));
const canUpdate = computed(
  () =>
    isAdmin.value ||
    accessStore.accessCodes.includes('system:image-host:update'),
);
const canTest = computed(
  () =>
    isAdmin.value || accessStore.accessCodes.includes('system:image-host:test'),
);

const form = reactive<ImageHostConfigApi.Config>({
  authCode: '',
  baseUrl: '',
  enabled: 0,
  folder: '',
  maxBytes: 10 * MIB,
  provider: 'cloudflare-imgbed',
  uploadChannel: '',
  uploadPath: '/upload',
});

const maxMegabytes = computed({
  get: () => Math.max(1, Math.round(form.maxBytes / MIB)),
  set: (value: number | null) => {
    form.maxBytes = Math.max(1, Math.min(10, Number(value) || 1)) * MIB;
  },
});

const channelOptions = computed(() => [
  { label: $t('imageHostConfig.channelAuto'), value: '' },
  { label: $t('imageHostConfig.channelTelegram'), value: 'telegram' },
  { label: $t('imageHostConfig.channelCfr2'), value: 'cfr2' },
  { label: $t('imageHostConfig.channelS3'), value: 's3' },
  { label: $t('imageHostConfig.channelDiscord'), value: 'discord' },
  { label: $t('imageHostConfig.channelHuggingFace'), value: 'huggingface' },
  { label: $t('imageHostConfig.channelWebDAV'), value: 'webdav' },
  { label: $t('imageHostConfig.channelExternal'), value: 'external' },
]);

function payload(): ImageHostConfigApi.Config {
  return {
    ...form,
    baseUrl: form.baseUrl.trim(),
    folder: form.folder.trim().replace(/^\/+|\/+$/g, ''),
    uploadPath: form.uploadPath.trim() || '/upload',
  };
}

function validate(): boolean {
  if (form.enabled === 1 && !form.baseUrl.trim()) {
    message.error($t('imageHostConfig.invalidEnabled'));
    return false;
  }
  return true;
}

async function load() {
  loading.value = true;
  try {
    const cfg = await getImageHostConfigApi();
    Object.assign(form, cfg);
    if (!form.uploadPath) form.uploadPath = '/upload';
    if (!form.provider) form.provider = 'cloudflare-imgbed';
    if (!form.maxBytes) form.maxBytes = 10 * MIB;
  } catch {
    message.error($t('imageHostConfig.loadFailed'));
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (!validate() || !canUpdate.value) return;
  saving.value = true;
  try {
    await saveImageHostConfigApi(payload());
    message.success($t('imageHostConfig.saveSuccess'));
    await load();
  } finally {
    saving.value = false;
  }
}

async function testUpload() {
  if (!validate() || !canTest.value) return;
  testing.value = true;
  testResult.value = '';
  try {
    const result = await testImageHostConfigApi(payload());
    testResult.value = result.url;
    message.success($t('imageHostConfig.testSuccess'));
  } finally {
    testing.value = false;
  }
}

onMounted(load);
</script>

<template>
  <Page :title="$t('imageHostConfig.title')" auto-content-height>
    <Card :loading="loading" class="mb-4">
      <template #title>{{ $t('imageHostConfig.current') }}</template>
      <Alert
        class="mb-4"
        show-icon
        type="info"
        :message="$t('imageHostConfig.description')"
      />
      <Form layout="vertical" style="max-width: 640px">
        <FormItem :label="$t('imageHostConfig.enabled')">
          <Switch
            :checked="form.enabled === 1"
            :disabled="!canUpdate"
            @change="form.enabled = $event ? 1 : 0"
          />
          <div class="form-hint">{{ $t('imageHostConfig.enabledHint') }}</div>
        </FormItem>

        <FormItem :label="$t('imageHostConfig.provider')">
          <Tag color="blue">CloudFlare-ImgBed</Tag>
          <div class="form-hint">
            https://github.com/MarSeventh/CloudFlare-ImgBed
          </div>
        </FormItem>

        <FormItem
          :label="$t('imageHostConfig.baseUrl')"
          :extra="$t('imageHostConfig.baseUrlHint')"
          required
        >
          <Input
            v-model:value="form.baseUrl"
            :disabled="!canUpdate"
            placeholder="https://img.example.com"
          />
        </FormItem>

        <FormItem
          :label="$t('imageHostConfig.uploadPath')"
          :extra="$t('imageHostConfig.uploadPathHint')"
        >
          <Input v-model:value="form.uploadPath" :disabled="!canUpdate" />
        </FormItem>

        <FormItem
          :label="$t('imageHostConfig.authCode')"
          :extra="$t('imageHostConfig.authCodeHint')"
        >
          <Input.Password
            v-model:value="form.authCode"
            :disabled="!canUpdate"
            :placeholder="
              form.authCode === '******'
                ? '******'
                : $t('imageHostConfig.authCodePlaceholder')
            "
            autocomplete="new-password"
          />
        </FormItem>

        <FormItem
          :label="$t('imageHostConfig.channel')"
          :extra="$t('imageHostConfig.channelHint')"
        >
          <Select
            v-model:value="form.uploadChannel"
            :disabled="!canUpdate"
            :options="channelOptions"
          />
        </FormItem>

        <FormItem
          :label="$t('imageHostConfig.folder')"
          :extra="$t('imageHostConfig.folderHint')"
        >
          <Input
            v-model:value="form.folder"
            :disabled="!canUpdate"
            placeholder="tickets"
          />
        </FormItem>

        <FormItem
          :label="$t('imageHostConfig.maxBytes')"
          :extra="$t('imageHostConfig.maxBytesHint')"
        >
          <InputNumber
            v-model:value="maxMegabytes"
            :disabled="!canUpdate"
            :max="10"
            :min="1"
            :precision="0"
            style="width: 180px"
          >
            <template #addonAfter>
              {{ $t('imageHostConfig.maxBytesUnit') }}
            </template>
          </InputNumber>
        </FormItem>

        <Alert
          v-if="testResult"
          class="mb-4"
          show-icon
          type="success"
          :message="$t('imageHostConfig.testResult')"
        >
          <template #description>
            <a :href="testResult" rel="noopener noreferrer" target="_blank">
              {{ testResult }}
            </a>
          </template>
        </Alert>

        <div class="form-actions">
          <Button
            :disabled="!canTest"
            :loading="testing"
            @click="testUpload"
          >
            {{ testing ? $t('imageHostConfig.testing') : $t('imageHostConfig.test') }}
          </Button>
          <Button
            :disabled="!canUpdate"
            :loading="saving"
            type="primary"
            @click="save"
          >
            {{ $t('imageHostConfig.save') }}
          </Button>
        </div>
        <div class="form-hint">{{ $t('imageHostConfig.testHint') }}</div>
      </Form>
    </Card>
  </Page>
</template>

<style scoped>
.form-hint {
  margin-top: 4px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.form-actions {
  display: flex;
  gap: 10px;
}
</style>
