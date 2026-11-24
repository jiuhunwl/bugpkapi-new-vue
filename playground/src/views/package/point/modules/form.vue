<script lang="ts" setup>
import type { PackageApi } from '#/api/package';

import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createPointPackage, updatePointPackage } from '#/api/package';
import { $t } from '#/locales';
import { createDrawerSubmit } from '#/utils/drawer-submit';

import { useFormSchema } from '../data';

const emits = defineEmits(['success']);
const submit = createDrawerSubmit();

const formData = ref<PackageApi.PointPackage>();
const id = ref<string>();

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
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
      const payload: PackageApi.SavePointPackage = {
        name: values.name,
        perUserLimit: Number(values.perUserLimit ?? 0),
        pointAmount: Number(values.pointAmount ?? 0),
        price: values.price ?? 0,
        remark: values.remark,
        roleIds: Array.isArray(values.roleIds)
          ? values.roleIds.map((id: number | string) => Number(id))
          : [],
        roleRestricted: values.roleRestricted ? 1 : 0,
        roleVisibleOnly: values.roleVisibleOnly ? 1 : 0,
        saleEndAt: values.saleEndAt ?? '',
        saleStartAt: values.saleStartAt ?? '',
        status: values.status ? 1 : 0,
        hidden: values.hidden ? 1 : 0,
        stockLimit: Number(values.stockLimit ?? 0),
      };

      await (id.value
        ? updatePointPackage(id.value, payload)
        : createPointPackage(payload));
      message.success(
        $t(
          id.value ? 'operationFeedback.updated' : 'operationFeedback.created',
          [$t('system.package.pointTitle')],
        ),
      );
      emits('success');
      drawerApi.close();
    });
  },

  async onOpenChange(isOpen) {
    if (!isOpen) return;

    const data = drawerApi.getData<PackageApi.PointPackage>();
    formApi.resetForm();
    formData.value = data?.id ? data : undefined;
    id.value = data?.id;

    await nextTick();
    formApi.setValues({
      name: data?.name ?? '',
      perUserLimit: data?.perUserLimit ?? 0,
      pointAmount: data?.pointAmount ?? 100,
      price: data?.price ?? 0,
      remark: data?.remark ?? '',
      roleIds: data?.roleIds ?? [],
      roleRestricted: data?.roleRestricted === 1,
      roleVisibleOnly: data?.roleVisibleOnly === 1,
      saleEndAt: data?.saleEndAt ?? '',
      saleStartAt: data?.saleStartAt ?? '',
      status: data?.id ? data.status === 1 : true,
      hidden: data?.hidden === 1,
      stockLimit: data?.stockLimit ?? 0,
    });
  },
});

const drawerTitle = computed(() =>
  formData.value?.id
    ? $t('ui.actionTitle.edit', [$t('system.package.pointTitle')])
    : $t('ui.actionTitle.create', [$t('system.package.pointTitle')]),
);
</script>

<template>
  <Drawer :title="drawerTitle">
    <Form />
  </Drawer>
</template>
