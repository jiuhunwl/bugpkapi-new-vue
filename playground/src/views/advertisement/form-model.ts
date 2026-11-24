import type { AdvertisementApi } from '#/api/advertisement';

export type AdvertisementParameterType = 'BOOLEAN' | 'NUMBER' | 'STRING';

export interface AdvertisementParameterDraft {
  clientId: string;
  key: string;
  type: AdvertisementParameterType;
  value: boolean | number | string;
}

export interface AdvertisementDraft {
  description: string;
  endTime: string;
  imageUrl: string;
  linkTarget: '_blank' | '_self';
  linkUrl: string;
  name: string;
  parameters: AdvertisementParameterDraft[];
  placement: AdvertisementApi.Placement;
  preservedPayload: Record<string, unknown>;
  sortNo: number;
  startTime: string;
  status: boolean;
  title: string;
}

export type AdvertisementDraftIssueCode =
  | 'NAME_REQUIRED'
  | 'PARAMETER_DUPLICATE'
  | 'PARAMETER_NAME_REQUIRED'
  | 'PARAMETER_NAME_TOO_LONG'
  | 'PARAMETER_NUMBER_INVALID'
  | 'PAYLOAD_TOO_LARGE'
  | 'SCHEDULE_INVALID'
  | 'SORT_INVALID'
  | 'TITLE_REQUIRED';

export interface AdvertisementDraftIssue {
  code: AdvertisementDraftIssueCode;
  index?: number;
  key?: string;
}

export type BuildAdvertisementPayloadResult =
  | { data: AdvertisementApi.SavePayload; issue?: never }
  | { data?: never; issue: AdvertisementDraftIssue };

const MAX_PAYLOAD_BYTES = 16 * 1024;
const MAX_PARAMETER_KEY_LENGTH = 128;

export function createAdvertisementDraft(): AdvertisementDraft {
  return {
    description: '',
    endTime: '',
    imageUrl: '',
    linkTarget: '_blank',
    linkUrl: '',
    name: '',
    parameters: [],
    placement: 'HOME',
    preservedPayload: {},
    sortNo: 0,
    startTime: '',
    status: true,
    title: '',
  };
}

export function advertisementToDraft(
  item?: AdvertisementApi.Advertisement,
): AdvertisementDraft {
  if (!item) return createAdvertisementDraft();
  const { parameters, preservedPayload } = payloadToDrafts(item.payload);
  return {
    description: item.description ?? '',
    endTime: item.endTime ?? '',
    imageUrl: item.imageUrl ?? '',
    linkTarget: item.linkTarget === '_self' ? '_self' : '_blank',
    linkUrl: item.linkUrl ?? '',
    name: item.name ?? '',
    parameters,
    placement: normalizePlacement(item.placement),
    preservedPayload,
    sortNo: Number(item.sortNo ?? 0),
    startTime: item.startTime ?? '',
    status: item.status === 1,
    title: item.title ?? '',
  };
}

export function buildAdvertisementSavePayload(
  draft: AdvertisementDraft,
): BuildAdvertisementPayloadResult {
  const name = draft.name.trim();
  if (!name) return { issue: { code: 'NAME_REQUIRED' } };

  const title = draft.title.trim();
  if (!title) return { issue: { code: 'TITLE_REQUIRED' } };

  const sortNo = Math.trunc(Number(draft.sortNo));
  if (!Number.isFinite(sortNo) || sortNo < -100_000 || sortNo > 100_000) {
    return { issue: { code: 'SORT_INVALID' } };
  }

  const startTime = draft.startTime.trim();
  const endTime = draft.endTime.trim();
  if (startTime && endTime && endTime <= startTime) {
    return { issue: { code: 'SCHEDULE_INVALID' } };
  }

  const placement = normalizePlacement(draft.placement);
  const payloadResult =
    placement === 'API_RESPONSE'
      ? buildParameterPayload(draft.parameters, draft.preservedPayload)
      : { payload: {} };
  if (!('payload' in payloadResult)) return { issue: payloadResult.issue };

  const isServiceProvider = placement === 'SERVICE_PROVIDER';
  return {
    data: {
      description: isServiceProvider ? '' : draft.description.trim(),
      endTime,
      imageUrl: isServiceProvider ? '' : draft.imageUrl.trim(),
      linkTarget: draft.linkTarget === '_self' ? '_self' : '_blank',
      linkUrl: draft.linkUrl.trim(),
      name,
      payload: payloadResult.payload ?? {},
      placement,
      sortNo,
      startTime,
      status: draft.status ? 1 : 0,
      title,
    },
  };
}

