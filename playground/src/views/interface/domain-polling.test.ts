import type { InterfaceApi } from '#/api/interface';

import { describe, expect, it } from 'vitest';

import {
  addDomainRoute,
  applyCheckResultsToDraft,
  createDomainRoutingDraft,
  type DomainRoutingInput,
  findCheckResult,
  normalizeDomainRoutingDraft,
  normalizeDomainRoutingForSave,
  normalizeLegacyUpstreams,
  parseDomainText,
  removeDomainRoute,
  updateDomainRouteDraft,
} from './domain-polling';

describe('domain-routed polling draft conversion', () => {
  it('sends an explicit empty mapping list when the editor removes the last node mapping', () => {
    const source = {
      url: 'https://backup.example/api',
      pollingCheckEnabled: 1 as const,
      pollingCheckField: 'result.code',
      pollingCheckExpected: 'ok',
      responseFieldMappings: [{ source: 'payload', target: 'data' }],
    };
    const draft = createDomainRoutingDraft(undefined, { upstreamConfigs: [source] });
    draft.legacyUpstreams[0]!.responseFieldMappings = [];

    expect(normalizeLegacyUpstreams(draft.legacyUpstreams)).toEqual([{
      url: 'https://backup.example/api',
      pollingCheckEnabled: 1,
      pollingCheckField: 'result.code',
      pollingCheckExpected: 'ok',
      responseFieldMappings: [],
    }]);
    expect(source.responseFieldMappings).toEqual([{ source: 'payload', target: 'data' }]);
  });

  it('parses comma and newline separated domains canonically', () => {
    expect(
      parseDomainText(' WWW.Example.COM,\nv.example.com; example.com. '),
    ).toEqual(['www.example.com', 'v.example.com', 'example.com']);
  });

  it('adds and removes routes with deterministic client and route ids', () => {
    const first = createDomainRoutingDraft();
    const withRoutes = addDomainRoute(addDomainRoute(first.routes));

    expect(withRoutes.map((route) => [route.id, route.clientId])).toEqual([
      ['route-1', 'route:route-1:0'],
      ['route-2', 'route:route-2:1'],
    ]);
    expect(removeDomainRoute(withRoutes, withRoutes[0]!.clientId)).toHaveLength(
      1,
    );
  });

  it('reads legacy upstreamUrls when upstreamConfigs are absent', () => {
    const draft = createDomainRoutingDraft(undefined, {
      upstreamConfigs: [],
      upstreamUrls: ['https://legacy-a.example/api', 'https://legacy-b.example/api'],
    });

    expect(draft.legacyUpstreams).toHaveLength(2);
    expect(draft.legacyUpstreams[1]!.url).toBe(
      'https://legacy-b.example/api',
    );
  });

  it('keeps BODY and QUERY match sources through read and save conversion', () => {
    const draft = createDomainRoutingDraft({
      routes: [
        {
          id: 'body-route',
          match: {
            source: 'BODY',
            field: 'payload.url',
            mode: 'EXACT',
            valueMode: 'ANY',
            domains: ['WWW.Example.COM'],
          },
          requestUrl: 'https://body.example/api',
        },
        {
          id: 'query-route',
          match: {
            source: 'QUERY',
            field: 'url',
            mode: 'SUBDOMAIN',
            valueMode: 'ALL',
            domains: ['query.example.com'],
          },
          requestUrl: 'https://query.example/api',
        },
      ],
    });

    expect(normalizeDomainRoutingDraft(draft).routes).toMatchObject([
      {
        id: 'body-route',
        match: {
          source: 'BODY',
          field: 'payload.url',
          mode: 'EXACT',
          valueMode: 'ANY',
          domains: ['www.example.com'],
        },
      },
      {
        id: 'query-route',
        match: {
          source: 'QUERY',
          field: 'url',
          mode: 'SUBDOMAIN',
          valueMode: 'ALL',
          domains: ['query.example.com'],
        },
      },
    ]);
  });

  it('preserves disabled routes and fallback settings in the save contract', () => {
    const draft = createDomainRoutingDraft({
      enabled: 1,
      fallback: 'REJECT',
      routes: [
        {
          id: 'disabled',
          enabled: 0,
          match: { domains: ['disabled.example.com'] },
          requestUrl: 'https://disabled.example/api',
        },
      ],
    });

    expect(normalizeDomainRoutingDraft(draft)).toMatchObject({
      enabled: 1,
      fallback: 'REJECT',
      routes: [{ id: 'disabled', enabled: 0 }],
    });
  });

  it('does not crash on malformed server routing documents', () => {
    const malformed = {
      enabled: 1,
      fallback: 'not-a-fallback',
      routes: [
        {
          id: 'broken',
          match: { domains: 'example.com' },
          upstreamConfigs: {},
        },
      ],
    } as unknown as DomainRoutingInput;

    expect(() => createDomainRoutingDraft(malformed)).not.toThrow();
    const draft = createDomainRoutingDraft(malformed);
    expect(draft.fallback).toBe('DEFAULT_POOL');
    expect(draft.routes[0]?.match.domainsText).toBe('example.com');
    expect(draft.routes[0]?.upstreamConfigs).toEqual([]);
  });

  it('keeps the default route reference valid when an edited route id changes', () => {
    const draft = createDomainRoutingDraft({
      defaultRouteId: 'legacy',
      routes: [
        {
          id: 'legacy',
          match: { domains: ['example.com'] },
          requestUrl: 'https://provider.example/api',
        },
      ],
    });
    const replacement = { ...draft.routes[0]!, id: 'renamed' };
    const updated = updateDomainRouteDraft(
      draft.routes,
      0,
      replacement,
      draft.defaultRouteId,
    );

    expect(updated.routes[0]?.id).toBe('renamed');
    expect(updated.defaultRouteId).toBe('renamed');
  });

  it('serializes a route draft to the exact numeric backend contract', () => {
    const draft = createDomainRoutingDraft({
      enabled: 1,
      fallback: 'DEFAULT_ROUTE',
      defaultRouteId: 'douyin',
      routes: [
        {
          id: 'douyin',
          name: ' Douyin ',
          enabled: 1,
          priority: 8,
          match: {
            source: 'BODY',
            field: 'payload.url',
            mode: 'SUBDOMAIN',
            valueMode: 'ANY',
            domains: ['DOUYIN.COM'],
          },
          requestUrl: ' https://provider.example/api ',
          pollingEnabled: 1,
          pollingMode: 'ROUND_ROBIN',
          pollingCheckEnabled: 1,
          pollingCheckField: 'code',
          pollingCheckExpected: '200',
          pollingStopCode: '',
          responseCleaningEnabled: 0,
          responseFieldMappings: [],
          upstreamConfigs: [
            {
              url: ' https://node.example/api ',
              pollingCheckEnabled: 1,
              pollingCheckField: 'code',
              pollingCheckExpected: '200',
            },
          ],
        },
      ],
    });

    const payload = normalizeDomainRoutingDraft(draft);
    expect(payload).toEqual({
      enabled: 1,
      fallback: 'DEFAULT_ROUTE',
      defaultRouteId: 'douyin',
      routes: [
        {
          id: 'douyin',
          name: 'Douyin',
          enabled: 1,
          priority: 8,
          match: {
            source: 'BODY',
            field: 'payload.url',
            mode: 'SUBDOMAIN',
            valueMode: 'ANY',
            domains: ['douyin.com'],
          },
          requestUrl: 'https://provider.example/api',
          pollingEnabled: 1,
          pollingMode: 'ROUND_ROBIN',
          pollingCheckEnabled: 1,
          pollingCheckField: 'code',
          pollingCheckExpected: '200',
          pollingStopCode: '',
          responseCleaningEnabled: 0,
          responseFieldMappings: [],
          upstreamConfigs: [
            {
              url: 'https://node.example/api',
              pollingCheckEnabled: 1,
              pollingCheckField: 'code',
              pollingCheckExpected: '200',
              responseFieldMappings: [],
            },
          ],
        },
      ],
    } satisfies InterfaceApi.DomainRoutingConfig);
  });

  it('matches health results by route id and URL instead of URL alone', () => {
    const results: InterfaceApi.UpstreamCheckResult[] = [
      {
        healthStatus: 'UNHEALTHY',
        routeId: 'route-a',
        url: 'https://shared.example/api',
      },
      {
        healthStatus: 'HEALTHY',
        routeId: 'route-b',
        url: 'https://shared.example/api',
      },
    ];

    expect(findCheckResult(results, 'route-a', 'https://shared.example/api')?.healthStatus).toBe(
      'UNHEALTHY',
    );
    expect(findCheckResult(results, 'route-b', 'https://shared.example/api')?.healthStatus).toBe(
      'HEALTHY',
    );
    expect(findCheckResult(results, '', 'https://shared.example/api')).toBeUndefined();
  });

  it('keeps legacy array storage when no domain routing setting exists', () => {
    const draft = createDomainRoutingDraft();

    expect(normalizeDomainRoutingForSave(draft)).toBeUndefined();
  });

  it('materializes an explicit disabled routing document when clearing old routes', () => {
    const draft = createDomainRoutingDraft();
    const existing: InterfaceApi.DomainRoutingConfig = {
      enabled: 1,
      fallback: 'DEFAULT_ROUTE',
      defaultRouteId: 'douyin',
      routes: [],
    };

    expect(normalizeDomainRoutingForSave(draft, existing)).toEqual({
      enabled: 0,
      fallback: 'DEFAULT_POOL',
      routes: [],
    });
  });

  it('updates only the matching route pool when URLs are shared', () => {
    const legacy = createDomainRoutingDraft(undefined, {
      upstreamUrls: ['https://shared.example/api'],
    }).legacyUpstreams;
    const draft = createDomainRoutingDraft({
      enabled: 1,
      fallback: 'DEFAULT_POOL',
      routes: [
        {
          id: 'route-a',
          name: 'A',
          enabled: 1,
          match: { domains: ['a.example.com'] },
          requestUrl: 'https://shared.example/api',
          upstreamConfigs: [{ url: 'https://shared.example/api' }],
        },
        {
          id: 'route-b',
          name: 'B',
          enabled: 1,
          match: { domains: ['b.example.com'] },
          requestUrl: 'https://shared.example/api',
          upstreamConfigs: [{ url: 'https://shared.example/api' }],
        },
      ],
    });
    const results: InterfaceApi.UpstreamCheckResult[] = [
      {
        healthStatus: 'UNHEALTHY',
        routeId: 'route-a',
        url: 'https://shared.example/api',
      },
      {
        healthStatus: 'HEALTHY',
        routeId: 'route-b',
        url: 'https://shared.example/api',
      },
      {
        healthStatus: 'HEALTHY',
        url: 'https://default.example/api',
      },
    ];

    const primary = applyCheckResultsToDraft(
      results,
      'https://default.example/api',
      legacy,
      draft.routes,
    );

    expect(primary?.url).toBe('https://default.example/api');
    expect(draft.routes[0]!.upstreamConfigs[0]!.healthStatus).toBe('UNHEALTHY');
    expect(draft.routes[1]!.upstreamConfigs[0]!.healthStatus).toBe('HEALTHY');
    expect(legacy[0]!.healthStatus).toBeUndefined();
  });
});

