import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (file) => readFile(new URL(file, import.meta.url), 'utf8');
const zh = JSON.parse(await read('../src/locales/langs/zh-CN/legal.json'));
const en = JSON.parse(await read('../src/locales/langs/en-US/legal.json'));
const composer = await read('../src/views/legal/use-legal-document.ts');
const hero = await read('../src/views/legal/components/LegalDocumentHero.vue');
const leaves = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([key, value]) =>
    typeof value === 'string'
      ? [[prefix + key, value]]
      : leaves(value, prefix + key + '.'),
  );

test('Chinese and English legal documents have the same keys and interpolation arguments', () => {
  const a = leaves(zh),
    b = new Map(leaves(en));
  assert.deepEqual(a.map(([key]) => key).sort(), [...b.keys()].sort());
  for (const [key, text] of a) {
    assert.ok(text.trim() && b.get(key).trim(), key);
    assert.deepEqual(
      text.match(/\{\d+\}/g) || [],
      b.get(key).match(/\{\d+\}/g) || [],
      key,
    );
  }
});

test('all translated sections and paragraphs are actually referenced by the public document', () => {
  for (const kind of ['privacy', 'terms']) {
    for (const [key] of leaves(zh[kind].sections)) {
      assert.ok(
        composer.includes("'legal." + kind + '.sections.' + key + "'"),
        kind + '.' + key,
      );
    }
  }
});

test('revision metadata does not claim automatic retrospective effectiveness', () => {
  assert.equal(zh.common.versionValue, 'V2.0');
  assert.equal(en.common.versionValue, 'V2.0');
  assert.equal(zh.common.updatedDateValue, '2026-10-06');
  assert.equal(en.common.updatedDateValue, '2026-10-06');
  assert.match(zh.common.effectiveDateValue, /公告/);
  assert.ok(hero.includes("$t('legal.common.updatedDateValue')"));
  assert.ok(hero.includes("$t('legal.common.versionValue')"));
  assert.ok(!hero.includes('V1.0'));
});

test('privacy disclosures reflect encrypted keys, log hiding and optional processing', () => {
  assert.match(zh.privacy.sections.collection.item3, /加密密文/);
  assert.match(zh.privacy.sections.retention.item4, /不等于.*删除/);
  assert.ok(zh.privacy.sections.legalBasis && en.privacy.sections.legalBasis);
  assert.ok(zh.privacy.sections.logs && en.privacy.sections.logs);
  assert.ok(zh.privacy.sections.publication && en.privacy.sections.publication);
});

test('terms contain actionable rights notices and preserve mandatory obligations', () => {
  for (const key of ['complaints', 'donation', 'evidence', 'content']) {
    assert.ok(zh.terms.sections[key] && en.terms.sections[key], key);
  }
  assert.match(zh.terms.sections.disclaimer.item6, /故意.*重大过失/);
  assert.match(zh.terms.sections.scope.item2, /不.*单独同意/);
  assert.match(zh.terms.sections.fees.item5, /HTTP 200/);
  assert.match(zh.terms.sections.complaints.item3, /不自动/);
  assert.doesNotMatch(zh.terms.sections.opensource.item1, /本程序基于 MIT/);
});
