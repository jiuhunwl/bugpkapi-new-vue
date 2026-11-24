<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { InterfaceApi } from '#/api/interface';

import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { IconifyIcon, Plus } from '@vben/icons';

import { Button, Empty, Input, message, Select, Switch, Tag } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  checkInterfaceUpstreams,
  getInterfacePolling,
  updateInterfacePolling,
} from '#/api/interface';
import { $t } from '#/locales';

import {
  addDomainRoute,
  applyCheckResultsToDraft,
  createDomainRoutingDraft,
  type DomainPollingRouteDraft,
  type DomainRoutingDraft,
  normalizeDomainRoutingForSave,
  normalizeLegacyUpstreams,
  readPollingState,
  removeDomainRoute,
  updateDomainRouteDraft,
} from '../domain-polling';
import { createProxyPoolDraft, normalizeProxyPoolDraft } from '../proxy-pool';
import {
  cloneResponseFieldMappings,
  normalizeResponseFieldMappings,
} from '../response-field-mapping';
import DomainPollingRouteEditor from './DomainPollingRouteEditor.vue';
import ProxyPoolEditor from './ProxyPoolEditor.vue';
import ResponseFieldMappingEditor from './ResponseFieldMappingEditor.vue';

const emits = defineEmits(['success']);

interface UpstreamDraft extends Omit<
  InterfaceApi.UpstreamConfig,
  'pollingCheckEnabled' | 'responseFieldMappings'
> {
  checkMessage?: string;
  clientId: string;
  pollingCheckEnabled: boolean;
  pollingCheckExpected: string;
  pollingCheckField: string;
  responseFieldMappings: InterfaceApi.ResponseFieldMapping[];
}

const current = ref<InterfaceApi.PollingConfig>();
const id = ref<string>();
const mainCheckEnabled = ref(false);
const mainCheckExpected = ref('200');
const mainCheckField = ref('code');
const mainHealthText = ref('');
const primaryResponseFieldMappings = ref<InterfaceApi.ResponseFieldMapping[]>(
  [],
);
const responseCleaningEnabled = ref(false);
const upstreamRows = ref<UpstreamDraft[]>([]);
const checkingRef = ref(false);
const checkingUrl = ref('');
const checkingRouteId = ref('');
const checkResults = ref<InterfaceApi.UpstreamCheckResult[]>([]);
const domainRouting = ref<DomainRoutingDraft>(createDomainRoutingDraft());
const proxyPoolConfig = ref(createProxyPoolDraft());

const pollingSchema: VbenFormSchema[] = [
  {
    component: 'Switch',
    componentProps: {
      checkedChildren: $t('polling.enabled'),
      class: 'w-auto',
      unCheckedChildren: $t('polling.disabled'),
    },
    defaultValue: false,
    fieldName: 'pollingEnabled',
    label: $t('polling.pollingEnabled'),
  },
  {
    component: 'Select',
    componentProps: {
      options: [
        { label: $t('polling.modes.fastest'), value: 'FASTEST' },
        { label: $t('polling.modes.roundRobin'), value: 'ROUND_ROBIN' },
        { label: $t('polling.modes.primary'), value: 'PRIMARY' },
      ],
    },
    defaultValue: 'ROUND_ROBIN',
    fieldName: 'pollingMode',
    label: $t('polling.mode'),
    rules: 'selectRequired',
  },
  {
    component: 'Input',
    componentProps: {
      allowClear: true,
      maxlength: 64,
      placeholder: $t('polling.stopCodePlaceholder'),
    },
    fieldName: 'pollingStopCode',
    label: $t('polling.stopCode'),
  },
  {
    component: 'Switch',
    componentProps: {
      checkedChildren: $t('polling.enabled'),
      class: 'w-auto',
      onChange: (checked: boolean) => {
        responseCleaningEnabled.value = checked;
      },
      unCheckedChildren: $t('polling.disabled'),
    },
    defaultValue: false,
    fieldName: 'responseCleaningEnabled',
    label: $t('polling.responseCleaning'),
  },
];

const [Form, formApi] = useVbenForm({
  commonConfig: { componentProps: { class: 'w-full' } },
  layout: 'horizontal',
  schema: pollingSchema,
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1',
});

