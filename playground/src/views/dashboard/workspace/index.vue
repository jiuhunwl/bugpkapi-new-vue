<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import type {
  AdminOverviewField,
  AdminWorkbenchAlert,
  UserCallTrendKey,
  UserWorkbenchStats,
} from '#/api/core/user';
import type { NoticeApi } from '#/api/notice';
import type { RechargeApi } from '#/api/payment';
import type {
  OnlinePayChannel,
  OnlinePaymentMethod,
} from '#/api/payment-routing';

import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useVbenDrawer, WorkbenchHeader } from '@vben/common-ui';
import { IconifyIcon, RotateCw } from '@vben/icons';
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';
import { useUserStore } from '@vben/stores';
import { openWindow } from '@vben/utils';

import {
  Button,
  Input,
  InputNumber,
  message,
  Modal,
  QRCode,
  Radio,
  RadioGroup,
  Spin,
  TabPane,
  Tabs,
  Tag,
} from 'ant-design-vue';

import { getRegisterConfigApi } from '#/api/core/auth';
import { getUserWorkbenchStatsApi } from '#/api/core/user';
import {
  getUserNoticeDetail,
  getUserNoticeList,
  getUserPopupNotices,
} from '#/api/notice';
import {
  continuePaymentOrder,
  createRechargeOrder,
  findPendingPaymentOrder,
  getRechargeCapabilities,
  submitTrc20TxID,
  syncRechargeOrder,
} from '#/api/payment';
import {
  chainDepositNetworkLabel,
  enabledOnlinePaymentMethods,
  findRechargePresetId,
  isChainDepositChannel,
} from '#/api/payment-routing';
import AdminAccessAtlas from '#/components/admin-access/AdminAccessAtlas.vue';
import AdvertisementSlot from '#/components/advertisement/AdvertisementSlot.vue';
import { QR_LOCKED_PLACEHOLDER } from '#/components/payment-agreement/content';
import PaymentAgreementConsent from '#/components/payment-agreement/PaymentAgreementConsent.vue';
import PaymentQrShield from '#/components/payment-agreement/PaymentQrShield.vue';
import RichTextPreview from '#/components/rich-text-preview/index.vue';
import {
  refreshSettlementCurrency,
  settlementDisplayName,
  useSettlementCurrency,
} from '#/composables/use-settlement-currency';
import { useSiteLogo } from '#/composables/use-site-logo';
import { $t } from '#/locales';
import { submitAlipayForm } from '#/utils/alipay-form';
import { copyText } from '#/utils/copy-text';
import { preopenDetachedWindow } from '#/utils/safe-window';
import { resolveUserAvatar } from '#/utils/user-avatar';

import AdminRefreshControl from './admin-refresh-control.vue';
import { useAdminAutoRefresh } from './use-admin-auto-refresh';
import {
  adminWorkbenchSections,
  useAdminWorkbench,
} from './use-admin-workbench';
import { useWorkbenchRefresh } from './use-workbench-refresh';
import {
  createDefaultUserWorkbenchStats,
  emptyAdminCallTrend,
  emptyAdminRevenueTrend,
  emptyUserCallTrend,
  normalizeUserWorkbenchStats,
} from './workspace-stats';

const router = useRouter();
const route = useRoute();

const {
  currency: settlementCurrency,
  fromCNY: settlementFromCNY,
  priceText: settlementPriceText,
  symbol: settlementSymbol,
  toCNY: settlementToCNY,
} = useSettlementCurrency();

const userStore = useUserStore();
const userAvatar = computed(() =>
  resolveUserAvatar(userStore.userInfo?.avatar),
);

type HeaderAssetAction = 'balanceRecharge' | 'packageDetail';

interface HeaderAssetItem {
  action?: HeaderAssetAction | undefined;
  icon: string;
  label: string;
  value: string;
}

interface UserQuickActionItem {
  accent: string;
  badge?: string;
  description: string;
  icon: string;
  title: string;
  url: string;
}

interface QuickNavItem {
  color?: string;
  icon: string;
  title: string;
  url?: string;
}

type PackageDetailTab = 'global' | 'interface';

const userWorkbenchDefaultLabels = {
  currentPackageName: $t('page.dashboard.workbench.defaults.normalUser'),
  currentPackageType: $t('page.dashboard.workbench.defaults.basicAccount'),
};
const userStats = ref<UserWorkbenchStats>(
  createDefaultUserWorkbenchStats(userWorkbenchDefaultLabels),
);
const isUserWorkspace = computed(
  () => !(userStore.userInfo?.roles ?? []).includes('admin'),
);
// 页面级取消：进入工作台时创建，卸载时 abort 取消所有在途工作台请求（防 stale 回写）
const refreshAbort = new AbortController();
const {
  accessRange: adminAccessRange,
  available: adminSectionAvailable,
  degraded: adminSectionDegraded,
  errors: adminSectionErrors,
  loading: adminSectionLoading,
  overviewAvailable: adminOverviewAvailable,
  lastOverviewSuccessAt,
  lastRefreshSucceeded,
  refreshAll: refreshAdminWorkbench,
  setAccessRange: setAdminAccessRange,
  stats: adminStats,
} = useAdminWorkbench({
  fallbackErrorMessage: () =>
    $t('page.dashboard.workbench.admin.module.loadFailed'),
  // 重查询 + 分析聚合：允许最多 2 次自动重试（指数退避），单 section 非致命失败不重试
  retry: 2,
  retryBaseDelayMs: 250,
  requestConfig: { signal: refreshAbort.signal },
  async onRefreshed(section) {
    await nextTick();
    if (section === 'callTrend7d') {
      renderAdminCallTrendChart();
    } else if (section === 'revenueTrend7d') {
      renderAdminRevenueTrendChart();
    }
  },
});

// 页面级刷新协调器：统一挂载直调 / 手动刷新 / 轮询的“单飞令牌”
const refreshCoordinator = useWorkbenchRefresh({
  refresh: async () => {
    // 管理员才刷新统计；协调器返回布尔表示本次是否成功
    if (isUserWorkspace.value) {
      return true;
    }
    try {
      await refreshAdminWorkbench();
      return lastRefreshSucceeded.value;
    } catch {
      return false;
    }
  },
});

const {
  intervalSeconds: adminAutoRefreshSeconds,
  setIntervalSeconds: setAdminAutoRefreshSeconds,
} = useAdminAutoRefresh(async () => {
  if (!isUserWorkspace.value) {
    // 轮询触发 → 走协调器弱触发（drop/merge，不与手动/挂载叠加）
    await refreshCoordinator.refresh();
  }
});

/**
 * 手动刷新按钮：优先走协调器 force（若系统在轮询/熔断中，等待或打断旧轮询发起新刷新）。
 * 由于一次全量聚合已覆盖所有 section，这里直接强刷全量即可（仍 1 次 HTTP）。
 */
function refreshAdminSection(_section: string) {
  return refreshCoordinator.refresh({ force: true });
}

/**
 * 聚合工作台整页错误：仅当全部 section 都失败时才展示整页横幅。
 * 单 section 失败或降级不再误报整页"模块加载失败"——单 section 错误由各面板内联展示，
 * 降级（数据未就绪）静默保留旧数据。
 */
const adminWorkbenchError = computed(() => {
  const errored = adminWorkbenchSections.filter((section) =>
    Boolean(adminSectionErrors[section]?.trim()),
  );
  // 全部 section 都失败才整页报错
  if (errored.length === adminWorkbenchSections.length) {
    return errored[0] ? (adminSectionErrors[errored[0]] ?? '') : '';
  }
  return '';
});
const emailServiceEnabled = ref(false);
const packageDetailTab = ref<PackageDetailTab>('global');
const [PackageDetailDrawer, packageDetailDrawerApi] = useVbenDrawer({
  cancelText: $t('page.dashboard.workbench.actions.close'),
  onCancel() {
    packageDetailDrawerApi.close();
  },
  showConfirmButton: false,
});
const rechargeVisible = ref(false);
const rechargeAmount = ref<number>(50);
const rechargeLoading = ref(false);
const rechargeSyncLoading = ref(false);
const rechargePaid = ref(false);
const rechargeCapabilities = ref<null | RechargeApi.Capabilities>(null);
const rechargeOrder = ref<null | RechargeApi.RechargeOrder>(null);
const rechargePendingExisting = ref<null | RechargeApi.RechargeOrder>(null);
const trc20Txid = ref('');
const trc20Submitting = ref(false);
const rechargeCountdownSeconds = ref(0);
const rechargeExpired = ref(false);
const rechargePayChannel = ref<OnlinePayChannel>('ALIPAY');
const rechargePreferredProduct = ref<RechargeApi.PayProduct>('AUTO');
// 充值弹窗的支付协议勾选状态：未勾选时二维码虚化并叠锁层
const rechargeAgreementAccepted = ref(false);
const rechargeConsentRef = ref<HTMLElement>();
const { logoFailed: rechargeLogoFailed, logoUrl: rechargeLogoUrl } =
  useSiteLogo();
let rechargeTimer: number | undefined;
let rechargeCountdownTimer: number | undefined;

const rechargeCountdownText = computed(() => {
  const seconds = Math.max(rechargeCountdownSeconds.value, 0);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
});

const dailyNoticeVisible = ref(false);
const dailyNoticeLoading = ref(false);
const dailyPopupNotices = ref<NoticeApi.NoticeItem[]>([]);
const dailyPopupTotal = ref(0);
const activeDailyNoticeId = ref<string>();
const workspaceNoticeLoading = ref(false);
const workspaceNoticeDetailLoading = ref(false);
const workspaceNoticeVisible = ref(false);
const workspaceNotices = ref<NoticeApi.NoticeItem[]>([]);
const currentWorkspaceNotice = ref<NoticeApi.NoticeItem>();

// AdminRefreshControl emit 的是 number，直接转发给 setter
function handleAdminRefreshIntervalChange(value: number) {
  setAdminAutoRefreshSeconds(value);
}

const activeDailyNotice = computed(
  () =>
    dailyPopupNotices.value.find(
      (item) => item.id === activeDailyNoticeId.value,
    ) ?? dailyPopupNotices.value[0],
);

const activeDailyNoticeContent = computed(
  () => activeDailyNotice.value?.contentHtml ?? '',
);

const currentWorkspaceNoticeContent = computed(
  () => currentWorkspaceNotice.value?.contentHtml ?? '',
);

const rechargeClientType = computed<RechargeApi.ClientType>(() =>
  isMobileDevice() ? 'MOBILE' : 'DESKTOP',
);

const rechargeDefaultProduct = computed(() => {
  if (!rechargeCapabilities.value) {
    return '';
  }
  return rechargeClientType.value === 'MOBILE'
    ? rechargeCapabilities.value.mobileDefault
    : rechargeCapabilities.value.desktopDefault;
});

const rechargeDefaultProductName = computed(() =>
  payProductName(rechargeDefaultProduct.value),
);

const rechargeAlipayUsable = computed(() => {
  const capabilities = rechargeCapabilities.value;
  return (
    !!capabilities?.alipayEnabled &&
    (capabilities.websitePayEnabled ||
      capabilities.wapPayEnabled ||
      capabilities.facePayEnabled)
  );
});

const rechargeChainDeposit = computed(() =>
  isChainDepositChannel(rechargeOrder.value?.payChannel),
);
const rechargeChainNetwork = computed(() =>
  chainDepositNetworkLabel(rechargeOrder.value?.payChannel),
);

const rechargeOnlineMethods = computed<OnlinePaymentMethod[]>(() => {
  const capabilities = rechargeCapabilities.value;
  if (Array.isArray(capabilities?.methods)) {
    return enabledOnlinePaymentMethods(capabilities.methods);
  }

  const fallback: OnlinePaymentMethod[] = [];
  if (rechargeAlipayUsable.value) {
    fallback.push({ code: 'ALIPAY', enabled: true, sortOrder: 20 });
  }
  if (capabilities?.wechatEnabled) {
    fallback.push({ code: 'WECHAT', enabled: true, sortOrder: 30 });
  }
  return fallback;
});

const rechargeChannelOptions = computed(() => {
  return rechargeOnlineMethods.value.map((method) => ({
    description: rechargeChannelDescription(method.code),
    label: rechargeChannelLabel(method.code),
    value: method.code,
  }));
});

const rechargeProductOptions = computed(() => {
  const capabilities = rechargeCapabilities.value;
  if (!capabilities) {
    return [
      {
        label: $t('page.dashboard.workbench.recharge.autoSelect'),
        value: 'AUTO' as const,
      },
    ];
  }
  const options: Array<{ label: string; value: RechargeApi.PayProduct }> = [
    {
      label: rechargeDefaultProductName.value
        ? $t('page.dashboard.workbench.recharge.autoSelectWithProduct', [
            rechargeDefaultProductName.value,
          ])
        : $t('page.dashboard.workbench.recharge.autoSelect'),
      value: 'AUTO',
    },
  ];
  if (
    rechargeClientType.value === 'DESKTOP' &&
    capabilities.websitePayEnabled
  ) {
    options.push({
      label: $t('page.dashboard.workbench.recharge.websitePay'),
      value: 'PAGE',
    });
  }
  if (rechargeClientType.value === 'MOBILE' && capabilities.wapPayEnabled) {
    options.push({
      label: $t('page.dashboard.workbench.recharge.wapPay'),
      value: 'WAP',
    });
  }
  if (capabilities.facePayEnabled) {
    options.push({
      label: $t('page.dashboard.workbench.recharge.facePay'),
      value: 'FACE',
    });
  }
  return options;
});

const rechargeAmountOptions = computed(() =>
  (rechargeCapabilities.value?.amountOptions ?? [])
    .map((item) => ({
      ...item,
      amount: normalizeMoneyNumber(item.amount),
      giftAmount: normalizeMoneyNumber(item.giftAmount),
    }))
    .filter((item) => item.amount >= 0.01),
);

const selectedRechargeAmountOption = computed(() =>
  rechargeAmountOptions.value.find((item) =>
    isSameMoneyValue(item.amount, rechargeAmount.value),
  ),
);

const selectedRechargePresetId = computed(() =>
  findRechargePresetId(rechargeAmountOptions.value, rechargeAmount.value),
);

const selectedRechargeGiftAmount = computed(
  () => selectedRechargeAmountOption.value?.giftAmount ?? 0,
);

const selectedRechargeCreditAmount = computed(
  () =>
    normalizeMoneyNumber(rechargeAmount.value) +
    selectedRechargeGiftAmount.value,
);

// USD 模式下输入框展示站点货币金额，回写时吸附到匹配的充值预设，
// 避免汇率取整导致 selectedRechargePresetId 匹配失败。
const rechargeAmountInput = computed<number>({
  get: () => settlementFromCNY(rechargeAmount.value),
  set: (value) => {
    const next = Number(value);
    if (!Number.isFinite(next)) return;
    if (settlementCurrency.value !== 'USD') {
      rechargeAmount.value = next;
      return;
    }
    const matched = rechargeAmountOptions.value.find((item) =>
      isSameMoneyValue(settlementFromCNY(item.amount), next),
    );
    rechargeAmount.value = matched ? matched.amount : settlementToCNY(next);
  },
});

const welcomeDescription = computed(() =>
  isUserWorkspace.value
    ? $t('page.dashboard.workbench.welcome.userDescription')
    : $t('page.dashboard.workbench.welcome.adminDescription'),
);

const welcomeTitleKey = computed(() => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'page.dashboard.workbench.welcome.title';
  if (hour >= 12 && hour < 18)
    return 'page.dashboard.workbench.welcome.afternoon';
  if (hour >= 18 && hour < 23)
    return 'page.dashboard.workbench.welcome.evening';
  return 'page.dashboard.workbench.welcome.night';
});

const adminOverview = computed(() => adminStats.value.overview);
const adminOverviewStatusMessage = computed(() =>
  adminSectionErrors.overview || (adminSectionDegraded.overview ? $t('page.dashboard.workbench.admin.module.overviewPending') : ''),
);

function formatAdminOverviewCount(field: AdminOverviewField) {
  return adminOverviewAvailable[field] ? formatCount(adminOverview.value[field]) : '—';
}

function formatAdminOverviewMoney(field: AdminOverviewField) {
  return adminOverviewAvailable[field] ? formatMoney(adminOverview.value[field]) : '—';
}

function formatAdminOverviewText(field: AdminOverviewField) {
  return adminOverviewAvailable[field] ? adminOverview.value[field] : '—';
}

const adminOutcomes = computed(() => adminStats.value.outcomes);
const adminOutcomeRate = (key: keyof UserWorkbenchStats['outcomes']) =>
  adminOutcomes.value.available ? String(adminOutcomes.value[key]) : '—';

interface AdminMetricCard {
  icon: string;
  meta: string;
  metaDetail?: string;
  title: string;
  tone: string;
  value: string;
}

const adminMetricCards = computed<AdminMetricCard[]>(() => [
  {
    icon: 'lucide:activity',
    meta: `${$t('page.dashboard.workbench.admin.metrics.successRate', [
      formatAdminOverviewText('todaySuccessRate'),
    ])} · ${$t('page.dashboard.workbench.admin.metrics.serviceFailureRate', [
      adminOutcomeRate('serviceFailureRate'),
    ])}`,
    metaDetail: `${$t('page.dashboard.workbench.metrics.clientErrorRate')} ${adminOutcomeRate('clientErrorRate')} · ${$t('page.dashboard.workbench.metrics.throttleRate')} ${adminOutcomeRate('throttleRate')} · ${$t('page.dashboard.workbench.metrics.expectedEmptyRate')} ${adminOutcomeRate('expectedEmptyRate')}`,
    tone: 'blue',
    title: $t('page.dashboard.workbench.admin.metrics.todayCalls'),
    value: formatAdminOverviewCount('todayCalls'),
  },
  {
    icon: 'lucide:wallet',
    meta: $t('page.dashboard.workbench.admin.metrics.totalRevenue', [
      formatAdminOverviewMoney('totalRevenue'),
    ]),
    tone: 'green',
    title: $t('page.dashboard.workbench.admin.metrics.todayRevenue'),
    value: formatAdminOverviewMoney('todayRevenue'),
  },
  {
    icon: 'lucide:users',
    meta: $t('page.dashboard.workbench.admin.metrics.todayNewUsers', [
      formatAdminOverviewCount('todayNewUsers'),
    ]),
    tone: 'violet',
    title: $t('page.dashboard.workbench.admin.metrics.platformUsers'),
    value: formatAdminOverviewCount('totalUsers'),
  },
  {
    icon: 'lucide:plug-zap',
    meta: $t('page.dashboard.workbench.admin.metrics.enabledTotal', [
      formatAdminOverviewCount('apiEnabled'),
      formatAdminOverviewCount('apiTotal'),
    ]),
    tone: 'orange',
    title: $t('page.dashboard.workbench.admin.metrics.apiTotal'),
    value: formatAdminOverviewCount('apiTotal'),
  },
  {
    icon: 'lucide:key-round',
    meta: $t('page.dashboard.workbench.admin.metrics.enabledTotal', [
      formatAdminOverviewCount('keyEnabled'),
      formatAdminOverviewCount('keyTotal'),
    ]),
    tone: 'cyan',
    title: $t('page.dashboard.workbench.admin.metrics.userKeys'),
    value: formatAdminOverviewCount('keyTotal'),
  },
  {
    icon: 'lucide:receipt',
    meta: $t('page.dashboard.workbench.admin.metrics.pendingFriendLinks', [
      formatAdminOverviewCount('pendingFriendLinks'),
    ]),
    tone: 'rose',
    title: $t('page.dashboard.workbench.admin.metrics.pendingOrders'),
    value: formatAdminOverviewCount('pendingOrders'),
  },
]);

const adminHotApis = computed(() => adminStats.value.hotApis ?? []);
const adminActiveUsers = computed(() => adminStats.value.activeUsers ?? []);

const ADMIN_ALERT_LEVEL_WEIGHT: Record<
  AdminWorkbenchAlert['level'],
  number
> = {
  danger: 0,
  info: 2,
  success: 3,
  warning: 1,
};

