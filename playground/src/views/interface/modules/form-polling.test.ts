import type { InterfaceApi } from '#/api/interface';

import { describe, expect, it } from 'vitest';

import {
  generalFormPollingPayload,
  normalizeUpstreamConfigs,
  pollingSwitchPayload,
  upstreamTextFromItem,
} from './form-polling';

const current: InterfaceApi.InterfaceItem = {
  apiCode: 'video',
  id: '7',
  isFeatured: 0,
  isTop: 0,
  name: 'Video',
  pointPrice: 0,
  price: 0,
  requestMethod: 'GET',
  requestUrl: 'https://primary.example/api',
  status: 1,
  pollingEnabled: 1,
  pollingMode: 'PRIMARY',
  pollingCheckEnabled: 1,
  pollingCheckExpected: '0',
  pollingCheckField: 'data.status',
  pollingStopCode: '40401',
  upstreamConfigs: [
    {
      url: 'https://backup.example/api',
      pollingCheckEnabled: 1,
      pollingCheckExpected: 'ok',
      pollingCheckField: 'result.code',
      responseFieldMappings: [{ source: 'payload', target: 'data' }],
    },
  ],
};
const values = {
  pollingEnabled: true,
  pollingMode: 'PRIMARY',
  upstreamUrlsText: 'https://backup.example/api',
};

describe('general form polling payload ownership', () => {
  it('leaves unchanged polling configuration to the server', () => {
    expect(generalFormPollingPayload(values, current)).toEqual({});
  });

  it('treats duplicate URLs, whitespace and CRLF as unchanged', () => {
    expect(
      generalFormPollingPayload(
        {
          ...values,
          upstreamUrlsText:
            ' https://backup.example/api \r\n\r\nhttps://backup.example/api\r\n',
        },
        current,
      ),
    ).toEqual({});
  });

  it('does not invent defaults when old list records omit hidden settings', () => {
    const partial = {
      ...current,
      upstreamConfigs: undefined,
      upstreamUrls: ['https://backup.example/api'],
      pollingCheckEnabled: undefined,
      pollingCheckExpected: undefined,
      pollingCheckField: undefined,
      pollingStopCode: undefined,
    };
    expect(generalFormPollingPayload(values, partial)).toEqual({});
  });

  it('sends only URLs and the polling switch for an edited upstream list', () => {
    expect(
      generalFormPollingPayload(
        {
          ...values,
          upstreamUrlsText:
            'https://new.example/api\nhttps://backup.example/api',
        },
        current,
      ),
    ).toEqual({
      pollingEnabled: 1,
      pollingMode: 'PRIMARY',
      upstreamConfigs: [
        { url: 'https://new.example/api' },
        { url: 'https://backup.example/api' },
      ],
      upstreamUrls: ['https://new.example/api', 'https://backup.example/api'],
    });
    expect(current.upstreamConfigs?.[0]).toMatchObject({
      pollingCheckEnabled: 1,
      responseFieldMappings: [{ source: 'payload', target: 'data' }],
    });
  });

  it('still allows removing all upstream nodes', () => {
    expect(
      generalFormPollingPayload({ ...values, upstreamUrlsText: '' }, current),
    ).toEqual({
      pollingEnabled: 1,
      pollingMode: 'PRIMARY',
      upstreamConfigs: [],
      upstreamUrls: [],
    });
  });

  it('does not re-enable a disabled pool when editing retained backup URLs', () => {
    expect(
      generalFormPollingPayload(
        {
          pollingEnabled: false,
          pollingMode: 'SINGLE',
          upstreamUrlsText: 'https://new.example/api',
        },
        {
          ...current,
          pollingEnabled: 0,
          pollingMode: 'SINGLE',
          pollingStopCode: '',
        },
      ),
    ).toEqual({
      pollingEnabled: 0,
      pollingMode: 'SINGLE',
      upstreamConfigs: [{ url: 'https://new.example/api' }],
      upstreamUrls: ['https://new.example/api'],
    });
  });

  it('changes only the switch/mode without resending the node list', () => {
    expect(
      generalFormPollingPayload(
        { ...values, pollingMode: 'ROUND_ROBIN' },
        current,
      ),
    ).toEqual({
      pollingEnabled: 1,
      pollingMode: 'ROUND_ROBIN',
    });
    expect(
      generalFormPollingPayload({ ...values, pollingEnabled: false }, current),
    ).toEqual({
      pollingEnabled: 0,
      pollingMode: 'SINGLE',
    });
  });

  it('preserves the normalized UI state of legacy polling rows', () => {
    expect(
      generalFormPollingPayload(
        { ...values, pollingMode: 'ROUND_ROBIN' },
        {
          ...current,
          pollingEnabled: 0,
          pollingMode: 'RANDOM',
        },
      ),
    ).toEqual({});
  });

  it('creates new interfaces with explicit polling settings and URL-only nodes', () => {
    expect(generalFormPollingPayload(values)).toEqual({
      pollingEnabled: 1,
      pollingMode: 'PRIMARY',
      upstreamConfigs: [{ url: 'https://backup.example/api' }],
      upstreamUrls: ['https://backup.example/api'],
    });
  });
});

describe('URL editor serialization', () => {
  it('keeps node order while trimming and deduplicating URLs', () => {
    expect(
      normalizeUpstreamConfigs(
        ' https://b.example/api \nhttps://a.example/api\nhttps://b.example/api',
      ),
    ).toEqual([
      { url: 'https://b.example/api' },
      { url: 'https://a.example/api' },
    ]);
    expect(normalizeUpstreamConfigs(undefined)).toEqual([]);
  });

  it('displays structured URLs or falls back to the legacy URL list', () => {
    expect(upstreamTextFromItem(current)).toBe('https://backup.example/api');
    expect(
      upstreamTextFromItem({
        ...current,
        upstreamConfigs: [],
        upstreamUrls: ['https://a.example/api', 'https://b.example/api'],
      }),
    ).toBe('https://a.example/api\nhttps://b.example/api');
    expect(upstreamTextFromItem()).toBe('');
  });

  it('uses the explicit switch, not the existence of backups', () => {
    expect(pollingSwitchPayload(false, 'PRIMARY')).toEqual({
      pollingEnabled: 0,
      pollingMode: 'SINGLE',
    });
    expect(pollingSwitchPayload(true, undefined)).toEqual({
      pollingEnabled: 1,
      pollingMode: 'FASTEST',
    });
  });
});
