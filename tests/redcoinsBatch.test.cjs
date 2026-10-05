const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../services', `${file}.ts`), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, { exports, Date, console, require: id => {
    if (id === './redcoinsAccountIdentity') return load('redcoinsAccountIdentity', { '@react-native-async-storage/async-storage': mocks['@react-native-async-storage/async-storage'] });
    if (!(id in mocks)) throw new Error(`Unexpected ${id}`);
    return mocks[id];
  } });
  return exports;
}
const storage = new Map();
const asyncStorage = { getItem: async key => storage.get(key) || null, setItem: async (key, value) => storage.set(key, value) };
const guardConfigs = [{ id: 'g', name: 'Aeon', scope: 'account', target: 'Aeon', limit: 100, cycle: 'salary', enabled: true, thresholds: [50], tone: 'normal' }];
const redcoins = load('redcoins', {
  '@react-native-async-storage/async-storage': asyncStorage, 'expo-file-system/legacy': {}, 'expo-sharing': {}, './exportFile': {},
  './redcoinsReminders': { materializeAutomaticReminders: () => [] }, './spendingGuards': { loadSpendingGuards: async () => guardConfigs, syncPinnedGuardSnapshot: async results => storage.set('test_guard_snapshot', JSON.stringify(results)), WIDGET_CASH_REALITY_KEY: 'test_cash_snapshot' }, './redcoinsEvents': { emitRedCoinsChange: () => {} }, './redcoinsGuards': load('redcoinsGuards'),
});
const batch = load('redcoinsBatch', { '@react-native-async-storage/async-storage': asyncStorage, './redcoins': redcoins, './redcoinsLogger': load('redcoinsLogger') });
const now = new Date(2026, 9, 5, 12);
const row = (id, extras = {}) => ({ id, item: 'Coffee', amount: 10, type: 'expense', account: 'Aeon', category: 'Food', subcategory: 'Drinks', date: new Date(2026, 9, 3, 8, 51).toISOString(), origin: 'redcoins', balanceEffectApplied: true, labels: ['old'], ...extras });
const state = entries => ({ entries, accounts: [{ id: 'a', name: 'Aeon', type: 'Bank', balance: 100 }, { id: 'b', name: 'Cimb', type: 'Bank', balance: 50 }], categories: [{ id: 'f', name: 'Food', subcategories: ['Drinks', 'Groceries'], subcategoryTypes: { Drinks: ['expense'], Groceries: ['expense'] } }, { id: 's', name: 'Employer', subcategories: ['Salary'], subcategoryTypes: { Salary: ['income'] } }], deletedEntries: [], reminders: [], monthlyBudget: 100, payday: 25, safetyBuffer: 0, exportBatches: [] });
test('bulk title applies to every selected row, preserves unselected rows and leaves balances unchanged', () => {
  const original = state([row('1'), row('2'), row('3')]);
  const result = batch.applyRedCoinsBatch(original, ['1', '2'], { kind: 'name', value: ' Grocery ' }, now);
  assert.equal(result.entries[0].item, 'Grocery'); assert.equal(result.entries[1].item, 'Grocery'); assert.equal(result.entries[2].item, 'Coffee');
  assert.equal(result.accounts[0].balance, 100); assert.equal(original.entries[0].item, 'Coffee');
  assert.equal(result.entries[0].editedAt, now.toISOString());
});
test('amount reverses old effects then applies same amount to EACH selected entry', () => {
  const result = batch.applyRedCoinsBatch(state([row('1'), row('2')]), ['1', '2'], { kind: 'amount', value: 25 }, now);
  assert.equal(result.accounts[0].balance, 70);
  assert.equal(result.entries.reduce((sum, e) => sum + e.amount, 0), 50);
});
test('income and transfer amount changes update both sides without double expense', () => {
  const income = batch.applyRedCoinsBatch(state([row('1', { type: 'income' })]), ['1'], { kind: 'amount', value: 20 }, now);
  assert.equal(income.accounts[0].balance, 110);
  const transfer = batch.applyRedCoinsBatch(state([row('1', { type: 'transfer', toAccount: 'Cimb' })]), ['1'], { kind: 'amount', value: 20 }, now);
  assert.equal(transfer.accounts[0].balance, 90); assert.equal(transfer.accounts[1].balance, 60);
});
test('account changes reverse source, apply destination and validate all transfer pairs atomically', () => {
  const original = state([row('1'), row('2', { type: 'transfer', toAccount: 'Cimb' })]);
  assert.throws(() => batch.applyRedCoinsBatch(original, ['1', '2'], { kind: 'account', account: 'Cimb' }, now), /different/);
  assert.equal(original.accounts[0].balance, 100);
  const next = batch.applyRedCoinsBatch(original, ['1', '2'], { kind: 'account', account: 'Cimb', toAccount: 'Aeon' }, now);
  assert.equal(next.accounts[0].balance, 130); assert.equal(next.accounts[1].balance, 20);
});
test('date preserves local time, reverses current-to-future and applies future-to-current exactly once', () => {
  const future = batch.applyRedCoinsBatch(state([row('1')]), ['1'], { kind: 'date', day: '2026-10-07' }, now);
  assert.equal(future.accounts[0].balance, 110); assert.equal(future.entries[0].balanceEffectApplied, false);
  assert.equal(new Date(future.entries[0].date).getHours(), 8); assert.equal(new Date(future.entries[0].date).getMinutes(), 51);
  const current = batch.applyRedCoinsBatch(future, ['1'], { kind: 'date', day: '2026-10-04' }, now);
  assert.equal(current.accounts[0].balance, 100); assert.equal(current.entries[0].balanceEffectApplied, true);
});
test('future amount change does not affect current balance', () => {
  const next = batch.applyRedCoinsBatch(state([row('1', { date: new Date(2026, 9, 7).toISOString(), balanceEffectApplied: false })]), ['1'], { kind: 'amount', value: 20 }, now);
  assert.equal(next.accounts[0].balance, 100); assert.equal(next.entries[0].balanceEffectApplied, false);
});
test('categories enforce transaction type and reject mixed or transfer selections', () => {
  const original = state([row('1'), row('2', { type: 'income' }), row('3', { type: 'transfer', toAccount: 'Cimb' })]);
  assert.equal(batch.applyRedCoinsBatch(original, ['1'], { kind: 'category', category: 'Food', subcategory: 'Groceries' }, now).entries[0].subcategory, 'Groceries');
  assert.throws(() => batch.applyRedCoinsBatch(original, ['2'], { kind: 'category', category: 'Food', subcategory: 'Drinks' }, now), /valid/);
  for (const ids of [['1', '2'], ['3']]) assert.throws(() => batch.applyRedCoinsBatch(original, ids, { kind: 'category', category: 'Food', subcategory: 'Drinks' }, now), /only/);
});
test('label add/replace/remove/clear applies consistently without modifying originals', () => {
  const original = state([row('1')]);
  const labels = mode => batch.applyRedCoinsBatch(original, ['1'], { kind: 'labels', mode, labels: [' new ', 'old', 'new'] }, now).entries[0].labels;
  assert.equal(JSON.stringify(labels('add')), '["old","new"]'); assert.equal(JSON.stringify(labels('replace')), '["new","old"]');
  assert.equal(JSON.stringify(labels('remove')), '[]'); assert.equal(JSON.stringify(labels('clear')), '[]');
  assert.equal(JSON.stringify(original.entries[0].labels), '["old"]');
});
test('reconcile sets review status, not an extra balance movement', () => {
  const result = batch.applyRedCoinsBatch(state([row('1')]), ['1'], { kind: 'status', value: 'reconciled' }, now);
  assert.equal(result.entries[0].status, 'reconciled'); assert.equal(result.accounts[0].balance, 100);
});
test('delete reverses due balances only, preserves schedules, keeps compact import suppression', () => {
  const original = state([row('1', { origin: 'bluecoins' }), row('2', { date: new Date(2026, 9, 7).toISOString(), balanceEffectApplied: false })]); original.reminders = [{ id: 'schedule' }];
  const result = batch.applyRedCoinsBatch(original, ['1', '2'], { kind: 'delete' }, now);
  assert.equal(result.entries.length, 0); assert.equal(result.accounts[0].balance, 110); assert.equal(result.deletedEntries.length, 2); assert.equal(result.reminders.length, 1);
  assert.equal('attachment' in result.deletedEntries[0], false);
});
test('stale selection, malformed date and invalid amount reject whole batch', () => {
  const original = state([row('1')]);
  assert.throws(() => batch.applyRedCoinsBatch(original, ['1', 'missing'], { kind: 'delete' }, now), /Selection/);
  assert.throws(() => batch.applyRedCoinsBatch(original, ['1'], { kind: 'date', day: '2026-02-30' }, now), /valid date/);
  for (const value of [0, NaN, -1, Infinity, 0.001]) assert.throws(() => batch.applyRedCoinsBatch(original, ['1'], { kind: 'amount', value }, now), /greater/);
  assert.equal(original.accounts[0].balance, 100);
});
test('copy persists a snapshot; paste resets schedule/export metadata, uses fresh ids and updates balances', async () => {
  const original = row('1', { origin: 'bluecoins', repeat: 'monthly', reminderSeriesId: 'r', reminderOccurrenceKey: 'o', autoGenerated: true, exportedAt: 'old', reconciledImportId: 'linked' });
  await batch.copyRedCoinsEntries([original]); original.item = 'Edited after copy';
  const copied = await batch.readRedCoinsClipboard(); assert.equal(copied[0].item, 'Coffee');
  const pasted = batch.pasteRedCoinsEntries(state([]), copied, '2026-10-04', now, () => 'fresh-id');
  assert.equal(pasted.accounts[0].balance, 90);
  const entry = pasted.entries[0]; assert.equal(entry.id, 'fresh-id'); assert.equal(entry.origin, 'redcoins'); assert.equal(entry.repeat, 'none');
  for (const key of ['reminderSeriesId', 'reminderOccurrenceKey', 'autoGenerated', 'exportedAt', 'reconciledImportId']) assert.equal(entry[key], undefined);
});
test('paste supports transfers, rejects deleted accounts/categories and never mutates current state on failure', () => {
  const original = state([]);
  const transfer = batch.pasteRedCoinsEntries(original, [row('1', { type: 'transfer', toAccount: 'Cimb' })], null, now);
  assert.equal(transfer.accounts[0].balance, 90); assert.equal(transfer.accounts[1].balance, 60);
  assert.throws(() => batch.pasteRedCoinsEntries(original, [row('1', { account: 'Deleted' })], null, now), /no longer/);
  assert.throws(() => batch.pasteRedCoinsEntries(original, [row('1', { subcategory: 'Deleted' })], null, now), /no longer/);
  assert.equal(original.accounts[0].balance, 100);
});
test('same-day deliberate copy remains an additional expense after Bluecoins refresh', async () => {
  const original = row('import-1', { origin: 'bluecoins', balanceEffectApplied: undefined });
  const pasted = batch.pasteRedCoinsEntries(state([original]), [original], null, now, () => 'copy-1');
  await redcoins.saveRedCoins(pasted);
  const summary = { redcoins: { entries: [original], categories: pasted.categories, accounts: [{ name: 'Aeon', type: 'Bank', balance: 100 }, { name: 'Cimb', type: 'Bank', balance: 50 }] }, monthly: { payday: 25, budget: 100 }, cashReality: { safetyBuffer: 0 } };
  const reloaded = await redcoins.loadRedCoins(summary);
  assert.equal(reloaded.entries.length, 2); assert.equal(reloaded.accounts[0].balance, 90);
  assert.equal((await redcoins.loadRedCoins(summary)).accounts[0].balance, 90);
});
test('editing a reconciled local category survives refresh without inflating account balance', async () => {
  const original = row('local', { reconciledImportId: 'import-1' });
  const next = batch.applyRedCoinsBatch(state([original]), ['local'], { kind: 'category', category: 'Food', subcategory: 'Groceries' }, now);
  await redcoins.saveRedCoins(next);
  const summary = { redcoins: { entries: [{ ...original, id: 'import-1', origin: 'bluecoins' }], categories: next.categories, accounts: [{ name: 'Aeon', type: 'Bank', balance: 100 }, { name: 'Cimb', type: 'Bank', balance: 50 }] }, monthly: { payday: 25, budget: 100 }, cashReality: { safetyBuffer: 0 } };
  const reloaded = await redcoins.loadRedCoins(summary);
  assert.equal(reloaded.entries.length, 1); assert.equal(reloaded.entries[0].subcategory, 'Groceries'); assert.equal(reloaded.accounts[0].balance, 100);
});