const adminAlerts = computed(() =>
  [...(adminStats.value.alerts ?? [])].toSorted(
    (left, right) =>
      ADMIN_ALERT_LEVEL_WEIGHT[left.level] -
      ADMIN_ALERT_LEVEL_WEIGHT[right.level],
  ),
);

const adminAlertCounts = computed(() => {
  const counts: Record<AdminWorkbenchAlert['level'], number> = {
    danger: 0,
    info: 0,
    success: 0,
    warning: 0,
  };
  for (const alert of adminAlerts.value) {
    counts[alert.level] += 1;
  }
  return counts;
});

const adminAlertTotal = computed(() => adminAlerts.value.length);

const adminHealthState = computed<
  'danger' | 'healthy' | 'info' | 'pending' | 'warning'
>(() => {
  if (!adminSectionAvailable.alerts || adminSectionErrors.alerts) {
    return 'pending';
  }
  if (adminAlertCounts.value.danger > 0) return 'danger';
  if (adminAlertCounts.value.warning > 0) return 'warning';
  if (adminAlertTotal.value > 0) return 'info';
  return 'healthy';
});

const adminHealthLabel = computed(() =>
  $t(`page.dashboard.workbench.admin.alerts.status.${adminHealthState.value}`),
);

const adminAlertLevelMeta: Record<
  AdminWorkbenchAlert['level'],
  { icon: string; labelKey: string }
> = {
  danger: {
    icon: 'lucide:octagon-alert',
    labelKey: 'page.dashboard.workbench.admin.alerts.level.danger',
  },
  info: {
    icon: 'lucide:info',
    labelKey: 'page.dashboard.workbench.admin.alerts.level.info',
  },
  success: {
    icon: 'lucide:circle-check',
    labelKey: 'page.dashboard.workbench.admin.alerts.level.success',
  },
  warning: {
    icon: 'lucide:triangle-alert',
    labelKey: 'page.dashboard.workbench.admin.alerts.level.warning',
  },
};

function adminAlertLevel(level: AdminWorkbenchAlert['level']) {
  return adminAlertLevelMeta[level];
}

const adminAlertSeverityChips = computed(() =>
  (['danger', 'warning', 'info'] as const)
    .map((level) => ({
      count: adminAlertCounts.value[level],
      label: $t(adminAlertLevelMeta[level].labelKey),
      level,
    }))
    .filter((item) => item.count > 0),
);

const ADMIN_ALERT_SCOPES = [
  {
    labelKey: 'page.dashboard.workbench.admin.alerts.scope.risk',
    prefix: '/risk-control/dashboard',
  },
  {
    labelKey: 'page.dashboard.workbench.admin.alerts.scope.orders',
    prefix: '/payment/orders',
  },
  {
    labelKey: 'page.dashboard.workbench.admin.alerts.scope.friends',
    prefix: '/content/friend-link',
  },
  {
    labelKey: 'page.dashboard.workbench.admin.alerts.scope.tickets',
    prefix: '/admin/tickets',
  },
  {
    labelKey: 'page.dashboard.workbench.admin.alerts.scope.audit',
    prefix: '/system/operation-log',
  },
  {
    labelKey: 'page.dashboard.workbench.admin.alerts.scope.api',
    prefix: '/console/call-logs',
  },
] as const;

function adminAlertScope(alert: AdminWorkbenchAlert) {
  const text = `${alert.title} ${alert.content}`;
  if (text.includes('投影') || text.includes('聚合')) {
    return $t('page.dashboard.workbench.admin.alerts.scope.dataHealth');
  }
  if (!alert.url) return '';
  const matched = ADMIN_ALERT_SCOPES.find((item) =>
    alert.url?.startsWith(item.prefix),
  );
  return matched ? $t(matched.labelKey) : '';
}

const adminOutcomeSegments = computed(() => {
  const outcomes = adminOutcomes.value;
  if (!outcomes.available) return [];
  // 五个结果桶（成功/空结果/客户端错误/限流/上游失败）严格等于 calls，
  // 用 calls 作分母才能保证构成条完整铺满。
  const total = Number(outcomes.calls || 0);
  if (total <= 0) return [];
  return [
    {
      color: '#16a34a',
      count: Number(outcomes.successCalls || 0),
      key: 'success',
      label: $t('page.dashboard.workbench.admin.alerts.health.success'),
    },
    {
      color: '#f97316',
      count: Number(outcomes.clientErrorCalls || 0),
      key: 'clientError',
      label: $t('page.dashboard.workbench.admin.alerts.health.clientError'),
    },
    {
      color: '#eab308',
      count: Number(outcomes.throttledCalls || 0),
      key: 'throttled',
      label: $t('page.dashboard.workbench.admin.alerts.health.throttled'),
    },
    {
      color: '#94a3b8',
      count: Number(outcomes.expectedEmptyCalls || 0),
      key: 'expectedEmpty',
      label: $t('page.dashboard.workbench.admin.alerts.health.expectedEmpty'),
    },
    {
      color: '#ef4444',
      count: Number(outcomes.upstreamFailureCalls || 0),
      key: 'upstreamFailure',
      label: $t(
        'page.dashboard.workbench.admin.alerts.health.upstreamFailure',
      ),
    },
  ]
    .filter((item) => item.count > 0)
    .map((item) => ({ ...item, percent: (item.count / total) * 100 }));
});

const adminWorstApi = computed(() => {
  const items = [...adminHotApis.value];
  if (items.length === 0) return undefined;
  const rate = (value: string) => Number.parseFloat(value) || 0;
  return items.toSorted((left, right) => {
    const failureDiff = Number(right.failedCalls) - Number(left.failedCalls);
    if (failureDiff !== 0) return failureDiff;
    return rate(left.successRate) - rate(right.successRate);
  })[0];
});

const adminOutcomeAria = computed(() =>
  adminOutcomeSegments.value
    .map((segment) => `${segment.label} ${formatCount(segment.count)}`)
    .join(', '),
);

const hasBoundEmail = computed(() =>
  Boolean(String(userStore.userInfo?.email ?? '').trim()),
);
const shouldShowBindEmailWarning = computed(
  () =>
    isUserWorkspace.value && emailServiceEnabled.value && !hasBoundEmail.value,
);

const memberPackage = computed(() => userStats.value.memberPackage ?? null);

const hasPackageDetail = computed(
  () =>
    Boolean(memberPackage.value) ||
    (userStats.value.interfacePackages?.length ?? 0) > 0 ||
    userStats.value.interfacePackageCount > 0,
);

const roleDisplayName = computed(() => {
  const key = userStats.value.roleKey;
  const labels: Record<string, string> = {
    admin: $t('page.dashboard.workbench.roles.admin'),
    sssvip: $t('page.dashboard.workbench.roles.sssvip'),
    ssvip: $t('page.dashboard.workbench.roles.ssvip'),
    svip: $t('page.dashboard.workbench.roles.svip'),
    user: $t('page.dashboard.workbench.roles.user'),
    user_pro: $t('page.dashboard.workbench.roles.user_pro'),
    vip: $t('page.dashboard.workbench.roles.vip'),
  };
  return (
    labels[key] ||
    userStats.value.roleName ||
    userStats.value.currentPackageType ||
    $t('page.dashboard.workbench.defaults.basicAccount')
  );
});

const headerAssets = computed<HeaderAssetItem[]>(() => [
  {
    action: 'balanceRecharge',
    icon: 'lucide:wallet-cards',
    label: $t('page.dashboard.workbench.assets.balance'),
    value: formatSiteMoney(userStats.value.balance),
  },
  {
    icon: 'lucide:coins',
    label: $t('page.dashboard.workbench.assets.points'),
    value: formatCount(userStats.value.points),
  },
  {
    action: hasPackageDetail.value ? 'packageDetail' : undefined,
    icon: 'lucide:badge-check',
    label: roleDisplayName.value,
    value: memberPackage.value
      ? userStats.value.currentPackageName
      : roleDisplayName.value,
  },
]);

const interfacePackages = computed(
  () => userStats.value.interfacePackages ?? [],
);
const interfacePackageTabText = computed(() =>
  $t('page.dashboard.workbench.package.interfaceTab', [
    userStats.value.interfacePackageCount,
  ]),
);

const usePerInterfaceQuota = computed(
  () =>
    userStats.value.interfacePackageCount > 1 &&
    Number(userStats.value.qpsLimit) <= 0 &&
    !userStats.value.qpsLimitUnlimited,
);

const userOutcomeRate = (key: keyof UserWorkbenchStats['outcomes']) =>
  userStats.value.outcomes.available ? String(userStats.value.outcomes[key]) : '—';

const roleQuotaMeta = computed(() => {
  // 有可用套餐时按套餐配置展示：套餐先于用户组免费额度扣减，
  // 分/时/月窗口此刻不参与限流，不能拿角色配额冒充套餐规格。
  if (userStats.value.packageQuotaPreferred) {
    return $t('page.dashboard.workbench.metrics.roleQuotaMetaUnlimited');
  }
  if (!userStats.value.roleQuotaEnabled) return '';
  return $t('page.dashboard.workbench.metrics.roleQuotaMeta', [
    formatCount(userStats.value.roleQuotaMinuteLimit),
    formatCount(userStats.value.roleQuotaHourLimit),
    formatCount(userStats.value.roleQuotaMonthLimit),
  ]);
});

const metricCards = computed(() => [
  {
    accent: '#2563eb',
    footerLabel: $t('page.dashboard.workbench.metrics.remainingCalls'),
    footerValue: usePerInterfaceQuota.value
      ? $t('page.dashboard.workbench.metrics.seeDetails')
      : userStats.value.remainingUnlimited
        ? $t('page.dashboard.workbench.metrics.unlimited')
        : formatCount(userStats.value.remainingCalls),
    icon: 'lucide:activity',
    meta: `${$t('page.dashboard.workbench.metrics.expectedEmptyRate')} ${userOutcomeRate('expectedEmptyRate')}`,
    title: $t('page.dashboard.workbench.metrics.todayCalls'),
    value: formatCount(userStats.value.todayCalls),
  },
  {
    accent: '#16a34a',
    footerLabel: $t('page.dashboard.workbench.metrics.successRate'),
    footerValue: userStats.value.successRate,
    icon: 'lucide:circle-check-big',
    meta: `${$t('page.dashboard.workbench.metrics.serviceFailureRate')} ${userOutcomeRate('serviceFailureRate')}`,
    title: $t('page.dashboard.workbench.metrics.successResolved'),
    value: formatCount(userStats.value.successCalls),
  },
  {
    accent: '#f97316',
    footerLabel: $t('page.dashboard.workbench.metrics.failedRate'),
    footerValue: userStats.value.failedRate,
    icon: 'lucide:circle-x',
    meta: `${$t('page.dashboard.workbench.metrics.clientErrorRate')} ${userOutcomeRate('clientErrorRate')} · ${$t('page.dashboard.workbench.metrics.throttleRate')} ${userOutcomeRate('throttleRate')}`,
    title: $t('page.dashboard.workbench.metrics.failedResolved'),
    value: formatCount(userStats.value.failedCalls),
  },
  {
    accent: '#4f46e5',
    footerLabel: 'QPS',
    footerValue: usePerInterfaceQuota.value
      ? $t('page.dashboard.workbench.metrics.seeDetails')
      : userStats.value.qpsLimitUnlimited
        ? $t('page.dashboard.workbench.metrics.noLimit')
        : formatCount(userStats.value.qpsLimit),
    icon: 'lucide:gauge',
    meta: roleQuotaMeta.value,
    title: $t('page.dashboard.workbench.metrics.dailyLimit'),
    value: usePerInterfaceQuota.value
      ? $t('page.dashboard.workbench.metrics.perInterface')
      : userStats.value.dailyLimitUnlimited
        ? $t('page.dashboard.workbench.metrics.noLimit')
        : formatCount(userStats.value.dailyLimit),
  },
]);

const userQuickActions = computed<UserQuickActionItem[]>(() => [
  {
    accent: '#2563eb',
    badge: userStats.value.hasAnyPackage
      ? $t('page.dashboard.workbench.quickActions.renew')
      : $t('page.dashboard.workbench.quickActions.recommended'),
    description: userStats.value.hasAnyPackage
      ? $t('page.dashboard.workbench.quickActions.packageRenewDesc')
      : $t('page.dashboard.workbench.quickActions.packageStartDesc'),
    icon: 'lucide:shopping-bag',
    title: $t('page.dashboard.workbench.quickActions.buyPackage'),
    url: userStats.value.hasAnyPackage
      ? '/purchase/interface'
      : '/purchase/global',
  },
  {
    accent: '#14b8a6',
    description: $t('page.dashboard.workbench.quickActions.keyDesc'),
    icon: 'lucide:key-round',
    title: $t('page.dashboard.workbench.quickActions.keyManagement'),
    url: '/key',
  },
  {
    accent: '#f97316',
    description: $t('page.dashboard.workbench.quickActions.interfaceDesc'),
    icon: 'lucide:braces',
    title: $t('page.dashboard.workbench.quickActions.interfaceList'),
    url: '/console/interfaces',
  },
  {
    accent: '#7c3aed',
    description: $t('page.dashboard.workbench.quickActions.logDesc'),
    icon: 'lucide:clipboard-list',
    title: $t('page.dashboard.workbench.quickActions.callLogs'),
    url: '/console/call-logs',
  },
]);

const callTrendChartRef = ref<EchartsUIType>();
const { renderEcharts: renderUserCallTrendEcharts } =
  useEcharts(callTrendChartRef);
const adminCallTrendChartRef = ref<EchartsUIType>();
const adminRevenueTrendChartRef = ref<EchartsUIType>();
const { renderEcharts: renderAdminCallTrendEcharts } = useEcharts(
  adminCallTrendChartRef,
);
const { renderEcharts: renderAdminRevenueTrendEcharts } = useEcharts(
  adminRevenueTrendChartRef,
);
const activeCallTrendKey = ref<UserCallTrendKey>('sevenDays');
const callTrendOptions: Array<{
  description: string;
  label: string;
  value: UserCallTrendKey;
}> = [
  {
    description: $t('page.dashboard.workbench.callTrend.byDay'),
    label: $t('page.dashboard.workbench.callTrend.sevenDays'),
    value: 'sevenDays',
  },
  {
    description: $t('page.dashboard.workbench.callTrend.byWeek'),
    label: $t('page.dashboard.workbench.callTrend.thirtyDays'),
    value: 'thirtyDays',
  },
  {
    description: $t('page.dashboard.workbench.callTrend.byMonth'),
    label: $t('page.dashboard.workbench.callTrend.oneYear'),
    value: 'oneYear',
  },
];
const defaultCallTrendOption = callTrendOptions[0] ?? {
  description: $t('page.dashboard.workbench.callTrend.byDay'),
  label: $t('page.dashboard.workbench.callTrend.sevenDays'),
  value: 'sevenDays',
};

const activeCallTrend = computed(
  () =>
    userStats.value.callTrends?.[activeCallTrendKey.value] ??
    emptyUserCallTrend(),
);

const activeCallTrendOption = computed(
  () =>
    callTrendOptions.find((item) => item.value === activeCallTrendKey.value) ??
    defaultCallTrendOption,
);

const callTrendTotalText = computed(() =>
  $t('page.dashboard.workbench.callTrend.totalTimes', [
    formatCount(activeCallTrend.value.total),
  ]),
);

const quickNavItems: QuickNavItem[] = [
  {
    color: '#1677ff',
    icon: 'mdi:view-dashboard-outline',
    title: $t('page.dashboard.workbench.nav.workspace'),
    url: '/console/workspace',
  },
  {
    color: '#14b8a6',
    icon: 'mdi:api',
    title: $t('page.dashboard.workbench.nav.interfaceList'),
    url: '/console/interfaces',
  },
  {
    color: '#f59e0b',
    icon: 'mdi:key-chain',
    title: $t('page.dashboard.workbench.nav.keyManagement'),
    url: '/key',
  },
  {
    color: '#8b5cf6',
    icon: 'mdi:account-cog',
    title: $t('page.dashboard.workbench.nav.userList'),
    url: '/user/list',
  },
  {
    color: '#22c55e',
    icon: 'mdi:account-group',
    title: $t('page.dashboard.workbench.nav.roleManagement'),
    url: '/user/role',
  },
  {
    color: '#64748b',
    icon: 'mdi:menu',
    title: $t('page.dashboard.workbench.nav.menuManagement'),
    url: '/system/menu',
  },
];

function navTo(nav: QuickNavItem) {
  if (nav.url?.startsWith('http')) {
    openWindow(nav.url);
    return;
  }
  if (nav.url?.startsWith('/')) {
    router.push(nav.url).catch(() => undefined);
  }
}

function navToUrl(url?: string) {
  if (!url) {
    return;
  }
  if (url.startsWith('http')) {
    openWindow(url);
    return;
  }
  if (url.startsWith('/')) {
    router.push(url).catch(() => undefined);
  }
}

function formatCount(value: number | string) {
  const numberValue = Number(value ?? 0);
  if (!Number.isFinite(numberValue)) {
    return '0';
  }
  return numberValue.toLocaleString();
}

// 后台金额（收入/计费）按人民币口径汇总，展示时统一换算为站点货币。
function formatMoney(value: number | string) {
  return settlementPriceText(value);
}

/** 人民币基数（余额/赠金/充值档）→ 站点货币展示。 */
function formatSiteMoney(value: number | string | undefined) {
  return settlementPriceText(value);
}

/** 订单实付金额按订单自身币种落库，只加符号、不再换算；配置展示名称时改用名称后缀。 */
function formatPayable(
  value: number | string | undefined,
  currency?: string,
) {
  const amountText = Number(value ?? 0).toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
  const displayName = settlementDisplayName();
  if (displayName) {
    return `${amountText} ${displayName}`;
  }
  const orderCurrency = String(currency ?? '').toUpperCase();
  const symbol =
    orderCurrency === 'USD'
      ? '$'
      : orderCurrency === 'CNY'
        ? '¥'
        : settlementSymbol.value;
  return `${symbol}${amountText}`;
}

function paymentStatusColor(status?: RechargeApi.RechargeStatus) {
  if (status === 'PAID') {
    return 'success';
  }
  if (status === 'FAILED') {
    return 'error';
  }
  if (status === 'CLOSED' || status === 'EXPIRED') {
    return 'default';
  }
  return 'processing';
}

function paymentStatusText(status?: RechargeApi.RechargeStatus) {
  if (status === 'PAID') {
    return $t('page.dashboard.workbench.paymentStatus.paid');
  }
  if (status === 'FAILED') {
    return $t('page.dashboard.workbench.paymentStatus.failed');
  }
  if (status === 'CLOSED') {
    return $t('page.dashboard.workbench.paymentStatus.closed');
  }
  if (status === 'EXPIRED') {
    return $t('page.dashboard.workbench.paymentStatus.expired');
  }
  return $t('page.dashboard.workbench.paymentStatus.pending');
}

function normalizeMoneyNumber(value: number | string | undefined) {
  const numberValue = Number(value ?? 0);
  if (!Number.isFinite(numberValue)) {
    return 0;
  }
  return Math.round(numberValue * 100) / 100;
}

function moneyCentValue(value: number | string | undefined) {
  return Math.round(normalizeMoneyNumber(value) * 100);
}

function isSameMoneyValue(
  left: number | string | undefined,
  right: number | string | undefined,
) {
  return moneyCentValue(left) === moneyCentValue(right);
}

function limitText(value: number | string) {
  return Number(value ?? 0) === 0
    ? $t('page.dashboard.workbench.metrics.noLimit')
    : formatCount(value);
}

function remainingText(remainingUnlimited: boolean, value: number | string) {
  return remainingUnlimited
    ? $t('page.dashboard.workbench.metrics.noLimit')
    : formatCount(value);
}

function expireText(value?: string) {
  return value?.trim() || $t('page.dashboard.workbench.package.longTerm');
}

