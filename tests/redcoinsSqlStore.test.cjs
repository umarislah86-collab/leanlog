const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { sqliteHarness } = require('./helpers/redcoins-sql.cjs');
const compiled = ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../services/redcoinsSqlStore.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
const fixture = () => ({ storageVersion: 2, statusMappingVersion: 1, monthlyBudget: 2000, safetyBuffer: 50, payday: 25, entries: [{ id: 'old', type: 'expense', item: 'Grocery', amount: 10, date: '2026-10-01T12:00:00', account: 'Bank', category: 'Food', subcategory: 'Grocery', status: 'none' }], accounts: [{ id: 'bank', name: 'Bank', balance: 1856.97 }, { id: 'cash', name: 'Cash', balance: 18.05 }], categories: [], reminders: [], deletedEntries: [] });
function runtime(harness = sqliteHarness(), values = new Map()) {
  let prefError = false;
  const storage = { getItem: async key => values.get(key) ?? null, setItem: async (key, value) => values.set(key, value), multiSet: async pairs => { if (prefError) throw new Error('native preference failure'); pairs.forEach(([key, value]) => values.set(key, value)); } };
  const api = {};
  vm.runInNewContext(compiled, { exports: api, console: { warn() {} }, require: id => id === 'expo-sqlite' ? harness.expo : storage });
  return { api, harness, values, failPreferences: value => { prefError = value; } };
}
test('one-time migration preserves exact saved balances/order and immutable JSON recovery', async () => {
  const raw = JSON.stringify(fixture());
  const r = runtime(undefined, new Map([['redcoins_state_v1', raw]]));
  const migrated = await r.api.readRedCoinsSql();
  assert.equal(JSON.stringify(migrated), raw);
  assert.equal(r.values.get('redcoins_pre_sqlite_v1'), raw);
  migrated.accounts[0].balance = 1556.97;
  await r.api.writeRedCoinsSql(migrated);
  r.values.set('redcoins_state_v1', JSON.stringify({ ...fixture(), monthlyBudget: 999 }));
  const restarted = runtime(r.harness, r.values);
  assert.equal((await restarted.api.readRedCoinsSql()).accounts[0].balance, 1556.97);
  assert.equal((await restarted.api.readRedCoinsSql()).monthlyBudget, 2000);
  assert.equal(r.values.get('redcoins_pre_sqlite_v1'), raw);
});
test('upgrade from before reminders preserves transactions, balances and original recovery JSON', async () => {
  const legacy = fixture();
  delete legacy.reminders;
  const raw = JSON.stringify(legacy);
  const r = runtime(undefined, new Map([['redcoins_state_v1', raw]]));
  const migrated = await r.api.readRedCoinsSql();
  assert.equal(JSON.stringify(migrated), JSON.stringify({ ...legacy, reminders: [] }));
  assert.equal(r.values.get('redcoins_state_v1'), raw);
  assert.equal(r.values.get('redcoins_pre_sqlite_v1'), raw);
  const restarted = runtime(r.harness, r.values);
  assert.deepEqual(JSON.parse(JSON.stringify(await restarted.api.readRedCoinsSql())), JSON.parse(JSON.stringify(migrated)));
});

test('malformed existing reminders still reject migration without replacing legacy data', async () => {
  for (const reminders of [null, {}, 'invalid']) {
    const raw = JSON.stringify({ ...fixture(), reminders });
    const r = runtime(undefined, new Map([['redcoins_state_v1', raw]]));
    await assert.rejects(r.api.readRedCoinsSql(), /snapshot is invalid/);
    assert.equal(r.values.get('redcoins_state_v1'), raw);
    assert.equal(r.harness.db.prepare('SELECT count(*) n FROM rc_records').get().n, 0);
  }
});

