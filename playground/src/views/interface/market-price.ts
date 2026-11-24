export interface MarketPriceSummary {
  free: boolean;
  moneyPrice: number;
  pointPrice: number;
}

function normalizePrice(value: number | string | undefined) {
  const validNumber =
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    !Object.is(value, -0);
  const validString =
    typeof value === 'string' && /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value);
  const valid = validNumber || validString;
  return {
    valid,
    value: valid ? Number(value) : 0,
  };
}

export function resolveMarketPrice(
  moneyPrice: number | string | undefined,
  pointPrice: number | string | undefined,
): MarketPriceSummary {
  const normalizedMoneyPrice = normalizePrice(moneyPrice);
  const normalizedPointPrice = normalizePrice(pointPrice);
  return {
    free:
      normalizedMoneyPrice.valid &&
      normalizedPointPrice.valid &&
      normalizedMoneyPrice.value === 0 &&
      normalizedPointPrice.value === 0,
    moneyPrice: normalizedMoneyPrice.value,
    pointPrice: normalizedPointPrice.value,
  };
}
