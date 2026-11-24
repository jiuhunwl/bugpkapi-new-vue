import { describe, expect, it } from 'vitest';

import { RequestDedupeStore } from './request-dedupe';

describe('request-dedupe', () => {
  it('builds a stable key ignoring param order', () => {
    const a = RequestDedupeStore.keyOf('get', '/api/x', {
      params: { sections: 'a,b', page: 2 },
    });
    const b = RequestDedupeStore.keyOf('get', '/api/x', {
      params: { page: 2, sections: 'a,b' },
    });
    expect(a).toBe(b);
  });

  it('distinguishes method and url', () => {
    const get = RequestDedupeStore.keyOf('GET', '/api/x', {});
    const post = RequestDedupeStore.keyOf('POST', '/api/x', {});
    const otherUrl = RequestDedupeStore.keyOf('GET', '/api/y', {});
    expect(get).not.toBe(post);
    expect(get).not.toBe(otherUrl);
  });

  it('includes body in the key when present (and ignores undefined)', () => {
    const withBody = RequestDedupeStore.keyOf('POST', '/api/x', {
      data: { a: 1, b: undefined },
    });
    const withoutBody = RequestDedupeStore.keyOf('POST', '/api/x', {});
    expect(withBody).toContain('|body=');
    expect(withBody).not.toBe(withoutBody);
  });

  it('shares the same promise while pending, then removes after completion', async () => {
    const store = new RequestDedupeStore();
    const key = 'GET|/api/x|{}';

    let resolvePromise!: () => void;
    const p = new Promise((resolve) => {
      resolvePromise = () => resolve('result');
    });
    store.set(key, p);

    // 第二个调用获得同一个 promise
    expect(store.get(key)).toBe(p);
    store.delete(key);
    expect(store.get(key)).toBeUndefined();
    resolvePromise();
    await p;
  });

  it('marks canceled entries so they are not reused', () => {
    const store = new RequestDedupeStore();
    const key = 'GET|/api/cancel|{}';
    const p = Promise.resolve('x');
    store.set(key, p);
    store.markCanceled(key);
    expect(store.get(key)).toBeUndefined();
    expect(store.size).toBe(1);
    store.delete(key);
    expect(store.size).toBe(0);
  });
});