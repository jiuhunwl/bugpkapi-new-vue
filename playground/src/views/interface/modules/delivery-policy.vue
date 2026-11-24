<script setup lang="ts">
import type { InterfaceApi } from '#/api/interface';

import { computed, ref, shallowRef } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { IconifyIcon, Plus } from '@vben/icons';

import {
  Alert,
  Button,
  Empty,
  Input,
  InputNumber,
  message,
  Select,
  Switch,
  Tag,
} from 'ant-design-vue';

import {
  getGlobalDeliveryPolicy,
  getInterfaceDeliveryPolicy,
  getResponseAdvertisementOptions,
  updateGlobalDeliveryPolicy,
  updateInterfaceDeliveryPolicy,
} from '#/api/interface';
import { $t } from '#/locales';

import {
  normalizeStoredRequestTimeout,
  requestTimeoutValueForSave,
} from './delivery-policy-model';

interface CacheRuleDraft {
  clientId: string;
  expectedValue: string;
  fieldName: string;
  name: string;
  operator: InterfaceApi.CacheOperator;
  statusCode: number | undefined;
  ttlSeconds: number;
}

type DeliveryPolicyScope = 'GLOBAL' | 'INTERFACE';
type ResponseAdMode = 'FIXED' | 'RANDOM';

interface DeliveryPolicyTarget {
  id?: string;
  name?: string;
  scope?: DeliveryPolicyScope;
}

const emit = defineEmits<{ success: [] }>();

const id = shallowRef<string>();
const scope = shallowRef<DeliveryPolicyScope>('INTERFACE');
const current = ref<InterfaceApi.DeliveryPolicy>();
const globalPolicy = ref<InterfaceApi.DeliveryPolicy>();
const cachePolicyOverride = shallowRef(true);
const responseAdPolicyOverride = shallowRef(true);
const requestTimeoutOverride = shallowRef(true);
const cacheEnabled = shallowRef(false);
const cacheDefaultTtlSeconds = shallowRef(0);
const requestTimeoutMs = shallowRef(15000);
// Keep the persisted local value separate from the displayed effective value.
// When an interface inherits, the input shows the global timeout, which must
// not overwrite a previously configured local override on save.
const storedRequestTimeoutMs = shallowRef(0);
const responseAdEnabled = shallowRef(false);
const responseAdField = shallowRef('_advertisement');
const responseAdMode = shallowRef<ResponseAdMode>('RANDOM');
const responseAdId = shallowRef('');
const cacheRules = ref<CacheRuleDraft[]>([]);
const advertisementOptions = ref<InterfaceApi.ResponseAdvertisementOption[]>(
  [],
);
const advertisementLoadFailed = shallowRef(false);

const isGlobal = computed(() => scope.value === 'GLOBAL');
const cacheInherited = computed(
  () => !isGlobal.value && !cachePolicyOverride.value,
);
const responseAdInherited = computed(
  () => !isGlobal.value && !responseAdPolicyOverride.value,
);
const requestTimeoutInherited = computed(
  () => !isGlobal.value && !requestTimeoutOverride.value,
);
const effectiveCacheEnabled = computed(() =>
  cacheInherited.value
    ? globalPolicy.value?.cacheEnabled === 1
    : cacheEnabled.value,
);
const effectiveResponseAdEnabled = computed(() =>
  responseAdInherited.value
    ? globalPolicy.value?.responseAdEnabled === 1
    : responseAdEnabled.value,
);
const responseAdControlsDisabled = computed(
  () => responseAdInherited.value || !responseAdEnabled.value,
);
const globalRequestTimeoutMs = computed(
  () =>
    normalizeStoredRequestTimeout(
      globalPolicy.value?.effectiveRequestTimeoutMs,
    ) ||
    normalizeStoredRequestTimeout(globalPolicy.value?.requestTimeoutMs) ||
    15000,
);
const effectiveRequestTimeoutMs = computed(() =>
  requestTimeoutInherited.value
    ? globalRequestTimeoutMs.value
    : Number(requestTimeoutMs.value || globalRequestTimeoutMs.value),
);

