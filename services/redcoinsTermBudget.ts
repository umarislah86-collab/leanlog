import type { RedCoinsEntry } from './redcoins';

export interface TermBudget {
  id: string; category: string; subcategory?: string; amount: number;
  startDay: string; endDay: string; repeat: boolean; carryForward: boolean; reserve: boolean;
  /** Calendar-month intervals, or exact day-length for custom ranges. */
  months?: number;
}
export function parseBudgetDay(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const [y, m, d] = day.split('-').map(Number), date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}
export function budgetDay(date: Date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
function monthBoundary(start: Date, months: number) {
  const date = new Date(start.getFullYear(), start.getMonth() + months, 1);
  date.setDate(Math.min(start.getDate(), new Date(date.getFullYear(), date.getMonth()+1, 0).getDate()));
  return date;
}
export function validTermBudget(b: TermBudget) {
  const start = parseBudgetDay(b.startDay), end = parseBudgetDay(b.endDay);
  return !!start && !!end && end >= start && end.getFullYear() - start.getFullYear() <= 100 && !!b.id && !!b.category &&
    Number.isFinite(b.amount) && b.amount > 0 && ['repeat','carryForward','reserve'].every(k => typeof (b as any)[k] === 'boolean') &&
    (b.months === undefined || Number.isInteger(b.months) && b.months >= 1 && b.months <= 120);
}
export function termBudgetSummary(b: TermBudget, entries: RedCoinsEntry[], now = new Date()) {
  if (!validTermBudget(b)) throw new Error('Invalid budget range.');
  const anchor = parseBudgetDay(b.startDay)!, initialEnd = parseBudgetDay(b.endDay)!;
  const days = Math.round((Date.UTC(initialEnd.getFullYear(),initialEnd.getMonth(),initialEnd.getDate()) - Date.UTC(anchor.getFullYear(),anchor.getMonth(),anchor.getDate()))/86400000)+1;
  const boundary = (index: number) => b.months ? monthBoundary(anchor,index*b.months) : new Date(anchor.getFullYear(),anchor.getMonth(),anchor.getDate()+index*days);
  let index = 0;
  if (b.repeat && now >= anchor) {
    index = b.months ? Math.max(0, Math.floor(((now.getFullYear()-anchor.getFullYear())*12+now.getMonth()-anchor.getMonth())/b.months)) : Math.max(0,Math.floor((Date.UTC(now.getFullYear(),now.getMonth(),now.getDate())-Date.UTC(anchor.getFullYear(),anchor.getMonth(),anchor.getDate()))/86400000/days));
    if (boundary(index) > now) index--;
  }
  const start = boundary(index), end = b.repeat || b.months ? new Date(boundary(index+1).getTime()-1) : new Date(initialEnd.getFullYear(),initialEnd.getMonth(),initialEnd.getDate(),23,59,59,999);
  let spentCents = 0, previousCents = 0;
  for (const entry of entries) {
    const time = new Date(entry.date).getTime();
    if (entry.type !== 'expense' || entry.status === 'void' || entry.category !== b.category || b.subcategory && entry.subcategory !== b.subcategory || !Number.isFinite(time) || time > now.getTime() || time < anchor.getTime()) continue;
    if (time >= start.getTime() && time <= end.getTime()) spentCents += Math.round(entry.amount*100);
    else if (time < start.getTime()) previousCents += Math.round(entry.amount*100);
  }
  const carry = b.repeat && b.carryForward ? Math.max(0,index*Math.round(b.amount*100)-previousCents)/100 : 0;
  const limit = b.amount + carry, spent = spentCents/100;
  const active = now >= start && now <= end;
  return { startDay: budgetDay(start), endDay: budgetDay(end), spent, carry, limit, remaining: limit-spent, active, status: now < start ? 'Upcoming' : active ? 'Active' : 'Ended', monthlyReserve: b.reserve ? b.amount/(b.months || days/30.436875) : 0 };
}
