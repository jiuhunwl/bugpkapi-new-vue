export type LegalDocumentType = 'payment' | 'privacy' | 'terms';

export interface LegalSection {
  highlight?: boolean;
  id: string;
  intro?: string;
  items: string[];
  outro?: string;
  title: string;
  warning?: string;
}

export interface LegalContactItem {
  href?: string;
  icon: string;
  label: string;
  value: string;
}

export interface LegalDocument {
  eyebrow: string;
  notice: string;
  sections: LegalSection[];
  summary: string;
  title: string;
}
