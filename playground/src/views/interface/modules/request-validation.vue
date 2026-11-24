<script setup lang="ts">
import type {
  RequestValidationPresetKey,
  RequestValidationRuleDraft,
} from '../request-validation';

import type { InterfaceApi } from '#/api/interface';

import { computed, ref, shallowRef } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import {
  Alert,
  Button,
  Empty,
  message,
  Modal,
  Select,
  Switch,
  Tag,
} from 'ant-design-vue';

import {
  getInterfaceRequestValidation,
  updateInterfaceRequestValidation,
} from '#/api/interface';
import { $t } from '#/locales';

import {
  buildRequestValidationPreset,
  createEmptyRuleDraft,
  operatorNeedsExpectedValue,
  requestValidationPresetDomains,
  suggestedRequestParameterField,
  toRequestValidationRuleDraft,
  toRequestValidationRules,
} from '../request-validation';
import RequestValidationPresetPanel from './RequestValidationPresetPanel.vue';
import RequestValidationRuleCard from './RequestValidationRuleCard.vue';

const emit = defineEmits<{ success: [] }>();

const current = shallowRef<InterfaceApi.InterfaceItem>();
const enabled = shallowRef(false);
const defaultResult = shallowRef<InterfaceApi.RequestValidationResult>('PASS');
const rules = ref<RequestValidationRuleDraft[]>([]);
const presetKey = shallowRef<RequestValidationPresetKey>(
  'GENERIC_SHARE_LINK',
);
const presetFieldName = shallowRef('url');

const presetOptions = computed(() => [
  {
    label: $t('requestValidation.preset.options.generic'),
    value: 'GENERIC_SHARE_LINK' as const,
  },
  {
    label: $t('requestValidation.preset.options.custom'),
    value: 'CUSTOM_PLATFORM' as const,
  },
  { label: $t('requestValidation.preset.options.douyin'), value: 'DOUYIN' as const },
  {
    label: $t('requestValidation.preset.options.kuaishou'),
    value: 'KUAISHOU' as const,
  },
  {
    label: $t('requestValidation.preset.options.xiaohongshu'),
    value: 'XIAOHONGSHU' as const,
  },
  {
    label: $t('requestValidation.preset.options.bilibili'),
    value: 'BILIBILI' as const,
  },
  { label: $t('requestValidation.preset.options.tiktok'), value: 'TIKTOK' as const },
  { label: $t('requestValidation.preset.options.youtube'), value: 'YOUTUBE' as const },
]);

const defaultResultOptions: Array<{
  label: string;
  value: InterfaceApi.RequestValidationResult;
}> = [
  { label: $t('requestValidation.results.pass'), value: 'PASS' },
  {
    label: $t('requestValidation.results.invalidParams'),
    value: 'INVALID_PARAMS',
  },
  {
    label: $t('requestValidation.results.platformMismatch'),
    value: 'PLATFORM_MISMATCH',
  },
];

const presetDomainPreview = computed(() => {
  if (presetKey.value === 'GENERIC_SHARE_LINK') return '';
  return requestValidationPresetDomains[presetKey.value].join(', ');
});

const drawerTitle = computed(() =>
  current.value?.name
    ? $t('requestValidation.titleWithName', [current.value.name])
    : $t('requestValidation.title'),
);

const [Drawer, drawerApi] = useVbenDrawer({
  class: 'w-[96vw]! max-w-[1180px]!',
  async onConfirm() {
    const target = current.value;
    if (!target?.id) return;
    const payloadRules = validateAndBuildRules();
    if (!payloadRules) return;

    drawerApi.lock();
    try {
      await updateInterfaceRequestValidation(target.id, {
        defaultResult: defaultResult.value,
        enabled: enabled.value ? 1 : 0,
        rules: payloadRules,
      });
      message.success($t('requestValidation.messages.saved'));
      emit('success');
      drawerApi.close();
    } finally {
      drawerApi.unlock();
    }
  },
  async onOpenChange(open) {
    if (!open) return;
    const row = drawerApi.getData<InterfaceApi.InterfaceItem>();
    reset(row);
    if (!row?.id) return;

    drawerApi.lock();
    try {
      const policy = await getInterfaceRequestValidation(row.id);
      current.value = { ...row, name: policy.name || row.name };
      enabled.value = policy.enabled === 1;
      defaultResult.value = policy.defaultResult || 'PASS';
      rules.value = (policy.rules ?? []).map(toRequestValidationRuleDraft);
    } finally {
      drawerApi.unlock();
    }
  },
});

function reset(item?: InterfaceApi.InterfaceItem) {
  current.value = item;
  enabled.value = false;
  defaultResult.value = 'PASS';
  rules.value = [];
  presetKey.value = 'GENERIC_SHARE_LINK';
  presetFieldName.value = suggestedRequestParameterField(item);
}

function addRule() {
  if (rules.value.length >= 20) return;
  const draft = createEmptyRuleDraft();
  draft.sortNo = rules.value.length + 1;
  draft.conditions[0]!.fieldName = presetFieldName.value.trim() || 'url';
  rules.value.push(draft);
}

function removeRule(index: number) {
  rules.value.splice(index, 1);
}

function replaceRule(index: number, rule: RequestValidationRuleDraft) {
  rules.value[index] = rule;
}

