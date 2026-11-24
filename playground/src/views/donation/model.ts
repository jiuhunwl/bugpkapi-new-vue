import type { DonationApi } from '#/api/donation';

export type DonationValidationCode =
  | 'descriptionTooLong'
  | 'duplicateKey'
  | 'enabledMethodRequiresQrCode'
  | 'eyebrowRequired'
  | 'eyebrowTooLong'
  | 'invalidColor'
  | 'invalidIcon'
  | 'invalidKey'
  | 'methodNameRequired'
  | 'publishedMethodRequired'
  | 'scanDescriptionTooLong'
  | 'scanTitleRequired'
  | 'scanTitleTooLong'
  | 'thanksTooLong'
  | 'titleRequired'
  | 'titleTooLong'
  | 'tooManyMethods';

export interface DonationValidationIssue {
  code: DonationValidationCode;
  methodIndex?: number;
}

export type DonationSupporterValidationCode =
  | 'supporterAmountInvalid'
  | 'supporterAvatarInvalid'
  | 'supporterDonatedAtInvalid'
  | 'supporterMessageTooLong'
  | 'supporterNicknameRequired'
  | 'supporterNicknameTooLong';

export interface DonationSupporterValidationIssue {
  code: DonationSupporterValidationCode;
}

export interface DonationIconPreset {
  color: string;
  icon: string;
  key: 'alipay' | 'coffee' | 'heart' | 'paypal' | 'qq' | 'wechat';
  labelKey: string;
}

export const donationIconPresets: DonationIconPreset[] = [
  {
    color: '#07c160',
    icon: 'simple-icons:wechat',
    key: 'wechat',
    labelKey: 'donationSettings.iconPicker.presets.wechat',
  },
  {
    color: '#1677ff',
    icon: 'simple-icons:alipay',
    key: 'alipay',
    labelKey: 'donationSettings.iconPicker.presets.alipay',
  },
  {
    color: '#12b7f5',
    icon: 'simple-icons:tencentqq',
    key: 'qq',
    labelKey: 'donationSettings.iconPicker.presets.qq',
  },
  {
    color: '#003087',
    icon: 'simple-icons:paypal',
    key: 'paypal',
    labelKey: 'donationSettings.iconPicker.presets.paypal',
  },
  {
    color: '#b45309',
    icon: 'lucide:coffee',
    key: 'coffee',
    labelKey: 'donationSettings.iconPicker.presets.coffee',
  },
  {
    color: '#e11d48',
    icon: 'lucide:heart',
    key: 'heart',
    labelKey: 'donationSettings.iconPicker.presets.heart',
  },
];

const methodKeyPattern = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const colorPattern = /^#[0-9a-f]{6}$/i;
const iconPattern = /^(?:lucide|mdi|simple-icons):[a-z0-9][a-z0-9-]{0,95}$/;
const donationAmountPattern = /^[0-9]+(?:\.[0-9]{1,2})?$/;
const donatedAtPattern =
  /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;

export function createDefaultDonationConfig(): DonationApi.Config {
  return {
    description: '',
    enabled: 0,
    eyebrow: '',
    methods: [],
    scanDescription: '',
    scanTitle: '',
    thanks: '',
    title: '',
    updateTime: null,
  };
}

export function createDonationMethod(
  methods: DonationApi.Method[],
): DonationApi.Method {
  const existing = new Set(methods.map((method) => method.key));
  let suffix = methods.length + 1;
  while (existing.has(`channel-${suffix}`)) suffix += 1;
  return {
    color: '#1677ff',
    enabled: 0,
    icon: 'lucide:heart',
    key: `channel-${suffix}`,
    name: '',
    qrCodeUrl: '',
    sortNo: (methods.length + 1) * 10,
    tip: '',
  };
}

export function normalizeDonationConfig(
  config: DonationApi.Config,
): DonationApi.SavePayload {
  return {
    description: config.description.trim(),
    enabled: config.enabled === 1 ? 1 : 0,
    eyebrow: config.eyebrow.trim(),
    methods: config.methods.map((method, index) => ({
      color: method.color.trim(),
      enabled: method.enabled === 1 ? 1 : 0,
      icon: method.icon.trim(),
      key: method.key.trim().toLowerCase(),
      name: method.name.trim(),
      qrCodeUrl: method.qrCodeUrl.trim(),
      sortNo: (index + 1) * 10,
      tip: method.tip.trim(),
    })),
    scanDescription: config.scanDescription.trim(),
    scanTitle: config.scanTitle.trim(),
    thanks: config.thanks.trim(),
    title: config.title.trim(),
  };
}

