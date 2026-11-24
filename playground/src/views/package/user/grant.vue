<script lang="ts" setup>
import { computed, ref, watch } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import {
  DatePicker,
  message,
  Select,
  Textarea,
} from 'ant-design-vue';

import {
  getGlobalPackageList,
  getInterfacePackageList,
  getPointPackageList,
  grantUserEntitlement,
} from '#/api/package';
import { $t } from '#/locales';

type Scope = 'GLOBAL' | 'INTERFACE' | 'POINT';

const emits = defineEmits(['success']);
const submitting = ref(false);
const scope = ref<Scope>('GLOBAL');
const packageId = ref<string>();
const specId = ref<string>();
const usersText = ref('');
const endAt = ref<string>();

const globalOptions = ref<{ label: string; value: string }[]>([]);
const pointOptions = ref<{ label: string; value: string }[]>([]);
const interfaceOptions = ref<{ label: string; value: string }[]>([]);
const specOptions = ref<{ label: string; value: string }[]>([]);

const scopeOptions = computed(() => [
  { label: $t('system.package.scopeGlobal'), value: 'GLOBAL' },
  { label: $t('system.package.scopeInterface'), value: 'INTERFACE' },
  { label: $t('system.package.scopePoint'), value: 'POINT' },
]);

// 各类套餐统一取启用中的列表（管理端接口不过滤隐藏套餐，隐藏套餐正是在这里下发）。
async function loadPackageOptions() {
  globalOptions.value = [];
  pointOptions.value = [];
  interfaceOptions.value = [];
  specOptions.value = [];
  try {
    if (scope.value === 'GLOBAL') {
      const result = await getGlobalPackageList({ page: 1, pageSize: 100, status: 1 });
      globalOptions.value = (result.items ?? []).map((item) => ({
        label: `#${item.id} ${item.name}`,
        value: item.id,
      }));
    } else if (scope.value === 'POINT') {
      const result = await getPointPackageList({ page: 1, pageSize: 100, status: 1 });
      pointOptions.value = (result.items ?? []).map((item) => ({
        label: `#${item.id} ${item.name}（${$t('system.package.pointAmountText', [Number(item.pointAmount ?? 0)])}）`,
        value: item.id,
      }));
    } else {
      const result = await getInterfacePackageList({ page: 1, pageSize: 100, status: 1 });
      interfaceOptions.value = (result.items ?? []).map((item) => ({
        label: `#${item.id} ${item.name}`,
        value: item.id,
      }));
    }
  } catch {
    // 加载失败保持空列表，由用户重试；不阻塞抽屉打开。
  }
}

watch(scope, () => {
  packageId.value = undefined;
  specId.value = undefined;
  void loadPackageOptions();
});

watch(packageId, () => {
  specId.value = undefined;
  specOptions.value = [];
  if (scope.value !== 'INTERFACE') return;
  const id = packageId.value;
  getInterfacePackageList({ page: 1, pageSize: 100, status: 1 })
    .then((result) => {
      const found = (result.items ?? []).find((item) => item.id === id);
      specOptions.value = (found?.specs ?? [])
        .filter((spec) => spec.status === 1)
        .map((spec) => ({
          label: `#${spec.id} ${spec.specName}`,
          value: spec.id ?? '',
        }))
        .filter((option) => option.value !== '');
    })
    .catch(() => {
      specOptions.value = [];
    });
});

const [Drawer, drawerApi] = useVbenDrawer({
  onConfirm() {
    return submit();
  },
  async onOpenChange(isOpen) {
    if (!isOpen) return;
    scope.value = 'GLOBAL';
    packageId.value = undefined;
    specId.value = undefined;
    usersText.value = '';
    endAt.value = undefined;
    globalOptions.value = [];
    pointOptions.value = [];
    interfaceOptions.value = [];
    specOptions.value = [];
    void loadPackageOptions();
  },
});

