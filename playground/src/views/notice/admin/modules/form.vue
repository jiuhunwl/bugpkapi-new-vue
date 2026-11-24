<script lang="ts" setup>
import type { NoticeApi } from '#/api/notice';

import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { useAccessStore, useUserStore } from '@vben/stores';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createNotice, getAdminNoticeDetail, updateNotice, uploadNoticeImage } from '#/api/notice';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emits = defineEmits(['success']);
const formData = ref<NoticeApi.NoticeItem>();
const id = ref<string>();
const accessStore = useAccessStore();
const userStore = useUserStore();
const isAdmin = computed(() => userStore.userRoles.includes('admin'));
const hasCode = (code: string) => isAdmin.value || accessStore.accessCodes.includes(code);
const canCreate = computed(() => hasCode('notice:create'));
const canUpdate = computed(() => hasCode('notice:update'));
const canUploadImage = computed(() => hasCode('notice:upload-image'));
const [Form, formApi] = useVbenForm({ commonConfig: { componentProps: { class: 'w-full' } }, layout: 'horizontal', schema: useFormSchema(canUploadImage.value ? uploadNoticeImage : undefined), showDefaultActions: false, wrapperClass: 'grid-cols-1 lg:grid-cols-2' });
const [Drawer, drawerApi] = useVbenDrawer({
  async onConfirm() {
    if ((id.value && !canUpdate.value) || (!id.value && !canCreate.value)) return;
    const { valid } = await formApi.validate();
    if (!valid) return;
    const values = await formApi.getValues<any>();
    const payload: NoticeApi.SaveNoticePayload = { contentHtml: String(values.contentHtml ?? '').trim(), expireTime: String(values.expireTime ?? '').trim(), isHomeTicker: values.isHomeTicker ? 1 : 0, isPopup: values.isPopup ? 1 : 0, isTop: values.isTop ? 1 : 0, status: values.status ? 1 : 0, title: String(values.title ?? '').trim() };
    drawerApi.lock();
    try {
      if (id.value) await updateNotice(id.value, payload); else await createNotice(payload);
      message.success($t(id.value ? 'noticeAdmin.messages.updated' : 'noticeAdmin.messages.created'));
      emits('success');
      drawerApi.close();
    } finally { drawerApi.unlock(); }
  },
  async onOpenChange(open) {
    if (!open) return;
    const data = drawerApi.getData<NoticeApi.NoticeItem>();
    formApi.resetForm();
    id.value = data?.id;
    formData.value = data?.id ? data : undefined;
    const detail = data?.id ? await getAdminNoticeDetail(data.id) : undefined;
    if (detail) formData.value = detail;
    await nextTick();
    await formApi.setValues({ contentHtml: detail?.contentHtml ?? '', expireTime: detail?.expireTime ?? '', isHomeTicker: detail?.isHomeTicker === 1, isPopup: detail?.isPopup === 1, isTop: detail?.isTop === 1, status: detail?.id ? detail.status === 1 : true, title: detail?.title ?? '' });
  },
});
const drawerTitle = computed(() => $t(formData.value?.id ? 'noticeAdmin.editor.editTitle' : 'noticeAdmin.editor.createTitle'));
</script>
<template><Drawer :title="drawerTitle"><Form /></Drawer></template>
<style scoped>:deep(.notice-rich-editor-item){min-height:420px}

:deep(.notice-rich-editor-item .vben-tiptap){min-height:360px}</style>
