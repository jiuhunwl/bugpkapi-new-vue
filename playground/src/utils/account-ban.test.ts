import { describe, expect, it } from 'vitest';

import { parseAccountBanDetails } from './account-ban';

describe('parseAccountBanDetails', () => {
  it('normalizes a temporary ban contract', () => {
    expect(
      parseAccountBanDetails({
        accountStatus: 'BANNED',
        banReason: '  repeated abuse  ',
        banType: 'TEMPORARY',
        banUntil: ' 2026-08-12 10:00:00 ',
        permanent: false,
        resourceAccess: 'DENIED',
        tag: 'ACCOUNT_BANNED',
      }),
    ).toEqual({
      accountStatus: 'BANNED',
      banReason: 'repeated abuse',
      banType: 'TEMPORARY',
      banUntil: '2026-08-12 10:00:00',
      permanent: false,
      resourceAccess: 'DENIED',
      tag: 'ACCOUNT_BANNED',
    });
  });

  it('removes an inapplicable expiry from permanent bans', () => {
    expect(
      parseAccountBanDetails({
        accountStatus: 'BANNED',
        banReason: 'chargeback fraud',
        banType: 'PERMANENT',
        banUntil: '2026-08-12 10:00:00',
        permanent: true,
        resourceAccess: 'DENIED',
        tag: 'ACCOUNT_BANNED',
      })?.banUntil,
    ).toBe('');
  });

  it.each([
    null,
    {},
    { tag: 'ACCOUNT_BANNED' },
    {
      accountStatus: 'BANNED',
      banReason: '',
      banType: 'PERMANENT',
      permanent: false,
      resourceAccess: 'DENIED',
      tag: 'ACCOUNT_BANNED',
    },
  ])('rejects malformed data %#', (value) => {
    expect(parseAccountBanDetails(value)).toBeNull();
  });
});
