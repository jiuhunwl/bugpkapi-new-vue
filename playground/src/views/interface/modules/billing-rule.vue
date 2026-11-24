<script lang="ts" setup>
import type { InterfaceApi } from '#/api/interface';
import type { SystemRoleApi } from '#/api/system/role';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { IconifyIcon, Plus } from '@vben/icons';

import {
  Alert,
  Button,
  Empty,
  Input,
  message,
  Select,
  Switch,
} from 'ant-design-vue';

import {
  getInterfaceBillingRules,
  getInterfaceMetering,
  saveInterfaceBillingRules,
  updateInterfaceMetering,
} from '#/api/interface';
import { getRoleOptions } from '#/api/system/role';
import { $t } from '#/locales';

const emits = defineEmits(['success']);

interface RuleDraft extends InterfaceApi.BillingRule {
  clientId: string;
}

interface MeteringRoleRow {
  assetMode: InterfaceApi.MeteringAssetMode;
  groupMode: InterfaceApi.MeteringGroupMode;
  packageMode: InterfaceApi.MeteringPackageMode;
  roleId: number;
  roleKey: string;
  roleName: string;
}

const current = ref<InterfaceApi.InterfaceItem>();
const loading = ref(false);
const loadFailed = ref(false);
const loadFailDetail = ref('');
const billingEnabled = ref(true);
const billingLogEnabled = ref(true);
const rules = ref<RuleDraft[]>([]);

// 三维计量策略：inherit 沿用既有判定链，所以新接口默认全 inherit 即零行为变更。
const assetMode = ref<InterfaceApi.MeteringAssetMode>('inherit');
const packageMode = ref<InterfaceApi.MeteringPackageMode>('inherit');
const groupMode = ref<InterfaceApi.MeteringGroupMode>('inherit');
const meteringRows = ref<MeteringRoleRow[]>([]);
const meteringLoadFailed = ref(false);
// 兜底闸门状态由后端随策略一起返回：三维全免时接口全平台总量是唯一限流来源。
const guardEnabled = ref(0);
const guardAllUsersSet = ref(false);

const assetOptions = computed(() => [
  { label: $t('billingPolicy.modeInherit'), value: 'inherit' },
  { label: $t('billingPolicy.assetFree'), value: 'free' },
  { label: $t('billingPolicy.assetCharge'), value: 'charge' },
]);

const packageOptions = computed(() => [
  { label: $t('billingPolicy.modeInherit'), value: 'inherit' },
  { label: $t('billingPolicy.packageConsume'), value: 'consume' },
  { label: $t('billingPolicy.packageSkip'), value: 'skip' },
]);

const groupOptions = computed(() => [
  { label: $t('billingPolicy.modeInherit'), value: 'inherit' },
  { label: $t('billingPolicy.groupCount'), value: 'count' },
  { label: $t('billingPolicy.groupSkip'), value: 'skip' },
]);

// 三维是否全部免计量：与后端 requireUnmeteredGuard 同口径，前端提前提示，
// 避免用户在扣费规则已经保存之后才收到一个 400。
const fullyUnmetered = computed(() => {
  const rows = [
    { assetMode: assetMode.value, packageMode: packageMode.value, groupMode: groupMode.value },
    ...meteringRows.value,
  ];
  const inherited = (value: string, base: string) =>
    value === 'inherit' ? base : value;
  return rows.some(
    (row) =>
      inherited(row.assetMode, assetMode.value) === 'free' &&
      inherited(row.packageMode, packageMode.value) === 'skip' &&
      inherited(row.groupMode, groupMode.value) === 'skip',
  );
});

const guardMissing = computed(
  () => fullyUnmetered.value && !(guardEnabled.value === 1 && guardAllUsersSet.value),
);

const loadFailMessage = computed(() =>
  loadFailDetail.value
    ? $t('billingPolicy.loadFailed') + `（${loadFailDetail.value}）`
    : $t('billingPolicy.loadFailed'),
);

function extractFailDetail(error: unknown): string {
  const response = (error as {
    response?: { data?: { message?: string; error?: string }; status?: number };
  })?.response;
  const backendMsg = response?.data?.message ?? response?.data?.error;
  const statusCode = response?.status;
  const fallbackMsg =
    error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const detail = backendMsg || fallbackMsg || (statusCode ? `HTTP ${statusCode}` : '');
  return detail;
}

