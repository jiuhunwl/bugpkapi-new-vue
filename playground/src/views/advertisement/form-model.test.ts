import { describe, expect, it } from 'vitest';

import type { AdvertisementDraft } from './form-model';

import {
  buildAdvertisementSavePayload,
  createAdvertisementDraft,
} from './form-model';

function validDraft(
  overrides: Partial<AdvertisementDraft> = {},
): AdvertisementDraft {
  return {
    ...createAdvertisementDraft(),
    name: '接口活动广告',
    title: '活动推荐',
    ...overrides,
  };
}

describe('advertisement form model', () => {
  it('builds typed API response parameters without handwritten JSON', () => {
    const result = buildAdvertisementSavePayload(
      validDraft({
        parameters: [
          { clientId: '1', key: 'campaign', type: 'STRING', value: 'summer' },
          { clientId: '2', key: 'weight', type: 'NUMBER', value: '12.5' },
          { clientId: '3', key: 'enabled', type: 'BOOLEAN', value: false },
        ],
        placement: 'API_RESPONSE',
        preservedPayload: { nested: { source: 'legacy' } },
      }),
    );

    expect(result.issue).toBeUndefined();
    expect(result.data?.payload).toEqual({
      campaign: 'summer',
      enabled: false,
      nested: { source: 'legacy' },
      weight: 12.5,
    });
  });

  it('rejects duplicate parameter names', () => {
    const result = buildAdvertisementSavePayload(
      validDraft({
        parameters: [
          { clientId: '1', key: 'campaign', type: 'STRING', value: 'a' },
          { clientId: '2', key: 'campaign', type: 'STRING', value: 'b' },
        ],
        placement: 'API_RESPONSE',
      }),
    );

    expect(result.issue).toEqual({
      code: 'PARAMETER_DUPLICATE',
      index: 1,
      key: 'campaign',
    });
  });

  it('does not silently overwrite a preserved complex parameter', () => {
    const result = buildAdvertisementSavePayload(
      validDraft({
        parameters: [
          { clientId: '1', key: 'legacy', type: 'STRING', value: 'new' },
        ],
        placement: 'API_RESPONSE',
        preservedPayload: { legacy: { source: 'old' } },
      }),
    );

    expect(result.issue).toEqual({
      code: 'PARAMETER_DUPLICATE',
      index: 0,
      key: 'legacy',
    });
  });

  it('does not send API parameters to page placements', () => {
    const result = buildAdvertisementSavePayload(
      validDraft({
        parameters: [
          { clientId: '1', key: 'campaign', type: 'STRING', value: 'summer' },
        ],
        placement: 'HOME',
        preservedPayload: { nested: ['legacy'] },
      }),
    );

    expect(result.issue).toBeUndefined();
    expect(result.data?.payload).toEqual({});
  });

  it('keeps service-provider settings intentionally minimal', () => {
    const result = buildAdvertisementSavePayload(
      validDraft({
        description: 'not used in the footer',
        imageUrl: 'https://example.com/banner.webp',
        linkUrl: 'https://example.com',
        placement: 'SERVICE_PROVIDER',
        preservedPayload: { legacy: true },
        title: 'Example Cloud',
      }),
    );

    expect(result.issue).toBeUndefined();
    expect(result.data).toMatchObject({
      description: '',
      imageUrl: '',
      linkUrl: 'https://example.com',
      payload: {},
      title: 'Example Cloud',
    });
  });
});
