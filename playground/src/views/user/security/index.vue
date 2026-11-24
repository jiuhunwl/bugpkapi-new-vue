<script lang="ts" setup>
import type { AuthApi } from '#/api';

import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import {
  Alert,
  Button,
  Card,
  Input,
  message,
  QRCode,
  Space,
  Tag,
  Typography,
} from 'ant-design-vue';

import {
  disableTwoFAApi,
  enableTwoFAApi,
  getTwoFAStatusApi,
  regenerateTwoFARecoveryCodesApi,
  setupTwoFAApi,
} from '#/api';
import { $t } from '#/locales';

defineOptions({ name: 'UserSecuritySettings' });

const router = useRouter();

type Phase = 'idle' | 'binding' | 'recovery' | 'disabling' | 'regenerating';

const loading = ref(false);
const submitting = ref(false);
const status = ref<AuthApi.TwoFAStatusResult | null>(null);
const phase = ref<Phase>('idle');

// 绑定流程数据
const bindingSecret = ref('');
const bindingOtpauthUrl = ref('');
const bindingCode = ref('');
// 关闭 / 重生成流程数据
const confirmPassword = ref('');
const confirmCode = ref('');
// 恢复码展示
const recoveryCodes = ref<string[]>([]);

const text = (key: string, args?: string[]) =>
  args
    ? $t(`page.auth.security.${key}`, args)
    : $t(`page.auth.security.${key}`);

async function loadStatus() {
  loading.value = true;
  try {
    status.value = await getTwoFAStatusApi();
  } catch {
    message.error(text('loadFailed'));
  } finally {
    loading.value = false;
  }
}

function backToIdle() {
  phase.value = 'idle';
  bindingSecret.value = '';
  bindingOtpauthUrl.value = '';
  bindingCode.value = '';
  confirmPassword.value = '';
  confirmCode.value = '';
  recoveryCodes.value = [];
}

async function startBinding() {
  submitting.value = true;
  try {
    const result = await setupTwoFAApi();
    bindingSecret.value = result.secret;
    bindingOtpauthUrl.value = result.otpauthUrl;
    phase.value = 'binding';
  } catch {
    message.error(text('setupFailed'));
  } finally {
    submitting.value = false;
  }
}

function copyRecoveryCodes() {
  void navigator.clipboard.writeText(recoveryCodes.value.join('\n'));
  message.success(text('recoveryCopied'));
}

async function confirmBinding() {
  if (submitting.value) return;
  submitting.value = true;
  try {
    const result = await enableTwoFAApi(bindingCode.value.trim());
    recoveryCodes.value = result.recoveryCodes ?? [];
    phase.value = 'recovery';
    await loadStatus();
  } finally {
    submitting.value = false;
  }
}

async function finishRecovery() {
  backToIdle();
  await loadStatus();
}

async function confirmDisable() {
  if (submitting.value) return;
  submitting.value = true;
  try {
    await disableTwoFAApi(confirmPassword.value, confirmCode.value.trim());
    message.success(text('statusDisabled'));
    backToIdle();
    await loadStatus();
  } finally {
    submitting.value = false;
  }
}

async function confirmRegenerate() {
  if (submitting.value) return;
  submitting.value = true;
  try {
    const result = await regenerateTwoFARecoveryCodesApi(
      confirmPassword.value,
      confirmCode.value.trim(),
    );
    recoveryCodes.value = result.recoveryCodes ?? [];
    phase.value = 'recovery';
    await loadStatus();
  } finally {
    submitting.value = false;
  }
}

function askDisable() {
  backToIdle();
  phase.value = 'disabling';
}

function askRegenerate() {
  backToIdle();
  phase.value = 'regenerating';
}

onMounted(() => {
  void loadStatus();
});

// 路由守卫之外的兜底：会话过期时 2FA 接口会 401，让全局拦截器处理。
void router;
</script>

