import {
  i18n,
  getLocaleOptions,
  installLanguagePack,
  loadLocaleMessages,
  loadLanguagePackManifest,
  loadLocalesMap,
  loadLocalesMapFromDir,
  registerLanguagePack,
  registerLocaleOption,
  setupI18n,
} from './i18n';

const $t = i18n.global.t;
const $te = i18n.global.te;

export {
  $t,
  $te,
  getLocaleOptions,
  installLanguagePack,
  i18n,
  loadLocaleMessages,
  loadLanguagePackManifest,
  loadLocalesMap,
  loadLocalesMapFromDir,
  registerLanguagePack,
  registerLocaleOption,
  setupI18n,
};
export {
  type ImportLocaleFn,
  type LanguagePackDefinition,
  type LanguagePackManifest,
  type LocaleSetupOptions,
  type LocaleOption,
  type SupportedLanguagesType,
} from './typing';
export type { CompileError } from '@intlify/core-base';

export { useI18n } from 'vue-i18n';

export type { Locale } from 'vue-i18n';