function renderCallTrendChart() {
  if (!isUserWorkspace.value || !callTrendChartRef.value) {
    return;
  }
  const trend = activeCallTrend.value;
  const values = trend.values.map((value) => Number(value ?? 0));
  renderUserCallTrendEcharts({
    grid: {
      bottom: 8,
      containLabel: true,
      left: 8,
      right: 12,
      top: 24,
    },
    series: [
      {
        areaStyle: {
          color: {
            colorStops: [
              { color: 'rgba(37, 99, 235, 0.2)', offset: 0 },
              { color: 'rgba(37, 99, 235, 0.02)', offset: 1 },
            ],
            type: 'linear',
            x: 0,
            x2: 0,
            y: 0,
            y2: 1,
          },
        },
        data: values,
        itemStyle: {
          color: '#2563eb',
        },
        lineStyle: {
          color: '#2563eb',
          width: 3,
        },
        name: $t('page.dashboard.workbench.chart.callCount'),
        showSymbol: values.length <= 12,
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        type: 'line',
      },
    ],
    tooltip: {
      backgroundColor: 'rgba(15, 23, 42, 0.92)',
      borderWidth: 0,
      textStyle: {
        color: '#fff',
      },
      trigger: 'axis',
    },
    xAxis: {
      axisLabel: {
        color: '#64748b',
      },
      axisLine: {
        lineStyle: {
          color: '#e2e8f0',
        },
      },
      axisTick: {
        show: false,
      },
      boundaryGap: false,
      data: [...trend.labels],
      type: 'category',
    },
    yAxis: {
      axisLabel: {
        color: '#64748b',
      },
      minInterval: 1,
      splitLine: {
        lineStyle: {
          color: '#e2e8f0',
          type: 'dashed',
        },
      },
      splitNumber: 4,
      type: 'value',
    },
  });
}

function renderAdminCallTrendChart() {
  if (isUserWorkspace.value || !adminCallTrendChartRef.value) {
    return;
  }
  const trend = adminStats.value.callTrend7d ?? emptyAdminCallTrend();
  renderAdminCallTrendEcharts({
    grid: {
      bottom: 8,
      containLabel: true,
      left: 8,
      right: 12,
      top: 36,
    },
    legend: {
      icon: 'roundRect',
      itemHeight: 8,
      itemWidth: 14,
      top: 0,
    },
    series: [
      {
        data: trend.totalCalls.map((value) => Number(value ?? 0)),
        itemStyle: { color: '#2563eb' },
        name: $t('page.dashboard.workbench.chart.totalCalls'),
        smooth: true,
        symbolSize: 6,
        type: 'line',
      },
      {
        data: trend.successCalls.map((value) => Number(value ?? 0)),
        itemStyle: { color: '#16a34a' },
        name: $t('page.dashboard.workbench.chart.success'),
        smooth: true,
        symbolSize: 6,
        type: 'line',
      },
      {
        data: trend.failedCalls.map((value) => Number(value ?? 0)),
        itemStyle: { color: '#ef4444' },
        name: $t('page.dashboard.workbench.chart.failed'),
        smooth: true,
        symbolSize: 6,
        type: 'line',
      },
    ],
    tooltip: {
      trigger: 'axis',
    },
    xAxis: {
      axisLabel: { color: '#64748b' },
      axisLine: { lineStyle: { color: '#e2e8f0' } },
      axisTick: { show: false },
      boundaryGap: false,
      data: [...trend.labels],
      type: 'category',
    },
    yAxis: {
      axisLabel: { color: '#64748b' },
      minInterval: 1,
      splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } },
      type: 'value',
    },
  });
}

function renderAdminRevenueTrendChart() {
  if (isUserWorkspace.value || !adminRevenueTrendChartRef.value) {
    return;
  }
  const trend = adminStats.value.revenueTrend7d ?? emptyAdminRevenueTrend();
  renderAdminRevenueTrendEcharts({
    grid: {
      bottom: 8,
      containLabel: true,
      left: 8,
      right: 12,
      top: 36,
    },
    legend: {
      icon: 'roundRect',
      itemHeight: 8,
      itemWidth: 14,
      top: 0,
    },
    series: [
      {
        barMaxWidth: 28,
        data: trend.paidAmounts.map((value) => normalizeMoneyNumber(value)),
        itemStyle: {
          borderRadius: [5, 5, 0, 0],
          color: '#14b8a6',
        },
        name: $t('page.dashboard.workbench.chart.revenue'),
        type: 'bar',
      },
      {
        data: trend.orderCounts.map((value) => Number(value ?? 0)),
        itemStyle: { color: '#f97316' },
        name: $t('page.dashboard.workbench.chart.orders'),
        smooth: true,
        symbolSize: 6,
        type: 'line',
        yAxisIndex: 1,
      },
    ],
    tooltip: {
      trigger: 'axis',
    },
    xAxis: {
      axisLabel: { color: '#64748b' },
      axisLine: { lineStyle: { color: '#e2e8f0' } },
      axisTick: { show: false },
      data: [...trend.labels],
      type: 'category',
    },
    yAxis: [
      {
        axisLabel: {
          color: '#64748b',
          formatter: (value: number | string) => settlementPriceText(value),
        },
        splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } },
        type: 'value',
      },
      {
        axisLabel: { color: '#64748b' },
        minInterval: 1,
        splitLine: { show: false },
        type: 'value',
      },
    ],
  });
}

function setCallTrendKey(value: UserCallTrendKey) {
  activeCallTrendKey.value = value;
}

async function refreshWorkbenchStats() {
  userStats.value = normalizeUserWorkbenchStats(
    await getUserWorkbenchStatsApi(),
    userWorkbenchDefaultLabels,
  );
  await nextTick();
  renderCallTrendChart();
}

async function loadRegisterConfig() {
  try {
    const config = await getRegisterConfigApi();
    emailServiceEnabled.value = !!(
      config.emailServiceEnabled ?? config.emailRegisterEnabled
    );
  } catch {
    emailServiceEnabled.value = false;
  }
}

function todayStorageKey() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function dailyNoticeFingerprint(items: NoticeApi.NoticeItem[]) {
  return items
    .map((item) => `${item.id}:${item.updateTime ?? item.publishTime ?? ''}`)
    .join(',');
}

const dailyNoticeStoragePrefix = 'bugpk-api:daily-popup-notice:';

function dailyNoticeStorageKey() {
  const username =
    userStore.userInfo?.username ?? userStore.userInfo?.realName ?? 'anonymous';
  return `${dailyNoticeStoragePrefix}${username}:${todayStorageKey()}`;
}

// 每天写一个「今日已读」键，从不回收，共用浏览器会一直堆积。加载弹窗前先清掉
// 不是今天的那些，已读判断只依赖当天这一条。
function pruneDailyNoticeStorage() {
  if (typeof window === 'undefined') {
    return;
  }
  const today = `:${todayStorageKey()}`;
  const stale: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (
      key?.startsWith(dailyNoticeStoragePrefix) &&
      !key.endsWith(today)
    ) {
      stale.push(key);
    }
  }
  for (const key of stale) {
    window.localStorage.removeItem(key);
  }
}

function hasReadTodayDailyNotice(items: NoticeApi.NoticeItem[]) {
  if (typeof window === 'undefined') {
    return true;
  }
  return (
    window.localStorage.getItem(dailyNoticeStorageKey()) ===
    dailyNoticeFingerprint(items)
  );
}

function markDailyNoticeRead() {
  if (typeof window === 'undefined' || dailyPopupNotices.value.length === 0) {
    return;
  }
  window.localStorage.setItem(
    dailyNoticeStorageKey(),
    dailyNoticeFingerprint(dailyPopupNotices.value),
  );
}

async function loadDailyPopupNotices() {
  dailyNoticeLoading.value = true;
  try {
    pruneDailyNoticeStorage();
    const result = await getUserPopupNotices();
    dailyPopupNotices.value = result.items;
    dailyPopupTotal.value = result.total;
    activeDailyNoticeId.value = result.items[0]?.id;
    if (result.items.length > 0 && !hasReadTodayDailyNotice(result.items)) {
      dailyNoticeVisible.value = true;
    }
  } catch {
  } finally {
    dailyNoticeLoading.value = false;
  }
}

async function loadWorkspaceNotices() {
  workspaceNoticeLoading.value = true;
  try {
    const result = await getUserNoticeList({
      page: 1,
      pageSize: 3,
    });
    workspaceNotices.value = (result.items ?? []).slice(0, 3);
  } catch {
  } finally {
    workspaceNoticeLoading.value = false;
  }
}

async function openWorkspaceNotice(row: NoticeApi.NoticeItem) {
  workspaceNoticeVisible.value = true;
  workspaceNoticeDetailLoading.value = true;
  currentWorkspaceNotice.value = row;
  try {
    currentWorkspaceNotice.value = await getUserNoticeDetail(row.id);
  } catch {
  } finally {
    workspaceNoticeDetailLoading.value = false;
  }
}

function closeWorkspaceNotice() {
  workspaceNoticeVisible.value = false;
}

function afterWorkspaceNoticeClosed() {
  currentWorkspaceNotice.value = undefined;
}

function closeDailyNotice() {
  markDailyNoticeRead();
  dailyNoticeVisible.value = false;
}

function viewAllNotices(closePopup = false) {
  if (closePopup) {
    closeDailyNotice();
  }
  router.push('/notice').catch(() => undefined);
}

function payProductName(value?: string) {
  if (value === 'PAGE') {
    return $t('page.dashboard.workbench.recharge.productPage');
  }
  if (value === 'WAP') {
    return $t('page.dashboard.workbench.recharge.productWap');
  }
  if (value === 'FACE') {
    return $t('page.dashboard.workbench.recharge.productFace');
  }
  if (value === 'NATIVE') {
    return $t('page.dashboard.workbench.recharge.productNative');
  }
  return '';
}

function rechargeChannelLabel(channel: OnlinePayChannel) {
  if (channel === 'WECHAT') {
    return $t('page.dashboard.workbench.recharge.wechat');
  }
  if (channel === 'HUPIJIAO_ALIPAY') {
    return $t('page.dashboard.workbench.recharge.hupijiaoAlipay');
  }
  if (channel === 'HUPIJIAO_WECHAT') {
    return $t('page.dashboard.workbench.recharge.hupijiaoWechat');
  }
  if (channel === 'TRC20') {
    return $t('page.dashboard.workbench.recharge.trc20');
  }
  if (channel === 'BEP20') {
    return $t('page.dashboard.workbench.recharge.bep20');
  }
  return $t('page.dashboard.workbench.recharge.alipay');
}

function rechargeChannelDescription(channel: OnlinePayChannel) {
  if (channel === 'WECHAT') {
    return $t('page.dashboard.workbench.recharge.wechatDescription');
  }
  if (channel === 'HUPIJIAO_ALIPAY') {
    return $t('page.dashboard.workbench.recharge.hupijiaoAlipayDescription');
  }
  if (channel === 'HUPIJIAO_WECHAT') {
    return $t('page.dashboard.workbench.recharge.hupijiaoWechatDescription');
  }
  if (channel === 'TRC20') {
    return $t('page.dashboard.workbench.recharge.trc20Description');
  }
  if (channel === 'BEP20') {
    return $t('page.dashboard.workbench.recharge.bep20Description');
  }
  return $t('page.dashboard.workbench.recharge.alipayDescription');
}

function isMobileDevice() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(ua);
}

function stopRechargePolling() {
  if (rechargeTimer) {
    window.clearInterval(rechargeTimer);
    rechargeTimer = undefined;
  }
}

function handleRechargeCancel() {
  stopRechargePolling();
  stopRechargeCountdown();
}

/**
 * 点二维码锁层时把视线带到协议勾选行：充值弹窗内容较长，
 * 只弹 toast 用户往往找不到该点哪里。
 */
function focusRechargeAgreement() {
  const element = rechargeConsentRef.value;
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.classList.add('is-nudged');
    window.setTimeout(() => element.classList.remove('is-nudged'), 900);
  }
  message.info($t('paymentAgreement.consentRequired'));
}

function stopRechargeCountdown() {
  if (rechargeCountdownTimer) {
    window.clearInterval(rechargeCountdownTimer);
    rechargeCountdownTimer = undefined;
  }
}

function rechargeRemainingSeconds(item: RechargeApi.RechargeOrder) {
  const seconds = Number(item.remainingSeconds ?? 0);
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds;
  }
  if (!item.expireTime) {
    return 0;
  }
  const deadline = new Date(item.expireTime.replace(' ', 'T')).getTime();
  if (Number.isNaN(deadline)) {
    return 0;
  }
  return Math.max(Math.floor((deadline - Date.now()) / 1000), 0);
}

function startRechargeCountdown(item: RechargeApi.RechargeOrder) {
  stopRechargeCountdown();
  rechargeExpired.value = false;
  rechargeCountdownSeconds.value = rechargeRemainingSeconds(item);
  if (rechargeCountdownSeconds.value <= 0 && item.orderNo) {
    // 本地截止时间已过。是否就此结束由通道决定：链上转账可能在截止之后才被
    // 确认，TRC20 必须继续等待到账，不能在这里判死。
    rechargeExpired.value = true;
    return;
  }
  rechargeCountdownTimer = window.setInterval(() => {
    // 已经到账就把倒计时收掉，不要再回头把订单标成过期。
    if (rechargePaid.value || rechargeOrder.value?.status === 'PAID') {
      stopRechargeCountdown();
      return;
    }
    rechargeCountdownSeconds.value = Math.max(
      rechargeCountdownSeconds.value - 1,
      0,
    );
    if (rechargeCountdownSeconds.value === 0) {
      stopRechargeCountdown();
      rechargeExpired.value = true;
      // 链上充值的到账以链上确认为准，本地倒计时归零只代表「不再提示继续转账」，
      // 不代表这笔钱不会到。停掉轮询会让已转账用户的到账永远不被发现。
      if (!isChainDepositChannel(item.payChannel)) {
        stopRechargePolling();
        if (rechargeOrder.value?.orderNo === item.orderNo) {
          rechargeOrder.value.status = 'EXPIRED';
        }
      }
    }
  }, 1000);
}

async function loadRechargeCapabilities() {
  rechargeCapabilities.value = await getRechargeCapabilities();
  const methods = rechargeOnlineMethods.value;
  rechargePayChannel.value =
    methods.find(
      (method) => method.code === rechargeCapabilities.value?.defaultPayChannel,
    )?.code ??
    methods[0]?.code ??
    'ALIPAY';
  rechargePreferredProduct.value = 'AUTO';
}

function defaultRechargeAmount() {
  return rechargeAmountOptions.value[0]?.amount ?? 50;
}

function selectRechargeAmount(option: RechargeApi.RechargeAmountOption) {
  rechargeAmount.value = normalizeMoneyNumber(option.amount);
}

function isRechargeAmountSelected(option: RechargeApi.RechargeAmountOption) {
  return isSameMoneyValue(option.amount, rechargeAmount.value);
}

async function openBalanceRecharge() {
  rechargeOrder.value = null;
  rechargePendingExisting.value = null;
  rechargeExpired.value = false;
  rechargePaid.value = false;
  // 每次开新充值都重新取得协议同意，不继承上一次的勾选
  rechargeAgreementAccepted.value = false;
  stopRechargePolling();
  stopRechargeCountdown();
  try {
    await loadRechargeCapabilities();
    if (!rechargeCapabilities.value?.enabled) {
      message.warning($t('page.dashboard.workbench.recharge.disabledTip'));
      return;
    }
    rechargeAmount.value = defaultRechargeAmount();
    rechargeVisible.value = true;
  } catch {
    message.warning($t('page.dashboard.workbench.recharge.disabledTip'));
  }
}

function openAlipayPayment(
  order: RechargeApi.RechargeOrder,
  paymentWindow: null | Window,
) {
  if (order.qrCode) {
    paymentWindow?.close();
    return;
  }

  if (rechargeClientType.value === 'MOBILE') {
    paymentWindow?.close();
    if (!submitAlipayForm(order, '_self')) {
      message.error($t('page.dashboard.workbench.recharge.invalidPayloadTip'));
    }
    return;
  }

  if (paymentWindow && order.formParams) {
    const targetName = `alipay_${order.orderNo}`;
    paymentWindow.name = targetName;
    if (!submitAlipayForm(order, targetName)) {
      paymentWindow.close();
      message.error($t('page.dashboard.workbench.recharge.invalidPayloadTip'));
    }
    return;
  }

  if (!submitAlipayForm(order, '_self')) {
    message.error($t('page.dashboard.workbench.recharge.invalidPayloadTip'));
  }
}

function expectedRechargePayProduct(): '' | RechargeApi.PayProduct {
  if (rechargePreferredProduct.value !== 'AUTO') {
    return rechargePreferredProduct.value;
  }
  return rechargeDefaultProduct.value;
}

function shouldPreopenPaymentWindow() {
  return (
    rechargePayChannel.value === 'ALIPAY' &&
    rechargeClientType.value === 'DESKTOP' &&
    expectedRechargePayProduct() !== 'FACE'
  );
}

function startRechargePolling(orderNo: string) {
  stopRechargePolling();
  rechargeTimer = window.setInterval(() => {
    void syncCurrentRechargeOrder(orderNo, false);
  }, 3000);
}

async function syncCurrentRechargeOrder(
  orderNo?: string,
  showPendingMessage = true,
) {
  const currentOrderNo = orderNo ?? rechargeOrder.value?.orderNo;
  if (!currentOrderNo || rechargeSyncLoading.value) {
    return;
  }
  rechargeSyncLoading.value = true;
  try {
    const latestOrder = await syncRechargeOrder(currentOrderNo);
    rechargeOrder.value = {
      ...(rechargeOrder.value ?? latestOrder),
      ...latestOrder,
    };
    if (latestOrder.status === 'PAID') {
      stopRechargePolling();
      stopRechargeCountdown();
      rechargePaid.value = true;
      rechargeExpired.value = false;
      message.success($t('page.dashboard.workbench.recharge.successTip'));
      await refreshWorkbenchStats();
      return;
    }
    if (latestOrder.status === 'CLOSED' || latestOrder.status === 'FAILED') {
      stopRechargePolling();
      stopRechargeCountdown();
      message.warning($t('page.dashboard.workbench.recharge.incompleteTip'));
      return;
    }
    if (latestOrder.status === 'EXPIRED') {
      // 链上充值的过期只是「本地不再提示继续转账」：链上转账常常在截止之后才被
      // 确认，继续轮询才能把迟到的到账认回来。其余通道直接结束。
      rechargeExpired.value = true;
      if (isChainDepositChannel(latestOrder.payChannel)) {
        message.warning($t('page.dashboard.workbench.recharge.expiredTip'));
        return;
      }
      stopRechargePolling();
      stopRechargeCountdown();
      message.warning($t('page.dashboard.workbench.recharge.expiredTip'));
      return;
    }
    if (latestOrder.status === 'CREATED' || latestOrder.status === 'PAYING') {
      startRechargeCountdown(latestOrder);
    }
    if (showPendingMessage) {
      message.info($t('page.dashboard.workbench.recharge.pendingTip'));
    }
  } finally {
    rechargeSyncLoading.value = false;
  }
}

function shouldPreopenForRecharge(order: RechargeApi.RechargeOrder) {
  return (
    order.payChannel === 'ALIPAY' &&
    rechargeClientType.value === 'DESKTOP' &&
    order.payProduct !== 'FACE'
  );
}

async function applyRechargeOrder(
  order: RechargeApi.RechargeOrder,
  paymentWindow: null | Window,
) {
  rechargeOrder.value = order;
  rechargePendingExisting.value = null;
  rechargeExpired.value = false;
  trc20Txid.value = '';
  trc20Submitting.value = false;
  startRechargeCountdown(order);
  const hasAlipayPayload =
    Boolean(order.qrCode) ||
    (order.formParams && Object.keys(order.formParams).length > 0);
  if (order.payChannel === 'ALIPAY' && hasAlipayPayload) {
    openAlipayPayment(order, paymentWindow);
  } else if (order.qrCode && rechargeClientType.value === 'DESKTOP') {
    // 桌面端：扫码支付二维码内嵌在充值弹窗内，不跳转第三方收银台。
    paymentWindow?.close();
  } else if (order.paymentUrl) {
    paymentWindow?.close();
    window.location.assign(order.paymentUrl);
  } else {
    paymentWindow?.close();
  }
  if (order.payProduct === 'FACE' || order.payProduct === 'NATIVE') {
    message.success($t('page.dashboard.workbench.recharge.scanPayTip'));
  } else if (
    order.payProduct === 'WAP' &&
    rechargeClientType.value === 'MOBILE'
  ) {
    message.success($t('page.dashboard.workbench.recharge.redirectTip'));
  } else if (hasAlipayPayload || order.qrCode || order.paymentUrl) {
    message.success($t('page.dashboard.workbench.recharge.openedTip'));
  }
  startRechargePolling(order.orderNo);
}

