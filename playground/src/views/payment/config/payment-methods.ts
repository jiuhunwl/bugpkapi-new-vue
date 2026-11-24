import type { PaymentConfigApi } from '#/api/system/payment';

const MAX_PAYMENT_METHOD_SORT_ORDER = 1_000_000;

function normalizeSortOrder(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(
    MAX_PAYMENT_METHOD_SORT_ORDER,
    Math.max(0, Math.trunc(parsed)),
  );
}

export function normalizePaymentMethodsForSave(
  methods: readonly PaymentConfigApi.PaymentMethod[],
): PaymentConfigApi.PaymentMethod[] {
  return methods.map((method) => ({
    code: method.code,
    enabled: Boolean(method.enabled),
    sortOrder: normalizeSortOrder(method.sortOrder),
  }));
}

export function sortPaymentMethods(
  methods: readonly PaymentConfigApi.PaymentMethod[],
): PaymentConfigApi.PaymentMethod[] {
  return [...methods].sort((left, right) => {
    const orderDifference = left.sortOrder - right.sortOrder;
    return orderDifference || left.code.localeCompare(right.code);
  });
}
