<script lang="ts" setup>
import type { InterfaceApi } from '#/api/interface';
import type { SystemRoleApi } from '#/api/system/role';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import {
  Alert,
  InputNumber,
  message,
  Select,
  Switch,
} from 'ant-design-vue';

import {
  getInterfaceQuota,
  updateInterfaceQuota,
} from '#/api/interface';
import { getRoleOptions } from '#/api/system/role';
import { $t } from '#/locales';

const emits = defineEmits(['success']);

type RoleMode = 'adjust' | 'ignore' | 'inherit' | 'override' | 'unlimited';

interface RoleRow {
  adjustDay: number;
  adjustHour: number;
  adjustMonth: number;
  adjustWeek: number;
  mode: RoleMode;
  overrideDay: number;
  overrideHour: number;
  overrideMonth: number;
  overrideWeek: number;
  roleId: number;
  roleKey: string;
  roleName: string;
}

const current = ref<InterfaceApi.InterfaceItem>();
const loading = ref(false);
const loadFailed = ref(false);
const saving = ref(false);
const enabled = ref(false);
const packageExempt = ref(true);
const countMode = ref<'attempt' | 'success'>('attempt');
const perUserHour = ref(0);
const perUserDay = ref(0);
const perUserWeek = ref(0);
const perUserMonth = ref(0);
const allUsersHour = ref(0);
const allUsersDay = ref(0);
const allUsersWeek = ref(0);
const allUsersMonth = ref(0);
const roleRows = ref<RoleRow[]>([]);
const roleOptions = ref<SystemRoleApi.RoleOption[]>([]);

const roleModeOptions = computed(() => [  { label: $t('interfaceQuota.roleModeInherit'), value: 'inherit' },
  { label: $t('interfaceQuota.roleModeUnlimited'), value: 'unlimited' },
  { label: $t('interfaceQuota.roleModeIgnore'), value: 'ignore' },
  { label: $t('interfaceQuota.roleModeAdjust'), value: 'adjust' },
  { label: $t('interfaceQuota.roleModeOverride'), value: 'override' },
]);

function emptyRow(role: SystemRoleApi.RoleOption): RoleRow {
  return {
    adjustDay: 0,
    adjustHour: 0,
    adjustMonth: 0,
    adjustWeek: 0,
    mode: 'inherit',
    overrideDay: 0,
    overrideHour: 0,
    overrideMonth: 0,
    overrideWeek: 0,
    roleId: Number(role.id),
    roleKey: role.roleKey,
    roleName: role.name,
  };
}

function resetRows(overrides: InterfaceApi.InterfaceRoleQuota[] = []) {
  const byRole = new Map(overrides.map((item) => [Number(item.roleId), item]));
  roleRows.value = (roleOptions.value ?? []).map((role) => {
    const row = emptyRow(role);
    const override = byRole.get(row.roleId);
    if (override) {
      row.mode = override.mode ?? 'inherit';
      row.adjustHour = Number(override.adjustHour ?? 0);
      row.adjustDay = Number(override.adjustDay ?? 0);
      row.adjustWeek = Number(override.adjustWeek ?? 0);
      row.adjustMonth = Number(override.adjustMonth ?? 0);
      row.overrideHour = Number(override.overrideHour ?? 0);
      row.overrideDay = Number(override.overrideDay ?? 0);
      row.overrideWeek = Number(override.overrideWeek ?? 0);
      row.overrideMonth = Number(override.overrideMonth ?? 0);
    }
    byRole.delete(row.roleId);
    return row;
  });
  // 角色被删除但历史覆盖仍在时，保留可见性，避免保存时静默丢配置。
  for (const item of byRole.values()) {
    roleRows.value.push({
      adjustDay: Number(item.adjustDay ?? 0),
      adjustHour: Number(item.adjustHour ?? 0),
      adjustMonth: Number(item.adjustMonth ?? 0),
      adjustWeek: Number(item.adjustWeek ?? 0),
      mode: item.mode ?? 'inherit',
      overrideDay: Number(item.overrideDay ?? 0),
      overrideHour: Number(item.overrideHour ?? 0),
      overrideMonth: Number(item.overrideMonth ?? 0),
      overrideWeek: Number(item.overrideWeek ?? 0),
      roleId: Number(item.roleId),
      roleKey: item.roleKey ?? '',
      roleName: item.roleName || `#${item.roleId}`,
    });
  }
}

