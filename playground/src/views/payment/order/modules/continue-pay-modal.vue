<script lang="ts" setup>
import type { RechargeApi } from '#/api/payment';
import type { PaymentOrderApi } from '#/api/system/payment';

import { computed, onBeforeUnmount, ref } from 'vue';

import {
  Button,
  Input,
  message,
  Modal,
  QRCode,
  Spin,
  Tag,
} from 'ant-design-vue';

import {
  continuePaymentOrder,
  submitTrc20TxID,
  syncRechargeOrder,
} from '#/api/payment';
import {
  chainDepositNetworkLabel,
  isChainDepositChannel,
} from '#/api/payment-routing';
import { $t } from '#/locales';
import { submitAlipayForm } from '#/utils/alipay-form';

import { formatOrderMoney, statusColor, statusLabel } from '../data';

const emit = defineEmits<{ refresh: [] }>();

const order = ref<null | RechargeApi.PackagePaymentOrder>(null);
const visible = ref(false);
const loading = ref(false);
const paid = ref(false);
const expired = ref(false);
const remaining = ref(0);
const showCountdown = ref(false);
const trc20Txid = ref('');
const trc20Submitting = ref(false);

let autoCloseTimer: number | undefined;
let countdownTimer: number | undefined;
let pollTimer: number | undefined;

const isChainDeposit = computed(() =>
  isChainDepositChannel(order.value?.payChannel),
);
const chainNetwork = computed(() =>
  chainDepositNetworkLabel(order.value?.payChannel),
);
const hasQr = computed(() => Boolean(order.value?.qrCode));
const alipayPayload = computed(() => {
  const current = order.value;
  if (!current) {
    return false;
  }
  return (
    Object.keys(current.formParams ?? {}).length > 0 || Boolean(current.payForm)
  );
});
const countdownText = computed(() => {
  const total = Math.max(0, remaining.value);
  const minutes = String(Math.floor(total / 60)).padStart(2, '0');
  const seconds = String(total % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
});

function stopTimers() {
  if (countdownTimer) {
    window.clearInterval(countdownTimer);
    countdownTimer = undefined;
  }
  if (pollTimer) {
    window.clearInterval(pollTimer);
    pollTimer = undefined;
  }
}

function startCountdown(seconds: number) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  remaining.value = total;
  // 后端没给剩余时间时只显示支付载荷，不据此判定过期：
  // 把还在有效期内的订单误标成「已过期」会把二维码藏掉，用户反而付不了。
  showCountdown.value = total > 0;
  if (total <= 0 || countdownTimer) {
    return;
  }
  countdownTimer = window.setInterval(() => {
    remaining.value = Math.max(0, remaining.value - 1);
    if (remaining.value === 0) {
      showCountdown.value = false;
      expired.value = true;
      // 链上充值过期只代表「不再提示继续转账」：已转账用户仍要能提交哈希，
      // 也要继续轮询等待链上确认；其余通道可以直接收尾。
      if (countdownTimer) {
        window.clearInterval(countdownTimer);
        countdownTimer = undefined;
      }
      if (!isChainDepositChannel(order.value?.payChannel)) {
        stopTimers();
      }
    }
  }, 1000);
}

function startPolling() {
  // 余额支付没有「等渠道回调」的中间态，不需要轮询。
  if (pollTimer || String(order.value?.payChannel ?? '').toUpperCase() === 'BALANCE') {
    return;
  }
  pollTimer = window.setInterval(() => void syncCurrentOrder(), 3000);
}

async function syncCurrentOrder() {
  const orderNo = order.value?.orderNo;
  if (!orderNo || loading.value) {
    return;
  }
  loading.value = true;
  try {
    const latest = await syncRechargeOrder(orderNo);
    order.value = { ...order.value, ...latest } as RechargeApi.PackagePaymentOrder;
    if (latest.status === 'PAID') {
      onPaid();
      return;
    }
    // EXPIRED/CLOSED/FAILED 都意味着这笔不能再付了。链上充值的 EXPIRED 例外：
    // 截止之后仍可能有已转出的钱被确认，必须继续轮询。
    if (
      latest.status === 'CLOSED' ||
      latest.status === 'EXPIRED' ||
      latest.status === 'FAILED'
    ) {
      expired.value = true;
      if (
        latest.status !== 'EXPIRED' ||
        !isChainDepositChannel(latest.payChannel)
      ) {
        stopTimers();
      }
    }
  } finally {
    loading.value = false;
  }
}

