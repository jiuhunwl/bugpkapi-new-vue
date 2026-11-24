<script lang="ts" setup>
import type { SystemRoleApi } from '#/api/system/role';
import type { SystemUserApi } from '#/api/system/user';

import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import { Alert, message, Modal } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createUser, getUser, updateUser } from '#/api/system/user';
import { $t } from '#/locales';
import { createDrawerSubmit } from '#/utils/drawer-submit';
import { useAuthStore } from '#/store';
import { isValidPassword } from '#/utils/password-policy';

import { fetchRoleOptions, useFormSchema } from '../data';

const emits = defineEmits(['success']);

const submit = createDrawerSubmit();

const formData = ref<SystemUserApi.SystemUser>();
const id = ref<string>();
const authStore = useAuthStore();
const userStore = useUserStore();

const [Form, formApi] = useVbenForm({
  schema: useFormSchema(),
  showDefaultActions: false,
});

const [Drawer, drawerApi] = useVbenDrawer({
  onConfirm() {
    return submit(drawerApi, async () => {
      const { valid } = await formApi.validate();
      if (!valid) return;

      const values = await formApi.getValues<SystemUserApi.SaveUser>();
      const isEdit = !!id.value;
      const shouldChangePassword = !isEdit || values.changePassword === true;
      if (!isEdit && !values.password?.trim()) {
        message.warning($t('authentication.passwordTip'));
        return;
      }
      if (isEdit && shouldChangePassword && !values.password?.trim()) {
        message.warning('\u8bf7\u8f93\u5165\u65b0\u5bc6\u7801');
        return;
      }
      if (shouldChangePassword && !isValidPassword(values.password ?? '')) {
        message.warning($t('system.user.passwordPolicy'));
        return;
      }
      const payload = normalizeSavePayload(values);
      if (!payload.roleIds?.includes(Number(payload.primaryRoleId))) {
        message.warning($t('system.user.primaryRoleMustBelong'));
        return;
      }
      payload.changePassword = shouldChangePassword;
      if (isEdit) {
        // 余额/点数是增量资产，编辑表单不再提交绝对值，避免覆盖用户并发充值。
        delete payload.balance;
        delete payload.points;
      }
      if (isEdit && !shouldChangePassword) {
        delete payload.password;
      }
      delete payload.id;
      const shouldLogoutAfterPasswordChange =
        isEdit && shouldChangePassword && isCurrentLoginUser(id.value);

      await (id.value ? updateUser(id.value, payload) : createUser(payload));
      drawerApi.close();
      if (shouldLogoutAfterPasswordChange) {
        Modal.success({
          content:
            '\u5bc6\u7801\u4fee\u6539\u6210\u529f\uff0c\u8bf7\u4f7f\u7528\u65b0\u5bc6\u7801\u91cd\u65b0\u767b\u5f55\u3002',
          okText: '\u53bb\u767b\u5f55',
          onOk: async () => {
            await authStore.logout(false);
          },
          title: '\u5bc6\u7801\u5df2\u4fee\u6539',
        });
        return;
      }
      message.success(
        $t(isEdit ? 'operationFeedback.updated' : 'operationFeedback.created', [
          $t('operationFeedback.entities.user'),
        ]),
      );
      emits('success');
    });
  },

  async onOpenChange(isOpen) {
    if (!isOpen) return;

    const data = drawerApi.getData<SystemUserApi.SystemUser>();
    formApi.resetForm();
    id.value = data?.id;

    await nextTick();
    if (data?.id) {
      let detail: SystemUserApi.SystemUser;
      try {
        detail = await getUser(data.id);
      } catch {
        drawerApi.close();
        return;
      }
      formData.value = detail;
      formApi.setValues({
        banPermanent: detail.banPermanent ?? 0,
        banReason: detail.banReason ?? '',
        banUntil: detail.banUntil ?? '',
        balance: detail.balance ?? 0,
        changePassword: false,
        email: detail.email ?? '',
        homePath: detail.homePath ?? '/console/workspace',
        id: detail.id,
        mobile: detail.mobile ?? '',
        password: '',
        points: detail.points ?? 0,
        primaryRoleId: Number(detail.primaryRoleId),
        realName: detail.realName,
        roleIds: normalizeRoleIds(detail.roleIds),
        status: detail.status,
        username: detail.username,
      });
      return;
    }
    formData.value = undefined;

    const roleOptions =
      (await fetchRoleOptions()) as SystemRoleApi.SystemRole[];
    const defaultRoleId = roleOptions.find(
      (role) => role.roleKey === 'user',
    )?.id;
    formApi.setValues({
      banPermanent: 0,
      banReason: '',
      banUntil: '',
      balance: 0,
      changePassword: true,
      homePath: '/console/workspace',
      id: '',
      password: '',
      points: 0,
      primaryRoleId: defaultRoleId ? Number(defaultRoleId) : undefined,
      roleIds: defaultRoleId ? [Number(defaultRoleId)] : [],
      status: 1,
    });
  },
});

const drawerTitle = computed(() =>
  formData.value?.id
    ? $t('ui.actionTitle.edit', [$t('system.user.listTitle')])
    : $t('ui.actionTitle.create', [$t('system.user.listTitle')]),
);

function normalizeSavePayload(
  values: SystemUserApi.SaveUser,
): SystemUserApi.SaveUser {
  const status = values.status ?? 1;
  const isBanned = status === 0;
  const isPermanent = values.banPermanent === 1;
  return {
    ...values,
    banPermanent: isBanned && isPermanent ? 1 : 0,
    banReason: isBanned ? (values.banReason?.trim() ?? '') : '',
    banUntil: isBanned && !isPermanent ? (values.banUntil ?? '') : '',
    changePassword: values.changePassword === true,
    email: values.email?.trim() ?? '',
    homePath: values.homePath?.trim() || '/console/workspace',
    mobile: values.mobile?.trim() ?? '',
    password: values.password,
    primaryRoleId: Number(values.primaryRoleId),
    realName: values.realName?.trim(),
    roleIds: normalizeRoleIds(values.roleIds),
    username: values.username?.trim() ?? '',
  };
}

function isCurrentLoginUser(userId?: string) {
  return String(userStore.userInfo?.userId ?? '') === String(userId ?? '');
}

function normalizeRoleIds(roleIds?: Array<number | string>) {
  return (roleIds ?? [])
    .map((roleId) => Number(roleId))
    .filter((roleId) => Number.isSafeInteger(roleId) && roleId > 0);
}
</script>

<template>
  <Drawer :title="drawerTitle">
    <Alert
      v-if="id"
      class="mb-4"
      :message="$t('system.user.assetAdjustEditHint')"
      show-icon
      type="info"
    />
    <Form />
  </Drawer>
</template>
