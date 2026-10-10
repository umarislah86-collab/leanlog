const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');
function load(name, mocks = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../services', name + '.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, { exports, Date, console, require: id => {
    if (id === './redcoinsSqlStore') {
      mocks['expo-sqlite'] ||= require('./helpers/redcoins-sql.cjs').sqliteHarness().expo;
      return load('redcoinsSqlStore', mocks);
    }
    if (id === './redcoinsAccountIdentity') return load('redcoinsAccountIdentity', mocks);
    if (id === './redcoinsSalaryFilter') return load('redcoinsSalaryFilter');
    if (id === './redcoinsStatus') return load('redcoinsStatus');
    if (id === './redcoinsSummary') return load('redcoinsSummary', { './redcoinsGuards': load('redcoinsGuards') });
    if (id === './redcoinsImportPlan') return load('redcoinsImportPlan', mocks);
    if (id === './redcoinsEvents' && !(id in mocks)) return { emitRedCoinsChange: () => {} };
    if (!(id in mocks)) throw Error('Forbidden dependency: ' + id);
    return mocks[id];
  } });
  return exports;
}
const now = new Date('2026-10-06T12:00:00+08:00');
const row = (id, extras = {}) => ({ id, origin: 'bluecoins', type: 'expense', item: 'Coffee', amount: 10, account: 'Aeon', category: 'Food', subcategory: 'Drinks', date: '2026-10-03T09:00:00+08:00', note: '', status: 'cleared', balanceEffectApplied: true, ...extras });
const account = (id, name, balance = 100, type = 'Bank') => ({ id, sourceAccountId: id, name, balance, type, icon: 'wallet' });
const state = (entries = [], accounts = [account('1', 'Aeon')]) => ({ entries, accounts, categories: [], reminders: [], deletedEntries: [], deletedAccountNames: [], deletedCategoryNames: [], deletedSubcategories: {}, monthlyBudget: 2000, payday: 25, safetyBuffer: 50, exportBatches: [], subcategoryBudgets: {}, createdAt: '2026-01-01' });
const summary = (entries = [], accounts = [account('1', 'Aeon', 9999)]) => ({ sourceName: 'Bluecoins_2026-10-06.fydb', sourceDate: '2026-10-06', redcoins: { entries, accounts, categories: [] } });
const { prepareRedCoinsImport: prepare } = load('redcoinsImportPlan', { '@react-native-async-storage/async-storage': {} });
const { buildRedCoinsSummary: project } = load('redcoinsSummary', { './redcoinsGuards': load('redcoinsGuards') });
const prefs = { selectedAccounts: ['Aeon'], fixedCommitments: [], guards: [] };

test('summary and salary guards share the salary timestamp, with no rewriting of early loan dates', () => {
  const saved = state([
    row('salary-aug', { type: 'income', item: 'DXC', subcategory: 'Salary', date: '2026-08-25T18:00:00+08:00' }),
    row('salary-sep', { type: 'income', item: 'DXC', subcategory: 'Salary', date: '2026-09-25T18:00:00+08:00' }),
    row('early-loan', { type: 'transfer', toAccount: 'House', amount: 500, date: '2026-09-25T17:59:00+08:00' }),
    row('late-loan', { type: 'transfer', toAccount: 'Car', amount: 100, date: '2026-09-25T18:01:00+08:00' }),
    row('early-food', { amount: 30, date: '2026-09-25T17:59:00+08:00' }),
    row('late-food', { amount: 20, date: '2026-09-25T18:01:00+08:00' }),
  ], [account('1', 'Aeon'), account('2', 'House', -10000, 'Liability'), account('3', 'Car', -1000, 'Liability')]);
  const before = JSON.stringify(saved);
  const result = project(saved, { ...prefs, guards: [{ id: 'g', target: 'Food', scope: 'category', cycle: 'salary', limit: 100 }] }, now);
  assert.equal(result.monthly.spent, 120); assert.equal(result.monthly.previousMonth, 530);
  assert.equal(result.spendingGuards[0].spent, 20);
  assert.equal(new Date(result.monthly.cycleStartInstant).getTime(), new Date('2026-09-25T18:00:00+08:00').getTime());
  assert.equal(JSON.stringify(saved), before);
});

