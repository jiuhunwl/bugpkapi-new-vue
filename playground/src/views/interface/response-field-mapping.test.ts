import { describe, expect, it } from 'vitest';

import {
  cloneResponseFieldMappings,
  isValidResponseJSONPath,
  mergeUnifiedVideoFieldPreset,
  normalizeResponseFieldMappings,
  RESPONSE_FIELD_PRESET_DEFINITIONS,
  RESPONSE_FIELD_PRESETS,
} from './response-field-mapping';

describe('response field mapping helpers', () => {
  it('trims rows and removes only fully blank mappings', () => {
    expect(
      normalizeResponseFieldMappings([
        { source: ' media_link ', target: ' url ' },
        { source: '', target: '' },
        { source: 'unfinished', target: '' },
      ]),
    ).toEqual([
      { source: 'media_link', target: 'url' },
      { source: 'unfinished', target: '' },
    ]);
  });

  it('clones rows and exposes canonical contract presets', () => {
    const source = [{ source: 'payload', target: 'data' }];
    const cloned = cloneResponseFieldMappings(source);
    cloned[0]!.source = 'result';
    expect(source[0]!.source).toBe('payload');
    expect(RESPONSE_FIELD_PRESETS).toContain('data.live_photo');
    expect(RESPONSE_FIELD_PRESETS).toContain('data.video_backup');
    expect(RESPONSE_FIELD_PRESETS).toContain('data.video_backup[].url');
    expect(RESPONSE_FIELD_PRESET_DEFINITIONS).toContainEqual(
      expect.objectContaining({
        type: 'string',
        value: 'data.author.name',
      }),
    );
  });

  it('validates supported JSON path notation', () => {
    expect(isValidResponseJSONPath('$.payload.author.nickname')).toBe(true);
    expect(isValidResponseJSONPath('payload.items[0].url')).toBe(true);
    expect(isValidResponseJSONPath('payload.items[].url')).toBe(true);
    expect(isValidResponseJSONPath('payload.items[*].url')).toBe(true);
    expect(isValidResponseJSONPath('payload..url')).toBe(false);
    expect(isValidResponseJSONPath('payload.items[abc].url')).toBe(false);
  });

  it('merges the unified video preset without overwriting custom mappings', () => {
    const result = mergeUnifiedVideoFieldPreset([
      { source: 'custom.video', target: 'data.url' },
    ]);
    expect(result[0]).toEqual({
      source: 'custom.video',
      target: 'data.url',
    });
    expect(result.filter((item) => item.target === 'data.url')).toHaveLength(1);
    expect(result).toContainEqual({
      source: 'payload.author.name',
      target: 'data.author.name',
    });
    expect(result.length).toBeLessThanOrEqual(50);
  });
});
