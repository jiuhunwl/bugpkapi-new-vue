<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef } from 'vue';

import { useUserStore } from '@vben/stores';

import {
  Button,
  Descriptions,
  Form,
  FormItem,
  Input,
  message,
  Tag,
} from 'ant-design-vue';

import {
  bindEmailApi,
  getRegisterConfigApi,
  getUserInfoApi,
  sendBindEmailCodeApi,
  updateProfileApi,
} from '#/api';
import { $t } from '#/locales';

const userStore = useUserStore();
const emailChannelEnabled = shallowRef(false);
const realName = shallowRef('');
const username = shallowRef('');
const avatar = shallowRef('');
const email = shallowRef('');
const mobile = shallowRef('');
const roles = shallowRef<string[]>([]);
const saving = shallowRef(false);
const emailEditing = shallowRef(false);
const bindEmail = shallowRef('');
const emailCode = shallowRef('');
const emailSending = shallowRef(false);
const emailCountdown = shallowRef(0);
const emailVerifying = shallowRef(false);

let emailTimer: null | ReturnType<typeof setInterval> = null;
function clearEmailTimer() {
  if (emailTimer) clearInterval(emailTimer);
  emailTimer = null;
}

function startEmailCountdown() {
  clearEmailTimer();
  emailCountdown.value = 60;
  const timer = setInterval(() => {
    emailCountdown.value -= 1;
    if (emailCountdown.value <= 0) clearEmailTimer();
  }, 1000);
  emailTimer = timer;
}

function mapRoleLabel(role: string) {
  const key = `profile.roles.${role}`;
  const label = $t(key);
  return label === key ? role : label;
}

function loadData(data: any) {
  username.value = data.username || '';
  realName.value = data.realName || '';
  avatar.value = data.avatar || '';
  email.value = data.email || '';
  mobile.value = data.mobile || '';
  roles.value = data.roles || [];
}

async function handleSaveProfile() {
  if (!realName.value.trim()) {
    message.warning($t('profile.messages.nameRequired'));
    return;
  }
  saving.value = true;
  try {
    const updated = await updateProfileApi({
      avatar: avatar.value,
      realName: realName.value.trim(),
    });
    userStore.setUserInfo(updated);
    message.success($t('profile.messages.saved'));
  } finally {
    saving.value = false;
  }
}

function startEmailEdit() {
  bindEmail.value = '';
  emailCode.value = '';
  emailEditing.value = true;
}

async function handleSendEmailCode() {
  if (!bindEmail.value.trim()) {
    message.warning($t('profile.messages.emailRequired'));
    return;
  }
  emailSending.value = true;
  try {
    await sendBindEmailCodeApi(bindEmail.value.trim());
    message.success($t('profile.messages.codeSent'));
    startEmailCountdown();
  } finally {
    emailSending.value = false;
  }
}

async function handleVerifyEmail() {
  if (!emailCode.value.trim()) {
    message.warning($t('profile.messages.codeRequired'));
    return;
  }
  emailVerifying.value = true;
  try {
    const updated = await bindEmailApi(
      bindEmail.value.trim(),
      emailCode.value.trim(),
    );
    userStore.setUserInfo(updated);
    email.value = bindEmail.value.trim();
    emailEditing.value = false;
    message.success($t('profile.messages.emailBound'));
  } finally {
    emailVerifying.value = false;
  }
}

onMounted(async () => {
  const [data, config] = await Promise.all([
    getUserInfoApi(),
    getRegisterConfigApi().catch(() => ({
      emailRegisterEnabled: false,
      emailServiceEnabled: false,
      mobileRegisterEnabled: false,
    })),
  ]);
  emailChannelEnabled.value = !!(
    (config as any).emailServiceEnabled ?? (config as any).emailRegisterEnabled
  );
  loadData(data);
});

onBeforeUnmount(() => {
  clearEmailTimer();
});
</script>

