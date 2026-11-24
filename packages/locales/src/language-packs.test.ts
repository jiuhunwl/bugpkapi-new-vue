import { createApp, h } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getLocaleOptions,
  i18n,
  loadLanguagePackManifest,
  loadLocaleMessages,
  setupI18n,
} from './index';

describe('language packs', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registers manifest entries and loads their messages', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/manifest.json')) {
        return {
          json: async () => ({
            packs: [
              {
                label: 'Francais',
                locale: 'fr-FR',
                messages: './fr-FR.json',
              },
            ],
            version: 1,
          }),
          ok: true,
          status: 200,
        } as Response;
      }
      return {
        json: async () => ({ common: { confirm: 'Confirmer' } }),
        ok: true,
        status: 200,
      } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    await loadLanguagePackManifest(
      'https://example.test/language-packs/manifest.json',
    );
    const app = createApp({ render: () => h('div') });
    await setupI18n(app, {
      defaultLocale: 'zh-CN',
      loadMessages: async () => ({}),
    });
    await loadLocaleMessages('fr-FR');

    expect(getLocaleOptions().value).toContainEqual({
      label: 'Francais',
      value: 'fr-FR',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/language-packs/fr-FR.json',
    );
    expect(i18n.global.t('common.confirm')).toBe('Confirmer');
  });
});
