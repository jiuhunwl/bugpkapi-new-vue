<script lang="ts" setup>
import type { InterfaceApi } from '#/api/interface';
import type { SystemRoleApi } from '#/api/system/role';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import {
  Alert,
  Input,
  InputNumber,
  message,
  Select,
  Switch,
} from 'ant-design-vue';

import {
  getInterfaceDegrade,
  getInterfaceList,
  updateInterfaceDegrade,
} from '#/api/interface';
import { getRoleOptions } from '#/api/system/role';
import { $t } from '#/locales';

const emits = defineEmits(['success']);

interface TargetOption {
  label: string;
  value: string;
}

type TargetMode = 'custom' | 'inherit' | 'interface';

interface RoleRow {
  enabled: boolean;
  roleId: number;
  roleKey: string;
  roleName: string;
  targetInterfaceId?: string;
  targetMode: TargetMode;
  targetUrl: string;
  threshold: number;
  window: InterfaceApi.InterfaceDegradeWindow;
}

const current = ref<InterfaceApi.InterfaceItem>();
const loading = ref(false);
const loadFailed = ref(false);
const saving = ref(false);
const enabled = ref(false);
const defaultTargetMode = ref<'custom' | 'interface'>('interface');
const defaultTargetId = ref<string>();
const defaultTargetUrl = ref('');
const roleRows = ref<RoleRow[]>([]);
const currentRoleOptions = ref<SystemRoleApi.RoleOption[]>([]);

// 远程搜索结果与已选目标合并：下拉只展示当前搜索结果，但已选中的目标
// 始终保留标签，避免搜索词变化后显示成裸 ID。
const knownTargets = ref(new Map<string, TargetOption>());
const searchResults = ref<TargetOption[]>([]);
const selectedTargetValues = computed(() => {
  const values = new Set<string>();
  if (defaultTargetId.value) values.add(String(defaultTargetId.value));
  for (const row of roleRows.value) {
    if (row.targetInterfaceId) values.add(String(row.targetInterfaceId));
  }
  return values;
});
const targetOptions = computed(() => {
  const merged = new Map<string, TargetOption>();
  for (const option of searchResults.value) {
    merged.set(option.value, option);
  }
  for (const value of selectedTargetValues.value) {
    const option = knownTargets.value.get(value);
    if (option && !merged.has(value)) merged.set(value, option);
  }
  return Array.from(merged.values());
});
let targetSearchToken = 0;
let targetSearchTimer: ReturnType<typeof setTimeout> | undefined;

const roleWindowOptions = computed(() => [
  { label: $t('interfaceDegrade.windowDay'), value: 'day' },
  { label: $t('interfaceDegrade.windowWeek'), value: 'week' },
  { label: $t('interfaceDegrade.windowMonth'), value: 'month' },
  { label: $t('interfaceDegrade.windowTotal'), value: 'total' },
]);

const defaultTargetModeOptions = computed(() => [
  { label: $t('interfaceDegrade.targetInterface'), value: 'interface' },
  { label: $t('interfaceDegrade.targetCustom'), value: 'custom' },
]);

const roleTargetModeOptions = computed(() => [
  { label: $t('interfaceDegrade.targetInherit'), value: 'inherit' },
  { label: $t('interfaceDegrade.targetInterface'), value: 'interface' },
  { label: $t('interfaceDegrade.targetCustom'), value: 'custom' },
]);

function isHTTPURL(value: string) {
  return /^https?:\/\/\S+$/i.test(value.trim());
}

function targetLabel(item: {
  apiCode?: string;
  id: number | string;
  name: string;
}) {
  return `#${item.id} · ${item.name}${item.apiCode ? ` (${item.apiCode})` : ''}`;
}

function rememberTargetOption(option: TargetOption) {
  if (!option.value) return;
  const next = new Map(knownTargets.value);
  next.set(option.value, option);
  knownTargets.value = next;
}

function rememberTarget(
  id?: number | string,
  code?: string,
  name?: string,
) {
  if (!id) return;
  const value = String(id);
  rememberTargetOption({
    label: `#${value} · ${name || code || value}`,
    value,
  });
}

function emptyRow(role: SystemRoleApi.RoleOption): RoleRow {
  return {
    enabled: false,
    roleId: Number(role.id),
    roleKey: role.roleKey,
    roleName: role.name,
    targetInterfaceId: undefined,
    targetMode: 'inherit',
    targetUrl: '',
    threshold: 0,
    window: 'day',
  };
}

