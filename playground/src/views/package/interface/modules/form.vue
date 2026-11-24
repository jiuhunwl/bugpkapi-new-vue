<script lang="ts" setup>
import type { PackageApi } from '#/api/package';

import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { IconifyIcon, Plus } from '@vben/icons';

import {
  Button,
  DatePicker,
  Input,
  InputNumber,
  message,
  Select,
  Switch,
} from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createInterfacePackage, updateInterfacePackage } from '#/api/package';
import { $t } from '#/locales';
import { createDrawerSubmit } from '#/utils/drawer-submit';

import { useFormSchema } from '../data';

interface SpecForm {
  countMode: 'success' | 'attempt';
  dailyLimit: number;
  totalLimit: number;
  id?: string;
  perUserLimit: number;
  price: number | string;
  qpsLimit: number;
  remark?: string;
  saleEndAt?: string;
  saleStartAt?: string;
  sortNo: number;
  specName: string;
  status: 0 | 1;
  stockLimit: number;
  stockUsed?: number;
  validDays: number;
}

const countModeOptions = computed(() => [
  { label: $t('system.package.countModeSuccess'), value: 'success' },
  { label: $t('system.package.countModeAttempt'), value: 'attempt' },
]);

const emits = defineEmits(['success']);
const submit = createDrawerSubmit();

const formData = ref<PackageApi.InterfacePackage>();
const id = ref<string>();
const specs = ref<SpecForm[]>([]);

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
  },
  layout: 'horizontal',
  schema: useFormSchema(),
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1',
});

const [Drawer, drawerApi] = useVbenDrawer({
  onConfirm() {
    return submit(drawerApi, async () => {
      const { valid } = await formApi.validate();
      if (!valid) return;
      const specPayload = normalizeSpecs();
      if (!specPayload) return;

      const values = await formApi.getValues<any>();
      const payload: PackageApi.SaveInterfacePackage = {
        interfaceId: values.interfaceId,
        name: values.name,
        remark: values.remark,
        roleIds: Array.isArray(values.roleIds)
          ? values.roleIds.map((roleId: number | string) => Number(roleId))
          : [],
        roleRestricted: values.roleRestricted ? 1 : 0,
        roleVisibleOnly: values.roleVisibleOnly ? 1 : 0,
        specs: specPayload,
        status: values.status ? 1 : 0,
        hidden: values.hidden ? 1 : 0,
      };

      await (id.value
        ? updateInterfacePackage(id.value, payload)
        : createInterfacePackage(payload));
      message.success(
        $t(
          id.value ? 'operationFeedback.updated' : 'operationFeedback.created',
          [$t('system.package.interfaceTitle')],
        ),
      );
      emits('success');
      drawerApi.close();
    });
  },

  async onOpenChange(isOpen) {
    if (!isOpen) return;

    const data = drawerApi.getData<PackageApi.InterfacePackage>();
    formApi.resetForm();
    formData.value = data?.id ? data : undefined;
    id.value = data?.id;
    specs.value = normalizeInitialSpecs(data?.specs);

    await nextTick();
    formApi.setValues({
      interfaceId: data?.interfaceId,
      name: data?.name ?? '',
      remark: data?.remark ?? '',
      roleIds: data?.roleIds ?? [],
      roleRestricted: data?.roleRestricted === 1,
      roleVisibleOnly: data?.roleVisibleOnly === 1,
      status: data?.id ? data.status === 1 : true,
      hidden: data?.hidden === 1,
    });
  },
});

const drawerTitle = computed(() =>
  formData.value?.id
    ? $t('ui.actionTitle.edit', [$t('system.package.interfaceTitle')])
    : $t('ui.actionTitle.create', [$t('system.package.interfaceTitle')]),
);

function addSpec() {
  specs.value.push({
    countMode: 'success',
    dailyLimit: 0,
    totalLimit: 0,
    perUserLimit: 0,
    price: 0,
    qpsLimit: 0,
    remark: '',
    saleEndAt: '',
    saleStartAt: '',
    sortNo: specs.value.length + 1,
    specName: '',
    status: 1,
    stockLimit: 0,
    validDays: 30,
  });
}

