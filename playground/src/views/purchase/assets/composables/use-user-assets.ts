import type { PackageApi } from '#/api/package';
import type { QuotaApi } from '#/api/quota';

import {
  computed,
  onMounted,
  reactive,
  readonly,
  shallowReadonly,
  shallowRef,
} from 'vue';

import {
  getUserBillingRecords,
  getUserPackages,
  getUserWalletTransactions,
  setPrimaryPackage as setPrimaryPackageApi,
} from '#/api/package';
import { getQuotaOverview } from '#/api/quota';

const defaultPageSize = 10;

export function useUserAssets() {
  const billingRecords = shallowRef<PackageApi.BillingRecord[]>([]);
  const billingLoading = shallowRef(false);
  const packageLoading = shallowRef(false);
  const packages = shallowRef<PackageApi.UserPackage[]>([]);
  const quotaLoading = shallowRef(false);
  const quotaOverview = shallowRef<null | QuotaApi.Overview>(null);
  const walletLoading = shallowRef(false);
  const walletTransactions = shallowRef<PackageApi.WalletTransaction[]>([]);
  const walletPage = reactive({ current: 1, pageSize: defaultPageSize, total: 0 });
  const billingPage = reactive({
    current: 1,
    pageSize: defaultPageSize,
    total: 0,
  });
  let billingSequence = 0;
  let packageSequence = 0;
  let quotaSequence = 0;
  let walletSequence = 0;

  const loading = computed(
    () =>
      billingLoading.value ||
      packageLoading.value ||
      quotaLoading.value ||
      walletLoading.value,
  );

  // 免费额度与付费额度是一次请求取回的同一份快照，必须同批刷新，
  // 否则用户会看到「免费已用尽」和「套餐已扣」来自两个不同时刻。
  async function loadQuota() {
    const sequence = ++quotaSequence;
    quotaLoading.value = true;
    try {
      const result = await getQuotaOverview();
      if (sequence === quotaSequence) {
        quotaOverview.value = result ?? null;
      }
    } finally {
      if (sequence === quotaSequence) {
        quotaLoading.value = false;
      }
    }
  }

  async function loadPackages() {
    const sequence = ++packageSequence;
    packageLoading.value = true;
    try {
      const result = await getUserPackages();
      if (sequence === packageSequence) {
        packages.value = result ?? [];
      }
    } finally {
      if (sequence === packageSequence) {
        packageLoading.value = false;
      }
    }
  }

  async function loadWalletTransactions() {
    const sequence = ++walletSequence;
    walletLoading.value = true;
    try {
      const result = await getUserWalletTransactions({
        page: walletPage.current,
        pageSize: walletPage.pageSize,
      });
      if (sequence === walletSequence) {
        walletTransactions.value = result.items ?? [];
        walletPage.total = result.total ?? 0;
      }
    } finally {
      if (sequence === walletSequence) {
        walletLoading.value = false;
      }
    }
  }

  async function loadBillingRecords() {
    const sequence = ++billingSequence;
    billingLoading.value = true;
    try {
      const result = await getUserBillingRecords({
        page: billingPage.current,
        pageSize: billingPage.pageSize,
      });
      if (sequence === billingSequence) {
        billingRecords.value = result.items ?? [];
        billingPage.total = result.total ?? 0;
      }
    } finally {
      if (sequence === billingSequence) {
        billingLoading.value = false;
      }
    }
  }

  async function refresh() {
    await Promise.all([
      loadPackages(),
      loadQuota(),
      loadWalletTransactions(),
      loadBillingRecords(),
    ]);
  }

  async function changeWalletPage(page: number, pageSize: number) {
    walletPage.current = pageSize === walletPage.pageSize ? page : 1;
    walletPage.pageSize = pageSize;
    await loadWalletTransactions();
  }

  async function changeBillingPage(page: number, pageSize: number) {
    billingPage.current = pageSize === billingPage.pageSize ? page : 1;
    billingPage.pageSize = pageSize;
    await loadBillingRecords();
  }

  // 主套餐在服务端全局唯一：设一个就清掉另一个，前端不做本地推断，直接重拉列表。
  async function changePrimaryPackage(
    scope: PackageApi.UserPackage['scope'],
    recordId: number,
  ) {
    await setPrimaryPackageApi({ id: recordId, scope });
    // 主套餐改变的是扣减顺序，概览里「下一个会扣谁」的排序也要跟着变。
    await Promise.all([loadPackages(), loadQuota()]);
  }

  onMounted(refresh);

  return {
    billingPage: readonly(billingPage),
    billingRecords: readonly(billingRecords),
    billingLoading: readonly(billingLoading),
    changeBillingPage,
    changePrimaryPackage,
    changeWalletPage,
    loading: readonly(loading),
    packageLoading: readonly(packageLoading),
    packages: readonly(packages),
    quotaLoading: readonly(quotaLoading),
    // 用浅只读：页面不能改它，但嵌套数组类型保持可写，省掉组件侧一堆 DeepReadonly。
    quotaOverview: shallowReadonly(quotaOverview),
    refresh,
    walletPage: readonly(walletPage),
    walletLoading: readonly(walletLoading),
    walletTransactions: readonly(walletTransactions),
  };
}
