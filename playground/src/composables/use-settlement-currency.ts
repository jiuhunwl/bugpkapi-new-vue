import { computed, readonly, ref } from 'vue';

import { getRechargeCapabilities, getSiteCurrency } from '#/api/payment';

export type SettlementCurrency = 'CNY' | 'USD';

// 站点结算货币是后台单选配置（支付设置 → 货币设置）。
// 展示口径：所有面向用户的价格/余额都按站点货币显示；数字为人民币基数的
// 场景（套餐价、充值档、余额）在 USD 模式下按 usdCnyRate 换算后展示，
// 与后端下单时对 pay_amount 的换算口径一致（1 USD = rate CNY，保留 2 位）。
// 订单实付金额（payAmount）后端已换算过，展示时直接用，不再二次换算。
//
// 汇率是动态配置：缓存 5 分钟，页面恢复可见/重新聚焦时按需刷新；
// 后台保存后由 refreshSettlementCurrency() 立即失效重建。

const CNY_SYMBOL = '¥';
const USD_SYMBOL = '$';
const CURRENCY_TTL_MS = 5 * 60 * 1000;

const currency = ref<SettlementCurrency>('CNY');
const usdCnyRate = ref('7.2000');
// 用户端货币展示名称（如积分、赞助额度）：只替换 ¥/人民币 的称呼，
// 不参与任何金额或汇率换算；空字符串表示沿用结算货币的 ¥/$ 展示。
const displayName = ref('');
let loadedAt = 0;
let inFlight: null | Promise<void> = null;
let listenersInstalled = false;

function applyCapabilities(next: {
  currency?: 'CNY' | 'USD';
  displayName?: string;
  usdCnyRate?: string;
}) {
  currency.value = next.currency === 'USD' ? 'USD' : 'CNY';
  const rate = Number(next.usdCnyRate ?? '');
  if (Number.isFinite(rate) && rate > 0) {
    usdCnyRate.value = String(rate);
  }
  // 必须显式覆盖：后台切回“跟随结算货币”后不能残留旧的展示名称。
  displayName.value = String(next.displayName ?? '').trim();
  loadedAt = Date.now();
}

async function fetchCurrencyConfig() {
  try {
    const cfg = await getSiteCurrency();
    return {
      currency: cfg.currency,
      displayName: cfg.displayName,
      usdCnyRate: cfg.usdCnyRate,
    };
  } catch {
    // 旧后端没有公开接口时回退到登录后的充值能力接口。
    const caps = await getRechargeCapabilities();
    return {
      currency: caps.currency,
      displayName: caps.displayName,
      usdCnyRate: caps.usdCnyRate,
    };
  }
}

function installRefreshListeners() {
  if (listenersInstalled || typeof document === 'undefined') {
    return;
  }
  listenersInstalled = true;
  const refreshWhenStale = () => {
    if (document.visibilityState === 'hidden') {
      return;
    }
    if (loadedAt === 0 || Date.now() - loadedAt >= CURRENCY_TTL_MS) {
      void loadCurrency(true);
    }
  };
  document.addEventListener('visibilitychange', refreshWhenStale);
  window.addEventListener('focus', refreshWhenStale);
}

function loadCurrency(force = false): Promise<void> {
  if (inFlight) {
    return inFlight;
  }
  if (!force && loadedAt > 0 && Date.now() - loadedAt < CURRENCY_TTL_MS) {
    return Promise.resolve();
  }
  const task = (async () => {
    try {
      applyCapabilities(await fetchCurrencyConfig());
    } catch {
      // 网络抖动时保留上一次成功值，避免展示口径在 CNY/USD 间跳动。
      if (loadedAt === 0) {
        currency.value = 'CNY';
      }
    }
  })();
  inFlight = task;
  void task.finally(() => {
    if (inFlight === task) {
      inFlight = null;
    }
  });
  return task;
}

/** 当前站点货币符号；用于真实货币金额（支付实付、后台对账），不随展示名称变化。 */
export function settlementSymbol(): string {
  return currency.value === 'USD' ? USD_SYMBOL : CNY_SYMBOL;
}

/** 当前货币展示名称；空字符串表示沿用结算货币的 ¥/$。 */
export function settlementDisplayName(): string {
  return displayName.value;
}

/** 人民币基数 → 站点货币数值。CNY 原样返回。 */
export function convertFromCNY(
  value: null | number | string | undefined,
  fractionDigits = 2,
): number {
  const base = Number(value ?? 0);
  if (!Number.isFinite(base) || currency.value !== 'USD') {
    return base;
  }
  const rate = Number(usdCnyRate.value) || 1;
  const factor = 10 ** fractionDigits;
  return Math.round((base / rate) * factor) / factor;
}

/** 人民币基数 → 带符号站点货币文本。配置了展示名称时输出「金额 名称」。 */
export function formatSettlementPrice(
  value: null | number | string | undefined,
  fractionDigits = 2,
): string {
  const converted = convertFromCNY(value, fractionDigits);
  const name = displayName.value;
  if (!Number.isFinite(converted)) {
    return name ? `0 ${name}` : `${settlementSymbol()}0`;
  }
  const numberText = converted.toLocaleString('zh-CN', {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits:
      converted % 1 === 0 ? 0 : Math.min(2, fractionDigits),
  });
  if (name) {
    return `${numberText} ${name}`;
  }
  return `${settlementSymbol()}${numberText}`;
}

/** 人民币基数 → 不带符号的站点货币文本（2 位）。 */
export function formatSettlementMoney(
  value: null | number | string | undefined,
): string {
  const converted = convertFromCNY(value);
  if (!Number.isFinite(converted)) return '0';
  return converted.toLocaleString('zh-CN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: converted % 1 === 0 ? 0 : 2,
  });
}

/** 站点货币 → 人民币基数（用于把换算后的输入吸附回后台配置口径）。 */
export function convertToCNY(
  value: null | number | string | undefined,
): number {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || currency.value !== 'USD') {
    return amount;
  }
  const rate = Number(usdCnyRate.value) || 1;
  return Math.round(amount * rate * 100) / 100;
}

/** 立即刷新站点货币配置（货币设置保存后调用）。 */
export async function refreshSettlementCurrency() {
  return loadCurrency(true);
}

export function useSettlementCurrency() {
  installRefreshListeners();
  void loadCurrency();
  const symbol = computed(() => settlementSymbol());
  const name = computed(() => displayName.value);

  const fromCNY = convertFromCNY;
  const toCNY = convertToCNY;
  const moneyText = formatSettlementMoney;
  const priceText = formatSettlementPrice;

  return {
    currency: readonly(currency),
    formatMoney: moneyText,
    fromCNY,
    name,
    priceText,
    symbol,
    toCNY,
  };
}