test('imported batch amount updates the Home coach budget and detail rows, not only ledger', async () => {
  const original = row('import-1', { origin: 'bluecoins' });
  const next = batch.applyRedCoinsBatch(state([original]), ['import-1'], { kind: 'amount', value: 25 }, now);
  await redcoins.saveRedCoins(next);
  const summary = {
    redcoins: { entries: [original], accounts: next.accounts, categories: next.categories },
    monthly: { cycleStart: '2026-10-01', cycleEnd: '2026-10-31', budget: 100, spent: 10, remaining: 90, projected: 10, projectedLow: 10, projectedHigh: 10, alerts: [], expectedFixedCommitments: { items: [] }, topCategories: [{ name: 'Food', amount: 10, share: 100, details: [{ item: 'Coffee', subcategory: 'Drinks', amount: 10, transactions: 1, share: 100 }] }] },
    cashReality: { cashAccounts: [{ name: 'Aeon', selected: true, balance: 100 }], creditCards: [], safetyBuffer: 0 },
  };
  const merged = await redcoins.mergeRedCoinsIntoBudgetCoach(summary);
  assert.equal(merged.monthly.spent, 25); assert.equal(merged.monthly.remaining, 75);
  assert.equal(merged.monthly.topCategories[0].details[0].amount, 25);
  assert.equal(merged.redcoins.entries[0].amount, 25); assert.equal(merged.cashReality.liquidBalance, 85);
  assert.equal(JSON.parse(storage.get('test_cash_snapshot')).liquidBalance, 85);
  assert.equal(JSON.parse(storage.get('test_guard_snapshot'))[0].spent, 25);
});

