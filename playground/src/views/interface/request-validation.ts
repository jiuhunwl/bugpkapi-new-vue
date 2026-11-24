import type { InterfaceApi } from '#/api/interface';

export type RequestValidationPresetKey =
  | 'BILIBILI'
  | 'CUSTOM_PLATFORM'
  | 'DOUYIN'
  | 'GENERIC_SHARE_LINK'
  | 'KUAISHOU'
  | 'TIKTOK'
  | 'XIAOHONGSHU'
  | 'YOUTUBE';

export interface RequestValidationConditionDraft
  extends InterfaceApi.RequestValidationCondition {
  clientId: string;
}

export interface RequestValidationRuleDraft
  extends Omit<InterfaceApi.RequestValidationRule, 'conditions'> {
  clientId: string;
  conditions: RequestValidationConditionDraft[];
}

interface PresetRuleLabels {
  invalidRule: string;
  passRule: string;
}

interface RequestValidationPreset {
  defaultResult: InterfaceApi.RequestValidationResult;
  rules: InterfaceApi.RequestValidationRule[];
}

export const requestValidationPresetDomains: Record<
  Exclude<RequestValidationPresetKey, 'GENERIC_SHARE_LINK'>,
  string[]
> = {
  BILIBILI: ['bilibili.com', 'b23.tv'],
  CUSTOM_PLATFORM: ['example.com'],
  DOUYIN: ['douyin.com', 'iesdouyin.com'],
  KUAISHOU: ['kuaishou.com', 'kwai.com'],
  TIKTOK: ['tiktok.com'],
  XIAOHONGSHU: ['xiaohongshu.com', 'xhslink.com'],
  YOUTUBE: ['youtube.com', 'youtu.be'],
};

const operatorsWithExpectedValue = new Set<
  InterfaceApi.RequestValidationOperator
>([
  'CONTAINS',
  'DOMAIN_IN',
  'DOMAIN_NOT_IN',
  'ENDS_WITH',
  'EQ',
  'NE',
  'NOT_CONTAINS',
  'NOT_REGEX',
  'REGEX',
  'STARTS_WITH',
]);

export function buildRequestValidationPreset(
  presetKey: RequestValidationPresetKey,
  rawFieldName: string,
  labels: PresetRuleLabels,
): RequestValidationPreset {
  const fieldName = rawFieldName.trim() || 'url';
  const invalidRule: InterfaceApi.RequestValidationRule = {
    conditions: [
      createCondition({ fieldName, operator: 'NOT_EXISTS' }),
      createCondition({ fieldName, operator: 'EMPTY' }),
      createCondition({ fieldName, operator: 'NOT_HAS_DOMAIN' }),
    ],
    logic: 'ANY',
    name: labels.invalidRule,
    result: 'INVALID_PARAMS',
    sortNo: 1,
  };
  if (presetKey === 'GENERIC_SHARE_LINK') {
    return {
      defaultResult: 'PASS',
      rules: [invalidRule],
    };
  }

  const domains = requestValidationPresetDomains[presetKey];
  return {
    defaultResult: 'PLATFORM_MISMATCH',
    rules: [
      invalidRule,
      {
        conditions: [
          createCondition({
            expectedValue: domains.join(','),
            fieldName,
            operator: 'DOMAIN_IN',
          }),
        ],
        logic: 'ALL',
        name: labels.passRule,
        result: 'PASS',
        sortNo: 2,
      },
    ],
  };
}

export function createEmptyRuleDraft(): RequestValidationRuleDraft {
  return {
    clientId: createClientId('request-rule'),
    conditions: [createConditionDraft()],
    logic: 'ALL',
    name: '',
    result: 'INVALID_PARAMS',
    sortNo: 1,
  };
}

export function createConditionDraft(
  condition: Partial<InterfaceApi.RequestValidationCondition> = {},
): RequestValidationConditionDraft {
  return {
    clientId: createClientId('request-condition'),
    expectedValue: condition.expectedValue ?? '',
    fieldName: condition.fieldName ?? 'url',
    operator: condition.operator ?? 'NOT_EMPTY',
    source: condition.source ?? 'AUTO',
  };
}

export function toRequestValidationRuleDraft(
  rule: InterfaceApi.RequestValidationRule,
): RequestValidationRuleDraft {
  return {
    ...rule,
    clientId: createClientId('request-rule'),
    conditions: (rule.conditions ?? []).map((condition) =>
      createConditionDraft(condition),
    ),
  };
}

export function toRequestValidationRules(
  drafts: RequestValidationRuleDraft[],
): InterfaceApi.RequestValidationRule[] {
  return drafts.map((draft, index) => ({
    conditions: draft.conditions.map((condition) => ({
      expectedValue: operatorNeedsExpectedValue(condition.operator)
        ? condition.expectedValue.trim()
        : '',
      fieldName: condition.fieldName.trim(),
      operator: condition.operator,
      source: condition.source,
    })),
    logic: draft.logic,
    name: draft.name.trim(),
    result: draft.result,
    sortNo: index + 1,
  }));
}

export function operatorNeedsExpectedValue(
  operator: InterfaceApi.RequestValidationOperator,
) {
  return operatorsWithExpectedValue.has(operator);
}

export function suggestedRequestParameterField(
  item?: InterfaceApi.InterfaceItem,
) {
  const documented = item?.templateParameters?.find((value) => value.trim());
  if (documented) return documented.trim();
  const match = String(item?.requestUrl ?? '').match(
    /\{([A-Za-z][A-Za-z0-9_]*)\}/,
  );
  return match?.[1] ?? 'url';
}

function createCondition(
  condition: Partial<InterfaceApi.RequestValidationCondition> &
    Pick<
      InterfaceApi.RequestValidationCondition,
      'fieldName' | 'operator'
    >,
): InterfaceApi.RequestValidationCondition {
  return {
    expectedValue: condition.expectedValue ?? '',
    fieldName: condition.fieldName,
    operator: condition.operator,
    source: condition.source ?? 'AUTO',
  };
}

function createClientId(prefix: string) {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}
