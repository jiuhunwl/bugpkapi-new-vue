<script lang="ts" setup>
import type { RechargeAmountApi } from '#/api/system/payment';

import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createRechargeAmount,
  updateRechargeAmount,
} from '#/api/system/payment';
import { $t } from '#/locales';
import { createDrawerSubmit } from '#/utils/drawer-submit';

import { useFormSchema } from '../data';

const emits = defineEmits(['success']);
const submit = createDrawerSubmit();

const formData = ref<RechargeAmountApi.RechargeAmount>();
const id = ref<string>();

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
    labelWidth: 100,
  },
  layout: 'horizontal',
  schema: useFormSchema(),
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1',
});

const [Drawer, drawerApi] = useVbenDrawer({
  onConfirm() {
    return submit(drawerApi, async () => {
      const { valid } = await formApi.validate();
      if (!valid) return;

      const values = await formApi.getValues<any>();
      const payload: RechargeAmountApi.SaveRechargeAmount = {
        amount: values.amount ?? 0,
        giftAmount: values.giftAmount ?? 0,
        sortNo: Number(values.sortNo ?? 0),
        status: values.status ? 1 : 0,
      };

      await (id.value
        ? updateRechargeAmount(id.value, payload)
        : createRechargeAmount(payload));
      message.success(
        $t(
          id.value ? 'operationFeedback.updated' : 'operationFeedback.created',
          [$t('rechargePreset.entityName')],
        ),
      );
      emits('success');
      drawerApi.close();
    });
  },

  async onOpenChange(isOpen) {
    if (!isOpen) return;

    const data = drawerApi.getData<RechargeAmountApi.RechargeAmount>();
    formApi.resetForm();
    formData.value = data?.id ? data : undefined;
    id.value = data?.id;

    await nextTick();
    formApi.setValues({
      amount: data?.amount ?? 10,
      giftAmount: data?.giftAmount ?? 0,
      sortNo: data?.sortNo ?? 0,
      status: data?.id ? data.status === 1 : true,
    });
  },
});

const drawerTitle = computed(() =>
  $t(
    formData.value?.id
      ? 'rechargePreset.editor.edit'
      : 'rechargePreset.editor.create',
  ),
);
</script>

<template>
  <Drawer :title="drawerTitle">
    <Form />
  </Drawer>
</template>
