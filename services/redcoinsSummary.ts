import type { BluecoinsSummary } from './bluecoins';
import type { RedCoinsEntry, RedCoinsState } from './redcoins';
import { evaluateRedCoinsGuards } from './redcoinsGuards';
import type { SpendingGuard } from './spendingGuards';
import { activeSalaryCycle } from './redcoinsSalaryFilter';

export const redCoinsDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const cents = (n: number) => Math.round(n * 100);
const sum = (rows: RedCoinsEntry[]) => rows.reduce((n, row) => n + cents(row.amount), 0) / 100;
const round = (n: number) => cents(n) / 100;
const median = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); const half = Math.floor(sorted.length / 2); return sorted.length ? sorted.length % 2 ? sorted[half] : (sorted[half - 1] + sorted[half]) / 2 : 0; };
const dayDistance = (a: Date, b: Date) => Math.round((Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) - Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())) / 86400000);
const fixedKey = (row: RedCoinsEntry) => `${row.subcategory}::${row.item}`;
export interface RedCoinsSummaryPreferences { selectedAccounts: string[]; fixedCommitments: string[]; guards: SpendingGuard[] }

/** Pure projection of the authoritative ledger. Never reads/replays a FYDB baseline. */
export function buildRedCoinsSummary(state: RedCoinsState, preferences: RedCoinsSummaryPreferences, now = new Date()): BluecoinsSummary {
  const payday = Math.max(1, Math.min(28, state.payday || 25));
  const cycle = activeSalaryCycle(state.entries, payday, state.reportPreferences?.salarySource || '', now);
  const cycleStartDate = cycle.start;
  const nextStart = cycle.next;
  const cycleEndDate = new Date(nextStart.getTime() - 1);
  const cycleStart = redCoinsDay(cycleStartDate), cycleEnd = redCoinsDay(cycleEndDate);
  const actual = state.entries.filter(row => Number.isFinite(row.amount) && row.amount >= 0 && Number.isFinite(new Date(row.date).getTime()) && new Date(row.date) <= now);
  const liabilities = new Set(state.accounts.filter(a => a.type === 'Liability').map(a => a.name));
  const loan = (row: RedCoinsEntry) => row.type === 'transfer' && !!row.toAccount && liabilities.has(row.toAccount) && !liabilities.has(row.account);
  const outgoings = actual.filter(row => row.type === 'expense' || loan(row));
  const window = (rows: RedCoinsEntry[], start: Date, end: Date) => rows.filter(row => new Date(row.date) >= start && new Date(row.date) < end);
  const cycleRows = window(outgoings, cycleStartDate, cycle.actualEnd);
  const cycleExpenses = cycleRows.filter(row => row.type === 'expense');
  const monthSpent = sum(cycleRows);
  const daysElapsed = dayDistance(now, cycleStartDate) + 1, daysInMonth = dayDistance(nextStart, cycleStartDate);
  const historyWindows = cycle.anchored ? cycle.history : Array.from({ length: 5 }, (_, index) => {
    const start = new Date(cycleStartDate.getFullYear(), cycleStartDate.getMonth() - index - 1, payday);
    return { start, end: new Date(start.getFullYear(), start.getMonth() + 1, payday) };
  });
  const history = historyWindows.map(({ start, end }) => {
    const comparable = new Date(start); comparable.setDate(start.getDate() + Math.min(daysElapsed, dayDistance(end, start)));
    const rows = window(outgoings, start, end);
    return { total: sum(rows), samePoint: sum(window(rows, start, comparable)), start, end };
  });
  const previousMonth = history[0]?.total || 0;
  const historicalCycles = history.filter(row => row.total > 0);
  const totals = historicalCycles.map(row => row.total);
  const historicalMean = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
  const historicalMedian = median(totals);
  const weightTotal = totals.reduce((n, _, index) => n + totals.length - index, 0);
  const weightedMean = weightTotal ? totals.reduce((n, value, index) => n + value * (totals.length - index), 0) / weightTotal : 0;
  const baseline = totals.length ? historicalMedian * .5 + weightedMean * .3 + historicalMean * .2 : monthSpent;
  const completion = median(historicalCycles.filter(row => row.samePoint > 0).map(row => Math.min(1, row.samePoint / row.total)));
  const pace = Math.max(historicalMedian ? historicalMedian * .6 : monthSpent, Math.min(totals.length ? Math.max(...totals) * 1.25 : baseline, completion ? monthSpent / completion : baseline));
  const weight = totals.length >= 3 ? daysElapsed < 5 ? 0 : Math.min(.7, (daysElapsed - 4) / Math.max(1, daysInMonth - 4) * .7) : 1;
  const projected = round(Math.max(monthSpent, baseline * (1 - weight) + pace * weight));
  const uncertainty = Math.max(median(totals.map(value => Math.abs(value - historicalMedian))) * 1.4826, historicalMean * .08) * (1.15 - Math.min(1, daysElapsed / daysInMonth) * .45);
  const budget = state.monthlyBudget ?? 2000, remaining = round(budget - monthSpent);
  const selectedFixed = new Set(preferences.fixedCommitments);
  const historicalItems = new Map<string, { latest: RedCoinsEntry; count: number }>();
  actual.filter(row => row.type === 'expense').forEach(row => {
    const key = fixedKey(row), prior = historicalItems.get(key);
    historicalItems.set(key, { latest: !prior || new Date(row.date) > new Date(prior.latest.date) ? row : prior.latest, count: (prior?.count || 0) + 1 });
  });
  const fixedCommitmentOptions = [...historicalItems].map(([key, value]) => ({ key, label: `${value.latest.subcategory} | ${value.latest.item}`, category: value.latest.category, selected: selectedFixed.has(key), amount: sum(cycleExpenses.filter(row => fixedKey(row) === key)), lastAmount: value.latest.amount, lastUsed: redCoinsDay(new Date(value.latest.date)), lifetimeTransactions: value.count }))
    .sort((a, b) => Number(b.selected) - Number(a.selected) || b.lastUsed.localeCompare(a.lastUsed));
  const expectedItems: BluecoinsSummary['monthly']['expectedFixedCommitments']['items'] = fixedCommitmentOptions.filter(row => row.selected).map(row => ({ key: row.key, label: row.label, category: row.category, expectedAmount: row.lastAmount, currentAmount: row.amount, lastUsed: row.lastUsed, status: row.amount > 0 ? 'paid' : 'due' }));
  state.accounts.filter(a => a.type === 'Liability' && Math.abs(a.balance) > .005).forEach(account => {
    const rows = actual.filter(row => loan(row) && row.toAccount === account.name).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (!rows.length) return;
    const currentAmount = sum(cycleRows.filter(row => loan(row) && row.toAccount === account.name));
    expectedItems.push({ key: `liability::${account.name}`, label: `Loan | ${account.name}`, category: 'Debt commitment', expectedAmount: rows[0].amount, currentAmount, lastUsed: redCoinsDay(new Date(rows[0].date)), status: currentAmount > 0 ? 'paid' : 'due' });
  });
  expectedItems.sort((a, b) => Number(a.status === 'paid') - Number(b.status === 'paid') || b.expectedAmount - a.expectedAmount);
  const categoryMap = new Map<string, BluecoinsSummary['monthly']['topCategories'][number]>();
  cycleExpenses.filter(row => !selectedFixed.has(fixedKey(row))).forEach(row => {
    const category = categoryMap.get(row.category) || { name: row.category, amount: 0, share: 0, details: [] };
    category.amount = round(category.amount + row.amount);
    let detail = category.details.find(item => item.item === row.item && item.subcategory === row.subcategory);
    if (!detail) { detail = { item: row.item, subcategory: row.subcategory, amount: 0, transactions: 0, share: 0 }; category.details.push(detail); }
    detail.amount = round(detail.amount + row.amount); detail.transactions++;
    categoryMap.set(row.category, category);
  });
  const paidLoans = cycleRows.filter(loan);
  if (paidLoans.length) {
    categoryMap.set('Debt commitment', { name: 'Debt commitment', amount: sum(paidLoans), share: 0, details: [...new Set(paidLoans.map(row => row.toAccount!))].map(name => ({ item: name, subcategory: 'Loan', amount: sum(paidLoans.filter(row => row.toAccount === name)), transactions: paidLoans.filter(row => row.toAccount === name).length, share: 0 })) });
  }
  const topCategories = [...categoryMap.values()].sort((a, b) => b.amount - a.amount).map(category => ({ ...category, share: monthSpent ? category.amount / monthSpent * 100 : 0, details: category.details.sort((a, b) => b.amount - a.amount).map(detail => ({ ...detail, share: category.amount ? detail.amount / category.amount * 100 : 0 })) }));
  const fixedRows = cycleRows.filter(row => loan(row) || selectedFixed.has(fixedKey(row)));
  const fixedCommitments = { total: sum(fixedRows), items: [...new Set(fixedRows.map(row => loan(row) ? row.toAccount! : row.item))].map(name => { const rows = fixedRows.filter(row => (loan(row) ? row.toAccount : row.item) === name); return { name, amount: sum(rows), transactions: rows.length }; }).sort((a, b) => b.amount - a.amount) };
  const cashAccounts = state.accounts.filter(a => a.type !== 'Credit card' && a.type !== 'Liability').map(a => ({ name: a.name, balance: a.balance, selected: preferences.selectedAccounts.includes(a.name) }));
  const creditCards = state.accounts.filter(a => a.type === 'Credit card').map(a => ({ name: a.name, outstanding: round(Math.max(0, -a.balance)), creditLimit: a.limit || 0, cutOffDay: a.cutOffDay || 0, dueDay: a.dueDay || 0 }));
  const liquidBalance = round(cashAccounts.filter(a => a.selected).reduce((n, a) => n + a.balance, 0));
  const cardOutstanding = round(creditCards.reduce((n, a) => n + a.outstanding, 0));
  const loanReserve = round(expectedItems.filter(row => row.category === 'Debt commitment' && row.status === 'due').reduce((n, row) => n + row.expectedAmount, 0));
  const trueSpendable = round(liquidBalance - cardOutstanding - state.safetyBuffer - loanReserve);
  const alerts = [`Selected cash RM ${liquidBalance.toFixed(2)} − unpaid cards RM ${cardOutstanding.toFixed(2)} − buffer RM ${state.safetyBuffer.toFixed(2)}${loanReserve ? ` − unpaid loans RM ${loanReserve.toFixed(2)}` : ''} = RM ${trueSpendable.toFixed(2)} available. Cycle budget left: RM ${remaining.toFixed(2)}.`];
  alerts.push(projected > budget ? `At this pace, spending may exceed budget by RM ${(projected - budget).toFixed(0)}.` : `Current pace is RM ${(budget - projected).toFixed(0)} below the cycle budget.`);
  if (topCategories[0]?.share >= 40) alerts.push(`${topCategories[0].name} makes up ${topCategories[0].share.toFixed(0)}% of this salary cycle's spending.`);
  if (previousMonth) alerts.push(`Projected cycle-end is ${Math.abs((projected - previousMonth) / previousMonth * 100).toFixed(0)}% ${projected > previousMonth ? 'higher' : 'lower'} than last cycle.`);
  const firstDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6), previousStart = new Date(firstDay); previousStart.setDate(firstDay.getDate() - 7);
  const expenses = actual.filter(row => row.type === 'expense'), recent = window(expenses, firstDay, new Date(now.getTime() + 1));
  const total = sum(recent), previousTotal = sum(window(expenses, previousStart, firstDay));
  const sevenCategories = [...new Set(recent.map(row => row.category))].map(name => ({ name, amount: sum(recent.filter(row => row.category === name)) })).sort((a, b) => b.amount - a.amount).slice(0, 3);
  const monthly: BluecoinsSummary['monthly'] = { spent: monthSpent, budget, budgetIsSuggested: false, remaining, safeToday: round(Math.max(0, remaining / Math.max(1, daysInMonth - daysElapsed + 1))), projected, projectedLow: round(Math.max(monthSpent, projected - uncertainty)), projectedHigh: round(projected + uncertainty), projectionConfidence: totals.length < 3 || daysElapsed < 5 ? 'low' : daysElapsed < 14 ? 'medium' : 'high', projectionCycles: totals.length, historicalMean: round(historicalMean), historicalMedian, previousMonth, cycleStart, cycleEnd, cycleStartInstant: cycleStartDate.toISOString(), cycleEndExclusive: nextStart.toISOString(), salarySourceLabel: cycle.source?.label, payday, noSpendDays: Math.max(0, daysElapsed - new Set(cycleRows.map(row => redCoinsDay(new Date(row.date)))).size), daysElapsed, daysInMonth, topCategories, fixedCommitments, fixedCommitmentOptions, fixedCommitmentSelection: preferences.fixedCommitments, expectedFixedCommitments: { total: round(expectedItems.reduce((n, row) => n + row.expectedAmount, 0)), paid: round(expectedItems.reduce((n, row) => n + row.currentAmount, 0)), remaining: round(expectedItems.filter(row => row.status === 'due').reduce((n, row) => n + row.expectedAmount, 0)), items: expectedItems }, alerts };
  return { sourceName: state.importedSource || 'RedCoins local ledger', sourceDate: redCoinsDay(now), syncedAt: now.toISOString(), total, average: total / 7, transactionCount: recent.length, topCategory: sevenCategories[0]?.name || 'No spending', topCategoryAmount: sevenCategories[0]?.amount || 0, topCategories: sevenCategories, previousTotal, changePercent: previousTotal ? (total - previousTotal) / previousTotal * 100 : null,
    days: Array.from({ length: 7 }, (_, offset) => { const date = new Date(firstDay); date.setDate(firstDay.getDate() + offset); const day = redCoinsDay(date), rows = expenses.filter(row => redCoinsDay(new Date(row.date)) === day); return { date: day, spent: sum(rows), transactions: rows.length }; }),
    guardOptions: { accounts: state.accounts.map(a => a.name), categories: state.categories.map(c => c.name), subcategories: [...new Set(state.categories.flatMap(c => c.subcategories))] }, spendingGuards: evaluateRedCoinsGuards(preferences.guards, state.entries, monthly, now), monthly,
    cashReality: { liquidBalance, cardOutstanding, safetyBuffer: state.safetyBuffer, trueSpendable, coveragePercent: cardOutstanding ? liquidBalance / cardOutstanding * 100 : 100, selectedAccounts: preferences.selectedAccounts, cashAccounts, creditCards },
    redcoins: { accounts: state.accounts.map(a => ({ ...a, limit: a.limit || 0 })), categories: state.categories, entries: state.entries.map(row => ({ ...row, note: row.note || '', status: row.status || 'cleared', origin: 'bluecoins' as const })) },
  };
}