const operatorOptions = [
  { label: '=', value: 'EQ' },
  { label: '≠', value: 'NE' },
  { label: 'Contains', value: 'CONTAINS' },
  { label: '>', value: 'GT' },
  { label: '<', value: 'LT' },
  { label: 'Exists', value: 'EXISTS' },
];

const responseAdvertisementSelectOptions = computed(() =>
  advertisementOptions.value.map((item) => ({
    label: `${item.name} · ${item.title}${
      item.status === 1 ? '' : ` · ${$t('advertisementAdmin.status.disabled')}`
    }`,
    value: item.id,
  })),
);

const drawerTitle = computed(() => {
  if (isGlobal.value) return $t('deliveryPolicy.globalTitle');
  return current.value?.name
    ? $t('deliveryPolicy.titleWithName', [current.value.name])
    : $t('deliveryPolicy.title');
});

const drawerDescription = computed(() =>
  isGlobal.value
    ? $t('deliveryPolicy.globalDescription')
    : $t('deliveryPolicy.description'),
);

const [Drawer, drawerApi] = useVbenDrawer({
  class: 'w-[94vw]! max-w-[980px]!',
  async onConfirm() {
    if (!current.value || (!isGlobal.value && !id.value)) return;
    const normalizedRules = normalizeRules();
    if (!normalizedRules) return;
    const timeout = normalizeRequestTimeout();
    if (timeout === null) return;
    const field = responseAdField.value.trim() || '_advertisement';
    if (!/^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(field)) {
      message.error($t('deliveryPolicy.messages.invalidField'));
      return;
    }
    const selectedResponseAdId =
      responseAdMode.value === 'FIXED'
        ? String(responseAdId.value ?? '').trim()
        : '0';
    if (
      !responseAdInherited.value &&
      responseAdEnabled.value &&
      responseAdMode.value === 'FIXED' &&
      !selectedResponseAdId
    ) {
      message.error($t('deliveryPolicy.messages.fixedAdRequired'));
      return;
    }

    drawerApi.lock();
    try {
      const payload: InterfaceApi.SaveDeliveryPolicy = {
        cacheDefaultTtlSeconds: normalizeDefaultTtl(
          cacheDefaultTtlSeconds.value,
        ),
        cacheEnabled: cacheEnabled.value ? 1 : 0,
        cachePolicyOverride: isGlobal.value
          ? 1
          : cachePolicyOverride.value
            ? 1
            : 0,
        cacheRules: normalizedRules,
        responseAdEnabled: responseAdEnabled.value ? 1 : 0,
        responseAdField: field,
        responseAdId: selectedResponseAdId || '0',
        responseAdPolicyOverride: isGlobal.value
          ? 1
          : responseAdPolicyOverride.value
            ? 1
            : 0,
        requestTimeoutMs: requestTimeoutValueForSave({
          displayedValue: timeout,
          inherited: !isGlobal.value && requestTimeoutInherited.value,
          storedLocalValue: storedRequestTimeoutMs.value,
        }),
        requestTimeoutOverride: isGlobal.value
          ? 1
          : requestTimeoutOverride.value
            ? 1
            : 0,
      };
      if (isGlobal.value) {
        await updateGlobalDeliveryPolicy(payload);
      } else {
        await updateInterfaceDeliveryPolicy(id.value!, payload);
      }
      message.success($t('deliveryPolicy.messages.saved'));
      emit('success');
      drawerApi.close();
    } catch {
      // The request client reports the failure; keep the draft available for retry.
    } finally {
      drawerApi.unlock();
    }
  },
  async onOpenChange(open) {
    if (!open) return;
    const row = drawerApi.getData<DeliveryPolicyTarget>();
    const targetScope: DeliveryPolicyScope =
      row?.scope === 'GLOBAL' ? 'GLOBAL' : 'INTERFACE';
    reset(row?.id, targetScope);
    if (!isGlobal.value && !row?.id) return;

    drawerApi.lock();
    try {
      const policyRequest = isGlobal.value
        ? getGlobalDeliveryPolicy()
        : getInterfaceDeliveryPolicy(row!.id!);
      const globalRequest = isGlobal.value
        ? Promise.resolve(undefined)
        : getGlobalDeliveryPolicy();
      const [policy, global, ads] = await Promise.all([
        policyRequest,
        globalRequest,
        getResponseAdvertisementOptions().catch(() => {
          advertisementLoadFailed.value = true;
          return [];
        }),
      ]);
      current.value = policy;
      globalPolicy.value = global ?? (isGlobal.value ? policy : undefined);
      cachePolicyOverride.value =
        isGlobal.value || policy.cachePolicyOverride !== 0;
      responseAdPolicyOverride.value =
        isGlobal.value || policy.responseAdPolicyOverride !== 0;
      requestTimeoutOverride.value =
        isGlobal.value || policy.requestTimeoutOverride === 1;
      storedRequestTimeoutMs.value = normalizeStoredRequestTimeout(
        policy.requestTimeoutMs,
      );
      cacheEnabled.value = policy.cacheEnabled === 1;
      cacheDefaultTtlSeconds.value = normalizeDefaultTtl(
        policy.cacheDefaultTtlSeconds,
      );
      requestTimeoutMs.value = isGlobal.value
        ? normalizeRequestTimeoutDisplay(
            policy.requestTimeoutMs,
            policy.effectiveRequestTimeoutMs,
          )
        : storedRequestTimeoutMs.value;
      responseAdEnabled.value = policy.responseAdEnabled === 1;
      responseAdField.value = policy.responseAdField || '_advertisement';
      const savedResponseAdId = String(policy.responseAdId || '0');
      responseAdMode.value = savedResponseAdId === '0' ? 'RANDOM' : 'FIXED';
      responseAdId.value = savedResponseAdId === '0' ? '' : savedResponseAdId;
      cacheRules.value = (policy.cacheRules ?? []).map((rule) => ({
        clientId: createClientId(),
        expectedValue: rule.expectedValue ?? '',
        fieldName: rule.fieldName ?? '',
        name: rule.name ?? '',
        operator: normalizeOperator(rule.operator),
        statusCode: rule.statusCode > 0 ? rule.statusCode : undefined,
        ttlSeconds: Math.max(1, Number(rule.ttlSeconds || 60)),
      }));
      advertisementOptions.value = ads;
    } catch {
      // Never expose a default draft as a loaded policy after either GET fails.
      current.value = undefined;
      drawerApi.close();
    } finally {
      drawerApi.unlock();
    }
  },
});