async function reloadRules() {
  if (!current.value?.id || loading.value) return;
  loadFailed.value = false;
  loadFailDetail.value = '';
  loading.value = true;
  drawerApi.setState({ showConfirmButton: false });
  try {
    const result = await getInterfaceBillingRules(current.value.id);
    // 后端 nil slice 序列化为 JSON null 时避免 `null.map` 抛错被误判为加载失败。
    rules.value = (Array.isArray(result) ? result : []).map((rule) => ({
      ...rule,
      clientId: createClientId(),
    }));
    await loadMetering(current.value.id);
  } catch (error) {
    loadFailed.value = true;
    loadFailDetail.value = extractFailDetail(error);
  } finally {
    drawerApi.setState({ showConfirmButton: !loadFailed.value });
    loading.value = false;
  }
}

function emptyMeteringRow(role: SystemRoleApi.RoleOption): MeteringRoleRow {
  return {
    assetMode: 'inherit',
    groupMode: 'inherit',
    packageMode: 'inherit',
    roleId: Number(role.id),
    roleKey: role.roleKey ?? '',
    roleName: role.name || `#${role.id}`,
  };
}

// 每个用户组一行，和接口配额抽屉同一套交互；只有任一维不是 inherit 时才提交。
function buildMeteringRows(
  roles: SystemRoleApi.RoleOption[],
  overrides: InterfaceApi.InterfaceRoleMetering[] = [],
) {
  const byRole = new Map(
    overrides.map((item) => [Number(item.roleId), item]),
  );
  const rows = (roles ?? []).map((role) => {
    const row = emptyMeteringRow(role);
    const override = byRole.get(row.roleId);
    if (override) {
      row.assetMode = override.assetMode ?? 'inherit';
      row.packageMode = override.packageMode ?? 'inherit';
      row.groupMode = override.groupMode ?? 'inherit';
      byRole.delete(row.roleId);
    }
    return row;
  });
  // 已删除的用户组仍可能留有覆盖行，保留展示以免静默丢配置。
  for (const item of byRole.values()) {
    rows.push({
      assetMode: item.assetMode ?? 'inherit',
      groupMode: item.groupMode ?? 'inherit',
      packageMode: item.packageMode ?? 'inherit',
      roleId: Number(item.roleId),
      roleKey: item.roleKey ?? '',
      roleName: item.roleName || `#${item.roleId}`,
    });
  }
  return rows;
}

function meteringPayload(): InterfaceApi.InterfaceMeteringPolicy {
  return {
    assetMode: assetMode.value,
    guardAllUsersSet: guardAllUsersSet.value,
    guardEnabled: guardEnabled.value as 0 | 1,
    groupMode: groupMode.value,
    packageMode: packageMode.value,
    roleOverrides: meteringRows.value
      .filter(
        (row) =>
          row.assetMode !== 'inherit' ||
          row.packageMode !== 'inherit' ||
          row.groupMode !== 'inherit',
      )
      .map((row) => ({
        assetMode: row.assetMode,
        groupMode: row.groupMode,
        packageMode: row.packageMode,
        roleId: row.roleId,
      })),
  };
}

async function loadMetering(id: number | string) {
  meteringLoadFailed.value = false;
  try {
    const [policy, roles] = await Promise.all([
      getInterfaceMetering(id),
      getRoleOptions().catch(() => [] as SystemRoleApi.RoleOption[]),
    ]);
    assetMode.value = policy?.assetMode ?? 'inherit';
    packageMode.value = policy?.packageMode ?? 'inherit';
    groupMode.value = policy?.groupMode ?? 'inherit';
    guardEnabled.value = policy?.guardEnabled ?? 0;
    guardAllUsersSet.value = policy?.guardAllUsersSet ?? false;
    meteringRows.value = buildMeteringRows(
      Array.isArray(roles) ? roles : [],
      Array.isArray(policy?.roleOverrides) ? policy.roleOverrides : [],
    );
  } catch {
    // 计量策略读失败时不把整个抽屉判死：扣费规则仍然可用，但禁止提交策略。
    meteringLoadFailed.value = true;
    meteringRows.value = [];
  }
}

const operatorOptions: Array<{
  label: string;
  value: InterfaceApi.BillingOperator;
}> = [
  { label: $t('system.interface.operatorEq'), value: 'EQ' },
  { label: $t('system.interface.operatorNe'), value: 'NE' },
  { label: $t('system.interface.operatorGt'), value: 'GT' },
  { label: $t('system.interface.operatorLt'), value: 'LT' },
  { label: $t('system.interface.operatorContains'), value: 'CONTAINS' },
];

