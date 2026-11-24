<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickParams, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { OpenApiConsole } from '#/api/open-api';

import { computed, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import {
  Alert,
  Button,
  CheckboxGroup,
  Form,
  FormItem,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Tag,
} from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  getAllKeys,
  getScopeOptions,
  issueMyKey,
  revokeKey,
} from '#/api/open-api';
import { $t } from '#/locales';
import { searchUserOptions } from '#/api/system/user';
import { useRemoteOptions } from '#/components/remote-search-select/use-remote-options';

import { buildColumns, keyState } from './data';

// ---------------------------------------------------------------- 搜索表单
function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'keyword',
      label: $t('system.openApi.keyword'),
    },
  ];
}

async function fetchUserOptions(
  keyword: string,
  signal: AbortSignal,
): Promise<{ label: string; value: string }[]> {
  const items = await searchUserOptions(keyword, signal);
  return items.map((item) => ({ label: item.label, value: item.id }));
}

// ---------------------------------------------------------------- 列表
const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: buildColumns(onActionClick),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          return await getAllKeys({
            keyword: formValues.keyword || undefined,
            page: page.currentPage,
            pageSize: page.pageSize,
          });
        },
      },
    },
    rowConfig: {
      keyField: 'id',
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<OpenApiConsole.OpenAPIKey>,
});

function onActionClick({
  code,
  row,
}: OnActionClickParams<OpenApiConsole.OpenAPIKey>) {
  if (code === 'revoke') onRevoke(row);
}

async function onRefresh() {
  gridApi.query();
}

// ---------------------------------------------------------------- 为他人签发
const issueOpen = ref(false);
const issuing = ref(false);
const scopeChoices = ref<OpenApiConsole.ScopeOption[]>([]);
const issueForm = reactive({
  expiresInDays: undefined as number | undefined,
  ipText: '',
  name: '',
  scopes: [] as OpenApiConsole.EndpointCode[],
  userId: undefined as string | undefined,
});

const { options: userOptions, search: searchUsers } = useRemoteOptions(
  fetchUserOptions,
);

const scopeItems = computed(() =>
  scopeChoices.value.map((item) => ({
    label: item.label,
    value: item.code,
  })),
);

const submitDisabled = computed(
  () =>
    !issueForm.userId ||
    !issueForm.name.trim() ||
    issueForm.scopes.length === 0,
);

async function openIssue() {
  if (scopeChoices.value.length === 0) {
    scopeChoices.value = await getScopeOptions();
  }
  issueForm.name = '';
  issueForm.userId = undefined;
  issueForm.scopes = scopeChoices.value
    .filter((item) => item.granted)
    .map((item) => item.code);
  issueForm.expiresInDays = undefined;
  issueForm.ipText = '';
  await searchUsers('');
  issueOpen.value = true;
}

async function onIssueSubmit() {
  if (submitDisabled.value || issuing.value) return;
  issuing.value = true;
  try {
    const payload: OpenApiConsole.IssueKeyRequest = {
      name: issueForm.name.trim(),
      scopes: issueForm.scopes,
      userId: Number(issueForm.userId),
    };
    if (issueForm.expiresInDays && issueForm.expiresInDays > 0) {
      payload.expiresInDays = issueForm.expiresInDays;
    }
    const ipList = issueForm.ipText
      .split(/[,\s]+/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (ipList.length > 0) payload.ipWhitelist = ipList;

    const issued = await issueMyKey(payload);
    issueOpen.value = false;
    message.success($t('system.openApi.issueSuccess'));
    onShowSecret(issued.secretKey, issued.name);
    await onRefresh();
  } finally {
    issuing.value = false;
  }
}

// ---------------------------------------------------------------- 明文展示
const secretOpen = ref(false);
const secretKey = ref('');
const secretName = ref('');

function onShowSecret(key: string, name: string) {
  secretKey.value = key;
  secretName.value = name;
  secretOpen.value = true;
}

async function onRevoke(row: OpenApiConsole.OpenAPIKey) {
  if (
    !(await confirmAsync(
      $t('system.openApi.revokeConfirmTitle'),
      $t('system.openApi.revokeConfirmContent', [row.name]),
    ))
  ) {
    return;
  }
  await revokeKey(row.id);
  message.success($t('system.openApi.revokeSuccess'));
  await onRefresh();
}

function confirmAsync(title: string, content: string) {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };
    Modal.confirm({
      content,
      onCancel: () => {
        finish(false);
      },
      onOk: () => {
        finish(true);
      },
      title,
    });
  });
}
</script>

<template>
  <Page auto-content-height>
    <Alert
      class="mb-4"
      show-icon
      type="info"
      :message="$t('system.openApi.adminTip')"
    />
    <Grid :table-title="$t('system.openApi.keyTitle')">
      <template #toolbar-tools>
        <Button type="primary" @click="openIssue">
          <Plus class="size-5" />
          {{ $t('system.openApi.issueForUser') }}
        </Button>
      </template>
      <template #status="{ row }">
        <Tag :color="keyState(row).color">{{ keyState(row).label }}</Tag>
      </template>
    </Grid>

    <Modal
      v-model:open="issueOpen"
      :confirm-loading="issuing"
      :ok-disabled="submitDisabled"
      :title="$t('system.openApi.issueForUser')"
      :width="560"
      @ok="onIssueSubmit"
    >
      <Form class="mt-4" layout="vertical">
        <FormItem :label="$t('system.openApi.username')" required>
          <Select
            v-model:value="issueForm.userId"
            :options="userOptions"
            :placeholder="$t('system.openApi.userSelectPlaceholder')"
            class="w-full"
            show-search
            @search="searchUsers"
          />
        </FormItem>
        <FormItem :label="$t('system.openApi.keyName')" required>
          <Input
            v-model:value="issueForm.name"
            :max-length="50"
            :placeholder="$t('system.openApi.keyNamePlaceholder')"
          />
        </FormItem>
        <FormItem
          :help="$t('system.openApi.scopeHelp')"
          :label="$t('system.openApi.scopes')"
          required
        >
          <CheckboxGroup
            v-model:value="issueForm.scopes"
            :options="scopeItems"
          />
        </FormItem>
        <FormItem
          :help="$t('system.openApi.expiresInDaysHelp')"
          :label="$t('system.openApi.expiresInDays')"
        >
          <InputNumber
            v-model:value="issueForm.expiresInDays"
            :max="3650"
            :min="1"
            :step="1"
            class="w-full"
            :placeholder="$t('system.openApi.expiresInDaysPlaceholder')"
          />
        </FormItem>
        <FormItem
          :help="$t('system.openApi.ipWhitelistHelp')"
          :label="$t('system.openApi.ipWhitelist')"
        >
          <Input
            v-model:value="issueForm.ipText"
            :placeholder="$t('system.openApi.ipWhitelistPlaceholder')"
          />
        </FormItem>
      </Form>
    </Modal>

    <Modal
      v-model:open="secretOpen"
      :footer="null"
      :title="$t('system.openApi.secretTitle')"
      :width="560"
    >
      <Alert
        class="mb-4"
        show-icon
        type="warning"
        :message="$t('system.openApi.secretWarn')"
      />
      <div class="mb-2 text-sm text-muted-foreground">
        {{ $t('system.openApi.secretKeyFor', [secretName]) }}
      </div>
      <div class="flex items-center gap-2">
        <Input :value="secretKey" class="flex-1 font-mono" readonly />
      </div>
      <div class="mt-4 flex justify-end">
        <Button type="primary" @click="secretOpen = false">
          {{ $t('common.confirm') }}
        </Button>
      </div>
    </Modal>
  </Page>
</template>