async function proceedRecharge(forceNew: boolean) {
  const presetId = selectedRechargePresetId.value;
  if (!presetId) {
    message.warning($t('page.dashboard.workbench.recharge.presetRequiredTip'));
    return;
  }
  // 汇率动态变化：建单前刷新一次，保证展示价与后端实付口径一致。
  await refreshSettlementCurrency();
  let paymentWindow: null | Window = null;
  if (shouldPreopenPaymentWindow()) {
    paymentWindow = preopenDetachedWindow();
  }
  try {
    const order = await createRechargeOrder({
      clientType: rechargeClientType.value,
      forceNew,
      payChannel: rechargePayChannel.value,
      preferredProduct: rechargePreferredProduct.value,
      presetId,
    });
    await applyRechargeOrder(order, paymentWindow);
  } catch (error) {
    paymentWindow?.close();
    throw error;
  }
}

async function submitRecharge() {
  if (!rechargeCapabilities.value?.enabled) {
    message.warning($t('page.dashboard.workbench.recharge.disabledTip'));
    return;
  }
  const amount = Number(rechargeAmount.value);
  if (!Number.isFinite(amount) || amount < 0.01) {
    message.warning($t('page.dashboard.workbench.recharge.invalidAmountTip'));
    return;
  }
  const presetId = selectedRechargePresetId.value;
  if (!presetId) {
    message.warning($t('page.dashboard.workbench.recharge.presetRequiredTip'));
    return;
  }
  rechargeLoading.value = true;
  try {
    const existing = await findPendingPaymentOrder({
      orderType: 'RECHARGE',
      targetId: presetId,
    });
    if (existing) {
      rechargePendingExisting.value =
        existing as unknown as RechargeApi.RechargeOrder;
      return;
    }
    await proceedRecharge(false);
  } catch {
    // 错误提示由请求层统一展示
  } finally {
    rechargeLoading.value = false;
  }
}

async function copyTrc20Value(value: string) {
  if (!value) {
    return;
  }
  try {
    await copyText(value);
    message.success($t('page.dashboard.workbench.recharge.copySuccess'));
  } catch {
    message.error($t('page.dashboard.workbench.recharge.copyFailed'));
  }
}

async function submitTrc20Payment() {
  const order = rechargeOrder.value;
  if (!order) {
    return;
  }
  const txid = trc20Txid.value.trim();
  if (!/^(?:0x)?[0-9a-fA-F]{64}$/.test(txid)) {
    message.warning($t('page.dashboard.workbench.recharge.trc20TxidInvalid'));
    return;
  }
  trc20Submitting.value = true;
  try {
    const latest = await submitTrc20TxID(order.orderNo, txid);
    rechargeOrder.value = latest;
    if (latest.status === 'PAID') {
      stopRechargePolling();
      stopRechargeCountdown();
      rechargePaid.value = true;
      rechargeExpired.value = false;
      message.success($t('page.dashboard.workbench.recharge.successTip'));
      await refreshWorkbenchStats();
    } else {
      message.info($t('page.dashboard.workbench.recharge.trc20Pending'));
    }
  } finally {
    trc20Submitting.value = false;
  }
}

async function continueRechargeExisting() {
  const existing = rechargePendingExisting.value;
  if (!existing) {
    return;
  }
  rechargeLoading.value = true;
  try {
    const order =
      (await continuePaymentOrder(
        existing.orderNo,
      )) as unknown as RechargeApi.RechargeOrder;
    const paymentWindow = shouldPreopenForRecharge(order)
      ? preopenDetachedWindow()
      : null;
    await applyRechargeOrder(order, paymentWindow);
  } catch {
    rechargePendingExisting.value = null;
  } finally {
    rechargeLoading.value = false;
  }
}

async function createNewRecharge() {
  rechargePendingExisting.value = null;
  rechargeLoading.value = true;
  try {
    await proceedRecharge(true);
  } catch {
    // 错误提示由请求层统一展示
  } finally {
    rechargeLoading.value = false;
  }
}

function openPackageDetail() {
  if (!hasPackageDetail.value) {
    return;
  }
  packageDetailTab.value = memberPackage.value ? 'global' : 'interface';
  packageDetailDrawerApi.open();
}

function handleAssetAction(action?: HeaderAssetAction) {
  if (action === 'balanceRecharge') {
    openBalanceRecharge();
    return;
  }
  if (action === 'packageDetail') {
    openPackageDetail();
  }
}

onMounted(async () => {
  await nextTick();
  if (!isUserWorkspace.value) {
    // 只触发 1 次聚合刷新（协调器单飞：内部 refreshAllSections → 1 次 HTTP）
    // 兜底 catch：refreshAllSections 在全部 section 失败时会 throw，此处吞掉避免未捕获拒绝
    void refreshCoordinator.refresh().catch(() => {});
    await loadDailyPopupNotices();
    return;
  }
  renderCallTrendChart();
  if (String(route.query.recharge ?? '') === '1') {
    void openBalanceRecharge();
    const query = { ...route.query };
    delete query.recharge;
    void router.replace({ query });
  }
  await loadRegisterConfig();
  try {
    await refreshWorkbenchStats();
  } catch {}
  await loadWorkspaceNotices();
  await loadDailyPopupNotices();
});

onBeforeUnmount(() => {
  stopRechargePolling(); // 保留（充值轮询）
  refreshAbort.abort(); // 取消在途工作台请求（axios.cancel → promise reject）
  refreshCoordinator.reset(); // 协调器 dispose：解除进行中状态，防止卸载后回写
});

watch(
  [activeCallTrendKey, activeCallTrend],
  async () => {
    await nextTick();
    renderCallTrendChart();
  },
  { deep: true },
);
</script>