export function createAdvertisementParameter(
  type: AdvertisementParameterType = 'STRING',
): AdvertisementParameterDraft {
  return {
    clientId: createClientId(),
    key: '',
    type,
    value: defaultParameterValue(type),
  };
}

export function defaultParameterValue(type: AdvertisementParameterType) {
  if (type === 'BOOLEAN') return true;
  if (type === 'NUMBER') return 0;
  return '';
}

function payloadToDrafts(payload?: Record<string, unknown>) {
  const parameters: AdvertisementParameterDraft[] = [];
  const preservedPayload = Object.create(null) as Record<string, unknown>;
  for (const [key, value] of Object.entries(payload ?? {})) {
    if (typeof value === 'string') {
      parameters.push({
        clientId: createClientId(),
        key,
        type: 'STRING',
        value,
      });
      continue;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      parameters.push({
        clientId: createClientId(),
        key,
        type: 'NUMBER',
        value,
      });
      continue;
    }
    if (typeof value === 'boolean') {
      parameters.push({
        clientId: createClientId(),
        key,
        type: 'BOOLEAN',
        value,
      });
      continue;
    }
    preservedPayload[key] = value;
  }
  return { parameters, preservedPayload };
}

function buildParameterPayload(
  parameters: AdvertisementParameterDraft[],
  preservedPayload: Record<string, unknown>,
):
  | { issue: AdvertisementDraftIssue; payload?: never }
  | { issue?: never; payload: Record<string, unknown> } {
  const payload = Object.assign(
    Object.create(null) as Record<string, unknown>,
    preservedPayload,
  );
  const seen = new Set(Object.keys(preservedPayload));
  for (const [index, parameter] of parameters.entries()) {
    const key = parameter.key.trim();
    if (!key) {
      return { issue: { code: 'PARAMETER_NAME_REQUIRED', index } };
    }
    if (key.length > MAX_PARAMETER_KEY_LENGTH) {
      return { issue: { code: 'PARAMETER_NAME_TOO_LONG', index } };
    }
    if (seen.has(key)) {
      return { issue: { code: 'PARAMETER_DUPLICATE', index, key } };
    }
    seen.add(key);

    if (parameter.type === 'NUMBER') {
      const value = Number(parameter.value);
      if (!Number.isFinite(value)) {
        return { issue: { code: 'PARAMETER_NUMBER_INVALID', index } };
      }
      payload[key] = value;
      continue;
    }
    if (parameter.type === 'BOOLEAN') {
      payload[key] = Boolean(parameter.value);
      continue;
    }
    payload[key] = String(parameter.value ?? '');
  }

  const bytes = new TextEncoder().encode(JSON.stringify(payload)).byteLength;
  if (bytes > MAX_PAYLOAD_BYTES) {
    return { issue: { code: 'PAYLOAD_TOO_LARGE' } };
  }
  return { payload };
}

function normalizePlacement(value: unknown): AdvertisementApi.Placement {
  if (
    value === 'API_RESPONSE' ||
    value === 'CONSOLE' ||
    value === 'NOTICE' ||
    value === 'SERVICE_PROVIDER'
  ) {
    return value;
  }
  return 'HOME';
}

function createClientId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `advertisement-parameter-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}
