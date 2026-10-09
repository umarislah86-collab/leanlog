const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const storage = new Map();
const asyncStorage = { getItem: async key => storage.get(key) || null, setItem: async (key, value) => storage.set(key, value), getAllKeys: async () => [...storage.keys()] };
function load(name, mocks = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../services', `${name}.ts`), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, { exports, Date, console, require: id => {
    if (id === './redcoinsSqlStore') { mocks['expo-sqlite'] ||= require('./helpers/redcoins-sql.cjs').sqliteHarness().expo; return load('redcoinsSqlStore', mocks); }
    if (id === './redcoinsSalaryFilter') return load('redcoinsSalaryFilter');
    if (id === './redcoinsStatus') return load('redcoinsStatus');
    if (id === './redcoinsSummary') return load('redcoinsSummary', { './redcoinsGuards': load('redcoinsGuards') });
    if (id === './redcoinsImportPlan') return load('redcoinsImportPlan', mocks);
    if (id === './redcoinsAccountIdentity') return identity;
    if (!(id in mocks)) throw new Error(`Unexpected ${id}`);
    return mocks[id];
  } });
  return exports;
}
const identity = load('redcoinsAccountIdentity', { '@react-native-async-storage/async-storage': asyncStorage });
const row = (id, extras = {}) => ({ id, item: 'Transfer to pot', amount: 1500, type: 'transfer', account: 'Aeon', toAccount: 'Old Pot', category: '(Transfer)', subcategory: '(Transfer)', date: '2026-09-29T12:22:13.783Z', origin: 'bluecoins', ...extras });
const account = (id, name, extras = {}) => ({ id, name, type: 'Bank', balance: 1856.54, ...extras });
const state = (accounts, entries = []) => ({ accounts, entries, categories: [], reminders: [], deletedEntries: [], deletedAccountNames: [], entryDefaults: {}, monthlyBudget: 2000 });
const incoming = [account('unused', 'Aeon', { sourceAccountId: '1' }), account('unused2', 'New Pot', { sourceAccountId: '42' })];
const imported = [row('bluecoins-1', { toAccount: 'New Pot', sourceAccountId: '1', sourceToAccountId: '42' })];