function resetRows(overrides: InterfaceApi.InterfaceRoleDegrade[] = []) {
  const byRole = new Map(overrides.map((item) => [Number(item.roleId), item]));
  roleRows.value = [];
  for (const role of currentRoleOptions.value) {
    const row = emptyRow(role);
    const override = byRole.get(row.roleId);
    if (override) {
      row.enabled = Number(override.threshold ?? 0) > 0;
      row.threshold = Number(override.threshold ?? 0);
      row.window = override.window ?? 'day';
      row.targetUrl = override.targetUrl ?? '';
      row.targetMode = override.targetUrl
        ? 'custom'
        : override.targetInterfaceId
          ? 'interface'
          : 'inherit';
      if (override.targetInterfaceId) {
        row.targetInterfaceId = String(override.targetInterfaceId);
        rememberTarget(
          override.targetInterfaceId,
          override.targetInterfaceCode,
          override.targetInterfaceName,
        );
      }
      byRole.delete(row.roleId);
    }
    roleRows.value.push(row);
  }
  // 角色被删除但历史覆盖仍在时保留可见性，避免保存时静默丢配置。
  for (const item of byRole.values()) {
    roleRows.value.push({
      enabled: Number(item.threshold ?? 0) > 0,
      roleId: Number(item.roleId),
      roleKey: item.roleKey ?? '',
      roleName: item.roleName || `#${item.roleId}`,
      targetInterfaceId: item.targetInterfaceId
        ? String(item.targetInterfaceId)
        : undefined,
      targetMode: item.targetUrl
        ? 'custom'
        : item.targetInterfaceId
          ? 'interface'
          : 'inherit',
      targetUrl: item.targetUrl ?? '',
      threshold: Number(item.threshold ?? 0),
      window: item.window ?? 'day',
    });
    rememberTarget(
      item.targetInterfaceId,
      item.targetInterfaceCode,
      item.targetInterfaceName,
    );
  }
}

async function loadPolicy() {
  if (!current.value?.id || loading.value) return;
  loading.value = true;
  loadFailed.value = false;
  drawerApi.setState({ showConfirmButton: false });
  try {
    const [policy, roles] = await Promise.all([
      getInterfaceDegrade(current.value.id),
      getRoleOptions().catch(() => [] as SystemRoleApi.RoleOption[]),
    ]);
    currentRoleOptions.value = Array.isArray(roles) ? roles : [];
    enabled.value = Number(policy.enabled ?? 0) === 1;
    defaultTargetUrl.value = policy.defaultTargetUrl ?? '';
    defaultTargetMode.value = policy.defaultTargetUrl ? 'custom' : 'interface';
    defaultTargetId.value = policy.defaultTargetInterfaceId
      ? String(policy.defaultTargetInterfaceId)
      : undefined;
    rememberTarget(
      policy.defaultTargetInterfaceId,
      policy.defaultTargetInterfaceCode,
      policy.defaultTargetInterfaceName,
    );
    resetRows(Array.isArray(policy.roleOverrides) ? policy.roleOverrides : []);
  } catch {
    loadFailed.value = true;
    message.error($t('interfaceDegrade.loadFailed'));
  } finally {
    loading.value = false;
    drawerApi.setState({ showConfirmButton: !loadFailed.value });
  }
}

async function searchTargets(keyword: string) {
  const token = ++targetSearchToken;
  try {
    const result = await getInterfaceList({
      keyword: keyword || undefined,
      page: 1,
      pageSize: 20,
      status: 1,
    });
    if (token !== targetSearchToken) return;
    const options: TargetOption[] = [];
    for (const item of result.items ?? []) {
      if (String(item.id) === String(current.value?.id)) continue;
      const option = { label: targetLabel(item), value: String(item.id) };
      options.push(option);
      rememberTargetOption(option);
    }
    searchResults.value = options;
  } catch {
    // 目标搜索失败不阻断配置加载；用户仍可保存已有目标。
  }
}

function scheduleTargetSearch(keyword: string) {
  if (targetSearchTimer) clearTimeout(targetSearchTimer);
  targetSearchTimer = setTimeout(() => {
    void searchTargets(keyword);
  }, 300);
}

function onRowToggle(row: RoleRow, checked: boolean) {
  row.enabled = checked;
  if (checked && Number(row.threshold ?? 0) <= 0) {
    row.threshold = 1;
  }
}

function rowsForSave() {
  return roleRows.value
    .filter((row) => row.enabled && Number(row.threshold ?? 0) > 0)
    .map((row) => ({
      roleId: row.roleId,
      threshold: Number(row.threshold ?? 0),
      window: row.window,
      targetInterfaceId:
        row.targetMode === 'interface' && row.targetInterfaceId
          ? Number(row.targetInterfaceId)
          : 0,
      targetUrl: row.targetMode === 'custom' ? row.targetUrl.trim() : '',
    }));
}

