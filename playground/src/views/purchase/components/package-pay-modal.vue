<script lang="ts" setup>
import type {
  InterfacePackageStats,
  UserWorkbenchStats,
} from '#/api/core/user';
import type { RechargeApi } from '#/api/payment';

import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import { IconifyIcon } from '@vben/icons';
import { preferences } from '@vben/preferences';

import {
  Button,
  message,
  Modal,
  QRCode,
  Radio,
  RadioGroup,
  Spin,
  Tag,
} from 'ant-design-vue';

import { getUserWorkbenchStatsApi } from '#/api/core/user';
import {
  continuePaymentOrder,
  createGlobalPackagePaymentOrder,
  createInterfacePackagePaymentOrder,
  createPointPackagePaymentOrder,
  findPendingPaymentOrder,
  getRechargeCapabilities,
  syncRechargeOrder,
} from '#/api/payment';
import {
  enabledOnlinePaymentMethods,
  supportsPayProductSelection,
} from '#/api/payment-routing';
import { QR_LOCKED_PLACEHOLDER } from '#/components/payment-agreement/content';
import PaymentAgreementConsent from '#/components/payment-agreement/PaymentAgreementConsent.vue';
import PaymentQrShield from '#/components/payment-agreement/PaymentQrShield.vue';
import {
  refreshSettlementCurrency,
  useSettlementCurrency,
} from '#/composables/use-settlement-currency';
import { useSiteLogo } from '#/composables/use-site-logo';
import { $t } from '#/locales';
import { submitAlipayForm } from '#/utils/alipay-form';
import { preopenDetachedWindow } from '#/utils/safe-window';

type PackagePayType = 'GLOBAL' | 'INTERFACE' | 'POINT';

interface PackagePayTarget {
  description?: string;
  id: string;
  interfaceId?: string;
  price: number | string;
  specId?: string;
  subtitle?: string;
  title: string;
  type: PackagePayType;
}

const emit = defineEmits<{ success: [] }>();

const router = useRouter();
const { logoFailed, logoUrl } = useSiteLogo();

const visible = ref(false);
const loading = ref(false);
const syncLoading = ref(false);
const paid = ref(false);
const target = ref<PackagePayTarget>();
const balance = ref<number | string>(0);
const workbenchStats = ref<null | UserWorkbenchStats>(null);
const capabilities = ref<null | RechargeApi.Capabilities>(null);
const payChannel = ref<RechargeApi.PayChannel>('BALANCE');
const preferredProduct = ref<RechargeApi.PayProduct>('AUTO');
const order = ref<null | RechargeApi.PackagePaymentOrder>(null);
const pendingExisting = ref<null | RechargeApi.PackagePaymentOrder>(null);
const countdownSeconds = ref(0);
const expired = ref(false);
// 支付协议勾选状态：只有勾选后二维码才可扫（未勾选时码虚化 + 锁层）
const agreementAccepted = ref(false);
const consentRef = ref<HTMLElement>();
let countdownTimer: number | undefined;
let orderTimer: number | undefined;

const countdownText = computed(() => {
  const seconds = Math.max(countdownSeconds.value, 0);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
});

const clientType = computed<RechargeApi.ClientType>(() =>
  isMobileDevice() ? 'MOBILE' : 'DESKTOP',
);

const amount = computed(() => parseMoneyNumber(target.value?.price));

const balanceEnough = computed(() => {
  const userBalance = parseMoneyNumber(balance.value);
  return Number.isFinite(userBalance) && userBalance >= amount.value;
});

const currentInterfacePackage = computed<InterfacePackageStats | undefined>(
  () => {
    const item = target.value;
    if (item?.type !== 'INTERFACE' || !item.interfaceId) {
      return undefined;
    }
    return workbenchStats.value?.interfacePackages?.find(
      (pkg) => String(pkg.interfaceId) === String(item.interfaceId),
    );
  },
);