test('read-only audit returns legacy snapshot without financial migration', async () => {
  const r = runtime(undefined, new Map([['redcoins_state_v1', JSON.stringify(fixture())]]));
  assert.equal((await r.api.readRedCoinsSql(false)).accounts[0].balance, 1856.97);
  assert.equal(r.harness.db.prepare('SELECT count(*) n FROM rc_records').get().n, 0);
  assert.equal(r.values.has('redcoins_pre_sqlite_v1'), false);
});
test('failed migration rolls back all SQL rows and leaves legacy/checkpoint intact', async () => {
  const raw = JSON.stringify(fixture());
  const r = runtime(undefined, new Map([['redcoins_state_v1', raw]]));
  r.harness.fail((sql, args) => { if (sql.includes('rc_records') && args[0] === 'accounts') throw new Error('disk full'); });
  await assert.rejects(r.api.readRedCoinsSql(), /disk full/);
  assert.equal(r.harness.db.prepare('SELECT count(*) n FROM rc_records').get().n, 0);
  assert.equal(r.values.get('redcoins_state_v1'), raw);
  assert.equal(r.values.get('redcoins_pre_sqlite_v1'), raw);
  r.harness.fail(null);
  assert.equal((await r.api.readRedCoinsSql()).accounts[0].balance, 1856.97);
});
test('transaction insert and both transfer balances roll back together on write failure', async () => {
  const r = runtime(); await r.api.writeRedCoinsSql(fixture());
  const before = await r.api.readRedCoinsSql();
  const next = r.api.cloneRedCoinsState(before);
  next.entries.unshift({ ...next.entries[0], id: 'transfer', type: 'transfer', amount: 300, toAccount: 'Cash' });
  next.accounts[0].balance -= 300; next.accounts[1].balance += 300;
  r.harness.fail((sql, args) => { if (sql.includes('rc_records') && args[1] === 'cash') throw new Error('disk full'); });
  await assert.rejects(r.api.writeRedCoinsSql(next, { entryIds: ['transfer'] }), /disk full/);
  assert.equal(JSON.stringify(await r.api.readRedCoinsSql()), JSON.stringify(before));
  assert.equal(r.harness.db.prepare("SELECT count(*) n FROM redcoins_entries WHERE id='transfer'").get().n, 0);
  r.harness.fail(null); await r.api.writeRedCoinsSql(next, { entryIds: ['transfer'] });
  assert.equal((await r.api.readRedCoinsSql()).accounts[1].balance, 318.05);
});
test('prepend writes only new entry and changed account; live ledger reflects status edits/deletes', async () => {
  const r = runtime(); const state = fixture();
  state.entries = Array.from({ length: 1000 }, (_, i) => ({ ...state.entries[0], id: `entry${i}` }));
  await r.api.writeRedCoinsSql(state);
  const next = await r.api.readRedCoinsSql();
  r.harness.writes.length = 0;
  next.entries.unshift({ ...next.entries[0], id: 'new' }); next.accounts[0].balance -= 10;
  await r.api.writeRedCoinsSql(next, { entryIds: ['new'] });
  const writes = r.harness.writes.filter(row => row.sql.includes('INSERT OR REPLACE INTO rc_records'));
  assert.equal(writes.length, 2);
  const edit = await r.api.readRedCoinsSql(); edit.entries[0].status = 'cleared';
  await r.api.writeRedCoinsSql(edit, { entryIds: ['new'] });
  assert.equal(r.harness.db.prepare("SELECT status FROM redcoins_entries WHERE id='new'").get().status, 'cleared');
  const deletion = await r.api.readRedCoinsSql(); deletion.entries.shift();
  await r.api.writeRedCoinsSql(deletion);
  assert.equal(r.harness.db.prepare("SELECT count(*) n FROM redcoins_entries WHERE id='new'").get().n, 0);
});
test('stale snapshot rejected and independent runtime refreshes its revision cache', async () => {
  const r = runtime(); await r.api.writeRedCoinsSql(fixture());
  const stale = await r.api.readRedCoinsSql();
  const other = runtime(r.harness, r.values); const fresh = await other.api.readRedCoinsSql();
  fresh.monthlyBudget = 900; await other.api.writeRedCoinsSql(fresh);
  stale.monthlyBudget = 500;
  await assert.rejects(r.api.writeRedCoinsSql(stale), /changed during this edit/);
  assert.equal((await r.api.readRedCoinsSql()).monthlyBudget, 900);
});
test('restore compare-and-replace accepts canonical snapshot and journals failed preference mirroring', async () => {
  const r = runtime(); await r.api.writeRedCoinsSql(fixture());
  const current = await r.api.readRedCoinsSql(); const expected = JSON.stringify(current);
  const restored = fixture(); restored.accounts[0].balance = 42;
  r.failPreferences(true);
  await r.api.writeRedCoinsSql(restored, { expectedRaw: expected, preferences: { selected: 'Bank' } });
  assert.equal((await r.api.readRedCoinsSql(false)).accounts[0].balance, 42);
  assert.ok(r.harness.db.prepare("SELECT value FROM rc_meta WHERE key='pendingPreferences'").get());
  r.failPreferences(false); await r.api.readRedCoinsSql();
  assert.equal(r.values.get('selected'), 'Bank');
  assert.equal(r.harness.db.prepare("SELECT value FROM rc_meta WHERE key='pendingPreferences'").get(), undefined);
  await assert.rejects(r.api.writeRedCoinsSql(fixture(), { expectedRaw: expected }), /preview was open/);
});
test('invalid duplicate IDs cannot initialize or partially overwrite SQL', async () => {
  const r = runtime(); const bad = fixture(); bad.accounts.push({ ...bad.accounts[0] });
  await assert.rejects(r.api.writeRedCoinsSql(bad), /duplicate accounts ID/);
  assert.equal(r.harness.db.prepare('SELECT count(*) n FROM rc_records').get().n, 0);
});
test('missing SQL revision fails closed; never falls back to legacy JSON or overwrites balances', async () => {
  const r = runtime(undefined, new Map([['redcoins_state_v1', JSON.stringify(fixture())]]));
  await r.api.readRedCoinsSql();
  r.harness.db.prepare("DELETE FROM rc_meta WHERE key='revision'").run();
  await assert.rejects(r.api.readRedCoinsSql(), /revision is missing/);
  await assert.rejects(r.api.readRedCoinsSql(false), /revision is missing/);
  await assert.rejects(r.api.writeRedCoinsSql(fixture()), /revision is invalid/);
  assert.equal(JSON.parse(r.harness.db.prepare("SELECT payload FROM rc_records WHERE kind='accounts' AND id='bank'").get().payload).balance, 1856.97);
});
test('real ledger queries and totals use authoritative rows immediately after Save', async () => {
  const r = runtime(); const state = fixture();
  state.entries.push({ ...state.entries[0], id: 'transfer', item: 'Savings', type: 'transfer', amount: 300, toAccount: 'Cash', labels: ['test'] });
  await r.api.writeRedCoinsSql(state);
  const ledger = {};
  const source = fs.readFileSync(require('node:path').join(__dirname, '../services/redcoinsLedger.ts'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: ledger, require: () => r.api });
  const query = { search: 'grocery', types: ['expense'], accounts: [], categories: [], subcategories: [], startDay: '2026-10-01', endDay: '2026-10-31', limit: 100 };
  const result = await ledger.queryRedCoinsLedger(query);
  assert.equal(result.total, 1); assert.equal(result.entries[0].id, 'old');
  const transfer = await ledger.queryRedCoinsLedger({ ...query, search: '', types: ['transfer'], accounts: ['Cash'] });
  assert.equal(transfer.total, 1); assert.equal(transfer.entries[0].labels[0], 'test');
});
