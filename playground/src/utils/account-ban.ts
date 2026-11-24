import { $t } from '#/locales';

const ACCOUNT_BANNED_TAG = 'ACCOUNT_BANNED';

type AccountBanType = 'PERMANENT' | 'TEMPORARY';

interface AccountBanDetails {
  accountStatus: 'BANNED';
  banReason: string;
  banType: AccountBanType;
  banUntil: string;
  permanent: boolean;
  resourceAccess: 'DENIED';
  tag: typeof ACCOUNT_BANNED_TAG;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseAccountBanDetails(value: unknown): AccountBanDetails | null {
  if (!isRecord(value)) {
    return null;
  }

  const banReason =
    typeof value.banReason === 'string' ? value.banReason.trim() : '';
  const banUntil =
    typeof value.banUntil === 'string' ? value.banUntil.trim() : '';
  const banType = value.banType;

  if (
    value.tag !== ACCOUNT_BANNED_TAG ||
    value.accountStatus !== 'BANNED' ||
    value.resourceAccess !== 'DENIED' ||
    (banType !== 'PERMANENT' && banType !== 'TEMPORARY') ||
    typeof value.permanent !== 'boolean' ||
    value.permanent !== (banType === 'PERMANENT') ||
    !banReason
  ) {
    return null;
  }

  return {
    accountStatus: 'BANNED',
    banReason,
    banType,
    banUntil: banType === 'PERMANENT' ? '' : banUntil,
    permanent: value.permanent,
    resourceAccess: 'DENIED',
    tag: ACCOUNT_BANNED_TAG,
  };
}

export { ACCOUNT_BANNED_TAG, accountBanDescription, parseAccountBanDetails };
export type { AccountBanDetails, AccountBanType };

// Shared by the request interceptor and by transports that bypass the request
// client, such as the ticket event stream, so both explain a ban identically.
function accountBanDescription(details: AccountBanDetails): string {
  if (details.permanent) {
    return $t('page.auth.accountBan.permanent', [details.banReason]);
  }
  if (details.banUntil) {
    return $t('page.auth.accountBan.temporary', [
      details.banUntil,
      details.banReason,
    ]);
  }
  return $t('page.auth.accountBan.generic', [details.banReason]);
}