const purchaseEffect = computed(() => {
  const item = target.value;
  if (!item) {
    return null;
  }
  if (item.type === 'GLOBAL') {
    const current = workbenchStats.value?.memberPackage;
    if (current?.packageId) {
      if (String(current.packageId) === String(item.id)) {
        return {
          description: current.expireTime
            ? $t('page.purchase.packagePay.effects.globalRenewWithExpire', [
                current.expireTime,
              ])
            : $t('page.purchase.packagePay.effects.globalRenewNoExpire'),
          icon: 'lucide:calendar-plus',
          tone: 'info',
          title: $t('page.purchase.packagePay.effects.sameSpecRenew'),
        };
      }
      return {
        description: $t('page.purchase.packagePay.effects.replaceGlobalDesc'),
        icon: 'lucide:refresh-cw',
        tone: 'danger',
        title: $t('page.purchase.packagePay.effects.replaceGlobal'),
      };
    }
  }
  if (item.type === 'INTERFACE') {
    const current = currentInterfacePackage.value;
    if (current?.specId) {
      if (String(current.specId) === String(item.specId)) {
        return {
          description: current.expireTime
            ? $t('page.purchase.packagePay.effects.interfaceRenewWithExpire', [
                current.expireTime,
              ])
            : $t('page.purchase.packagePay.effects.interfaceRenewNoExpire'),
          icon: 'lucide:calendar-plus',
          tone: 'info',
          title: $t('page.purchase.packagePay.effects.sameSpecRenew'),
        };
      }
      return {
        description: $t(
          'page.purchase.packagePay.effects.replaceInterfaceDesc',
        ),
        icon: 'lucide:refresh-cw',
        tone: 'danger',
        title: $t('page.purchase.packagePay.effects.replaceInterface'),
      };
    }
  }
  if (item.type === 'POINT') {
    return {
      description: $t('page.purchase.packagePay.effects.pointsArriveDesc'),
      icon: 'lucide:coins',
      tone: 'info',
      title: $t('page.purchase.packagePay.effects.pointsArrive'),
    };
  }
  return {
    description: $t('page.purchase.packagePay.effects.activeImmediatelyDesc'),
    icon: 'lucide:circle-check',
    tone: 'info',
    title: $t('page.purchase.packagePay.effects.activeImmediately'),
  };
});

const alipayUsable = computed(() => {
  const item = capabilities.value;
  return (
    !!item?.alipayEnabled &&
    (item.websitePayEnabled || item.wapPayEnabled || item.facePayEnabled)
  );
});

// 链上充值只用于余额充值（后端套餐下单会拒绝），不能在套餐支付里出现。
const PACKAGE_UNSUPPORTED_CHANNELS = new Set<string>(['TRC20', 'BEP20']);

const enabledMethods = computed(() => {
  const configured = capabilities.value?.methods;
  const methods = Array.isArray(configured)
    ? configured.filter((method) => method.enabled)
    : [
        { code: 'BALANCE' as const, enabled: true, sortOrder: 10 },
        ...(alipayUsable.value
          ? [{ code: 'ALIPAY' as const, enabled: true, sortOrder: 20 }]
          : []),
      ];
  return methods.filter(
    (method) => !PACKAGE_UNSUPPORTED_CHANNELS.has(method.code),
  );
});

const onlineMethods = computed(() =>
  enabledOnlinePaymentMethods(enabledMethods.value),
);

const onlinePayUsable = computed(() => onlineMethods.value.length > 0);

const channelOptions = computed(() => {
  const methods = enabledMethods.value.length
    ? enabledMethods.value
    : [
        { code: 'BALANCE' as const, enabled: true, sortOrder: 10 },
        ...(alipayUsable.value
          ? [{ code: 'ALIPAY' as const, enabled: true, sortOrder: 20 }]
          : []),
      ];
  return methods.map((method) => ({
    ...method,
    description:
      method.code === 'BALANCE'
        ? balanceEnough.value || amount.value <= 0
          ? $t('page.purchase.packagePay.pay.balanceDesc')
          : onlinePayUsable.value
            ? $t('page.purchase.packagePay.pay.balanceLowWithOnline')
            : $t('page.purchase.packagePay.pay.balanceLow')
        : paymentChannelDescription(method.code),
    icon: paymentChannelIcon(method.code),
    label: paymentChannelLabel(method.code),
  }));
});

const productSelectionVisible = computed(() =>
  payChannel.value === 'BALANCE'
    ? false
    : supportsPayProductSelection(payChannel.value),
);

const defaultProduct = computed<Exclude<RechargeApi.PayProduct, 'AUTO'>>(() => {
  const item = capabilities.value;
  if (!item) {
    return 'PAGE';
  }
  return clientType.value === 'MOBILE'
    ? item.mobileDefault
    : item.desktopDefault;
});

const productOptions = computed(() => {
  const item = capabilities.value;
  if (!item) {
    return [];
  }
  const options: Array<{ label: string; value: RechargeApi.PayProduct }> = [
    {
      label: $t('page.purchase.packagePay.pay.autoSelect', [
        payProductLabel(defaultProduct.value),
      ]),
      value: 'AUTO',
    },
  ];
  if (
    item.websitePayEnabled &&
    payChannel.value !== 'WECHAT' &&
    payChannel.value !== 'HUPIJIAO_WECHAT'
  ) {
    options.push({
      label: $t('page.purchase.packagePay.pay.websitePay'),
      value: 'PAGE',
    });
  }
  if (item.wapPayEnabled) {
    options.push({
      label: $t('page.purchase.packagePay.pay.wapPay'),
      value: 'WAP',
    });
  }
  if (
    item.facePayEnabled &&
    payChannel.value !== 'WECHAT' &&
    payChannel.value !== 'HUPIJIAO_WECHAT'
  ) {
    options.push({
      label: $t('page.purchase.packagePay.pay.facePay'),
      value: 'FACE',
    });
  }
  return options;
});