export function validateDonationConfig(
  config: DonationApi.Config,
): DonationValidationIssue | null {
  const normalized = normalizeDonationConfig(config);
  if (!normalized.eyebrow) return { code: 'eyebrowRequired' };
  if (normalized.eyebrow.length > 64) return { code: 'eyebrowTooLong' };
  if (!normalized.title) return { code: 'titleRequired' };
  if (normalized.title.length > 120) return { code: 'titleTooLong' };
  if (normalized.description.length > 500) {
    return { code: 'descriptionTooLong' };
  }
  if (!normalized.scanTitle) return { code: 'scanTitleRequired' };
  if (normalized.scanTitle.length > 120) {
    return { code: 'scanTitleTooLong' };
  }
  if (normalized.scanDescription.length > 255) {
    return { code: 'scanDescriptionTooLong' };
  }
  if (normalized.thanks.length > 255) return { code: 'thanksTooLong' };
  if (normalized.methods.length > 8) return { code: 'tooManyMethods' };

  const seenKeys = new Set<string>();
  let enabledCount = 0;
  for (const [methodIndex, method] of normalized.methods.entries()) {
    if (!methodKeyPattern.test(method.key)) {
      return { code: 'invalidKey', methodIndex };
    }
    if (seenKeys.has(method.key)) {
      return { code: 'duplicateKey', methodIndex };
    }
    seenKeys.add(method.key);
    if (!method.name) return { code: 'methodNameRequired', methodIndex };
    if (!iconPattern.test(method.icon)) {
      return { code: 'invalidIcon', methodIndex };
    }
    if (!colorPattern.test(method.color)) {
      return { code: 'invalidColor', methodIndex };
    }
    if (method.enabled === 1) {
      enabledCount += 1;
      if (!method.qrCodeUrl) {
        return { code: 'enabledMethodRequiresQrCode', methodIndex };
      }
    }
  }
  if (normalized.enabled === 1 && enabledCount === 0) {
    return { code: 'publishedMethodRequired' };
  }
  return null;
}

function normalizedDonationAmount(value: string): null | string {
  const trimmed = value.trim();
  if (
    !trimmed ||
    trimmed.length > 64 ||
    !donationAmountPattern.test(trimmed)
  ) {
    return null;
  }
  const [rawInteger = '', rawFraction = ''] = trimmed.split('.', 2);
  const integer = rawInteger.replace(/^0+(?=\d)/, '');
  if (integer.length > 10) return null;
  const fraction = rawFraction.padEnd(2, '0') || '00';
  if (/^0+$/.test(integer) && /^0+$/.test(fraction)) return null;
  return `${integer || '0'}.${fraction}`;
}

function isSafeDonationAvatar(value: string) {
  if (!value) return true;
  if (
    value.length > 1024 ||
    /[\\\s\u0000-\u001f\u007f]/.test(value)
  ) {
    return false;
  }
  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      Boolean(parsed.hostname) &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
}

function isValidDonationTime(value: string) {
  if (!value) return true;
  const match = donatedAtPattern.exec(value);
  if (!match) return false;
  const [, year, month, day, hour, minute, second] = match;
  const parts = [year, month, day, hour, minute, second].map(Number);
  const date = new Date(
    Date.UTC(
      parts[0]!,
      parts[1]! - 1,
      parts[2]!,
      parts[3]!,
      parts[4]!,
      parts[5]!,
    ),
  );
  return (
    date.getUTCFullYear() === parts[0] &&
    date.getUTCMonth() === parts[1]! - 1 &&
    date.getUTCDate() === parts[2] &&
    date.getUTCHours() === parts[3] &&
    date.getUTCMinutes() === parts[4] &&
    date.getUTCSeconds() === parts[5]
  );
}

export function normalizeDonationSupporter(
  supporter: DonationApi.CreateSupporterPayload,
): DonationApi.CreateSupporterPayload {
  return {
    amount: normalizedDonationAmount(supporter.amount) ?? supporter.amount.trim(),
    avatarUrl: supporter.avatarUrl.trim(),
    donatedAt: supporter.donatedAt.trim(),
    message: supporter.message.trim(),
    nickname: supporter.nickname.trim(),
  };
}

export function validateDonationSupporter(
  supporter: DonationApi.CreateSupporterPayload,
): DonationSupporterValidationIssue | null {
  const normalized = normalizeDonationSupporter(supporter);
  if (!normalized.nickname) return { code: 'supporterNicknameRequired' };
  if (normalized.nickname.length > 64) {
    return { code: 'supporterNicknameTooLong' };
  }
  if (!normalizedDonationAmount(normalized.amount)) {
    return { code: 'supporterAmountInvalid' };
  }
  if (!isSafeDonationAvatar(normalized.avatarUrl)) {
    return { code: 'supporterAvatarInvalid' };
  }
  if (normalized.message.length > 255) {
    return { code: 'supporterMessageTooLong' };
  }
  if (!isValidDonationTime(normalized.donatedAt)) {
    return { code: 'supporterDonatedAtInvalid' };
  }
  return null;
}

export function formatDonationAmount(value: string) {
  const normalized = normalizedDonationAmount(value);
  return `¥${normalized ?? '0.00'}`;
}