test('source ID rename preserves local ID/icon and rewrites ledger, schedules and defaults', () => {
  const original = state([account('local', 'Old Pot', { sourceAccountId: '42', icon: 'ribbon' })], [row('local-transfer', { origin: 'redcoins' })]);
  original.reminders = [{ id: 'r', template: row('template') }]; original.entryDefaults = { transfer: { account: 'Aeon', toAccount: 'Old Pot' } };
  const { state: next, aliases } = identity.reconcileAccountIdentity(original, incoming, imported);
  assert.equal(next.accounts.length, 1); assert.equal(next.accounts[0].name, 'New Pot'); assert.equal(next.accounts[0].id, 'local'); assert.equal(next.accounts[0].icon, 'ribbon');
  assert.equal(next.entries[0].toAccount, 'New Pot'); assert.equal(next.reminders[0].template.toAccount, 'New Pot'); assert.equal(next.entryDefaults.transfer.toAccount, 'New Pot');
  assert.equal(aliases['old pot'], 'New Pot'); assert.equal(original.accounts[0].name, 'Old Pot');
});
test('legacy duplicate is merged only with unchanged imported transaction-ID evidence', () => {
  const original = state([account('older', 'Old Pot', { icon: 'ribbon' }), account('duplicate', 'New Pot')], [row('bluecoins-1')]);
  const result = identity.reconcileAccountIdentity(original, incoming, imported);
  assert.equal(result.state.accounts.length, 1); assert.equal(result.state.accounts[0].id, 'older'); assert.equal(result.state.accounts[0].sourceAccountId, '42'); assert.equal(result.redirects.duplicate, 'older');
});
test('similar names or equal balances are not sufficient to merge accounts', () => {
  const result = identity.reconcileAccountIdentity(state([account('old', 'Old Pot'), account('custom', 'Pot aeon')]), incoming, []);
  assert.equal(result.state.accounts.length, 2); assert.equal(Object.keys(result.aliases).length, 0);
});
test('manual replacement account on edited imported row is never inferred as its Bluecoins source', () => {
  const result = identity.reconcileAccountIdentity(state([account('custom', 'Pot aeon')], [row('bluecoins-1', { toAccount: 'Pot aeon', editedAt: '2026-10-03' })]), incoming, imported);
  assert.equal(result.state.accounts[0].name, 'Pot aeon'); assert.equal(result.state.accounts[0].sourceAccountId, undefined);
  assert.equal(result.state.entries[0].toAccount, 'Pot aeon');
});
test('conflicting legacy transaction evidence refuses an inferred rename', () => {
  const result = identity.reconcileAccountIdentity(state([account('old', 'Old Pot')], [row('bluecoins-1'), row('bluecoins-2')]), [...incoming, account('unused3', 'Other Pot', { sourceAccountId: '43' })], [...imported, row('bluecoins-2', { toAccount: 'Other Pot', sourceToAccountId: '43' })]);
  assert.equal(result.state.accounts[0].name, 'Old Pot'); assert.equal(result.state.accounts[0].sourceAccountId, undefined);
});
test('deleted source ID stays blocked across later renames', () => {
  const original = state([], [row('bluecoins-1')]); original.deletedAccountNames = ['Old Pot'];
  const next = identity.reconcileAccountIdentity(original, incoming, imported).state;
  assert.equal(JSON.stringify(next.deletedSourceAccountIds), '["42"]');
  assert.equal(JSON.stringify(identity.reconcileAccountIdentity(next, [account('x', 'Another Name', { sourceAccountId: '42' })], []).state.deletedSourceAccountIds), '["42"]');
});
test('migration preserves Cash Reality, guard IDs and both widget selection styles', async () => {
  storage.clear();
  storage.set('bluecoins_cash_reality_accounts_v1', '["Old Pot","Aeon"]');
  storage.set('bluecoins_spending_guards_v1', JSON.stringify([{ id: 'g', scope: 'account', name: 'Old Pot', target: 'Old Pot' }, { id: 'custom', scope: 'account', name: 'My guard', target: 'Old Pot' }, { id: 'category', scope: 'category', name: 'Old Pot', target: 'Old Pot' }]));
  storage.set('widget_daily_preferences_1', '{"mode":"accounts","accountIds":["duplicate","older"]}'); storage.set('widget_account_snapshot_2', 'Old Pot');
  await identity.migrateAccountPreferences({ 'old pot': 'New Pot' }, { duplicate: 'older' });
  assert.equal(storage.get('bluecoins_cash_reality_accounts_v1'), '["New Pot","Aeon"]'); assert.equal(storage.get('widget_account_snapshot_2'), 'New Pot');
  assert.equal(JSON.parse(storage.get('widget_daily_preferences_1')).accountIds.length, 1);
  const guards = JSON.parse(storage.get('bluecoins_spending_guards_v1')); assert.equal(guards[0].id, 'g'); assert.equal(guards[0].target, 'New Pot'); assert.equal(guards[1].name, 'My guard'); assert.equal(guards[2].target, 'Old Pot');
});
const service = load('redcoins', {
  '@react-native-async-storage/async-storage': asyncStorage, 'expo-file-system/legacy': {}, 'expo-sharing': {}, './exportFile': {},
  './redcoinsReminders': { materializeAutomaticReminders: () => [] }, './spendingGuards': {}, './redcoinsEvents': { emitRedCoinsChange: () => {} }, './redcoinsGuards': {},
});
test('custom replacement balance stays 6358.38 across repeated sync instead of replaying 1800.47', async () => {
  storage.clear();
  const originalImport = row('bluecoins-1', { toAccount: 'Saving POT ' });
  const saved = state([account('a', 'Aeon', { balance: 100 }), account('p', 'Pot aeon', { balance: 6358.38 })], [
    { ...originalImport, toAccount: 'Pot aeon', editedAt: '2026-10-03' },
    row('local-transfer', { origin: 'redcoins', toAccount: 'Pot aeon', amount: 300, balanceEffectApplied: true }),
    row('local-income', { origin: 'redcoins', type: 'income', account: 'Pot aeon', toAccount: undefined, amount: 0.47, balanceEffectApplied: true }),
  ]);
  saved.deletedAccountNames = ['Saving POT '];
  await service.saveRedCoins(saved);
  const summary = { sourceDate: '2026-10-06', redcoins: { accounts: [{ name: 'Aeon', sourceAccountId: '1', type: 'Bank', balance: 100 }, { name: 'Saving POT ', sourceAccountId: '42', type: 'Bank', balance: 1856.54 }], categories: [], entries: [{ ...originalImport, sourceAccountId: '1', sourceToAccountId: '42' }] }, monthly: { budget: 2000, payday: 25 }, cashReality: { safetyBuffer: 0 } };
  for (let i = 0; i < 3; i++) {
    const refreshed = await service.importRedCoins(summary);
    assert.equal(refreshed.accounts.find(a => a.name === 'Pot aeon').balance, 6358.38);
    assert.equal(refreshed.accounts.some(a => a.name === 'Saving POT '), false);
  }
});
test('imported rename repeated sync yields one account and keeps current balance and local ID', async () => {
  storage.clear();
  await service.saveRedCoins(state([account('old-id', 'Old Pot', { sourceAccountId: '42', icon: 'ribbon' })], [row('bluecoins-1')]));
  const summary = { sourceDate: '2026-10-06', redcoins: { accounts: incoming, categories: [], entries: imported }, monthly: { budget: 2000, payday: 25 }, cashReality: { safetyBuffer: 0 } };
  for (let i = 0; i < 3; i++) {
    const refreshed = await service.importRedCoins(summary);
    assert.equal(refreshed.accounts.filter(a => /Pot/.test(a.name)).length, 1);
    assert.equal(refreshed.accounts.find(a => a.sourceAccountId === '42').id, 'old-id');
  }
});