function reset(
  interfaceId?: string,
  targetScope: DeliveryPolicyScope = 'INTERFACE',
) {
  id.value = interfaceId;
  scope.value = targetScope;
  current.value = undefined;
  globalPolicy.value = undefined;
  cachePolicyOverride.value = true;
  responseAdPolicyOverride.value = true;
  requestTimeoutOverride.value = true;
  cacheEnabled.value = false;
  cacheDefaultTtlSeconds.value = 0;
  requestTimeoutMs.value = 15000;
  storedRequestTimeoutMs.value = 0;
  responseAdEnabled.value = false;
  responseAdField.value = '_advertisement';
  responseAdMode.value = 'RANDOM';
  responseAdId.value = '';
  cacheRules.value = [];
  advertisementOptions.value = [];
  advertisementLoadFailed.value = false;
}

function addRule() {
  if (cacheRules.value.length >= 20) return;
  cacheRules.value.push({
    clientId: createClientId(),
    expectedValue: '0',
    fieldName: 'code',
    name: '',
    operator: 'EQ',
    statusCode: 200,
    ttlSeconds: 60,
  });
}

function removeRule(index: number) {
  cacheRules.value.splice(index, 1);
}

function selectResponseAdMode(mode: ResponseAdMode) {
  if (responseAdControlsDisabled.value) return;
  responseAdMode.value = mode;
}

