import type { RedCoinsAccountType, RedCoinsCategory, RedCoinsState } from './redcoins';

export const starterCategories: RedCoinsCategory[] = [
  ['Food', 'restaurant-outline', ['Meals', 'Groceries']],
  ['Transport', 'car-outline', ['Fuel', 'Parking', 'Public transport']],
  ['Bills', 'receipt-outline', ['Utilities', 'Phone', 'Rent']],
  ['Shopping', 'bag-outline', ['Shopping']],
  ['Health', 'medical-outline', ['Health']],
  ['Income', 'cash-outline', ['Salary', 'Other income']],
].map(([name, icon, subs]) => ({ id: `starter-${name}`, name: name as string, icon: icon as string,
  subcategories: subs as string[], subcategoryTypes: Object.fromEntries((subs as string[]).map(sub => [sub, [name === 'Income' ? 'income' : 'expense']])) }));

/** Empty storage is initialized on first load; history distinguishes it from an existing ledger. */
export function needsRedCoinsSetup(state: RedCoinsState) {
  return !state.onboarding && !state.importedSource && !state.importSnapshot &&
    ![state.accounts, state.categories, state.entries, state.reminders, state.deletedEntries, state.trash,
      state.exportBatches, state.deletedAccountNames, state.deletedSourceAccountIds, state.deletedCategoryNames, state.termBudgets]
      .some(rows => rows?.length) && !Object.keys(state.subcategoryBudgets || {}).length &&
    !Object.keys(state.deletedSubcategories || {}).length;
}
export interface RedCoinsSetupDraft {
  name: string; type: 'Bank' | 'Cash' | 'Credit card'; balance: string;
  categories: string[]; budget: string; payday: string;
}
function numeric(value: string, label: string) {
  const trimmed = value.trim();
  if (!/^[+-]?(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(trimmed)) throw new Error(`Enter a valid ${label}.`);
  const number = Number(trimmed);
  if (!Number.isFinite(number) || Math.abs(number) > 1e12) throw new Error(`Enter a valid ${label}.`);
  return number;
}
export function setupAccount(draft: RedCoinsSetupDraft) {
  const name = draft.name.trim();
  if (!name || name.length > 80) throw new Error('Enter an account name (up to 80 characters).');
  if (!['Bank', 'Cash', 'Credit card'].includes(draft.type)) throw new Error('Choose an account type.');
  let balance = numeric(draft.balance || '0', 'opening balance');
  if (draft.type === 'Credit card') {
    if (balance < 0) throw new Error('Enter the amount owed as a positive number.');
    balance = -balance;
  }
  return { id: 'starter-account', name, type: draft.type as RedCoinsAccountType, balance,
    icon: draft.type === 'Cash' ? 'cash-outline' : draft.type === 'Credit card' ? 'card-outline' : 'wallet-outline' };
}
export function finishRedCoinsSetup(current: RedCoinsState, draft?: RedCoinsSetupDraft): RedCoinsState {
  if (!needsRedCoinsSetup(current)) throw new Error('RedCoins changed during setup. Your existing data has been kept.');
  if (!draft) return { ...current, onboarding: { version: 1, status: 'skipped' } };
  const account = setupAccount(draft);
  const categories = starterCategories.filter(row => draft.categories.includes(row.name)).map(row => ({ ...row,
    subcategories: [...row.subcategories], subcategoryTypes: Object.fromEntries(row.subcategories.map(sub => [sub, [...row.subcategoryTypes![sub]]])) }));
  if (!categories.some(row => row.name !== 'Income')) throw new Error('Choose at least one spending category.');
  const budget = draft.budget.trim() ? numeric(draft.budget, 'monthly budget') : current.monthlyBudget;
  if (budget < 0) throw new Error('Monthly budget cannot be negative.');
  const payday = draft.payday.trim() ? Number(draft.payday) : current.payday;
  if (!Number.isInteger(payday) || payday < 1 || payday > 31) throw new Error('Payday must be a day from 1 to 31.');
  return { ...current, accounts: [account], categories, monthlyBudget: budget, payday,
    onboarding: { version: 1, status: 'completed' } };
}