test('pure summary uses live ledger and saved cash, not imported source balances; exact cents and future exclusion', () => {
  const saved = state([row('one', { amount: .1 }), row('two', { amount: .2 }), row('future', { amount: 500, date: '2099-01-01', balanceEffectApplied: false })]);
  const before = JSON.stringify(saved), result = project(saved, prefs, now);
  assert.equal(result.monthly.spent, .3); assert.equal(result.monthly.remaining, 1999.7);
  assert.equal(result.cashReality.liquidBalance, 100); assert.equal(result.cashReality.trueSpendable, 50);
  assert.equal(result.total, .3); assert.equal(JSON.stringify(saved), before);
});
test('two loan repayments count once in budget, internal and card settlement transfers are not expenses', () => {
  const saved = state([
    row('food', { amount: 100 }), row('mortgage', { type: 'transfer', amount: 1500, toAccount: 'House' }),
    row('car', { type: 'transfer', amount: 653, toAccount: 'Car' }), row('card', { type: 'transfer', amount: 500, toAccount: 'Card' }), row('internal', { type: 'transfer', amount: 300, toAccount: 'Pot' }),
  ], [account('1', 'Aeon', 3000), account('2', 'House', -200000, 'Liability'), account('3', 'Car', -10000, 'Liability'), account('4', 'Card', -378.04, 'Credit card'), account('5', 'Pot', 1856.97)]);
  const result = project(saved, prefs, now);
  assert.equal(result.monthly.spent, 2253); assert.equal(result.monthly.fixedCommitments.total, 2153);
  assert.equal(result.cashReality.trueSpendable, 2571.96);
  assert.equal(result.monthly.topCategories.find(c => c.name === 'Debt commitment').amount, 2153);
});
test('unpaid historic loans reserve cash once; paying them removes reserve immediately', () => {
  const historic = row('loan', { type: 'transfer', toAccount: 'House', amount: 500, date: '2026-09-01' });
  const saved = state([historic], [account('1', 'Aeon', 1000), account('2', 'House', -10000, 'Liability')]);
  assert.equal(project(saved, prefs, now).cashReality.trueSpendable, 450);
  saved.entries.push(row('paid', { type: 'transfer', toAccount: 'House', amount: 500 })); saved.accounts[0].balance -= 500;
  assert.equal(project(saved, prefs, now).cashReality.trueSpendable, 450);
  assert.equal(project(saved, prefs, now).monthly.spent, 500);
});
test('settings and guard changes project immediately, including explicit empty cash selection', () => {
  const saved = state([row('food', { amount: 128.95 })]);
  const guard = { id: 'g', name: 'Food', target: 'Food', scope: 'category', cycle: 'salary', limit: 400, enabled: true };
  assert.equal(project(saved, { ...prefs, guards: [guard] }, now).spendingGuards[0].spent, 128.95);
  saved.monthlyBudget = 3000; saved.safetyBuffer = 10;
  const result = project(saved, { ...prefs, selectedAccounts: [] }, now);
  assert.equal(result.monthly.remaining, 2871.05); assert.equal(result.cashReality.trueSpendable, -10);
});
test('repeat import applies new rows once and preserves manually adjusted existing balances', () => {
  const original = state([row('old')]);
  const incoming = summary([row('old'), row('new', { amount: 20, item: 'Groceries' })]);
  const first = prepare(original, incoming, now);
  assert.equal(first.state.accounts[0].balance, 80); assert.equal(first.counts.added, 1);
  assert.equal(original.accounts[0].balance, 100, 'preview must be pure');
  for (let i = 0; i < 10; i++) first.state = prepare(first.state, incoming, now).state;
  assert.equal(first.state.accounts[0].balance, 80); assert.equal(first.state.entries.length, 2);
});
test('changed imported amount applies difference only; locally edited row stays protected', () => {
  const changed = prepare(state([row('old')]), summary([row('old', { amount: 25 })]), now);
  assert.equal(changed.state.accounts[0].balance, 85); assert.equal(changed.counts.updated, 1);
  const local = state([row('old', { amount: 40, editedAt: now.toISOString() })]);
  const protectedPlan = prepare(local, summary([row('old', { amount: 25 })]), now);
  assert.equal(protectedPlan.state.accounts[0].balance, 100); assert.equal(protectedPlan.state.entries[0].amount, 40); assert.equal(protectedPlan.counts.protected, 1);
});
test('matched local transfer retains custom destination and never replays RM300', () => {
  const accounts = [account('1', 'Aeon'), { id: 'custom', name: 'Pot aeon', type: 'Bank', balance: 1856.97 }];
  const local = row('local', { type: 'transfer', item: 'Ke savings pot', amount: 300, origin: 'redcoins', toAccount: 'Pot aeon', reconciledImportId: 'imported' });
  let current = state([local, row('adjustment', { type: 'income', origin: 'redcoins', account: 'Pot aeon', amount: 600 })], accounts);
  current.deletedAccountNames = ['Old Pot'];
  const incoming = summary([row('imported', { ...local, id: 'imported', origin: 'bluecoins', toAccount: 'Old Pot' })], [...accounts.filter(a => a.sourceAccountId), account('2', 'Old Pot', 1800)]);
  for (let i = 0; i < 10; i++) current = prepare(current, incoming, now).state;
  assert.equal(current.accounts.find(a => a.name === 'Pot aeon').balance, 1856.97);
  assert.equal(current.accounts.find(a => a.name === 'Aeon').balance, 100);
  assert.equal(current.entries.length, 2); assert.equal(current.entries.find(e => e.id === 'adjustment').amount, 600);
});
test('first import initializes new accounts from source opening balance, not double-applied history', () => {
  const first = prepare(state([], []), summary([row('old')], [account('1', 'Aeon', 90)]), now);
  assert.equal(first.state.accounts[0].balance, 90); assert.equal(first.state.entries.length, 1);
  assert.equal(prepare(first.state, summary([row('old')], [account('1', 'Aeon', 90)]), now).state.accounts[0].balance, 90);
});
test('known source deletions reverse exactly once; first migration import does not guess missing history', () => {
  const initial = state([row('old')]);
  assert.equal(prepare(initial, summary([]), now).state.entries.length, 1);
  const accepted = prepare(initial, summary([row('old')]), now).state;
  const removed = prepare(accepted, summary([]), now);
  assert.equal(removed.state.accounts[0].balance, 110); assert.equal(removed.counts.removed, 1);
  assert.equal(prepare(removed.state, summary([]), now).state.accounts[0].balance, 110);
});
test('deleted local entries and source-ID accounts never resurrect, intentional copies remain independent', () => {
  const saved = state([]); saved.deletedEntries = [row('gone')]; saved.deletedSourceAccountIds = ['2'];
  const result = prepare(saved, summary([row('gone')], [account('1', 'Aeon'), account('2', 'Renamed deleted', 200)]), now);
  assert.equal(result.state.entries.length, 0); assert.equal(result.state.accounts.length, 1); assert.equal(result.state.accounts[0].balance, 100);
});
test('invalid source rows reject atomically', () => {
  const saved = state(); const before = JSON.stringify(saved);
  assert.throws(() => prepare(saved, summary([row('x'), row('x')]), now), /duplicate/);
  assert.throws(() => prepare(saved, summary([row('x', { amount: NaN })]), now), /Invalid/);
  assert.equal(JSON.stringify(saved), before);
});

