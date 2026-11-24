<script lang="ts" setup>
import type { InterfaceApi } from '#/api/interface';

import { computed } from 'vue';

import { IconifyIcon, Plus } from '@vben/icons';

import {
  Button,
  Empty,
  Input,
  InputNumber,
  Select,
  Switch,
  Tag,
} from 'ant-design-vue';

import { $t } from '#/locales';

import {
  type DomainPollingRouteDraft,
  findCheckResult,
  type PollingUpstreamDraft,
} from '../domain-polling';
import ResponseFieldMappingEditor from './ResponseFieldMappingEditor.vue';

const props = defineProps<{
  checking: boolean;
  checkResults: InterfaceApi.UpstreamCheckResult[];
  index: number;
}>();

const emit = defineEmits<{
  check: [payload: { routeId: string; url: string }];
  remove: [];
}>();

const model = defineModel<DomainPollingRouteDraft>({ required: true });

const Textarea = Input.TextArea;

const sourceOptions = computed(() => [
  { label: $t('polling.domain.sources.auto'), value: 'AUTO' },
  { label: $t('polling.domain.sources.query'), value: 'QUERY' },
  { label: $t('polling.domain.sources.body'), value: 'BODY' },
]);

const matchModeOptions = computed(() => [
  { label: $t('polling.domain.matchModes.subdomain'), value: 'SUBDOMAIN' },
  { label: $t('polling.domain.matchModes.exact'), value: 'EXACT' },
]);

const valueModeOptions = computed(() => [
  { label: $t('polling.domain.valueModes.all'), value: 'ALL' },
  { label: $t('polling.domain.valueModes.any'), value: 'ANY' },
]);

const pollingModeOptions = computed(() => [
  { label: $t('polling.modes.roundRobin'), value: 'ROUND_ROBIN' },
  { label: $t('polling.modes.primary'), value: 'PRIMARY' },
  { label: $t('polling.modes.fastest'), value: 'FASTEST' },
  { label: $t('polling.modes.single'), value: 'SINGLE' },
]);

const routeResult = computed(() =>
  findCheckResult(
    props.checkResults,
    model.value.id,
    model.value.requestUrl,
  ),
);

function setPriority(value: unknown) {
  const numeric = Number(value);
  model.value.priority = Number.isFinite(numeric) ? Math.trunc(numeric) : 0;
}

function updateRouteId(value: unknown) {
  const id = String(value ?? '').trim();
  if (id === model.value.id) return;
  model.value = { ...model.value, id };
}

function addUpstream() {
  const existing = model.value.upstreamConfigs;
  let serial = existing.length + 1;
  let nextClientId = `route-upstream:${model.value.id}:${serial}`;
  while (existing.some((item) => item.clientId === nextClientId)) {
    serial += 1;
    nextClientId = `route-upstream:${model.value.id}:${serial}`;
  }
  const next: PollingUpstreamDraft = {
    clientId: nextClientId,
    pollingCheckEnabled: false,
    pollingCheckExpected: '200',
    pollingCheckField: 'code',
    responseFieldMappings: [],
    url: '',
  };
  model.value.upstreamConfigs = [...existing, next];
}

function removeUpstream(clientId: string) {
  model.value.upstreamConfigs = model.value.upstreamConfigs.filter(
    (item) => item.clientId !== clientId,
  );
}

function resultFor(url: string) {
  return findCheckResult(props.checkResults, model.value.id, url);
}

function healthText(item: PollingUpstreamDraft) {
  const result = resultFor(item.url);
  const status = result?.healthStatus || item.healthStatus;
  if (!status || status === 'UNKNOWN') return $t('polling.health.unknown');
  if (status === 'HEALTHY') {
    const latency = result?.latencyMs ?? item.lastLatencyMs;
    return $t('polling.health.healthy', [
      latency === undefined ? '-' : `${latency}ms`,
    ]);
  }
  if (result?.message) return result.message;
  if (item.checkMessage) return item.checkMessage;
  return $t('polling.health.unhealthy', [item.failureCount || 0]);
}

function requestCheck(url: string) {
  const normalized = url.trim();
  if (normalized) emit('check', { routeId: model.value.id, url: normalized });
}
</script>