function applyPreset() {
  const fieldName = presetFieldName.value.trim();
  if (!fieldName) {
    message.warning($t('requestValidation.messages.parameterRequired'));
    return;
  }
  const apply = () => {
    const preset = buildRequestValidationPreset(presetKey.value, fieldName, {
      invalidRule: $t('requestValidation.preset.invalidRule'),
      passRule: $t('requestValidation.preset.passRule'),
    });
    enabled.value = true;
    defaultResult.value = preset.defaultResult;
    rules.value = preset.rules.map(toRequestValidationRuleDraft);
    message.success($t('requestValidation.messages.presetApplied'));
  };
  if (rules.value.length === 0) {
    apply();
    return;
  }
  Modal.confirm({
    content: $t('requestValidation.preset.replaceDescription'),
    okText: $t('requestValidation.preset.replaceAction'),
    onOk: apply,
    title: $t('requestValidation.preset.replaceTitle'),
  });
}

function validateAndBuildRules(): InterfaceApi.RequestValidationRule[] | null {
  if (rules.value.length > 20) {
    message.error($t('requestValidation.messages.tooManyRules'));
    return null;
  }
  for (const [ruleIndex, rule] of rules.value.entries()) {
    if (rule.name.trim().length > 64 || rule.conditions.length === 0) {
      message.error(
        $t('requestValidation.messages.invalidRule', [ruleIndex + 1]),
      );
      return null;
    }
    for (const condition of rule.conditions) {
      if (
        !condition.fieldName.trim() ||
        condition.fieldName.trim().length > 128 ||
        (operatorNeedsExpectedValue(condition.operator) &&
          !condition.expectedValue.trim())
      ) {
        message.error(
          $t('requestValidation.messages.invalidRule', [ruleIndex + 1]),
        );
        return null;
      }
    }
  }
  return toRequestValidationRules(rules.value);
}
</script>

<template>
  <Drawer :title="drawerTitle">
    <div class="request-validation">
      <Alert
        :description="$t('requestValidation.description')"
        show-icon
        type="info"
      />

      <section class="policy-settings">
        <header class="policy-settings__header">
          <div>
            <h3>{{ $t('requestValidation.settings.title') }}</h3>
            <p>{{ $t('requestValidation.settings.description') }}</p>
          </div>
          <Tag :color="enabled ? 'success' : 'default'">
            {{
              enabled
                ? $t('requestValidation.status.enabled')
                : $t('requestValidation.status.disabled')
            }}
          </Tag>
        </header>
        <div class="policy-settings__grid">
          <label class="policy-field policy-field--switch">
            <span>{{ $t('requestValidation.settings.enabled') }}</span>
            <Switch v-model:checked="enabled" />
          </label>
          <label class="policy-field">
            <span>{{ $t('requestValidation.settings.defaultResult') }}</span>
            <Select
              v-model:value="defaultResult"
              class="w-full"
              :options="defaultResultOptions"
            />
          </label>
        </div>
        <p class="policy-settings__hint">
          {{ $t('requestValidation.settings.defaultResultHelp') }}
        </p>
      </section>

      <RequestValidationPresetPanel
        v-model:field-name="presetFieldName"
        v-model:preset-key="presetKey"
        :domain-preview="presetDomainPreview"
        :options="presetOptions"
        @apply="applyPreset"
      />

      <section class="rules-panel">
        <header class="rules-panel__header">
          <div>
            <h3>{{ $t('requestValidation.rules.title') }}</h3>
            <p>{{ $t('requestValidation.rules.description') }}</p>
          </div>
          <div class="rules-panel__actions">
            <span>{{ rules.length }}/20</span>
            <Button
              type="primary"
              :disabled="rules.length >= 20"
              @click="addRule"
            >
              <Plus class="size-4" />
              {{ $t('requestValidation.rules.add') }}
            </Button>
          </div>
        </header>

        <div v-if="rules.length" class="rules-panel__list">
          <RequestValidationRuleCard
            v-for="(rule, index) in rules"
            :key="rule.clientId"
            :index="index"
            :model-value="rule"
            @update:model-value="replaceRule(index, $event)"
            @remove="removeRule(index)"
          />
        </div>
        <div v-else class="rules-panel__empty">
          <Empty :description="$t('requestValidation.rules.empty')" />
        </div>
      </section>
    </div>
  </Drawer>
</template>

<style scoped>
.request-validation {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
}

.policy-settings,
.rules-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
}

.policy-settings__header,
.rules-panel__header {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
}

.policy-settings__header h3,
.rules-panel__header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: hsl(var(--foreground));
}

.policy-settings__header p,
.rules-panel__header p {
  margin: 5px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: hsl(var(--muted-foreground));
}

.policy-settings__grid {
  display: grid;
  grid-template-columns: minmax(220px, 0.8fr) minmax(260px, 1.2fr);
  gap: 16px;
}

.policy-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.policy-field--switch {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  min-height: 32px;
}

.policy-settings__hint {
  margin: 0;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.rules-panel__actions {
  display: flex;
  gap: 12px;
  align-items: center;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.rules-panel__list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.rules-panel__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 220px;
  border: 1px dashed hsl(var(--border));
  border-radius: 8px;
}

@media (max-width: 768px) {
  .policy-settings__grid {
    grid-template-columns: 1fr;
  }

  .policy-settings__header,
  .rules-panel__header {
    flex-direction: column;
  }
}
</style>