test('older backups and invalid account balances reject before changing live state', () => {
  const saved = state(); saved.importedSource = 'Bluecoins_2026-10-06.fydb';
  const before = JSON.stringify(saved);
  assert.throws(() => prepare(saved, { ...summary(), sourceDate: '2026-10-01' }, now), /older/);
  assert.throws(() => prepare(saved, summary([], [account('1', 'Aeon', NaN)]), now), /Invalid source account/);
  assert.equal(JSON.stringify(saved), before);
});

test('new transfer changes both existing balances once; future rows do not change current balances', () => {
  const saved = state([], [account('1', 'Aeon', 100), account('2', 'Pot', 200)]);
  const incoming = summary([row('move', { type: 'transfer', toAccount: 'Pot', amount: 30 }), row('future', { date: '2026-10-20T09:00:00+08:00', amount: 50 })], saved.accounts);
  const first = prepare(saved, incoming, now).state;
  assert.deepEqual(Array.from(first.accounts, a => a.balance), [70, 230]);
  assert.deepEqual(Array.from(prepare(first, incoming, now).state.accounts, a => a.balance), [70, 230]);
});
test('local account rename/icon/current balance survive source rename and transfer references', () => {
  const saved = state([row('old', { account: 'My Aeon' })], [{ ...account('1', 'My Aeon', 1856.97), editedAt: now.toISOString() }]);
  const result = prepare(saved, summary([row('old', { sourceAccountId: '1' })]), now);
  assert.equal(result.state.accounts[0].name, 'My Aeon'); assert.equal(result.state.accounts[0].balance, 1856.97);
  assert.equal(result.state.entries[0].account, 'My Aeon'); assert.equal(result.state.accounts[0].icon, 'wallet');
});

