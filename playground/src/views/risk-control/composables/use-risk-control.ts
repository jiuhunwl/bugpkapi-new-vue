import type { RiskControlApi } from '#/api/risk-control';

import { computed, shallowRef } from 'vue';

import {
  getRiskControlEvents,
  getRiskControlOverview,
} from '#/api/risk-control';

export function useRiskControl(defaultWindowMinutes = 10) {
  const windowMinutes = shallowRef(defaultWindowMinutes);
  const overview = shallowRef<RiskControlApi.Overview>();
  const events = shallowRef<RiskControlApi.RiskEvent[]>([]);
  const pendingLoads = shallowRef(0);
  const loadError = shallowRef('');
  const lastUpdatedAt = shallowRef<Date>();

  let eventsRequestId = 0;
  let overviewRequestId = 0;

  const hasRisk = computed(() => (overview.value?.riskScore ?? 0) >= 40);
  const loading = computed(() => pendingLoads.value > 0);
  const topEvents = computed(() => events.value.slice(0, 8));

  async function loadOverview() {
    const requestedWindow = windowMinutes.value;
    const requestId = ++overviewRequestId;
    const eventRequestId = ++eventsRequestId;
    pendingLoads.value += 1;
    try {
      const result = await getRiskControlOverview({
        limit: 12,
        windowMinutes: requestedWindow,
      });
      if (
        requestId !== overviewRequestId ||
        requestedWindow !== windowMinutes.value
      ) {
        return;
      }
      overview.value = result;
      loadError.value = '';
      lastUpdatedAt.value = new Date();
      if (eventRequestId === eventsRequestId) {
        events.value = result.events ?? [];
      }
    } catch (error) {
      if (
        requestId === overviewRequestId &&
        requestedWindow === windowMinutes.value
      ) {
        loadError.value = riskLoadErrorMessage(error);
      }
      throw error;
    } finally {
      pendingLoads.value = Math.max(0, pendingLoads.value - 1);
    }
  }

  async function loadEvents(limit = 24) {
    const requestedWindow = windowMinutes.value;
    const requestId = ++eventsRequestId;
    pendingLoads.value += 1;
    try {
      const result = await getRiskControlEvents({
        limit,
        windowMinutes: requestedWindow,
      });
      if (
        requestId === eventsRequestId &&
        requestedWindow === windowMinutes.value
      ) {
        events.value = result;
      }
    } finally {
      pendingLoads.value = Math.max(0, pendingLoads.value - 1);
    }
  }

  function setWindowMinutes(value: number) {
    if (windowMinutes.value === value) {
      return;
    }
    windowMinutes.value = value;
    eventsRequestId += 1;
    overviewRequestId += 1;
  }

  return {
    events,
    hasRisk,
    lastUpdatedAt,
    loadError,
    loading,
    loadEvents,
    loadOverview,
    overview,
    setWindowMinutes,
    topEvents,
    windowMinutes,
  };
}

function riskLoadErrorMessage(error: unknown) {
  const value = error as {
    message?: string;
    response?: { data?: { error?: string; message?: string } };
  };
  return (
    value?.response?.data?.error ||
    value?.response?.data?.message ||
    value?.message ||
    'RISK_CONTROL_LOAD_FAILED'
  );
}