test('matched RM300 transfer to a custom replacement survives ten cached replays without losing credit', async () => {
  storage.clear();
  const imported1500 = row('bluecoins-1500', { toAccount: 'Saving POT ', sourceAccountId: '1', sourceToAccountId: '42' });
  const imported300 = row('bluecoins-300', { item: 'Ke savings pot', amount: 300, toAccount: 'Saving POT ', sourceAccountId: '1', sourceToAccountId: '42' });
  const saved = state([account('a', 'Aeon', { balance: 100, sourceAccountId: '1' }), account('p', 'Pot aeon', { balance: 1856.97 })], [
    { ...imported1500, toAccount: 'Pot aeon', editedAt: '2026-10-03', balanceEffectApplied: true },
    { ...imported300, id: 'local-300', origin: 'redcoins', toAccount: 'Pot aeon', reconciledImportId: imported300.id, balanceEffectApplied: true },
    row('dividend', { origin: 'redcoins', type: 'income', account: 'Pot aeon', toAccount: undefined, amount: 0.47, balanceEffectApplied: true }),
    row('adjustment', { origin: 'redcoins', type: 'income', account: 'Pot aeon', toAccount: undefined, amount: 600, date: '2024-05-19T02:01:00Z', balanceEffectApplied: true }),
  ]);
  saved.deletedAccountNames = ['Saving POT '];
  await service.saveRedCoins(saved);
  const summary = { sourceDate: '2026-10-06', redcoins: { accounts: [account('a', 'Aeon', { balance: 100, sourceAccountId: '1' }), account('old', 'Saving POT ', { sourceAccountId: '42' })], categories: [], entries: [imported1500, imported300] }, monthly: { budget: 2000, payday: 25 }, cashReality: { safetyBuffer: 0 } };
  for (let i = 0; i < 10; i++) {
    const refreshed = await service.importRedCoins(summary);
    assert.equal(refreshed.accounts.find(a => a.name === 'Pot aeon').balance, 1856.97);
    assert.equal(refreshed.accounts.find(a => a.name === 'Aeon').balance, 100, 'matched transfer must not debit the source twice');
    assert.equal(refreshed.entries.filter(e => e.item === 'Ke savings pot').length, 1);
    assert.equal(refreshed.entries.find(e => e.id === 'adjustment').amount, 600, 'do not silently remove user adjustments');
    assert.equal((await service.loadRedCoins()).accounts.find(a => a.name === 'Pot aeon').balance, 1856.97);
  }
});

