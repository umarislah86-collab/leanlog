import type { RedCoinsEntry } from './redcoins';

/** Aggregate the complete live ledger, never a truncated top-items summary. */
export function aggregateCycleSpending(entries: RedCoinsEntry[], start: Date, end: Date, now: Date) {
  const categories: Record<string, number> = {};
  const subcategories: Record<string, number> = {};
  let spent = 0;
  let income = 0;
  for (const entry of entries) {
    const time = new Date(entry.date).getTime();
    if (!Number.isFinite(time) || time < start.getTime() || time > end.getTime() || time > now.getTime()) continue;
    if (entry.type === 'income') income += entry.amount;
    if (entry.type !== 'expense') continue;
    spent += entry.amount;
    categories[entry.category] = (categories[entry.category] || 0) + entry.amount;
    const key = `${entry.category}\u0000${entry.subcategory}`;
    subcategories[key] = (subcategories[key] || 0) + entry.amount;
  }
  return { spent, income, categories, subcategories };
}
