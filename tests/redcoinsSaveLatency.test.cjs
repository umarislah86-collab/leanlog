const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');
function load(name, globals = {}, mocks = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../services', name + '.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, { exports, console, Date, setTimeout, clearTimeout, ...globals, require: id => mocks[id] || {} });
  return exports;
}
const fixture = () => ({ storageVersion: 2, statusMappingVersion: 1, entries: [], accounts: [], categories: [], reminders: [], deletedEntries: [], monthlyBudget: 2000, payday: 25, safetyBuffer: 50 });
function runtime(storage, events = () => {}) {
  let committed = null;
  const counts = { parse: 0, stringify: 0 };
  const countingJSON = {
    parse: (...args) => { counts.parse++; return JSON.parse(...args); },
    stringify: (...args) => { counts.stringify++; return JSON.stringify(...args); },
  };
  const service = load('redcoins', { JSON: countingJSON }, {
    '@react-native-async-storage/async-storage': storage,
    './redcoinsReminders': { materializeAutomaticReminders: () => [] },
    './redcoinsStatus': { repairLegacyBluecoinsStatuses: () => false },
    './redcoinsEvents': { emitRedCoinsChange: events },
    './redcoinsSqlStore': {
      cloneRedCoinsState: value => structuredClone(value), markRedCoinsRevision: () => {},
      readRedCoinsSql: async () => committed ? structuredClone(committed) : JSON.parse(await storage.getItem('redcoins_state_v1')),
      writeRedCoinsSql: async next => { await storage.setItem('SQL-test', JSON.stringify(next)); committed = structuredClone(next); return 1; },
    },
  });
  return { service, counts };
}
test('service loads isolated SQL snapshots without serializing the entire ledger', async () => {
  const raw = JSON.stringify(fixture());
  const { service, counts } = runtime({ getItem: async () => raw, setItem: async () => assert.fail('unchanged load must not write') });
  const state = await service.loadRedCoins();
  state.monthlyBudget = 999;
  assert.equal((await service.loadRedCoins()).monthlyBudget, 2000);
  assert.equal(counts.parse, 0);
  assert.equal(counts.stringify, 0);
});
test('save isolates the pending SQL snapshot and notifies only after durable write', async () => {
  let release;
  let stored;
  const events = [];
  const { service, counts } = runtime({ setItem: async (_, value) => { stored = value; await new Promise(resolve => { release = resolve; }); } }, (...args) => events.push(args));
  const source = {};
  const state = fixture();
  const saving = service.saveRedCoins(state, source);
  state.monthlyBudget = 999;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(events.length, 0);
  assert.equal(JSON.parse(stored).monthlyBudget, 2000);
  assert.equal(counts.stringify, 0);
  release();
  await saving;
  assert.equal(events.length, 1);
  assert.equal(events[0][0], 'state');
  assert.equal(events[0][1], source);
});
test('failed durable save rejects and never announces a saved transaction', async () => {
  const events = [];
  const { service } = runtime({ setItem: async () => { throw new Error('disk full'); } }, (...args) => events.push(args));
  await assert.rejects(service.saveRedCoins(fixture()), /disk full/);
  assert.equal(events.length, 0);
});
test('UI handoff waits for two frames before running save work', async () => {
  const frames = [];
  const { afterRedCoinsPaint } = load('redcoinsSavePaint', { requestAnimationFrame: callback => frames.push(callback) });
  let finished = false;
  const task = afterRedCoinsPaint().then(() => { finished = true; });
  assert.equal(finished, false);
  frames.shift()();
  await Promise.resolve();
  assert.equal(finished, false);
  frames.shift()();
  await task;
  assert.equal(finished, true);
});
test('change source does not suppress notifications to other consumers', () => {
  const events = load('redcoinsEvents');
  const source = {};
  const received = [];
  const unsubscribe = events.subscribeRedCoinsChanges(change => received.push(change));
  events.emitRedCoinsChange('state', source);
  assert.equal(received.length, 1);
  assert.equal(received[0].source, source);
  unsubscribe();
  events.emitRedCoinsChange('state', source);
  assert.equal(received.length, 1);
});
test('paused native frames cannot strand a pending save when the app backgrounds', async () => {
  let timeout;
  const { afterRedCoinsPaint } = load('redcoinsSavePaint', {
    requestAnimationFrame: () => {},
    setTimeout: callback => { timeout = callback; return 1; },
    clearTimeout: () => {},
  });
  let finished = false;
  const task = afterRedCoinsPaint().then(() => { finished = true; });
  assert.equal(finished, false);
  timeout();
  await task;
  assert.equal(finished, true);
});
test('logger previews before disk work; failures retain draft', () => {
  const source = fs.readFileSync(path.join(__dirname, '../screens/RedCoinsScreen.tsx'), 'utf8');
  const save = source.slice(source.indexOf('const saveEntryInternal ='), source.indexOf('const deleteEditingEntry ='));
  assert.match(save, /let workingState = state/);
  assert.ok(save.indexOf('setState(next)') < save.indexOf('write: () => saveRedCoins'));
  assert.ok(save.indexOf('setEntryOpen(false)') < save.indexOf('write: () => saveRedCoins'));
  assert.match(save, /rollback: async/);
  assert.ok(save.lastIndexOf('await commit(next)') < save.indexOf('upsertRedCoinsLedgerEntry(entry)'));
  assert.match(save, /decision === 'cancel'.*setEntryOpen\(true\)/);
  assert.match(save, /catch \(error\) \{\s*setEntryOpen\(true\)/);
  assert.match(save, /if \(entrySaveLock.current\) return/);
  assert.match(source, /if \(source === localWriteSource.current\) return/);
  assert.match(source, /if \(!state \|\| section !== 'reports'\) return null/);
  assert.match(source, /animationType=\{p.saving \? 'none' : 'slide'\}/);
  assert.match(source, /return entryOpen \? loggerSuggestions/);
  assert.match(source, /if \(refreshToken !== summaryRequest.current\) return/);
});

 test('preview is immediate while a slow durable write remains pending', async () => {
  const { commitRedCoinsPreview } = load('redcoinsSavePreview');
  const steps = [];
  let release;
  const pending = commitRedCoinsPreview({
    preview: () => steps.push('visible'),
    yieldToUI: async () => { steps.push('paint'); },
    write: () => new Promise(resolve => { steps.push('write'); release = resolve; }),
    rollback: async () => assert.fail('must not roll back success'),
  });
  assert.deepEqual(steps, ['visible', 'paint']);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(steps, ['visible', 'paint', 'write']);
  release();
  await pending;
 });
 test('disk failure rolls back the preview before reporting failure', async () => {
  const { commitRedCoinsPreview } = load('redcoinsSavePreview');
  const steps = [];
  await assert.rejects(commitRedCoinsPreview({
    preview: () => steps.push('visible'), yieldToUI: async () => {},
    write: async () => { throw new Error('disk full'); },
    rollback: async () => steps.push('restored'),
  }), /disk full/);
  assert.deepEqual(steps, ['visible', 'restored']);
 });