function validate(): boolean {
  if (
    defaultTargetMode.value === 'interface' &&
    defaultTargetId.value === String(current.value?.id)
  ) {
    message.error($t('interfaceDegrade.selfTarget'));
    return false;
  }
  const rows = rowsForSave();
  if (enabled.value) {
    if (defaultTargetMode.value === 'interface' && !defaultTargetId.value) {
      message.error($t('interfaceDegrade.defaultTargetRequired'));
      return false;
    }
    if (
      defaultTargetMode.value === 'custom' &&
      !defaultTargetUrl.value.trim()
    ) {
      message.error($t('interfaceDegrade.customUrlRequired'));
      return false;
    }
    if (
      defaultTargetMode.value === 'custom' &&
      !isHTTPURL(defaultTargetUrl.value)
    ) {
      message.error($t('interfaceDegrade.customUrlInvalid'));
      return false;
    }
    if (rows.length === 0) {
      message.error($t('interfaceDegrade.roleRequired'));
      return false;
    }
  }
  if (rows.some((row) => row.threshold <= 0)) {
    message.error($t('interfaceDegrade.thresholdRequired'));
    return false;
  }
  if (
    rows.some(
      (row) =>
        row.targetInterfaceId > 0 &&
        String(row.targetInterfaceId) === String(current.value?.id),
    )
  ) {
    message.error($t('interfaceDegrade.selfTarget'));
    return false;
  }
  if (rows.some((row) => row.targetInterfaceId > 0 && row.targetUrl !== '')) {
    message.error($t('interfaceDegrade.targetAmbiguous'));
    return false;
  }
  if (
    rows.some(
      (row) =>
        row.targetInterfaceId === 0 &&
        row.targetUrl !== '' &&
        !isHTTPURL(row.targetUrl),
    )
  ) {
    message.error($t('interfaceDegrade.customUrlInvalid'));
    return false;
  }
  // Role custom URLs require a value when the row explicitly selected custom.
  for (const row of roleRows.value) {
    if (
      row.enabled &&
      Number(row.threshold ?? 0) > 0 &&
      row.targetMode === 'custom' &&
      !row.targetUrl.trim()
    ) {
      message.error($t('interfaceDegrade.customUrlRequired'));
      return false;
    }
  }
  return true;
}

const [Drawer, drawerApi] = useVbenDrawer({
  async onConfirm() {
    if (!current.value || loading.value || loadFailed.value || saving.value)
      return;
    if (!validate()) return;
    saving.value = true;
    drawerApi.lock();
    try {
      await updateInterfaceDegrade(current.value.id, {
        defaultTargetInterfaceId:
          defaultTargetMode.value === 'interface' && defaultTargetId.value
            ? Number(defaultTargetId.value)
            : 0,
        defaultTargetUrl:
          defaultTargetMode.value === 'custom'
            ? defaultTargetUrl.value.trim()
            : '',
        enabled: enabled.value ? 1 : 0,
        roleOverrides: rowsForSave(),
      });
      message.success($t('interfaceDegrade.saveSuccess'));
      emits('success');
      drawerApi.close();
    } catch {
      message.error($t('interfaceDegrade.saveFailed'));
    } finally {
      saving.value = false;
      drawerApi.unlock();
    }
  },
  async onOpenChange(isOpen) {
    if (!isOpen) return;
    current.value = drawerApi.getData<InterfaceApi.InterfaceItem>();
    if (targetSearchTimer) clearTimeout(targetSearchTimer);
    searchResults.value = [];
    void searchTargets('');
    await loadPolicy();
  },
});

const drawerTitle = computed(() =>
  current.value?.name
    ? $t('interfaceDegrade.titleWithName', [current.value.name])
    : $t('interfaceDegrade.title'),
);
</script>