const submitDisabled = computed(() => {
  if (!target.value || loading.value) {
    return true;
  }
  if (payChannel.value === 'BALANCE') {
    // 余额支付直接扣款、没有二维码环节，所以协议同意必须前置拦住按钮；
    // 在线支付则由二维码锁层承担，不阻断下单（否则订单不生成，码也出不来）。
    if (!agreementAccepted.value) {
      return true;
    }
    return amount.value > 0 && !balanceEnough.value;
  }
  return (
    amount.value < 0.01 ||
    !enabledMethods.value.some((method) => method.code === payChannel.value)
  );
});

const submitText = computed(() => {
  if (payChannel.value === 'BALANCE') {
    return amount.value <= 0
      ? $t('page.purchase.packagePay.actions.openFree')
      : $t('page.purchase.packagePay.actions.confirmBuy');
  }
  return $t('page.purchase.packagePay.actions.goPay');
});

// 基数金额（套餐价/余额，人民币口径）按站点货币展示；USD 时按汇率换算。
// 配置了货币展示名称时改用「金额 名称」，支付实付金额仍用真实货币符号。
const { priceText: formatPrice, symbol } = useSettlementCurrency();

function moneyText(value?: number | string) {
  return formatPrice(parseMoneyNumber(value), 4);
}

// 订单实付金额（payAmount）后端下单时已按站点货币换算过，展示不再二次换算。
function payAmountText(value?: number | string) {
  const price = parseMoneyNumber(value);
  if (!Number.isFinite(price)) {
    return `${symbol.value}0.00`;
  }
  return `${symbol.value}${price.toLocaleString('zh-CN', {
    maximumFractionDigits: 4,
    minimumFractionDigits: 2,
  })}`;
}

function parseMoneyNumber(value?: number | string) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  const text = String(value ?? '')
    .replace(/[¥￥$＄,\s]/g, '')
    .trim();
  if (!text) {
    return 0;
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function priceText(value?: number | string) {
  return parseMoneyNumber(value) === 0
    ? $t('system.package.free')
    : moneyText(value);
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
    return $t('page.purchase.packagePay.status.paid');
  }
  if (status === 'FAILED') {
    return $t('page.purchase.packagePay.status.failed');
  }
  if (status === 'CLOSED') {
    return $t('page.purchase.packagePay.status.closed');
  }
  if (status === 'EXPIRED') {
    return $t('page.purchase.packagePay.status.expired');
  }
  return $t('page.purchase.packagePay.status.pending');
}

function packageTypeLabel(type?: PackagePayType) {
  if (type === 'GLOBAL') {
    return $t('page.purchase.packagePay.packageTypes.global');
  }
  if (type === 'INTERFACE') {
    return $t('page.purchase.packagePay.packageTypes.interface');
  }
  return $t('page.purchase.packagePay.packageTypes.point');
}

function payProductLabel(value?: string) {
  if (value === 'PAGE') {
    return $t('page.purchase.packagePay.pay.websitePay');
  }
  if (value === 'WAP') {
    return $t('page.purchase.packagePay.pay.wapPay');
  }
  if (value === 'FACE') {
    return $t('page.purchase.packagePay.pay.facePay');
  }
  return $t('page.purchase.packagePay.pay.alipay');
}

function paymentChannelLabel(channel: RechargeApi.PayChannel) {
  if (channel === 'BALANCE') {
    return $t('page.purchase.packagePay.pay.balance');
  }
  if (channel === 'WECHAT') {
    return $t('page.purchase.packagePay.pay.wechat');
  }
  if (channel === 'HUPIJIAO_ALIPAY') {
    return $t('page.purchase.packagePay.pay.hupijiaoAlipay');
  }
  if (channel === 'HUPIJIAO_WECHAT') {
    return $t('page.purchase.packagePay.pay.hupijiaoWechat');
  }
  return $t('page.purchase.packagePay.pay.alipay');
}

function paymentChannelDescription(channel: RechargeApi.PayChannel) {
  if (channel === 'WECHAT') {
    return $t('page.purchase.packagePay.pay.wechatDesc');
  }
  if (channel === 'HUPIJIAO_ALIPAY') {
    return $t('page.purchase.packagePay.pay.hupijiaoAlipayDesc');
  }
  if (channel === 'HUPIJIAO_WECHAT') {
    return $t('page.purchase.packagePay.pay.hupijiaoWechatDesc');
  }
  return $t('page.purchase.packagePay.pay.alipayDesc');
}

function paymentChannelIcon(channel: RechargeApi.PayChannel) {
  if (channel === 'BALANCE') return 'lucide:wallet-cards';
  if (channel === 'WECHAT' || channel === 'HUPIJIAO_WECHAT') {
    return 'lucide:message-circle';
  }
  return 'lucide:scan-line';
}

function isMobileDevice() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  return /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(
    navigator.userAgent || '',
  );
}

