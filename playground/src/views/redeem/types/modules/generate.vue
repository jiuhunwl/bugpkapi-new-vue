<script lang="ts" setup>
import type { RedeemApi } from '#/api/redeem';

import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { generateCodes } from '#/api/redeem';
import { $t } from '#/locales';
import { createDrawerSubmit } from '#/utils/drawer-submit';

import { useGenerateFormSchema } from '../data';

const emits = defineEmits(['success']);

const submit = createDrawerSubmit();

const id = ref<string>();
const typeName = ref('');

const [Form, formApi] = useVbenForm({
  schema: useGenerateFormSchema(),
  showDefaultActions: false,
});

const [Drawer, drawerApi] = useVbenDrawer({
  onConfirm() {
    return submit(drawerApi, async () => {
      const { valid } = await formApi.validate();
      if (!valid) return;

      const values = await formApi.getValues<Record<string, any>>();
      const count = Number(values.count ?? 0);
      if (!Number.isInteger(count) || count < 1 || count > 5000) {
        message.warning($t('system.redeem.type.countRange'));
        return;
      }

      const perUserLimit =
        values.perUserLimit === undefined || values.perUserLimit === null
          ? undefined
          : Number(values.perUserLimit);
      const perIpLimit =
        values.perIpLimit === undefined || values.perIpLimit === null
          ? undefined
          : Number(values.perIpLimit);
      const campaignRef = String(values.campaignRef ?? '').trim();

      const result = await generateCodes(id.value!, {
        campaignRef: campaignRef || undefined,
        count,
        perIpLimit,
        perUserLimit,
      });
      drawerApi.close();
      message.success(
        $t('system.redeem.type.generateSuccess', [
          result.batchId,
          result.count,
        ]),
      );
      emits('success');
    });
  },

  async onOpenChange(isOpen) {
    if (!isOpen) return;

    const data = drawerApi.getData<RedeemApi.CodeType>();
    id.value = data?.id;
    typeName.value = data?.name ?? '';

    await nextTick();
    formApi.resetForm();
    formApi.setValues({ count: 1 });
  },
});

const drawerTitle = computed(() =>
  $t('system.redeem.code.generate', [typeName.value]),
);
</script>

<template>
  <Drawer class="w-[480px]" :title="drawerTitle">
    <Form />
  </Drawer>
</template>