const [Drawer, drawerApi] = useVbenDrawer({
  class: 'w-160! max-w-[calc(100vw-32px)]!',
  async onConfirm() {
    if (!id.value || !current.value) return;
    const { valid } = await formApi.validate();
    if (!valid) return;
    const values = await formApi.getValues<any>();
    const upstreamConfigs = normalizeLegacyUpstreams(upstreamRows.value);
    const normalizedDomainRouting = normalizeDomainRoutingForSave(
      domainRouting.value,
      current.value?.domainRouting,
    );
    const payload: InterfaceApi.SavePollingConfig = {
      pollingCheckEnabled: mainCheckEnabled.value ? 1 : 0,
      pollingCheckExpected: mainCheckExpected.value.trim() || '200',
      pollingCheckField: mainCheckField.value.trim() || 'code',
      pollingEnabled: values.pollingEnabled ? 1 : 0,
      pollingMode: normalizeMode(values.pollingMode),
      pollingStopCode: String(values.pollingStopCode || '').trim(),
      responseCleaningEnabled: values.responseCleaningEnabled ? 1 : 0,
      responseFieldMappings: normalizeResponseFieldMappings(
        primaryResponseFieldMappings.value,
      ),
      proxyPoolConfig: normalizeProxyPoolDraft(proxyPoolConfig.value),
      upstreamConfigs,
      upstreamUrls: upstreamConfigs.map((item) => item.url),
    };
    if (normalizedDomainRouting) {
      payload.domainRouting = normalizedDomainRouting;
    }
    drawerApi.lock();
    try {
      await updateInterfacePolling(id.value, payload);
      message.success($t('polling.saved'));
      emits('success');
      drawerApi.close();
    } catch {
      // The request client has displayed the server error. Keep the draft open
      // for correction/retry without leaking an unhandled promise rejection.
    } finally {
      drawerApi.unlock();
    }
  },
  async onOpenChange(open) {
    if (!open) return;
    const row = drawerApi.getData<InterfaceApi.InterfaceItem>();
    resetState(row?.id);
    if (!row?.id) return;
    drawerApi.lock();
    try {
      const data = await getInterfacePolling(row.id);
      current.value = data;
      domainRouting.value = createDomainRoutingDraft(data.domainRouting, data);
      upstreamRows.value = domainRouting.value.legacyUpstreams;
      checkResults.value = [];
      await nextTick();
      const polling = readPollingState(data);
      await formApi.setValues({
        pollingEnabled: polling.pollingEnabled,
        pollingMode: normalizeMode(polling.pollingMode),
        pollingStopCode: data.pollingStopCode || '',
        responseCleaningEnabled: data.responseCleaningEnabled === 1,
      });
      responseCleaningEnabled.value = data.responseCleaningEnabled === 1;
      proxyPoolConfig.value = createProxyPoolDraft(data.proxyPoolConfig);
      mainCheckEnabled.value = data.pollingCheckEnabled === 1;
      mainCheckExpected.value = data.pollingCheckExpected || '200';
      mainCheckField.value = data.pollingCheckField || 'code';
      primaryResponseFieldMappings.value = cloneResponseFieldMappings(
        data.responseFieldMappings,
      );
    } catch {
      // A failed GET must never leave an empty, writable replacement form.
      current.value = undefined;
      id.value = undefined;
      drawerApi.close();
    } finally {
      drawerApi.unlock();
    }
  },
});

const drawerTitle = computed(() =>
  current.value?.name
    ? $t('polling.titleWithName', [current.value.name])
    : $t('polling.title'),
);
const currentNodeText = computed(() => {
  if (!current.value || !readPollingState(current.value).pollingEnabled)
    return $t('polling.disabled');
  const total =
    current.value.upstreamCount || current.value.upstreamUrls.length || 1;
  return `${current.value.currentNode || 1}/${total}`;
});
const domainFallbackOptions = computed(() => [
  {
    label: $t('polling.domain.fallback.defaultPool'),
    value: 'DEFAULT_POOL',
  },
  {
    label: $t('polling.domain.fallback.defaultRoute'),
    value: 'DEFAULT_ROUTE',
  },
  {
    label: $t('polling.domain.fallback.reject'),
    value: 'REJECT',
  },
]);
const domainRouteOptions = computed(() =>
  domainRouting.value.routes.map((route) => ({
    label: `${route.name || route.id} (${route.id})`,
    value: route.id,
  })),
);
const enabledDomainRouteCount = computed(
  () => domainRouting.value.routes.filter((route) => route.enabled).length,
);