function runtime() {
  const values = new Map();
  const harness = require('./helpers/redcoins-sql.cjs').sqliteHarness();
  const storage = { getItem: async key => values.get(key) || null, setItem: async (key, value) => values.set(key, value), multiSet: async pairs => { pairs.forEach(([key, value]) => values.set(key, value)); }, getAllKeys: async () => [...values.keys()] };
  const service = load('redcoins', { 'expo-sqlite': harness.expo, '@react-native-async-storage/async-storage': storage, 'expo-file-system/legacy': {}, 'expo-sharing': {}, './exportFile': {}, './redcoinsReminders': { materializeAutomaticReminders: () => [] }, './spendingGuards': { loadSpendingGuards: async () => [], syncPinnedGuardSnapshot: async () => {}, WIDGET_CASH_REALITY_KEY: 'cash' }, './redcoinsEvents': { emitRedCoinsChange: () => {} } });
  return { values, storage, service, recovery: key => harness.db.prepare('SELECT payload FROM rc_recovery WHERE key=?').get(key)?.payload };
}

test('bank review progress survives durable saves and reopening without touching balances or statuses', async () => {
  const { values, service } = runtime();
  const saved = state([row('reviewed')], [account('1', 'Aeon', 1856.97)]);
  saved.storageVersion = 2; saved.statusMappingVersion = 1;
  saved.bankReviews = { '1': { startDay: '2026-10-01', endDay: '2026-10-07', bankBalance: '1856.97', matched: { reviewed: 'signature' }, savedAt: '2026-10-07T10:00:00Z' } };
  await service.saveRedCoins(saved);
  const next = await service.loadRedCoins();
  assert.equal(JSON.stringify(next.bankReviews), JSON.stringify(saved.bankReviews));
  assert.equal(next.accounts[0].balance, 1856.97); assert.equal(next.entries[0].status, 'cleared');
  assert.equal(JSON.parse(await service.readSavedRedCoinsRaw()).bankReviews['1'].bankBalance, '1856.97');
});

test('backup replacement serializes writes, rejects stale ledger/preferences and preserves authoritative money', async () => {
  const { values, service } = runtime();
  const original = state([row('old')]); original.storageVersion = 2; original.statusMappingVersion = 1;
  await service.saveRedCoins(original);
  const raw = await service.readSavedRedCoinsRaw();
  const restored = { ...original, entries: [], accounts: [account('1', 'Aeon', 1856.97)] };
  values.set('finance-pref', 'changed');
  await assert.rejects(service.replaceRedCoinsFromBackup(restored, raw, { 'finance-pref': 'backup' }, { 'finance-pref': 'old' }), /settings changed/);
  assert.equal(await service.readSavedRedCoinsRaw(), raw);
  const edit = service.saveRedCoins({ ...original, monthlyBudget: 4000 });
  const stale = service.replaceRedCoinsFromBackup(restored, raw, {}, {});
  await edit; await assert.rejects(stale, /changed/);
  assert.equal(JSON.parse(await service.readSavedRedCoinsRaw()).monthlyBudget, 4000);
  await service.replaceRedCoinsFromBackup(restored, await service.readSavedRedCoinsRaw(), { 'finance-pref': 'backup' }, { 'finance-pref': 'changed' });
  assert.equal((await service.loadRedCoins()).accounts[0].balance, 1856.97);
  assert.equal((await service.loadRedCoins()).entries.length, 0); assert.equal(values.get('finance-pref'), 'backup');
});