async function loadQuota() {
  if (!current.value?.id || loading.value) return;
  loading.value = true;
  loadFailed.value = false;
  drawerApi.setState({ showConfirmButton: false });
  try {
    const [policy, roles] = await Promise.all([
      getInterfaceQuota(current.value.id),
      getRoleOptions().catch(() => [] as SystemRoleApi.RoleOption[]),
    ]);
    roleOptions.value = Array.isArray(roles) ? roles : [];
    enabled.value = Number(policy.enabled ?? 0) === 1;
    packageExempt.value = Number(policy.coverPackage ?? 0) === 0;
    countMode.value = policy.countMode === 'success' ? 'success' : 'attempt';
    perUserHour.value = Number(policy.perUserHour ?? 0);
    perUserDay.value = Number(policy.perUserDay ?? 0);
    perUserWeek.value = Number(policy.perUserWeek ?? 0);
    perUserMonth.value = Number(policy.perUserMonth ?? 0);
    allUsersHour.value = Number(policy.allUsersHour ?? 0);
    allUsersDay.value = Number(policy.allUsersDay ?? 0);
    allUsersWeek.value = Number(policy.allUsersWeek ?? 0);
    allUsersMonth.value = Number(policy.allUsersMonth ?? 0);
    resetRows(Array.isArray(policy.roleOverrides) ? policy.roleOverrides : []);
  } catch {
    loadFailed.value = true;
    message.error($t('interfaceQuota.loadFailed'));
  } finally {
    loading.value = false;
    drawerApi.setState({ showConfirmButton: !loadFailed.value });
  }
}

function roleRowsForSave() {
  return roleRows.value
    .filter((row) => row.mode !== 'inherit')
    .map((row) => ({
      adjustDay: Number(row.adjustDay ?? 0),
      adjustHour: Number(row.adjustHour ?? 0),
      adjustMonth: Number(row.adjustMonth ?? 0),
      adjustWeek: Number(row.adjustWeek ?? 0),
      mode: row.mode,
      overrideDay: Number(row.overrideDay ?? 0),
      overrideHour: Number(row.overrideHour ?? 0),
      overrideMonth: Number(row.overrideMonth ?? 0),
      overrideWeek: Number(row.overrideWeek ?? 0),
      roleId: row.roleId,
    }));
}

const [Drawer, drawerApi] = useVbenDrawer({
  async onConfirm() {
    if (!current.value || loading.value || loadFailed.value || saving.value)
      return;
    saving.value = true;
    drawerApi.lock();
    try {
      await updateInterfaceQuota(current.value.id, {
        allUsersDay: Number(allUsersDay.value ?? 0),
        allUsersHour: Number(allUsersHour.value ?? 0),
        allUsersMonth: Number(allUsersMonth.value ?? 0),
        allUsersWeek: Number(allUsersWeek.value ?? 0),
        countMode: countMode.value,
        coverPackage: packageExempt.value ? 0 : 1,
        enabled: enabled.value ? 1 : 0,
        perUserDay: Number(perUserDay.value ?? 0),
        perUserHour: Number(perUserHour.value ?? 0),
        perUserMonth: Number(perUserMonth.value ?? 0),
        perUserWeek: Number(perUserWeek.value ?? 0),
        roleOverrides: roleRowsForSave(),
      });
      message.success($t('interfaceQuota.saveSuccess'));
      emits('success');
      drawerApi.close();
    } catch {
      message.error($t('interfaceQuota.saveFailed'));
    } finally {
      saving.value = false;
      drawerApi.unlock();
    }
  },
  async onOpenChange(isOpen) {
    if (!isOpen) return;
    current.value = drawerApi.getData<InterfaceApi.InterfaceItem>();
    await loadQuota();
  },
});

const drawerTitle = computed(() =>
  current.value?.name
    ? $t('interfaceQuota.titleWithName', [current.value.name])
    : $t('interfaceQuota.title'),
);
</script>

