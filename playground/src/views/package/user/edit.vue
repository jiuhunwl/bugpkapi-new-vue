<script lang="ts" setup>
import type { PackageApi } from '#/api/package';

import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { updateUserEntitlement } from '#/api/package';
import { $t } from '#/locales';
import { createDrawerSubmit } from '#/utils/drawer-submit';

const emits = defineEmits(['success']);
const submit = createDrawerSubmit();

const row = ref<PackageApi.UserEntitlement>();

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
  },
  layout: 'horizontal',
  schema: [
    {
      component: 'Switch',
      componentProps: {
        checkedChildren: $t('common.enabled'),
        class: 'w-auto',
        unCheckedChildren: $t('common.disabled'),
      },
      defaultValue: true,
      fieldName: 'status',
      label: $t('system.package.status'),
    },
    {
      component: 'DatePicker',
      componentProps: {
        showTime: true,
        valueFormat: 'YYYY-MM-DD HH:mm:ss',
      },
      fieldName: 'endAt',
      label: $t('system.package.endAt'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        min: 0,
        precision: 0,
      },
      fieldName: 'dailyLimit',
      label: $t('system.package.dailyLimit'),
    },
    {
      component: 'InputNumber',
      componentProps: {
        min: 0,
        precision: 0,
      },
      fieldName: 'totalLimit',
      help: $t('system.package.totalLimitHelp'),
      label: $t('system.package.totalLimit'),
    },
    {
      component: 'Select',
      componentProps: {
        options: [
          { label: $t('system.package.countModeSuccess'), value: 'success' },
          { label: $t('system.package.countModeAttempt'), value: 'attempt' },
        ],
      },
      defaultValue: 'success',
      fieldName: 'countMode',
      help: $t('system.package.countModeHelp'),
      label: $t('system.package.countMode'),
    },
    {
      component: 'InputNumber',
      componentProps: {
        min: 0,
        precision: 0,
      },
      fieldName: 'qpsLimit',
      label: $t('system.package.qpsLimit'),
    },
  ],
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1',
});

const [Drawer, drawerApi] = useVbenDrawer({
  onConfirm() {
    return submit(drawerApi, async () => {
      const { valid } = await formApi.validate();
      if (!valid) return;

      const current = row.value;
      if (!current) return;

      const values = await formApi.getValues<any>();
      await updateUserEntitlement(current.id, current.scope, {
        countMode: values.countMode === 'attempt' ? 'attempt' : 'success',
        dailyLimit: Number(values.dailyLimit ?? 0),
        endAt: values.endAt,
        qpsLimit: Number(values.qpsLimit ?? 0),
        status: values.status ? 1 : 0,
        totalLimit: Number(values.totalLimit ?? 0),
      });
      message.success(
        $t('system.package.userStatusUpdated', [current.packageName]),
      );
      emits('success');
      drawerApi.close();
    });
  },

  async onOpenChange(isOpen) {
    if (!isOpen) return;

    const data = drawerApi.getData<PackageApi.UserEntitlement>();
    formApi.resetForm();
    row.value = data;

    await nextTick();
    formApi.setValues({
      countMode: data?.countMode === 'attempt' ? 'attempt' : 'success',
      dailyLimit: data?.dailyLimit ?? 0,
      endAt: data?.endAt ?? '',
      qpsLimit: data?.qpsLimit ?? 0,
      status: data?.status === 1,
      totalLimit: data?.totalLimit ?? 0,
    });
  },
});

const drawerTitle = computed(() =>
  $t('ui.actionTitle.edit', [$t('system.package.userTitle')]),
);
</script>

<template>
  <Drawer :title="drawerTitle">
    <Form />
  </Drawer>
</template>