function onPaid() {
  stopTimers();
  paid.value = true;
  emit('refresh');
  message.success($t('paymentOrder.continuePay.paidTip'));
  autoCloseTimer = window.setTimeout(() => closeModal(), 1800);
}

async function open(row: PaymentOrderApi.PaymentOrder) {
  stopTimers();
  order.value = null;
  paid.value = false;
  expired.value = false;
  remaining.value = 0;
  showCountdown.value = false;
  trc20Txid.value = '';
  visible.value = true;
  loading.value = true;
  try {
    const current = await continuePaymentOrder(row.orderNo);
    order.value = current;
    if (current.status === 'PAID') {
      onPaid();
      return;
    }
    if (current.status === 'EXPIRED' && isChainDepositChannel(current.payChannel)) {
      expired.value = true;
    }
    startCountdown(current.remainingSeconds ?? 0);
    startPolling();
  } catch {
    visible.value = false;
  } finally {
    loading.value = false;
  }
}

function closeModal() {
  if (autoCloseTimer) {
    window.clearTimeout(autoCloseTimer);
    autoCloseTimer = undefined;
  }
  stopTimers();
  // onPaid 已经通知过父级刷新，关窗时不再重复触发。
  const shouldRefresh = Boolean(order.value) && !paid.value;
  visible.value = false;
  order.value = null;
  if (shouldRefresh) {
    emit('refresh');
  }
}

function openPayPage() {
  const current = order.value;
  if (!current) {
    return;
  }
  if (alipayPayload.value) {
    if (!submitAlipayForm(current, '_blank')) {
      message.error($t('paymentOrder.continuePay.invalidPayload'));
    }
    return;
  }
  if (current.paymentUrl) {
    window.open(current.paymentUrl, '_blank', 'noopener');
    return;
  }
  message.error($t('paymentOrder.continuePay.invalidPayload'));
}

async function copyValue(value: string) {
  if (!value) {
    return;
  }
  await navigator.clipboard.writeText(value);
  message.success($t('paymentOrder.continuePay.copied'));
}

async function submitTxid() {
  const orderNo = order.value?.orderNo;
  const txid = trc20Txid.value.trim();
  if (!orderNo || !txid) {
    return;
  }
  trc20Submitting.value = true;
  try {
    const latest = await submitTrc20TxID(orderNo, txid);
    order.value = { ...order.value, ...latest } as RechargeApi.PackagePaymentOrder;
    if (latest.status === 'PAID') {
      onPaid();
    }
  } finally {
    trc20Submitting.value = false;
  }
}

onBeforeUnmount(() => {
  stopTimers();
  if (autoCloseTimer) {
    window.clearTimeout(autoCloseTimer);
  }
});

defineExpose({ open });
</script>

