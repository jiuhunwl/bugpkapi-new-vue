import { describe, expect, it } from 'vitest';

import {
  buildRequestValidationPreset,
  operatorNeedsExpectedValue,
  suggestedRequestParameterField,
  toRequestValidationRuleDraft,
  toRequestValidationRules,
} from './request-validation';

const labels = {
  invalidRule: 'invalid',
  passRule: 'pass',
};

describe('request validation presets', () => {
  it('builds a complete platform decision flow', () => {
    const preset = buildRequestValidationPreset('DOUYIN', 'shareUrl', labels);
    expect(preset.defaultResult).toBe('PLATFORM_MISMATCH');
    expect(preset.rules.map((rule) => rule.result)).toEqual([
      'INVALID_PARAMS',
      'PASS',
    ]);
    expect(preset.rules[0]?.logic).toBe('ANY');
    expect(preset.rules[1]?.conditions[0]).toMatchObject({
      expectedValue: 'douyin.com,iesdouyin.com',
      fieldName: 'shareUrl',
      operator: 'DOMAIN_IN',
    });
  });

  it('uses PASS as the generic share-link fallback', () => {
    const preset = buildRequestValidationPreset(
      'GENERIC_SHARE_LINK',
      '',
      labels,
    );
    expect(preset.defaultResult).toBe('PASS');
    expect(preset.rules).toHaveLength(1);
    expect(preset.rules[0]?.conditions.map((item) => item.operator)).toEqual([
      'NOT_EXISTS',
      'EMPTY',
      'NOT_HAS_DOMAIN',
    ]);
  });

  it('strips unary expected values when drafts are serialized', () => {
    const preset = buildRequestValidationPreset('DOUYIN', 'url', labels);
    const drafts = preset.rules.map(toRequestValidationRuleDraft);
    drafts[0]!.conditions[0]!.expectedValue = 'ignored';
    const rules = toRequestValidationRules(drafts);
    expect(rules[0]?.conditions[0]?.expectedValue).toBe('');
    expect(rules[1]?.sortNo).toBe(2);
  });

  it('derives the preset field from the upstream template', () => {
    expect(
      suggestedRequestParameterField({
        id: '1',
        apiCode: 'parse',
        isFeatured: 0,
        isTop: 0,
        name: 'parse',
        pointPrice: 0,
        price: 0,
        requestMethod: 'GET',
        requestUrl: 'https://example.com/parse/{shareUrl}',
        status: 1,
      }),
    ).toBe('shareUrl');
  });

  it('marks only value-based operators as requiring expected values', () => {
    expect(operatorNeedsExpectedValue('DOMAIN_IN')).toBe(true);
    expect(operatorNeedsExpectedValue('REGEX')).toBe(true);
    expect(operatorNeedsExpectedValue('HAS_DOMAIN')).toBe(false);
    expect(operatorNeedsExpectedValue('NOT_EXISTS')).toBe(false);
  });
});
