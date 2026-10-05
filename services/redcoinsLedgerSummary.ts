import type { RedCoinsEntry, RedCoinsType } from './redcoins';

export type LedgerFilters = {
  search: string; types: RedCoinsType[]; accounts: string[]; categories: string[];
  subcategories: string[]; startDay: string; endDay: string;
};
const localDayKey = (value: string) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value.slice(0, 10);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

/** Same complete matching set drives rows, totals and Select All; pagination is presentation only. */
export function filterLedgerEntries(entries: RedCoinsEntry[], filters: LedgerFilters) {
  const needle = filters.search.trim().toLocaleLowerCase('en-MY');
  return entries.filter((entry) => {
    const day = localDayKey(entry.date);
    return (!needle || [entry.item, entry.category, entry.subcategory, entry.account, entry.toAccount, entry.note].filter(Boolean).join(' ').toLocaleLowerCase('en-MY').includes(needle))
      && (!filters.types.length || filters.types.includes(entry.type))
      && (!filters.accounts.length || filters.accounts.includes(entry.account) || !!entry.toAccount && filters.accounts.includes(entry.toAccount))
      && (!filters.categories.length || filters.categories.includes(entry.category))
      && (!filters.subcategories.length || filters.subcategories.includes(entry.subcategory))
      && (!filters.startDay || day >= filters.startDay) && (!filters.endDay || day <= filters.endDay);
  }).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

export function summarizeLedgerEntries(entries: RedCoinsEntry[], now = Date.now()) {
  const cents = { income: 0, expense: 0, transfer: 0 };
  let futureCount = 0;
  for (const entry of entries) {
    cents[entry.type] += Math.round(entry.amount * 100);
    if (new Date(entry.date).getTime() > now) futureCount += 1;
  }
  return { count: entries.length, income: cents.income / 100, expense: cents.expense / 100,
    transfer: cents.transfer / 100, net: (cents.income - cents.expense) / 100, futureCount };
}