<template>
  <div class="p-4 md:p-6">
    <Typography.Title :level="4">{{ text('title') }}</Typography.Title>
    <Typography.Paragraph type="secondary">
      {{ text('subtitle') }}
    </Typography.Paragraph>

    <!-- 状态卡 -->
    <Card :loading="loading" v-if="phase === 'idle' && status">
      <div class="flex flex-col gap-4">
        <div class="flex items-center gap-3">
          <Tag :color="status.enabled ? 'green' : 'red'">
            {{ status.enabled ? text('statusEnabled') : text('statusDisabled') }}
          </Tag>
          <span class="text-sm">
            {{
              status.enabled
                ? text('statusEnabledDesc')
                : text('statusDisabledDesc')
            }}
          </span>
        </div>

        <div v-if="status.enabled" class="flex flex-col gap-2">
          <Alert
            v-if="status.recoveryCodesRemaining === 0"
            show-icon
            type="warning"
            :message="text('recoveryNone')"
          />
          <span class="text-muted-foreground text-sm">
            {{
              text('recoveryRemaining', [String(status.recoveryCodesRemaining)])
            }}
          </span>
          <Space wrap>
            <Button type="primary" @click="askRegenerate">
              {{ text('regenerateBtn') }}
            </Button>
            <Button danger @click="askDisable">
              {{ text('disableBtn') }}
            </Button>
          </Space>
        </div>

        <div v-else>
          <Button type="primary" :loading="submitting" @click="startBinding">
            {{ text('enableBtn') }}
          </Button>
        </div>
      </div>
    </Card>

    <!-- 绑定：扫码 + 确认码 -->
    <Card v-if="phase === 'binding'" :title="text('enableBtn')">
      <div class="flex flex-col items-center gap-5 md:flex-row md:items-start">
        <div class="flex flex-col items-center gap-2">
          <QRCode
            :bordered="true"
            error-level="H"
            :size="200"
            :value="bindingOtpauthUrl"
          />
        </div>
        <div class="flex-1">
          <Typography.Title :level="5">
            {{ text('step1Title') }}
          </Typography.Title>
          <Typography.Paragraph type="secondary">
            {{ text('step1Desc') }}
          </Typography.Paragraph>
          <div class="mb-4">
            <Typography.Text type="secondary">
              {{ text('secretLabel') }}
            </Typography.Text>
            <Typography.Paragraph copyable class="font-mono">
              {{ bindingSecret }}
            </Typography.Paragraph>
          </div>
          <Typography.Title :level="5">
            {{ text('step2Title') }}
          </Typography.Title>
          <Space.Compact class="w-full max-w-sm">
            <Input
              v-model:value="bindingCode"
              :maxlength="6"
              :placeholder="text('codePlaceholder')"
              inputmode="numeric"
              @keydown.enter="confirmBinding"
            />
            <Button
              type="primary"
              :loading="submitting"
              @click="confirmBinding"
            >
              {{ text('confirmBtn') }}
            </Button>
          </Space.Compact>
        </div>
      </div>
      <div class="mt-4">
        <Button @click="backToIdle">{{ text('cancelBtn') }}</Button>
      </div>
    </Card>

    <!-- 恢复码一次性展示 -->
    <Card v-if="phase === 'recovery'" :title="text('recoveryTitle')">
      <Alert
        class="mb-4"
        show-icon
        type="success"
        :message="text('recoveryTitle')"
        :description="text('recoveryDesc')"
      />
      <div class="grid grid-cols-2 gap-2 md:grid-cols-5">
        <span
          v-for="code in recoveryCodes"
          :key="code"
          class="bg-muted rounded px-2 py-1 text-center font-mono text-sm"
        >
          {{ code }}
        </span>
      </div>
      <Space class="mt-5" wrap>
        <Button @click="copyRecoveryCodes">{{ text('recoveryCopy') }}</Button>
        <Button type="primary" @click="finishRecovery">
          {{ text('recoveryDone') }}
        </Button>
      </Space>
    </Card>

    <!-- 关闭 2FA / 重生成恢复码：密码 + 验证码双确认 -->
    <Card
      v-if="phase === 'disabling' || phase === 'regenerating'"
      :title="phase === 'disabling' ? text('disableTitle') : text('regenerateBtn')"
    >
      <div class="max-w-md space-y-4">
        <Alert
          show-icon
          :type="phase === 'disabling' ? 'warning' : 'info'"
          :message="phase === 'disabling' ? text('disableDesc') : text('statusEnabledDesc')"
        />
        <div>
          <Typography.Text type="secondary">
            {{ text('passwordLabel') }}
          </Typography.Text>
          <Input.Password
            v-model:value="confirmPassword"
            class="mt-1"
            autocomplete="current-password"
          />        </div>
        <div>
          <Typography.Text type="secondary">
            {{ text('codeLabel') }}
          </Typography.Text>
          <Input
            v-model:value="confirmCode"
            class="mt-1"
            :maxlength="11"
            :placeholder="text('codePlaceholder')"
            @keydown.enter="
              phase === 'disabling' ? confirmDisable() : confirmRegenerate()
            "
          />
        </div>
        <Space>
          <Button
            danger
            v-if="phase === 'disabling'"
            type="primary"
            :loading="submitting"
            @click="confirmDisable"
          >
            {{ text('confirmDisable') }}
          </Button>
          <Button
            v-else
            type="primary"
            :loading="submitting"
            @click="confirmRegenerate"
          >
            {{ text('regenerateBtn') }}
          </Button>
          <Button @click="backToIdle">{{ text('cancelBtn') }}</Button>
        </Space>
      </div>
    </Card>
  </div>
</template>