function resetState(interfaceId?: string) {
  id.value = interfaceId;
  current.value = undefined;
  mainCheckEnabled.value = false;
  mainCheckExpected.value = '200';
  mainCheckField.value = 'code';
  mainHealthText.value = '';
  primaryResponseFieldMappings.value = [];
  responseCleaningEnabled.value = false;
  upstreamRows.value = [];
  checkResults.value = [];
  checkingRouteId.value = '';
  domainRouting.value = createDomainRoutingDraft();
  checkingRef.value = false;
  checkingUrl.value = '';
  proxyPoolConfig.value = createProxyPoolDraft();
  formApi.resetForm();
}

function addDomainRoutingRoute() {
  domainRouting.value.routes = addDomainRoute(domainRouting.value.routes);
}

function removeDomainRoutingRoute(route: DomainPollingRouteDraft) {
  domainRouting.value.routes = removeDomainRoute(
    domainRouting.value.routes,
    route.clientId,
  );
  if (domainRouting.value.defaultRouteId === route.id) {
    domainRouting.value.defaultRouteId = '';
  }
}

function updateDomainRoutingRoute(
  index: number,
  route: DomainPollingRouteDraft,
) {
  const updated = updateDomainRouteDraft(
    domainRouting.value.routes,
    index,
    route,
    domainRouting.value.defaultRouteId,
  );
  domainRouting.value.routes = updated.routes;
  domainRouting.value.defaultRouteId = updated.defaultRouteId;
}

function normalizeMode(value: unknown): InterfaceApi.PollingMode {
  if (value === 'FASTEST' || value === 'PRIMARY') return value;
  return 'ROUND_ROBIN';
}

function addUpstream() {
  upstreamRows.value.push({
    clientId: crypto.randomUUID(),
    pollingCheckEnabled: false,
    pollingCheckExpected: '200',
    pollingCheckField: 'code',
    responseFieldMappings: [],
    url: '',
  });
}

function modeText(mode?: InterfaceApi.PollingMode) {
  if (mode === 'FASTEST') return $t('polling.modes.fastest');
  if (mode === 'PRIMARY') return $t('polling.modes.primary');
  return mode === 'ROUND_ROBIN' || mode === 'RANDOM'
    ? $t('polling.modes.roundRobin')
    : $t('polling.modes.single');
}

function healthText(item: UpstreamDraft) {
  if (!item.healthStatus || item.healthStatus === 'UNKNOWN')
    return $t('polling.health.unknown');
  if (item.healthStatus === 'HEALTHY')
    return $t('polling.health.healthy', [
      item.lastLatencyMs ? `${item.lastLatencyMs}ms` : '-',
    ]);
  if (item.checkMessage) return item.checkMessage;
  return $t('polling.health.unhealthy', [item.failureCount || 0]);
}

function checkResultText(item: InterfaceApi.UpstreamCheckResult) {
  if (!item.healthStatus || item.healthStatus === 'UNKNOWN')
    return $t('polling.health.unknown');
  if (item.healthStatus === 'HEALTHY')
    return $t('polling.health.healthy', [
      item.latencyMs ? `${item.latencyMs}ms` : '-',
    ]);
  return item.message || $t('polling.health.unhealthy', [0]);
}

function applyCheckResults(items: InterfaceApi.UpstreamCheckResult[]) {
  checkResults.value = items;
  const primaryResult = applyCheckResultsToDraft(
    items,
    current.value?.requestUrl || '',
    upstreamRows.value,
    domainRouting.value.routes,
  );
  if (primaryResult) {
    mainHealthText.value = checkResultText(primaryResult);
  }
}

interface CheckTarget {
  routeId: string;
  url: string;
}

function isChecking(routeId: string, url: string) {
  return (
    checkingRef.value &&
    checkingRouteId.value === routeId &&
    checkingUrl.value === url.trim()
  );
}

async function runCheck(target?: CheckTarget) {
  if (!id.value || checkingRef.value) return;
  const requestedTarget = target || {
    routeId: '',
    url: current.value?.requestUrl?.trim() || '',
  };
  checkingRef.value = true;
  checkingRouteId.value = requestedTarget.routeId;
  checkingUrl.value = requestedTarget.url.trim();
  try {
    const items = await checkInterfaceUpstreams(id.value);
    applyCheckResults(items);
    message.success($t('polling.checkDone'));
  } catch {
    message.error($t('polling.checkFailed'));
  } finally {
    checkingRef.value = false;
    checkingRouteId.value = '';
    checkingUrl.value = '';
  }
}
</script>

