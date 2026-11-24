import type { InterfaceApi } from '#/api/interface';

export type ResponseFieldPresetGroup =
  | 'author'
  | 'data'
  | 'envelope'
  | 'livePhoto'
  | 'music'
  | 'videoBackup';

export type ResponseFieldPresetType =
  | 'array'
  | 'integer'
  | 'nullableInteger'
  | 'nullableString'
  | 'object'
  | 'string';

export interface ResponseFieldPresetDefinition {
  examplePath: string;
  group: ResponseFieldPresetGroup;
  type: ResponseFieldPresetType;
  value: string;
}

/** Canonical short-video parser response fields. */
export const RESPONSE_FIELD_PRESET_DEFINITIONS = [
  { examplePath: 'status_code', group: 'envelope', type: 'integer', value: 'code' },
  { examplePath: 'message', group: 'envelope', type: 'string', value: 'msg' },
  { examplePath: 'payload', group: 'envelope', type: 'object', value: 'data' },

  { examplePath: 'payload.type', group: 'data', type: 'string', value: 'data.type' },
  { examplePath: 'payload.title', group: 'data', type: 'string', value: 'data.title' },
  { examplePath: 'payload.desc', group: 'data', type: 'string', value: 'data.desc' },
  { examplePath: 'payload.author', group: 'data', type: 'object', value: 'data.author' },
  { examplePath: 'payload.cover', group: 'data', type: 'string', value: 'data.cover' },
  { examplePath: 'payload.url', group: 'data', type: 'nullableString', value: 'data.url' },
  { examplePath: 'payload.quality', group: 'data', type: 'string', value: 'data.quality' },
  { examplePath: 'payload.duration', group: 'data', type: 'nullableInteger', value: 'data.duration' },
  { examplePath: 'payload.images', group: 'data', type: 'array', value: 'data.images' },
  { examplePath: 'payload.live_photo', group: 'data', type: 'array', value: 'data.live_photo' },
  { examplePath: 'payload.music', group: 'data', type: 'object', value: 'data.music' },
  { examplePath: 'payload.extra', group: 'data', type: 'object', value: 'data.extra' },
  { examplePath: 'payload.video_backup', group: 'data', type: 'array', value: 'data.video_backup' },

  { examplePath: 'payload.author.name', group: 'author', type: 'string', value: 'data.author.name' },
  { examplePath: 'payload.author.id', group: 'author', type: 'string', value: 'data.author.id' },
  { examplePath: 'payload.author.avatar', group: 'author', type: 'string', value: 'data.author.avatar' },

  { examplePath: 'payload.live_photo[].image', group: 'livePhoto', type: 'string', value: 'data.live_photo[].image' },
  { examplePath: 'payload.live_photo[].video', group: 'livePhoto', type: 'string', value: 'data.live_photo[].video' },

  { examplePath: 'payload.music.title', group: 'music', type: 'string', value: 'data.music.title' },
  { examplePath: 'payload.music.author', group: 'music', type: 'string', value: 'data.music.author' },
  { examplePath: 'payload.music.url', group: 'music', type: 'string', value: 'data.music.url' },
  { examplePath: 'payload.music.cover', group: 'music', type: 'string', value: 'data.music.cover' },

  { examplePath: 'payload.video_backup[].label', group: 'videoBackup', type: 'string', value: 'data.video_backup[].label' },
  { examplePath: 'payload.video_backup[].quality', group: 'videoBackup', type: 'string', value: 'data.video_backup[].quality' },
  { examplePath: 'payload.video_backup[].url', group: 'videoBackup', type: 'string', value: 'data.video_backup[].url' },
  { examplePath: 'payload.video_backup[].bit_rate', group: 'videoBackup', type: 'integer', value: 'data.video_backup[].bit_rate' },
  { examplePath: 'payload.video_backup[].width', group: 'videoBackup', type: 'integer', value: 'data.video_backup[].width' },
  { examplePath: 'payload.video_backup[].height', group: 'videoBackup', type: 'integer', value: 'data.video_backup[].height' },
  { examplePath: 'payload.video_backup[].format', group: 'videoBackup', type: 'string', value: 'data.video_backup[].format' },
  { examplePath: 'payload.video_backup[].codec', group: 'videoBackup', type: 'string', value: 'data.video_backup[].codec' },
  { examplePath: 'payload.video_backup[].quality_type', group: 'videoBackup', type: 'integer', value: 'data.video_backup[].quality_type' },
  { examplePath: 'payload.video_backup[].gear_name', group: 'videoBackup', type: 'string', value: 'data.video_backup[].gear_name' },
] as const satisfies readonly ResponseFieldPresetDefinition[];

/** Kept as a string list for existing callers and tests. */
export const RESPONSE_FIELD_PRESETS = RESPONSE_FIELD_PRESET_DEFINITIONS.map(
  ({ value }) => value,
);

export function getResponseFieldPreset(value: string) {
  return RESPONSE_FIELD_PRESET_DEFINITIONS.find(
    (definition) => definition.value === value,
  );
}

export function isValidResponseJSONPath(value: string) {
  let path = value.trim();
  if (!path || path === '$') return false;
  if (path.startsWith('$')) {
    path = path.slice(1);
    if (path.startsWith('.')) path = path.slice(1);
  }
  if (!path || path.endsWith('.') || path.includes('..')) return false;

  const parts = path.split('.');
  return parts.every((part) => {
    if (!part) return false;
    const base = part.replace(/\[(?:\d+|\*)?\]/g, '');
    if (!base || /[\[\]]/.test(base)) return false;
    const selectors = part.slice(base.length);
    return /^(?:\[(?:\d+|\*)?\])*$/.test(selectors);
  });
}

export function normalizeResponseFieldMappings(
  mappings?: InterfaceApi.ResponseFieldMapping[],
): InterfaceApi.ResponseFieldMapping[] {
  return (mappings || [])
    .map((mapping) => ({
      source: mapping.source?.trim() || '',
      target: mapping.target?.trim() || '',
    }))
    .filter((mapping) => mapping.source || mapping.target);
}

export function cloneResponseFieldMappings(
  mappings?: InterfaceApi.ResponseFieldMapping[],
): InterfaceApi.ResponseFieldMapping[] {
  return (mappings || []).map((mapping) => ({ ...mapping }));
}

/**
 * Adds editable source-path examples for missing canonical targets without
 * changing any existing custom rule.
 */
export function mergeUnifiedVideoFieldPreset(
  mappings?: InterfaceApi.ResponseFieldMapping[],
): InterfaceApi.ResponseFieldMapping[] {
  const result = cloneResponseFieldMappings(mappings);
  const targets = new Set(result.map((mapping) => mapping.target.trim()));
  const sources = new Set(result.map((mapping) => mapping.source.trim()));

  for (const definition of RESPONSE_FIELD_PRESET_DEFINITIONS) {
    if (result.length >= 50 || targets.has(definition.value)) continue;
    if (sources.has(definition.examplePath)) continue;
    result.push({
      source: definition.examplePath,
      target: definition.value,
    });
    sources.add(definition.examplePath);
    targets.add(definition.value);
  }
  return result;
}