<template>
  <div class="p-5">
    <AdvertisementSlot
      class="mb-4"
      :limit="3"
      placement="CONSOLE"
      variant="panel"
    />

    <div
      v-if="shouldShowBindEmailWarning"
      class="bind-email-warning mb-4"
      role="alert"
    >
      <div class="bind-email-warning__body">
        <span class="bind-email-warning__icon">
          <IconifyIcon icon="lucide:circle-alert" />
        </span>
        <div class="min-w-0">
          <div class="bind-email-warning__title">
            {{ $t('page.dashboard.workbench.bindEmail.title') }}
          </div>
          <div class="bind-email-warning__desc">
            {{ $t('page.dashboard.workbench.bindEmail.description') }}
          </div>
        </div>
      </div>
      <Button danger size="small" type="primary" @click="navToUrl('/profile')">
        {{ $t('page.dashboard.workbench.bindEmail.action') }}
      </Button>
    </div>

    <WorkbenchHeader v-if="isUserWorkspace" :avatar="userAvatar">
      <template #title>
        {{
          $t(welcomeTitleKey, [
            userStore.userInfo?.realName || userStore.userInfo?.username || '',
          ])
        }}
      </template>
      <template #description>
        {{ welcomeDescription }}
      </template>
      <template #actions>
        <div class="user-asset-summary">
          <div
            v-for="item in headerAssets"
            :key="item.label"
            class="user-asset-item"
          >
            <div class="user-asset-icon">
              <IconifyIcon :icon="item.icon" />
            </div>
            <div class="user-asset-content min-w-0 text-right">
              <div class="user-asset-label">{{ item.label }}</div>
              <div class="user-asset-value">{{ item.value }}</div>
              <div v-if="item.action" class="user-asset-actions">
                <button
                  class="user-asset-detail-btn"
                  :class="{
                    'is-recharge': item.action === 'balanceRecharge',
                  }"
                  type="button"
                  @click="handleAssetAction(item.action)"
                >
                  <IconifyIcon
                    :icon="
                      item.action === 'balanceRecharge'
                        ? 'lucide:plus'
                        : 'lucide:panel-right-open'
                    "
                  />
                  <span>{{
                    item.action === 'balanceRecharge'
                      ? $t('page.dashboard.workbench.actions.recharge')
                      : $t('page.dashboard.workbench.actions.viewDetails')
                  }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </WorkbenchHeader>

    <template v-if="isUserWorkspace">
      <div class="user-quick-actions mt-4">
        <button
          v-for="item in userQuickActions"
          :key="item.title"
          class="user-quick-action"
          :style="{ '--user-action-accent': item.accent }"
          type="button"
          @click="navToUrl(item.url)"
        >
          <span class="user-quick-action__icon">
            <IconifyIcon :icon="item.icon" />
          </span>
          <span class="user-quick-action__content">
            <span class="user-quick-action__title">
              {{ item.title }}
              <Tag
                v-if="item.badge"
                class="user-quick-action__badge"
                color="blue"
              >
                {{ item.badge }}
              </Tag>
            </span>
            <span class="user-quick-action__desc">{{ item.description }}</span>
          </span>
          <IconifyIcon
            class="user-quick-action__arrow"
            icon="lucide:arrow-right"
          />
        </button>
      </div>

      <div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div
          v-for="item in metricCards"
          :key="item.title"
          class="user-metric-card"
          :style="{ '--user-metric-accent': item.accent }"
        >
          <div class="flex items-start justify-between">
            <div>
              <div
                class="text-base font-medium text-gray-700 dark:text-gray-200"
              >
                {{ item.title }}
              </div>
              <div
                class="mt-7 text-4xl font-semibold leading-none text-gray-950 dark:text-gray-50"
              >
                {{ item.value }}
              </div>
            </div>
            <div class="user-metric-icon" :style="{ color: item.accent }">
              <IconifyIcon :icon="item.icon" />
            </div>
          </div>
          <div class="user-metric-footer">
            <span>{{ item.footerLabel }}</span>
            <span class="font-medium text-gray-900 dark:text-gray-100">
              {{ item.footerValue }}
            </span>
          </div>
          <div
            v-if="item.meta"
            class="mt-2 text-xs text-gray-500 dark:text-gray-400"
          >
            {{ item.meta }}
          </div>
        </div>
      </div>

      <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <section class="user-call-trend-card sm:col-span-2 xl:col-span-2">
          <div class="user-call-trend-head">
            <div>
              <div class="user-call-trend-title">
                {{ $t('page.dashboard.workbench.callTrend.title') }}
              </div>
              <div class="user-call-trend-desc">
                {{
                  $t('page.dashboard.workbench.callTrend.summary', [
                    activeCallTrendOption.description,
                    callTrendTotalText,
                  ])
                }}
              </div>
            </div>
            <div
              class="user-call-trend-tabs"
              :aria-label="$t('page.dashboard.workbench.callTrend.aria')"
            >
              <button
                v-for="item in callTrendOptions"
                :key="item.value"
                class="user-call-trend-tab"
                :class="{ 'is-active': activeCallTrendKey === item.value }"
                type="button"
                @click="setCallTrendKey(item.value)"
              >
                {{ item.label }}
              </button>
            </div>
          </div>
          <div class="user-call-trend-chart">
            <EchartsUI ref="callTrendChartRef" />
          </div>
        </section>

        <section class="user-notice-card sm:col-span-2 xl:col-span-2">
          <div class="user-notice-card__head">
            <div>
              <div class="user-notice-card__title">
                {{ $t('page.dashboard.workbench.notice.title') }}
              </div>
              <div class="user-notice-card__desc">
                {{ $t('page.dashboard.workbench.notice.description') }}
              </div>
            </div>
            <button
              class="user-notice-card__more"
              type="button"
              @click="viewAllNotices()"
            >
              {{ $t('page.dashboard.workbench.actions.all') }}
            </button>
          </div>

          <Spin :spinning="workspaceNoticeLoading">
            <div v-if="workspaceNotices.length > 0" class="user-notice-list">
              <button
                v-for="item in workspaceNotices"
                :key="item.id"
                class="user-notice-item"
                type="button"
                @click="openWorkspaceNotice(item)"
              >
                <div class="user-notice-item__main">
                  <div class="user-notice-item__title-row">
                    <Tag v-if="item.isTop === 1" color="blue">
                      {{ $t('page.dashboard.workbench.notice.top') }}
                    </Tag>
                    <span class="user-notice-item__title">{{
                      item.title
                    }}</span>
                  </div>
                  <div class="user-notice-item__summary">
                    {{
                      item.summary ||
                      $t('page.dashboard.workbench.notice.emptySummary')
                    }}
                  </div>
                  <div class="user-notice-item__time">
                    {{
                      item.publishTime ||
                      item.createTime ||
                      $t('page.dashboard.workbench.notice.unpublished')
                    }}
                  </div>
                </div>
                <IconifyIcon
                  class="user-notice-item__arrow"
                  icon="lucide:chevron-right"
                />
              </button>
            </div>
            <div v-else class="user-notice-empty">
              <IconifyIcon icon="lucide:megaphone" />
              <span>{{ $t('page.dashboard.workbench.notice.empty') }}</span>
            </div>
          </Spin>
        </section>
      </div>
    </template>

    <div v-else class="admin-workbench">
      <section class="admin-overview-section">
        <div class="admin-overview-head">
          <div class="admin-overview-identity">
            <span class="admin-eyebrow">
              <IconifyIcon icon="lucide:radio-tower" />
              OPERATIONS CONTROL
            </span>
            <div class="admin-overview-title-row">
              <h2>{{ $t('page.dashboard.workbench.admin.module.overview') }}</h2>
              <span class="admin-health-pill" :data-state="adminHealthState">
                <span class="admin-health-pill__dot"></span>
                {{ adminHealthLabel }}
              </span>
            </div>
            <p>
              {{
                $t('page.dashboard.workbench.admin.module.overviewDescription')
              }}
            </p>
          </div>
          <div class="admin-overview-actions">
            <span class="admin-alert-total">
              {{
                adminSectionAvailable.alerts
                  ? $t('page.dashboard.workbench.admin.alerts.count', [
                      adminAlertTotal,
                    ])
                  : '—'
              }}
            </span>
            <AdminRefreshControl
              :error-message="adminOverviewStatusMessage"
              :interval-seconds="adminAutoRefreshSeconds"
              :last-success-at="lastOverviewSuccessAt"
              :refreshing="refreshCoordinator.state.refreshing"
              @refresh="refreshAdminSection('overview')"
              @update:interval-seconds="handleAdminRefreshIntervalChange"
            />
          </div>
        </div>
        <div v-if="adminWorkbenchError" class="admin-module-error" role="alert">
          {{ adminWorkbenchError }}
        </div>
        <div v-else-if="adminSectionErrors.overview" class="admin-module-error" role="alert" data-testid="admin-overview-status">
          {{ adminSectionErrors.overview }}
        </div>
        <div
          v-else-if="adminSectionDegraded.overview"
          class="admin-module-error"
          data-state="degraded"
          data-testid="admin-overview-status"
          role="status"
        >
          {{ $t('page.dashboard.workbench.admin.module.overviewPartial') }}
        </div>
        <Spin :spinning="adminSectionLoading.overview">
          <div class="admin-metric-grid">
            <article
              v-for="(item, index) in adminMetricCards"
              :key="item.title"
              class="admin-metric-card"
              :data-rank="index < 3 ? 'primary' : 'secondary'"
              :data-tone="item.tone"
            >
              <div class="admin-metric-card__top">
                <div class="admin-metric-card__icon">
                  <IconifyIcon :icon="item.icon" />
                </div>
                <div class="admin-metric-card__title">{{ item.title }}</div>
              </div>
              <div class="admin-metric-card__value">{{ item.value }}</div>
              <div class="admin-metric-card__meta">{{ item.meta }}</div>
              <div
                v-if="item.metaDetail"
                class="admin-metric-card__meta admin-metric-card__meta--detail"
              >
                {{ item.metaDetail }}
              </div>
            </article>
          </div>
        </Spin>
      </section>

      <div class="admin-command-grid">
        <section
          class="admin-panel admin-panel--alerts"
          :aria-busy="adminSectionLoading.alerts"
        >
          <div class="admin-panel__head admin-panel__head--primary">
            <div class="admin-panel__title-group">
              <span class="admin-section-index">01</span>
              <div>
                <h2>{{ $t('page.dashboard.workbench.admin.alerts.title') }}</h2>
                <p>
                  {{ $t('page.dashboard.workbench.admin.alerts.description') }}
                </p>
              </div>
            </div>
            <div class="admin-panel__actions">
              <div
                v-if="adminAlertSeverityChips.length > 0"
                class="admin-alert-summary"
              >
                <span
                  v-for="chip in adminAlertSeverityChips"
                  :key="chip.level"
                  class="admin-alert-summary__chip"
                  :data-level="chip.level"
                >
                  <i></i>{{ chip.count }} {{ chip.label }}
                </span>
              </div>
              <Button
                :aria-label="$t('page.dashboard.workbench.admin.module.refresh')"
                :loading="adminSectionLoading.alerts"
                size="small"
                :title="$t('page.dashboard.workbench.admin.module.refresh')"
                @click="refreshAdminSection('alerts')"
              >
                <RotateCw class="size-4" />
              </Button>
            </div>
          </div>
          <div
            v-if="adminSectionErrors.alerts"
            class="admin-module-error"
            role="alert"
          >
            {{ adminSectionErrors.alerts }}
          </div>
          <div v-if="adminAlerts.length > 0" class="admin-alert-list">
            <button
              v-for="(item, index) in adminAlerts"
              :key="item.title"
              class="admin-alert"
              :data-level="item.level"
              :style="{ '--alert-index': index }"
              type="button"
              @click="navToUrl(item.url)"
            >
              <span class="admin-alert__icon" :data-level="item.level">
                <IconifyIcon :icon="adminAlertLevel(item.level).icon" />
              </span>
              <span class="admin-alert__body">
                <span class="admin-alert__meta">
                  <span class="admin-alert__level">
                    {{ $t(adminAlertLevel(item.level).labelKey) }}
                  </span>
                  <span class="admin-alert__meta-divider"></span>
                  <span>
                    {{
                      adminAlertScope(item) ||
                      $t('page.dashboard.workbench.admin.alerts.title')
                    }}
                  </span>
                </span>
                <strong>{{ item.title }}</strong>
                <small>{{ item.content }}</small>
              </span>
              <span class="admin-alert__cta">
                {{ $t('page.dashboard.workbench.admin.alerts.handle') }}
                <IconifyIcon icon="lucide:arrow-up-right" />
              </span>
            </button>
          </div>
          <div
            v-else-if="!adminSectionAvailable.alerts"
            class="admin-alert-empty"
          >
            <span class="admin-alert-empty__icon is-pending">
              <IconifyIcon icon="lucide:loader-circle" />
            </span>
            <strong>
              {{
                $t('page.dashboard.workbench.admin.alerts.emptyPendingTitle')
              }}
            </strong>
            <p>
              {{
                $t(
                  'page.dashboard.workbench.admin.alerts.emptyPendingDescription',
                )
              }}
            </p>
          </div>
          <div v-else class="admin-alert-empty">
            <span class="admin-alert-empty__icon">
              <IconifyIcon icon="lucide:shield-check" />
            </span>
            <strong>
              {{ $t('page.dashboard.workbench.admin.alerts.emptyTitle') }}
            </strong>
            <p>
              {{ $t('page.dashboard.workbench.admin.alerts.emptyDescription') }}
            </p>
          </div>
        </section>

        <aside
          class="admin-panel admin-panel--health"
          :aria-busy="adminSectionLoading.overview"
        >
          <div class="admin-panel__head admin-panel__head--compact">
            <div class="admin-panel__title-group">
              <span class="admin-section-index">02</span>
              <div>
                <h2>
                  {{ $t('page.dashboard.workbench.admin.alerts.health.title') }}
                </h2>
                <p>
                  {{
                    $t(
                      'page.dashboard.workbench.admin.alerts.health.description',
                    )
                  }}
                </p>
              </div>
            </div>
          </div>
          <div class="admin-health-figure">
            <span class="admin-health-figure__label">
              {{ $t('page.dashboard.workbench.metrics.serviceFailureRate') }}
            </span>
            <strong :data-state="adminHealthState">
              {{ adminOutcomeRate('serviceFailureRate') }}
            </strong>
            <span class="admin-health-figure__slo">
              {{ $t('page.dashboard.workbench.admin.alerts.health.slo') }}
            </span>
          </div>
          <div
            v-if="adminOutcomeSegments.length > 0"
            class="admin-health-composition"
          >
            <div
              class="admin-health-bar"
              role="img"
              :aria-label="adminOutcomeAria"
            >
              <span
                v-for="segment in adminOutcomeSegments"
                :key="segment.key"
                :style="{
                  background: segment.color,
                  width: `${segment.percent}%`,
                }"
              ></span>
            </div>
            <div class="admin-health-legend">
              <div v-for="segment in adminOutcomeSegments" :key="segment.key">
                <span
                  class="admin-health-legend__dot"
                  :style="{ background: segment.color }"
                ></span>
                <span class="admin-health-legend__label">
                  {{ segment.label }}
                </span>
                <strong>{{ formatCount(segment.count) }}</strong>
              </div>
            </div>
          </div>
          <div v-else class="admin-health-empty">
            {{ $t('billingPolicy.statsUnavailable') }}
          </div>
          <div class="admin-health-worst">
            <span class="admin-health-worst__label">
              {{ $t('page.dashboard.workbench.admin.alerts.health.worstApi') }}
            </span>
            <button
              v-if="adminWorstApi"
              class="admin-health-worst__item"
              type="button"
              @click="navToUrl('/console/call-logs')"
            >
              <span class="min-w-0">
                <strong>{{
                  adminWorstApi.name || adminWorstApi.apiCode
                }}</strong>
                <small>
                  {{ adminWorstApi.successRate }} ·
                  {{ formatCount(adminWorstApi.failedCalls) }}
                  {{ $t('page.dashboard.workbench.chart.failed') }}
                </small>
              </span>
              <IconifyIcon icon="lucide:arrow-up-right" />
            </button>
            <span v-else class="admin-health-worst__empty">
              {{ $t('page.dashboard.workbench.admin.alerts.health.noWorst') }}
            </span>
          </div>
        </aside>
      </div>

      <div class="admin-grid admin-trend-grid">
        <section
          class="admin-panel admin-panel--wide admin-panel--trend"
          :aria-busy="adminSectionLoading.callTrend7d"
        >
          <div class="admin-panel__head">
            <div class="admin-panel__title-group">
              <span class="admin-section-index">03</span>
              <div>
                <h2>
                  {{ $t('page.dashboard.workbench.admin.callTrend.title') }}
                </h2>
                <p>
                  {{
                    $t('page.dashboard.workbench.admin.callTrend.description')
                  }}
                </p>
              </div>
            </div>
            <div class="admin-panel__actions">
              <Tag color="blue">
                {{
                  $t('page.dashboard.workbench.callTrend.totalTimes', [
                    adminSectionAvailable.callTrend7d
                      ? formatCount(adminStats.callTrend7d.total)
                      : '—',
                  ])
                }}
              </Tag>
              <Button
                :aria-label="
                  $t('page.dashboard.workbench.admin.module.refresh')
                "
                :loading="adminSectionLoading.callTrend7d"
                size="small"
                :title="$t('page.dashboard.workbench.admin.module.refresh')"
                @click="refreshAdminSection('callTrend7d')"
              >
                <RotateCw class="size-4" />
              </Button>
            </div>
          </div>
          <div
            v-if="
              adminSectionErrors.callTrend7d || adminSectionDegraded.callTrend7d
            "
            class="admin-module-error"
            :data-state="
              adminSectionErrors.callTrend7d ? 'error' : 'degraded'
            "
            role="alert"
          >
            {{
              adminSectionErrors.callTrend7d ||
              $t('billingPolicy.statsUnavailable')
            }}
          </div>
          <EchartsUI ref="adminCallTrendChartRef" class="admin-chart" />
        </section>

        <section
          class="admin-panel"
          :aria-busy="adminSectionLoading.revenueTrend7d"
        >
          <div class="admin-panel__head">
            <div class="admin-panel__title-group">
              <span class="admin-section-index">04</span>
              <div>
                <h2>
                  {{ $t('page.dashboard.workbench.admin.revenueTrend.title') }}
                </h2>
                <p>
                  {{
                    $t(
                      'page.dashboard.workbench.admin.revenueTrend.description',
                    )
                  }}
                </p>
              </div>
            </div>
            <div class="admin-panel__actions">
              <Tag color="green">
                {{
                  adminSectionAvailable.revenueTrend7d
                    ? formatMoney(adminStats.revenueTrend7d.totalAmount)
                    : '—'
                }}
              </Tag>
              <Button
                :aria-label="
                  $t('page.dashboard.workbench.admin.module.refresh')
                "
                :loading="adminSectionLoading.revenueTrend7d"
                size="small"
                :title="$t('page.dashboard.workbench.admin.module.refresh')"
                @click="refreshAdminSection('revenueTrend7d')"
              >
                <RotateCw class="size-4" />
              </Button>
            </div>
          </div>
          <div
            v-if="
              adminSectionErrors.revenueTrend7d ||
              adminSectionDegraded.revenueTrend7d
            "
            class="admin-module-error"
            :data-state="
              adminSectionErrors.revenueTrend7d ? 'error' : 'degraded'
            "
            role="alert"
          >
            {{
              adminSectionErrors.revenueTrend7d ||
              $t('billingPolicy.statsUnavailable')
            }}
          </div>
          <EchartsUI ref="adminRevenueTrendChartRef" class="admin-chart" />
        </section>
      </div>

      <div class="admin-grid admin-support-grid">
        <section
          class="admin-panel admin-panel--wide"
          :aria-busy="adminSectionLoading.hotApis"
        >
          <div class="admin-panel__head">
            <div class="admin-panel__title-group">
              <span class="admin-section-index">05</span>
              <div>
                <h2>
                  {{ $t('page.dashboard.workbench.admin.hotApis.title') }}
                </h2>
                <p>
                  {{ $t('page.dashboard.workbench.admin.hotApis.description') }}
                </p>
              </div>
            </div>
            <div class="admin-panel__actions">
              <Button size="small" @click="navToUrl('/console/call-logs')">
                {{ $t('page.dashboard.workbench.admin.hotApis.viewLogs') }}
              </Button>
              <Button
                :aria-label="
                  $t('page.dashboard.workbench.admin.module.refresh')
                "
                :loading="adminSectionLoading.hotApis"
                size="small"
                :title="$t('page.dashboard.workbench.admin.module.refresh')"
                @click="refreshAdminSection('hotApis')"
              >
                <RotateCw class="size-4" />
              </Button>
            </div>
          </div>
          <div
            v-if="adminSectionErrors.hotApis"
            class="admin-module-error"
            role="alert"
          >
            {{ adminSectionErrors.hotApis }}
          </div>
          <div class="admin-table">
            <div class="admin-table__row admin-table__row--head">
              <span>{{
                $t('page.dashboard.workbench.admin.hotApis.interface')
              }}</span>
              <span>{{
                $t('page.dashboard.workbench.admin.hotApis.calls')
              }}</span>
              <span>{{
                $t('page.dashboard.workbench.admin.hotApis.successRate')
              }}</span>
              <span>{{
                $t('page.dashboard.workbench.admin.hotApis.charge')
              }}</span>
              <span>{{
                $t('page.dashboard.workbench.admin.hotApis.elapsed')
              }}</span>
            </div>
            <button
              v-for="item in adminHotApis"
              :key="item.id"
              class="admin-table__row admin-table__row--clickable"
              type="button"
              @click="navToUrl('/console/interfaces')"
            >
              <span class="admin-table__main">
                <strong>{{ item.name }}</strong>
                <small>{{ item.apiCode }}</small>
              </span>
              <span>{{ formatCount(item.todayCalls) }}</span>
              <span>{{ item.successRate }}</span>
              <span>{{ formatMoney(item.chargeAmount) }}</span>
              <span>{{ formatCount(item.avgElapsedMs) }}ms</span>
            </button>
            <div v-if="adminHotApis.length === 0" class="admin-empty">
              {{ $t('page.dashboard.workbench.admin.hotApis.empty') }}
            </div>
          </div>
        </section>

        <section class="admin-panel" :aria-busy="adminSectionLoading.activeUsers">
          <div class="admin-panel__head">
            <div class="admin-panel__title-group">
              <span class="admin-section-index">06</span>
              <div>
                <h2>
                  {{ $t('page.dashboard.workbench.admin.activeUsers.title') }}
                </h2>
                <p>
                  {{
                    $t('page.dashboard.workbench.admin.activeUsers.description')
                  }}
                </p>
              </div>
            </div>
            <div class="admin-panel__actions">
              <Button size="small" @click="navToUrl('/user/list')">
                {{ $t('page.dashboard.workbench.nav.userList') }}
              </Button>
              <Button
                :aria-label="
                  $t('page.dashboard.workbench.admin.module.refresh')
                "
                :loading="adminSectionLoading.activeUsers"
                size="small"
                :title="$t('page.dashboard.workbench.admin.module.refresh')"
                @click="refreshAdminSection('activeUsers')"
              >
                <RotateCw class="size-4" />
              </Button>
            </div>
          </div>
          <div
            v-if="adminSectionErrors.activeUsers"
            class="admin-module-error"
            role="alert"
          >
            {{ adminSectionErrors.activeUsers }}
          </div>
          <div class="admin-user-list">
            <button
              v-for="item in adminActiveUsers"
              :key="item.id"
              class="admin-user"
              type="button"
              @click="navToUrl('/console/call-logs')"
            >
              <span class="admin-user__avatar">
                {{ (item.realName || item.username || 'U').slice(0, 1) }}
              </span>
              <span class="admin-user__main">
                <strong>{{ item.realName || item.username }}</strong>
                <small>
                  {{
                    $t('page.dashboard.workbench.admin.activeUsers.summary', [
                      item.username,
                      item.successRate,
                    ])
                  }}
                </small>
              </span>
              <span class="admin-user__stat">
                {{ formatCount(item.todayCalls) }}
              </span>
            </button>
            <div v-if="adminActiveUsers.length === 0" class="admin-empty">
              {{ $t('page.dashboard.workbench.admin.activeUsers.empty') }}
            </div>
          </div>
        </section>
      </div>

      <section class="admin-panel admin-quick-panel">
        <div class="admin-panel__head admin-panel__head--compact">
          <div class="admin-panel__title-group">
            <span class="admin-section-index">07</span>
            <div>
              <h2>{{ $t('page.dashboard.workbench.admin.quick.title') }}</h2>
              <p>
                {{ $t('page.dashboard.workbench.admin.quick.description') }}
              </p>
            </div>
          </div>
        </div>
        <div class="admin-quick-grid admin-quick-grid--compact">
          <button
            v-for="item in quickNavItems"
            :key="item.title"
            class="admin-quick"
            type="button"
            @click="navTo(item)"
          >
            <span class="admin-quick__icon" :style="{ color: item.color }">
              <IconifyIcon :icon="item.icon" />
            </span>
            <span>{{ item.title }}</span>
            <IconifyIcon class="admin-quick__arrow" icon="lucide:arrow-up-right" />
          </button>
        </div>
      </section>

      <section class="admin-access-atlas-panel">
        <AdminAccessAtlas
          :available="adminSectionAvailable.access"
          :locations="adminStats.accessLocations"
          :loading="adminSectionLoading.access"
          :range="adminAccessRange"
          :summary="adminStats.accessSummary"
          @range-change="setAdminAccessRange"
          @refresh="refreshAdminSection('access')"
        />
        <div
          v-if="adminSectionErrors.access"
          class="admin-module-error"
          role="alert"
        >
          {{ adminSectionErrors.access }}
        </div>
      </section>
    </div>

    <PackageDetailDrawer
      class="w-[640px]"
      content-class="package-detail-drawer-content"
      :title="$t('page.dashboard.workbench.package.title')"
    >
      <div class="package-detail-drawer">
        <Tabs v-model:active-key="packageDetailTab" class="package-detail-tabs">
          <TabPane
            key="global"
            :tab="$t('page.dashboard.workbench.package.global')"
          >
            <section class="package-detail-section">
              <div class="package-detail-section__head">
                <div>
                  <h2>{{ $t('page.dashboard.workbench.package.global') }}</h2>
                  <p>{{ $t('page.dashboard.workbench.package.globalDesc') }}</p>
                </div>
                <span v-if="memberPackage">
                  {{ $t('page.dashboard.workbench.package.active') }}
                </span>
              </div>

              <article v-if="memberPackage" class="package-detail-card">
                <div class="package-detail-card__top">
                  <div class="package-detail-card__icon">
                    <IconifyIcon icon="lucide:badge-check" />
                  </div>
                  <div class="min-w-0">
                    <div class="package-detail-card__name">
                      {{ memberPackage.packageName }}
                    </div>
                    <div class="package-detail-card__desc">
                      {{
                        $t('page.dashboard.workbench.package.expireAt', [
                          expireText(memberPackage.expireTime),
                        ])
                      }}
                    </div>
                  </div>
                </div>

                <div class="package-detail-stats">
                  <div>
                    <span>{{
                      $t('page.dashboard.workbench.package.dailyLimit')
                    }}</span>
                    <strong>{{ limitText(memberPackage.dailyLimit) }}</strong>
                  </div>
                  <div>
                    <span>{{
                      $t('page.dashboard.workbench.package.todayUsed')
                    }}</span>
                    <strong>{{ formatCount(memberPackage.todayCalls) }}</strong>
                  </div>
                  <div>
                    <span>{{
                      $t('page.dashboard.workbench.package.remainingCalls')
                    }}</span>
                    <strong>
                      {{
                        remainingText(
                          memberPackage.remainingUnlimited,
                          memberPackage.remainingCalls,
                        )
                      }}
                    </strong>
                  </div>
                  <div>
                    <span>QPS</span>
                    <strong>{{ limitText(memberPackage.qpsLimit) }}</strong>
                  </div>
                </div>
              </article>
              <div v-else class="package-detail-empty">
                {{ $t('page.dashboard.workbench.package.emptyGlobal') }}
              </div>
            </section>
          </TabPane>

          <TabPane key="interface" :tab="interfacePackageTabText">
            <section class="package-detail-section">
              <div class="package-detail-section__head">
                <div>
                  <h2>
                    {{ $t('page.dashboard.workbench.package.interface') }}
                  </h2>
                  <p>
                    {{ $t('page.dashboard.workbench.package.interfaceDesc') }}
                  </p>
                </div>
                <span v-if="interfacePackages.length > 0">
                  {{
                    $t('page.dashboard.workbench.package.openedCount', [
                      userStats.interfacePackageCount,
                    ])
                  }}
                </span>
              </div>

              <div
                v-if="interfacePackages.length > 0"
                class="package-detail-list"
              >
                <article
                  v-for="item in interfacePackages"
                  :key="item.userPackageId"
                  class="package-detail-card"
                >
                  <div class="package-detail-card__top">
                    <div class="package-detail-card__icon">
                      <IconifyIcon icon="mdi:api" />
                    </div>
                    <div class="min-w-0">
                      <div class="package-detail-card__name">
                        {{ item.interfaceName }}
                      </div>
                      <div class="package-detail-card__desc">
                        {{ item.packageName }} / {{ item.specName }}
                      </div>
                    </div>
                  </div>

                  <div class="package-detail-tags">
                    <span>{{ item.apiCode }}</span>
                    <span>
                      {{
                        $t('page.dashboard.workbench.package.expireAt', [
                          expireText(item.expireTime),
                        ])
                      }}
                    </span>
                  </div>

                  <div class="package-detail-stats">
                    <div>
                      <span>{{
                        $t('page.dashboard.workbench.package.dailyLimit')
                      }}</span>
                      <strong>{{ limitText(item.dailyLimit) }}</strong>
                    </div>
                    <div>
                      <span>{{
                        $t('page.dashboard.workbench.package.todayUsed')
                      }}</span>
                      <strong>{{ formatCount(item.todayCalls) }}</strong>
                    </div>
                    <div>
                      <span>{{
                        $t('page.dashboard.workbench.package.remainingCalls')
                      }}</span>
                      <strong>
                        {{
                          remainingText(
                            item.remainingUnlimited,
                            item.remainingCalls,
                          )
                        }}
                      </strong>
                    </div>
                    <div>
                      <span>QPS</span>
                      <strong>{{ limitText(item.qpsLimit) }}</strong>
                    </div>
                  </div>
                </article>
              </div>
              <div v-else class="package-detail-empty">
                {{ $t('page.dashboard.workbench.package.emptyInterface') }}
              </div>
            </section>
          </TabPane>
        </Tabs>
      </div>
    </PackageDetailDrawer>

    <Modal
      v-model:open="dailyNoticeVisible"
      :closable="false"
      :footer="null"
      :width="760"
      centered
      destroy-on-close
      wrap-class-name="daily-notice-modal-wrap"
      @cancel="closeDailyNotice"
    >
      <Spin :spinning="dailyNoticeLoading">
        <div v-if="activeDailyNotice" class="daily-notice">
          <div class="daily-notice__modal-head">
            <div class="daily-notice__modal-title-wrap">
              <div class="daily-notice__modal-icon">
                <IconifyIcon icon="lucide:megaphone" />
              </div>
              <div>
                <div class="daily-notice__modal-title">
                  {{ $t('page.dashboard.workbench.notice.dailyTitle') }}
                </div>
                <div class="daily-notice__modal-subtitle">
                  {{
                    $t('page.dashboard.workbench.notice.dailyCount', [
                      dailyPopupTotal,
                    ])
                  }}
                </div>
              </div>
            </div>
            <button
              :aria-label="$t('page.dashboard.workbench.notice.closeAria')"
              class="daily-notice__close"
              type="button"
              @click="closeDailyNotice"
            >
              <IconifyIcon icon="lucide:x" />
            </button>
          </div>

          <div class="daily-notice__body">
            <div v-if="dailyPopupNotices.length > 1" class="daily-notice__tabs">
              <button
                v-for="item in dailyPopupNotices"
                :key="item.id"
                class="daily-notice__tab"
                :class="[item.id === activeDailyNotice?.id && 'is-active']"
                type="button"
                @click="activeDailyNoticeId = item.id"
              >
                {{ item.title }}
              </button>
            </div>

            <article class="daily-notice__article">
              <div class="daily-notice__head">
                <div class="min-w-0">
                  <div class="daily-notice__title">
                    {{ activeDailyNotice.title }}
                  </div>
                  <div class="daily-notice__meta">
                    {{
                      activeDailyNotice.publishTime ||
                      $t('page.dashboard.workbench.notice.dailyTitle')
                    }}
                  </div>
                </div>
                <Tag v-if="activeDailyNotice.isTop === 1" color="blue">
                  {{ $t('page.dashboard.workbench.notice.top') }}
                </Tag>
              </div>

              <div class="daily-notice__content">
                <RichTextPreview :content="activeDailyNoticeContent" />
              </div>
            </article>
          </div>

          <div class="daily-notice__actions">
            <Button @click="viewAllNotices(true)">
              {{ $t('page.dashboard.workbench.notice.viewAll') }}
            </Button>
            <Button type="primary" @click="closeDailyNotice">
              {{ $t('page.dashboard.workbench.notice.acknowledge') }}
            </Button>
          </div>
        </div>
      </Spin>
    </Modal>

    <Modal
      v-model:open="workspaceNoticeVisible"
      :destroy-on-close="true"
      :footer="null"
      :width="820"
      centered
      class="workspace-notice-detail-modal"
      @after-close="afterWorkspaceNoticeClosed"
      @cancel="closeWorkspaceNotice"
    >
      <Spin :spinning="workspaceNoticeDetailLoading">
        <article v-if="currentWorkspaceNotice" class="workspace-notice-detail">
          <div class="workspace-notice-detail__head">
            <div class="min-w-0">
              <div class="workspace-notice-detail__title">
                {{ currentWorkspaceNotice.title }}
              </div>
              <div class="workspace-notice-detail__meta">
                {{
                  currentWorkspaceNotice.publishTime ||
                  $t('page.dashboard.workbench.notice.detailTitle')
                }}
              </div>
            </div>
            <Tag v-if="currentWorkspaceNotice.isTop === 1" color="blue">
              {{ $t('page.dashboard.workbench.notice.top') }}
            </Tag>
          </div>
          <div class="workspace-notice-detail__content">
            <RichTextPreview :content="currentWorkspaceNoticeContent" />
          </div>
        </article>
      </Spin>
    </Modal>

    <Modal
      v-model:open="rechargeVisible"
      :footer="null"
      :mask-closable="!rechargeLoading"
      destroy-on-close
      :title="$t('page.dashboard.workbench.recharge.title')"
      width="520px"
      @cancel="handleRechargeCancel"
    >
      <Spin :spinning="rechargeLoading && !rechargeOrder">
        <div class="recharge-panel">
          <div class="recharge-panel__summary">
            <div>
              <span>{{
                $t('page.dashboard.workbench.recharge.currentBalance')
              }}</span>
              <strong>{{ formatSiteMoney(userStats.balance) }}</strong>
            </div>
            <Tag color="blue">
              {{
                rechargeClientType === 'MOBILE'
                  ? $t('page.dashboard.workbench.recharge.mobileDetected')
                  : $t('page.dashboard.workbench.recharge.desktopDetected')
              }}
            </Tag>
          </div>

          <div class="recharge-field">
            <label>{{ $t('page.dashboard.workbench.recharge.amount') }}</label>
            <InputNumber
              v-model:value="rechargeAmountInput"
              class="recharge-amount-input"
              :max="settlementFromCNY(99999.99)"
              :min="0.01"
              :precision="2"
              :prefix="settlementSymbol"
            />
            <div
              v-if="rechargeAmountOptions.length > 0"
              class="recharge-quick-amounts"
            >
              <button
                v-for="item in rechargeAmountOptions"
                :key="item.id"
                :class="{ 'is-active': isRechargeAmountSelected(item) }"
                type="button"
                @click="selectRechargeAmount(item)"
              >
                <span>{{ settlementPriceText(item.amount) }}</span>
                <small v-if="Number(item.giftAmount) > 0">
                  {{
                    $t('page.dashboard.workbench.recharge.giftAmount', [
                      formatSiteMoney(item.giftAmount),
                    ])
                  }}
                </small>
              </button>
            </div>
            <div
              v-if="selectedRechargeGiftAmount > 0"
              class="recharge-gift-tip"
            >
              <IconifyIcon icon="lucide:badge-plus" />
              <span>
                {{ $t('page.dashboard.workbench.recharge.actualCreditPrefix') }}
                <strong>{{ formatSiteMoney(selectedRechargeCreditAmount) }}</strong>
                {{
                  $t('page.dashboard.workbench.recharge.actualCreditSuffix', [
                    formatSiteMoney(selectedRechargeGiftAmount),
                  ])
                }}
              </span>
            </div>
          </div>

          <div class="recharge-field">
            <label>{{
              $t('page.dashboard.workbench.recharge.payMethod')
            }}</label>
            <RadioGroup
              v-model:value="rechargePayChannel"
              class="recharge-methods"
            >
              <Radio
                v-for="item in rechargeChannelOptions"
                :key="item.value"
                :value="item.value"
              >
                {{ item.label }}
              </Radio>
            </RadioGroup>
            <div class="recharge-capability-tags">
              <Tag
                v-for="item in rechargeChannelOptions"
                :key="item.value"
                color="processing"
              >
                {{ item.label }}
              </Tag>
            </div>
          </div>

          <div v-if="rechargePayChannel === 'ALIPAY'" class="recharge-field">
            <label>{{
              $t('page.dashboard.workbench.recharge.alipayMethod')
            }}</label>
            <RadioGroup
              v-model:value="rechargePreferredProduct"
              class="recharge-methods"
            >
              <Radio
                v-for="item in rechargeProductOptions"
                :key="item.value"
                :value="item.value"
              >
                {{ item.label }}
              </Radio>
            </RadioGroup>
            <div v-if="rechargeCapabilities" class="recharge-capability-tags">
              <Tag
                v-if="rechargeCapabilities.websitePayEnabled"
                color="processing"
              >
                {{ $t('page.dashboard.workbench.recharge.websitePay') }}
              </Tag>
              <Tag v-if="rechargeCapabilities.wapPayEnabled" color="success">
                {{ $t('page.dashboard.workbench.recharge.wapPay') }}
              </Tag>
              <Tag v-if="rechargeCapabilities.facePayEnabled" color="warning">
                {{ $t('page.dashboard.workbench.recharge.facePayShort') }}
              </Tag>
            </div>
          </div>

          <div v-if="rechargePendingExisting" class="recharge-pending-box">
            <div class="recharge-pending-box__head">
              <strong>
                {{ $t('page.dashboard.workbench.recharge.pendingExistingTitle') }}
              </strong>
              <span>{{ rechargePendingExisting.orderNo }}</span>
            </div>
            <p>
              {{
                $t('page.dashboard.workbench.recharge.pendingExistingDesc', [
                  formatPayable(
                    rechargePendingExisting.amount ?? 0,
                    rechargePendingExisting.currency,
                  ),
                  rechargePendingExisting.expireTime || '-',
                ])
              }}
            </p>
            <div class="recharge-pending-box__actions">
              <Button :disabled="rechargeLoading" @click="createNewRecharge">
                {{ $t('page.dashboard.workbench.recharge.createNewOrder') }}
              </Button>
              <Button
                type="primary"
                :loading="rechargeLoading"
                @click="continueRechargeExisting"
              >
                {{ $t('page.dashboard.workbench.recharge.continueOldOrder') }}
              </Button>
            </div>
          </div>

          <div v-if="rechargeOrder" class="recharge-order-box">
            <div class="recharge-order-box__head">
              <div>
                <span>{{
                  $t('page.dashboard.workbench.recharge.orderNo')
                }}</span>
                <strong>{{ rechargeOrder.orderNo }}</strong>
              </div>
              <Tag :color="paymentStatusColor(rechargeOrder.status)">
                {{ paymentStatusText(rechargeOrder.status) }}
              </Tag>
            </div>
            <div
              v-if="rechargeOrder.status !== 'PAID'"
              class="recharge-countdown"
              :class="{
                'is-expired':
                  rechargeExpired || rechargeOrder.status === 'EXPIRED',
              }"
            >
              <IconifyIcon
                :icon="
                  rechargeExpired || rechargeOrder.status === 'EXPIRED'
                    ? 'lucide:clock-alert'
                    : 'lucide:clock'
                "
              />
              <span v-if="rechargeExpired || rechargeOrder.status === 'EXPIRED'">
                {{ $t('page.dashboard.workbench.recharge.expiredTip') }}
              </span>
              <span v-else>
                {{ $t('page.dashboard.workbench.recharge.remainingTip') }}
                <strong>{{ rechargeCountdownText }}</strong>
              </span>
            </div>
            <div class="recharge-order-amounts">
              <span>
                {{
                  $t('page.dashboard.workbench.recharge.payAmount', [
                    formatPayable(rechargeOrder.amount ?? 0, rechargeOrder.currency),
                  ])
                }}
              </span>
              <span v-if="Number(rechargeOrder.giftAmount ?? 0) > 0">
                {{
                  $t('page.dashboard.workbench.recharge.giftAmount', [
                    formatSiteMoney(rechargeOrder.giftAmount ?? 0),
                  ])
                }}
              </span>
              <strong>
                {{ $t('page.dashboard.workbench.recharge.credit') }}
                {{
                  formatSiteMoney(
                    rechargeOrder.creditAmount ?? rechargeOrder.amount ?? 0,
                  )
                }}
              </strong>
            </div>
            <div
              v-if="rechargeChainDeposit && rechargeOrder.status !== 'PAID'"
              class="recharge-trc20"
            >
              <div class="recharge-trc20__row">
                <span>{{ $t('page.dashboard.workbench.recharge.trc20Network') }}</span>
                <strong>{{ rechargeChainNetwork }}</strong>
              </div>
              <div class="recharge-trc20__row">
                <span>{{ $t('page.dashboard.workbench.recharge.trc20Address') }}</span>
                <code>{{ rechargeOrder.chainAddress }}</code>
                <Button
                  size="small"
                  @click="copyTrc20Value(rechargeOrder.chainAddress || '')"
                >
                  {{ $t('page.dashboard.workbench.recharge.copy') }}
                </Button>
              </div>
              <div class="recharge-trc20__row">
                <span>{{ $t('page.dashboard.workbench.recharge.trc20Amount') }}</span>
                <strong>{{ rechargeOrder.chainAmount }} USDT</strong>
                <Button
                  size="small"
                  @click="copyTrc20Value(String(rechargeOrder.chainAmount ?? ''))"
                >
                  {{ $t('page.dashboard.workbench.recharge.copy') }}
                </Button>
              </div>
              <p class="recharge-trc20__tip">
                {{ $t('page.dashboard.workbench.recharge.trc20Tip') }}
              </p>
              <div class="recharge-trc20__submit">
                <Input
                  v-model:value="trc20Txid"
                  allow-clear
                  :placeholder="$t('page.dashboard.workbench.recharge.trc20TxidPlaceholder')"
                />
                <Button
                  :loading="trc20Submitting"
                  type="primary"
                  @click="submitTrc20Payment"
                >
                  {{ $t('page.dashboard.workbench.recharge.trc20Submit') }}
                </Button>
              </div>
            </div>
            <div v-if="rechargePaid" class="recharge-paid">
              <span class="recharge-paid__logo">
                <img
                  v-if="rechargeLogoUrl && !rechargeLogoFailed"
                  :alt="$t('page.dashboard.workbench.recharge.paidTitle')"
                  :src="rechargeLogoUrl"
                  referrerpolicy="no-referrer"
                  @error="rechargeLogoFailed = true"
                />
                <IconifyIcon v-else icon="lucide:circle-check" />
              </span>
              <div class="recharge-paid__body">
                <strong>
                  {{ $t('page.dashboard.workbench.recharge.paidTitle') }}
                </strong>
                <p>
                  {{ $t('page.dashboard.workbench.recharge.paidDesc') }}
                </p>
              </div>
            </div>
            <div v-else-if="rechargeOrder.qrCode" class="recharge-qrcode">
              <!-- 未勾选协议时二维码虚化并叠锁层：码依然可见但扫不出 -->
              <PaymentQrShield
                :locked="!rechargeAgreementAccepted"
                @unlock="focusRechargeAgreement"
              >
                <QRCode
                  :bordered="false"
                  error-level="H"
                  :icon="rechargeLogoUrl || undefined"
                  :icon-size="40"
                  :size="180"
                  :value="
                    rechargeAgreementAccepted
                      ? (rechargeOrder.qrCode ?? '')
                      : QR_LOCKED_PLACEHOLDER
                  "
                />
              </PaymentQrShield>
              <p>
                {{ $t('page.dashboard.workbench.recharge.scanTip') }}
              </p>
            </div>
            <div v-else class="recharge-order-tip">
              {{ $t('page.dashboard.workbench.recharge.openedTip') }}
            </div>
          </div>

          <div ref="rechargeConsentRef" class="recharge-consent">
            <PaymentAgreementConsent v-model:checked="rechargeAgreementAccepted" />
            <p v-if="!rechargeAgreementAccepted" class="recharge-consent-tip">
              {{ $t('paymentAgreement.consentRequired') }}
            </p>
          </div>

          <div class="recharge-actions">
            <Button @click="handleRechargeCancel(); rechargeVisible = false">
              {{ $t('page.dashboard.workbench.actions.cancel') }}
            </Button>
            <Button
              v-if="rechargeOrder"
              :loading="rechargeSyncLoading"
              @click="syncCurrentRechargeOrder()"
            >
              {{ $t('page.dashboard.workbench.recharge.completed') }}
            </Button>
            <Button
              v-if="!rechargePendingExisting"
              type="primary"
              :disabled="!selectedRechargePresetId"
              :loading="rechargeLoading"
              @click="submitRecharge"
            >
              {{ $t('page.dashboard.workbench.recharge.goPay') }}
            </Button>
          </div>
        </div>
      </Spin>
    </Modal>
  </div>