function normalizeRules(): InterfaceApi.ResponseCacheRule[] | null {
  const result: InterfaceApi.ResponseCacheRule[] = [];
  for (const [index, draft] of cacheRules.value.entries()) {
    const fieldName = draft.fieldName.trim();
    const statusCode = Number(draft.statusCode || 0);
    const ttlSeconds = Math.trunc(Number(draft.ttlSeconds || 0));
    const operator = fieldName ? normalizeOperator(draft.operator) : 'EQ';
    const validStatus =
      statusCode === 0 || (statusCode >= 100 && statusCode <= 599);
    if (
      (!fieldName && statusCode === 0) ||
      !validStatus ||
      ttlSeconds < 1 ||
      ttlSeconds > 86_400 ||
      fieldName.length > 128 ||
      draft.name.trim().length > 64
    ) {
      message.error($t('deliveryPolicy.messages.invalidRule', [index + 1]));
      return null;
    }
    result.push({
      expectedValue:
        operator === 'EXISTS' ? '' : String(draft.expectedValue ?? ''),
      fieldName,
      name: draft.name.trim(),
      operator,
      sortNo: index + 1,
      statusCode,
      ttlSeconds,
    });
  }
  return result;
}

function normalizeDefaultTtl(value: unknown) {
  const ttl = Math.trunc(Number(value || 0));
  return Math.max(0, Math.min(86_400, Number.isFinite(ttl) ? ttl : 0));
}

function normalizeRequestTimeoutDisplay(value: unknown, effective?: unknown) {
  const candidate = Math.trunc(Number(value || effective || 15000));
  return Math.max(
    100,
    Math.min(120000, Number.isFinite(candidate) ? candidate : 15000),
  );
}

// Validate here instead of using InputNumber min/max: its blur handler would
// silently turn an empty global value into 100 or an invalid local value into 0.
function normalizeRequestTimeout(): null | number {
  const timeout = Math.trunc(Number(requestTimeoutMs.value || 0));
  if (!isGlobal.value && (requestTimeoutInherited.value || timeout === 0)) {
    return 0;
  }
  if (!Number.isFinite(timeout) || timeout < 100 || timeout > 120000) {
    message.error(
      $t(
        isGlobal.value
          ? 'deliveryPolicy.messages.invalidTimeout'
          : 'deliveryPolicy.messages.invalidInterfaceTimeout',
      ),
    );
    return null;
  }
  return timeout;
}

function onRequestTimeoutInput(value: unknown) {
  requestTimeoutMs.value = Number(value ?? 0);
  const normalized = normalizeStoredRequestTimeout(value);
  if (
    requestTimeoutOverride.value &&
    (requestTimeoutMs.value === 0 || normalized > 0)
  ) {
    // Invalid drafts must not erase the last valid local value on disable.
    storedRequestTimeoutMs.value = normalized;
  }
}

function onRequestTimeoutOverrideChange(value: unknown) {
  const nextValue = value === true || value === 'true';
  requestTimeoutOverride.value = nextValue;
  if (nextValue) {
    requestTimeoutMs.value = storedRequestTimeoutMs.value;
  }
}

function normalizeOperator(value: unknown): InterfaceApi.CacheOperator {
  if (
    value === 'CONTAINS' ||
    value === 'EXISTS' ||
    value === 'GT' ||
    value === 'LT' ||
    value === 'NE'
  ) {
    return value;
  }
  return 'EQ';
}