async function open(item: PackagePayTarget) {
  target.value = item;
  order.value = null;
  pendingExisting.value = null;
  workbenchStats.value = null;
  paid.value = false;
  expired.value = false;
  // 每次打开支付弹窗都回到「未同意」状态：协议同意应当逐次取得，
  // 不能因为上一单勾过就默认这一单也已同意
  agreementAccepted.value = false;
  visible.value = true;
  payChannel.value = 'BALANCE';
  preferredProduct.value = 'AUTO';
  stopPolling();
  stopCountdown();
  await loadPaymentContext();
}

async function loadPaymentContext() {
  loading.value = true;
  try {
    const stats = await getUserWorkbenchStatsApi();
    workbenchStats.value = stats;
    balance.value = stats.balance;
    try {
      capabilities.value = await getRechargeCapabilities();
    } catch {
      capabilities.value = null;
    }
    if (amount.value > 0 && !balanceEnough.value && onlinePayUsable.value) {
      payChannel.value = onlineMethods.value[0]?.code ?? 'BALANCE';
    }
  } finally {
    loading.value = false;
  }
}

function stopPolling() {
  if (orderTimer) {
    window.clearInterval(orderTimer);
    orderTimer = undefined;
  }
}

function stopCountdown() {
  if (countdownTimer) {
    window.clearInterval(countdownTimer);
    countdownTimer = undefined;
  }
}

function remainingSecondsOf(item: RechargeApi.PackagePaymentOrder) {
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

function startCountdown(item: RechargeApi.PackagePaymentOrder) {
  stopCountdown();
  expired.value = false;
  countdownSeconds.value = remainingSecondsOf(item);
  if (countdownSeconds.value <= 0 && item.orderNo) {
    expired.value = true;
    return;
  }
  countdownTimer = window.setInterval(() => {
    countdownSeconds.value = Math.max(countdownSeconds.value - 1, 0);
    if (countdownSeconds.value === 0) {
      stopCountdown();
      expired.value = true;
      stopPolling();
      if (order.value?.orderNo === item.orderNo) {
        order.value.status = 'EXPIRED';
      }
    }
  }, 1000);
}

function closeModal() {
  visible.value = false;
  stopPolling();
  stopCountdown();
}

function goRecharge() {
  closeModal();
  void router.push({
    path: preferences.app.defaultHomePath || '/console/workspace',
    query: { recharge: '1' },
  });
}

/**
 * 点二维码上的锁层：把视线带到勾选行，而不是只弹一句 toast。
 * 弹窗内容本身可滚动，滚到勾选区比干巴巴提示更容易让人知道该点哪。
 */
function focusAgreement() {
  const element = consentRef.value;
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.classList.add('is-nudged');
    window.setTimeout(() => element.classList.remove('is-nudged'), 900);
  }
  message.info($t('paymentAgreement.consentRequired'));
}

function expectedPayProduct(): RechargeApi.PayProduct {
  return preferredProduct.value === 'AUTO'
    ? defaultProduct.value
    : preferredProduct.value;
}

function shouldPreopenPaymentWindow() {
  return (
    payChannel.value === 'ALIPAY' &&
    clientType.value === 'DESKTOP' &&
    expectedPayProduct() !== 'FACE'
  );
}

function openAlipayPayment(
  payOrder: RechargeApi.PackagePaymentOrder,
  paymentWindow: null | Window,
) {
  if (payOrder.qrCode) {
    paymentWindow?.close();
    return;
  }
  if (clientType.value === 'MOBILE') {
    paymentWindow?.close();
    if (!submitAlipayForm(payOrder, '_self')) {
      message.error($t('page.purchase.packagePay.messages.invalidPayload'));
    }
    return;
  }
  if (paymentWindow && payOrder.formParams) {
    const targetName = `alipay_${payOrder.orderNo}`;
    paymentWindow.name = targetName;
    if (!submitAlipayForm(payOrder, targetName)) {
      paymentWindow.close();
      message.error($t('page.purchase.packagePay.messages.invalidPayload'));
    }
    return;
  }
  if (!submitAlipayForm(payOrder, '_self')) {
    message.error($t('page.purchase.packagePay.messages.invalidPayload'));
  }
}

function startPolling(orderNo: string) {
  stopPolling();
  orderTimer = window.setInterval(() => {
    void syncCurrentOrder(orderNo, false);
  }, 3000);
}

async function syncCurrentOrder(orderNo?: string, showPendingMessage = true) {
  const currentOrderNo = orderNo ?? order.value?.orderNo;
  if (!currentOrderNo || syncLoading.value) {
    return;
  }
  syncLoading.value = true;
  try {
    const latest = await syncRechargeOrder(currentOrderNo);
    order.value = {
      ...order.value,
      ...latest,
    } as RechargeApi.PackagePaymentOrder;
    if (latest.status === 'PAID') {
      stopPolling();
      paid.value = true;
      message.success($t('page.purchase.packagePay.messages.success'));
      emit('success');
      // 留出时间展示商户图标的支付成功态，避免「刚扫完码弹窗直接消失」的困惑
      window.setTimeout(() => closeModal(), 2600);
      return;
    }
    if (latest.status === 'CLOSED' || latest.status === 'FAILED') {
      stopPolling();
      stopCountdown();
      message.warning($t('page.purchase.packagePay.messages.incomplete'));
      return;
    }
    if (latest.status === 'EXPIRED') {
      stopPolling();
      stopCountdown();
      expired.value = true;
      message.warning($t('page.purchase.packagePay.messages.expired'));
      return;
    }
    if (latest.status === 'CREATED' || latest.status === 'PAYING') {
      startCountdown(latest);
    }
    if (showPendingMessage) {
      message.info($t('page.purchase.packagePay.messages.pending'));
    }
  } finally {
    syncLoading.value = false;
  }
}