test('destination-only transfer change keeps source and reverses the old destination', () => {
  const original = state([row('1', { type: 'transfer', toAccount: 'Cimb' })]);
  original.accounts.push({ id: 'third', name: 'Wallet', type: 'Cash', balance: 5 });
  const next = batch.applyRedCoinsBatch(original, ['1'], { kind: 'account', account: '', toAccount: 'Wallet' }, now);
  assert.equal(next.accounts[0].balance, 100); assert.equal(next.accounts[1].balance, 40); assert.equal(next.accounts[2].balance, 15);
});
test('deleting an unexported pasted copy does not delete its imported original on refresh', async () => {
  const original = row('import-1', { origin: 'bluecoins' });
  const pasted = batch.pasteRedCoinsEntries(state([original]), [original], null, now, () => 'copy-1');
  await redcoins.saveRedCoins(batch.applyRedCoinsBatch(pasted, ['copy-1'], { kind: 'delete' }, now));
  const summary = { redcoins: { entries: [original], categories: pasted.categories, accounts: [{ name: 'Aeon', type: 'Bank', balance: 100 }, { name: 'Cimb', type: 'Bank', balance: 50 }] }, monthly: { payday: 25, budget: 100 }, cashReality: { safetyBuffer: 0 } };
  const reloaded = await redcoins.loadRedCoins(summary);
  assert.equal(reloaded.entries.length, 1); assert.equal(reloaded.entries[0].id, 'import-1'); assert.equal(reloaded.accounts[0].balance, 100);
});
test('exported copy reconciles with its newly imported counterpart, never the original', async () => {
  const original = row('import-1', { origin: 'bluecoins' });
  const pasted = batch.pasteRedCoinsEntries(state([original]), [original], null, now, () => 'copy-1');
  pasted.entries[0].exportedAt = now.toISOString();
  await redcoins.saveRedCoins(pasted);
  const summary = { redcoins: { entries: [original, { ...original, id: 'import-2' }], categories: pasted.categories, accounts: [{ name: 'Aeon', type: 'Bank', balance: 90 }, { name: 'Cimb', type: 'Bank', balance: 50 }] }, monthly: { payday: 25, budget: 100 }, cashReality: { safetyBuffer: 0 } };
  const reloaded = await redcoins.loadRedCoins(summary);
  assert.equal(reloaded.entries.length, 2); assert.equal(reloaded.accounts[0].balance, 90);
  assert.equal(reloaded.entries.find(e => e.id === 'copy-1').reconciledImportId, 'import-2');
  assert.ok(reloaded.entries.some(e => e.id === 'import-1'));
});
test('malformed persisted clipboard is harmless', async () => {
  storage.set('redcoins_bulk_clipboard_v1', 'bad JSON');
  assert.equal((await batch.readRedCoinsClipboard()).length, 0);
  storage.set('redcoins_bulk_clipboard_v1', JSON.stringify({ version: 1, entries: [null, { type: 'expense', amount: 'wrong' }] }));
  assert.equal((await batch.readRedCoinsClipboard()).length, 0);
});
