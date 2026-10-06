import type { RedCoinsEntry, RedCoinsState } from './redcoins';
import { buildRedCoinsAiPrompt, type AiPromptScope } from './redcoinsAiPrompt';

export const analysisClassKey = (category: string, subcategory: string) => JSON.stringify([category, subcategory]);
const cents = (n: number) => Math.round(n * 100);
const total = (rows: RedCoinsEntry[]) => rows.reduce((sum, row) => sum + cents(row.amount), 0) / 100;
const inside = (row: RedCoinsEntry, start: number, end: number) => new Date(row.date).getTime() >= start && new Date(row.date).getTime() < end;
const DAY = 86400000;

export function analyseRedCoins(state: RedCoinsState, scope: AiPromptScope, lookback: 3 | 6 = 3, now = new Date()) {
  const { data } = buildRedCoinsAiPrompt(state, scope, 10, lookback, now, true);
  const selectedIds = new Set(data.selected.transactionIds);
  const rows = state.entries.filter(row => selectedIds.has(row.id));
  const expenses = rows.filter(row => row.type === 'expense');
  const windows = data.baseline.periods.map(window => ({ start: new Date(window.startInclusive).getTime(), end: new Date(window.endExclusive).getTime() }));
  const elapsed = Math.max(0, Math.min(scope.endExclusive.getTime(), now.getTime() + 1) - scope.start.getTime());
  const salaryMatched = scope.mode === 'salary-cycle';
  const matchedDuration = windows.length ? Math.min(elapsed, ...windows.map(window => window.end - window.start)) : 0;
  const comparedRows = salaryMatched ? expenses.filter(row => inside(row, scope.start.getTime(), scope.start.getTime() + matchedDuration)) : expenses;
  const priorIds = new Set(data.baseline.transactionIds);
  const prior = state.entries.filter(row => priorIds.has(row.id) && row.type === 'expense' && windows.some(window => inside(row, window.start, salaryMatched ? window.start + matchedDuration : window.end)));
  const currentDays = (salaryMatched ? matchedDuration : elapsed) / DAY;
  const priorDays = windows.reduce((days, window) => days + (salaryMatched ? matchedDuration : window.end - window.start) / DAY, 0);
  const rate = currentDays > 0 && priorDays > 0 ? { current: total(comparedRows) / currentDays, baseline: total(prior) / priorDays } : null;
  const categoryAmounts = (entries: RedCoinsEntry[]) => {
    const amounts = new Map<string, number>();
    entries.forEach(row => amounts.set(row.category, (amounts.get(row.category) || 0) + cents(row.amount)));
    return amounts;
  };
  const currentCats = categoryAmounts(comparedRows), priorCats = categoryAmounts(prior);
  const changes = rate ? [...new Set([...currentCats.keys(), ...priorCats.keys()])].map(category => {
    const currentDaily = (currentCats.get(category) || 0) / 100 / currentDays;
    const baselineDaily = (priorCats.get(category) || 0) / 100 / priorDays;
    return { category, currentDaily, baselineDaily, deltaDaily: currentDaily - baselineDaily, percent: baselineDaily > 0 ? (currentDaily / baselineDaily - 1) * 100 : null, transactionIds: comparedRows.filter(row => row.category === category).map(row => row.id) };
  }).sort((a, b) => Math.abs(b.deltaDaily) - Math.abs(a.deltaDaily)) : [];
  const pairs = new Map<string, { category: string; subcategory: string; current: number; prior: number; transactionIds: string[] }>();
  const addPair = (row: RedCoinsEntry, current: boolean) => {
    const key = analysisClassKey(row.category, row.subcategory);
    const pair = pairs.get(key) || { category: row.category, subcategory: row.subcategory, current: 0, prior: 0, transactionIds: [] };
    pair[current ? 'current' : 'prior'] += cents(row.amount);
    if (current) pair.transactionIds.push(row.id);
    pairs.set(key, pair);
  };
  comparedRows.forEach(row => addPair(row, true)); prior.forEach(row => addPair(row, false));
  const subcategoryChanges = rate ? [...pairs.values()].map(pair => ({ category: pair.category, subcategory: pair.subcategory, currentDaily: pair.current / 100 / currentDays, baselineDaily: pair.prior / 100 / priorDays, deltaDaily: pair.current / 100 / currentDays - pair.prior / 100 / priorDays, transactionIds: pair.transactionIds })).sort((a, b) => Math.abs(b.deltaDaily) - Math.abs(a.deltaDaily)) : [];
  const repeated = new Map<string, { title: string; category: string; subcategory: string; entries: RedCoinsEntry[] }>();
  expenses.forEach(row => {
    const title = row.item.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
    if (!title) return;
    const key = JSON.stringify([title, row.category, row.subcategory]);
    const group = repeated.get(key) || { title: row.item.trim(), category: row.category, subcategory: row.subcategory, entries: [] };
    group.entries.push(row); repeated.set(key, group);
  });
  const repeatedCharges = [...repeated.values()].filter(group => group.entries.length >= 2).map(group => ({ ...group, amount: total(group.entries), count: group.entries.length })).sort((a, b) => b.amount - a.amount);
  const groups = data.selected.expenseSubcategories.map(group => ({ ...group, key: analysisClassKey(group.category, group.subcategory), classification: group.userClassification, transactionIds: expenses.filter(row => row.category === group.category && row.subcategory === group.subcategory).map(row => row.id) }));
  const classTotal = (classification: string) => groups.filter(group => group.classification === classification).reduce((sum, group) => sum + cents(group.amount), 0) / 100;
  const loanIds = new Set(data.transactions.filter(row => row.classification === 'loan-repayment-transfer').map(row => row.id));
  return {
    metrics: data.selected.metrics, warnings: data.warnings, baselinePeriods: windows.length, lookback,
    pulse: { rate, matchedDays: salaryMatched ? matchedDuration / DAY : null, deltaPercent: rate && rate.baseline > 0 ? (rate.current / rate.baseline - 1) * 100 : null, method: salaryMatched ? 'Expense/day over the same elapsed span at the start of each cycle' : 'Expense/day over the selected actual interval versus preceding completed calendar months' },
    changes, subcategoryChanges, repeatedCharges, groups,
    classificationTotals: { protected: classTotal('protected') + data.selected.metrics.loanRepayments, flexible: classTotal('flexible'), unconfirmed: classTotal('unconfirmed') },
    loanEntries: rows.filter(row => loanIds.has(row.id)),
  };
}

/** User-selected percentages on confirmed flexible expenses only; never writes budgets. */
export function simulateRedCoinsCuts(analysis: ReturnType<typeof analyseRedCoins>, target: number, cuts: Record<string, number>) {
  if (![5, 10, 15, 20, 25].includes(target)) throw new Error('Invalid reduction target.');
  const proposals = analysis.groups.filter(group => group.classification === 'flexible' && group.amount > 0).map(group => {
    const percent = [0, 5, 10, 15, 20, 25].includes(cuts[group.key]) ? cuts[group.key] : 0;
    return { ...group, percent, saving: Math.round(cents(group.amount) * percent / 100) / 100 };
  });
  const saving = proposals.reduce((sum, group) => sum + cents(group.saving), 0) / 100;
  const targetAmount = Math.round(cents(Math.max(0, analysis.metrics.expense)) * target / 100) / 100;
  return { target, targetAmount, saving, gap: Math.max(0, Math.round((targetAmount - saving) * 100) / 100), proposals, projectedExpense: Math.round((analysis.metrics.expense - saving) * 100) / 100 };
}