async function createPackageOrder(forceNew = false) {
  if (!target.value) {
    return;
  }
  // 汇率是动态配置的：下单前拉一次最新值，避免页面停留过久后
  // 展示价与后端按新汇率生成的实付金额不一致。
  await refreshSettlementCurrency();
  const payload: RechargeApi.PackageOrderPayload = {
    clientType: clientType.value,
    forceNew,
    payChannel: payChannel.value,
    preferredProduct: preferredProduct.value,
    specId: target.value.specId,
  };
  if (target.value.type === 'GLOBAL') {
    return await createGlobalPackagePaymentOrder(target.value.id, payload);
  }
  if (target.value.type === 'INTERFACE') {
    return await createInterfacePackagePaymentOrder(target.value.id, payload);
  }
  return await createPointPackagePaymentOrder(target.value.id, payload);
}

function pendingQuery() {
  const item = target.value;
  if (!item) {
    return null;
  }
  const orderType: RechargeApi.PendingOrderType =
    item.type === 'GLOBAL'
      ? 'GLOBAL_PACKAGE'
      : item.type === 'INTERFACE'
        ? 'INTERFACE_PACKAGE'
        : 'POINT_PACKAGE';
  return {
    orderType,
    targetId: item.type === 'INTERFACE' ? (item.specId || item.id) : item.id,
  };
}

function shouldPreopenFor(payOrder: RechargeApi.PackagePaymentOrder) {
  return (
    payOrder.payChannel === 'ALIPAY' &&
    clientType.value === 'DESKTOP' &&
    payOrder.payProduct !== 'FACE'
  );
}

async function applyPayOrder(
  payOrder: RechargeApi.PackagePaymentOrder,
  paymentWindow: null | Window,
) {
  order.value = payOrder;
  pendingExisting.value = null;
  expired.value = false;
  startCountdown(payOrder);
  if (payOrder.status === 'PAID') {
    paymentWindow?.close();
    message.success($t('page.purchase.packagePay.messages.success'));
    emit('success');
    await loadPaymentContext();
    closeModal();
    return;
  }
  const hasAlipayPayload =
    Boolean(payOrder.qrCode) ||
    (payOrder.formParams &&
      Object.keys(payOrder.formParams).length > 0);
  if (payOrder.payChannel === 'ALIPAY' && hasAlipayPayload) {
    openAlipayPayment(payOrder, paymentWindow);
  } else if (payOrder.qrCode && clientType.value === 'DESKTOP') {
    // 桌面端：虎皮椒/微信扫码支付直接在弹窗内嵌二维码，不跳转第三方收银台。
    paymentWindow?.close();
  } else if (payOrder.paymentUrl) {
    paymentWindow?.close();
    window.location.assign(payOrder.paymentUrl);
  } else {
    paymentWindow?.close();
  }
  if (payOrder.payProduct === 'FACE' || payOrder.payProduct === 'NATIVE') {
    message.success($t('page.purchase.packagePay.messages.scanPay'));
  } else if (payOrder.payProduct === 'WAP' && clientType.value === 'MOBILE') {
    message.success($t('page.purchase.packagePay.messages.redirecting'));
  } else if (hasAlipayPayload || payOrder.qrCode || payOrder.paymentUrl) {
    message.success($t('page.purchase.packagePay.messages.opened'));
  }
  startPolling(payOrder.orderNo);
}

async function proceedCreateOrder(forceNew: boolean) {
  let paymentWindow: null | Window = null;
  if (shouldPreopenPaymentWindow()) {
    paymentWindow = preopenDetachedWindow();
  }
  try {
    const payOrder = await createPackageOrder(forceNew);
    if (!payOrder) {
      paymentWindow?.close();
      return;
    }
    await applyPayOrder(payOrder, paymentWindow);
  } catch (error) {
    paymentWindow?.close();
    throw error;
  }
}

async function submitOrder() {
  if (submitDisabled.value) {
    return;
  }
  loading.value = true;
  try {
    const query = pendingQuery();
    if (query) {
      const existing = await findPendingPaymentOrder(query);
      if (existing) {
        pendingExisting.value = existing;
        return;
      }
    }
    await proceedCreateOrder(false);
  } catch {
    // 错误提示由请求层统一展示
  } finally {
    loading.value = false;
  }
}

