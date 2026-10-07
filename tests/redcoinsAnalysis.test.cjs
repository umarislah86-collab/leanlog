const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const modules = {};
function load(name) {
  if (modules[name]) return modules[name];
  const exports = modules[name] = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, `../services/${name}.ts`), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, Date, Intl, require: id => load(id.replace('./', '')) });
  return exports;
}
const { analyseRedCoins: analyse, simulateRedCoinsCuts: simulate, analysisClassKey: key } = load('redcoinsAnalysis');
const { buildRedCoinsAiPrompt: prompt } = load('redcoinsAiPrompt');
const row = (id, date, amount, extras = {}) => ({ id, date, amount, type: 'expense', item: 'Dinner', category: 'Food', subcategory: 'Dining', account: 'Bank', ...extras });
const state = entries => ({ entries, accounts: [{ id: 'bank', name: 'Bank', type: 'Bank', balance: 1000 }, { id: 'house', name: 'Mortgage', type: 'Liability', balance: -250000 }, { id: 'car', name: 'Car loan', type: 'Liability', balance: -10000 }, { id: 'card', name: 'Visa', type: 'Credit card', balance: -500 }], monthlyBudget: 2500, safetyBuffer: 100 });
const now = new Date('2026-10-06T00:00:00Z');
const scope = { mode: 'custom', label: 'October', start: new Date('2026-10-01T00:00:00Z'), endExclusive: new Date('2026-11-01T00:00:00Z') };
test('mortgage and car loan enter real outgoings and net, not card settlements; no ledger mutation', () => {
  const fixture = state([row('income', '2026-10-01', 3000, { type: 'income' }), row('e', '2026-10-02', 200), row('house', '2026-10-03', 1500, { type: 'transfer', toAccount: 'Mortgage' }), row('car', '2026-10-03', 650, { type: 'transfer', toAccount: 'Car loan' }), row('card', '2026-10-03', 500, { type: 'transfer', toAccount: 'Visa' })]);
  const before = JSON.stringify(fixture), result = analyse(fixture, scope, 3, now);
  assert.equal(result.metrics.loanRepayments, 2150);
  assert.equal(result.metrics.spendingIncludingLoanRepayments, 2350);
  assert.equal(result.metrics.netAfterExpensesAndLoanRepayments, 650);
  assert.equal(result.classificationTotals.protected, 2150);
  assert.equal(result.classificationTotals.unconfirmed, 200);
  assert.equal(result.loanEntries.length, 2);
  assert.equal(JSON.stringify(fixture), before);
  assert(prompt(fixture, scope, 10, 3, now).prompt.includes('Include loan repayments in real household outgoings'));
});
test('cycle pulse compares the same first elapsed span and excludes later baseline expenses', () => {
  const dates = ['2026-08-01', '2026-09-01', '2026-10-01'];
  const salary = dates.map((date, i) => row(`salary${i}`, date, 3000, { type: 'income', item: 'Salary' }));
  const fixture = state([...salary, row('aug', '2026-08-02', 50), row('sep', '2026-09-02', 100), row('late', '2026-09-20', 9999), row('now', '2026-10-02', 100), row('future', '2026-10-08', 99999)]);
  const result = analyse(fixture, { ...scope, mode: 'salary-cycle', salarySource: { label: 'Salary', entries: salary } }, 3, now);
  assert.equal(result.baselinePeriods, 2);
  assert(Math.abs(result.pulse.deltaPercent - 33.333333333333) < 0.001);
  assert.equal(result.changes[0].transactionIds[0], 'now');
  assert.equal(result.subcategoryChanges[0].subcategory, 'Dining');
  assert.equal(result.subcategoryChanges[0].transactionIds[0], 'now');
  assert.equal(result.metrics.expense, 100);
});

test('subcategory drilldown shows exactly current comparison IDs, not namesakes, income or future rows', () => {
  const { filterLedgerEntries } = load('redcoinsLedgerSummary');
  const salary = ['2026-08-01', '2026-09-01', '2026-10-01'].map((date, i) => row(`s${i}`, date, 3000, { type: 'income', item: 'Salary' }));
  const fixture = state([...salary, row('baseline', '2026-09-02', 10), row('current', '2026-10-02', 20), row('same-name', '2026-10-02', 30, { category: 'Other' }), row('income', '2026-10-02', 100, { type: 'income' }), row('future', '2026-10-08', 999)]);
  const result = analyse(fixture, { ...scope, mode: 'salary-cycle', salarySource: { label: 'Salary', entries: salary } }, 3, now);
  const part = result.subcategoryChanges.find(p => p.category === 'Food' && p.subcategory === 'Dining');
  const matching = filterLedgerEntries(fixture.entries, { search: '', types: ['expense'], accounts: [], categories: [part.category], subcategories: [part.subcategory], startDay: '', endDay: '', reportWindow: result.comparisonWindow });
  assert.equal(JSON.stringify(matching.map(r => r.id).sort()), JSON.stringify([...part.transactionIds].sort()));
  assert.equal(matching.length, 1);
});