const [Drawer, drawerApi] = useVbenDrawer({
  async onConfirm() {
    if (!current.value || loading.value || loadFailed.value) return;
    if (!validateRules()) return;
    if (guardMissing.value) {
      message.warning($t('billingPolicy.guardRequired'));
      return;
    }

    drawerApi.lock();
    try {
      await saveInterfaceBillingRules(
        current.value.id,
        rules.value.map((rule, index) => ({
          expectedValue: rule.expectedValue.trim(),
          fieldName: rule.fieldName.trim(),
          operator: rule.operator,
          sortNo: index + 1,
        })),
        {
          billingEnabled: billingEnabled.value ? 1 : 0,
          billingLogEnabled: billingLogEnabled.value ? 1 : 0,
        },
      );
      // 计量策略读失败时绝不提交：此时界面上的默认值全是 inherit，
      // 提交会把该接口已有的策略静默抹回默认。
      if (meteringLoadFailed.value) {
        message.warning($t('billingPolicy.meteringNotSaved'));
      } else {
        await updateInterfaceMetering(current.value.id, meteringPayload());
      }
      message.success($t('system.interface.billingRuleSaveSuccess'));
      emits('success');
      drawerApi.close();
    } finally {
      drawerApi.unlock();
    }
  },

  async onOpenChange(isOpen) {
    if (!isOpen) return;

    current.value = drawerApi.getData<InterfaceApi.InterfaceItem>();
    rules.value = [];
    loadFailed.value = false;
    loadFailDetail.value = '';
    billingEnabled.value = current.value?.billingEnabled !== 0;
    billingLogEnabled.value = current.value?.billingLogEnabled !== 0;
    assetMode.value = 'inherit';
    packageMode.value = 'inherit';
    groupMode.value = 'inherit';
    meteringRows.value = [];
    meteringLoadFailed.value = false;
    guardEnabled.value = 0;
    guardAllUsersSet.value = false;
    if (!current.value?.id) return;

    loading.value = true;
    drawerApi.setState({ showConfirmButton: false });
    try {
      const result = await getInterfaceBillingRules(current.value.id);
      // 后端 nil slice 序列化为 JSON null 时避免 `null.map` 抛错被误判为加载失败。
      rules.value = (Array.isArray(result) ? result : []).map((rule) => ({
        ...rule,
        clientId: createClientId(),
      }));
      await loadMetering(current.value.id);
    } catch (error) {
      loadFailed.value = true;
      loadFailDetail.value = extractFailDetail(error);
    } finally {
      drawerApi.setState({ showConfirmButton: !loadFailed.value });
      loading.value = false;
    }
  },
});

const drawerTitle = computed(() =>
  $t('system.interface.billingRuleTitle', [current.value?.name ?? '']),
);

function addRule() {
  rules.value.push({
    clientId: createClientId(),
    expectedValue: '',
    fieldName: 'code',
    operator: 'EQ',
  });
}

function removeRule(index: number) {
  rules.value.splice(index, 1);
}

function validateRules() {
  for (const rule of rules.value) {
    if (!rule.fieldName?.trim()) {
      message.warning($t('system.interface.billingFieldRequired'));
      return false;
    }
    if (!rule.operator) {
      message.warning($t('system.interface.billingOperatorRequired'));
      return false;
    }
    if (!rule.expectedValue?.trim()) {
      message.warning($t('system.interface.billingValueRequired'));
      return false;
    }
  }
  return true;
}

function createClientId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
</script>