<template>
  <Drawer :title="drawerTitle">
    <div v-if="current" class="summary">
      <div>
        <span>{{ $t('polling.status') }}</span>
        <strong>
          {{
            current.pollingEnabled === 1
              ? modeText(current.pollingMode)
              : $t('polling.disabled')
          }}
        </strong>
      </div>
      <div>
        <span>{{ $t('polling.currentNode') }}</span>
        <strong>{{ currentNodeText }}</strong>
      </div>
      <div>
        <span>{{ $t('polling.currentUrl') }}</span>
        <strong>{{ current.currentNodeUrl || '-' }}</strong>
      </div>
      <div>
        <span>{{ $t('polling.responseCleaning') }}</span>
        <strong>
          {{
            current.responseCleaningEnabled === 1
              ? $t('polling.enabled')
              : $t('polling.disabled')
          }}
        </strong>
      </div>
    </div>
    <Form />
    <section class="panel domain-panel">
      <header class="header">
        <div>
          <strong>{{ $t('polling.domain.title') }}</strong>
          <p>{{ $t('polling.domain.description', ['/api/{apiCode}']) }}</p>
        </div>
        <Switch
          v-model:checked="domainRouting.enabled"
          :checked-children="$t('polling.enabled')"
          :un-checked-children="$t('polling.disabled')"
        />
      </header>
      <div class="domain-controls">
        <label class="domain-control">
          <span>{{ $t('polling.domain.fallbackLabel') }}</span>
          <Select
            v-model:value="domainRouting.fallback"
            class="w-full"
            :options="domainFallbackOptions"
          />
        </label>
        <label
          v-if="domainRouting.fallback === 'DEFAULT_ROUTE'"
          class="domain-control"
        >
          <span>{{ $t('polling.domain.defaultRouteLabel') }}</span>
          <Select
            v-model:value="domainRouting.defaultRouteId"
            allow-clear
            class="w-full"
            :disabled="!domainRouting.routes.length"
            :options="domainRouteOptions"
            :placeholder="$t('polling.domain.defaultRoutePlaceholder')"
          />
        </label>
      </div>
      <div class="domain-summary">
        <Tag :color="domainRouting.enabled ? 'success' : 'default'">
          {{
            domainRouting.enabled
              ? $t('polling.domain.active')
              : $t('polling.domain.inactive')
          }}
        </Tag>
        <span>
          {{
            $t('polling.domain.routeCount', [
              domainRouting.routes.length,
              enabledDomainRouteCount,
            ])
          }}
        </span>
      </div>
      <div v-if="domainRouting.routes.length" class="domain-routes">
        <DomainPollingRouteEditor
          v-for="(route, index) in domainRouting.routes"
          :key="route.clientId"
          :model-value="route"
          :check-results="checkResults"
          :checking="checkingRef"
          :index="index"
          @check="runCheck"
          @remove="removeDomainRoutingRoute(route)"
          @update:model-value="updateDomainRoutingRoute(index, $event)"
        />
      </div>
      <div v-else class="empty">
        <Empty :description="$t('polling.domain.empty')" />
      </div>
      <Button class="domain-add" type="primary" @click="addDomainRoutingRoute">
        <Plus class="size-4" />
        {{ $t('polling.domain.addRoute') }}
      </Button>
    </section>
    <ProxyPoolEditor v-model="proxyPoolConfig" :interface-id="id" />
    <section v-if="current" class="panel">
      <header>
        <strong>{{ $t('polling.primary.title') }}</strong>
        <p>{{ $t('polling.primary.description') }}</p>
      </header>
      <div class="primary-url">
        <Input :value="current.requestUrl" disabled />
        <Button
          :disabled="checkingRef"
          :loading="isChecking('', current.requestUrl)"
          size="small"
          @click="runCheck()"
        >
          <IconifyIcon class="size-4" icon="lucide:activity" />
          {{ $t('polling.check') }}
        </Button>
      </div>
      <div v-if="mainHealthText" class="text-xs text-muted-foreground">
        {{ mainHealthText }}
      </div>
      <div class="check-row">
        <span>{{ $t('polling.responseCheck') }}</span>
        <Switch v-model:checked="mainCheckEnabled" />
        <Input
          v-model:value="mainCheckField"
          :disabled="!mainCheckEnabled"
          :placeholder="$t('polling.fieldPlaceholder')"
        />
        <span>{{ $t('polling.notEqual') }}</span>
        <Input
          v-model:value="mainCheckExpected"
          :disabled="!mainCheckEnabled"
          :placeholder="$t('polling.expectedPlaceholder')"
        />
      </div>
      <ResponseFieldMappingEditor
        v-if="responseCleaningEnabled"
        v-model="primaryResponseFieldMappings"
      />
    </section>
    <section class="panel">
      <header class="header">
        <div>
          <strong>{{ $t('polling.upstreams.title') }}</strong>
          <p>{{ $t('polling.upstreams.description') }}</p>
        </div>
        <Button type="primary" @click="addUpstream">
          <Plus class="size-4" />
          {{ $t('polling.upstreams.add') }}
        </Button>
      </header>
      <div v-if="upstreamRows.length" class="space-y-3">
        <div
          v-for="(item, index) in upstreamRows"
          :key="item.clientId"
          class="upstream"
        >
          <span class="index">{{ index + 1 }}</span>
          <div class="min-w-0 space-y-2">
            <Input
              v-model:value="item.url"
              :placeholder="$t('polling.upstreams.urlPlaceholder', [index + 1])"
            />
            <div class="text-xs text-muted-foreground">
              {{ healthText(item) }}
              <span v-if="item.lastCheckedAt"> / {{ item.lastCheckedAt }}</span>
              <Button
                class="ml-2!"
                :disabled="checkingRef"
                :loading="isChecking('', item.url)"
                size="small"
                type="link"
                @click="runCheck({ routeId: '', url: item.url })"
              >
                <IconifyIcon class="size-3.5" icon="lucide:activity" />
                {{ $t('polling.check') }}
              </Button>
            </div>
            <div class="check-row">
              <span>{{ $t('polling.responseCheck') }}</span>
              <Switch v-model:checked="item.pollingCheckEnabled" />
              <Input
                v-model:value="item.pollingCheckField"
                :disabled="!item.pollingCheckEnabled"
                :placeholder="$t('polling.fieldPlaceholder')"
              />
              <span>{{ $t('polling.notEqual') }}</span>
              <Input
                v-model:value="item.pollingCheckExpected"
                :disabled="!item.pollingCheckEnabled"
                :placeholder="$t('polling.expectedPlaceholder')"
              />
            </div>
            <ResponseFieldMappingEditor
              v-if="responseCleaningEnabled"
              v-model="item.responseFieldMappings"
            />
          </div>
          <Button
            danger
            type="text"
            :aria-label="$t('polling.upstreams.remove', [index + 1])"
            @click="upstreamRows.splice(index, 1)"
          >
            <IconifyIcon class="size-4" icon="lucide:trash-2" />
          </Button>
        </div>
      </div>
      <div v-else class="empty">
        <Empty :description="$t('polling.upstreams.empty')" />
      </div>
    </section>
  </Drawer>
