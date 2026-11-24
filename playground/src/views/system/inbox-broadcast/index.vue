<script lang="ts" setup>
import { reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Button,
  Card,
  Form,
  FormItem,
  Input,
  InputNumber,
  message,
  RadioButton,
  RadioGroup,
  Switch,
} from 'ant-design-vue';

import { broadcastInboxMessage } from '#/api/inbox';
import { $t } from '#/locales';

const Textarea = Input.TextArea;

const form = reactive({
  body: '',
  sendEmail: false,
  scope: 'all' as 'all' | 'user',
  title: '',
  userId: undefined as number | undefined,
});
const submitting = ref(false);

async function submit() {
  if (!form.title.trim()) {
    message.warning($t('inbox.titleRequired'));
    return;
  }
  if (!form.body.trim()) {
    message.warning($t('inbox.bodyRequired'));
    return;
  }
  if (form.scope === 'user' && !form.userId) {
    message.warning($t('inbox.userIdRequired'));
    return;
  }
  submitting.value = true;
  try {
    const result = await broadcastInboxMessage({
      body: form.body.trim(),
      sendEmail: form.sendEmail,
      title: form.title.trim(),
      userId: form.scope === 'user' ? form.userId : undefined,
    });
    message.success(
      $t('inbox.broadcastSuccess', [result.recipients, result.emails]),
    );
    form.body = '';
    form.title = '';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Page>
    <Card :title="$t('inbox.broadcastTitle')">
      <p class="inbox-broadcast__hint">{{ $t('inbox.broadcastHint') }}</p>
      <Form layout="vertical" class="inbox-broadcast__form">
        <FormItem :label="$t('inbox.titleLabel')" required>
          <Input
            v-model:value="form.title"
            :maxlength="128"
            :placeholder="$t('inbox.titlePlaceholder')"
            show-count
          />
        </FormItem>
        <FormItem :label="$t('inbox.bodyLabel')" required>
          <Textarea
            v-model:value="form.body"
            :maxlength="4000"
            :placeholder="$t('inbox.bodyPlaceholder')"
            :rows="8"
            show-count
          />
        </FormItem>
        <FormItem :label="$t('inbox.scopeLabel')">
          <RadioGroup v-model:value="form.scope">
            <RadioButton value="all">{{ $t('inbox.scopeAll') }}</RadioButton>
            <RadioButton value="user">{{ $t('inbox.scopeUser') }}</RadioButton>
          </RadioGroup>
          <InputNumber
            v-if="form.scope === 'user'"
            v-model:value="form.userId"
            :min="1"
            :precision="0"
            :placeholder="$t('inbox.userIdPlaceholder')"
            class="inbox-broadcast__user-id"
          />
        </FormItem>
        <FormItem :label="$t('inbox.sendEmailLabel')">
          <Switch v-model:checked="form.sendEmail" />
          <span class="inbox-broadcast__email-tip">
            {{ $t('inbox.sendEmailTip') }}
          </span>
        </FormItem>
        <FormItem>
          <Button
            type="primary"
            :loading="submitting"
            danger
            @click="submit"
          >
            {{ $t('inbox.send') }}
          </Button>
        </FormItem>
      </Form>
    </Card>
  </Page>
</template>

<style scoped>
.inbox-broadcast__hint {
  margin-bottom: 16px;
  font-size: 13px;
  color: rgb(100 116 139);
}

.inbox-broadcast__form {
  max-width: 640px;
}

.inbox-broadcast__user-id {
  display: block;
  margin-top: 8px;
  width: 240px;
}

.inbox-broadcast__email-tip {
  margin-left: 8px;
  font-size: 12px;
  color: rgb(100 116 139);
}
</style>