<template>
  <Modal
    :footer="null"
    :open="visible"
    :title="$t('paymentOrder.continuePay.title')"
    :width="460"
    @cancel="closeModal"
  >
    <Spin :spinning="loading">
      <div v-if="order" class="continue-pay">
        <div class="continue-pay__summary">
          <div class="continue-pay__row">
            <span>{{ $t('paymentOrder.fields.orderNo') }}</span>
            <strong class="continue-pay__break">{{ order.orderNo }}</strong>
          </div>
          <div class="continue-pay__row">
            <span>{{ $t('paymentOrder.fields.amount') }}</span>
            <strong>
              {{ formatOrderMoney(order.payAmount || order.amount, order.currency) }}
            </strong>
          </div>
          <div class="continue-pay__row">
            <span>{{ $t('paymentOrder.fields.status') }}</span>
            <Tag :color="statusColor[order.status as keyof typeof statusColor] || 'default'">
              {{ statusLabel(order.status) }}
            </Tag>
          </div>
          <div v-if="showCountdown && !expired && !paid" class="continue-pay__countdown">
            <span>{{ $t('paymentOrder.continuePay.countdown') }}</span>
            <strong>{{ countdownText }}</strong>
          </div>
        </div>

        <p v-if="paid" class="continue-pay__state is-success">
          {{ $t('paymentOrder.continuePay.paidTip') }}
        </p>

        <div v-else-if="isChainDeposit" class="continue-pay__trc20">
          <p v-if="expired" class="continue-pay__state is-expired">
            {{ $t('paymentOrder.continuePay.expiredTip') }}
          </p>
          <template v-if="!expired">
            <div class="continue-pay__row">
              <span>{{ $t('paymentOrder.continuePay.chainNetwork') }}</span>
              <strong>{{ chainNetwork }}</strong>
            </div>
            <div class="continue-pay__row">
              <span>{{ $t('paymentOrder.continuePay.chainAddress') }}</span>
              <code class="continue-pay__break">{{ order.chainAddress }}</code>
              <Button size="small" @click="copyValue(order.chainAddress || '')">
                {{ $t('paymentOrder.continuePay.copy') }}
              </Button>
            </div>
            <div class="continue-pay__row">
              <span>{{ $t('paymentOrder.continuePay.chainAmount') }}</span>
              <strong>{{ order.chainAmount }} USDT</strong>
              <Button size="small" @click="copyValue(String(order.chainAmount ?? ''))">
                {{ $t('paymentOrder.continuePay.copy') }}
              </Button>
            </div>
            <p class="continue-pay__tip">{{ $t('paymentOrder.continuePay.trc20Tip') }}</p>
          </template>
          <div class="continue-pay__trc20-submit">
            <Input
              v-model:value="trc20Txid"
              :placeholder="$t('paymentOrder.continuePay.trc20TxidPlaceholder')"
              allow-clear
            />
            <Button
              :disabled="!trc20Txid.trim()"
              :loading="trc20Submitting"
              type="primary"
              @click="submitTxid"
            >
              {{ $t('paymentOrder.continuePay.trc20Submit') }}
            </Button>
          </div>
        </div>

        <p v-else-if="expired" class="continue-pay__state is-expired">
          {{ $t('paymentOrder.continuePay.expiredTip') }}
        </p>

        <div v-else-if="hasQr" class="continue-pay__qr">
          <QRCode :bordered="false" :value="order.qrCode || ''" :size="188" />
          <p class="continue-pay__tip">{{ $t('paymentOrder.continuePay.scanTip') }}</p>
        </div>

        <div v-else class="continue-pay__redirect">
          <Button block type="primary" @click="openPayPage">
            {{ $t('paymentOrder.continuePay.openPay') }}
          </Button>
          <p class="continue-pay__tip">{{ $t('paymentOrder.continuePay.redirectTip') }}</p>
        </div>

        <p v-if="!paid && !expired" class="continue-pay__tip">
          {{ $t('paymentOrder.continuePay.pendingTip') }}
        </p>
      </div>
    </Spin>
  </Modal>
</template>

<style scoped>
.continue-pay {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 0 8px;
}

.continue-pay__summary {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.continue-pay__row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.continue-pay__row > span {
  flex: 0 0 96px;
  color: hsl(var(--muted-foreground));
}

.continue-pay__break {
  min-width: 0;
  overflow-wrap: anywhere;
}

.continue-pay__countdown {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.continue-pay__countdown > span {
  flex: 0 0 96px;
  color: hsl(var(--muted-foreground));
}

.continue-pay__countdown strong {
  font-variant-numeric: tabular-nums;
  color: hsl(var(--warning));
}

.continue-pay__state {
  margin: 0;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 13px;
}

.continue-pay__state.is-success {
  color: hsl(var(--success));
  background: hsl(var(--success) / 12%);
}

.continue-pay__state.is-expired {
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 8%);
}

.continue-pay__trc20 {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  background: hsl(var(--muted) / 55%);
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
}

.continue-pay__trc20 code {
  font-size: 12px;
}

.continue-pay__trc20-submit {
  display: flex;
  gap: 8px;
}

.continue-pay__qr {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.continue-pay__tip {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: hsl(var(--muted-foreground));
}

.continue-pay__redirect {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
