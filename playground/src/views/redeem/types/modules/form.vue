<script lang="ts" setup>
import type { RedeemApi } from '#/api/redeem';

import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createType, updateType } from '#/api/redeem';
import { $t } from '#/locales';
import { createDrawerSubmit } from '#/utils/drawer-submit';

import {
  fetchGlobalPackageOptions,
  fetchInterfaceSpecOptions,
  useFormSchema,
} from '../data';

const emits = defineEmits(['success']);

const submit = createDrawerSubmit();

const currentType = ref<RedeemApi.CodeType>();
const id = ref<string>();
let loadedRewardType: RedeemApi.RewardType | undefined;

const [Form, formApi] = useVbenForm({
  schema: useFormSchema(),
  showDefaultActions: false,
  handleValuesChange(values) {
    const rewardType = Number(values.rewardType) as RedeemApi.RewardType;
    if (rewardType !== loadedRewardType) {
      loadRewardRefOptions(rewardType);
    }
  },
});

const [Drawer, drawerApi] = useVbenDrawer({
  onConfirm() {
    return submit(drawerApi, async () => {
      const { valid } = await formApi.validate();
      if (!valid) return;

      const values = await formApi.getValues<Record<string, any>>();
      const rewardType = Number(values.rewardType) as RedeemApi.RewardType;
      const rewardBalanceText = String(values.rewardBalance ?? '').trim();
      if (
        (rewardType === 2 || rewardType === 5) &&
        !Number.isFinite(Number(rewardBalanceText))
      ) {
        message.warning($t('system.redeem.type.rewardBalanceInvalid'));
        return;
      }

      const payload: RedeemApi.SaveTypeRequest = {
        code: String(values.code ?? '').trim(),
        endAt: String(values.endAt ?? ''),
        name: String(values.name ?? '').trim(),
        perIpLimit: Number(values.perIpLimit ?? 0),
        perUserLimit: Number(values.perUserLimit ?? 0),
        rewardBalance:
          rewardType === 2 || rewardType === 5 ? rewardBalanceText : undefined,
        rewardPoints:
          rewardType === 1 || rewardType === 5
            ? Number(values.rewardPoints ?? 0)
            : undefined,
        rewardRefId:
          rewardType === 3 || rewardType === 4
            ? Number(values.rewardRefId)
            : undefined,
        rewardType,
        startAt: String(values.startAt ?? ''),
        status: (Number(values.status ?? 1) === 1 ? 1 : 0) as 0 | 1,
      };

      const isEdit = !!id.value;
      await (isEdit ? updateType(id.value!, payload) : createType(payload));
      drawerApi.close();
      message.success(
        $t(
          isEdit
            ? 'system.redeem.type.updateSuccess'
            : 'system.redeem.type.createSuccess',
        ),
      );
      emits('success');
    });
  },

  async onOpenChange(isOpen) {
    if (!isOpen) return;

    const data = drawerApi.getData<RedeemApi.CodeType>();
    formApi.resetForm();
    id.value = data?.id;
    currentType.value = data?.id ? data : undefined;

    await nextTick();
    // 先解锁可能被 frozen 置灰的字段，避免上次打开的状态残留
    formApi.updateSchema([
      { componentProps: { disabled: false }, fieldName: 'code' },
      { componentProps: { disabled: false }, fieldName: 'perIpLimit' },
      { componentProps: { disabled: false }, fieldName: 'perUserLimit' },
      { componentProps: { disabled: false }, fieldName: 'rewardBalance' },
      { componentProps: { disabled: false }, fieldName: 'rewardPoints' },
      { componentProps: { disabled: false }, fieldName: 'rewardRefId' },
      { componentProps: { disabled: false }, fieldName: 'rewardType' },
    ]);

    if (data?.id) {
      formApi.setValues({
        code: data.code,
        endAt: data.endAt || undefined,
        name: data.name,
        perIpLimit: data.perIpLimit ?? 0,
        perUserLimit: data.perUserLimit ?? 1,
        rewardBalance:
          data.rewardType === 2 || data.rewardType === 5
            ? String(data.rewardBalance ?? '')
            : undefined,
        rewardPoints:
          data.rewardType === 1 || data.rewardType === 5
            ? data.rewardPoints
            : undefined,
        rewardRefId: data.rewardRefId ? Number(data.rewardRefId) : undefined,
        rewardType: data.rewardType,
        startAt: data.startAt || undefined,
        status: data.status,
      });
      if (data.frozen) {
        formApi.updateSchema([
          { componentProps: { disabled: true }, fieldName: 'perIpLimit' },
          { componentProps: { disabled: true }, fieldName: 'perUserLimit' },
          { componentProps: { disabled: true }, fieldName: 'rewardBalance' },
          { componentProps: { disabled: true }, fieldName: 'rewardPoints' },
          { componentProps: { disabled: true }, fieldName: 'rewardRefId' },
          { componentProps: { disabled: true }, fieldName: 'rewardType' },
        ]);
        message.info($t('system.redeem.type.frozenHint'));
      }
    } else {
      formApi.setValues({
        code: '',
        endAt: undefined,
        name: '',
        perIpLimit: 0,
        perUserLimit: 1,
        rewardType: 1,
        startAt: undefined,
        status: 1,
      });
    }

    // 按当前奖励类型加载关联下拉选项
    const rewardType = data?.id ? data.rewardType : 1;
    await loadRewardRefOptions(rewardType);
  },
});

async function loadRewardRefOptions(rewardType: RedeemApi.RewardType) {
  loadedRewardType = rewardType;
  try {
    if (rewardType === 4) {
      const options = await fetchInterfaceSpecOptions();
      formApi.updateSchema([
        {
          componentProps: {
            options,
            placeholder: $t('system.redeem.type.rewardRefPlaceholderInterface'),
          },
          fieldName: 'rewardRefId',
        },
      ]);
    } else {
      const options = await fetchGlobalPackageOptions();
      formApi.updateSchema([
        {
          componentProps: {
            options,
            placeholder: $t('system.redeem.type.rewardRefPlaceholderGlobal'),
          },
          fieldName: 'rewardRefId',
        },
      ]);
    }
  } catch {
    // options 加载失败时保留空下拉，提交前仍会被必填校验拦截
  }
}

const drawerTitle = computed(() =>
  id.value
    ? $t('ui.actionTitle.edit', [$t('system.redeem.type.title')])
    : $t('ui.actionTitle.create', [$t('system.redeem.type.title')]),
);
</script>

<template>
  <Drawer class="w-[560px]" :title="drawerTitle">
    <Form />
  </Drawer>
</template>
