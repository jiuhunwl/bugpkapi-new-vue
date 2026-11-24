import { describe, expect, it } from 'vitest';

import {
  createDefaultDonationConfig,
  createDonationMethod,
  donationIconPresets,
  formatDonationAmount,
  normalizeDonationConfig,
  normalizeDonationSupporter,
  validateDonationConfig,
  validateDonationSupporter,
} from './model';

describe('donation settings model', () => {
  it('provides visual presets for mainstream donation channels', () => {
    expect(donationIconPresets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          color: '#07c160',
          icon: 'simple-icons:wechat',
          key: 'wechat',
        }),
        expect.objectContaining({
          color: '#1677ff',
          icon: 'simple-icons:alipay',
          key: 'alipay',
        }),
      ]),
    );
  });

  it('normalizes method order and copy whitespace', () => {
    const config = createDefaultDonationConfig();
    config.eyebrow = ' Donate ';
    config.title = ' Support ';
    config.scanTitle = ' Scan ';
    config.methods = [
      {
        ...createDonationMethod([]),
        key: ' ALIPAY ',
        name: ' Alipay ',
      },
    ];

    const normalized = normalizeDonationConfig(config);
    expect(normalized.eyebrow).toBe('Donate');
    expect(normalized.methods[0]).toMatchObject({
      key: 'alipay',
      name: 'Alipay',
      sortNo: 10,
    });
  });

  it('requires an enabled method with a QR code before publishing', () => {
    const config = createDefaultDonationConfig();
    config.enabled = 1;
    config.eyebrow = 'Donate';
    config.title = 'Support';
    config.scanTitle = 'Scan';

    expect(validateDonationConfig(config)?.code).toBe(
      'publishedMethodRequired',
    );

    config.methods = [
      {
        ...createDonationMethod([]),
        enabled: 1,
        key: 'alipay',
        name: 'Alipay',
      },
    ];
    expect(validateDonationConfig(config)?.code).toBe(
      'enabledMethodRequiresQrCode',
    );
  });

  it('rejects duplicate stable channel keys', () => {
    const config = createDefaultDonationConfig();
    config.eyebrow = 'Donate';
    config.title = 'Support';
    config.scanTitle = 'Scan';
    config.methods = [
      { ...createDonationMethod([]), key: 'wechat', name: 'WeChat' },
      { ...createDonationMethod([]), key: 'WECHAT', name: 'Other' },
    ];

    expect(validateDonationConfig(config)).toEqual({
      code: 'duplicateKey',
      methodIndex: 1,
    });
  });

  it('normalizes supporter payload without using floating point amounts', () => {
    const normalized = normalizeDonationSupporter({
      amount: ' 0012.5 ',
      avatarUrl: ' https://cdn.example.com/avatar.png ',
      donatedAt: ' 2026-08-09 08:30:00 ',
      message: ' Thank you ',
      nickname: ' Alice ',
    });

    expect(normalized).toEqual({
      amount: '12.50',
      avatarUrl: 'https://cdn.example.com/avatar.png',
      donatedAt: '2026-08-09 08:30:00',
      message: 'Thank you',
      nickname: 'Alice',
    });
  });

  it('validates supporter required fields and safe amounts', () => {
    expect(
      validateDonationSupporter({
        amount: '1',
        avatarUrl: '',
        donatedAt: '',
        message: '',
        nickname: '   ',
      })?.code,
    ).toBe('supporterNicknameRequired');

    for (const amount of ['', '0', '-1', '1.234', '1e3', '10000000000']) {
      expect(
        validateDonationSupporter({
          amount,
          avatarUrl: '',
          donatedAt: '2026-08-09 08:30:00',
          message: '',
          nickname: 'Alice',
        })?.code,
      ).toBe('supporterAmountInvalid');
    }

    expect(
      validateDonationSupporter({
        amount: '1',
        avatarUrl: 'javascript:alert(1)',
        donatedAt: '2026-08-09 08:30:00',
        message: '',
        nickname: 'Alice',
      })?.code,
    ).toBe('supporterAvatarInvalid');
  });

  it('formats supporter amounts consistently for display', () => {
    expect(formatDonationAmount('12.5')).toBe('¥12.50');
    expect(formatDonationAmount('0.01')).toBe('¥0.01');
  });
});