<template>
  <div class="profile-basic text-foreground">
    <section>
      <h2>{{ $t('profile.tabs.basic') }}</h2>
      <Descriptions bordered :column="1" size="small">
        <Descriptions.Item :label="$t('profile.fields.username')">
          {{ username }}
        </Descriptions.Item>
        <Descriptions.Item :label="$t('profile.fields.roles')">
          <div class="flex flex-wrap gap-1">
            <Tag v-for="role in roles" :key="role">
              {{ mapRoleLabel(role) }}
            </Tag>
          </div>
        </Descriptions.Item>
      </Descriptions>

      <Form class="profile-form" layout="vertical">
        <FormItem :label="$t('profile.fields.realName')" required>
          <Input
            v-model:value="realName"
            :maxlength="64"
            :placeholder="$t('profile.placeholders.realName')"
          />
        </FormItem>
        <Button type="primary" :loading="saving" @click="handleSaveProfile">
          {{ $t('profile.actions.save') }}
        </Button>
      </Form>
    </section>

    <section v-if="emailChannelEnabled" class="profile-section">
      <div class="profile-section__head">
        <div>
          <h2>{{ $t('profile.fields.email') }}</h2>
          <p>{{ email || $t('profile.status.unbound') }}</p>
        </div>
        <Button v-if="!emailEditing" @click="startEmailEdit">
          {{
            email ? $t('profile.actions.change') : $t('profile.actions.bind')
          }}
        </Button>
      </div>
      <Form v-if="emailEditing" class="profile-email-form" layout="vertical">
        <FormItem :label="$t('profile.fields.email')">
          <Input
            v-model:value="bindEmail"
            :maxlength="128"
            :placeholder="$t('profile.placeholders.email')"
          />
        </FormItem>
        <FormItem :label="$t('profile.placeholders.code')">
          <div class="profile-code-row">
            <Input
              v-model:value="emailCode"
              :maxlength="6"
              :placeholder="$t('profile.placeholders.code')"
            />
            <Button
              :disabled="emailCountdown > 0"
              :loading="emailSending"
              @click="handleSendEmailCode"
            >
              {{
                emailCountdown > 0
                  ? `${emailCountdown}s`
                  : $t('profile.actions.sendCode')
              }}
            </Button>
          </div>
        </FormItem>
        <div class="profile-form-actions">
          <Button
            type="primary"
            :loading="emailVerifying"
            @click="handleVerifyEmail"
          >
            {{ $t('profile.actions.verifyBind') }}
          </Button>
          <Button @click="emailEditing = false">
            {{ $t('profile.actions.cancel') }}
          </Button>
        </div>
      </Form>
    </section>

    <section class="profile-section">
      <div class="profile-section__head">
        <div>
          <h2>{{ $t('profile.fields.mobile') }}</h2>
          <p>{{ mobile || $t('profile.status.unbound') }}</p>
        </div>
        <Tag>{{ $t('profile.status.mobilePending') }}</Tag>
      </div>
    </section>
  </div>
</template>

<style scoped>
.profile-basic {
  display: grid;
  gap: 24px;
  width: 100%;
  max-width: 760px;
}

.profile-basic h2 {
  margin: 0 0 14px;
  font-size: 18px;
  font-weight: 700;
}

.profile-form {
  max-width: 520px;
  margin-top: 20px;
}

.profile-section {
  padding-top: 24px;
  border-top: 1px solid hsl(var(--border));
}

.profile-section__head {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
}

.profile-section__head h2 {
  margin-bottom: 4px;
}

.profile-section__head p {
  margin: 0;
  font-size: 14px;
  color: hsl(var(--muted-foreground));
}

.profile-email-form {
  max-width: 600px;
  padding: 16px;
  margin-top: 16px;
  background: hsl(var(--muted) / 35%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.profile-code-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

.profile-form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

@media (max-width: 560px) {
  .profile-section__head {
    align-items: flex-start;
  }

  .profile-code-row {
    grid-template-columns: 1fr;
  }
}
</style>