<template>
  <Drawer :title="drawerTitle" class="w-[min(1180px,96vw)]">
    <div class="interface-degrade">
      <Alert
        show-icon
        type="info"
        :message="$t('interfaceDegrade.description')"
      />

      <section class="interface-degrade__card">
        <div class="interface-degrade__row">
          <span>{{ $t('interfaceDegrade.enable') }}</span>
          <Switch v-model:checked="enabled" />
          <span class="interface-degrade__hint">
            {{ $t('interfaceDegrade.enableHelp') }}
          </span>
        </div>
        <div class="interface-degrade__row">
          <span>{{ $t('interfaceDegrade.defaultTarget') }}</span>
          <Select
            v-model:value="defaultTargetMode"
            class="w-[140px]"
            :options="defaultTargetModeOptions"
          />
          <Select
            v-if="defaultTargetMode === 'interface'"
            v-model:value="defaultTargetId"
            allow-clear
            class="min-w-[320px]"
            :filter-option="false"
            :options="targetOptions"
            :placeholder="$t('interfaceDegrade.defaultTargetPlaceholder')"
            show-search
            @search="scheduleTargetSearch"
          />
          <Input
            v-else
            v-model:value="defaultTargetUrl"
            allow-clear
            class="min-w-[320px]"
            :placeholder="$t('interfaceDegrade.customUrlPlaceholder')"
          />
        </div>
        <p class="interface-degrade__hint">
          {{ $t('interfaceDegrade.defaultTargetHelp') }}
        </p>
        <p v-if="defaultTargetMode === 'custom'" class="interface-degrade__hint">
          {{ $t('interfaceDegrade.customUrlHelp') }}
        </p>
        <p class="interface-degrade__hint">
          {{ $t('interfaceDegrade.quotaHint') }}
        </p>
      </section>

      <section class="interface-degrade__card">
        <h3 class="interface-degrade__section-title">
          {{ $t('interfaceDegrade.roleTitle') }}
        </h3>
        <p class="interface-degrade__hint">
          {{ $t('interfaceDegrade.roleHelp') }}
        </p>
        <div v-if="loading" class="interface-degrade__loading">
          {{ $t('interfaceDegrade.loading') }}
        </div>
        <div v-else class="interface-degrade__role-scroll">
          <div class="interface-degrade__role-grid interface-degrade__role-head">
            <span>{{ $t('interfaceDegrade.role') }}</span>
            <span>{{ $t('interfaceDegrade.roleEnabled') }}</span>
            <span>{{ $t('interfaceDegrade.threshold') }}</span>
            <span>{{ $t('interfaceDegrade.window') }}</span>
            <span>{{ $t('interfaceDegrade.targetOverride') }}</span>
          </div>
          <div
            v-for="row in roleRows"
            :key="row.roleId"
            class="interface-degrade__role-grid interface-degrade__role-row"
          >
            <div class="interface-degrade__role-name">
              <strong>{{ row.roleName }}</strong>
              <small>{{ row.roleKey }}</small>
            </div>
            <Switch
              :checked="row.enabled"
              size="small"
              @change="(checked) => onRowToggle(row, Boolean(checked))"
            />
            <InputNumber
              v-model:value="row.threshold"
              :disabled="!row.enabled"
              :max="1000000000000"
              :min="1"
              :precision="0"
              size="small"
            />
            <Select
              v-model:value="row.window"
              :disabled="!row.enabled"
              :options="roleWindowOptions"
              size="small"
            />
            <div class="interface-degrade__target-cell">
              <Select
                v-model:value="row.targetMode"
                :disabled="!row.enabled"
                :options="roleTargetModeOptions"
                size="small"
              />
              <Select
                v-if="row.targetMode === 'interface'"
                v-model:value="row.targetInterfaceId"
                allow-clear
                :disabled="!row.enabled"
                :filter-option="false"
                :options="targetOptions"
                :placeholder="$t('interfaceDegrade.targetInherit')"
                show-search
                size="small"
                @search="scheduleTargetSearch"
              />
              <Input
                v-else-if="row.targetMode === 'custom'"
                v-model:value="row.targetUrl"
                allow-clear
                :disabled="!row.enabled"
                :placeholder="$t('interfaceDegrade.customUrlPlaceholder')"
                size="small"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  </Drawer>
</template>

<style scoped>
.interface-degrade {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.interface-degrade__card {
  border: 1px solid var(--ant-color-border);
  border-radius: 8px;
  padding: 16px;
}

.interface-degrade__row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}

.interface-degrade__section-title {
  font-size: 15px;
  font-weight: 600;
  margin: 16px 0 6px;
}

.interface-degrade__hint {
  color: var(--ant-color-text-secondary);
  font-size: 12px;
  line-height: 1.6;
  margin: 4px 0;
}

.interface-degrade__role-scroll {
  margin-top: 12px;
  overflow-x: auto;
}

.interface-degrade__role-grid {
  align-items: center;
  display: grid;
  gap: 8px;
  grid-template-columns: minmax(160px, 1.1fr) 80px 120px 130px minmax(320px, 1.8fr);
  min-width: 900px;
}

.interface-degrade__target-cell {
  display: flex;
  gap: 8px;
  min-width: 0;
}

.interface-degrade__target-cell > :first-child {
  flex: 0 0 108px;
}

.interface-degrade__target-cell > :last-child {
  flex: 1 1 auto;
  min-width: 0;
}

.interface-degrade__role-head {
  color: var(--ant-color-text-secondary);
  font-size: 12px;
  padding: 6px 8px;
}

.interface-degrade__role-row {
  border-top: 1px solid var(--ant-color-border-secondary);
  padding: 8px;
}

.interface-degrade__role-name {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.interface-degrade__role-name small {
  color: var(--ant-color-text-secondary);
}

.interface-degrade__loading {
  color: var(--ant-color-text-secondary);
  padding: 24px 0;
  text-align: center;
}
</style>
