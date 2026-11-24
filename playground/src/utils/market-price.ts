// null 是运行时真实存在的取值（后端可空列直接下发 null），单独列进类型。
type MarketPriceValue = number | string | null | undefined;

function normalizeMarketPrice(value: MarketPriceValue) {
  const validNumber =
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    !Object.is(value, -0);
  const validString =
    typeof value === 'string' && /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value);
  return validNumber || validString ? Number(value) : undefined;
}

export function isMarketPriceFree(
  moneyPrice: MarketPriceValue,
  pointPrice: MarketPriceValue,
) {
  const money = normalizeMarketPrice(moneyPrice);
  const points = normalizeMarketPrice(pointPrice);
  // 点价缺失/为 null（如后端可空列未下发）视为「无点数计费」；
  // 金额无效或缺失时保持不判定为免费，避免未知价格被宣传成免费。
  return money === 0 && !(typeof points === 'number' && points > 0);
}

/**
 * 格式化 decimal(12,4) 金额为人类可读文本：'1.0000' -> '1'，'1.5000' -> '1.5'，
 * 非法输入原样返回，交由调用方决定回退展示。
 */
export function formatMarketMoney(value: MarketPriceValue): string {
  const money = normalizeMarketPrice(value);
  if (money === undefined) {
    return String(value ?? '');
  }
  return money.toLocaleString('zh-CN', { maximumFractionDigits: 4 });
}