<template>
  <section class="route-panel">
    <header class="route-header">
      <div class="route-heading">
        <span class="route-index">{{ index + 1 }}</span>
        <div>
          <strong>{{ model.name || model.id }}</strong>
          <p>{{ $t('polling.domain.routeDescription') }}</p>
        </div>
      </div>
      <div class="route-actions">
        <Tag :color="model.enabled ? 'success' : 'default'">
          {{
            model.enabled
              ? $t('polling.enabled')
              : $t('polling.disabled')
          }}
        </Tag>
        <Switch v-model:checked="model.enabled" />
        <Button
          danger
          type="text"
          :aria-label="$t('polling.domain.removeRoute', [index + 1])"
          @click="emit('remove')"
        >
          <IconifyIcon class="size-4" icon="lucide:trash-2" />
        </Button>
      </div>
    </header>

    <div class="route-grid route-grid--identity">
      <label class="field">
        <span>{{ $t('polling.domain.routeId') }}</span>
        <Input
          :maxlength="64"
          :value="model.id"
          @update:value="updateRouteId"
        />
      </label>
      <label class="field">
        <span>{{ $t('polling.domain.routeName') }}</span>
        <Input v-model:value="model.name" :maxlength="128" />
      </label>
      <label class="field field--number">
        <span>{{ $t('polling.domain.priority') }}</span>
        <InputNumber
          :max="1000000"
          :min="0"
          :value="model.priority"
          @update:value="setPriority"
        />
      </label>
      <label class="field">
        <span>{{ $t('polling.domain.pollingMode') }}</span>
        <Select
          v-model:value="model.pollingMode"
          class="w-full"
          :options="pollingModeOptions"
        />
      </label>
    </div>

    <section class="route-section">
      <header class="section-heading">
        <div>
          <strong>{{ $t('polling.domain.matchTitle') }}</strong>
          <p>{{ $t('polling.domain.matchDescription') }}</p>
        </div>
      </header>
      <div class="route-grid route-grid--match">
        <label class="field">
          <span>{{ $t('polling.domain.source') }}</span>
          <Select
            v-model:value="model.match.source"
            class="w-full"
            :options="sourceOptions"
          />
        </label>
        <label class="field field--wide">
          <span>{{ $t('polling.domain.field') }}</span>
          <Input
            v-model:value="model.match.field"
            :placeholder="$t('polling.domain.fieldPlaceholder')"
          />
        </label>
        <label class="field">
          <span>{{ $t('polling.domain.matchMode') }}</span>
          <Select
            v-model:value="model.match.mode"
            class="w-full"
            :options="matchModeOptions"
          />
        </label>
        <label class="field">
          <span>{{ $t('polling.domain.valueMode') }}</span>
          <Select
            v-model:value="model.match.valueMode"
            class="w-full"
            :options="valueModeOptions"
          />
        </label>
        <label class="field field--full">
          <span>{{ $t('polling.domain.domains') }}</span>
          <Textarea
            v-model:value="model.match.domainsText"
            :placeholder="$t('polling.domain.domainsPlaceholder')"
            :rows="3"
          />
          <small>{{ $t('polling.domain.domainsHelp') }}</small>
        </label>
      </div>
    </section>

    <section class="route-section">
      <header class="section-heading">
        <div>
          <strong>{{ $t('polling.domain.poolTitle') }}</strong>
          <p>{{ $t('polling.domain.poolDescription') }}</p>
        </div>
        <Switch
          v-model:checked="model.pollingEnabled"
          :checked-children="$t('polling.enabled')"
          :un-checked-children="$t('polling.disabled')"
        />
      </header>
      <label class="field field--full">
        <span>{{ $t('polling.domain.requestUrl') }}</span>
        <Input
          v-model:value="model.requestUrl"
          :placeholder="$t('polling.domain.requestUrlPlaceholder')"
        />
      </label>
      <div v-if="routeResult" class="route-health">
        <span>{{ $t('polling.domain.primaryHealth') }}</span>
        <strong>{{ healthText({
          clientId: `route-primary:${model.id}`,
          healthStatus: routeResult.healthStatus,
          lastLatencyMs: routeResult.latencyMs,
          pollingCheckEnabled: false,
          pollingCheckExpected: '200',
          pollingCheckField: 'code',
          responseFieldMappings: [],
          url: model.requestUrl,
        }) }}</strong>
      </div>
      <div class="check-row">
        <span>{{ $t('polling.responseCheck') }}</span>
        <Switch v-model:checked="model.pollingCheckEnabled" />
        <Input
          v-model:value="model.pollingCheckField"
          :disabled="!model.pollingCheckEnabled"
          :placeholder="$t('polling.fieldPlaceholder')"
        />
        <span>{{ $t('polling.notEqual') }}</span>
        <Input
          v-model:value="model.pollingCheckExpected"
          :disabled="!model.pollingCheckEnabled"
          :placeholder="$t('polling.expectedPlaceholder')"
        />
      </div>
      <label class="field field--full stop-code">
        <span>{{ $t('polling.stopCode') }}</span>
        <Input
          v-model:value="model.pollingStopCode"
          :placeholder="$t('polling.stopCodePlaceholder')"
        />
      </label>
      <label class="inline-switch">
        <span>{{ $t('polling.responseCleaning') }}</span>
        <Switch v-model:checked="model.responseCleaningEnabled" />
      </label>
      <ResponseFieldMappingEditor
        v-if="model.responseCleaningEnabled"
        v-model="model.responseFieldMappings"
      />
    </section>

    <section class="route-section">
      <header class="section-heading">
        <div>
          <strong>{{ $t('polling.domain.nodesTitle') }}</strong>
          <p>{{ $t('polling.domain.nodesDescription') }}</p>
        </div>
        <Button type="primary" @click="addUpstream">
          <Plus class="size-4" />
          {{ $t('polling.domain.addNode') }}
        </Button>
      </header>
      <div v-if="model.upstreamConfigs.length" class="node-list">
        <div
          v-for="(item, nodeIndex) in model.upstreamConfigs"
          :key="item.clientId"
          class="node-row"
        >
          <span class="node-index">{{ nodeIndex + 1 }}</span>
          <div class="node-content">
            <div class="node-url-row">
              <Input
                v-model:value="item.url"
                :placeholder="$t('polling.domain.nodePlaceholder', [nodeIndex + 1])"
              />
              <Button
                :disabled="checking"
                :loading="checking"
                size="small"
                @click="requestCheck(item.url)"
              >
                <IconifyIcon class="size-3.5" icon="lucide:activity" />
                {{ $t('polling.check') }}
              </Button>
              <Button
                danger
                type="text"
                :aria-label="$t('polling.domain.removeNode', [nodeIndex + 1])"
                @click="removeUpstream(item.clientId)"
              >
                <IconifyIcon class="size-4" icon="lucide:trash-2" />
              </Button>
            </div>
            <div class="health-text">{{ healthText(item) }}</div>
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
              v-if="model.responseCleaningEnabled"
              v-model="item.responseFieldMappings"
            />
          </div>
        </div>
      </div>
      <div v-else class="empty">
        <Empty :description="$t('polling.domain.nodesEmpty')" />
      </div>
    </section>
  </section>