test('status repair persists once with exact checkpoint, no FYDB reads and no balance replay', async () => {
  const { values, service, recovery } = runtime();
  const saved = state([row('old-pending', { status: 'pending' }), row('user-edited', { status: 'pending', editedAt: '2026-10-07' }), row('own-pending', { origin: 'redcoins', status: 'pending' })], [account('1', 'Aeon', 1856.97)]);
  saved.storageVersion = 2;
  const bytes = JSON.stringify(saved); values.set('redcoins_state_v1', bytes);
  const first = await service.loadRedCoins();
  assert.equal(first.entries[0].status, 'none'); assert.equal(first.entries[0].legacyStatusUnknown, true);
  assert.equal(first.entries[1].status, 'pending'); assert.equal(first.entries[2].status, 'pending');
  assert.equal(recovery('redcoins_pre_status_mapping_v1'), bytes);
  assert.equal(JSON.parse(await service.readSavedRedCoinsRaw()).statusMappingVersion, 1);
  for (let i = 0; i < 20; i++) assert.equal((await service.loadRedCoins()).accounts[0].balance, 1856.97);
  assert.equal(recovery('redcoins_pre_status_mapping_v1'), bytes);
});

test('complete legacy upgrade never writes ledger-sized recovery copies into AsyncStorage', async () => {
  const { values, storage, service, recovery } = runtime();
  const saved = state([row('old-pending', { status: 'pending' })], [account('1', 'Aeon', 1856.97)]);
  const bytes = JSON.stringify(saved);
  values.set('redcoins_state_v1', bytes);
  const originalSet = storage.setItem;
  storage.setItem = async (key, value) => {
    if (key.startsWith('redcoins_pre_')) throw new Error('database or disk is full (code 13 SQLITE_FULL)');
    return originalSet(key, value);
  };
  const loaded = await service.loadRedCoins();
  assert.equal(loaded.accounts[0].balance, 1856.97);
  assert.equal(loaded.entries[0].status, 'none');
  assert.equal(recovery('redcoins_pre_sqlite_v1'), bytes);
  assert.equal(recovery('redcoins_pre_authoritative_v1'), bytes);
  assert.equal(recovery('redcoins_pre_status_mapping_v1'), bytes);
  assert.equal(values.get('redcoins_state_v1'), bytes);
  assert.equal((await service.loadRedCoins()).accounts[0].balance, 1856.97);
});

test('explicit import recovers raw review metadata even when None label is unchanged, without replaying money', () => {
  const saved = state([row('old', { status: 'none', legacyStatusUnknown: true, statusMappingVersion: 1 })], [account('1', 'Aeon', 1856.97)]);
  const incoming = summary([row('old', { status: 'none', sourceStatus: 0, statusMappingVersion: 1 })]);
  const result = prepare(saved, incoming, now);
  assert.equal(result.state.entries[0].sourceStatus, 0);
  assert.equal(result.state.entries[0].legacyStatusUnknown, undefined);
  assert.equal(result.state.accounts[0].balance, 1856.97);
  incoming.redcoins.entries[0].sourceStatus = 2; incoming.redcoins.entries[0].status = 'reconciled';
  const next = prepare(result.state, incoming, now);
  assert.equal(next.state.entries[0].status, 'reconciled'); assert.equal(next.state.accounts[0].balance, 1856.97);
});

