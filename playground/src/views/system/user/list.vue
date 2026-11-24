<script lang="ts" setup>
import type { UserActionPermissions } from './data';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { SystemUserApi } from '#/api/system/user';

import { computed, ref, shallowRef } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { useAccessStore, useUserStore } from '@vben/stores';

import { Button, Input, InputNumber, message, Modal, Radio, Spin, Switch } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  adjustUserAssets,
  deleteUser,
  getUser,
  getUserList,
  getUserSpecifiedResponse,
  updateUserSpecifiedResponse,
} from '#/api/system/user';
import { formatSettlementPrice } from '#/composables/use-settlement-currency';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const accessStore = useAccessStore();

const specifiedResponsePlaceholder = '{"code":200,"message":"success","data":null}';
const userStore = useUserStore();
const isAdmin = computed(() => userStore.userRoles.includes('admin'));
const hasCode = (code: string) => isAdmin.value || accessStore.accessCodes.includes(code);
const canCreate = computed(() => hasCode('system:user:create'));
const actionPermissions = computed<UserActionPermissions>(() => ({
  assetAdjust: hasCode('system:user:balance-adjust'),
  delete: hasCode('system:user:delete'),
  specifiedResponse: hasCode('system:user:specified-response'),
  update: hasCode('system:user:update'),
}));

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const specifiedResponseVisible = ref(false);
const specifiedResponseSaving = ref(false);
const specifiedResponseLoading = ref(false);
const showUnmaskedSensitive = shallowRef(false);
const currentSpecifiedResponseUser = ref<SystemUserApi.SystemUser>();
const specifiedResponseForm = ref<SystemUserApi.SpecifiedResponseConfig>({
  specifiedResponseBillable: 0,
  specifiedResponseBody: '',
  specifiedResponseEnabled: 0,
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(onActionClick, actionPermissions.value),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          return await getUserList({
            page: page.currentPage,
            pageSize: page.pageSize,
            unmasked: showUnmaskedSensitive.value ? 1 : undefined,
            ...formValues,
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
  } as VxeTableGridOptions<SystemUserApi.SystemUser>,
});

function onActionClick({
  code,
  row,
}: OnActionClickParams<SystemUserApi.SystemUser>) {
  switch (code) {
    case 'delete': {
      if (actionPermissions.value.delete) onDelete(row);
      break;
    }
    case 'edit': {
      if (actionPermissions.value.update) onEdit(row);
      break;
    }
    case 'assetAdjust': {
      if (actionPermissions.value.assetAdjust) onOpenAssetAdjust(row);
      break;
    }
    case 'specifiedResponse': {
      if (actionPermissions.value.specifiedResponse) onEditSpecifiedResponse(row);
      break;
    }
  }
}

function onCreate() {
  if (!canCreate.value) return;
  formDrawerApi.setData({}).open();
}

function onEdit(row: SystemUserApi.SystemUser) {
  if (!actionPermissions.value.update) return;
  formDrawerApi.setData(row).open();
}

async function onEditSpecifiedResponse(row: SystemUserApi.SystemUser) {
  if (!actionPermissions.value.specifiedResponse) return;
  currentSpecifiedResponseUser.value = row;
  specifiedResponseForm.value = {
    specifiedResponseBillable: row.specifiedResponseBillable ?? 0,
    specifiedResponseBody: '',
    specifiedResponseEnabled: row.specifiedResponseEnabled ?? 0,
  };
  specifiedResponseVisible.value = true;
  specifiedResponseLoading.value = true;
  try {
    const config = await getUserSpecifiedResponse(row.id);
    specifiedResponseForm.value = {
      specifiedResponseBillable: config.specifiedResponseBillable ?? 0,
      specifiedResponseBody: config.specifiedResponseBody ?? '',
      specifiedResponseEnabled: config.specifiedResponseEnabled ?? 0,
    };
  } finally {
    specifiedResponseLoading.value = false;
  }
}

async function onSaveSpecifiedResponse() {
  if (!actionPermissions.value.specifiedResponse) return;
  const row = currentSpecifiedResponseUser.value;
  if (!row) {
    return;
  }
  if (
    specifiedResponseForm.value.specifiedResponseEnabled === 1 &&
    !specifiedResponseForm.value.specifiedResponseBody.trim()
  ) {
    message.warning($t('system.user.specifiedResponseBodyRequired'));
    return;
  }
  specifiedResponseSaving.value = true;
  try {
    await updateUserSpecifiedResponse(row.id, specifiedResponseForm.value);
    message.success($t('system.user.specifiedResponseSaveSuccess'));
    specifiedResponseVisible.value = false;
    onRefresh();
  } finally {
    specifiedResponseSaving.value = false;
  }
}

function onSpecifiedResponseClosed() {
  currentSpecifiedResponseUser.value = undefined;
  specifiedResponseForm.value = {
    specifiedResponseBillable: 0,
    specifiedResponseBody: '',
    specifiedResponseEnabled: 0,
  };
}

const assetAdjustVisible = ref(false);
const assetAdjustLoading = ref(false);
const assetAdjustSaving = ref(false);
const assetAdjustUser = ref<SystemUserApi.SystemUser>();
const assetAdjustForm = ref<{
  balance: number;
  mode: 'decrease' | 'increase';
  points: number;
  reason: string;
}>({
  balance: 0,
  mode: 'increase',
  points: 0,
  reason: '',
});

async function onOpenAssetAdjust(row: SystemUserApi.SystemUser) {
  assetAdjustUser.value = row;
  assetAdjustForm.value = {
    balance: 0,
    mode: 'increase',
    points: 0,
    reason: '',
  };
  assetAdjustVisible.value = true;
  assetAdjustLoading.value = true;
  try {
    // 列表行可能是几秒前的快照；打开弹窗时读取最新资产，避免管理员按旧值判断。
    assetAdjustUser.value = await getUser(row.id);
  } catch {
    // 读取失败时仍允许基于列表行展示，提交时后端会再次校验余额。
  } finally {
    assetAdjustLoading.value = false;
  }
}

function onAssetAdjustClosed() {
  assetAdjustUser.value = undefined;
  assetAdjustForm.value = {
    balance: 0,
    mode: 'increase',
    points: 0,
    reason: '',
  };
}

async function onSubmitAssetAdjust() {
  const user = assetAdjustUser.value;
  if (!user) return;
  const balance = Number(assetAdjustForm.value.balance || 0);
  const points = Number(assetAdjustForm.value.points || 0);
  if (balance <= 0 && points <= 0) {
    message.warning($t('system.user.assetAdjustEmpty'));
    return;
  }
  const reason = assetAdjustForm.value.reason.trim();
  if (!reason) {
    message.warning($t('system.user.assetAdjustReasonRequired'));
    return;
  }
  const sign = assetAdjustForm.value.mode === 'decrease' ? -1 : 1;
  assetAdjustSaving.value = true;
  try {
    const result = await adjustUserAssets(user.id, {
      balanceDelta: (sign * balance).toFixed(4),
      pointsDelta: sign * points,
      reason,
    });
    message.success(
      $t('system.user.assetAdjustSuccess', [
        formatSettlementPrice(result.balance, 4),
        Number(result.points).toLocaleString(),
      ]),
    );
    assetAdjustVisible.value = false;
    onRefresh();
  } finally {
    assetAdjustSaving.value = false;
  }
}

function onDelete(row: SystemUserApi.SystemUser) {
  if (!actionPermissions.value.delete) return;
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.username]),
    duration: 0,
    key: 'action_process_msg',
  });
  deleteUser(row.id)
    .then(() => {
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.username]),
        key: 'action_process_msg',
      });
      onRefresh();
    })
    .catch(() => {
      hideLoading();
    });
}

