import { describe, expect, it } from 'vitest';

import en from '../../locales/langs/en-US/ticket.json';
import zh from '../../locales/langs/zh-CN/ticket.json';
import {
  formatAttachmentLimit,
  parseAttachmentPolicy,
  validateAttachmentFile,
  validateTicketImageFile,
} from './attachment-policy';

const MiB = 1024 * 1024;
const policy = { maxBytes: 3 * MiB, allowedExtensions: ['.txt', '.png'] };

describe('attachment policy parsing', () => {
  it('keeps the returned effective limit and normalizes only extension spelling', () => {
    expect(
      parseAttachmentPolicy({
        maxBytes: 3 * MiB,
        allowedExtensions: ['PNG', '.TXT', '.png'],
      }),
    ).toEqual({
      maxBytes: 3 * MiB,
      allowedExtensions: ['.png', '.txt'],
    });
  });

  it.each([
    null,
    undefined,
    {},
    { data: policy },
    { ...policy, maxBytes: '3145728' },
    { ...policy, maxBytes: -1 },
    { ...policy, maxBytes: NaN },
    { ...policy, maxBytes: Infinity },
    { ...policy, maxBytes: 1.5 },
    { ...policy, maxBytes: Number.MAX_SAFE_INTEGER + 1 },
    { maxBytes: 100 },
    { ...policy, allowedExtensions: '.png' },
    { ...policy, allowedExtensions: ['.png', null] },
    { ...policy, allowedExtensions: ['*'] },
    { ...policy, allowedExtensions: [''] },
    { ...policy, allowedExtensions: ['image/png'] },
  ])('fails closed without inventing fallback limits for %j', (payload) => {
    expect(parseAttachmentPolicy(payload)).toBeUndefined();
  });

  it('recognizes zero capacity and an empty allowlist as valid unavailable policies', () => {
    for (const value of [
      { ...policy, maxBytes: 0 },
      { ...policy, allowedExtensions: [] },
    ]) {
      const parsed = parseAttachmentPolicy(value);
      expect(parsed).toEqual(value);
      expect(
        validateAttachmentFile({ name: 'test.txt', size: 1 }, parsed)?.key,
      ).toBe('ticket.attachments.uploadUnavailable');
    }
  });
});

describe('attachment selection and send validation', () => {
  it('accepts the exact effective limit and mixed-case allowed extensions', () => {
    expect(
      validateAttachmentFile({ name: 'photo.PnG', size: 3 * MiB }, policy),
    ).toBeUndefined();
  });

  it.each([
    ['empty.txt', 0, 'emptyFile'],
    ['big.txt', 3 * MiB + 1, 'tooLarge'],
    ['payload.png.exe', 1, 'typeNotAllowed'],
    ['no-extension', 1, 'typeNotAllowed'],
    ['trailing.', 1, 'typeNotAllowed'],
    ['spaces.txt ', 1, 'typeNotAllowed'],
  ])('rejects %s with %s bytes', (name, size, key) => {
    expect(validateAttachmentFile({ name, size }, policy)?.key).toBe(
      'ticket.attachments.' + key,
    );
  });

  it('uses the current server limit, including a smaller subsequent policy', () => {
    const file = { name: 'a.txt', size: 2 * MiB };
    expect(validateAttachmentFile(file, policy)).toBeUndefined();
    expect(
      validateAttachmentFile(file, { ...policy, maxBytes: MiB })?.params,
    ).toEqual(['a.txt', '1 MiB']);
    expect(validateAttachmentFile(file, undefined)?.key).toBe(
      'ticket.attachments.policyUnavailable',
    );
  });

  it('displays exact MiB values without rounding a smaller cap up', () => {
    expect(formatAttachmentLimit(3 * MiB)).toBe('3 MiB');
    expect(formatAttachmentLimit(1.5 * MiB)).toBe('1.5 MiB');
    expect(formatAttachmentLimit(0)).toBe('0 MiB');
    expect(Number.parseFloat(formatAttachmentLimit(3 * MiB - 1)) * MiB).toBe(
      3 * MiB - 1,
    );
  });

  it('accepts only supported image files for inline ticket images', () => {
    const imagePolicy = {
      maxBytes: 3 * MiB,
      allowedExtensions: ['.gif', '.jpeg', '.jpg', '.png', '.webp', '.txt'],
    };
    for (const name of ['a.png', 'b.JPG', 'c.jpeg', 'd.webp', 'e.gif']) {
      expect(
        validateTicketImageFile({ name, size: 1024 }, imagePolicy),
      ).toBe(undefined);
    }
    expect(
      validateTicketImageFile({ name: 'notes.txt', size: 1024 }, imagePolicy)
        ?.key,
    ).toBe('ticket.attachments.imageOnly');
    expect(
      validateTicketImageFile({ name: 'notes.pdf', size: 1024 }, imagePolicy)
        ?.key,
    ).toBe('ticket.attachments.typeNotAllowed');
  });

  it('provides matching Chinese and English policy, retry and validation text', () => {
    const keys = [
      'hint',
      'policyLoading',
      'policyUnavailable',
      'retryPolicy',
      'uploadUnavailable',
      'noTypes',
      'emptyFile',
      'tooLarge',
      'typeNotAllowed',
      'imageOnly',
      'imageLoadFailed',
    ] as const;
    for (const locale of [zh, en]) {
      for (const key of keys) expect(locale.attachments[key]).toBeTruthy();
      expect(locale.attachments.hint).toContain('{0}');
      expect(locale.attachments.hint).toContain('{1}');
      expect(locale.attachments.hint).not.toMatch(/10\s*M[Bi]/i);
    }
  });
});