function createClientId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `cache-rule-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}
</script>

<template>
  <Drawer :title="drawerTitle">
    <div class="delivery-policy">
      <p class="delivery-policy__description">
        {{ drawerDescription }}
      </p>

      <section v-if="!isGlobal" class="policy-priority">
        <header class="policy-panel__header">
          <div>
            <h3>{{ $t('deliveryPolicy.inheritance.title') }}</h3>
            <p>{{ $t('deliveryPolicy.inheritance.description') }}</p>
          </div>
          <Tag color="warning">
            {{ $t('deliveryPolicy.inheritance.priority') }}
          </Tag>
        </header>
        <div class="policy-override-grid">
          <div class="policy-field policy-field--switch">
            <span>{{ $t('deliveryPolicy.inheritance.cacheOverride') }}</span>
            <Switch v-model:checked="cachePolicyOverride" />
          </div>
          <div class="policy-field policy-field--switch">
            <span>{{ $t('deliveryPolicy.inheritance.adOverride') }}</span>
            <Switch v-model:checked="responseAdPolicyOverride" />
          </div>
          <div class="policy-field policy-field--switch">
            <span>{{ $t('deliveryPolicy.inheritance.timeoutOverride') }}</span>
            <Switch
              :aria-label="$t('deliveryPolicy.inheritance.timeoutOverride')"
              :checked="requestTimeoutOverride"
              @update:checked="onRequestTimeoutOverrideChange"
            />
          </div>
        </div>
        <Alert
          v-if="
            cacheInherited || responseAdInherited || requestTimeoutInherited
          "
          :description="$t('deliveryPolicy.inheritance.inheritedHelp')"
          show-icon
          type="info"
        />
      </section>

      <section class="policy-panel" data-testid="delivery-policy-timeout">
        <header class="policy-panel__header">
          <div>
            <h3>{{ $t('deliveryPolicy.timeout.title') }}</h3>
            <p>{{ $t('deliveryPolicy.timeout.help') }}</p>
          </div>
          <Tag color="processing">
            {{
              $t('deliveryPolicy.timeout.effective', [
                effectiveRequestTimeoutMs,
              ])
            }}
          </Tag>
        </header>

        <div class="policy-field">
          <span>{{ $t('deliveryPolicy.timeout.value') }}</span>
          <InputNumber
            :aria-label="$t('deliveryPolicy.timeout.value')"
            :value="
              requestTimeoutInherited
                ? effectiveRequestTimeoutMs
                : requestTimeoutMs
            "
            class="w-full"
            :disabled="requestTimeoutInherited"
            :precision="0"
            @update:value="onRequestTimeoutInput"
          />
          <small>{{
            $t(
              isGlobal
                ? 'deliveryPolicy.timeout.milliseconds'
                : 'deliveryPolicy.timeout.interfaceMilliseconds',
            )
          }}</small>
        </div>
        <Alert
          v-if="
            !isGlobal && (requestTimeoutInherited || requestTimeoutMs === 0)
          "
          :description="
            $t('deliveryPolicy.timeout.inheritedHelp', [
              effectiveRequestTimeoutMs,
            ])
          "
          show-icon
          type="info"
        />
      </section>

      <section class="policy-panel">
        <header class="policy-panel__header">
          <div>
            <h3>{{ $t('deliveryPolicy.cache.title') }}</h3>
            <p>{{ $t('deliveryPolicy.cache.defaultTtlHelp') }}</p>
          </div>
          <Tag :color="effectiveCacheEnabled ? 'success' : 'default'">
            {{
              effectiveCacheEnabled
                ? $t('deliveryPolicy.status.enabled')
                : $t('deliveryPolicy.status.disabled')
            }}
          </Tag>
        </header>

        <div class="policy-field policy-field--switch">
          <span>{{ $t('deliveryPolicy.cache.enabled') }}</span>
          <Switch v-model:checked="cacheEnabled" :disabled="cacheInherited" />
        </div>
        <div class="policy-field">
          <span>{{ $t('deliveryPolicy.cache.defaultTtl') }}</span>
          <InputNumber
            v-model:value="cacheDefaultTtlSeconds"
            class="w-full"
            :disabled="cacheInherited"
            :max="86_400"
            :min="0"
            :precision="0"
          />
          <small>{{ $t('deliveryPolicy.cache.seconds') }}</small>
        </div>

        <Alert
          :description="$t('deliveryPolicy.cache.failOpen')"
          show-icon
          type="info"
        />

        <div class="policy-rules-header">
          <div>
            <h4>{{ $t('deliveryPolicy.rules.title') }}</h4>
            <span>{{ cacheRules.length }}/20</span>
          </div>
          <Button
            :disabled="cacheInherited || cacheRules.length >= 20"
            size="small"
            type="primary"
            @click="addRule"
          >
            <Plus class="size-4" />
            {{ $t('deliveryPolicy.rules.add') }}
          </Button>
        </div>

        <div v-if="cacheRules.length" class="policy-rule-list">
          <article
            v-for="(rule, index) in cacheRules"
            :key="rule.clientId"
            class="policy-rule"
          >
            <div class="policy-rule__index">{{ index + 1 }}</div>
            <div class="policy-rule__fields">
              <label>
                <span>{{ $t('deliveryPolicy.rules.name') }}</span>
                <Input
                  v-model:value="rule.name"
                  :disabled="cacheInherited"
                  :maxlength="64"
                  :placeholder="$t('deliveryPolicy.rules.namePlaceholder')"
                />
              </label>
              <label>
                <span>{{ $t('deliveryPolicy.rules.status') }}</span>
                <InputNumber
                  v-model:value="rule.statusCode"
                  class="w-full"
                  :disabled="cacheInherited"
                  :max="599"
                  :min="100"
                  :precision="0"
                />
              </label>
              <label>
                <span>{{ $t('deliveryPolicy.rules.field') }}</span>
                <Input
                  v-model:value="rule.fieldName"
                  :disabled="cacheInherited"
                  :maxlength="128"
                  :placeholder="$t('deliveryPolicy.rules.fieldPlaceholder')"
                />
              </label>
              <label>
                <span>{{ $t('deliveryPolicy.rules.operator') }}</span>
                <Select
                  v-model:value="rule.operator"
                  class="w-full"
                  :disabled="cacheInherited || !rule.fieldName.trim()"
                  :options="operatorOptions"
                />
              </label>
              <label>
                <span>{{ $t('deliveryPolicy.rules.expected') }}</span>
                <Input
                  v-model:value="rule.expectedValue"
                  :disabled="
                    cacheInherited ||
                    !rule.fieldName.trim() ||
                    rule.operator === 'EXISTS'
                  "
                  :maxlength="512"
                />
              </label>
              <label>
                <span>{{ $t('deliveryPolicy.rules.ttl') }}</span>
                <InputNumber
                  v-model:value="rule.ttlSeconds"
                  class="w-full"
                  :disabled="cacheInherited"
                  :max="86_400"
                  :min="1"
                  :precision="0"
                />
              </label>
            </div>
            <Button
              danger
              type="text"
              :disabled="cacheInherited"
              :aria-label="$t('deliveryPolicy.rules.remove', [index + 1])"
              @click="removeRule(index)"
            >
              <IconifyIcon class="size-4" icon="lucide:trash-2" />
            </Button>
          </article>
        </div>
        <div v-else class="policy-empty">
          <Empty :description="$t('deliveryPolicy.rules.empty')" />
        </div>
      </section>

      <section class="policy-panel">
        <header class="policy-panel__header">
          <div>
            <h3>{{ $t('deliveryPolicy.ad.title') }}</h3>
            <p>{{ $t('deliveryPolicy.ad.fieldHelp') }}</p>
          </div>
          <Tag :color="effectiveResponseAdEnabled ? 'processing' : 'default'">
            {{
              effectiveResponseAdEnabled
                ? $t('deliveryPolicy.status.enabled')
                : $t('deliveryPolicy.status.disabled')
            }}
          </Tag>
        </header>

        <Alert
          v-if="advertisementLoadFailed"
          :message="$t('deliveryPolicy.ad.loadFailed')"
          show-icon
          type="warning"
        />
        <div class="policy-field policy-field--switch">
          <span>{{ $t('deliveryPolicy.ad.enabled') }}</span>
          <Switch
            v-model:checked="responseAdEnabled"
            :disabled="responseAdInherited"
          />
        </div>
        <div class="policy-strategy">
          <span class="policy-strategy__label">
            {{ $t('deliveryPolicy.ad.strategy') }}
          </span>
          <div class="policy-strategy__options" role="radiogroup">
            <button
              :aria-checked="responseAdMode === 'RANDOM'"
              class="policy-strategy-card"
              :class="{
                'policy-strategy-card--active': responseAdMode === 'RANDOM',
              }"
              :disabled="responseAdControlsDisabled"
              role="radio"
              type="button"
              @click="selectResponseAdMode('RANDOM')"
            >
              <span class="policy-strategy-card__icon">
                <IconifyIcon class="size-5" icon="lucide:shuffle" />
              </span>
              <span class="policy-strategy-card__copy">
                <strong>{{ $t('deliveryPolicy.ad.randomTitle') }}</strong>
                <small>{{ $t('deliveryPolicy.ad.randomDescription') }}</small>
              </span>
              <IconifyIcon
                v-if="responseAdMode === 'RANDOM'"
                class="policy-strategy-card__check size-4"
                icon="lucide:circle-check"
              />
            </button>
            <button
              :aria-checked="responseAdMode === 'FIXED'"
              class="policy-strategy-card"
              :class="{
                'policy-strategy-card--active': responseAdMode === 'FIXED',
              }"
              :disabled="responseAdControlsDisabled"
              role="radio"
              type="button"
              @click="selectResponseAdMode('FIXED')"
            >
              <span class="policy-strategy-card__icon">
                <IconifyIcon class="size-5" icon="lucide:pin" />
              </span>
              <span class="policy-strategy-card__copy">
                <strong>{{ $t('deliveryPolicy.ad.fixedTitle') }}</strong>
                <small>{{ $t('deliveryPolicy.ad.fixedDescription') }}</small>
              </span>
              <IconifyIcon
                v-if="responseAdMode === 'FIXED'"
                class="policy-strategy-card__check size-4"
                icon="lucide:circle-check"
              />
            </button>
          </div>
        </div>
        <div
          v-if="responseAdMode === 'FIXED'"
          class="policy-field policy-field--wide"
        >
          <span>{{ $t('deliveryPolicy.ad.fixedSelect') }}</span>
          <Select
            v-model:value="responseAdId"
            class="w-full"
            :disabled="responseAdControlsDisabled"
            :filter-option="true"
            option-filter-prop="label"
            :options="responseAdvertisementSelectOptions"
            :placeholder="$t('deliveryPolicy.ad.fixedPlaceholder')"
            show-search
          />
        </div>
        <div class="policy-field policy-field--wide">
          <span>{{ $t('deliveryPolicy.ad.field') }}</span>
          <Input
            v-model:value="responseAdField"
            :disabled="responseAdInherited || !responseAdEnabled"
            :maxlength="64"
            placeholder="_advertisement"
          />
        </div>
      </section>
    </div>
  </Drawer>
</template>

<style scoped>
.delivery-policy {
  display: grid;
  gap: 18px;
}

.delivery-policy__description {
  margin: 0;
  line-height: 1.7;
  color: hsl(var(--muted-foreground));
}

.policy-panel,
.policy-priority {
  display: grid;
  gap: 16px;
  padding: 18px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.policy-priority {
  background: hsl(var(--muted) / 24%);
}

.policy-override-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 20px;
}

.policy-panel__header {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
}

.policy-panel__header h3,
.policy-rules-header h4 {
  margin: 0;
  font-weight: 700;
  color: hsl(var(--foreground));
}

.policy-panel__header h3 {
  font-size: 17px;
}

.policy-panel__header p {
  margin: 5px 0 0;
  font-size: 12px;
  line-height: 1.65;
  color: hsl(var(--muted-foreground));
}

.policy-field {
  display: grid;
  grid-template-columns: 170px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
}

.policy-field > span,
.policy-rule label > span {
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.policy-field small {
  color: hsl(var(--muted-foreground));
}

.policy-field--switch {
  grid-template-columns: minmax(0, 1fr) auto;
}

.policy-field--wide {
  grid-template-columns: 170px minmax(0, 1fr);
}

.policy-strategy {
  display: grid;
  gap: 9px;
}

.policy-strategy__label {
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.policy-strategy__options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.policy-strategy-card {
  position: relative;
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  gap: 11px;
  min-height: 96px;
  padding: 14px;
  text-align: left;
  cursor: pointer;
  background: hsl(var(--muted) / 22%);
  border: 1px solid hsl(var(--border));
  border-radius: 9px;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    transform 160ms ease;
}

.policy-strategy-card:not(:disabled):hover {
  border-color: hsl(var(--primary) / 55%);
  transform: translateY(-1px);
}

.policy-strategy-card:focus-visible {
  outline: 2px solid hsl(var(--primary));
  outline-offset: 2px;
}

.policy-strategy-card:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.policy-strategy-card--active {
  background: linear-gradient(
    145deg,
    hsl(var(--primary) / 11%),
    hsl(var(--card)) 76%
  );
  border-color: hsl(var(--primary));
  box-shadow: 0 8px 22px hsl(var(--primary) / 9%);
}

.policy-strategy-card__icon {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
  border-radius: 9px;
}

.policy-strategy-card__copy {
  display: grid;
  gap: 5px;
  min-width: 0;
  padding-right: 14px;
}

.policy-strategy-card__copy strong {
  font-size: 13px;
  line-height: 1.45;
  color: hsl(var(--foreground));
}

.policy-strategy-card__copy small {
  font-size: 12px;
  line-height: 1.6;
  color: hsl(var(--muted-foreground));
}

.policy-strategy-card__check {
  position: absolute;
  top: 12px;
  right: 12px;
  color: hsl(var(--primary));
}

.policy-rules-header {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding-top: 4px;
}

.policy-rules-header > div {
  display: flex;
  gap: 8px;
  align-items: baseline;
}

.policy-rules-header span {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.policy-rule-list {
  display: grid;
  gap: 12px;
}

.policy-rule {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) 36px;
  gap: 10px;
  align-items: start;
  padding: 14px;
  background: hsl(var(--muted) / 34%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.policy-rule__index {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  font-size: 12px;
  font-weight: 700;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
  border-radius: 999px;
}

.policy-rule__fields {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.policy-rule label {
  display: grid;
  gap: 6px;
}

.policy-empty {
  padding: 16px;
  border: 1px dashed hsl(var(--border));
  border-radius: 8px;
}

@media (max-width: 760px) {
  .policy-panel__header {
    flex-direction: column;
  }

  .policy-field,
  .policy-field--wide {
    grid-template-columns: 1fr;
  }

  .policy-field--switch {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .policy-rule {
    grid-template-columns: 28px minmax(0, 1fr) 32px;
    padding: 12px 8px;
  }

  .policy-rule__fields {
    grid-template-columns: 1fr;
  }

  .policy-override-grid {
    grid-template-columns: 1fr;
  }

  .policy-strategy__options {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .policy-strategy-card {
    transition: none;
  }
}
</style>