function onRefresh() {
  gridApi.query();
}
</script>

<template>
  <Page auto-content-height>
    <FormDrawer @success="onRefresh" />
    <Grid :table-title="$t('system.user.list')">
      <template #toolbar-tools>
        <div v-if="isAdmin" class="sensitive-toggle">
          <span>{{ $t('system.interface.rawSensitiveLabel') }}</span>
          <Switch
            v-model:checked="showUnmaskedSensitive"
            size="small"
            @change="onRefresh"
          />
        </div>
        <Button v-if="canCreate" type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('system.user.listTitle')]) }}
        </Button>
      </template>
    </Grid>
    <Modal
      v-if="actionPermissions.specifiedResponse"
      v-model:open="specifiedResponseVisible"
      :confirm-loading="specifiedResponseSaving"
      :destroy-on-close="true"
      :title="$t('system.user.specifiedResponseManage')"
      width="min(820px, calc(100vw - 32px))"
      @after-close="onSpecifiedResponseClosed"
      @ok="onSaveSpecifiedResponse"
    >
      <div class="space-y-4">
        <div class="text-[13px] text-[var(--vben-text-secondary-color)]">
          {{ $t('system.user.specifiedResponseHint') }}
        </div>
        <div class="grid gap-3 md:grid-cols-2">
          <div class="specified-response-switch-item">
            <span>{{ $t('system.user.specifiedResponseEnabled') }}</span>
            <Switch
              v-model:checked="specifiedResponseForm.specifiedResponseEnabled"
              :checked-value="1"
              :un-checked-value="0"
            />
          </div>
          <div class="specified-response-switch-item">
            <span>{{ $t('system.user.specifiedResponseBillable') }}</span>
            <Switch
              v-model:checked="specifiedResponseForm.specifiedResponseBillable"
              :checked-value="1"
              :disabled="specifiedResponseForm.specifiedResponseEnabled !== 1"
              :un-checked-value="0"
            />
          </div>
        </div>
        <Input.TextArea
          v-model:value="specifiedResponseForm.specifiedResponseBody"
          class="user-specified-response-editor"
          :disabled="specifiedResponseLoading"
          :placeholder="$t('system.user.specifiedResponsePlaceholder', [specifiedResponsePlaceholder])"
          :rows="16"
        />
      </div>
    </Modal>
    <Modal
      v-if="actionPermissions.assetAdjust"
      v-model:open="assetAdjustVisible"
      :confirm-loading="assetAdjustSaving"
      :destroy-on-close="true"
      :title="
        $t('system.user.assetAdjustTitle', [
          assetAdjustUser?.username ?? '',
        ])
      "
      width="min(560px, calc(100vw - 32px))"
      @after-close="onAssetAdjustClosed"
      @ok="onSubmitAssetAdjust"
    >
      <Spin :spinning="assetAdjustLoading">
        <div class="asset-adjust">
          <div class="asset-adjust__summary">
            <div class="asset-adjust__stat">
              <span>{{ $t('system.user.balance') }}</span>
              <strong>{{
                formatSettlementPrice(assetAdjustUser?.balance, 4)
              }}</strong>
            </div>
            <div class="asset-adjust__stat">
              <span>{{ $t('system.user.points') }}</span>
              <strong>{{
                Number(assetAdjustUser?.points ?? 0).toLocaleString()
              }}</strong>
            </div>
          </div>
          <p class="asset-adjust__hint">
            {{ $t('system.user.assetAdjustHint') }}
          </p>
          <div class="asset-adjust__field">
            <span class="asset-adjust__label">
              {{ $t('system.user.assetAdjustMode') }}
            </span>
            <Radio.Group
              v-model:value="assetAdjustForm.mode"
              button-style="solid"
            >
              <Radio.Button value="increase">
                {{ $t('system.user.assetAdjustIncrease') }}
              </Radio.Button>
              <Radio.Button value="decrease">
                {{ $t('system.user.assetAdjustDecrease') }}
              </Radio.Button>
            </Radio.Group>
          </div>
          <div class="asset-adjust__grid">
            <label class="asset-adjust__field-column">
              <span class="asset-adjust__label">
                {{ $t('system.user.assetAdjustBalance') }}
              </span>
              <InputNumber
                v-model:value="assetAdjustForm.balance"
                :min="0"
                :precision="4"
                class="w-full"
              />
            </label>
            <label class="asset-adjust__field-column">
              <span class="asset-adjust__label">
                {{ $t('system.user.assetAdjustPoints') }}
              </span>
              <InputNumber
                v-model:value="assetAdjustForm.points"
                :min="0"
                :precision="0"
                class="w-full"
              />
            </label>
          </div>
          <label class="asset-adjust__field-column">
            <span class="asset-adjust__label">
              {{ $t('system.user.assetAdjustReason') }}
            </span>
            <Input.TextArea
              v-model:value="assetAdjustForm.reason"
              :maxlength="100"
              :placeholder="$t('system.user.assetAdjustReasonPlaceholder')"
              :rows="3"
              show-count
            />
          </label>
        </div>
      </Spin>
    </Modal>
  </Page>
