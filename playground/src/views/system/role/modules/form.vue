<script lang="ts" setup>
import type { DataNode } from 'ant-design-vue/es/tree';

import type { Recordable } from '@vben/types';

import type { SystemRoleApi } from '#/api/system/role';

import { computed, nextTick, ref, shallowRef } from 'vue';

import { Tree, useVbenDrawer } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { Alert, message, Select, Spin } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { getMenuList } from '#/api/system/menu';
import { createRole, getRoleList, updateRole } from '#/api/system/role';
import { $t } from '#/locales';
import { createDrawerSubmit } from '#/utils/drawer-submit';

import { useFormSchema } from '../data';
import {
  rolePermissionTemplateIds,
  rolePermissionPayload,
  visibleRolePermissionIds,
} from '../permission-mode';

const emits = defineEmits(['success']);
const submit = createDrawerSubmit();

const formData = ref<SystemRoleApi.SystemRole>();

const [Form, formApi] = useVbenForm({
  schema: useFormSchema(),
  showDefaultActions: false,
});

const permissions = ref<DataNode[]>([]);
const loadingPermissions = ref(false);
const selectedPermissionIds = ref<Array<number | string>>([]);
const emptyRoleTemplateId = '__empty_permissions__';
const roleTemplates = shallowRef<SystemRoleApi.SystemRole[]>([]);
const loadingRoleTemplates = shallowRef(false);
const selectedRoleTemplateId = shallowRef<string>();
const roleTemplateOptions = computed(() => [
  {
    label: $t('roleAdmin.permissionTemplateBlank'),
    value: emptyRoleTemplateId,
  },
  ...roleTemplates.value.map((role) => ({
    label: `${role.name} · ${role.roleKey}`,
    value: String(role.id),
  })),
]);
const allPermissionsReadonly = computed(
  () => formData.value?.permissionMode === 'all',
);

const id = ref();
const isCreateMode = computed(() => id.value === undefined);
const [Drawer, drawerApi] = useVbenDrawer({
  onConfirm() {
    return submit(drawerApi, async () => {
      const { valid } = await formApi.validate();
      if (!valid) return;
      const values = await formApi.getValues();
      // The tree uses string keys for stable rendering, while the Go API accepts
      // numeric IDs. For the implicit all-permissions administrator, preserve
      // the original relationship rows instead of serializing the effective
      // (potentially much larger) read-only tree.
      values.permissions = rolePermissionPayload(
        formData.value,
        values.permissions,
      );
      // Switch 组件回传 boolean，后端角色配额字段是 tinyint。
      values.quotaEnabled = values.quotaEnabled ? 1 : 0;
      await (id.value ? updateRole(id.value, values) : createRole(values));
      message.success(
        $t(
          id.value ? 'operationFeedback.updated' : 'operationFeedback.created',
          [$t('system.role.name')],
        ),
      );
      emits('success');
      drawerApi.close();
    });
  },

  async onOpenChange(isOpen) {
    if (isOpen) {
      const data = drawerApi.getData<SystemRoleApi.SystemRole>();
      formApi.resetForm();

      if (data?.id) {
        formData.value = data;
        id.value = data.id;
      } else {
        formData.value = undefined;
        id.value = undefined;
      }
      selectedRoleTemplateId.value = undefined;

      const isBuiltin = !!data?.builtin;
      const isAdmin = data?.roleKey === 'admin';
      const isDefaultRole = !!data?.defaultRegisterRole;
      formApi.updateSchema([
        {
          componentProps: { disabled: isBuiltin },
          fieldName: 'roleKey',
        },
        {
          componentProps: { disabled: isAdmin || isDefaultRole },
          fieldName: 'selfRegisterEnabled',
        },
        {
          componentProps: { disabled: isAdmin || isDefaultRole },
          fieldName: 'status',
        },
      ]);

      await Promise.all([
        permissions.value.length === 0 ? loadPermissions() : Promise.resolve(),
        data?.id ? Promise.resolve() : loadRoleTemplates(),
      ]);
      // Wait for Vue to flush DOM updates (form fields mounted)
      await nextTick();
      if (data?.id) {
        const latest = await getRoleList({ id: data.id, page: 1, pageSize: 1 });
        const current = latest.items?.[0] ?? data;
        // 将权限 ID 从 number 转为 string，匹配菜单树节点的 id 类型
        const normalized = {
          ...current,
          // Switch 只接受 boolean；接口返回的是 tinyint 0/1。若直接塞入
          // 数字，部分场景下开关会显示为关闭，重新打开编辑时看起来像“没生效”。
          quotaEnabled: Number(current.quotaEnabled ?? 0) === 1,
          permissions: visibleRolePermissionIds(current),
        };
        formData.value = current;
        selectedPermissionIds.value = normalized.permissions;
        formApi.setValues(normalized);
      } else {
        selectedPermissionIds.value = [];
        await formApi.setFieldValue('permissions', []);
      }
    }
  },
});

async function loadPermissions() {
  loadingPermissions.value = true;
  try {
    const res = await getMenuList();
    permissions.value = res as unknown as DataNode[];
  } finally {
    loadingPermissions.value = false;
  }
}

async function loadRoleTemplates() {
  loadingRoleTemplates.value = true;
  try {
    const result = await getRoleList({ page: 1, pageSize: 200 });
    roleTemplates.value = result.items ?? [];
  } catch {
    roleTemplates.value = [];
  } finally {
    loadingRoleTemplates.value = false;
  }
}