<template>
  <Drawer :title="drawerTitle" class="w-[min(1180px,96vw)]">
    <div class="interface-quota">
      <Alert
        show-icon
        type="info"
        :message="$t('interfaceQuota.description')"
      />

      <section class="interface-quota__card">
        <div class="interface-quota__row">
          <span>{{ $t('interfaceQuota.enable') }}</span>
          <Switch v-model:checked="enabled" />
          <span class="interface-quota__hint">
            {{ $t('interfaceQuota.enableHelp') }}
          </span>
        </div>
        <div class="interface-quota__row">
          <span>{{ $t('interfaceQuota.packageExempt') }}</span>
          <Switch v-model:checked="packageExempt" />
          <span class="interface-quota__hint">
            {{ $t('interfaceQuota.packageExemptHelp') }}
          </span>
        </div>
        <div class="interface-quota__row">
          <span>{{ $t('interfaceQuota.countMode') }}</span>
          <Select
            v-model:value="countMode"
            class="min-w-[220px]"
            :options="[
              {
                label: $t('interfaceQuota.countModeAttempt'),
                value: 'attempt',
              },
              {
                label: $t('interfaceQuota.countModeSuccess'),
                value: 'success',
              },
            ]"
          />
          <span class="interface-quota__hint">
            {{ $t('interfaceQuota.countModeHelp') }}
          </span>
        </div>

        <h3 class="interface-quota__section-title">
          {{ $t('interfaceQuota.perUserTitle') }}
        </h3>
        <p class="interface-quota__hint">
          {{ $t('interfaceQuota.perUserHelp') }}
        </p>
        <div class="interface-quota__numbers">
          <label>
            <span>{{ $t('interfaceQuota.hour') }}</span>
            <InputNumber v-model:value="perUserHour" :min="0" :precision="0" />
          </label>
          <label>
            <span>{{ $t('interfaceQuota.day') }}</span>
            <InputNumber v-model:value="perUserDay" :min="0" :precision="0" />
          </label>
          <label>
            <span>{{ $t('interfaceQuota.week') }}</span>
            <InputNumber v-model:value="perUserWeek" :min="0" :precision="0" />
          </label>
          <label>
            <span>{{ $t('interfaceQuota.month') }}</span>
            <InputNumber v-model:value="perUserMonth" :min="0" :precision="0" />
          </label>
        </div>

        <h3 class="interface-quota__section-title">
          {{ $t('interfaceQuota.allUsersTitle') }}
        </h3>
        <p class="interface-quota__hint">
          {{ $t('interfaceQuota.allUsersHelp') }}
        </p>
        <div class="interface-quota__numbers">
          <label>
            <span>{{ $t('interfaceQuota.hour') }}</span>
            <InputNumber v-model:value="allUsersHour" :min="0" :precision="0" />
          </label>
          <label>
            <span>{{ $t('interfaceQuota.day') }}</span>
            <InputNumber v-model:value="allUsersDay" :min="0" :precision="0" />
          </label>
          <label>
            <span>{{ $t('interfaceQuota.week') }}</span>
            <InputNumber v-model:value="allUsersWeek" :min="0" :precision="0" />
          </label>
          <label>
            <span>{{ $t('interfaceQuota.month') }}</span>
            <InputNumber v-model:value="allUsersMonth" :min="0" :precision="0" />
          </label>
        </div>
        <p class="interface-quota__hint">
          {{ $t('interfaceQuota.zeroHelp') }}
        </p>
      </section>

      <section class="interface-quota__card">
        <h3 class="interface-quota__section-title">
          {{ $t('interfaceQuota.roleTitle') }}
        </h3>
        <p class="interface-quota__hint">
          {{ $t('interfaceQuota.roleHelp') }}
        </p>
        <div v-if="loading" class="interface-quota__loading">
          {{ $t('interfaceQuota.loading') }}
        </div>
        <div v-else class="interface-quota__role-scroll">
          <div class="interface-quota__role-grid interface-quota__role-head">
            <span>{{ $t('interfaceQuota.role') }}</span>
            <span>{{ $t('interfaceQuota.roleMode') }}</span>
            <span>{{ $t('interfaceQuota.hour') }}</span>
            <span>{{ $t('interfaceQuota.day') }}</span>
            <span>{{ $t('interfaceQuota.week') }}</span>
            <span>{{ $t('interfaceQuota.month') }}</span>
          </div>
          <div
            v-for="row in roleRows"
            :key="row.roleId"
            class="interface-quota__role-grid interface-quota__role-row"
          >
            <div class="interface-quota__role-name">
              <strong>{{ row.roleName }}</strong>
              <small>{{ row.roleKey }}</small>
            </div>
            <Select
              v-model:value="row.mode"
              :options="roleModeOptions"
              size="small"
            />
            <template v-if="row.mode === 'adjust'">
              <InputNumber
                v-model:value="row.adjustHour"
                :max="1000000000000"
                :min="-1000000000000"
                :precision="0"
                placeholder="+/-"
                size="small"
              />
              <InputNumber
                v-model:value="row.adjustDay"
                :max="1000000000000"
                :min="-1000000000000"
                :precision="0"
                placeholder="+/-"
                size="small"
              />
              <InputNumber
                v-model:value="row.adjustWeek"
                :max="1000000000000"
                :min="-1000000000000"
                :precision="0"
                placeholder="+/-"
                size="small"
              />
              <InputNumber
                v-model:value="row.adjustMonth"
                :max="1000000000000"
                :min="-1000000000000"
                :precision="0"
                placeholder="+/-"
                size="small"
              />
            </template>
            <template v-else-if="row.mode === 'override'">
              <InputNumber
                v-model:value="row.overrideHour"
                :min="0"
                :precision="0"
                size="small"
              />
              <InputNumber
                v-model:value="row.overrideDay"
                :min="0"
                :precision="0"
                size="small"
              />
              <InputNumber
                v-model:value="row.overrideWeek"
                :min="0"
                :precision="0"
                size="small"
              />
              <InputNumber
                v-model:value="row.overrideMonth"
                :min="0"
                :precision="0"
                size="small"
              />
            </template>
            <span v-else class="interface-quota__inherit">
              {{
                row.mode === 'ignore'
                  ? $t('interfaceQuota.roleModeIgnoreHint')
                  : row.mode === 'unlimited'
                    ? $t('interfaceQuota.roleModeUnlimited')
                    : $t('interfaceQuota.roleModeInherit')
              }}
            </span>
          </div>
        </div>
      </section>
    </div>
  </Drawer>
