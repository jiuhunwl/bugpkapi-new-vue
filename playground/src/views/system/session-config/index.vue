<script lang="ts" setup>
import type { SessionConfigApi } from '#/api/system/session';

import { computed, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  Form,
  FormItem,
  InputNumber,
  message,
  Spin,
} from 'ant-design-vue';

import { getSessionConfigApi, saveSessionConfigApi } from '#/api/system/session';
import { $t } from '#/locales';

defineOptions({ name: 'SystemSessionConfig' });

const loading = ref(true);
const saving = ref(false);
const form = reactive<SessionConfigApi.Config>({
  accessTokenMinutes: 30,
  refreshTokenDays: 7,
});

// refresh 天数换算成分钟必须大于 access 分钟数，否则出现令牌倒挂。
const refreshAfterAccess = computed(
  () => form.refreshTokenDays * 24 * 60 > form.accessTokenMinutes,
);

async function load() {
  loading.value = true;
  try {
    const cfg = await getSessionConfigApi();
    form.accessTokenMinutes = cfg.accessTokenMinutes;
    form.refreshTokenDays = cfg.refreshTokenDays;
  } catch {
    message.error($t('sessionConfig.loadFailed'));
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  try {
    await saveSessionConfigApi({ ...form });
    message.success($t('sessionConfig.saveSuccess'));
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <Page :title="$t('sessionConfig.title')" auto-content-height>
    <Card :loading="loading" class="mb-4">
      <template #title>{{ $t('sessionConfig.current') }}</template>
      <Alert
        class="mb-4"
        show-icon
        type="info"
        :message="$t('sessionConfig.description')"
      />
      <Form layout="vertical" style="max-width: 480px">
        <FormItem
          :label="$t('sessionConfig.accessTokenMinutes')"
          :extra="$t('sessionConfig.accessTokenMinutesHint')"
        >
          <InputNumber
            v-model:value="form.accessTokenMinutes"
            :min="5"
            :max="1440"
            :precision="0"
            style="width: 200px"
          >
            <template #addonAfter>{{ $t('sessionConfig.accessUnit') }}</template>
          </InputNumber>
        </FormItem>
        <FormItem
          :label="$t('sessionConfig.refreshTokenDays')"
          :extra="$t('sessionConfig.refreshTokenDaysHint')"
        >
          <InputNumber
            v-model:value="form.refreshTokenDays"
            :min="1"
            :max="365"
            :precision="0"
            style="width: 200px"
          >
            <template #addonAfter>{{ $t('sessionConfig.refreshUnit') }}</template>
          </InputNumber>
        </FormItem>
        <Alert
          v-if="!refreshAfterAccess"
          class="mb-4"
          show-icon
          type="warning"
          :message="$t('sessionConfig.effectiveHint')"
        />
        <Button
          type="primary"
          :loading="saving"
          :disabled="!refreshAfterAccess"
          @click="save"
        >
          {{ $t('sessionConfig.save') }}
        </Button>
      </Form>
      <Spin v-if="loading" />
    </Card>
  </Page>
</template>