test('custom report empty subcategory drilldown preserves the exact report window and actual cutoff', () => {
  const { filterLedgerEntries } = load('redcoinsLedgerSummary');
  const fixture = state([row('history-start', '2026-01-01', 0), row('old', '2026-09-02', 10, { subcategory: '' }), row('current', '2026-10-02', 20, { subcategory: '' }), row('named', '2026-10-02', 30), row('future', '2026-10-08', 40, { subcategory: '' })]);
  const result = analyse(fixture, scope, 3, now);
  const part = result.subcategoryChanges.find(p => p.category === 'Food' && p.subcategory === '');
  const matching = filterLedgerEntries(fixture.entries, { search: '', types: ['expense'], accounts: [], categories: [part.category], subcategories: [''], startDay: '', endDay: '', reportWindow: result.comparisonWindow });
  assert.equal(matching.length, 1); assert.equal(matching[0].id, 'current');
  assert.equal(result.comparisonWindow.endExclusive, scope.endExclusive.getTime());
});
test('custom multi-month pulse compares daily rates, not a multi-month total against one month', () => {
  const fixture = state([row('first', '2026-01-01', 0), row('july', '2026-07-02', 31), row('aug', '2026-08-02', 31), row('sep', '2026-09-02', 30), row('oct', '2026-10-02', 31), row('nov', '2026-11-02', 30)]);
  const report = analyse(fixture, { ...scope, endExclusive: new Date('2026-12-01') }, 3, new Date('2026-12-02'));
  assert.equal(report.pulse.rate.current, 1);
  assert.equal(report.pulse.rate.baseline, 1);
  assert.equal(report.pulse.deltaPercent, 0);
});
test('no history gives no invented pulse or category changes', () => {
  const result = analyse(state([row('only', '2026-10-02', 30)]), scope, 6, now);
  assert.equal(result.pulse.rate, null);
  assert.equal(result.changes.length, 0);
});
test('repeated charges normalize case/spacing, preserve separate subcategories and future exclusions', () => {
  const fixture = state([row('a', '2026-10-02', 10, { item: 'Coffee' }), row('b', '2026-10-03', 20, { item: '  COFFEE  ' }), row('other', '2026-10-03', 30, { item: 'Coffee', subcategory: 'Gifts' }), row('future', '2026-10-07', 1000, { item: 'Coffee' })]);
  const result = analyse(fixture, scope, 3, now);
  assert.equal(result.repeatedCharges.length, 1);
  assert.equal(result.repeatedCharges[0].amount, 30);
  assert.equal(result.repeatedCharges[0].count, 2);
});
test('simulator refuses protected/unconfirmed cuts, shows target gap, and never edits budgets', () => {
  const fixture = state([row('flex', '2026-10-02', 100), row('protected', '2026-10-02', 500, { subcategory: 'Essentials' }), row('unknown', '2026-10-02', 400, { subcategory: 'Other' })]);
  fixture.analysisExpenseClasses = { [key('Food', 'Dining')]: 'flexible', [key('Food', 'Essentials')]: 'protected' };
  const before = JSON.stringify(fixture), result = analyse(fixture, scope, 3, now);
  const cuts = simulate(result, 10, { [key('Food', 'Dining')]: 25, [key('Food', 'Essentials')]: 25, [key('Food', 'Other')]: 25 });
  assert.equal(cuts.saving, 25);
  assert.equal(cuts.targetAmount, 100);
  assert.equal(cuts.gap, 75);
  assert.equal(cuts.projectedExpense, 975);
  assert.equal(cuts.proposals.length, 1);
  assert.equal(JSON.stringify(fixture), before);
  assert.equal(simulate(result, 10, { [key('Food', 'Dining')]: 999 }).saving, 0);
  assert.throws(() => simulate(result, 30, {}));
});
test('classifications are exported to AI; reclassifying a flexible group removes its proposed cuts', () => {
  const fixture = state([row('e', '2026-10-02', 100)]);
  fixture.analysisExpenseClasses = { [key('Food', 'Dining')]: 'flexible' };
  assert.equal(prompt(fixture, scope, 5, 3, now).data.selected.expenseSubcategories[0].userClassification, 'flexible');
  fixture.analysisExpenseClasses[key('Food', 'Dining')] = 'protected';
  assert.equal(simulate(analyse(fixture, scope, 3, now), 5, { [key('Food', 'Dining')]: 25 }).saving, 0);
});
test('cent arithmetic and report boundaries remain exact', () => {
  const result = analyse(state([row('a', '2026-10-01', 0.1), row('b', '2026-10-02', 0.2), row('outside', '2026-11-01', 100), row('old', '2026-09-30', 100)]), scope, 3, new Date('2026-11-02'));
  assert.equal(result.metrics.expense, 0.3);
  assert.equal(result.groups[0].amount, 0.3);
});