async function submit() {
  const users = usersText.value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (users.length === 0) {
    message.warning($t('system.package.grantUsersRequired'));
    return;
  }
  if (scope.value === 'INTERFACE' && !specId.value) {
    message.warning($t('system.package.grantSelectSpec'));
    return;
  }
  if (scope.value !== 'INTERFACE' && !packageId.value) {
    message.warning($t('system.package.grantSelectPackage'));
    return;
  }
  submitting.value = true;
  try {
    const result = await grantUserEntitlement({
      scope: scope.value,
      packageId:
        scope.value === 'GLOBAL' || scope.value === 'POINT'
          ? Number(packageId.value)
          : undefined,
      specId: scope.value === 'INTERFACE' ? Number(specId.value) : undefined,
      users,
      endAt: endAt.value ?? '',
    });
    if (result.notFound && result.notFound.length > 0) {
      message.warning(
        $t('system.package.grantPartialSuccess', [
          result.granted,
          result.notFound.join(', '),
        ]),
      );
    } else {
      message.success($t('system.package.grantSuccess', [result.granted]));
    }
    emits('success');
    drawerApi.close();
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Drawer :title="$t('system.package.grantTitle')" class="w-[520px]">
    <div class="flex flex-col gap-4">
      <label class="flex flex-col gap-1.5">
        <span class="text-sm font-medium">{{ $t('system.package.scope') }}</span>
        <Select
          v-model:value="scope"
          :options="scopeOptions"
          :placeholder="$t('system.package.scope')"
        />
      </label>

      <label
        v-if="scope === 'GLOBAL'"
        class="flex flex-col gap-1.5"
      >
        <span class="text-sm font-medium">
          {{ $t('system.package.globalTitle') }}
        </span>
        <Select
          v-model:value="packageId"
          :options="globalOptions"
          :placeholder="$t('system.package.grantSelectPackage')"
          show-search
          option-filter-prop="label"
        />
      </label>

      <label
        v-else-if="scope === 'POINT'"
        class="flex flex-col gap-1.5"
      >
        <span class="text-sm font-medium">
          {{ $t('system.package.pointTitle') }}
        </span>
        <Select
          v-model:value="packageId"
          :options="pointOptions"
          :placeholder="$t('system.package.grantSelectPackage')"
          show-search
          option-filter-prop="label"
        />
      </label>

      <template v-else>
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-medium">
            {{ $t('system.package.interfaceTitle') }}
          </span>
          <Select
            v-model:value="packageId"
            :options="interfaceOptions"
            :placeholder="$t('system.package.grantSelectPackage')"
            show-search
            option-filter-prop="label"
          />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-medium">{{ $t('system.package.spec') }}</span>
          <Select
            v-model:value="specId"
            :disabled="!packageId"
            :options="specOptions"
            :placeholder="$t('system.package.grantSelectSpec')"
          />
        </label>
      </template>

      <label class="flex flex-col gap-1.5">
        <span class="text-sm font-medium">
          {{ $t('system.package.grantUsers') }}
        </span>
        <Textarea
          v-model:value="usersText"
          :autosize="{ minRows: 5, maxRows: 12 }"
          :placeholder="$t('system.package.grantUsersPlaceholder')"
        />
      </label>

      <label class="flex flex-col gap-1.5">
        <span class="text-sm font-medium">
          {{ $t('system.package.grantEndAt') }}
        </span>
        <DatePicker
          v-model:value="endAt"
          class="w-full"
          show-time
          value-format="YYYY-MM-DD HH:mm:ss"
          :placeholder="$t('system.package.grantEndAtPlaceholder')"
        />
        <span class="text-muted-foreground text-xs">
          {{ $t('system.package.grantEndAtHelp') }}
        </span>
      </label>

      <p class="text-muted-foreground text-xs">
        {{ $t('system.package.grantHelp') }}
      </p>
    </div>
  </Drawer>
</template>