function removeSpec(index: number) {
  if (specs.value.length <= 1) {
    message.warning($t('system.package.specRequired'));
    return;
  }
  specs.value.splice(index, 1);
}

function normalizeInitialSpecs(
  rows?: PackageApi.InterfacePackageSpec[],
): SpecForm[] {
  if (!rows || rows.length === 0) {
    return [
      {
        countMode: 'success',
        dailyLimit: 0,
        totalLimit: 0,
        perUserLimit: 0,
        price: 0,
        qpsLimit: 0,
        remark: '',
        saleEndAt: '',
        saleStartAt: '',
        sortNo: 1,
        specName: '',
        status: 1,
        stockLimit: 0,
        validDays: 30,
      },
    ];
  }
  return rows.map((item, index) => ({
    countMode: item.countMode === 'attempt' ? 'attempt' : 'success',
    dailyLimit: Number(item.dailyLimit ?? 0),
    totalLimit: Number(item.totalLimit ?? 0),
    id: item.id,
    perUserLimit: Number(item.perUserLimit ?? 0),
    price: item.price ?? 0,
    qpsLimit: Number(item.qpsLimit ?? 0),
    remark: item.remark ?? '',
    saleEndAt: item.saleEndAt ?? '',
    saleStartAt: item.saleStartAt ?? '',
    sortNo: item.sortNo ?? index + 1,
    specName: item.specName ?? '',
    status: item.status ?? 1,
    stockLimit: Number(item.stockLimit ?? 0),
    stockUsed: Number(item.stockUsed ?? 0),
    validDays: Number(item.validDays ?? 30),
  }));
}

function normalizeSpecs() {
  if (specs.value.length === 0) {
    message.warning($t('system.package.specRequired'));
    return false;
  }
  const result: PackageApi.InterfacePackageSpec[] = [];
  for (const [index, item] of specs.value.entries()) {
    if (!item.specName?.trim()) {
      message.warning($t('system.package.specNameRequired'));
      return false;
    }
    result.push({
      countMode: item.countMode === 'attempt' ? 'attempt' : 'success',
      dailyLimit: Number(item.dailyLimit ?? 0),
      totalLimit: Number(item.totalLimit ?? 0),
      id: item.id,
      perUserLimit: Number(item.perUserLimit ?? 0),
      price: item.price ?? 0,
      qpsLimit: Number(item.qpsLimit ?? 0),
      remark: item.remark,
      saleEndAt: item.saleEndAt ?? '',
      saleStartAt: item.saleStartAt ?? '',
      sortNo: item.sortNo || index + 1,
      specName: item.specName.trim(),
      status: item.status,
      stockLimit: Number(item.stockLimit ?? 0),
      validDays: Number(item.validDays ?? 30),
    });
  }
  return result;
}
</script>