</template>

<style scoped>
.route-panel {
  display: grid;
  gap: 14px;
  padding: 16px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.route-header,
.section-heading,
.route-actions,
.route-heading,
.node-url-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.route-header,
.section-heading {
  justify-content: space-between;
}

.route-heading {
  min-width: 0;
}

.route-heading strong,
.section-heading strong {
  color: hsl(var(--foreground));
}

.route-heading p,
.section-heading p {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: hsl(var(--muted-foreground));
}

.route-index,
.node-index {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  font-size: 12px;
  font-weight: 700;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
  border-radius: 999px;
}

.route-actions {
  align-items: center;
}

.route-grid {
  display: grid;
  gap: 12px;
}

.route-grid--identity {
  grid-template-columns: minmax(120px, 0.8fr) minmax(160px, 1.4fr) 120px minmax(150px, 1fr);
}

.route-grid--match {
  grid-template-columns: minmax(130px, 0.8fr) minmax(180px, 1.3fr) minmax(140px, 0.9fr) minmax(130px, 0.8fr);
}

.field {
  display: grid;
  gap: 6px;
  min-width: 0;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.field--wide {
  grid-column: span 1;
}

.field--full {
  grid-column: 1 / -1;
}

.field--number :deep(.ant-input-number) {
  width: 100%;
}

.field small {
  line-height: 1.5;
  color: hsl(var(--muted-foreground));
}

.route-section {
  display: grid;
  gap: 12px;
  padding-top: 4px;
}

.route-health,
.health-text {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.route-health {
  display: flex;
  gap: 8px;
  align-items: center;
}

.route-health strong {
  color: hsl(var(--foreground));
}

.check-row {
  display: grid;
  grid-template-columns: auto auto minmax(120px, 1fr) auto minmax(110px, 1fr);
  gap: 8px;
  align-items: center;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.inline-switch {
  display: flex;
  gap: 10px;
  align-items: center;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.node-list {
  display: grid;
  gap: 10px;
}

.node-row {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  padding: 10px;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.node-content {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.node-url-row {
  align-items: center;
}

.node-url-row :deep(.ant-input) {
  min-width: 0;
}

.empty {
  padding: 14px;
  border: 1px dashed hsl(var(--border));
  border-radius: 6px;
}

@media (max-width: 820px) {
  .route-grid--identity,
  .route-grid--match {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .field--full {
    grid-column: 1 / -1;
  }
}

@media (max-width: 620px) {
  .route-header,
  .section-heading,
  .node-url-row {
    flex-direction: column;
  }

  .route-actions,
  .section-heading > :deep(button),
  .node-url-row > :deep(button) {
    width: 100%;
  }

  .route-grid--identity,
  .route-grid--match {
    grid-template-columns: minmax(0, 1fr);
  }

  .field--full {
    grid-column: auto;
  }

  .check-row {
    grid-template-columns: auto auto;
  }

  .check-row :deep(.ant-input) {
    grid-column: 1 / -1;
  }
}
</style>
