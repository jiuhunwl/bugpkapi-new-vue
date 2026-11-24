<script setup lang="ts">
import type { RequestValidationRuleDraft } from '../request-validation';

import type { InterfaceApi } from '#/api/interface';

import { computed } from 'vue';

import { IconifyIcon, Plus } from '@vben/icons';

import { Button, Input, Select } from 'ant-design-vue';

import { $t } from '#/locales';

import {
  createConditionDraft,
  operatorNeedsExpectedValue,
} from '../request-validation';

const props = withDefaults(
  defineProps<{
    index: number;
    maxConditions?: number;
  }>(),
  { maxConditions: 10 },
);

const emit = defineEmits<{ remove: [] }>();
const model = defineModel<RequestValidationRuleDraft>({ required: true });

const resultOptions: Array<{
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

const logicOptions: Array<{
  label: string;
  value: InterfaceApi.RequestValidationLogic;
}> = [
  { label: $t('requestValidation.logic.all'), value: 'ALL' },
  { label: $t('requestValidation.logic.any'), value: 'ANY' },
];

const sourceOptions: Array<{
  label: string;
  value: InterfaceApi.RequestValidationSource;
}> = [
  { label: $t('requestValidation.sources.auto'), value: 'AUTO' },
  { label: 'Query', value: 'QUERY' },
  { label: 'Body', value: 'BODY' },
];

const operatorOptions: Array<{
  label: string;
  value: InterfaceApi.RequestValidationOperator;
}> = [
  { label: $t('requestValidation.operators.exists'), value: 'EXISTS' },
  {
    label: $t('requestValidation.operators.notExists'),
    value: 'NOT_EXISTS',
  },
  { label: $t('requestValidation.operators.empty'), value: 'EMPTY' },
  {
    label: $t('requestValidation.operators.notEmpty'),
    value: 'NOT_EMPTY',
  },
  { label: $t('requestValidation.operators.eq'), value: 'EQ' },
  { label: $t('requestValidation.operators.ne'), value: 'NE' },
  {
    label: $t('requestValidation.operators.contains'),
    value: 'CONTAINS',
  },
  {
    label: $t('requestValidation.operators.notContains'),
    value: 'NOT_CONTAINS',
  },
  {
    label: $t('requestValidation.operators.startsWith'),
    value: 'STARTS_WITH',
  },
  {
    label: $t('requestValidation.operators.endsWith'),
    value: 'ENDS_WITH',
  },
  { label: $t('requestValidation.operators.regex'), value: 'REGEX' },
  {
    label: $t('requestValidation.operators.notRegex'),
    value: 'NOT_REGEX',
  },
  { label: $t('requestValidation.operators.isUrl'), value: 'IS_URL' },
  {
    label: $t('requestValidation.operators.notUrl'),
    value: 'NOT_URL',
  },
  {
    label: $t('requestValidation.operators.hasDomain'),
    value: 'HAS_DOMAIN',
  },
  {
    label: $t('requestValidation.operators.notHasDomain'),
    value: 'NOT_HAS_DOMAIN',
  },
  {
    label: $t('requestValidation.operators.domainIn'),
    value: 'DOMAIN_IN',
  },
  {
    label: $t('requestValidation.operators.domainNotIn'),
    value: 'DOMAIN_NOT_IN',
  },
];

const canAddCondition = computed(
  () => model.value.conditions.length < props.maxConditions,
);

function addCondition() {
  if (!canAddCondition.value) return;
  const fieldName = model.value.conditions[0]?.fieldName || 'url';
  model.value.conditions.push(createConditionDraft({ fieldName }));
}

function removeCondition(index: number) {
  if (model.value.conditions.length <= 1) return;
  model.value.conditions.splice(index, 1);
}

function expectedPlaceholder(
  operator: InterfaceApi.RequestValidationOperator,
) {
  if (operator === 'DOMAIN_IN' || operator === 'DOMAIN_NOT_IN') {
    return $t('requestValidation.conditions.domainPlaceholder');
  }
  if (operator === 'REGEX' || operator === 'NOT_REGEX') {
    return $t('requestValidation.conditions.regexPlaceholder');
  }
  return $t('requestValidation.conditions.expectedPlaceholder');
}
</script>

<template>
  <article class="rule-card">
    <header class="rule-card__header">
      <div class="rule-card__number">{{ index + 1 }}</div>
      <Input
        v-model:value="model.name"
        class="rule-card__name"
        :maxlength="64"
        :placeholder="$t('requestValidation.rules.namePlaceholder')"
      />
      <Select
        v-model:value="model.logic"
        class="rule-card__logic"
        :options="logicOptions"
      />
      <Select
        v-model:value="model.result"
        class="rule-card__result"
        :options="resultOptions"
      />
      <Button
        danger
        type="text"
        :aria-label="$t('requestValidation.rules.remove', [index + 1])"
        :title="$t('requestValidation.rules.remove', [index + 1])"
        @click="emit('remove')"
      >
        <IconifyIcon class="size-4" icon="lucide:trash-2" />
      </Button>
    </header>

    <div class="condition-list">
      <div
        v-for="(condition, conditionIndex) in model.conditions"
        :key="condition.clientId"
        class="condition-row"
      >
        <Select
          v-model:value="condition.source"
          class="condition-row__source"
          :options="sourceOptions"
        />
        <Input
          v-model:value="condition.fieldName"
          class="condition-row__field"
          :maxlength="128"
          :placeholder="$t('requestValidation.conditions.fieldPlaceholder')"
        />
        <Select
          v-model:value="condition.operator"
          class="condition-row__operator"
          :options="operatorOptions"
        />
        <Input
          v-model:value="condition.expectedValue"
          class="condition-row__expected"
          :disabled="!operatorNeedsExpectedValue(condition.operator)"
          :maxlength="1024"
          :placeholder="expectedPlaceholder(condition.operator)"
        />
        <Button
          danger
          type="text"
          :disabled="model.conditions.length <= 1"
          :aria-label="
            $t('requestValidation.conditions.remove', [conditionIndex + 1])
          "
          :title="
            $t('requestValidation.conditions.remove', [conditionIndex + 1])
          "
          @click="removeCondition(conditionIndex)"
        >
          <IconifyIcon class="size-4" icon="lucide:x" />
        </Button>
      </div>
    </div>

    <footer class="rule-card__footer">
      <span>
        {{
          $t('requestValidation.rules.conditionCount', [
            model.conditions.length,
            maxConditions,
          ])
        }}
      </span>
      <Button
        size="small"
        type="dashed"
        :disabled="!canAddCondition"
        @click="addCondition"
      >
        <Plus class="size-4" />
        {{ $t('requestValidation.conditions.add') }}
      </Button>
    </footer>
  </article>
</template>

<style scoped>
.rule-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
}

.rule-card__header {
  display: grid;
  grid-template-columns: 32px minmax(170px, 1fr) 130px 170px 34px;
  gap: 10px;
  align-items: center;
}

.rule-card__number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  font-size: 13px;
  font-weight: 700;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
  border-radius: 999px;
}

.rule-card__name,
.rule-card__logic,
.rule-card__result {
  width: 100%;
  min-width: 0;
}

.condition-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  background: hsl(var(--muted) / 22%);
  border-radius: 8px;
}

.condition-row {
  display: grid;
  grid-template-columns: 105px minmax(140px, 0.85fr) 185px minmax(180px, 1.15fr) 34px;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.condition-row__source,
.condition-row__field,
.condition-row__operator,
.condition-row__expected {
  width: 100%;
  min-width: 0;
}

.rule-card__footer {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

@media (max-width: 900px) {
  .rule-card__header,
  .condition-row {
    grid-template-columns: 1fr;
  }

  .rule-card__number {
    display: none;
  }
}
</style>