test('opening empty RedCoins does not permanently initialize an empty cash selection', async () => {
  const { values, service } = runtime();
  await service.getRedCoinsSummary(state([], []), now);
  assert.notEqual(values.get('bluecoins_cash_reality_accounts_initialised_v1'), 'true');
  const projected = await service.getRedCoinsSummary(state(), now);
  assert.equal(projected.cashReality.liquidBalance, 100);
});
test('one-time migration saves exact recovery backup and fifty opens preserve every balance/adjustment without FYDB access', async () => {
  const { values, service, recovery } = runtime();
  const saved = state([row('adjustment', { type: 'income', origin: 'redcoins', amount: 600 })], [account('1', 'Aeon', 1856.97)]);
  const bytes = JSON.stringify(saved); values.set('redcoins_state_v1', bytes);
  for (let i = 0; i < 50; i++) {
    const result = await service.loadRedCoins();
    assert.equal(result.accounts[0].balance, 1856.97); assert.equal(result.entries[0].amount, 600); assert.equal(result.storageVersion, 2);
    const projected = await service.getRedCoinsSummary(result, now); assert.equal(projected.cashReality.liquidBalance, 1856.97);
  }
  assert.equal(recovery('redcoins_pre_authoritative_v1'), bytes); assert.equal(values.get('bluecoins_auto_sync_v1'), 'false');
});
test('future imported transaction becomes due once without reopening or reading Bluecoins', async () => {
  const { values, service } = runtime();
  const saved = state([row('due', { amount: 20, balanceEffectApplied: false })]); saved.storageVersion = 2;
  values.set('redcoins_state_v1', JSON.stringify(saved));
  assert.equal((await service.loadRedCoins()).accounts[0].balance, 80);
  assert.equal((await service.loadRedCoins()).accounts[0].balance, 80);
});

test('migration does not replay an unflagged past imported row merely because its backup is older', async () => {
  const { values, service } = runtime();
  const saved = state([row('past', { balanceEffectApplied: undefined })]);
  saved.importedSource = 'Bluecoins_2026-09-29.fydb';
  values.set('redcoins_state_v1', JSON.stringify(saved));
  assert.equal((await service.loadRedCoins()).accounts[0].balance, 100);
  assert.equal((await service.loadRedCoins()).accounts[0].balance, 100);
});
test('cancelled preview does not write ledger; stale preview rejects a concurrently logged edit', async () => {
  const { values, storage, service } = runtime(); values.set('redcoins_state_v1', JSON.stringify(state([row('old')])));
  let reads = 0;
  const importer = load('redcoinsImport', { '@react-native-async-storage/async-storage': storage, './redcoins': service, './bluecoins': { readBluecoinsImport: async () => { reads++; return summary([row('old'), row('new')]); } }, './redcoinsLedger': { syncRedCoinsLedger: async () => {} } });
  const preview = await importer.stageRedCoinsImport();
  assert.equal((await service.loadRedCoins()).entries.length, 1); assert.equal(reads, 1);
  await service.saveRedCoins({ ...await service.loadRedCoins(), monthlyBudget: 3000 });
  await assert.rejects(importer.commitRedCoinsImport(preview), /changed/);
  assert.equal((await service.loadRedCoins()).monthlyBudget, 3000); assert.equal((await service.loadRedCoins()).entries.length, 1);
});
test('confirmed import saves recovery state and repeated confirm cannot apply same delta twice', async () => {
  const { values, storage, service } = runtime(); values.set('redcoins_state_v1', JSON.stringify(state([row('old')])));
  const importer = load('redcoinsImport', { '@react-native-async-storage/async-storage': storage, './redcoins': service, './bluecoins': { readBluecoinsImport: async () => summary([row('old'), row('new', { item: 'Lunch', amount: 20 })]) }, './redcoinsLedger': { syncRedCoinsLedger: async () => {} } });
  const preview = await importer.stageRedCoinsImport();
  await importer.commitRedCoinsImport(preview);
  assert.equal((await service.loadRedCoins()).accounts[0].balance, 80);
  assert.equal(JSON.parse(values.get('redcoins_before_import_v2')).accounts[0].balance, 100);
  await assert.rejects(importer.commitRedCoinsImport(preview), /changed/);
  assert.equal((await service.loadRedCoins()).accounts[0].balance, 80);
});

test('index failure after durable import returns a warning instead of pretending import failed', async () => {
  const { values, storage, service } = runtime(); values.set('redcoins_state_v1', JSON.stringify(state([row('old')])));
  const importer = load('redcoinsImport', { '@react-native-async-storage/async-storage': storage, './redcoins': service, './bluecoins': { readBluecoinsImport: async () => summary([row('old'), row('new', { item: 'Lunch', amount: 20 })]) }, './redcoinsLedger': { syncRedCoinsLedger: async () => { throw Error('index unavailable'); } } });
  const result = await importer.commitRedCoinsImport(await importer.stageRedCoinsImport());
  assert.equal((await service.loadRedCoins()).accounts[0].balance, 80);
  assert.equal(result.warnings.length, 1);
});