</template>

<style scoped>
.specified-response-switch-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 44px;
  padding: 10px 12px;
  color: var(--vben-text-color);
  background: var(--vben-bg-color);
  border: 1px solid var(--vben-border-color);
  border-radius: 8px;
}

.sensitive-toggle {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  min-height: 32px;
  padding: 0 10px;
  font-size: 13px;
  color: var(--vben-text-secondary-color);
  background: var(--vben-bg-color);
  border: 1px solid var(--vben-border-color);
  border-radius: 6px;
}

:deep(.user-specified-response-editor) {
  min-height: 380px;
  max-height: min(64vh, 620px);
  overflow-y: auto;
  font-family:
    'JetBrains Mono', SFMono-Regular, Consolas, 'Liberation Mono', monospace;
  line-height: 1.6;
  white-space: pre;
  resize: vertical;
}

.asset-adjust {
  display: grid;
  gap: 14px;
  padding-top: 4px;
}

.asset-adjust__summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.asset-adjust__stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  background: hsl(var(--muted) / 45%);
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
}

.asset-adjust__stat span {
  font-size: 11px;
  color: hsl(var(--muted-foreground));
}

.asset-adjust__stat strong {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 18px;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--foreground));
}

.asset-adjust__hint {
  padding: 8px 11px;
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--primary) / 6%);
  border: 1px solid hsl(var(--primary) / 16%);
  border-radius: 8px;
}

.asset-adjust__field {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}

.asset-adjust__field-column {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.asset-adjust__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.asset-adjust__label {
  font-size: 12px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

@media (max-width: 520px) {
  .asset-adjust__grid,
  .asset-adjust__summary {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 767px) {
  :deep(.user-specified-response-editor) {
    min-height: 280px;
    max-height: 52vh;
  }
}
</style>