</template>

<style scoped>
.bind-email-warning {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  color: #991b1b;
  background:
    linear-gradient(135deg, rgb(254 242 242 / 96%), rgb(255 247 247 / 88%)),
    hsl(var(--card));
  border: 1px solid rgb(248 113 113 / 62%);
  border-left: 4px solid #ef4444;
  border-radius: 12px;
  box-shadow: 0 12px 30px rgb(239 68 68 / 10%);
}

.bind-email-warning__body {
  display: flex;
  gap: 12px;
  align-items: center;
  min-width: 0;
}

.bind-email-warning__icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  font-size: 19px;
  color: #dc2626;
  background: rgb(254 226 226 / 90%);
  border-radius: 8px;
}

.bind-email-warning__title {
  font-size: 15px;
  font-weight: 800;
  line-height: 22px;
}

.bind-email-warning__desc {
  margin-top: 2px;
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
  color: #b91c1c;
}

/* ---------- Admin operations command center ---------- */
.admin-workbench {
  display: flex;
  flex-direction: column;
  gap: 18px;
  color: hsl(var(--foreground));
}

.admin-eyebrow {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.13em;
  text-transform: uppercase;
  color: hsl(var(--muted-foreground));
}

.admin-eyebrow svg {
  font-size: 13px;
  color: hsl(var(--primary));
}

.admin-overview-section {
  min-width: 0;
}

.admin-overview-head {
  display: flex;
  gap: 24px;
  align-items: flex-start;
  justify-content: space-between;
  padding: 2px 2px 0;
}

.admin-overview-identity {
  min-width: 0;
}

.admin-overview-title-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  margin-top: 6px;
}

.admin-overview-head h2 {
  margin: 0;
  font-size: clamp(24px, 2.4vw, 32px);
  font-weight: 800;
  line-height: 1.08;
  letter-spacing: -0.035em;
  color: hsl(var(--foreground));
}

.admin-overview-head p {
  max-width: 680px;
  margin: 8px 0 0;
  font-size: 13.5px;
  line-height: 1.65;
  color: hsl(var(--muted-foreground));
}

.admin-overview-actions {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: flex-end;
}

.admin-alert-total {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  height: 30px;
  padding: 0 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: hsl(var(--foreground));
  background: hsl(var(--muted) / 42%);
  border: 1px solid hsl(var(--border));
  border-radius: 999px;
}

.admin-health-pill {
  display: inline-flex;
  gap: 7px;
  align-items: center;
  height: 26px;
  padding: 0 11px;
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--state-color);
  background: var(--state-soft);
  border: 1px solid var(--state-border);
  border-radius: 999px;
}

.admin-health-pill__dot {
  width: 7px;
  height: 7px;
  background: currentcolor;
  border-radius: 999px;
  box-shadow: 0 0 0 4px var(--state-soft);
}

.admin-health-pill[data-state='healthy'] {
  --state-color: #15803d;
  --state-soft: rgb(22 163 74 / 9%);
  --state-border: rgb(22 163 74 / 22%);
}

.admin-health-pill[data-state='info'] {
  --state-color: #1d4ed8;
  --state-soft: rgb(37 99 235 / 9%);
  --state-border: rgb(37 99 235 / 22%);
}

.admin-health-pill[data-state='warning'] {
  --state-color: #b45309;
  --state-soft: rgb(245 158 11 / 12%);
  --state-border: rgb(245 158 11 / 26%);
}

.admin-health-pill[data-state='danger'] {
  --state-color: #b91c1c;
  --state-soft: rgb(239 68 68 / 11%);
  --state-border: rgb(239 68 68 / 26%);
}

.admin-health-pill[data-state='pending'] {
  --state-color: hsl(var(--muted-foreground));
  --state-soft: hsl(var(--muted) / 40%);
  --state-border: hsl(var(--border));
}

.admin-metric-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
  margin-top: 18px;
}

.admin-metric-card {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 136px;
  padding: 16px;
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 14px;
  box-shadow: 0 1px 2px rgb(15 23 42 / 4%);
  transition:
    border-color 0.18s ease,
    transform 0.18s ease;
}

.admin-metric-card[data-rank='primary'] {
  background:
    linear-gradient(180deg, hsl(var(--card)), hsl(var(--muted) / 24%)),
    hsl(var(--card));
  border-color: color-mix(in srgb, var(--admin-tone) 24%, hsl(var(--border)));
}

.admin-metric-card[data-rank='secondary'] {
  min-height: 118px;
}

.admin-metric-card::after {
  position: absolute;
  right: -44px;
  bottom: -58px;
  width: 132px;
  height: 132px;
  content: '';
  background: var(--admin-tone-soft);
  border-radius: 999px;
  opacity: 0.7;
}

.admin-metric-card[data-tone='blue'] {
  --admin-tone: #2563eb;
  --admin-tone-soft: rgb(37 99 235 / 9%);
}

.admin-metric-card[data-tone='green'] {
  --admin-tone: #16a34a;
  --admin-tone-soft: rgb(22 163 74 / 9%);
}

.admin-metric-card[data-tone='violet'] {
  --admin-tone: #7c3aed;
  --admin-tone-soft: rgb(124 58 237 / 9%);
}

.admin-metric-card[data-tone='orange'] {
  --admin-tone: #ea580c;
  --admin-tone-soft: rgb(234 88 12 / 9%);
}

.admin-metric-card[data-tone='cyan'] {
  --admin-tone: #0891b2;
  --admin-tone-soft: rgb(8 145 178 / 9%);
}

.admin-metric-card[data-tone='rose'] {
  --admin-tone: #e11d48;
  --admin-tone-soft: rgb(225 29 72 / 9%);
}

.admin-metric-card__top {
  z-index: 1;
  display: flex;
  gap: 10px;
  align-items: center;
  min-width: 0;
}

.admin-metric-card__icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  font-size: 16px;
  color: var(--admin-tone);
  background: var(--admin-tone-soft);
  border-radius: 9px;
}

.admin-metric-card__title {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12.5px;
  font-weight: 600;
  line-height: 1.4;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.admin-metric-card__value {
  z-index: 1;
  margin-top: auto;
  padding-top: 16px;
  white-space: nowrap;
  font-size: clamp(24px, 2vw, 30px);
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  line-height: 1.04;
  letter-spacing: -0.035em;
  color: hsl(var(--foreground));
}

.admin-metric-card[data-rank='secondary'] .admin-metric-card__value {
  font-size: clamp(21px, 1.7vw, 26px);
}

.admin-metric-card__meta {
  z-index: 1;
  display: -webkit-box;
  margin-top: 10px;
  overflow: hidden;
  -webkit-line-clamp: 2;
  font-size: 11.5px;
  line-height: 1.5;
  color: hsl(var(--muted-foreground));
  -webkit-box-orient: vertical;
}

.admin-metric-card__meta--detail {
  margin-top: 4px;
  opacity: 0.78;
}

.admin-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(320px, 0.85fr);
  gap: 18px;
  align-items: stretch;
}

.admin-command-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(320px, 0.8fr);
  gap: 18px;
  align-items: stretch;
}

.admin-trend-grid {
  grid-template-columns: minmax(0, 1.35fr) minmax(340px, 0.9fr);
}

.admin-support-grid {
  grid-template-columns: minmax(0, 1.45fr) minmax(300px, 0.75fr);
}

.admin-panel {
  position: relative;
  min-width: 0;
  padding: 20px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 16px;
  box-shadow: 0 1px 2px rgb(15 23 42 / 4%);
}

.admin-panel--wide {
  min-width: 0;
}

