const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(name, mocks = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(`services/${name}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, { exports, Date, console, setTimeout, clearTimeout, require: id => { if (!(id in mocks)) throw Error(`Unexpected module ${id}`); return mocks[id]; } });
  return exports;
}
const format = load('redcoinsBackupFormat');
const entry = { id: 'e', type: 'expense', item: 'Dinner', amount: 12, account: 'Bank', category: 'Food', subcategory: 'Dining', date: '2026-10-01T08:00:00Z', status: 'none', balanceEffectApplied: true };
const state = () => ({ storageVersion: 2, statusMappingVersion: 1, accounts: [{ id: 'a', name: 'Bank', type: 'Bank', balance: 1856.97, icon: 'wallet' }], entries: [{ ...entry }], categories: [{ id: 'c', name: 'Food', subcategories: ['Dining'], icon: 'restaurant' }], reminders: [], deletedEntries: [], payday: 25, monthlyBudget: 2500, safetyBuffer: 50, createdAt: '2026-01-01T00:00:00Z', subcategoryBudgets: { Food: 200 }, favoriteAccountIds: ['a'], bankReviews: { a: { startDay: '2026-10-01', endDay: '2026-10-07', bankBalance: '1856.97', matched: {}, savedAt: '2026-10-07T00:00:00Z' } } });
const backup = () => ({ format: 'redcoins-backup', version: 1, exportedAt: '2026-10-07T00:00:00Z', state: state() });
test('old v1 and enriched backup preserve accounts, money, metadata, review progress and favorites', () => {
  const input = backup(), original = JSON.stringify(input);
  const parsed = format.parseRedCoinsBackup(original);
  assert.equal(JSON.stringify(parsed), original); assert.equal(parsed.state.accounts[0].balance, 1856.97);
  input.preferences = { bluecoins_cash_reality_accounts_v1: '["Bank"]', bluecoins_spending_guards_v1: '[]' };
  assert.equal(format.parseRedCoinsBackup(JSON.stringify(input)).preferences.bluecoins_cash_reality_accounts_v1, '["Bank"]');
});
test('rejects malformed/foreign/unsupported/duplicate/nonfinite or unsafe backups before any write', () => {
  for (const mutate of [b => b.version = 99, b => b.format = 'other', b => b.state.accounts.push(b.state.accounts[0]), b => b.state.entries[0].amount = -1, b => b.state.entries[0].date = 'bad', b => b.state.accounts[0].balance = null, b => b.preferences = { firebase_token: 'secret' }, b => b.state.subcategoryBudgets = { x: 'bad' }]) {
    const input = backup(); mutate(input);
    assert.throws(() => format.parseRedCoinsBackup(JSON.stringify(input)));
  }
  assert.throws(() => format.parseRedCoinsBackup('oops'));
  assert.throws(() => format.parseRedCoinsBackup(JSON.stringify(backup()).replace('"state":{', '"state":{"__proto__":{},')));
});
function runtime() {
  const values = new Map([['redcoins_state_v1', JSON.stringify(state())]]), files = new Map();
  let failWrites = false, writes = 0;
  const storage = { getItem: async key => values.get(key) ?? null, setItem: async (key, value) => values.set(key, value) };
  const filesystem = { documentDirectory: 'file://documents/', StorageAccessFramework: { requestDirectoryPermissionsAsync: async () => ({ granted: true, directoryUri: 'content://folder' }), createFileAsync: async (folder, name) => `${folder}/${name}` }, writeAsStringAsync: async (uri, contents) => { if (failWrites) throw Error('Permission revoked'); files.set(uri, contents); writes++; }, readAsStringAsync: async uri => files.get(uri) };
  const fileApi = load('redcoinsBackupFiles', { '@react-native-async-storage/async-storage': storage, 'expo-file-system/legacy': filesystem, 'react-native': { Platform: { OS: 'android' }, AppState: {} }, './redcoins': { flushRedCoinsWrites: async () => {} }, './redcoinsEvents': { subscribeRedCoinsChanges: () => () => {} }, './redcoinsBackupFormat': format });
  return { values, files, storage, filesystem, fileApi, fail: () => { failWrites = true; }, writes: () => writes };
}
test('folder backups read back valid JSON, never overwrite history, deduplicate unchanged autos and record failures', async () => {
  const env = runtime(); const { fileApi, files } = env;
  await fileApi.configureBackupFolder({ folderUri: 'content://folder', automatic: true, frequency: 'changes' });
  assert(await fileApi.backupRedCoinsToFolder()); assert.equal(files.size, 1);
  assert.equal(await fileApi.backupRedCoinsToFolder(), null);
  assert(await fileApi.backupRedCoinsToFolder(true)); assert.equal(files.size, 2);
  for (const contents of files.values()) assert.equal(format.parseRedCoinsBackup(contents).state.accounts[0].balance, 1856.97);
  env.fail(); await assert.rejects(fileApi.backupRedCoinsToFolder(true), /revoked/);
  assert.equal(files.size, 2); assert.match((await fileApi.getBackupFolderConfig()).error, /revoked/);
});
test('disabled auto, no folder and daily limit do not silently write files', async () => {
  const { fileApi, writes } = runtime();
  assert.equal(await fileApi.backupRedCoinsToFolder(), null);
  await assert.rejects(fileApi.backupRedCoinsToFolder(true), /folder/);
  await fileApi.configureBackupFolder({ folderUri: 'content://folder', automatic: false, frequency: 'changes' });
  assert.equal(await fileApi.backupRedCoinsToFolder(), null);
  await fileApi.configureBackupFolder({ folderUri: 'content://folder', automatic: true, frequency: 'daily', lastSavedAt: new Date().toISOString() });
  assert.equal(await fileApi.backupRedCoinsToFolder(), null); assert.equal(writes(), 0);
});
test('capture whitelists financial settings, never device permission URLs or auth/cache', async () => {
  const env = runtime();
  env.values.set('bluecoins_cash_reality_accounts_v1', '["Bank"]'); env.values.set('bluecoins_folder_uri_v1', 'private-uri'); env.values.set('firebase_token', 'secret');
  const captured = await env.fileApi.captureRedCoinsBackup();
  assert.equal(captured.preferences.bluecoins_cash_reality_accounts_v1, '["Bank"]');
  assert.equal(JSON.stringify(captured).includes('private-uri'), false); assert.equal(JSON.stringify(captured).includes('secret'), false);
});
test('restore creates recoverable checkpoint, replaces not merges, and treats post-commit refresh failure as warning', async () => {
  const env = runtime(); let refreshFails = false;
  const service = { loadRedCoins: async () => JSON.parse(env.values.get('redcoins_state_v1')), replaceRedCoinsFromBackup: async (next, expected, preferences) => { assert.equal(env.values.get('redcoins_state_v1'), expected); env.values.set('redcoins_state_v1', JSON.stringify(next)); for (const [key, value] of Object.entries(preferences)) env.values.set(key, value); }, getRedCoinsSummary: async () => {} };
  const restore = load('redcoinsBackupRestore', { '@react-native-async-storage/async-storage': env.storage, 'expo-file-system/legacy': env.filesystem, './redcoins': service, './redcoinsLedger': { syncRedCoinsLedger: async () => { if (refreshFails) throw Error('index fail'); } }, './redcoinsReminders': { syncReminderNotifications: async () => {} }, './redcoinsBackupFormat': format, './redcoinsBackupFiles': env.fileApi, './widget': { refreshLeanLogWidget: async () => {} } });
  const incoming = backup(); incoming.state.entries = []; incoming.state.accounts[0].balance = 42;
  const preview = await restore.stageRedCoinsBackup(JSON.stringify(incoming), 'backup.json');
  assert.equal(env.values.get('redcoins_state_v1'), preview.original);
  refreshFails = true; const result = await restore.commitRedCoinsBackup(preview);
  assert.equal(JSON.parse(env.values.get('redcoins_state_v1')).entries.length, 0);
  assert.equal(JSON.parse(env.values.get('redcoins_state_v1')).accounts[0].balance, 42);
  assert.equal(format.parseRedCoinsBackup(env.values.get('redcoins_before_json_restore_v1')).state.accounts[0].balance, 1856.97);
  assert.equal((await restore.stageRecoveryBackup()).backup.state.accounts[0].balance, 1856.97);
  assert(result.warnings.some(w => w.includes('index')));
  const stale = await restore.stageRedCoinsBackup(JSON.stringify(incoming), 'backup.json');
  env.values.set('redcoins_state_v1', JSON.stringify(state()));
  await assert.rejects(restore.commitRedCoinsBackup(stale), /changed/);
  assert.equal(JSON.parse(env.values.get('redcoins_state_v1')).accounts[0].balance, 1856.97);
});

test('failed safety-file write aborts restore before replacing the ledger', async () => {
  const env = runtime(); let replacements = 0;
  const restore = load('redcoinsBackupRestore', { '@react-native-async-storage/async-storage': env.storage, 'expo-file-system/legacy': env.filesystem,
    './redcoins': { loadRedCoins: async () => JSON.parse(env.values.get('redcoins_state_v1')), replaceRedCoinsFromBackup: async () => { replacements++; }, getRedCoinsSummary: async () => {} },
    './redcoinsLedger': { syncRedCoinsLedger: async () => {} }, './redcoinsReminders': { syncReminderNotifications: async () => {} }, './redcoinsBackupFormat': format, './redcoinsBackupFiles': env.fileApi, './widget': { refreshLeanLogWidget: async () => {} } });
  const original = env.values.get('redcoins_state_v1');
  const preview = await restore.stageRedCoinsBackup(JSON.stringify(backup()), 'backup.json');
  env.fail(); await assert.rejects(restore.commitRedCoinsBackup(preview), /revoked/);
  assert.equal(replacements, 0); assert.equal(env.values.get('redcoins_state_v1'), original);
});
