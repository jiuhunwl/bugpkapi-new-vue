<script setup lang="ts">
import type { AdvertisementApi } from '#/api/advertisement';
import type {
  AdvertisementDraft,
  AdvertisementDraftIssue,
} from '../form-model';

import { computed, ref, shallowRef } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import {
  createAdvertisement,
  getAdminAdvertisementDetail,
  updateAdvertisement,
} from '#/api/advertisement';
import { $t } from '#/locales';

import {
  advertisementToDraft,
  buildAdvertisementSavePayload,
  createAdvertisementDraft,
} from '../form-model';
import AdvertisementEditor from './AdvertisementEditor.vue';

const emit = defineEmits<{ success: [] }>();

const id = shallowRef<string>();
const draft = ref<AdvertisementDraft>(createAdvertisementDraft());

const [Drawer, drawerApi] = useVbenDrawer({
  class: 'w-[95vw]! max-w-[1080px]!',
  async onConfirm() {
    const result = buildAdvertisementSavePayload(draft.value);
    if (result.issue) {
      showDraftIssue(result.issue);
      return;
    }

    drawerApi.lock();
    try {
      if (id.value) {
        await updateAdvertisement(id.value, result.data);
        message.success($t('advertisementAdmin.messages.updated'));
      } else {
        await createAdvertisement(result.data);
        message.success($t('advertisementAdmin.messages.created'));
      }
      emit('success');
      drawerApi.close();
    } finally {
      drawerApi.unlock();
    }
  },
  async onOpenChange(open) {
    if (!open) return;
    const row = drawerApi.getData<AdvertisementApi.Advertisement>();
    id.value = row?.id;
    draft.value = createAdvertisementDraft();
    if (!row?.id) return;

    drawerApi.lock();
    try {
      const detail = await getAdminAdvertisementDetail(row.id);
      draft.value = advertisementToDraft(detail);
    } finally {
      drawerApi.unlock();
    }
  },
});

const drawerTitle = computed(() =>
  $t(
    id.value
      ? 'advertisementAdmin.editor.edit'
      : 'advertisementAdmin.editor.create',
  ),
);

function showDraftIssue(issue: AdvertisementDraftIssue) {
  const index = Number(issue.index ?? 0) + 1;
  switch (issue.code) {
    case 'NAME_REQUIRED': {
      message.error($t('advertisementAdmin.messages.nameRequired'));
      break;
    }
    case 'TITLE_REQUIRED': {
      message.error($t('advertisementAdmin.messages.titleRequired'));
      break;
    }
    case 'SORT_INVALID': {
      message.error($t('advertisementAdmin.messages.sortInvalid'));
      break;
    }
    case 'SCHEDULE_INVALID': {
      message.error($t('advertisementAdmin.messages.scheduleInvalid'));
      break;
    }
    case 'PARAMETER_NAME_REQUIRED': {
      message.error(
        $t('advertisementAdmin.messages.parameterNameRequired', [index]),
      );
      break;
    }
    case 'PARAMETER_NAME_TOO_LONG': {
      message.error(
        $t('advertisementAdmin.messages.parameterNameTooLong', [index]),
      );
      break;
    }
    case 'PARAMETER_DUPLICATE': {
      message.error(
        $t('advertisementAdmin.messages.parameterDuplicate', [issue.key ?? '']),
      );
      break;
    }
    case 'PARAMETER_NUMBER_INVALID': {
      message.error(
        $t('advertisementAdmin.messages.parameterNumberInvalid', [index]),
      );
      break;
    }
    case 'PAYLOAD_TOO_LARGE': {
      message.error($t('advertisementAdmin.messages.payloadTooLarge'));
      break;
    }
  }
}
</script>

<template>
  <Drawer :title="drawerTitle">
    <AdvertisementEditor v-model="draft" />
  </Drawer>
</template>