async function continueExistingOrder() {
  const existing = pendingExisting.value;
  if (!existing) {
    return;
  }
  loading.value = true;
  try {
    const payOrder = await continuePaymentOrder(existing.orderNo);
    const paymentWindow = shouldPreopenFor(payOrder)
      ? preopenDetachedWindow()
      : null;
    await applyPayOrder(payOrder, paymentWindow);
  } catch {
    pendingExisting.value = null;
  } finally {
    loading.value = false;
  }
}

async function createNewOrder() {
  pendingExisting.value = null;
  loading.value = true;
  try {
    await proceedCreateOrder(true);
  } catch {
    // 错误提示由请求层统一展示
  } finally {
    loading.value = false;
  }
}

defineExpose({ open });
</script>

<template>
  <Modal
    v-model:open="visible"
    :footer="null"
    :mask-closable="!loading"
    destroy-on-close
    :title="$t('page.purchase.packagePay.title')"
    width="560px"
    @cancel="closeModal"
  >
    <Spin :spinning="loading && !order">
      <div v-if="target" class="package-pay">
        <div class="package-pay__summary">
          <div class="package-pay__icon">
            <IconifyIcon
              class="size-6"
              :icon="
                target.type === 'GLOBAL'
                  ? 'lucide:globe-2'
                  : target.type === 'INTERFACE'
                    ? 'lucide:package-open'
                    : 'lucide:coins'
              "
            />
          </div>
          <div class="package-pay__main">
            <Tag color="blue">{{ packageTypeLabel(target.type) }}</Tag>
            <h3>{{ target.title }}</h3>
            <p>
              {{
                target.subtitle ||
                target.description ||
                $t('page.purchase.packagePay.fallbackEffect')
              }}
            </p>
          </div>
          <strong>{{ priceText(target.price) }}</strong>
        </div>

        <div
          v-if="purchaseEffect"
          class="package-pay__effect"
          :class="`is-${purchaseEffect.tone}`"
        >
          <IconifyIcon class="size-5" :icon="purchaseEffect.icon" />
          <div>
            <strong>{{ purchaseEffect.title }}</strong>
            <p>{{ purchaseEffect.description }}</p>
          </div>
        </div>

        <div class="package-pay__section">
          <div class="package-pay__section-head">
            <span>{{ $t('page.purchase.packagePay.pay.method') }}</span>
            <em>
              {{ $t('page.purchase.packagePay.pay.currentBalance') }}
              {{ moneyText(balance) }}
              <template v-if="amount > 0 && !balanceEnough">
                {{ $t('page.purchase.packagePay.pay.insufficientSuffix') }}
              </template>
            </em>
          </div>
          <RadioGroup
            v-model:value="payChannel"
            class="package-pay__channels"
            :class="{ 'is-single': channelOptions.length === 1 }"
          >
            <Radio
              v-for="method in channelOptions"
              :key="method.code"
              class="package-pay__channel"
              :disabled="method.code !== 'BALANCE' && amount < 0.01"
              :value="method.code"
            >
              <div class="package-pay__channel-title">
                <IconifyIcon class="size-5" :icon="method.icon" />
                <span>{{ method.label }}</span>
              </div>
              <p>{{ method.description }}</p>
            </Radio>
          </RadioGroup>
          <div
            v-if="payChannel === 'BALANCE' && amount > 0 && !balanceEnough"
            class="package-pay__recharge-tip"
          >
            <span>{{ $t('page.purchase.packagePay.pay.balanceLow') }}</span>
            <Button size="small" type="link" @click="goRecharge">
              {{ $t('page.purchase.packagePay.pay.goRecharge') }}
            </Button>
          </div>
        </div>

        <div v-if="productSelectionVisible" class="package-pay__section">
          <div class="package-pay__section-head">
            <span>{{ $t('page.purchase.packagePay.pay.alipayMethod') }}</span>
            <em>{{
              clientType === 'MOBILE'
                ? $t('page.purchase.packagePay.pay.mobileDetected')
                : $t('page.purchase.packagePay.pay.desktopDetected')
            }}</em>
          </div>
          <RadioGroup
            v-model:value="preferredProduct"
            class="package-pay__products"
          >
            <Radio
              v-for="item in productOptions"
              :key="item.value"
              :value="item.value"
            >
              {{ item.label }}
            </Radio>
          </RadioGroup>
          <div v-if="capabilities" class="package-pay__tags">
            <Tag v-if="capabilities.websitePayEnabled" color="processing">
              {{ $t('page.purchase.packagePay.pay.websitePay') }}
            </Tag>
            <Tag v-if="capabilities.wapPayEnabled" color="success">
              {{ $t('page.purchase.packagePay.pay.wapPay') }}
            </Tag>
            <Tag v-if="capabilities.facePayEnabled" color="warning">
              {{ $t('page.purchase.packagePay.pay.facePay') }}
            </Tag>
          </div>
        </div>

        <div v-if="pendingExisting" class="package-pay__pending">
          <div class="package-pay__pending-head">
            <strong>{{ $t('page.purchase.packagePay.pending.title') }}</strong>
            <span>{{ pendingExisting.orderNo }}</span>
          </div>
          <p>
            {{
              $t('page.purchase.packagePay.pending.description', [
                payAmountText(pendingExisting.payAmount),
                pendingExisting.expireTime || '-',
              ])
            }}
          </p>
          <div class="package-pay__pending-actions">
            <Button :disabled="loading" @click="createNewOrder">
              {{ $t('page.purchase.packagePay.pending.createNew') }}
            </Button>
            <Button
              type="primary"
              :loading="loading"
              @click="continueExistingOrder"
            >
              {{ $t('page.purchase.packagePay.pending.continueOld') }}
            </Button>
          </div>
        </div>

          <div v-if="order" class="package-pay__order">
            <div class="package-pay__order-head">
              <div>
                <span>{{ $t('page.purchase.packagePay.order.orderNo') }}</span>
                <strong>{{ order.orderNo }}</strong>
              </div>
              <Tag :color="paymentStatusColor(order.status)">
                {{ paymentStatusText(order.status) }}
              </Tag>
            </div>
            <div
              v-if="order.status !== 'PAID'"
              class="package-pay__countdown"
              :class="{ 'is-expired': expired || order.status === 'EXPIRED' }"
            >
              <IconifyIcon
                :icon="
                  expired || order.status === 'EXPIRED'
                    ? 'lucide:clock-alert'
                    : 'lucide:clock'
                "
              />
              <span v-if="expired || order.status === 'EXPIRED'">
                {{ $t('page.purchase.packagePay.order.expiredTip') }}
              </span>
              <span v-else>
                {{ $t('page.purchase.packagePay.order.remaining') }}
                <strong>{{ countdownText }}</strong>
              </span>
            </div>
            <div v-if="paid" class="package-pay__paid">
              <span class="package-pay__paid-logo">
                <img
                  v-if="logoUrl && !logoFailed"
                  :alt="$t('page.purchase.packagePay.order.paidTitle')"
                  :src="logoUrl"
                  referrerpolicy="no-referrer"
                  @error="logoFailed = true"
                />
                <IconifyIcon v-else icon="lucide:circle-check" />
              </span>
              <div class="package-pay__paid-body">
                <strong>{{ $t('page.purchase.packagePay.order.paidTitle') }}</strong>
                <p>{{ $t('page.purchase.packagePay.order.paidDesc') }}</p>
              </div>
            </div>
            <div
              v-else-if="order.qrCode"
              class="package-pay__qrcode"
            >
              <!-- 未勾选协议时二维码虚化并叠锁层：码依然可见但扫不出 -->
              <PaymentQrShield
                :locked="!agreementAccepted"
                @unlock="focusAgreement"
              >
                <QRCode
                  :bordered="false"
                  error-level="H"
                  :icon="logoUrl || undefined"
                  :icon-size="40"
                  :size="180"
                  :value="agreementAccepted ? order.qrCode : QR_LOCKED_PLACEHOLDER"
                />
              </PaymentQrShield>
              <p>{{ $t('page.purchase.packagePay.order.scanTip') }}</p>
            </div>
            <div
              v-else-if="order.payChannel !== 'BALANCE'"
              class="package-pay__tip"
            >
              {{ $t('page.purchase.packagePay.order.openedTip') }}
            </div>
          </div>

        <div ref="consentRef" class="package-pay__consent">
          <PaymentAgreementConsent v-model:checked="agreementAccepted" />
          <p v-if="!agreementAccepted" class="package-pay__consent-tip">
            {{ $t('paymentAgreement.consentRequired') }}
          </p>
        </div>

        <div class="package-pay__actions">
          <Button @click="closeModal">
            {{ $t('page.purchase.packagePay.actions.cancel') }}
          </Button>
          <Button
            v-if="order && order.payChannel !== 'BALANCE'"
            :loading="syncLoading"
            @click="syncCurrentOrder()"
          >
            {{ $t('page.purchase.packagePay.actions.completed') }}
          </Button>
          <Button
            v-if="!pendingExisting"
            type="primary"
            :disabled="submitDisabled"
            :loading="loading"
            @click="submitOrder"
          >
            {{ submitText }}
          </Button>
        </div>
      </div>
    </Spin>
  </Modal>
