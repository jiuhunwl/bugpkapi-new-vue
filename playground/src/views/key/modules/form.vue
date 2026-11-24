<script lang="ts" setup>
import { h } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { Input, message, Modal } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createKey } from '#/api/key';
import { $t } from '#/locales';
import { copyText } from '#/utils/copy-text';

import { useFormSchema } from '../data';

const emits = defineEmits(['success']);

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
  },
  layout: 'horizontal',
  schema: useFormSchema(),
  showDefaultActions: false,
});

const [Drawer, drawerApi] = useVbenDrawer({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;

    const values = await formApi.getValues<{
      interfaceIds?: string[];
      keyScope: 'GLOBAL' | 'INTERFACE';
      name: string;
    }>();
    drawerApi.lock();
    createKey({
      interfaceIds: values.keyScope === 'GLOBAL' ? [] : values.interfaceIds,
      keyScope: values.keyScope,
      name: values.name,
    })
      .then((result) => {
        emits('success');
        drawerApi.close();
        showCreatedSecret(result.secretKey);
      })
      .catch(() => {
        drawerApi.unlock();
      });
  },

  onOpenChange(isOpen) {
    if (!isOpen) return;
    formApi.resetForm();
  },
});

function showCreatedSecret(secretKey: string) {
  const secret = String(secretKey || '').trim();
  if (!secret) {
    message.warning($t('system.key.createdSecretMissing'));
    return;
  }

  Modal.confirm({
    cancelText: $t('system.key.closeSecretDialog'),
    content: h('div', { class: 'space-y-3' }, [
      h(
        'p',
        { class: 'text-[13px] text-[var(--vben-text-secondary-color)]' },
        $t('system.key.createdSecretTip'),
      ),
      h(
        'p',
        { class: 'text-[13px] text-[var(--vben-text-secondary-color)]' },
        $t('system.key.createdSecretHeaderTip'),
      ),
      h(Input.TextArea, {
        autoSize: { maxRows: 5, minRows: 3 },
        readonly: true,
        spellcheck: false,
        value: secret,
      }),
    ]),
    okText: $t('system.key.copySecret'),
    onOk: async () => {
      try {
        await copyText(secret);
        message.success($t('system.key.copySecretSuccess'));
      } catch (error) {
        message.error($t('system.key.copySecretFailed'));
        throw error;
      }
    },
    title: $t('system.key.createdSecretTitle'),
    width: 680,
  });
}
</script>

<template>
  <Drawer :title="$t('system.key.createTitle')">
    <Form />
  </Drawer>
</template>
