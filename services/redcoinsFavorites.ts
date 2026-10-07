import type { RedCoinsAccount, RedCoinsState } from './redcoins';

/** Resolve current accounts by stable ID, never by mutable display name. */
export function favoriteAccountsForHome(state: Pick<RedCoinsState, 'accounts' | 'favoriteAccountIds'>): RedCoinsAccount[] {
  if (state.favoriteAccountIds === undefined) {
    return state.accounts.filter(account => ['Bank', 'Cash', 'Credit card'].includes(account.type)).slice(0, 6);
  }
  const accounts = new Map(state.accounts.map(account => [account.id, account]));
  return [...new Set(state.favoriteAccountIds)].flatMap(id => {
    const account = accounts.get(id);
    return account ? [account] : [];
  });
}
