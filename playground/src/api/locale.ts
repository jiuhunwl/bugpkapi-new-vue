import { preferences } from '@vben/preferences';

/**
 * Build the locale headers used by both the shared request client and the
 * public endpoints that intentionally use raw fetch (site brand, public
 * donation, advertisements, and market detail). Without these headers the
 * backend resolves the default language and backend-data translations appear
 * not to work even when the dictionary is correct.
 */
export function localeRequestHeaders() {
  const documentLocale =
    typeof document === 'undefined' ? '' : document.documentElement.lang;
  const browserLanguages =
    typeof navigator === 'undefined'
      ? []
      : [...(navigator.languages || []), navigator.language];
  const appLocale =
    [documentLocale, preferences.app.locale, ...browserLanguages].find(
      (value) => typeof value === 'string' && value.trim(),
    ) || 'zh-CN';
  const languages = [appLocale, ...browserLanguages]
    .map((value) => String(value || '').trim())
    .filter((value, index, values) => value && values.indexOf(value) === index);
  const acceptLanguage = languages
    .map((value, index) =>
      index === 0
        ? value
        : `${value};q=${Math.max(0.5, 1 - index * 0.1).toFixed(1)}`,
    )
    .join(',');
  return { acceptLanguage, appLocale };
}
