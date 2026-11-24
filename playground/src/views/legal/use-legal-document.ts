import type { ComputedRef } from 'vue';

import type { LegalDocument, LegalDocumentType, LegalSection } from './types';

import { computed } from 'vue';

import { resolvePaymentAgreementDoc } from '#/components/payment-agreement/content';
import { $t, useI18n } from '#/locales';

export function useLegalDocument(
  documentType: () => LegalDocumentType,
  siteName: ComputedRef<string>,
  repositoryReference: ComputedRef<string>,
) {
  const { locale } = useI18n();

  /**
   * 支付（赞助）协议复用同一套法务页排版，但正文来自
   * components/payment-agreement/content.ts —— 与支付弹窗共用一份数据源，
   * 避免「弹窗里写的」和「页面上写的」两份条款漂移。
   */
  const paymentDocument = computed<LegalDocument>(() => {
    const doc = resolvePaymentAgreementDoc(locale.value);
    return {
      eyebrow: doc.eyebrow,
      notice: doc.notice,
      summary: doc.summary,
      title: doc.title,
      sections: [
        ...doc.sections.map((section) => ({
          highlight: section.highlight,
          id: section.id,
          intro: section.intro,
          items: section.items,
          outro: section.outro,
          title: section.title,
        })),
        {
          highlight: true,
          id: 'payment-ack',
          items: [doc.ack],
          title: $t('paymentAgreement.ackTitle'),
        },
      ],
    };
  });

  const privacySections = computed<LegalSection[]>(() => [
    {
      id: 'privacy-scope',
      items: [
        $t('legal.privacy.sections.scope.item1', [siteName.value]),
        $t('legal.privacy.sections.scope.item2'),
        $t('legal.privacy.sections.scope.item3'),
      ],
      title: $t('legal.privacy.sections.scope.title'),
    },
    {
      highlight: true,
      id: 'privacy-legal-basis',
      items: [
        $t('legal.privacy.sections.legalBasis.item1'),
        $t('legal.privacy.sections.legalBasis.item2'),
        $t('legal.privacy.sections.legalBasis.item3'),
      ],
      title: $t('legal.privacy.sections.legalBasis.title'),
    },
    {
      highlight: true,
      id: 'privacy-collection',
      intro: $t('legal.privacy.sections.collection.intro'),
      items: [
        $t('legal.privacy.sections.collection.item1'),
        $t('legal.privacy.sections.collection.item2'),
        $t('legal.privacy.sections.collection.item3'),
        $t('legal.privacy.sections.collection.item4'),
        $t('legal.privacy.sections.collection.item5'),
        $t('legal.privacy.sections.collection.item6'),
        $t('legal.privacy.sections.collection.item7'),
      ],
      title: $t('legal.privacy.sections.collection.title'),
      warning: $t('legal.privacy.sections.collection.warning'),
    },
    {
      id: 'privacy-purpose',
      intro: $t('legal.privacy.sections.purpose.intro'),
      items: [
        $t('legal.privacy.sections.purpose.item1'),
        $t('legal.privacy.sections.purpose.item2'),
        $t('legal.privacy.sections.purpose.item3'),
        $t('legal.privacy.sections.purpose.item4'),
        $t('legal.privacy.sections.purpose.item5'),
        $t('legal.privacy.sections.purpose.item6'),
      ],
      title: $t('legal.privacy.sections.purpose.title'),
    },
    {
      id: 'privacy-cookies',
      items: [
        $t('legal.privacy.sections.cookies.item1'),
        $t('legal.privacy.sections.cookies.item2'),
        $t('legal.privacy.sections.cookies.item3'),
      ],
      title: $t('legal.privacy.sections.cookies.title'),
    },
    {
      id: 'privacy-third-party',
      intro: $t('legal.privacy.sections.thirdParty.intro'),
      items: [
        $t('legal.privacy.sections.thirdParty.item1'),
        $t('legal.privacy.sections.thirdParty.item2'),
        $t('legal.privacy.sections.thirdParty.item3'),
        $t('legal.privacy.sections.thirdParty.item4'),
        $t('legal.privacy.sections.thirdParty.item5'),
      ],
      outro: $t('legal.privacy.sections.thirdParty.outro'),
      title: $t('legal.privacy.sections.thirdParty.title'),
    },
    {
      id: 'privacy-sharing',
      items: [
        $t('legal.privacy.sections.sharing.item1'),
        $t('legal.privacy.sections.sharing.item2'),
        $t('legal.privacy.sections.sharing.item3'),
      ],
      title: $t('legal.privacy.sections.sharing.title'),
    },
    {
      highlight: true,
      id: 'privacy-retention',
      items: [
        $t('legal.privacy.sections.retention.item1'),
        $t('legal.privacy.sections.retention.item2'),
        $t('legal.privacy.sections.retention.item3'),
        $t('legal.privacy.sections.retention.item4'),
      ],
      title: $t('legal.privacy.sections.retention.title'),
    },
    {
      id: 'privacy-logs',
      items: [
        $t('legal.privacy.sections.logs.item1'),
        $t('legal.privacy.sections.logs.item2'),
        $t('legal.privacy.sections.logs.item3'),
      ],
      title: $t('legal.privacy.sections.logs.title'),
    },
    {
      id: 'privacy-security',
      items: [
        $t('legal.privacy.sections.security.item1'),
        $t('legal.privacy.sections.security.item2'),
        $t('legal.privacy.sections.security.item3'),
      ],
      title: $t('legal.privacy.sections.security.title'),
    },
    {
      id: 'privacy-rights',
      intro: $t('legal.privacy.sections.rights.intro'),
      items: [
        $t('legal.privacy.sections.rights.item1'),
        $t('legal.privacy.sections.rights.item2'),
        $t('legal.privacy.sections.rights.item3'),
        $t('legal.privacy.sections.rights.item4'),
        $t('legal.privacy.sections.rights.item5'),
        $t('legal.privacy.sections.rights.item6'),
      ],
      outro: $t('legal.privacy.sections.rights.outro'),
      title: $t('legal.privacy.sections.rights.title'),
    },
    {
      id: 'privacy-minors',
      items: [
        $t('legal.privacy.sections.minors.item1'),
        $t('legal.privacy.sections.minors.item2'),
      ],
      title: $t('legal.privacy.sections.minors.title'),
    },
    {
      id: 'privacy-publication',
      items: [
        $t('legal.privacy.sections.publication.item1'),
        $t('legal.privacy.sections.publication.item2'),
        $t('legal.privacy.sections.publication.item3'),
      ],
      title: $t('legal.privacy.sections.publication.title'),
    },
    {
      id: 'privacy-changes',
      items: [
        $t('legal.privacy.sections.changes.item1'),
        $t('legal.privacy.sections.changes.item2'),
        $t('legal.privacy.sections.changes.item3'),
      ],
      title: $t('legal.privacy.sections.changes.title'),
    },
  ]);

  const termsSections = computed<LegalSection[]>(() => [
    {
      highlight: true,
      id: 'terms-scope',
      items: [
        $t('legal.terms.sections.scope.item1', [siteName.value]),
        $t('legal.terms.sections.scope.item2'),
        $t('legal.terms.sections.scope.item3'),
        $t('legal.terms.sections.scope.item4'),
      ],
      title: $t('legal.terms.sections.scope.title'),
    },
    {
      id: 'terms-account',
      items: [
        $t('legal.terms.sections.account.item1'),
        $t('legal.terms.sections.account.item2'),
        $t('legal.terms.sections.account.item3'),
      ],
      title: $t('legal.terms.sections.account.title'),
    },
    {
      id: 'terms-service',
      items: [
        $t('legal.terms.sections.service.item1'),
        $t('legal.terms.sections.service.item2'),
        $t('legal.terms.sections.service.item3'),
        $t('legal.terms.sections.service.item4'),
      ],
      title: $t('legal.terms.sections.service.title'),
    },
    {
      id: 'terms-prohibited',
      intro: $t('legal.terms.sections.prohibited.intro'),
      items: [
        $t('legal.terms.sections.prohibited.item1'),
        $t('legal.terms.sections.prohibited.item2'),
        $t('legal.terms.sections.prohibited.item3'),
        $t('legal.terms.sections.prohibited.item4'),
        $t('legal.terms.sections.prohibited.item5'),
        $t('legal.terms.sections.prohibited.item6'),
      ],
      title: $t('legal.terms.sections.prohibited.title'),
    },
    {
      id: 'terms-content',
      items: [
        $t('legal.terms.sections.content.item1'),
        $t('legal.terms.sections.content.item2'),
        $t('legal.terms.sections.content.item3'),
      ],
      title: $t('legal.terms.sections.content.title'),
    },
    {
      highlight: true,
      id: 'terms-fees',
      items: [
        $t('legal.terms.sections.fees.item1'),
        $t('legal.terms.sections.fees.item2'),
        $t('legal.terms.sections.fees.item3'),
        $t('legal.terms.sections.fees.item4'),
        $t('legal.terms.sections.fees.item5'),
        $t('legal.terms.sections.fees.item6'),
      ],
      title: $t('legal.terms.sections.fees.title'),
    },
    {
      id: 'terms-third-party',
      items: [
        $t('legal.terms.sections.thirdParty.item1'),
        $t('legal.terms.sections.thirdParty.item2'),
        $t('legal.terms.sections.thirdParty.item3'),
      ],
      title: $t('legal.terms.sections.thirdParty.title'),
    },
    {
      highlight: true,
      id: 'terms-suspension',
      items: [
        $t('legal.terms.sections.suspension.item1'),
        $t('legal.terms.sections.suspension.item2'),
        $t('legal.terms.sections.suspension.item3'),
        $t('legal.terms.sections.suspension.item4'),
      ],
      title: $t('legal.terms.sections.suspension.title'),
    },
    {
      id: 'terms-opensource',
      items: [
        $t('legal.terms.sections.opensource.item1'),
        $t('legal.terms.sections.opensource.item2', [
          repositoryReference.value,
        ]),
        $t('legal.terms.sections.opensource.item3'),
      ],
      title: $t('legal.terms.sections.opensource.title'),
    },
    {
      id: 'terms-privacy',
      items: [
        $t('legal.terms.sections.privacy.item1'),
        $t('legal.terms.sections.privacy.item2'),
      ],
      title: $t('legal.terms.sections.privacy.title'),
    },
    {
      highlight: true,
      id: 'terms-disclaimer',
      intro: $t('legal.terms.sections.disclaimer.intro'),
      items: [
        $t('legal.terms.sections.disclaimer.item1'),
        $t('legal.terms.sections.disclaimer.item2'),
        $t('legal.terms.sections.disclaimer.item3'),
        $t('legal.terms.sections.disclaimer.item4'),
        $t('legal.terms.sections.disclaimer.item5'),
        $t('legal.terms.sections.disclaimer.item6'),
      ],
      title: $t('legal.terms.sections.disclaimer.title'),
    },
    {
      highlight: true,
      id: 'terms-indemnity',
      items: [
        $t('legal.terms.sections.indemnity.item1'),
        $t('legal.terms.sections.indemnity.item2'),
        $t('legal.terms.sections.indemnity.item3'),
      ],
      title: $t('legal.terms.sections.indemnity.title'),
    },
    {
      highlight: true,
      id: 'terms-complaints',
      items: [
        $t('legal.terms.sections.complaints.item1'),
        $t('legal.terms.sections.complaints.item2'),
        $t('legal.terms.sections.complaints.item3'),
        $t('legal.terms.sections.complaints.item4'),
      ],
      title: $t('legal.terms.sections.complaints.title'),
    },
    {
      id: 'terms-donation',
      items: [
        $t('legal.terms.sections.donation.item1'),
        $t('legal.terms.sections.donation.item2'),
        $t('legal.terms.sections.donation.item3'),
        $t('legal.terms.sections.donation.item4'),
      ],
      title: $t('legal.terms.sections.donation.title'),
    },
    {
      id: 'terms-evidence',
      items: [
        $t('legal.terms.sections.evidence.item1'),
        $t('legal.terms.sections.evidence.item2'),
        $t('legal.terms.sections.evidence.item3'),
      ],
      title: $t('legal.terms.sections.evidence.title'),
    },
    {
      highlight: true,
      id: 'terms-changes',
      items: [
        $t('legal.terms.sections.changes.item1'),
        $t('legal.terms.sections.changes.item2'),
        $t('legal.terms.sections.changes.item3'),
        $t('legal.terms.sections.changes.item4'),
      ],
      title: $t('legal.terms.sections.changes.title'),
    },
    {
      id: 'terms-contact',
      items: [
        $t('legal.terms.sections.contact.item1'),
        $t('legal.terms.sections.contact.item2'),
      ],
      title: $t('legal.terms.sections.contact.title'),
    },
  ]);

  const currentDocument = computed<LegalDocument>(() => {
    if (documentType() === 'payment') {
      return paymentDocument.value;
    }
    return documentType() === 'terms'
      ? {
          eyebrow: $t('legal.terms.eyebrow'),
          notice: $t('legal.terms.notice'),
          sections: termsSections.value,
          summary: $t('legal.terms.summary'),
          title: $t('legal.terms.title'),
        }
      : {
          eyebrow: $t('legal.privacy.eyebrow'),
          notice: $t('legal.privacy.notice'),
          sections: privacySections.value,
          summary: $t('legal.privacy.summary'),
          title: $t('legal.privacy.title'),
        };
  });

  return { currentDocument };
}
