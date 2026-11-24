<script lang="ts" setup>
import type { FriendLinkActionPermissions } from '../data';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { FriendLinkApi } from '#/api/friend-link';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { useAccessStore, useUserStore } from '@vben/stores';

import {
  Button,
  Checkbox,
  Input,
  message,
  Modal,
  Select,
  Tag,
} from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteFriendLink,
  getAdminFriendLinkList,
  updateFriendLinkStatus,
} from '#/api/friend-link';
import { $t } from '#/locales';

import { useLinkColumns, useLinkGridFormSchema } from '../data';
import Form from './form.vue';

interface ReasonTemplateOption {
  label: string;
  reason: string;
  value: string;
}

const acting = ref(new Set<string>());
const deleteModalOpen = ref(false);
const deleteLoading = ref(false);
const deleteReason = ref('');
const deleteReasonTemplate = ref('');
const deleteSendEmail = ref(true);
const pendingDeleteRow = ref<FriendLinkApi.FriendLinkItem | null>(null);
const accessStore = useAccessStore();
const userStore = useUserStore();
const isAdmin = computed(() => userStore.userRoles.includes('admin'));
const hasCode = (code: string) =>
  isAdmin.value || accessStore.accessCodes.includes(code);
const canCreate = computed(() => hasCode('friend-link:create'));
const actionPermissions = computed<FriendLinkActionPermissions>(() => ({
  delete: hasCode('friend-link:delete'),
  status: hasCode('friend-link:status'),
  update: hasCode('friend-link:update'),
}));

const deleteReasonTemplates = computed<ReasonTemplateOption[]>(() => [
  {
    label: $t('friendLinkAdmin.delete.templates.siteUnreachable.label'),
    reason: $t('friendLinkAdmin.delete.templates.siteUnreachable.reason'),
    value: 'site_unreachable',
  },
  {
    label: $t('friendLinkAdmin.delete.templates.backlinkRemoved.label'),
    reason: $t('friendLinkAdmin.delete.templates.backlinkRemoved.reason'),
    value: 'backlink_removed',
  },
  {
    label: $t('friendLinkAdmin.delete.templates.contentChanged.label'),
    reason: $t('friendLinkAdmin.delete.templates.contentChanged.reason'),
    value: 'content_changed',
  },
  {
    label: $t('friendLinkAdmin.delete.templates.inactive.label'),
    reason: $t('friendLinkAdmin.delete.templates.inactive.reason'),
    value: 'inactive',
  },
  {
    label: $t('friendLinkAdmin.delete.templates.custom.label'),
    reason: '',
    value: 'custom',
  },
]);
const deleteReasonTemplateOptions = computed(() =>
  deleteReasonTemplates.value.map(({ label, value }) => ({ label, value })),
);

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useLinkGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useLinkColumns(onActionClick, actionPermissions.value),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: ({ page }, values) =>
          getAdminFriendLinkList({
            page: page.currentPage,
            pageSize: page.pageSize,
            ...values,
          }),
      },
    },
    rowConfig: { keyField: 'id' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<FriendLinkApi.FriendLinkItem>,
});

function onActionClick({
  code,
  row,
}: OnActionClickParams<FriendLinkApi.FriendLinkItem>) {
  if (code === 'delete' && actionPermissions.value.delete) openDelete(row);
  if (code === 'edit' && actionPermissions.value.update) {
    formDrawerApi.setData(row).open();
  }
  if (code === 'status' && actionPermissions.value.status) {
    void toggleStatus(row);
  }
}

async function run(
  row: FriendLinkApi.FriendLinkItem,
  action: () => Promise<unknown>,
) {
  if (acting.value.has(row.id)) return false;
  acting.value.add(row.id);
  try {
    await action();
    await gridApi.query();
    return true;
  } finally {
    acting.value.delete(row.id);
  }
}

async function toggleStatus(row: FriendLinkApi.FriendLinkItem) {
  const next = row.status === 1 ? 0 : 1;
  if (await run(row, () => updateFriendLinkStatus(row.id, next))) {
    message.success(
      $t(
        next
          ? 'friendLinkAdmin.messages.visible'
          : 'friendLinkAdmin.messages.hidden',
      ),
    );
  }
}

function openDelete(row: FriendLinkApi.FriendLinkItem) {
  if (!actionPermissions.value.delete) return;
  pendingDeleteRow.value = row;
  deleteReason.value = '';
  deleteReasonTemplate.value = '';
  deleteSendEmail.value = true;
  deleteModalOpen.value = true;
}