.admin-panel__actions {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.admin-module-error {
  padding: 8px 11px;
  margin-bottom: 12px;
  font-size: 12px;
  line-height: 1.5;
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 7%);
  border: 1px solid hsl(var(--destructive) / 22%);
  border-radius: 9px;
}

.admin-module-error[data-state='degraded'] {
  color: #b45309;
  background: rgb(245 158 11 / 8%);
  border-color: rgb(245 158 11 / 22%);
}

.admin-panel__head {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
}

.admin-panel__head--primary {
  margin-bottom: 0;
  padding: 20px 22px 16px;
  border-bottom: 1px solid hsl(var(--border));
}

.admin-panel__head--compact {
  margin-bottom: 14px;
}

.admin-panel__title-group {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  min-width: 0;
}

.admin-section-index {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 24px;
  padding: 0 7px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 52%);
  border: 1px solid hsl(var(--border));
  border-radius: 7px;
}

.admin-panel__head h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
  line-height: 1.25;
  letter-spacing: -0.02em;
  color: hsl(var(--foreground));
}

.admin-panel__head p {
  margin: 4px 0 0;
  font-size: 12.5px;
  line-height: 1.55;
  color: hsl(var(--muted-foreground));
}

.admin-chart {
  width: 100%;
  height: 280px;
}

/* ---------- Primary alert feed ---------- */
.admin-panel--alerts {
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
}

.admin-panel--alerts::before {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: 2px;
  content: '';
  background: linear-gradient(
    90deg,
    #ef4444,
    #f97316 32%,
    hsl(var(--primary)) 68%,
    transparent
  );
  opacity: 0.72;
}

.admin-alert-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.admin-alert-summary__chip {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  height: 24px;
  padding: 0 9px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.03em;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 45%);
  border-radius: 999px;
}

.admin-alert-summary__chip i {
  width: 6px;
  height: 6px;
  background: var(--chip-color);
  border-radius: 999px;
}

.admin-alert-summary__chip[data-level='danger'] {
  --chip-color: #dc2626;
  color: #b91c1c;
  background: rgb(220 38 38 / 9%);
}

.admin-alert-summary__chip[data-level='warning'] {
  --chip-color: #d97706;
  color: #b45309;
  background: rgb(217 119 6 / 10%);
}

.admin-alert-summary__chip[data-level='info'] {
  --chip-color: #2563eb;
  color: #1d4ed8;
  background: rgb(37 99 235 / 8%);
}

.admin-alert-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px;
}

.admin-alert {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  width: 100%;
  min-width: 0;
  padding: 14px;
  color: hsl(var(--foreground));
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 12px;
  transition:
    background 0.18s ease,
    border-color 0.18s ease;
  animation: admin-alert-in 0.34s ease both;
  animation-delay: calc(var(--alert-index, 0) * 35ms);
}

.admin-alert:hover {
  background: hsl(var(--muted) / 34%);
  border-color: hsl(var(--border));
}

.admin-alert[data-level='danger'] {
  --alert-color: #dc2626;
  --alert-soft: rgb(220 38 38 / 10%);
}

.admin-alert[data-level='warning'] {
  --alert-color: #d97706;
  --alert-soft: rgb(217 119 6 / 11%);
}

.admin-alert[data-level='info'] {
  --alert-color: #2563eb;
  --alert-soft: rgb(37 99 235 / 9%);
}

.admin-alert[data-level='success'] {
  --alert-color: #16a34a;
  --alert-soft: rgb(22 163 74 / 9%);
}

.admin-alert__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  font-size: 19px;
  color: var(--alert-color);
  background: var(--alert-soft);
  border-radius: 11px;
}

.admin-alert__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.admin-alert__meta {
  display: flex;
  gap: 7px;
  align-items: center;
  min-width: 0;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: hsl(var(--muted-foreground));
}

.admin-alert__level {
  color: var(--alert-color);
}

.admin-alert__meta-divider {
  width: 1px;
  height: 10px;
  background: hsl(var(--border));
}

.admin-alert__body strong {
  font-size: 14.5px;
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: -0.01em;
  color: hsl(var(--foreground));
}

.admin-alert__body small {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  font-size: 12.5px;
  line-height: 1.6;
  color: hsl(var(--muted-foreground));
  -webkit-box-orient: vertical;
}

.admin-alert__cta {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  font-size: 12px;
  font-weight: 700;
  color: hsl(var(--primary));
  white-space: nowrap;
  opacity: 0.72;
  transition: opacity 0.18s ease;
}

.admin-alert:hover .admin-alert__cta {
  opacity: 1;
}

.admin-alert-empty {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  justify-content: center;
  min-height: 280px;
  padding: 32px 24px;
  text-align: center;
}

.admin-alert-empty__icon {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  font-size: 26px;
  color: #16a34a;
  background: rgb(22 163 74 / 9%);
  border-radius: 16px;
}

.admin-alert-empty__icon.is-pending {
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 40%);
}

.admin-alert-empty strong {
  font-size: 16px;
  font-weight: 800;
  color: hsl(var(--foreground));
}

.admin-alert-empty p {
  max-width: 340px;
  margin: 0;
  font-size: 12.5px;
  line-height: 1.6;
  color: hsl(var(--muted-foreground));
}

/* ---------- Service health aside ---------- */
.admin-panel--health {
  display: flex;
  flex-direction: column;
}

.admin-health-figure {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px 0 20px;
}

.admin-health-figure__label {
  font-size: 12px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
}

.admin-health-figure strong {
  font-size: clamp(38px, 3.6vw, 48px);
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.04em;
  color: hsl(var(--foreground));
}

.admin-health-figure strong[data-state='danger'] {
  color: #dc2626;
}

.admin-health-figure strong[data-state='warning'] {
  color: #b45309;
}

.admin-health-figure__slo {
  margin-top: 4px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: hsl(var(--muted-foreground));
}

.admin-health-composition {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.admin-health-bar {
  display: flex;
  height: 7px;
  overflow: hidden;
  background: hsl(var(--muted) / 40%);
  border-radius: 999px;
}

.admin-health-bar span {
  display: block;
  height: 100%;
  min-width: 2px;
}

.admin-health-legend {
  display: grid;
  grid-template-columns: 1fr;
  gap: 7px;
}

.admin-health-legend > div {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 11.5px;
  color: hsl(var(--muted-foreground));
}

.admin-health-legend__dot {
  flex: 0 0 auto;
  width: 7px;
  height: 7px;
  border-radius: 999px;
}

.admin-health-legend__label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-health-legend strong {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  color: hsl(var(--foreground));
}

.admin-health-empty {
  padding: 14px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  text-align: center;
  background: hsl(var(--muted) / 30%);
  border-radius: 10px;
}

.admin-health-worst {
  padding-top: 16px;
  margin-top: auto;
  border-top: 1px solid hsl(var(--border));
}

.admin-health-worst__label {
  display: block;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: hsl(var(--muted-foreground));
}

.admin-health-worst__item {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 10px 12px;
  margin-top: 8px;
  color: hsl(var(--foreground));
  text-align: left;
  cursor: pointer;
  background: hsl(var(--muted) / 30%);
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
  transition:
    background 0.18s ease,
    border-color 0.18s ease;
}

.admin-health-worst__item:hover {
  background: hsl(var(--primary) / 5%);
  border-color: hsl(var(--primary) / 35%);
}

.admin-health-worst__item strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}

.admin-health-worst__item small {
  display: block;
  margin-top: 2px;
  font-size: 11.5px;
  color: hsl(var(--muted-foreground));
}

