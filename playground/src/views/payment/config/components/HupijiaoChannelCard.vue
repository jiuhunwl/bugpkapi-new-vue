<script setup lang="ts">
import type { PaymentConfigApi } from '#/api/system/payment';

import { computed, reactive, watch } from 'vue';

import { Button, Card, Collapse, CollapsePanel, Form, FormItem, Input, message, Switch, Tag } from 'ant-design-vue';

import {
  updateHupijiaoConfig,
  validateHupijiaoConfig,
} from '#/api/system/payment';
import { $t } from '#/locales';

import {
  PAYMENT_NOTIFY_PATHS,
  suggestedNotifyUrl,
  suggestedReturnUrl,
} from '../auto-fill';

interface Props {
  canUpdate: boolean;
  modelValue: PaymentConfigApi.HupijiaoChannelConfig;
  title: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{ saved: [] }>();

const state = reactive<PaymentConfigApi.HupijiaoChannelConfig>({
  ...props.modelValue,
});
const busy = reactive({ save: false, validate: false });

watch(
  () => props.modelValue,
  (value) => {
    Object.assign(state, value);
    if (!state.notifyUrl?.trim()) {
      state.notifyUrl = suggestedNotifyUrl(
        PAYMENT_NOTIFY_PATHS.hupijiao(state.method),
      );
    }
    if (!state.returnUrl?.trim()) {
      state.returnUrl = suggestedReturnUrl();
    }
  },
  { deep: true, immediate: true },
);

const channelLabel = computed(() =>
  state.method === 'WECHAT'
    ? $t('system.payment.hupijiaoWechatTitle')
    : $t('system.payment.hupijiaoAlipayTitle'),
);

const advancedKeys = computed(() => [`hupijiao-advanced-${state.method}`]);

function payload(): PaymentConfigApi.HupijiaoChannelConfig {
  return {
    ...state,
    appId: state.appId.trim(),
    appSecret: state.appSecret?.trim(),
    callbackUrl: state.callbackUrl?.trim(),
    createUrl: state.createUrl.trim(),
    notifyUrl: state.notifyUrl?.trim(),
    queryUrl: state.queryUrl.trim(),
    returnUrl: state.returnUrl?.trim(),
    wapName: state.wapName?.trim(),
    wapUrl: state.wapUrl?.trim(),
  };
}

async function validateChannel() {
  if (!props.canUpdate) return;
  busy.validate = true;
  try {
    await validateHupijiaoConfig(payload());
    message.success(
      $t('system.payment.hupijiaoValidateSuccess', [channelLabel.value]),
    );
  } finally {
    busy.validate = false;
  }
}

async function saveChannel() {
  if (!props.canUpdate) return;
  busy.save = true;
  try {
    await updateHupijiaoConfig(payload());
    message.success(
      $t('system.payment.hupijiaoSaveSuccess', [channelLabel.value]),
    );
    emit('saved');
  } finally {
    busy.save = false;
  }
}
</script>

<template>
  <Card class="hupijiao-card" :bordered="true">
    <template #title>
      <div class="hupijiao-card__title">
        <span>{{ title }}</span>
        <Tag :color="state.enabled ? 'success' : 'default'">
          {{ state.enabled ? $t('system.payment.enabledTag') : $t('system.payment.disabledTag') }}
        </Tag>
      </div>
    </template>

    <p class="hupijiao-card__hint">{{ $t('system.payment.hupijiaoBasicHint') }}</p>

    <Form layout="vertical">
      <div class="hupijiao-card__grid">
        <FormItem :label="$t('system.payment.channelEnabled')">
          <Switch v-model:checked="state.enabled" :disabled="!canUpdate" />
        </FormItem>
        <FormItem label="AppID" required>
          <Input v-model:value="state.appId" :disabled="!canUpdate" />
        </FormItem>
        <FormItem label="AppSecret">
          <Input.Password
            v-model:value="state.appSecret"
            :disabled="!canUpdate"
            :placeholder="$t('system.payment.secretRetainPlaceholder')"
          />
        </FormItem>
        <FormItem :label="$t('system.payment.notifyUrl')" required>
          <Input
            v-model:value="state.notifyUrl"
            :disabled="!canUpdate"
            :placeholder="$t('system.payment.notifyUrlAutoPlaceholder')"
          />
        </FormItem>
      </div>
    </Form>

    <Collapse class="hupijiao-card__advanced" ghost>
      <CollapsePanel :key="advancedKeys[0]" :force-render="true">
        <template #header>
          <span class="hupijiao-card__advanced-title">
            {{ $t('system.payment.hupijiaoAdvanced') }}
          </span>
        </template>
        <Form layout="vertical">
          <div class="hupijiao-card__grid">
            <FormItem :label="$t('system.payment.hupijiaoCreateUrl')">
              <Input
                v-model:value="state.createUrl"
                :disabled="!canUpdate"
                :placeholder="$t('system.payment.hupijiaoCreateUrlPlaceholder')"
              />
            </FormItem>
            <FormItem :label="$t('system.payment.hupijiaoQueryUrl')">
              <Input
                v-model:value="state.queryUrl"
                :disabled="!canUpdate"
                :placeholder="$t('system.payment.hupijiaoQueryUrlPlaceholder')"
              />
            </FormItem>
            <FormItem :label="$t('system.payment.returnUrl')">
              <Input v-model:value="state.returnUrl" :disabled="!canUpdate" />
            </FormItem>
            <FormItem :label="$t('system.payment.hupijiaoCallbackUrl')">
              <Input v-model:value="state.callbackUrl" :disabled="!canUpdate" />
            </FormItem>
            <template v-if="state.method === 'WECHAT'">
              <FormItem :label="$t('system.payment.hupijiaoWapUrl')">
                <Input v-model:value="state.wapUrl" :disabled="!canUpdate" />
              </FormItem>
              <FormItem :label="$t('system.payment.hupijiaoWapName')">
                <Input v-model:value="state.wapName" :disabled="!canUpdate" />
              </FormItem>
            </template>
          </div>
        </Form>
      </CollapsePanel>
    </Collapse>

    <div v-if="canUpdate" class="hupijiao-card__actions">
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
.hupijiao-card__title,
.hupijiao-card__actions {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}

.hupijiao-card__hint {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 20px;
  color: rgb(100 116 139);
}

.hupijiao-card__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 16px;
}

.hupijiao-card__advanced {
  margin: 0 0 8px;
}

.hupijiao-card__advanced-title {
  font-size: 13px;
  color: rgb(100 116 139);
}

.hupijiao-card__actions {
  justify-content: flex-end;
  padding-top: 8px;
  border-top: 1px solid hsl(var(--border));
}

@media (max-width: 900px) {
  .hupijiao-card__grid {
    grid-template-columns: 1fr;
  }
}
</style>
