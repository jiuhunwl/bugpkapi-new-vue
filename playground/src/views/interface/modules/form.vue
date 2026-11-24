<script lang="ts" setup>
import type { UploadFile } from 'ant-design-vue';

import type { InterfaceApi } from '#/api/interface';

import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { useAccessStore, useUserStore } from '@vben/stores';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createInterface,
  updateInterface,
  uploadInterfaceAvatar,
} from '#/api/interface';
import { $t } from '#/locales';
import { createDrawerSubmit } from '#/utils/drawer-submit';

import { useFormSchema } from '../data';
import { readPollingState } from '../domain-polling';
import {
  generalFormPollingPayload,
  upstreamTextFromItem,
} from './form-polling';

const emits = defineEmits<{
  success: [
    payload: {
      mode: 'create' | 'update';
      record?: InterfaceApi.InterfaceItem;
    },
  ];
}>();

const submit = createDrawerSubmit();

const formData = ref<InterfaceApi.InterfaceItem>();
const id = ref<string>();
const accessStore = useAccessStore();
const userStore = useUserStore();
const isAdmin = computed(() => userStore.userRoles.includes('admin'));
const hasCode = (code: string) =>
  isAdmin.value || accessStore.accessCodes.includes(code);
const canCreate = computed(() => hasCode('interface:create'));
const canUpdate = computed(() => hasCode('interface:update'));
const canUploadAvatar = computed(() => hasCode('interface:upload-avatar'));

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
  },
  layout: 'horizontal',
  schema: useFormSchema(
    canUploadAvatar.value ? uploadInterfaceAvatar : undefined,
  ),
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1',
});

const [Drawer, drawerApi] = useVbenDrawer({
  onConfirm() {
    return submit(drawerApi, async () => {
      if ((id.value && !canUpdate.value) || (!id.value && !canCreate.value))
        return;
      const { valid } = await formApi.validate();
      if (!valid) return;

      const values = await formApi.getValues<any>();
      const avatarUrl = extractAvatarUrl(values);
      const price = values.price ?? 0;
      const payload: InterfaceApi.SaveInterface = {
        apiCode: values.apiCode,
        avatarUrl,
        isFeatured: values.isFeatured ? 1 : 0,
        isTop: values.isTop ? 1 : 0,
        name: values.name,
        pointPrice: Number(price) <= 0 ? 0 : (values.pointPrice ?? 0),
        qpsLimit: Number(values.qpsLimit ?? 0),
        sharedQpsLimit: Number(values.sharedQpsLimit ?? 0),
        ...generalFormPollingPayload(values, formData.value),
        price,
        remark: values.remark,
        requestMethod: values.requestMethod,
        requestUrl: values.requestUrl,
        status: values.status ? 1 : 0,
      };

      const editingId = id.value;
      const record = editingId
        ? await updateInterface(editingId, payload).then(() => undefined)
        : await createInterface(payload);
      message.success(
        $t(
          editingId ? 'operationFeedback.updated' : 'operationFeedback.created',
          [$t('operationFeedback.entities.interface')],
        ),
      );
      drawerApi.close();
      emits('success', { mode: editingId ? 'update' : 'create', record });
    });
  },

  async onOpenChange(isOpen) {
    if (!isOpen) return;

    const data = drawerApi.getData<InterfaceApi.InterfaceItem>();
    formApi.resetForm();
    formData.value = data?.id ? data : undefined;
    id.value = data?.id;

    const polling = data?.id
      ? readPollingState(data)
      : { pollingEnabled: false, pollingMode: 'FASTEST' as const };
    await nextTick();
    formApi.setValues({
      apiCode: data?.apiCode ?? '',
      avatarFile: data?.avatarUrl
        ? [
            {
              name: data.name,
              status: 'done',
              uid: '-1',
              url: data.avatarUrl,
            },
          ]
        : [],
      avatarUrl: data?.avatarUrl ?? '',
      isFeatured: data?.id ? data.isFeatured === 1 : false,
      isTop: data?.id ? data.isTop === 1 : false,
      name: data?.name ?? '',
      pointPrice: data?.pointPrice ?? 0,
      qpsLimit: data?.qpsLimit ?? 0,
      sharedQpsLimit: data?.sharedQpsLimit ?? 0,
      ...polling,
      price: data?.price ?? 0,
      remark: data?.remark ?? '',
      requestMethod: data?.requestMethod ?? 'GET',
      requestUrl: data?.requestUrl ?? '',
      status: data?.id ? data.status === 1 : true,
      upstreamUrlsText: upstreamTextFromItem(data),
    });
  },
});

const drawerTitle = computed(() =>
  formData.value?.id
    ? $t('ui.actionTitle.edit', [$t('system.interface.name')])
    : $t('ui.actionTitle.create', [$t('system.interface.name')]),
);

function extractAvatarUrl(values: Record<string, any>) {
  const files = (values.avatarFile ?? []) as UploadFile[];
  const uploadedUrl = files[0]?.response?.url;
  const previewUrl = files[0]?.url;
  const inputUrl = String(values.avatarUrl ?? '').trim();
  return uploadedUrl || inputUrl || previewUrl || undefined;
}
</script>

<template>
  <Drawer :title="drawerTitle">
    <Form />
  </Drawer>
</template>