const getDrawerTitle = computed(() => {
  return formData.value?.id
    ? $t('common.edit', $t('system.role.name'))
    : $t('common.create', $t('system.role.name'));
});

function getNodeClass(node: Recordable<any>) {
  const classes: string[] = [];
  if (node.value?.type === 'button') {
    classes.push('inline-flex');
  }

  return classes.join(' ');
}

function updateSelectedPermissions(value: unknown) {
  if (allPermissionsReadonly.value) return;
  selectedRoleTemplateId.value = undefined;
  selectedPermissionIds.value = Array.isArray(value) ? value : [];
  void formApi.setFieldValue('permissions', selectedPermissionIds.value);
}

// 配额字段是 0 表示该窗口不限量；模板里的历史值可能是字符串或 null，统一收敛成数字。
function toQuotaLimit(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

// 模板要连配额一起回填。只复制权限会让新角色停在表单默认值（60/600/1000/20000），
// 结果就是「权限套了模板、配额却是另一套」——新建的赞助用户角色踩过这个坑。
function templateQuotaValues(
  templateRole?: SystemRoleApi.SystemRole,
): Recordable<any> {
  if (!templateRole) {
    // 空白模板：回到 schema 里的默认值
    return {
      qpsLimit: 1,
      quotaEnabled: false,
      quotaMinuteLimit: 60,
      quotaHourLimit: 600,
      quotaDayLimit: 1000,
      quotaMonthLimit: 20000,
      quotaCountMode: 'attempt',
    };
  }
  return {
    qpsLimit: Number(templateRole.qpsLimit ?? 1),
    // 接口返回 tinyint，Switch 只认 boolean；直接塞 1 会让开关显示为关闭。
    quotaEnabled: Number(templateRole.quotaEnabled ?? 0) === 1,
    quotaMinuteLimit: toQuotaLimit(templateRole.quotaMinuteLimit),
    quotaHourLimit: toQuotaLimit(templateRole.quotaHourLimit),
    quotaDayLimit: toQuotaLimit(templateRole.quotaDayLimit),
    quotaMonthLimit: toQuotaLimit(templateRole.quotaMonthLimit),
    quotaCountMode:
      templateRole.quotaCountMode === 'success' ? 'success' : 'attempt',
  };
}

async function applyRolePermissionTemplate(value: unknown) {
  if (!isCreateMode.value) return;

  const templateId =
    typeof value === 'number' || typeof value === 'string'
      ? String(value)
      : undefined;
  selectedRoleTemplateId.value = templateId;
  if (!templateId) return;

  const templateRole = roleTemplates.value.find(
    (role) => String(role.id) === templateId,
  );
  if (templateId !== emptyRoleTemplateId && !templateRole) {
    selectedRoleTemplateId.value = undefined;
    message.warning($t('roleAdmin.permissionTemplateUnavailable'));
    return;
  }

  const permissionIds =
    templateId === emptyRoleTemplateId
      ? []
      : rolePermissionTemplateIds(templateRole);
  selectedPermissionIds.value = permissionIds;
  await formApi.setFieldValue('permissions', permissionIds);
  await formApi.setValues(
    templateQuotaValues(
      templateId === emptyRoleTemplateId ? undefined : templateRole,
    ),
  );
  message.success(
    $t('roleAdmin.permissionTemplateApplied', [permissionIds.length]),
  );
}
</script>
<template>
  <Drawer :title="getDrawerTitle">
    <Form>
      <template #permissions="slotProps">
        <Spin :spinning="loadingPermissions" wrapper-class-name="w-full">
          <div
            v-if="isCreateMode"
            class="mb-4 rounded-md border border-border bg-muted/30 p-3"
          >
            <div class="mb-2 text-sm font-medium">
              {{ $t('roleAdmin.permissionTemplate') }}
            </div>
            <Select
              allow-clear
              class="w-full"
              :aria-label="$t('roleAdmin.permissionTemplate')"
              :loading="loadingRoleTemplates"
              option-filter-prop="label"
              :options="roleTemplateOptions"
              :placeholder="$t('roleAdmin.permissionTemplatePlaceholder')"
              show-search
              :value="selectedRoleTemplateId"
              @update:value="applyRolePermissionTemplate"
            />
            <div class="mt-2 text-xs text-muted-foreground">
              {{ $t('roleAdmin.permissionTemplateHelp') }}
            </div>
          </div>
          <Alert
            v-if="allPermissionsReadonly"
            class="mb-3"
            :description="$t('roleAdmin.superAdminPermissionsDescription')"
            :message="$t('roleAdmin.superAdminPermissionsTitle')"
            show-icon
            type="info"
          />
          <Tree
            v-bind="slotProps"
            :tree-data="permissions"
            multiple
            bordered
            :disabled="allPermissionsReadonly"
            :default-expanded-level="2"
            :get-node-class="getNodeClass"
            :model-value="selectedPermissionIds"
            value-field="id"
            label-field="meta.title"
            icon-field="meta.icon"
            @update:model-value="updateSelectedPermissions"
          >
            <template #node="{ value }">
              <IconifyIcon v-if="value.meta.icon" :icon="value.meta.icon" />
              {{ $t(value.meta.title) }}
            </template>
          </Tree>
        </Spin>
      </template>
    </Form>
  </Drawer>
</template>
<style lang="css" scoped>
:deep(.ant-tree-title) {
  .tree-actions {
    @apply ml-5 hidden;
  }
}

:deep(.ant-tree-title:hover) {
  .tree-actions {
    @apply ml-5 flex flex-auto justify-end;
  }
}
</style>
