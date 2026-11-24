<script setup lang="ts">
import type { PaymentConfigApi } from '#/api/system/payment';

import { computed, reactive, watch } from 'vue';

import {
  Alert,
  Button,
  Card,
  Collapse,
  CollapsePanel,
  Form,
  FormItem,
  Input,
  message,
  Select,
  Switch,
  Tag,
} from 'ant-design-vue';

import {
  updateWechatConfig,
  validateWechatConfig,
} from '#/api/system/payment';
import { $t } from '#/locales';

import { PAYMENT_NOTIFY_PATHS, suggestedNotifyUrl } from '../auto-fill';
import {
  buildWechatConfigPayload,
  createWechatConfigForm,
} from '../wechat-config-form';

interface Props {
  canUpdate: boolean;
  modelValue: PaymentConfigApi.WechatConfig;
}

const props = defineProps<Props>();
const emit = defineEmits<{ saved: [] }>();

const state = reactive(createWechatConfigForm(props.modelValue));
const busy = reactive({ save: false, validate: false });

watch(
  () => props.modelValue,
  (value) => {
    Object.assign(state, createWechatConfigForm(value));
    if (!String(state.notifyUrl ?? '').trim()) {
      state.notifyUrl = suggestedNotifyUrl(PAYMENT_NOTIFY_PATHS.wechat);
    }
  },
  { deep: true, immediate: true },
);

const statusText = computed(() =>
  state.enabled
    ? $t('system.payment.enabledTag')
    : $t('system.payment.disabledTag'),
);

async function validateChannel() {
  if (!props.canUpdate) return;
  busy.validate = true;
  try {
    await validateWechatConfig(buildWechatConfigPayload(state));
    message.success($t('system.payment.wechatValidateSuccess'));
  } finally {
    busy.validate = false;
  }
}

async function saveChannel() {
  if (!props.canUpdate) return;
  busy.save = true;
  try {
    await updateWechatConfig(buildWechatConfigPayload(state));
    message.success($t('system.payment.wechatSaveSuccess'));
    emit('saved');
  } finally {
    busy.save = false;
  }
}
</script>

