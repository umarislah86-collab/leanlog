import type { RedCoinsAccount, RedCoinsEntry, RedCoinsState } from './redcoins';

export interface BankReview {
  startDay: string;
  endDay: string;
  bankBalance: string;
  matched: Record<string, string>;
  savedAt: string;
}
const cents = (value: number) => Math.round(value * 100);
export function reviewSignature(entry: RedCoinsEntry) {
  return JSON.stringify([entry.type, entry.amount, entry.date, entry.account, entry.toAccount, entry.item]);
}
export function accountMovement(entry: RedCoinsEntry, account: RedCoinsAccount) {
  let amount = 0;
  if (entry.account === account.name) amount += entry.type === 'income' ? cents(entry.amount) : -cents(entry.amount);
  if (entry.type === 'transfer' && entry.toAccount === account.name) amount += cents(entry.amount);
  return amount;
}
export function reviewDay(value: string, end = false): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  if (end) date.setDate(date.getDate() + 1);
  return date.getTime();
}
/** Rewind saved live balance, never rebuild an account from zero or mutate it. */
export function bankReviewProjection(state: Pick<RedCoinsState, 'entries'>, account: RedCoinsAccount, review: BankReview, now = Date.now()) {
  const start = reviewDay(review.startDay), end = reviewDay(review.endDay, true);
  if (start === null || end === null || start >= end || start > now || reviewDay(review.endDay)! > now) return null;
  const cutoff = Math.min(end, now + 1);
  const applied = state.entries.filter(entry => Number.isFinite(new Date(entry.date).getTime()) && new Date(entry.date).getTime() <= now && entry.balanceEffectApplied !== false);
  const rows = state.entries.filter(entry => {
    const time = new Date(entry.date).getTime();
    return time >= start && time < cutoff && (entry.account === account.name || entry.type === 'transfer' && entry.toAccount === account.name);
  }).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const ledgerBalance = (cents(account.balance) - applied.filter(entry => new Date(entry.date).getTime() >= cutoff).reduce((sum, entry) => sum + accountMovement(entry, account), 0)) / 100;
  const raw = review.bankBalance.trim();
  const bankBalance = /^-?\d+(\.\d{1,2})?$/.test(raw) && Number.isFinite(Number(raw)) ? Number(raw) : null;
  const matched = rows.filter(entry => review.matched[entry.id] === reviewSignature(entry));
  return { rows, ledgerBalance, bankBalance, difference: bankBalance === null ? null : (cents(bankBalance) - cents(ledgerBalance)) / 100, matchedCount: matched.length, remainingCount: rows.length - matched.length, cutoff };
}