</template>

<style scoped>
.package-pay {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.package-pay__summary,
.package-pay__order {
  padding: 14px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.package-pay__summary {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
}

.package-pay__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
  border-radius: 8px;
}

.package-pay__main {
  min-width: 0;
}

.package-pay__main h3 {
  margin: 6px 0 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 18px;
  font-weight: 800;
  line-height: 24px;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.package-pay__main p,
.package-pay__channel p,
.package-pay__tip,
.package-pay__qrcode p,
.package-pay__section-head em,
.package-pay__order-head span {
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  color: rgb(100 116 139);
}

.package-pay__summary > strong {
  font-size: 24px;
  font-weight: 900;
  color: #f45d66;
  white-space: nowrap;
}

.package-pay__effect {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  gap: 10px;
  align-items: flex-start;
  padding: 12px;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 6%);
  border: 1px solid hsl(var(--primary) / 24%);
  border-radius: 8px;
}

.package-pay__effect.is-warning {
  color: #b36b00;
  background: #fff8e8;
  border-color: #f6c56b;
}

.package-pay__effect.is-danger {
  color: #cf1322;
  background: #fff1f0;
  border-color: #ff7875;
}

.package-pay__effect strong {
  display: block;
  font-size: 14px;
  font-weight: 800;
  line-height: 20px;
  color: inherit;
}

.package-pay__effect p {
  margin: 2px 0 0;
  font-size: 13px;
  line-height: 20px;
  color: hsl(var(--foreground) / 72%);
}

.package-pay__section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.package-pay__section-head {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.package-pay__section-head span {
  font-size: 14px;
  font-weight: 800;
  color: hsl(var(--foreground));
}

.package-pay__channels {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.package-pay__channels.is-single {
  grid-template-columns: 1fr;
}

.package-pay__recharge-tip {
  display: flex;
  gap: 4px;
  align-items: center;
  margin-top: 8px;
  font-size: 13px;
  color: rgb(180 83 9);
}

.package-pay__channel {
  display: block;
  height: 100%;
  padding: 12px;
  margin: 0;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease;
}

.package-pay__channel:has(.ant-radio-wrapper-checked),
.package-pay__channel:has(.ant-radio-checked) {
  background: hsl(var(--primary) / 5%);
  border-color: hsl(var(--primary) / 60%);
}

.package-pay__channel-title {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  font-size: 14px;
  font-weight: 800;
  color: hsl(var(--foreground));
}

.package-pay__channel-title :deep(svg) {
  color: hsl(var(--primary));
}

.package-pay__channel p {
  margin-top: 8px;
}

.package-pay__products {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
}

.package-pay__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.package-pay__order-head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
}

.package-pay__order-head strong {
  display: block;
  margin-top: 2px;
  font-size: 13px;
  font-weight: 700;
  line-height: 20px;
  color: hsl(var(--foreground));
  word-break: break-all;
}

.package-pay__pending {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  background: hsl(var(--warning) / 8%);
  border: 1px solid hsl(var(--warning) / 32%);
  border-radius: 8px;
}

.package-pay__pending-head {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.package-pay__pending-head strong {
  font-size: 14px;
  color: hsl(var(--foreground));
}

.package-pay__pending-head span {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  word-break: break-all;
}

.package-pay__pending p {
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  color: hsl(var(--muted-foreground));
}

.package-pay__pending-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.package-pay__countdown {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-top: 10px;
  font-size: 13px;
  color: hsl(var(--warning));
}

.package-pay__countdown strong {
  font-variant-numeric: tabular-nums;
  font-weight: 800;
}

.package-pay__countdown.is-expired {
  color: hsl(var(--destructive));
}

.package-pay__qrcode {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  margin-top: 14px;
}

.package-pay__consent {
  scroll-margin: 24px;
  border-radius: 9px;
  transition: box-shadow 0.3s ease;
}

/* 从二维码锁层跳转过来时闪一下，明确「要动的是这里」 */
.package-pay__consent.is-nudged {
  box-shadow: 0 0 0 3px hsl(var(--primary) / 32%);
}

.package-pay__consent-tip {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 18px;
  color: hsl(var(--warning));
}

/* 支付成功态：商户图标 + 到账说明 */
.package-pay__paid {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-top: 12px;
  padding: 12px 14px;
  background: hsl(var(--success) / 8%);
  border: 1px solid hsl(var(--success) / 28%);
  border-radius: 10px;
}

.package-pay__paid-logo {
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

.package-pay__paid-logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.package-pay__paid-body {
  min-width: 0;
}

.package-pay__paid-body strong {
  display: block;
  font-size: 14px;
  color: hsl(var(--foreground));
}

.package-pay__paid-body p {
  margin: 3px 0 0;
  font-size: 12px;
  line-height: 18px;
  color: hsl(var(--muted-foreground));
}

.package-pay__tip {
  padding: 12px;
  margin-top: 12px;
  background: hsl(var(--primary) / 7%);
  border-radius: 8px;
}

.package-pay__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

html.dark .package-pay__main p,
html.dark .package-pay__channel p,
html.dark .package-pay__tip,
html.dark .package-pay__qrcode p,
html.dark .package-pay__section-head em,
html.dark .package-pay__order-head span {
  color: rgb(148 163 184);
}

@media (max-width: 640px) {
  .package-pay__summary {
    grid-template-columns: 48px minmax(0, 1fr);
  }

  .package-pay__summary > strong {
    grid-column: 1 / -1;
  }

  .package-pay__channels,
  .package-pay__products {
    grid-template-columns: 1fr;
  }
}
</style>