</template>

<style scoped>
.interface-quota {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.interface-quota__card {
  border: 1px solid var(--ant-color-border);
  border-radius: 8px;
  padding: 16px;
}

.interface-quota__row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.interface-quota__section-title {
  font-size: 15px;
  font-weight: 600;
  margin: 16px 0 6px;
}

.interface-quota__hint {
  color: var(--ant-color-text-secondary);
  font-size: 12px;
  line-height: 1.6;
  margin: 4px 0;
}

.interface-quota__numbers {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 8px;
}

.interface-quota__numbers label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
}

.interface-quota__role-scroll {
  margin-top: 12px;
  overflow-x: auto;
}

.interface-quota__role-grid {
  align-items: center;
  display: grid;
  gap: 8px;
  grid-template-columns: minmax(160px, 1.2fr) 130px repeat(4, minmax(86px, 1fr));
  min-width: 760px;
}

.interface-quota__role-head {
  color: var(--ant-color-text-secondary);
  font-size: 12px;
  padding: 6px 8px;
}

.interface-quota__role-row {
  border-top: 1px solid var(--ant-color-border-secondary);
  padding: 8px;
}

.interface-quota__role-name {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.interface-quota__role-name small {
  color: var(--ant-color-text-secondary);
}

.interface-quota__inherit {
  color: var(--ant-color-text-secondary);
  font-size: 12px;
  grid-column: span 4;
}

.interface-quota__loading {
  color: var(--ant-color-text-secondary);
  padding: 24px 0;
  text-align: center;
}

@media (max-width: 720px) {
  .interface-quota__numbers {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