<template>
  <Drawer :title="drawerTitle">
    <div class="interface-package-form">
      <Form />

      <div class="spec-section">
        <div class="spec-section__header">
          <span>{{ $t('system.package.specs') }}</span>
          <Button size="small" type="primary" @click="addSpec">
            <Plus class="size-4" />
            {{ $t('system.package.addSpec') }}
          </Button>
        </div>

        <div v-for="(item, index) in specs" :key="index" class="spec-card">
          <div class="spec-card__title">
            <span>{{ $t('system.package.spec') }} {{ index + 1 }}</span>
            <Button danger size="small" type="link" @click="removeSpec(index)">
              <IconifyIcon class="size-4" icon="lucide:trash-2" />
              {{ $t('common.delete') }}
            </Button>
          </div>
          <div class="spec-card__grid">
            <label>
              <span>{{ $t('system.package.specName') }}</span>
              <Input
                v-model:value="item.specName"
                :placeholder="$t('ui.placeholder.input')"
              />
            </label>
            <label>
              <span>{{ $t('system.package.price') }}</span>
              <InputNumber
                v-model:value="item.price"
                class="w-full"
                :min="0"
                :precision="4"
              />
            </label>
            <label>
              <span>{{ $t('system.package.dailyLimit') }}</span>
              <InputNumber
                v-model:value="item.dailyLimit"
                class="w-full"
                :min="0"
                :precision="0"
              />
            </label>
            <label>
              <span>{{ $t('system.package.totalLimit') }}</span>
              <InputNumber
                v-model:value="item.totalLimit"
                class="w-full"
                :min="0"
                :precision="0"
              />
              <small class="spec-card__hint">
                {{ $t('system.package.totalLimitHelp') }}
              </small>
            </label>
            <label>
              <span>{{ $t('system.package.countMode') }}</span>
              <Select
                v-model:value="item.countMode"
                class="w-full"
                :options="countModeOptions"
              />
              <small class="spec-card__hint">
                {{ $t('system.package.countModeHelp') }}
              </small>
            </label>
            <label>
              <span>{{ $t('system.package.validDays') }}</span>
              <InputNumber
                v-model:value="item.validDays"
                class="w-full"
                :min="1"
                :precision="0"
              />
            </label>
            <label>
              <span>{{ $t('system.package.qpsLimit') }}</span>
              <InputNumber
                v-model:value="item.qpsLimit"
                class="w-full"
                :min="0"
                :precision="0"
              />
            </label>
            <label>
              <span>{{ $t('system.package.stockLimit') }}</span>
              <InputNumber
                v-model:value="item.stockLimit"
                class="w-full"
                :min="0"
                :precision="0"
              />
              <small v-if="item.stockUsed" class="spec-card__hint">
                {{ $t('system.package.stockUsedHint', [item.stockUsed]) }}
              </small>
            </label>
            <label>
              <span>{{ $t('system.package.perUserLimit') }}</span>
              <InputNumber
                v-model:value="item.perUserLimit"
                class="w-full"
                :min="0"
                :precision="0"
              />
            </label>
            <label>
              <span>{{ $t('system.package.saleStartAt') }}</span>
              <DatePicker
                v-model:value="item.saleStartAt"
                class="w-full"
                show-time
                value-format="YYYY-MM-DD HH:mm:ss"
              />
            </label>
            <label>
              <span>{{ $t('system.package.saleEndAt') }}</span>
              <DatePicker
                v-model:value="item.saleEndAt"
                class="w-full"
                show-time
                value-format="YYYY-MM-DD HH:mm:ss"
              />
            </label>
            <label>
              <span>{{ $t('system.package.status') }}</span>
              <Switch
                :checked="item.status === 1"
                :checked-children="$t('system.register.enableAction')"
                :un-checked-children="$t('system.register.disableAction')"
                @change="(checked) => (item.status = checked ? 1 : 0)"
              />
            </label>
            <label>
              <span>{{ $t('system.package.sortNo') }}</span>
              <InputNumber
                v-model:value="item.sortNo"
                class="w-full"
                :min="0"
                :precision="0"
              />
            </label>
            <label class="spec-card__remark">
              <span>{{ $t('system.package.remark') }}</span>
              <Input
                v-model:value="item.remark"
                :placeholder="$t('ui.placeholder.input')"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  </Drawer>
</template>

<style scoped>
.interface-package-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.spec-section {
  padding-top: 18px;
  border-top: 1px solid hsl(var(--border));
}

.spec-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.spec-card {
  padding: 14px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.spec-card + .spec-card {
  margin-top: 12px;
}

.spec-card__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  font-weight: 600;
}

.spec-card__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.spec-card__grid label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: hsl(var(--foreground));
}

.spec-card__remark {
  grid-column: 1 / -1;
}

.spec-card__hint {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

@media (max-width: 768px) {
  .spec-card__grid {
    grid-template-columns: 1fr;
  }
}
</style>
