import type { RedCoinsEntry } from './redcoins';

export const SALARY_FILTER_SOURCE_KEY = 'redcoins_filter_salary_source_v1';
export type SalaryFilterSource = { key: string; label: string; entries: RedCoinsEntry[]; average: number; isSalary: boolean };
const normalized = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
const day = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Identity is the income source, not an individual salary transaction. */
export function salaryFilterSources(entries: RedCoinsEntry[], now = new Date()): SalaryFilterSource[] {
  const groups = new Map<string, RedCoinsEntry[]>();
  entries.filter(row => row.type === 'income' && row.item.trim() && Number.isFinite(new Date(row.date).getTime()) && new Date(row.date) <= now).forEach(row => {
    const key = JSON.stringify([row.category, row.subcategory, row.item].map(normalized));
    const rows = groups.get(key) || []; rows.push(row); groups.set(key, rows);
  });
  return [...groups].map(([key, rows]) => ({ key, label: `${rows[0].item.trim()} · ${rows[0].subcategory}`, entries: rows.sort((a, b) => a.date.localeCompare(b.date)), average: rows.reduce((sum, row) => sum + row.amount, 0) / rows.length, isSalary: /^(salary|salaries|gaji|upah)$/i.test(rows[0].subcategory.trim()) }))
    .sort((a, b) => Number(b.isSalary) - Number(a.isSalary) || b.entries.length - a.entries.length || a.label.localeCompare(b.label));
}
export function visibleSalarySources(sources: SalaryFilterSource[], search: string, showOther: boolean) {
  const needle = normalized(search);
  return sources.filter(source => (showOther || source.isSalary) && (!needle || normalized(`${source.label} ${source.entries[0]?.category || ''}`).includes(needle)));
}
export function preferredSalarySource(sources: SalaryFilterSource[], savedKey: string) {
  return sources.find(source => source.key === savedKey) || sources.find(source => source.isSalary);
}
export function salaryFilterCycle(source: SalaryFilterSource, offset: number, now = new Date()) {
  const times = salaryAnchorTimes(source, now);
  if (!times.length) return null;
  const safeOffset = Math.max(0, Math.min(times.length - 1, offset));
  const index = times.length - 1 - safeOffset;
  const start = new Date(times[index]), endExclusive = times[index + 1] || now.getTime() + 1;
  return { offset: safeOffset, count: times.length, startDay: day(start), endDay: day(new Date(endExclusive - 1)), startInstant: start.getTime(), endExclusive, month: start.toLocaleDateString('en-MY', { month: 'long', year: 'numeric' }), dateLabel: `${source.label} · ${start.toLocaleDateString('en-MY', { month: 'short', year: 'numeric' })}` };
}

export function salaryAnchorTimes(source: Pick<SalaryFilterSource, 'entries'>, now = new Date()) {
  const firstByDay = new Map<string, number>();
  source.entries.filter(row => row.type === 'income' && Number.isFinite(new Date(row.date).getTime()) && new Date(row.date) <= now).forEach(row => {
    const time = new Date(row.date).getTime(), key = day(new Date(time));
    firstByDay.set(key, Math.min(firstByDay.get(key) ?? Infinity, time));
  });
  return [...firstByDay.values()].sort((a, b) => a - b);
}

export function activeSalaryCycle(entries: RedCoinsEntry[], payday: number, preferredKey = '', now = new Date()) {
  const sources = salaryFilterSources(entries, now).filter(source => source.isSalary);
  const source = sources.find(source => source.key === preferredKey || normalized(source.entries[0].item) === preferredKey) || sources[0];
  const times = source ? salaryAnchorTimes(source, now) : [];
  const start = times.length ? new Date(times[times.length - 1]) : new Date(now.getFullYear(), now.getMonth() - Number(now.getDate() < payday), payday);
  const estimated = new Date(start.getFullYear(), start.getMonth() + 1, payday, start.getHours(), start.getMinutes(), start.getSeconds(), start.getMilliseconds());
  // No calendar rollover while waiting for a new salary entry.
  const next = new Date(Math.max(estimated.getTime(), now.getTime() + 1));
  const history = times.slice(0, -1).map((time, index) => ({ start: new Date(time), end: new Date(times[index + 1]) })).reverse().slice(0, 5);
  return { source, start, next, actualEnd: new Date(now.getTime() + 1), history, anchored: !!times.length };
}

export function salaryCycleOffset(source: SalaryFilterSource, startDay: string) {
  const dates = [...new Set(source.entries.map(row => day(new Date(row.date))))].sort();
  const index = dates.indexOf(startDay);
  return index < 0 ? 0 : dates.length - 1 - index;
}

export function ledgerMonthPeriod(reference: string, delta = 0, now = new Date()) {
  const parsed = new Date(`${reference}T12:00:00`);
  const base = Number.isFinite(parsed.getTime()) ? parsed : now;
  const start = new Date(base.getFullYear(), base.getMonth() + delta, 1, 12);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 12);
  return { startDay: day(start), endDay: day(end), dateLabel: start.toLocaleDateString('en-MY', { month: 'long', year: 'numeric' }) };
}
