const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const api = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('services/redcoinsIncomeDuplicate.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: api, Date });
const { findIncomeDuplicates: find, incomeMonth, validIncomePeriod } = api;
const row = (id, extras = {}) => ({ id, type: 'income', item: 'EPF', account: 'EPF', category: 'Employer', subcategory: 'Salary', amount: 1610, date: new Date(2026, 9, 3, 12).toISOString(), ...extras });
test('monthly EPF warns for same account/title/month even when amounts and dates differ', () => {
  const entries = [row('existing')], before = JSON.stringify(entries);
  const result = find(entries, row('new', { item: ' epf ', amount: 1700, date: new Date(2026, 9, 20).toISOString() }));
  assert.equal(result.length, 1); assert.equal(result[0].id, 'existing'); assert.equal(JSON.stringify(entries), before);
});
test('late income period identifies previous-month logging without changing actual dates', () => {
  const entries = [row('september', { date: new Date(2026, 8, 30).toISOString() }), row('october')];
  const draft = row('new', { incomePeriod: '2026-09' });
  assert.equal(find(entries, draft)[0].id, 'september'); assert.equal(find(entries, draft).length, 1);
  assert.equal(draft.date, row('new').date);
  assert.equal(find([row('late', { incomePeriod: '2026-09' })], draft).length, 1);
});
test('excludes the edited entry itself, other accounts/titles/types and different months', () => {
  const entries = [row('self'), row('other-account', { account: 'Other' }), row('other-title', { item: 'Bonus' }), row('expense', { type: 'expense' }), row('last-month', { date: new Date(2026, 8, 1).toISOString() })];
  assert.equal(find(entries, row('self')).length, 0);
  assert.equal(find([row('e')], row('new', { type: 'expense' })).length, 0);
});
test('ordinary rebates do not warn monthly; exact same day/title/account/amount still warns', () => {
  const rebate = row('old', { item: 'Cash rebate', account: 'Card', subcategory: 'Rebates', category: 'Bank' });
  assert.equal(find([rebate], { ...rebate, id: 'new', date: new Date(2026, 9, 4).toISOString() }).length, 0);
  assert.equal(find([rebate], { ...rebate, id: 'new', amount: 10 }).length, 0);
  assert.equal(find([rebate], { ...rebate, id: 'new' }).length, 1);
});
test('explicit period enables review for custom periodic income and month validation is strict', () => {
  const custom = row('old', { item: 'Rental', account: 'Bank', category: 'Income', subcategory: 'Other', incomePeriod: '2026-09' });
  assert.equal(find([custom], { ...custom, id: 'new', amount: 500 }).length, 1);
  for (const value of ['2026-00', '2026-13', 'Sep 2026', '2026-9', '']) assert.equal(validIncomePeriod(value), false);
  assert.equal(validIncomePeriod('2026-09'), true); assert.equal(incomeMonth(new Date(2026, 8, 1)), '2026-09');
});