function onDeleteReasonTemplateChange(value: unknown) {
  const key = typeof value === 'string' ? value : '';
  deleteReasonTemplate.value = key;
  const selected = deleteReasonTemplates.value.find(
    (item) => item.value === key,
  );
  if (selected && key !== 'custom') {
    deleteReason.value = selected.reason;
  } else if (key === 'custom') {
    deleteReason.value = '';
  }
}

async function confirmDelete() {
  const row = pendingDeleteRow.value;
  const reason = deleteReason.value.trim();
  if (!row || deleteLoading.value) return;
  if (!reason) {
    message.warning($t('friendLinkAdmin.delete.reasonRequired'));
    return;
  }

  deleteLoading.value = true;
  try {
    const deleted = await run(row, () =>
      deleteFriendLink(row.id, {
        reason,
        reasonTemplate: deleteReasonTemplate.value || undefined,
        sendEmail: deleteSendEmail.value,
      }),
    );
    if (deleted) {
      message.success($t('friendLinkAdmin.messages.deleted', [row.siteName]));
      deleteModalOpen.value = false;
      pendingDeleteRow.value = null;
    }
  } finally {
    deleteLoading.value = false;
  }
}

function onCreate() {
  if (canCreate.value) formDrawerApi.setData({}).open();
}
</script>

<template>
  <div class="flk-panel">
    <FormDrawer @success="gridApi.query()" />
    <Grid class="flk-grid" :table-title="$t('friendLinkAdmin.title')">
      <template #toolbar-tools>
        <Button v-if="canCreate" type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('friendLinkAdmin.create') }}
        </Button>
      </template>
      <template #logo="{ row }">
        <img
          v-if="row.logoUrl"
          :alt="row.siteName"
          :src="row.logoUrl"
          class="size-10 rounded-md border border-border object-cover"
        />
        <span
          v-else
          class="grid size-10 place-items-center rounded-md border border-border bg-muted font-bold text-primary"
        >
          {{ row.siteName?.slice(0, 1) || 'L' }}
        </span>
      </template>
      <template #siteUrl="{ row }">
        <a :href="row.siteUrl" rel="noopener noreferrer" target="_blank">
          {{ row.siteUrl }}
        </a>
      </template>
      <template #status="{ row }">
        <Tag :color="row.status === 1 ? 'success' : 'default'">
          {{
            row.status === 1
              ? $t('friendLinkAdmin.visible')
              : $t('friendLinkAdmin.hidden')
          }}
        </Tag>
      </template>
    </Grid>

    <Modal
      v-model:open="deleteModalOpen"
      :title="$t('friendLinkAdmin.delete.title')"
      :ok-text="$t('friendLinkAdmin.delete.action')"
      :confirm-loading="deleteLoading"
      ok-type="danger"
      width="560px"
      @ok="confirmDelete"
    >
      <div class="grid gap-4 pt-1">
        <div class="rounded-lg border border-border bg-muted/30 p-3">
          <strong class="block text-sm">
            {{ pendingDeleteRow?.siteName }}
          </strong>
          <span class="mt-1 block text-xs text-muted-foreground">
            {{ pendingDeleteRow?.siteUrl }}
          </span>
        </div>
        <p class="m-0 text-sm text-muted-foreground">
          {{ $t('friendLinkAdmin.delete.description') }}
        </p>
        <label class="grid gap-2">
          <span class="text-sm font-medium">
            {{ $t('friendLinkAdmin.delete.reasonTemplate') }}
          </span>
          <Select
            :options="deleteReasonTemplateOptions"
            :placeholder="
              $t('friendLinkAdmin.delete.reasonTemplatePlaceholder')
            "
            :value="deleteReasonTemplate || undefined"
            allow-clear
            @change="onDeleteReasonTemplateChange"
          />
        </label>
        <label class="grid gap-2">
          <span class="text-sm font-medium">
            {{ $t('friendLinkAdmin.delete.reasonLabel') }}
            <b class="text-destructive">*</b>
          </span>
          <Input.TextArea
            v-model:value="deleteReason"
            :maxlength="1000"
            :placeholder="$t('friendLinkAdmin.delete.reasonPlaceholder')"
            :rows="4"
            show-count
          />
        </label>
        <Checkbox v-model:checked="deleteSendEmail">
          {{ $t('friendLinkAdmin.delete.sendEmail') }}
        </Checkbox>
        <p class="m-0 text-xs text-muted-foreground">
          {{ $t('friendLinkAdmin.delete.sendEmailDescription') }}
        </p>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.flk-panel {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.flk-grid {
  flex: 1;
  min-height: 0;
}
</style>
