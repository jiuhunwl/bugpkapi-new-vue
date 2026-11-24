import { describe, expect, it } from 'vitest';

import enTranslation from '#/locales/langs/en-US/translationAdmin.json';
import zhTranslation from '#/locales/langs/zh-CN/translationAdmin.json';

const resources = [
  'site',
  'interface',
  'packageGlobal',
  'packageInterface',
  'packageInterfaceSpec',
  'packagePoint',
  'notice',
  'advertisement',
  'donation',
  'rechargePreset',
  'friendLink',
  'redeemType',
];

const fieldKeys = [
  'site.siteName',
  'site.slogan',
  'site.description',
  'site.seoTitle',
  'site.seoKeywords',
  'interface.name',
  'interface.remark',
  'interface.docSummary',
  'interface.docNotice',
  'packageGlobal.name',
  'packageGlobal.remark',
  'packageInterface.name',
  'packageInterface.remark',
  'packageInterfaceSpec.specName',
  'packagePoint.name',
  'packagePoint.remark',
  'notice.title',
  'notice.summary',
  'notice.contentHtml',
  'advertisement.title',
  'advertisement.description',
  'donation.eyebrow',
  'donation.title',
  'donation.description',
  'donation.scanTitle',
  'donation.scanDescription',
  'donation.thanks',
  'rechargePreset.name',
  'friendLink.description',
  'redeemType.name',
];

function hasKey(pack: Record<string, any>, key: string) {
  const [namespace, ...segments] = key.split('.');
  if (!namespace) return false;
  let current: unknown = pack[namespace];
  for (const segment of segments) {
    if (typeof current !== 'object' || current === null) return false;
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === 'string' && current.length > 0;
}

describe('translation dictionary labels', () => {
  it.each([
    ['zh-CN', zhTranslation],
    ['en-US', enTranslation],
  ])('contains every resource label for %s', (_locale, pack) => {
    for (const resource of resources) {
      expect(hasKey(pack, `resources.${resource}`)).toBe(true);
    }
  });

  it.each([
    ['zh-CN', zhTranslation],
    ['en-US', enTranslation],
  ])('contains every field label for %s', (_locale, pack) => {
    for (const key of fieldKeys) {
      expect(hasKey(pack, `fields.${key}`)).toBe(true);
    }
  });
});
