import type { App } from 'vue';
import type {
  ImportLocaleFn,
  LanguagePackDefinition,
  LanguagePackManifest,
  LoadMessageFn,
  LocaleOption,
  LocaleSetupOptions,
  SupportedLanguagesType,
} from './typing';

import { readonly, shallowRef, unref } from 'vue';
import { createI18n } from 'vue-i18n';

import { useSimpleLocale } from '@vben-core/composables';

const i18n = createI18n({
  globalInjection: true,
  legacy: false,
  locale: '',
  messages: {},
});

const modules = import.meta.glob('./langs/**/*.json');

const { setSimpleLocale } = useSimpleLocale();

const localesMap = loadLocalesMapFromDir(
  /\.\/langs\/([^/]+)\/(.*)\.json$/,
  modules,
);
const localeOptions = shallowRef<LocaleOption[]>([
  { label: '\u7B80\u4F53\u4E2D\u6587', value: 'zh-CN' },
  { label: 'English', value: 'en-US' },
]);
const languagePackLoaders = new Map<
  SupportedLanguagesType,
  () => Promise<Record<string, unknown>>
>();
let loadMessages: LoadMessageFn;

function registerLocaleOption(option: LocaleOption) {
  const existing = localeOptions.value.findIndex(
    (item) => item.value === option.value,
  );
  if (existing >= 0) {
    localeOptions.value = localeOptions.value.map((item, index) =>
      index === existing ? { ...item, ...option } : item,
    );
  } else {
    localeOptions.value = [...localeOptions.value, option];
  }
}

function getLocaleOptions() {
  return readonly(localeOptions);
}

function registerLanguagePack(pack: LanguagePackDefinition) {
  if (!pack.locale) {
    throw new Error('Language pack locale is required');
  }
  const locale = pack.locale;
  registerLocaleOption({ label: pack.label, value: locale });
  languagePackLoaders.set(locale, async () => {
    if (typeof pack.messages !== 'string') {
      return pack.messages;
    }
    const response = await fetch(pack.messages);
    if (!response.ok) {
      throw new Error(`Failed to load language pack ${locale}`);
    }
    const payload = (await response.json()) as Record<string, unknown>;
    return payload.default && typeof payload.default === 'object'
      ? (payload.default as Record<string, unknown>)
      : payload;
  });
}

function resolveLanguagePackMessages(
  pack: LanguagePackDefinition,
  manifestUrl: string,
) {
  if (typeof pack.messages !== 'string') return pack;
  const baseUrl =
    typeof window === 'undefined'
      ? new URL(manifestUrl, 'http://localhost')
      : new URL(manifestUrl, window.location.href);
  return {
    ...pack,
    messages: new URL(pack.messages, baseUrl).href,
  };
}

async function loadLanguagePackManifest(
  source = '/language-packs/manifest.json',
): Promise<LanguagePackManifest | undefined> {
  const response = await fetch(source);
  if (!response.ok) {
    if (response.status === 404) return;
    throw new Error(`Failed to load language pack manifest: ${source}`);
  }
  const manifest = (await response.json()) as LanguagePackManifest;
  if (!manifest || !Array.isArray(manifest.packs)) {
    throw new Error('Invalid language pack manifest');
  }
  for (const pack of manifest.packs) {
    registerLanguagePack(resolveLanguagePackMessages(pack, source));
  }
  return manifest;
}

async function installLanguagePack(source: string | LanguagePackDefinition) {
  let pack: LanguagePackDefinition;
  if (typeof source === 'string') {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Failed to install language pack: ${source}`);
    }
    const payload = (await response.json()) as LanguagePackDefinition;
    pack = resolveLanguagePackMessages(payload, source);
  } else {
    pack = source;
  }
  registerLanguagePack(pack);
  return pack;
}

/**
 * Load locale modules
 * @param modules
 */
function loadLocalesMap(modules: Record<string, () => Promise<unknown>>) {
  const localesMap: Record<string, ImportLocaleFn> = {};

  for (const [path, loadLocale] of Object.entries(modules)) {
    const key = path.match(/([\w-]*)\.(json)/)?.[1];
    if (key) {
      localesMap[key] = loadLocale as ImportLocaleFn;
    }
  }
  return localesMap;
}

/**
 * Load locale modules with directory structure
 * @param regexp - Regular expression to match language and file names
 * @param modules - The modules object containing paths and import functions
 * @returns A map of locales to their corresponding import functions
 */
function loadLocalesMapFromDir(
  regexp: RegExp,
  modules: Record<string, () => Promise<unknown>>,
): Record<string, ImportLocaleFn> {
  const localesRaw: Record<string, Record<string, () => Promise<unknown>>> = {};
  const localesMap: Record<string, ImportLocaleFn> = {};

  // Iterate over the modules to extract language and file names
  for (const path in modules) {
    const match = path.match(regexp);
    if (match) {
      const [_, locale, fileName] = match;
      if (locale && fileName) {
        if (!localesRaw[locale]) {
          localesRaw[locale] = {};
        }
        if (modules[path]) {
          localesRaw[locale][fileName] = modules[path];
        }
      }
    }
  }

  // Convert raw locale data into async import functions
  for (const [locale, files] of Object.entries(localesRaw)) {
    localesMap[locale] = async () => {
      const messages: Record<string, any> = {};
      for (const [fileName, importFn] of Object.entries(files)) {
        messages[fileName] = ((await importFn()) as any)?.default;
      }
      return { default: messages };
    };
  }

  return localesMap;
}

/**
 * Set i18n language
 * @param locale
 */
function setI18nLanguage(locale: SupportedLanguagesType) {
  i18n.global.locale.value = locale;

  if (typeof document !== 'undefined') {
    document.querySelector('html')?.setAttribute('lang', locale);
  }
}

async function setupI18n(app: App, options: LocaleSetupOptions = {}) {
  const { defaultLocale = 'zh-CN' } = options;
  // app可以自行扩展一些第三方库和组件库的国际化
  loadMessages = options.loadMessages || (async () => ({}));
  app.use(i18n);
  await loadLocaleMessages(defaultLocale);

  // 在控制台打印警告
  i18n.global.setMissingHandler((locale, key) => {
    if (options.missingWarn && key.includes('.')) {
      console.warn(
        `[intlify] Not found '${key}' key in '${locale}' locale messages.`,
      );
    }
  });
}

/**
 * Load locale messages
 * @param lang
 */
async function loadLocaleMessages(lang: SupportedLanguagesType) {
  if (unref(i18n.global.locale) === lang) {
    return setI18nLanguage(lang);
  }
  setSimpleLocale(lang);

  const message =
    (await localesMap[lang]?.()) ||
    (await languagePackLoaders
      .get(lang)
      ?.()
      .then((messages) => ({ default: messages })));

  if (message?.default) {
    i18n.global.setLocaleMessage(lang, message.default);
  }

  const mergeMessage = await loadMessages(lang);
  i18n.global.mergeLocaleMessage(lang, mergeMessage);

  return setI18nLanguage(lang);
}

export {
  i18n,
  loadLocaleMessages,
  getLocaleOptions,
  installLanguagePack,
  loadLocalesMap,
  loadLocalesMapFromDir,
  loadLanguagePackManifest,
  registerLanguagePack,
  registerLocaleOption,
  setupI18n,
};