test('matched transfer reroutes a surviving imported destination to custom account without double debit', async () => {
  storage.clear();
  const importedTransfer = row('bluecoins-300', { amount: 300, sourceAccountId: '1', sourceToAccountId: '42' });
  await service.saveRedCoins(state([
    account('a', 'Aeon', { balance: 100, sourceAccountId: '1' }),
    account('old', 'Old Pot', { balance: 50, sourceAccountId: '42' }),
    account('custom', 'Custom Pot', { balance: 350 }),
  ], [{ ...importedTransfer, id: 'local-300', origin: 'redcoins', toAccount: 'Custom Pot', balanceEffectApplied: true }]));
  const summary = { sourceDate: '2026-10-06', redcoins: { accounts: [account('a', 'Aeon', { balance: 100, sourceAccountId: '1' }), account('old', 'Old Pot', { balance: 350, sourceAccountId: '42' })], categories: [], entries: [importedTransfer] }, monthly: { budget: 2000, payday: 25 }, cashReality: { safetyBuffer: 0 } };
  for (let i = 0; i < 3; i++) {
    const next = await service.importRedCoins(summary);
    assert.equal(next.accounts.find(a => a.name === 'Aeon').balance, 100);
    assert.equal(next.accounts.find(a => a.name === 'Old Pot').balance, 50);
    assert.equal(next.accounts.find(a => a.name === 'Custom Pot').balance, 350);
    assert.equal(next.entries.length, 1);
  }
});

test('matched unchanged transfer leaves both imported balances unchanged on repeated refresh', async () => {
  storage.clear();
  const importedTransfer = row('bluecoins-300', { amount: 300, sourceAccountId: '1', sourceToAccountId: '42' });
  const accounts = [account('a', 'Aeon', { balance: 100, sourceAccountId: '1' }), account('p', 'Old Pot', { balance: 350, sourceAccountId: '42' })];
  await service.saveRedCoins(state(accounts, [{ ...importedTransfer, id: 'local-300', origin: 'redcoins', balanceEffectApplied: true }]));
  const summary = { sourceDate: '2026-10-06', redcoins: { accounts, categories: [], entries: [importedTransfer] }, monthly: { budget: 2000, payday: 25 }, cashReality: { safetyBuffer: 0 } };
  for (let i = 0; i < 3; i++) {
    const next = await service.importRedCoins(summary);
    assert.equal(next.accounts.find(a => a.name === 'Aeon').balance, 100);
    assert.equal(next.accounts.find(a => a.name === 'Old Pot').balance, 350);
  }
});

test('custom opening balance replays active imported rows but excludes future local transfers', async () => {
  storage.clear();
  const importedTransfer = row('bluecoins-300', { amount: 300, toAccount: 'Custom Pot' });
  await service.saveRedCoins(state([account('a', 'Aeon', { balance: 100 }), account('p', 'Custom Pot', { balance: 350 })], [
    importedTransfer,
    row('future', { origin: 'redcoins', toAccount: 'Custom Pot', amount: 200, date: '2099-01-01T00:00:00Z', balanceEffectApplied: false }),
  ]));
  const summary = { sourceDate: '2026-10-06', redcoins: { accounts: [account('a', 'Aeon', { balance: 100 })], categories: [], entries: [importedTransfer] }, monthly: { budget: 2000, payday: 25 }, cashReality: { safetyBuffer: 0 } };
  for (let i = 0; i < 3; i++) {
    const next = await service.importRedCoins(summary);
    assert.equal(next.accounts.find(a => a.name === 'Custom Pot').balance, 350);
    assert.equal(next.accounts.find(a => a.name === 'Aeon').balance, 100);
    assert.equal(next.entries.find(e => e.id === 'future').balanceEffectApplied, false);
  }
});
