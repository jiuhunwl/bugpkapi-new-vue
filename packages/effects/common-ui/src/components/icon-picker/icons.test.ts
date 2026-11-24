import { afterEach, describe, expect, it, vi } from 'vitest';

import { ICONS_MAP, fetchIconsData } from './icons';

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of Object.keys(ICONS_MAP)) {
    Reflect.deleteProperty(ICONS_MAP, key);
  }
});

describe('offline icon picker data', () => {
  it('lists locally bundled icons without calling an Iconify API', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const icons = await fetchIconsData('lucide');

    expect(icons).toContain('lucide:refresh-cw');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns an empty list for an unregistered prefix without a network fallback', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await expect(fetchIconsData('not-registered')).resolves.toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