<template>
  <Card class="wechat-card" :bordered="false">
    <template #title>
      <div class="wechat-card__title">
        <div>
          <strong>{{ $t('system.payment.wechatTitle') }}</strong>
          <p>{{ $t('system.payment.wechatDescription') }}</p>
        </div>
        <Tag :color="state.enabled ? 'success' : 'default'">
          {{ statusText }}
        </Tag>
      </div>
    </template>

    <Alert
      class="wechat-card__alert"
      show-icon
      type="info"
      :message="$t('system.payment.wechatSecurityTip')"
      :description="$t('system.payment.wechatSecurityDescription')"
    />

    <Form layout="vertical">
      <div class="wechat-card__grid">
        <FormItem :label="$t('system.payment.channelEnabled')">
          <Switch v-model:checked="state.enabled" :disabled="!canUpdate" />
        </FormItem>
        <FormItem :label="$t('system.payment.mode')">
          <Select
            v-model:value="state.mode"
            :disabled="!canUpdate"
            :options="[
              { label: $t('system.payment.sandboxMode'), value: 'SANDBOX' },
              { label: $t('system.payment.productionMode'), value: 'PRODUCTION' },
            ]"
          />
        </FormItem>
        <FormItem :label="$t('system.payment.wechatMchid')" required>
          <Input v-model:value="state.mchid" :disabled="!canUpdate" />
        </FormItem>
        <FormItem :label="$t('system.payment.appId')">
          <Input v-model:value="state.appId" :disabled="!canUpdate" />
        </FormItem>
        <FormItem :label="$t('system.payment.wechatSerialNo')" required>
          <Input v-model:value="state.serialNo" :disabled="!canUpdate" />
        </FormItem>
        <FormItem :label="$t('system.payment.notifyUrl')">
          <Input
            v-model:value="state.notifyUrl"
            :disabled="!canUpdate"
            :placeholder="$t('system.payment.notifyUrlAutoPlaceholder')"
          />
        </FormItem>
        <FormItem :label="$t('system.payment.wechatApiV3Key')" required>
          <Input.Password
            v-model:value="state.apiV3Key"
            :disabled="!canUpdate"
            :placeholder="$t('system.payment.secretRetainPlaceholder')"
          />
        </FormItem>
        <FormItem :label="$t('system.payment.wechatPrivateKey')" required>
          <Input.TextArea
            v-model:value="state.privateKey"
            :auto-size="{ minRows: 4, maxRows: 8 }"
            :disabled="!canUpdate"
            :placeholder="$t('system.payment.secretRetainPlaceholder')"
          />
        </FormItem>
        <FormItem :label="$t('system.payment.wechatPlatformKeyId')">
          <Input
            v-model:value="state.platformPublicKeyId"
            :disabled="!canUpdate"
          />
        </FormItem>
        <FormItem :label="$t('system.payment.wechatPlatformKey')">
          <Input.TextArea
            v-model:value="state.platformPublicKey"
            :auto-size="{ minRows: 3, maxRows: 7 }"
            :disabled="!canUpdate"
            :placeholder="$t('system.payment.secretRetainPlaceholder')"
          />
        </FormItem>
      </div>

      <Collapse class="wechat-card__advanced" ghost>
        <CollapsePanel key="advanced" :header="$t('system.payment.wechatAdvanced')">
          <div class="wechat-card__grid">
            <FormItem :label="$t('system.payment.wechatOaAppId')">
              <Input v-model:value="state.oaAppId" :disabled="!canUpdate" />
            </FormItem>
            <FormItem :label="$t('system.payment.wechatMiniAppId')">
              <Input v-model:value="state.miniAppId" :disabled="!canUpdate" />
            </FormItem>
            <FormItem :label="$t('system.payment.wechatAppAppId')">
              <Input v-model:value="state.appAppId" :disabled="!canUpdate" />
            </FormItem>
            <FormItem :label="$t('system.payment.wechatSpMchid')">
              <Input v-model:value="state.spMchid" :disabled="!canUpdate" />
            </FormItem>
            <FormItem :label="$t('system.payment.wechatSpAppId')">
              <Input v-model:value="state.spAppId" :disabled="!canUpdate" />
            </FormItem>
            <FormItem :label="$t('system.payment.wechatSubMchid')">
              <Input v-model:value="state.subMchid" :disabled="!canUpdate" />
            </FormItem>
            <FormItem :label="$t('system.payment.wechatSubAppId')">
              <Input v-model:value="state.subAppId" :disabled="!canUpdate" />
            </FormItem>
          </div>
        </CollapsePanel>
      </Collapse>
    </Form>

    <div v-if="canUpdate" class="wechat-card__actions">
      <Button :loading="busy.validate" @click="validateChannel">
        {{ $t('system.payment.validate') }}
      </Button>
      <Button type="primary" :loading="busy.save" @click="saveChannel">
        {{ $t('system.payment.save') }}
      </Button>
    </div>
  </Card>
</template>

<style scoped>
.wechat-card {
  border: 1px solid hsl(var(--border));
}

.wechat-card__title {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
}

.wechat-card__title strong {
  color: hsl(var(--foreground));
}

.wechat-card__title p {
  margin: 4px 0 0;
  font-size: 13px;
  font-weight: 400;
  color: hsl(var(--muted-foreground));
}

.wechat-card__alert {
  margin-bottom: 16px;
}

.wechat-card__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 16px;
}

.wechat-card__advanced {
  margin-top: 4px;
  border-top: 1px solid hsl(var(--border));
}

.wechat-card__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding-top: 16px;
  border-top: 1px solid hsl(var(--border));
}

@media (max-width: 900px) {
  .wechat-card__grid {
    grid-template-columns: 1fr;
  }
}
</style>