describe('legacy route runtime state survives editor round trips', () => {
  it.each([
    { mode: '', stop: '', expectedEnabled: 1, expectedMode: 'ROUND_ROBIN' },
    { mode: 'PRIMARY', stop: '', expectedEnabled: 1, expectedMode: 'PRIMARY' },
    { mode: 'RANDOM', stop: '', expectedEnabled: 1, expectedMode: 'ROUND_ROBIN' },
    { mode: 'SINGLE', stop: '40401', expectedEnabled: 0, expectedMode: 'SINGLE' },
  ] as const)('keeps backend legacy semantics for mode $mode', ({ mode, stop, expectedEnabled, expectedMode }) => {
    const draft = createDomainRoutingDraft({
      enabled: 1,
      routes: [{
        id: 'legacy', enabled: 1,
        pollingEnabled: 0,
        pollingMode: mode as InterfaceApi.PollingMode,
        pollingStopCode: stop,
        requestUrl: 'https://primary.example/api',
        match: { domains: ['example.com'] },
        upstreamConfigs: [{ url: 'https://backup.example/api' }],
      }],
    });
    const saved = normalizeDomainRoutingDraft(draft);
    expect(saved.routes?.[0]).toMatchObject({ pollingEnabled: expectedEnabled, pollingMode: expectedMode });
  });
});