<template>
  <Drawer :title="drawerTitle">
    <div class="billing-rule-panel">
      <Alert
        v-if="loadFailed"
        type="error"
        show-icon
        :message="loadFailMessage"
      >
        <template #action>
          <Button size="small" :loading="loading" @click="reloadRules">
            {{ $t('billingPolicy.retry') }}
          </Button>
        </template>
      </Alert>
      <div class="billing-policy-switches">
        <div class="billing-policy-switch">
          <div>
            <h3>{{ $t('billingPolicy.enabled') }}</h3>
            <p>{{ $t('billingPolicy.enabledHelp') }}</p>
          </div>
          <Switch
            v-model:checked="billingEnabled"
            :disabled="loading || loadFailed"
            :aria-label="$t('billingPolicy.enabled')"
          />
        </div>
        <div class="billing-policy-switch">
          <div>
            <h3>{{ $t('billingPolicy.logEnabled') }}</h3>
            <p>{{ $t('billingPolicy.logHelp') }}</p>
          </div>
          <Switch
            v-model:checked="billingLogEnabled"
            :disabled="loading || loadFailed"
            :aria-label="$t('billingPolicy.logEnabled')"
          />
        </div>
      </div>
      <div class="billing-metering">
        <div class="billing-metering__intro">
          <h3>{{ $t('billingPolicy.meteringTitle') }}</h3>
          <p>{{ $t('billingPolicy.meteringHelp') }}</p>
        </div>
        <Alert
          v-if="meteringLoadFailed"
          data-testid="metering-load-failed"
          show-icon
          type="warning"
          :message="$t('billingPolicy.meteringLoadFailed')"
        />
        <template v-else>
          <div class="billing-metering__grid">
            <div
              class="billing-metering__field"
              data-testid="metering-field-asset"
            >
              <span class="billing-metering__label">
                {{ $t('billingPolicy.assetLabel') }}
              </span>
              <Select
                v-model:value="assetMode"
                :disabled="loading"
                :options="assetOptions"
              />
              <small>{{ $t('billingPolicy.assetHelp') }}</small>
            </div>
            <div
              class="billing-metering__field"
              data-testid="metering-field-package"
            >
              <span class="billing-metering__label">
                {{ $t('billingPolicy.packageLabel') }}
              </span>
              <Select
                v-model:value="packageMode"
                :disabled="loading"
                :options="packageOptions"
              />
              <small>{{ $t('billingPolicy.packageHelp') }}</small>
            </div>
            <div
              class="billing-metering__field"
              data-testid="metering-field-group"
            >
              <span class="billing-metering__label">
                {{ $t('billingPolicy.groupLabel') }}
              </span>
              <Select
                v-model:value="groupMode"
                :disabled="loading"
                :options="groupOptions"
              />
              <small>{{ $t('billingPolicy.groupHelp') }}</small>
            </div>
          </div>
          <Alert
            v-if="guardMissing"
            class="billing-metering__guard"
            data-testid="metering-guard"
            show-icon
            type="error"
            :message="$t('billingPolicy.guardRequired')"
          />
          <div v-if="meteringRows.length > 0" class="billing-metering__roles">
            <div class="billing-metering__roles-head">
              <div>
                <h4>{{ $t('billingPolicy.roleTitle') }}</h4>
                <p>{{ $t('billingPolicy.roleHelp') }}</p>
              </div>
            </div>
            <div class="billing-metering__role-row billing-metering__role-row--head">
              <span>{{ $t('billingPolicy.roleColumnRole') }}</span>
              <span>{{ $t('billingPolicy.assetLabel') }}</span>
              <span>{{ $t('billingPolicy.packageLabel') }}</span>
              <span>{{ $t('billingPolicy.groupLabel') }}</span>
            </div>
            <div
              v-for="row in meteringRows"
              :key="row.roleId"
              class="billing-metering__role-row"
              data-testid="metering-role-row"
            >
              <span class="billing-metering__role-name" :title="row.roleKey">
                {{ row.roleName }}
              </span>
              <Select
                v-model:value="row.assetMode"
                :disabled="loading"
                :options="assetOptions"
              />
              <Select
                v-model:value="row.packageMode"
                :disabled="loading"
                :options="packageOptions"
              />
              <Select
                v-model:value="row.groupMode"
                :disabled="loading"
                :options="groupOptions"
              />
            </div>
          </div>
          <p v-else class="billing-metering__roles-empty">
            {{ $t('billingPolicy.roleEmpty') }}
          </p>
        </template>
      </div>
      <Alert
        show-icon
        type="info"
        :message="$t('system.interface.billingRuleTip')"
      />

      <div class="billing-rule-toolbar">
        <div>
          <div class="billing-rule-toolbar__title">
            {{ $t('system.interface.billingConditions') }}
          </div>
          <div class="billing-rule-toolbar__desc">
            {{ $t('system.interface.billingDefaultTip') }}
          </div>
        </div>
        <Button type="primary" @click="addRule">
          <Plus class="size-4" />
          {{ $t('system.interface.addBillingRule') }}
        </Button>
      </div>

      <div v-if="loading" class="billing-rule-loading">
        {{ $t('system.interface.billingRuleLoading') }}
      </div>

      <template v-else>
        <div v-if="rules.length > 0" class="billing-rule-list">
          <div
            v-for="(rule, index) in rules"
            :key="rule.clientId"
            class="billing-rule-item"
          >
            <div class="billing-rule-item__index">{{ index + 1 }}</div>
            <div class="billing-rule-item__grid">
              <Input
                class="billing-rule-item__field"
                v-model:value="rule.fieldName"
                :placeholder="$t('system.interface.billingFieldPlaceholder')"
              />
              <Select
                class="billing-rule-item__operator"
                v-model:value="rule.operator"
                :options="operatorOptions"
                :placeholder="$t('system.interface.billingOperator')"
              />
              <Input
                class="billing-rule-item__value"
                v-model:value="rule.expectedValue"
                :placeholder="$t('system.interface.billingValuePlaceholder')"
              />
              <Button
                class="billing-rule-item__delete"
                danger
                type="text"
                :aria-label="$t('common.delete')"
                :title="$t('common.delete')"
                @click="removeRule(index)"
              >
                <IconifyIcon class="size-4" icon="lucide:trash-2" />
              </Button>
            </div>
          </div>
        </div>
        <div v-else class="billing-rule-empty">
          <Empty :description="$t('system.interface.billingRuleEmpty')" />
        </div>
      </template>
    </div>
  </Drawer>