</template>

<style scoped>
.summary,
.panel {
  display: grid;
  gap: 12px;
  padding: 14px;
  margin-bottom: 18px;
  color: hsl(var(--foreground));
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.summary div {
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr);
  gap: 10px;
}

.summary span,
.summary p {
  color: hsl(var(--muted-foreground));
}

.summary strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
}

.primary-url {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
}

.domain-controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.domain-control {
  display: grid;
  gap: 6px;
  min-width: 0;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.domain-summary {
  display: flex;
  gap: 10px;
  align-items: center;
  min-height: 24px;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.domain-routes {
  display: grid;
  gap: 12px;
}

.domain-add {
  justify-self: start;
}

.header p {
  margin-top: 4px;
  font-size: 13px;
}

.upstream {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) 36px;
  gap: 10px;
  align-items: start;
}

.index {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
  border-radius: 999px;
}

.check-row {
  display: grid;
  grid-template-columns: auto auto minmax(120px, 1fr) auto minmax(110px, 1fr);
  gap: 8px;
  align-items: center;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.empty {
  padding: 18px;
  border: 1px dashed hsl(var(--border));
  border-radius: 6px;
}

@media (max-width: 720px) {
  .check-row {
    grid-template-columns: auto auto;
  }

  .check-row :deep(.ant-input) {
    grid-column: 1 / -1;
  }

  .header {
    flex-direction: column;
  }

  .header button {
    width: 100%;
  }

  .domain-controls {
    grid-template-columns: minmax(0, 1fr);
  }

  .domain-add {
    width: 100%;
  }
}
</style>
