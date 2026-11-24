import { describe, expect, it } from 'vitest';

import {
  clearProxyPoolConfig,
  clearProxyPoolPassword,
  createProxyPoolDraft,
  normalizeProxyPoolDraft,
} from './proxy-pool';

describe('proxy pool form normalization', () => {
  it('keeps fixed proxy credentials and clears API-only fields', () => {
    const result = normalizeProxyPoolDraft({
      apiHeaders: [{ name: ' X-Token ', value: ' ignored ' }],
      apiUrl: 'https://pool.example.com',
      enabled: 1,
      host: ' proxy.example.com ',
      jsonPath: '$.data.proxy',
      password: ' secret ',
      passwordConfigured: true,
      port: 8080,
      protocol: 'HTTP',
      refreshSeconds: 60,
      source: 'FIXED',
      username: ' alice ',
    });

    expect(result).toEqual({
      apiHeaders: [],
      apiUrl: '',
      enabled: 1,
      host: 'proxy.example.com',
      jsonPath: '',
      password: 'secret',
      passwordConfigured: true,
      port: 8080,
      protocol: 'HTTP',
      refreshSeconds: 0,
      source: 'FIXED',
      username: 'alice',
    });
  });

  it('normalizes API headers and manual JSON path', () => {
    const result = normalizeProxyPoolDraft({
      apiHeaders: [
        { name: ' Authorization ', value: ' Bearer token ' },
        { name: '', value: '' },
      ],
      apiUrl: ' https://pool.example.com/get ',
      enabled: 1,
      host: 'ignored',
      jsonPath: '$.data.items.0.proxy',
      password: '',
      passwordConfigured: false,
      port: 1,
      protocol: 'SOCKS5',
      refreshSeconds: 45,
      source: 'API',
      username: '',
    });

    expect(result.apiHeaders).toEqual([
      { name: 'Authorization', value: 'Bearer token' },
    ]);
    expect(result.apiUrl).toBe('https://pool.example.com/get');
    expect(result.jsonPath).toBe('data.items.0.proxy');
    expect(result.host).toBe('');
    expect(result.port).toBe(0);
  });

  it('retains a source marker when disabled so the backend can distinguish disable from omission', () => {
    const result = normalizeProxyPoolDraft(
      createProxyPoolDraft({ enabled: 0, source: 'API' }),
    );
    expect(result).toMatchObject({ enabled: 0, source: 'API' });
  });

  it('creates an explicit clear signal for an already configured password', () => {
    const draft = createProxyPoolDraft({
      enabled: 1,
      passwordConfigured: true,
      source: 'FIXED',
    });

    expect(clearProxyPoolPassword(draft)).toMatchObject({
      password: '',
      passwordConfigured: false,
    });
    expect(draft.passwordConfigured).toBe(true);
  });

  it('clears every proxy field and disables the proxy explicitly', () => {
    expect(clearProxyPoolConfig()).toEqual({
      apiHeaders: [],
      apiUrl: '',
      enabled: 0,
      host: '',
      jsonPath: '',
      password: '',
      passwordConfigured: false,
      port: 0,
      protocol: 'HTTP',
      refreshSeconds: 30,
      source: 'FIXED',
      username: '',
    });
  });
});