</template>

<style scoped>
.billing-policy-switches {
  display: grid;
  gap: 16px;
}
.billing-policy-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}
.billing-policy-switch h3 {
  margin: 0 0 4px;
  font-weight: 600;
}
.billing-policy-switch p {
  margin: 0;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 1.6;
}

.billing-rule-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
  overflow-x: hidden;
}

.billing-rule-toolbar {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: hsl(var(--muted) / 35%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.billing-rule-toolbar__title {
  font-size: 16px;
  font-weight: 700;
  color: hsl(var(--foreground));
}

.billing-rule-toolbar__desc {
  margin-top: 4px;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.billing-rule-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.billing-rule-item {
  display: flex;
  gap: 12px;
  min-width: 0;
  padding: 14px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.billing-rule-item__index {
  display: flex;
  flex: 0 0 28px;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  font-size: 13px;
  font-weight: 700;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
  border-radius: 999px;
}

.billing-rule-item__grid {
  display: grid;
  flex: 1;
  grid-template-columns: minmax(0, 1.05fr) 118px minmax(0, 1.15fr) 34px;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.billing-rule-item__grid :deep(.ant-input),
.billing-rule-item__grid :deep(.ant-select) {
  width: 100%;
  min-width: 0;
}

.billing-rule-item__delete {
  width: 34px;
  height: 34px;
  padding: 0;
}

.billing-rule-empty,
.billing-rule-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 220px;
  color: hsl(var(--muted-foreground));
  border: 1px dashed hsl(var(--border));
  border-radius: 8px;
}

@media (max-width: 768px) {
  .billing-rule-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .billing-rule-item__grid {
    grid-template-columns: 1fr;
  }
}
.billing-metering {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  background: hsl(var(--muted) / 25%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.billing-metering__intro h3 {
  margin: 0 0 4px;
  font-weight: 600;
}

.billing-metering__intro p {
  margin: 0;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 1.6;
}

.billing-metering__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.billing-metering__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.billing-metering__label {
  font-size: 13px;
  font-weight: 600;
}

.billing-metering__field small {
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  line-height: 1.5;
}

.billing-metering__roles {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.billing-metering__roles-head h4 {
  margin: 0 0 4px;
  font-size: 13px;
  font-weight: 600;
}

.billing-metering__roles-head p {
  margin: 0;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 1.6;
}

.billing-metering__role-row {
  display: grid;
  grid-template-columns: minmax(96px, 1.2fr) repeat(3, minmax(0, 1fr));
  gap: 10px;
  align-items: center;
}

.billing-metering__role-row--head {
  color: hsl(var(--muted-foreground));
  font-size: 11px;
}

.billing-metering__role-name {
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.billing-metering__roles-empty {
  margin: 0;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

@media (max-width: 720px) {
  .billing-metering__grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .billing-metering__role-row {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .billing-metering__role-name {
    grid-column: 1 / -1;
    white-space: normal;
  }

  .billing-metering__role-row--head {
    display: none;
  }
}
</style>
