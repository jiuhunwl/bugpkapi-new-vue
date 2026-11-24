import { requestClient } from '#/api/request';

export type AgreementDocKey = 'payment' | 'privacy' | 'terms';
export type AgreementLang = 'en-US' | 'zh-CN';
export type AgreementMode = 'commercial' | 'welfare';

export const AGREEMENT_DOC_KEYS: AgreementDocKey[] = [
  'payment',
  'privacy',
  'terms',
];
export const AGREEMENT_MODES: AgreementMode[] = ['welfare', 'commercial'];
export const AGREEMENT_LANGS: AgreementLang[] = ['zh-CN', 'en-US'];

export namespace AgreementApi {
  export interface AdminOverview {
    activeMode: AgreementMode;
    items: Template[];
  }

  export interface PublicDocument {
    configured: boolean;
    contentHtml?: string;
    docKey: AgreementDocKey;
    effectiveDate?: string;
    lang: AgreementLang;
    mode: AgreementMode;
    summary?: string;
    title?: string;
    updateTime?: string;
    version?: string;
  }

  export interface SaveTemplatePayload {
    contentHtml: string;
    effectiveDate: string;
    status: number;
    summary: string;
    title: string;
    version: string;
  }

  export interface Template {
    contentHtml: string;
    docKey: AgreementDocKey;
    effectiveDate?: string;
    lang: AgreementLang;
    mode: AgreementMode;
    status: number;
    summary: string;
    title: string;
    updateTime?: string;
    version: string;
  }
}

export function getAdminAgreements() {
  return requestClient.get<AgreementApi.AdminOverview>('/site/admin/agreements');
}

export function saveAgreementMode(mode: AgreementMode) {
  return requestClient.put('/site/admin/agreement-mode', { mode });
}

export function saveAgreementTemplate(
  docKey: AgreementDocKey,
  mode: AgreementMode,
  lang: AgreementLang,
  payload: AgreementApi.SaveTemplatePayload,
) {
  return requestClient.put(
    `/site/admin/agreements/${docKey}/${mode}/${lang}`,
    payload,
  );
}

export function getPublicAgreement(
  docKey: AgreementDocKey,
  lang: string,
) {
  return requestClient.get<AgreementApi.PublicDocument>(
    `/site/agreements/${docKey}`,
    { params: { lang } },
  );
}

export function normalizeAgreementLang(value: unknown): AgreementLang {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replaceAll('_', '-');
  return normalized.startsWith('en') ? 'en-US' : 'zh-CN';
}
