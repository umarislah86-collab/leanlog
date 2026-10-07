const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const exportsApi = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('services/redcoinsReconciliation.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: exportsApi, Date });
const { bankReviewProjection: project, reviewSignature: signature, accountMovement: movement, reviewDay } = exportsApi;
const now = new Date(2026, 9, 7, 12).getTime();
const account = { id: 'bank', name: 'Bank', type: 'Bank', balance: 1000 };
const row = (id, day, amount, extras = {}) => ({ id, type: 'expense', item: 'Coffee', amount, date: new Date(2026, 9, day, 10).toISOString(), account: 'Bank', category: 'Food', subcategory: 'Dining', ...extras });
const review = (extras = {}) => ({ startDay: '2026-10-01', endDay: '2026-10-07', bankBalance: '', matched: {}, savedAt: '', ...extras });

test('today bank review uses saved live balance and excludes future transactions without mutation', () => {
  const state = { entries: [row('actual', 2, 20), row('future', 8, 500), row('today-later', 7, 99, { date: new Date(now + 1000).toISOString() })] };
  const before = JSON.stringify([state, account]);
  const result = project(state, account, review({ bankBalance: '1000.00' }), now);
  assert.equal(result.ledgerBalance, 1000); assert.equal(result.difference, 0);
  assert.equal(result.rows.length, 1); assert.equal(JSON.stringify([state, account]), before);
});
test('historical balance rewinds outgoing/incoming transfers, income and expense using cents', () => {
  const state = { entries: [row('old', 1, 50), row('expense', 5, 10.1), row('income', 5, 20.2, { type: 'income' }), row('out', 6, 30, { type: 'transfer', toAccount: 'Pot' }), row('in', 6, 40, { type: 'transfer', account: 'Pot', toAccount: 'Bank' }), row('not-applied', 6, 999, { balanceEffectApplied: false })] };
  const result = project(state, account, review({ endDay: '2026-10-03', bankBalance: '979.90' }), now);
  assert.equal(result.ledgerBalance, 979.9); assert.equal(result.difference, 0); assert.equal(result.rows.length, 1);
});
test('incoming transfer appears in destination review and self transfer nets zero', () => {
  const transfer = row('in', 2, 300, { type: 'transfer', account: 'Pot', toAccount: 'Bank' });
  assert.equal(movement(transfer, account), 30000);
  assert.equal(project({ entries: [transfer] }, account, review(), now).rows.length, 1);
  assert.equal(movement({ ...transfer, account: 'Bank' }, account), 0);
});
test('saved review ticks survive JSON but invalidate modified/deleted transactions and never change difference', () => {
  const entry = row('e', 2, 20); const saved = review({ bankBalance: '900', matched: { e: signature(entry), deleted: 'old' } });
  const restored = JSON.parse(JSON.stringify(saved));
  const result = project({ entries: [entry] }, account, restored, now);
  assert.equal(result.matchedCount, 1); assert.equal(result.remainingCount, 0); assert.equal(result.difference, -100);
  const changed = project({ entries: [{ ...entry, amount: 30 }] }, account, restored, now);
  assert.equal(changed.matchedCount, 0); assert.equal(changed.remainingCount, 1); assert.equal(changed.difference, -100);
});
test('signed credit card debt uses same balance convention and rejects malformed balance values', () => {
  const card = { ...account, type: 'Credit card', balance: -961 };
  assert.equal(project({ entries: [] }, card, review({ bankBalance: '-961.00' }), now).difference, 0);
  for (const bankBalance of ['', 'RM 961', '1,000', 'abc', 'Infinity', '1.234']) assert.equal(project({ entries: [] }, card, review({ bankBalance }), now).bankBalance, null);
});
test('validates local calendar dates, includes whole as-of day and rejects future/reversed windows', () => {
  assert.equal(reviewDay('2026-02-30'), null); assert.equal(reviewDay('2026-1-01'), null);
  for (const extras of [{ startDay: '2026-10-09' }, { endDay: '2026-10-08' }, { endDay: '2026-09-01' }]) assert.equal(project({ entries: [] }, account, review(extras), now), null);
  const entries = [row('late', 3, 1, { date: new Date(2026, 9, 3, 23, 59).toISOString() }), row('next', 4, 2, { date: new Date(2026, 9, 4, 0).toISOString() })];
  const result = project({ entries }, account, review({ endDay: '2026-10-03' }), now);
  assert.equal(result.rows.length, 1); assert.equal(result.rows[0].id, 'late'); assert.equal(result.ledgerBalance, 1002);
});
