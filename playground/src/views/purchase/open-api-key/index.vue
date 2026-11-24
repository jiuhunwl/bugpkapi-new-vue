<script lang="ts" setup>
import type { OnActionClickParams, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { OpenApiConsole } from '#/api/open-api';

import { computed, onMounted, reactive, ref } from 'vue';

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
  Switch,
  Tag,
  Tooltip,
} from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  getMyKeys,
  getScopeOptions,
  getSelfSwitch,
  issueMyKey,
  resetKey,
  revokeKey,
  setSelfSwitch,
} from '#/api/open-api';
import { $t } from '#/locales';
import { copyText } from '#/utils/copy-text';

import { buildColumns, keyState } from './data';

const apiBase = window.location.origin;

// ---------------------------------------------------------------- 自助开关
// 开关初值必须来自服务端：写死 true 会让页面显示一个与账号无关的状态，
// 并在用户第一次点击时覆盖掉数据库里的真实值。
const switchEnabled = ref(false);
const switchLoading = ref(false);
const globalEnabled = ref(false);
const adminDisabled = ref(false);
/** 是否成功读到真实状态；读不到时不做任何拦截判断，交由服务端兜底。 */
const switchKnown = ref(false);

async function loadSwitchStatus() {
  try {
    const status = await getSelfSwitch();
    switchEnabled.value = status.enabled;
    globalEnabled.value = status.globalEnabled;
    adminDisabled.value = status.adminDisabled;
    switchKnown.value = true;
  } catch {
    switchKnown.value = false;
  }
}

onMounted(loadSwitchStatus);

/** 判定顺序与鉴权链一致：全局 → 管理员强制禁用 → 用户自助开关。 */
const issueBlockReason = computed(() => {
  if (!switchKnown.value) return '';
  if (!globalEnabled.value) return $t('system.openApi.issueBlockedByGlobal');
  if (adminDisabled.value) return $t('system.openApi.issueBlockedByAdmin');
  if (!switchEnabled.value) return $t('system.openApi.issueBlockedBySelf');
  return '';
});

const issueDisabled = computed(() => issueBlockReason.value !== '');

async function onSwitchChange(value: boolean) {
  if (switchLoading.value) return;
  switchLoading.value = true;
  try {
    await setSelfSwitch(value);
    switchEnabled.value = value;
    switchKnown.value = true;
    message.success(
      value
        ? $t('system.openApi.switchEnabledSuccess')
        : $t('system.openApi.switchDisabledSuccess'),
    );
    gridApi.query();
  } finally {
    switchLoading.value = false;
  }
}

// ---------------------------------------------------------------- 密钥列表
const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: buildColumns(onActionClick),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }) => {
          return await getMyKeys({
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
      search: false,
      zoom: true,
    },
  } as VxeTableGridOptions<OpenApiConsole.OpenAPIKey>,
});

function onActionClick({
  code,
  row,
}: OnActionClickParams<OpenApiConsole.OpenAPIKey>) {
  if (code === 'reset') onReset(row);
  if (code === 'revoke') onRevoke(row);
}

async function onRefresh() {
  gridApi.query();
}

// ---------------------------------------------------------------- 签发
const issueOpen = ref(false);
const issuing = ref(false);
const scopeOptions = ref<OpenApiConsole.ScopeOption[]>([]);
const issueForm = reactive({
  expiresInDays: undefined as number | undefined,
  ipText: '',
  name: '',
  scopes: [] as OpenApiConsole.EndpointCode[],
});

const scopeItems = computed(() =>
  scopeOptions.value.map((item) => ({
    label: item.label,
    value: item.code,
  })),
);

const submitDisabled = computed(
  () => !issueForm.name.trim() || issueForm.scopes.length === 0,
);

async function openIssue() {
  if (scopeOptions.value.length === 0) {
    scopeOptions.value = await getScopeOptions();
  }
  issueForm.name = '';
  issueForm.scopes = scopeOptions.value
    .filter((item) => item.granted)
    .map((item) => item.code);
  issueForm.expiresInDays = undefined;
  issueForm.ipText = '';
  issueOpen.value = true;
}

async function onIssueSubmit() {
  if (submitDisabled.value || issuing.value) return;
  issuing.value = true;
  try {
    const payload: OpenApiConsole.IssueKeyRequest = {
      name: issueForm.name.trim(),
      scopes: issueForm.scopes,
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
    onShowSecret(issued.secretKey);
    await onRefresh();
  } finally {
    issuing.value = false;
  }
}

// ---------------------------------------------------------------- 明文展示
const secretOpen = ref(false);
const secretKey = ref('');
const copied = ref(false);

function onShowSecret(key: string) {
  secretKey.value = key;
  copied.value = false;
  secretOpen.value = true;
}

async function onCopySecret() {
  try {
    await copyText(secretKey.value);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    message.warning($t('system.openApi.copyFailed'));
  }
}

async function onReset(row: OpenApiConsole.OpenAPIKey) {
  if (
    !(await confirmAsync(
      $t('system.openApi.resetConfirmTitle'),
      $t('system.openApi.resetConfirmContent', [row.name]),
    ))
  ) {
    return;
  }
  const issued = await resetKey(row.id);
  onShowSecret(issued.secretKey);
  await onRefresh();
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
    <div class="flex flex-col gap-4">
      <div class="bg-card rounded-md p-6">
        <div class="flex flex-wrap items-center gap-4">
          <Switch
            :checked="switchEnabled"
            :checked-children="$t('system.openApi.switchOn')"
            :loading="switchLoading"
            :un-checked-children="$t('system.openApi.switchOff')"
            @update:checked="(value) => onSwitchChange(Boolean(value))"
          />
          <Alert
            show-icon
            type="info"
            :message="$t('system.openApi.endpoint', [`${apiBase}/open-api`, 'X-Open-Key'])"
          />
        </div>
        <Alert
          v-if="issueBlockReason"
          class="mt-4"
          show-icon
          type="warning"
          :message="issueBlockReason"
        />
      </div>

      <Grid :table-title="$t('system.openApi.userTitle')">
        <template #toolbar-tools>
          <Tooltip :title="issueBlockReason">
            <span class="inline-block">
              <Button
                :disabled="issueDisabled"
                type="primary"
                @click="openIssue"
              >
                <Plus class="size-5" />
                {{ $t('system.openApi.issue') }}
              </Button>
            </span>
          </Tooltip>
        </template>
        <template #status="{ row }">
          <Tag :color="keyState(row).color">{{ keyState(row).label }}</Tag>
        </template>
      </Grid>
    </div>

    <Modal
      v-model:open="issueOpen"
      :confirm-loading="issuing"
      :ok-disabled="submitDisabled"
      :title="$t('system.openApi.issue')"
      :width="520"
      @ok="onIssueSubmit"
    >
      <Form class="mt-4" layout="vertical">
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
      <div class="flex items-center gap-2">
        <Input :value="secretKey" class="flex-1 font-mono" readonly />
        <Button @click="onCopySecret">
          {{ copied ? $t('system.openApi.copied') : $t('system.openApi.copy') }}
        </Button>
      </div>
      <div class="mt-4 flex justify-end">
        <Button type="primary" @click="secretOpen = false">
          {{ $t('common.confirm') }}
        </Button>
      </div>
    </Modal>
  </Page>
</template>
