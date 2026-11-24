/**
 * A locale identifier. The application ships with Chinese and English, but
 * language packs can register any valid BCP-47 identifier at runtime.
 */
export type SupportedLanguagesType = string;

export type ImportLocaleFn = () => Promise<{ default: Record<string, string> }>;

export type LoadMessageFn = (
  lang: SupportedLanguagesType,
) => Promise<Record<string, string> | undefined>;

export interface LocaleOption {
  label: string;
  value: SupportedLanguagesType;
}

export interface LanguagePackDefinition {
  locale: SupportedLanguagesType;
  label: string;
  /** A JSON URL or an already loaded vue-i18n message object. */
  messages: string | Record<string, unknown>;
}

export interface LanguagePackManifest {
  version: number;
  packs: LanguagePackDefinition[];
}

export interface LocaleSetupOptions {
  /**
   * Default language
   * @default zh-CN
   */
  defaultLocale?: SupportedLanguagesType;
  /**
   * Load message function
   * @param lang
   * @returns
   */
  loadMessages?: LoadMessageFn;
  /**
   * Whether to warn when the key is not found
   */
  missingWarn?: boolean;
}