.admin-health-worst__empty {
  display: block;
  margin-top: 8px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

@keyframes admin-alert-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.admin-table {
  display: flex;
  flex-direction: column;
}

.admin-table__row {
  display: grid;
  grid-template-columns:
    minmax(180px, 1.6fr) minmax(70px, 0.5fr) minmax(80px, 0.6fr)
    minmax(90px, 0.7fr) minmax(80px, 0.5fr);
  gap: 12px;
  align-items: center;
  width: 100%;
  min-height: 46px;
  padding: 11px 10px;
  font-size: 12.5px;
  line-height: 1.5;
  color: hsl(var(--foreground));
  text-align: left;
  background: transparent;
  border: 0;
  border-bottom: 1px solid hsl(var(--border) / 60%);
  border-radius: 0;
}

.admin-table__row--head {
  min-height: 34px;
  padding-top: 0;
  padding-bottom: 8px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: hsl(var(--muted-foreground));
  background: transparent;
  border-bottom-color: hsl(var(--border));
}

.admin-table__row--clickable {
  cursor: pointer;
  transition: background 0.18s ease;
}

.admin-table__row--clickable:hover {
  background: hsl(var(--muted) / 32%);
}

.admin-table__main {
  min-width: 0;
}

.admin-table__main strong,
.admin-user__main strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 700;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.admin-table__main small,
.admin-user__main small {
  display: block;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 11.5px;
  line-height: 1.5;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.admin-user-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.admin-user {
  display: flex;
  gap: 10px;
  align-items: center;
  width: 100%;
  min-width: 0;
  padding: 11px 10px;
  color: hsl(var(--foreground));
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-bottom: 1px solid hsl(var(--border) / 60%);
  border-radius: 0;
  transition: background 0.18s ease;
}

.admin-user:last-child {
  border-bottom: 0;
}

.admin-user:hover {
  background: hsl(var(--muted) / 32%);
}

.admin-user__avatar {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  font-size: 13px;
  font-weight: 700;
  color: white;
  background: linear-gradient(135deg, #2563eb, #14b8a6);
  border-radius: 10px;
}

.admin-user__main {
  flex: 1 1 auto;
  min-width: 0;
}

.admin-user__stat {
  flex: 0 0 auto;
  font-size: 16px;
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  line-height: 1.5;
  color: hsl(var(--foreground));
}

.admin-quick-grid--compact {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
}

.admin-quick {
  display: flex;
  gap: 9px;
  align-items: center;
  min-height: 46px;
  padding: 10px 12px;
  font-size: 12.5px;
  font-weight: 600;
  color: hsl(var(--foreground));
  cursor: pointer;
  background: hsl(var(--muted) / 26%);
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
  transition:
    background 0.18s ease,
    border-color 0.18s ease;
}

.admin-quick:hover {
  background: hsl(var(--muted) / 42%);
  border-color: hsl(var(--primary) / 30%);
}

.admin-quick__icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.admin-quick__arrow {
  flex: 0 0 auto;
  margin-left: auto;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
  opacity: 0.65;
  transition:
    color 0.18s ease,
    opacity 0.18s ease;
}

.admin-quick:hover .admin-quick__arrow {
  color: hsl(var(--primary));
  opacity: 1;
}

.admin-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 88px;
  font-size: 12.5px;
  color: hsl(var(--muted-foreground));
  border: 1px dashed hsl(var(--border));
  border-radius: 10px;
}

.daily-notice {
  display: flex;
  flex-direction: column;
  background: hsl(var(--card));
}

:deep(.daily-notice-modal-wrap .ant-modal-content) {
  padding: 0;
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  box-shadow: 0 18px 46px rgb(15 23 42 / 18%);
}

:deep(.daily-notice-modal-wrap .ant-modal-body) {
  padding: 0;
}

.daily-notice__modal-head {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  background: linear-gradient(
    180deg,
    hsl(var(--muted) / 42%),
    hsl(var(--card))
  );
  border-bottom: 1px solid hsl(var(--border));
}

.daily-notice__modal-title-wrap {
  display: flex;
  gap: 12px;
  align-items: center;
  min-width: 0;
}

.daily-notice__modal-icon {
  display: inline-flex;
  flex: 0 0 40px;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  font-size: 20px;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
  border-radius: 8px;
}

.daily-notice__modal-title {
  font-size: 19px;
  font-weight: 800;
  line-height: 1.35;
  color: hsl(var(--foreground));
}

.daily-notice__modal-subtitle {
  margin-top: 2px;
  font-size: 13px;
  line-height: 1.4;
  color: hsl(var(--muted-foreground));
}

.daily-notice__close {
  display: inline-flex;
  flex: 0 0 34px;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  font-size: 20px;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 8px;
  transition:
    background 0.2s ease,
    color 0.2s ease;
}

.daily-notice__close:hover {
  color: hsl(var(--foreground));
  background: hsl(var(--muted) / 70%);
}

.daily-notice__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 20px 0;
}

.daily-notice__tabs {
  display: flex;
  gap: 8px;
  padding: 4px;
  overflow-x: auto;
  background: hsl(var(--muted) / 45%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.daily-notice__tab {
  max-width: 180px;
  height: 32px;
  padding: 0 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  font-weight: 700;
  line-height: 32px;
  color: rgb(100 116 139);
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 9px;
}

.daily-notice__tab.is-active {
  color: hsl(var(--primary));
  background: hsl(var(--background));
  box-shadow: 0 6px 16px rgb(15 23 42 / 8%);
}

.daily-notice__article {
  min-width: 0;
}

.daily-notice__head {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
  padding: 8px 0 16px;
  border-bottom: 1px solid hsl(var(--border));
}

.daily-notice__title {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 18px;
  font-weight: 800;
  line-height: 26px;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.daily-notice__meta {
  margin-top: 2px;
  font-size: 13px;
  line-height: 20px;
  color: rgb(100 116 139);
}

.daily-notice__content {
  max-height: min(46vh, 420px);
  padding: 18px 0 0;
  overflow: auto;
  font-size: 15px;
  line-height: 1.8;
  color: hsl(var(--foreground));
}

.daily-notice__content :deep(.ProseMirror),
.daily-notice__content :deep(.tiptap),
.daily-notice__content :deep(.tiptap-preview),
.daily-notice__content :deep(.vben-tiptap-preview) {
  min-height: 0 !important;
}

.daily-notice__content :deep(p:first-child) {
  margin-top: 0;
}

.daily-notice__content :deep(p:last-child) {
  margin-bottom: 0;
}

.daily-notice__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 14px 20px 18px;
  background: hsl(var(--card));
  border-top: 1px solid hsl(var(--border));
}

@media (max-width: 640px) {
  .daily-notice__modal-head {
    padding: 16px;
  }

  .daily-notice__body {
    padding: 14px 14px 0;
  }

  .daily-notice__head {
    flex-direction: column;
    align-items: flex-start;
  }

  .daily-notice__actions {
    flex-direction: column-reverse;
    padding: 12px 14px 14px;
  }

  .daily-notice__actions :deep(.ant-btn) {
    width: 100%;
  }
}

:deep(.package-detail-drawer-content) {
  padding: 16px;
}

.package-detail-drawer {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.package-detail-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 14px;
}

.package-detail-tabs :deep(.ant-tabs-tab) {
  font-weight: 700;
}

.package-detail-tabs :deep(.ant-tabs-content-holder) {
  min-width: 0;
}

.package-detail-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.package-detail-section__head {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  justify-content: space-between;
}

.package-detail-section__head h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 800;
  line-height: 24px;
  color: hsl(var(--foreground));
}

.package-detail-section__head p {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 18px;
  color: rgb(100 116 139);
}

.package-detail-section__head > span {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 700;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
  border-radius: 9px;
}

.package-detail-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.package-detail-card {
  padding: 16px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  box-shadow: 0 12px 32px rgb(15 23 42 / 4%);
}

.package-detail-card__top {
  display: flex;
  gap: 12px;
  align-items: center;
  min-width: 0;
}

.package-detail-card__icon {
  display: inline-flex;
  flex: 0 0 42px;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  font-size: 20px;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
  border-radius: 8px;
}

.package-detail-card__name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 16px;
  font-weight: 800;
  line-height: 24px;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.package-detail-card__desc {
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  line-height: 20px;
  color: rgb(100 116 139);
  white-space: nowrap;
}

.package-detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 14px 0;
}

.package-detail-tags span {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 600;
  line-height: 16px;
  color: rgb(100 116 139);
  background: hsl(var(--accent) / 62%);
  border-radius: 9px;
}

.package-detail-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.package-detail-stats div {
  min-width: 0;
  min-height: 58px;
  padding: 10px;
  background: hsl(var(--muted) / 34%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.package-detail-stats span {
  display: block;
  font-size: 12px;
  line-height: 16px;
  color: rgb(100 116 139);
}

.package-detail-stats strong {
  display: block;
  margin-top: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 18px;
  font-weight: 800;
  line-height: 22px;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.package-detail-empty {
  padding: 18px;
  font-size: 13px;
  line-height: 20px;
  color: rgb(100 116 139);
  text-align: center;
  background: hsl(var(--muted) / 28%);
  border: 1px dashed hsl(var(--border));
  border-radius: 12px;
}

.user-quick-actions {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.user-quick-action {
  position: relative;
  display: flex;
  gap: 12px;
  align-items: center;
  min-width: 0;
  min-height: 92px;
  padding: 16px;
  overflow: hidden;
  color: hsl(var(--foreground));
  text-align: left;
  cursor: pointer;
  background:
    linear-gradient(135deg, rgb(255 255 255 / 86%), rgb(255 255 255 / 68%)),
    hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  box-shadow: 0 12px 30px rgb(15 23 42 / 5%);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.user-quick-action::after {
  position: absolute;
  right: -34px;
  bottom: -46px;
  width: 106px;
  height: 106px;
  content: '';
  background: color-mix(in srgb, var(--user-action-accent) 12%, transparent);
  border-radius: 999px;
}

.user-quick-action:hover {
  border-color: color-mix(
    in srgb,
    var(--user-action-accent) 32%,
    hsl(var(--border))
  );
  box-shadow: 0 16px 36px rgb(15 23 42 / 8%);
  transform: translateY(-2px);
}

.user-quick-action__icon {
  z-index: 1;
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  font-size: 22px;
  color: var(--user-action-accent);
  background: color-mix(in srgb, var(--user-action-accent) 11%, white);
  border-radius: 8px;
}

.user-quick-action__content {
  z-index: 1;
  flex: 1 1 auto;
  min-width: 0;
}

.user-quick-action__title {
  display: flex;
  gap: 6px;
  align-items: center;
  min-width: 0;
  font-size: 15px;
  font-weight: 800;
  line-height: 22px;
  color: hsl(var(--foreground));
}

.user-quick-action__badge {
  flex: 0 0 auto;
  margin-inline-end: 0;
}

.user-quick-action__desc {
  display: -webkit-box;
  margin-top: 4px;
  overflow: hidden;
  -webkit-line-clamp: 2;
  font-size: 12px;
  line-height: 18px;
  color: rgb(100 116 139);
  -webkit-box-orient: vertical;
}

.user-quick-action__arrow {
  z-index: 1;
  flex: 0 0 auto;
  font-size: 17px;
  color: rgb(148 163 184);
  transition:
    color 0.2s ease,
    transform 0.2s ease;
}

.user-quick-action:hover .user-quick-action__arrow {
  color: var(--user-action-accent);
  transform: translateX(2px);
}

.user-metric-card {
  position: relative;
  min-height: 148px;
  padding: 22px;
  overflow: hidden;
  background:
    radial-gradient(
      circle at 96% 92%,
      color-mix(in srgb, var(--user-metric-accent) 13%, transparent),
      transparent 34%
    ),
    hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  box-shadow: 0 12px 32px rgb(15 23 42 / 4%);
}

.user-metric-card::before {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 3px;
  content: '';
  background: var(--user-metric-accent);
  opacity: 0.72;
}

.user-metric-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 16px;
  margin-top: 20px;
  font-size: 14px;
  color: rgb(100 116 139);
  border-top: 1px solid hsl(var(--border));
}

.user-metric-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  font-size: 20px;
  background: color-mix(in srgb, currentcolor 10%, hsl(var(--background)));
  border-radius: 8px;
}

.user-call-trend-card {
  min-height: 360px;
  padding: 20px 22px 18px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  box-shadow: 0 12px 32px rgb(15 23 42 / 4%);
}

.user-call-trend-head {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
}

.user-call-trend-title {
  font-size: 16px;
  font-weight: 700;
  line-height: 24px;
  color: hsl(var(--foreground));
}

.user-call-trend-desc {
  margin-top: 4px;
  font-size: 13px;
  line-height: 20px;
  color: rgb(100 116 139);
}

.user-call-trend-tabs {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 4px;
  padding: 3px;
  background: hsl(var(--muted) / 58%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.user-call-trend-tab {
  min-width: 62px;
  height: 30px;
  padding: 0 10px;
  font-size: 13px;
  font-weight: 700;
  line-height: 30px;
  color: rgb(100 116 139);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 9px;
  transition:
    background 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease;
}

.user-call-trend-tab.is-active {
  color: hsl(var(--primary));
  background: hsl(var(--background));
  box-shadow: 0 6px 16px rgb(15 23 42 / 8%);
}

.user-call-trend-chart {
  height: 270px;
  margin-top: 18px;
}

.user-notice-card {
  display: flex;
  flex-direction: column;
  min-height: 360px;
  padding: 18px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  box-shadow: 0 12px 32px rgb(15 23 42 / 4%);
}

.user-notice-card__head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 14px;
}

.user-notice-card__title {
  font-size: 16px;
  font-weight: 700;
  line-height: 24px;
  color: hsl(var(--foreground));
}

.user-notice-card__desc {
  margin-top: 4px;
  font-size: 13px;
  line-height: 20px;
  color: rgb(100 116 139);
}

.user-notice-card__more {
  flex: 0 0 auto;
  height: 30px;
  padding: 0 10px;
  font-size: 13px;
  font-weight: 700;
  color: hsl(var(--primary));
  cursor: pointer;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 9px;
  transition:
    background 0.2s ease,
    border-color 0.2s ease;
}

.user-notice-card__more:hover {
  background: hsl(var(--primary) / 7%);
  border-color: hsl(var(--primary) / 38%);
}

.user-notice-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.user-notice-item {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 56px;
  padding: 10px 10px 10px 12px;
  text-align: left;
  cursor: pointer;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    transform 0.2s ease;
}

.user-notice-item:hover {
  background: hsl(var(--primary) / 5%);
  border-color: hsl(var(--primary) / 32%);
  transform: translateY(-1px);
}

.user-notice-item__main {
  min-width: 0;
}

.user-notice-item__title-row {
  display: flex;
  gap: 6px;
  align-items: center;
  min-width: 0;
}

.user-notice-item__title {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
  font-weight: 700;
  line-height: 20px;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.user-notice-item__summary {
  display: -webkit-box;
  margin-top: 4px;
  overflow: hidden;
  -webkit-line-clamp: 1;
  font-size: 12px;
  line-height: 18px;
  color: rgb(100 116 139);
  -webkit-box-orient: vertical;
}

.user-notice-item__time {
  margin-top: 4px;
  font-size: 12px;
  line-height: 18px;
  color: rgb(100 116 139);
}

.user-notice-item__arrow {
  flex: 0 0 auto;
  font-size: 16px;
  color: rgb(148 163 184);
}

.user-notice-item:hover .user-notice-item__arrow {
  color: hsl(var(--primary));
}

.user-notice-empty {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  justify-content: center;
  min-height: 250px;
  font-size: 13px;
  color: rgb(100 116 139);
}

.user-notice-empty svg {
  width: 38px;
  height: 38px;
  padding: 9px;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
  border-radius: 10px;
}

.workspace-notice-detail {
  padding: 4px 2px 0;
}

.workspace-notice-detail__head {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
  padding-bottom: 16px;
  border-bottom: 1px solid hsl(var(--border));
}

.workspace-notice-detail__title {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 24px;
  font-weight: 800;
  line-height: 1.35;
  color: hsl(var(--foreground));
}

.workspace-notice-detail__meta {
  margin-top: 6px;
  font-size: 13px;
  line-height: 20px;
  color: rgb(100 116 139);
}

.workspace-notice-detail__content {
  max-height: min(62vh, 620px);
  padding-top: 18px;
  overflow: auto;
  color: hsl(var(--foreground));
}

.workspace-notice-detail__content :deep(.ProseMirror),
.workspace-notice-detail__content :deep(.tiptap),
.workspace-notice-detail__content :deep(.tiptap-preview),
.workspace-notice-detail__content :deep(.vben-tiptap-preview) {
  min-height: 0 !important;
}

.workspace-notice-detail__content :deep(p:first-child) {
  margin-top: 0;
}

.workspace-notice-detail__content :deep(p:last-child) {
  margin-bottom: 0;
}

.user-asset-summary {
  display: grid;
  grid-template-columns: minmax(230px, 1.2fr) repeat(2, minmax(132px, 0.9fr));
  gap: 14px;
  width: min(720px, 100%);
}

.user-asset-item {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
  padding: 12px 14px;
  background: hsl(var(--accent) / 45%);
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.user-asset-content {
  flex: 1 1 auto;
}

.user-asset-icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  font-size: 17px;
  color: hsl(var(--primary));
  background: hsl(var(--background));
  border-radius: 8px;
}

.user-asset-label {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  color: rgb(100 116 139);
  white-space: nowrap;
}

.user-asset-value {
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 20px;
  font-weight: 650;
  line-height: 1.2;
  color: rgb(15 23 42);
  white-space: nowrap;
}

.user-asset-actions {
  display: flex;
  flex-wrap: nowrap;
  gap: 6px;
  justify-content: flex-end;
  margin-top: 8px;
  white-space: nowrap;
}

.user-asset-detail-btn {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 4px;
  align-items: center;
  justify-content: center;
  height: 26px;
  padding: 0 8px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  color: hsl(var(--primary));
  cursor: pointer;
  background: hsl(var(--primary) / 8%);
  border: 1px solid hsl(var(--primary) / 16%);
  border-radius: 9px;
}

.user-asset-item.has-secondary-action {
  min-width: 230px;
}

.user-asset-detail-btn:hover {
  background: hsl(var(--primary) / 13%);
}

.user-asset-detail-btn.is-recharge {
  background: hsl(var(--primary) / 9%);
  border-color: hsl(var(--primary) / 22%);
}

.user-asset-detail-btn.is-recharge:hover {
  background: hsl(var(--primary) / 15%);
}

.user-asset-detail-btn.is-redeem {
  color: #16a34a;
  background: rgb(22 163 74 / 8%);
  border-color: rgb(22 163 74 / 18%);
}

.user-asset-detail-btn.is-redeem:hover {
  background: rgb(22 163 74 / 14%);
}

.recharge-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.recharge-panel__summary {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: hsl(var(--muted) / 35%);
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.recharge-panel__summary span,
.recharge-field label,
.recharge-order-box__head span {
  display: block;
  font-size: 13px;
  line-height: 20px;
  color: rgb(100 116 139);
}

.recharge-panel__summary strong {
  display: block;
  margin-top: 2px;
  font-size: 22px;
  font-weight: 800;
  line-height: 28px;
  color: hsl(var(--foreground));
}

.recharge-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.recharge-amount-input {
  width: 100%;
}

.recharge-quick-amounts,
.recharge-capability-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.recharge-quick-amounts button {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  min-height: 32px;
  padding: 5px 12px;
  font-size: 13px;
  font-weight: 700;
  line-height: 18px;
  color: hsl(var(--foreground));
  cursor: pointer;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 9px;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    color 0.2s ease;
}

.recharge-quick-amounts button small {
  font-size: 12px;
  font-weight: 700;
  color: #f43f5e;
}

.recharge-quick-amounts button:hover,
.recharge-quick-amounts button.is-active {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 7%);
  border-color: hsl(var(--primary) / 40%);
}

.recharge-gift-tip {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 9px 11px;
  font-size: 13px;
  line-height: 20px;
  color: rgb(159 18 57);
  background: rgb(255 241 242);
  border: 1px solid rgb(251 113 133 / 45%);
  border-radius: 8px;
}

.recharge-gift-tip svg {
  flex: none;
  font-size: 17px;
  color: rgb(225 29 72);
}

.recharge-gift-tip strong {
  font-weight: 800;
  color: rgb(225 29 72);
}

.recharge-methods {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
}

.recharge-order-box {
  padding: 14px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.recharge-order-box__head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
}

.recharge-order-box__head strong {
  display: block;
  margin-top: 2px;
  font-size: 13px;
  font-weight: 700;
  line-height: 20px;
  color: hsl(var(--foreground));
  word-break: break-all;
}

.recharge-pending-box {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  background: hsl(var(--warning) / 8%);
  border: 1px solid hsl(var(--warning) / 32%);
  border-radius: 12px;
}

.recharge-pending-box__head {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.recharge-pending-box__head strong {
  font-size: 14px;
  color: hsl(var(--foreground));
}

.recharge-pending-box__head span {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  word-break: break-all;
}

.recharge-pending-box p {
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  color: hsl(var(--muted-foreground));
}

.recharge-pending-box__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.recharge-countdown {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-top: 10px;
  font-size: 13px;
  color: hsl(var(--warning));
}

.recharge-countdown strong {
  font-variant-numeric: tabular-nums;
  font-weight: 800;
}

.recharge-countdown.is-expired {
  color: hsl(var(--destructive));
}

.recharge-order-amounts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-top: 12px;
  font-size: 13px;
  color: rgb(100 116 139);
}

.recharge-order-amounts span,
.recharge-order-amounts strong {
  padding: 0 9px;
  line-height: 22px;
  background: hsl(var(--muted));
  border-radius: 999px;
}

.recharge-order-amounts strong {
  font-weight: 800;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
}

.recharge-qrcode {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  margin-top: 14px;
}

.recharge-trc20 {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  margin-top: 14px;
  background: hsl(var(--muted) / 55%);
  border-radius: 10px;
}

.recharge-trc20__row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  font-size: 13px;
  color: rgb(100 116 139);
}

.recharge-trc20__row code,
.recharge-trc20__row strong {
  padding: 2px 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: hsl(var(--foreground));
  word-break: break-all;
  background: hsl(var(--background));
  border-radius: 6px;
}

.recharge-trc20__tip {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: rgb(180 83 9);
}

.recharge-trc20__submit {
  display: flex;
  gap: 8px;
  align-items: center;
}

.recharge-consent {
  margin-top: 14px;
  scroll-margin: 24px;
  border-radius: 9px;
  transition: box-shadow 0.3s ease;
}

/* 从二维码锁层跳转过来时闪一下，明确「要动的是这里」 */
.recharge-consent.is-nudged {
  box-shadow: 0 0 0 3px hsl(var(--primary) / 32%);
}

.recharge-consent-tip {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 18px;
  color: hsl(var(--warning));
}

/* 充值成功态：商户图标 + 到账说明 */
.recharge-paid {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-top: 14px;
  padding: 12px 14px;
  background: hsl(var(--success) / 8%);
  border: 1px solid hsl(var(--success) / 28%);
  border-radius: 10px;
}

.recharge-paid__logo {
  display: grid;
  flex: 0 0 44px;
  place-items: center;
  width: 44px;
  height: 44px;
  overflow: hidden;
  font-size: 24px;
  color: hsl(var(--success));
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
}

.recharge-paid__logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.recharge-paid__body {
  min-width: 0;
}

.recharge-paid__body strong {
  display: block;
  font-size: 14px;
  color: hsl(var(--foreground));
}

.recharge-paid__body p {
  margin: 3px 0 0;
  font-size: 12px;
  line-height: 18px;
  color: hsl(var(--muted-foreground));
}

.recharge-qrcode p,
.recharge-order-tip {
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  color: rgb(100 116 139);
}

.recharge-order-tip {
  padding: 12px;
  margin-top: 12px;
  background: hsl(var(--primary) / 7%);
  border-radius: 8px;
}

.recharge-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

html.dark .user-asset-label {
  color: rgb(148 163 184);
}

html.dark .user-call-trend-desc,
html.dark .user-call-trend-tab,
html.dark .user-quick-action__desc,
html.dark .user-notice-card__desc,
html.dark .user-notice-empty,
html.dark .user-notice-item__summary,
html.dark .user-notice-item__time,
html.dark .workspace-notice-detail__meta {
  color: rgb(148 163 184);
}

html.dark .package-detail-card__desc,
html.dark .package-detail-empty,
html.dark .package-detail-section__head p,
html.dark .package-detail-stats span,
html.dark .package-detail-tags span,
html.dark .recharge-order-amounts,
html.dark .recharge-order-tip,
html.dark .recharge-panel__summary span,
html.dark .recharge-field label,
html.dark .recharge-order-box__head span,
html.dark .recharge-qrcode p {
  color: rgb(148 163 184);
}

html.dark .recharge-gift-tip {
  color: rgb(253 164 175);
  background: rgb(76 5 25 / 45%);
  border-color: rgb(244 63 94 / 35%);
}

html.dark .recharge-gift-tip strong,
html.dark .recharge-gift-tip svg {
  color: rgb(251 113 133);
}

html.dark .user-asset-value {
  color: rgb(248 250 252);
}

html.dark .user-quick-action,
html.dark .user-metric-card,
html.dark .user-call-trend-card,
html.dark .user-notice-card {
  box-shadow: none;
}

html.dark .user-quick-action {
  background:
    linear-gradient(135deg, rgb(15 23 42 / 76%), rgb(15 23 42 / 52%)),
    hsl(var(--background));
}

html.dark .user-quick-action__icon {
  background: color-mix(in srgb, var(--user-action-accent) 16%, rgb(15 23 42));
}

html.dark .admin-metric-card,
html.dark .admin-panel,
html.dark .admin-user,
html.dark .admin-quick,
html.dark .admin-table__row {
  box-shadow: none;
}

html.dark .admin-metric-card__title,
html.dark .admin-metric-card__meta,
html.dark .admin-panel__head p,
html.dark .admin-table__row--head,
html.dark .admin-table__main small,
html.dark .admin-alert__body small,
html.dark .admin-user__main small,
html.dark .admin-empty,
html.dark .admin-health-legend > div,
html.dark .admin-health-figure__label,
html.dark .admin-health-figure__slo,
html.dark .admin-health-worst__label,
html.dark .admin-health-worst__item small,
html.dark .admin-health-worst__empty,
html.dark .admin-alert-empty p {
  color: rgb(148 163 184);
}

html.dark .admin-overview-head p {
  color: rgb(148 163 184);
}

html.dark .admin-module-error {
  color: rgb(254 202 202);
  background: rgb(127 29 29 / 28%);
  border-color: rgb(248 113 113 / 28%);
}

html.dark .admin-module-error[data-state='degraded'] {
  color: #fbbf24;
  background: rgb(120 53 15 / 26%);
  border-color: rgb(251 191 36 / 24%);
}

html.dark .admin-health-pill[data-state='healthy'] {
  color: #4ade80;
  background: rgb(22 163 74 / 16%);
  border-color: rgb(74 222 128 / 24%);
}

html.dark .admin-health-pill[data-state='info'] {
  color: #93c5fd;
  background: rgb(37 99 235 / 18%);
  border-color: rgb(96 165 250 / 26%);
}

html.dark .admin-health-pill[data-state='warning'] {
  color: #fbbf24;
  background: rgb(245 158 11 / 16%);
  border-color: rgb(251 191 36 / 26%);
}

html.dark .admin-health-pill[data-state='danger'] {
  color: #fca5a5;
  background: rgb(239 68 68 / 18%);
  border-color: rgb(248 113 113 / 28%);
}

html.dark .admin-alert-summary__chip[data-level='danger'] {
  color: #fca5a5;
  background: rgb(239 68 68 / 14%);
}

html.dark .admin-alert-summary__chip[data-level='warning'] {
  color: #fbbf24;
  background: rgb(245 158 11 / 14%);
}

html.dark .admin-alert-summary__chip[data-level='info'] {
  color: #93c5fd;
  background: rgb(37 99 235 / 16%);
}

html.dark .admin-alert[data-level='danger'] {
  --alert-color: #f87171;
  --alert-soft: rgb(248 113 113 / 12%);
}

html.dark .admin-alert[data-level='warning'] {
  --alert-color: #fbbf24;
  --alert-soft: rgb(251 191 36 / 12%);
}

html.dark .admin-alert[data-level='info'] {
  --alert-color: #60a5fa;
  --alert-soft: rgb(96 165 250 / 12%);
}

html.dark .admin-alert[data-level='success'] {
  --alert-color: #4ade80;
  --alert-soft: rgb(74 222 128 / 12%);
}

html.dark .admin-alert-empty__icon {
  color: #4ade80;
  background: rgb(22 163 74 / 14%);
}

html.dark .admin-health-figure strong[data-state='danger'] {
  color: #f87171;
}

html.dark .admin-health-figure strong[data-state='warning'] {
  color: #fbbf24;
}

@media (max-width: 1280px) {
  .admin-metric-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .admin-quick-grid--compact {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 1024px) {
  .admin-command-grid,
  .admin-grid,
  .admin-trend-grid,
  .admin-support-grid {
    grid-template-columns: 1fr;
  }

  .user-quick-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .user-asset-summary {
    grid-template-columns: minmax(230px, 1.2fr) repeat(2, minmax(132px, 0.9fr));
    width: 100%;
  }
}

@media (max-width: 768px) {
  .package-detail-section__head {
    flex-direction: column;
    align-items: flex-start;
  }

  .admin-overview-head {
    flex-direction: column;
    gap: 16px;
  }

  .admin-overview-actions {
    justify-content: flex-start;
  }

  .admin-panel__head {
    flex-direction: column;
    align-items: flex-start;
  }

  .admin-metric-grid,
  .admin-quick-grid--compact {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 380px) {
  .admin-metric-grid,
  .admin-quick-grid--compact {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .bind-email-warning {
    flex-direction: column;
    align-items: stretch;
  }

  .bind-email-warning :deep(.ant-btn) {
    width: fit-content;
  }

  .admin-metric-grid,
  .admin-quick-grid--compact {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .admin-metric-card,
  .admin-metric-card[data-rank='secondary'] {
    min-height: 108px;
  }

  .admin-chart {
    height: 240px;
  }

  .admin-table__row {
    grid-template-columns: 1fr 1fr;
  }

  .admin-table__row--head {
    display: none;
  }

  .admin-table__row span:not(.admin-table__main) {
    font-size: 12px;
  }

  .admin-alert {
    grid-template-columns: 36px minmax(0, 1fr);
    padding: 12px;
  }

  .admin-alert__icon {
    width: 36px;
    height: 36px;
    font-size: 17px;
  }

  .admin-alert__cta {
    display: none;
  }

  .admin-alert-list {
    padding: 8px;
  }

  .admin-overview-head h2 {
    font-size: 24px;
  }

  .user-quick-actions {
    grid-template-columns: 1fr;
  }

  .user-quick-action {
    min-height: 82px;
  }

  .user-asset-summary {
    grid-template-columns: 1fr;
  }

  .user-asset-item {
    justify-content: space-between;
  }

  .user-call-trend-head {
    flex-direction: column;
  }

  .user-call-trend-tabs {
    width: 100%;
  }

  .user-call-trend-tab {
    flex: 1 1 0;
  }

  .package-detail-stats {
    grid-template-columns: 1fr;
  }

  .recharge-methods {
    grid-template-columns: 1fr;
  }
}

/* ---------- 控制台视觉迁移（console-preview.html）----------
   卡片圆角已在各原规则处对齐设计稿（容器 12px、小控件 9px）。
   这里补齐展示型卡片的悬浮反馈，维持全站两档语义：
   可交互 KPI 卡 = 上移 2px + 品牌描边；展示型面板 = 只提亮描边，
   不做位移——面板内含表格/列表，位移会带动阅读位置跳动。 */
.user-metric-card,
.admin-metric-card {
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.user-metric-card:hover,
.admin-metric-card:hover {
  border-color: hsl(var(--primary) / 36%);
  box-shadow: 0 8px 20px rgb(15 23 42 / 7%);
  transform: translateY(-1px);
}

.user-asset-item,
.user-call-trend-card {
  transition: border-color 0.18s ease;
}

.user-asset-item:hover,
.user-call-trend-card:hover {
  border-color: hsl(var(--foreground) / 22%);
}

@media (prefers-reduced-motion: reduce) {
  .user-metric-card:hover,
  .admin-metric-card:hover {
    transform: none;
  }

  .admin-alert {
    animation: none;
  }
}
</style>
