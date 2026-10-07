import type { RedCoinsEntry } from './redcoins';

const title = (value: string) => value.trim().toLocaleLowerCase().replace(/[\s._-]+/g, ' ');
export function incomeMonth(date: Date | string) {
  const value = typeof date === 'string' ? new Date(date) : date;
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
}
export const validIncomePeriod = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
/** Review hint, never a deletion/dedupe rule and never changes cash-flow dates. */
export function findIncomeDuplicates(entries: RedCoinsEntry[], draft: Pick<RedCoinsEntry, 'id' | 'type' | 'item' | 'account' | 'category' | 'subcategory' | 'date' | 'amount' | 'incomePeriod'>) {
  if (draft.type !== 'income' || !title(draft.item)) return [];
  const month = draft.incomePeriod || incomeMonth(draft.date);
  const recurring = !!draft.incomePeriod || /\b(epf|kwsp|salary|gaji|payroll|pencen|pension)\b/i.test(`${draft.item} ${draft.account} ${draft.category} ${draft.subcategory}`);
  return entries.filter(entry => {
    if (entry.id === draft.id || entry.type !== 'income' || entry.account !== draft.account || title(entry.item) !== title(draft.item)) return false;
    if (recurring) return (entry.incomePeriod || incomeMonth(entry.date)) === month;
    // Ordinary income can legitimately repeat during a month. Only flag an
    // exact same-day/title/account/amount candidate, not every rebate/payment.
    return Math.round(entry.amount * 100) === Math.round(draft.amount * 100) && new Date(entry.date).toDateString() === new Date(draft.date).toDateString();
  }).sort((a, b) => b.date.localeCompare(a.date));
}
