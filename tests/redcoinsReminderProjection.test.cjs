const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const cache = {};
function load(name) {
  if (cache[name]) return cache[name];
  const exports = cache[name] = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, `../services/${name}.ts`), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Date, require: id => id === 'bluecoins-drive-reader' ? {} : id === 'react-native' ? { Platform: { OS: 'android' } } : id === 'expo-notifications' ? {} : load(id.replace('./', '')),
  });
  return exports;
}
const { projectRedCoinsReminders: project } = load('redcoinsReminderProjection');
const now = new Date('2026-10-06T00:00:00Z');
const schedule = (id, date, amount, extras = {}) => ({ id, enabled: true, automaticLog: true, frequency: 'monthly', repeatEvery: 1, startDate: date, endType: 'occurrences', occurrences: 1, template: { type: 'expense', item: id, amount, account: 'Bank' }, ...extras });
const state = reminders => ({ accounts: [{ id: 'a', name: 'Bank', type: 'Bank', balance: 1000 }, { id: 'b', name: 'Pot', type: 'Bank', balance: 200 }], reminders, entries: [], deletedEntries: [] });
test('next due sorts ascending, paused/completed at bottom without mutating state', () => {
  const fixture = state([schedule('late', '2026-10-20', 200), schedule('paused', '2026-10-07', 50, { enabled: false }), schedule('soon', '2026-10-08', 100), schedule('complete', '2026-10-01', 50)]);
  const before = JSON.stringify(fixture), rows = project(fixture, now);
  assert.equal(rows[0].reminder.id, 'soon');
  assert.equal(rows[1].reminder.id, 'late');
  assert.equal(rows.find(x => x.reminder.id === 'paused').projection, null);
  assert.equal(rows[0].projection.source, 900);
  assert.equal(rows[1].projection.source, 700);
  assert.equal(JSON.stringify(fixture), before);
});
test('income/transfer affect both accounts and every earlier daily repeat is included', () => {
  const daily = schedule('daily', '2026-10-07', 10, { frequency: 'daily', occurrences: 4 });
  const income = schedule('salary', '2026-10-08', 500, { template: { type: 'income', item: 'Salary', account: 'Bank', amount: 500 } });
  const transfer = schedule('pot', '2026-10-10', 100, { template: { type: 'transfer', item: 'Pot', account: 'Bank', toAccount: 'Pot', amount: 100 } });
  const rows = project(state([transfer, daily, income]), now);
  assert.equal(rows.find(x => x.reminder.id === 'daily').projection.source, 990);
  assert.equal(rows.find(x => x.reminder.id === 'salary').projection.source, 1480);
  assert.equal(rows.find(x => x.reminder.id === 'pot').projection.source, 1360);
  assert.equal(rows.find(x => x.reminder.id === 'pot').projection.destination, 300);
});
test('same-time due cards use the same post-batch balance regardless of reminder input order', () => {
  const first = schedule('one', '2026-10-08', 100), second = schedule('two', '2026-10-08', 200);
  assert.equal(project(state([first, second]), now)[0].projection.source, 700);
  assert.equal(project(state([second, first]), now)[1].projection.source, 700);
});
test('reminder-only is a projection assumption, missing transfer destination never debits half', () => {
  const reminder = schedule('manual', '2026-10-07', 100, { automaticLog: false });
  const missing = schedule('missing', '2026-10-08', 500, { template: { type: 'transfer', item: 'Missing', amount: 500, account: 'Bank', toAccount: 'Deleted pot' } });
  const later = schedule('later', '2026-10-09', 50);
  const rows = project(state([reminder, missing, later]), now);
  assert.equal(rows[0].projection.source, 900);
  assert.equal(rows[1].projection, null);
  assert.equal(rows[2].projection.source, 850);
});
test('unapplied future ledger rows count once; a linked occurrence uses edited ledger amount, not template', () => {
  const fixture = state([schedule('linked', '2026-10-08T00:00:00Z', 100)]);
  fixture.entries = [{ id: 'future', date: '2026-10-07', type: 'expense', account: 'Bank', amount: 50, balanceEffectApplied: false }, { id: 'linked-row', date: '2026-10-08T00:00:00Z', type: 'expense', account: 'Bank', amount: 75, balanceEffectApplied: false, reminderOccurrenceKey: 'linked:2026-10-08T00:00:00.000Z' }, { id: 'applied', date: '2026-10-07', type: 'expense', account: 'Bank', amount: 999, balanceEffectApplied: true }];
  assert.equal(project(fixture, now)[0].projection.source, 875);
});
test('deleted occurrences stay suppressed; future beyond next due does not affect current card', () => {
  const fixture = state([schedule('repeat', '2026-10-07T00:00:00Z', 100, { frequency: 'daily', occurrences: 2 })]);
  fixture.deletedEntries = [{ id: `reminder-repeat-${new Date('2026-10-07T00:00:00Z').getTime()}` }];
  fixture.entries = [{ id: 'later', type: 'expense', date: '2026-10-10', account: 'Bank', amount: 999, balanceEffectApplied: false }];
  const rows = project(fixture, now);
  assert.equal(rows[0].nextDue.toISOString(), '2026-10-08T00:00:00.000Z');
  assert.equal(rows[0].projection.source, 900);
});
test('cents remain exact, overdrafts retain their sign and invalid amount has no projection', () => {
  const fixture = state([schedule('a', '2026-10-07', 0.1), schedule('b', '2026-10-08', 0.2), schedule('c', '2026-10-09', 1000), schedule('invalid', '2026-10-10', NaN)]);
  const rows = project(fixture, now);
  assert.equal(rows[1].projection.source, 999.7);
  assert.equal(rows[2].projection.source, -0.3);
  assert.equal(rows[3].projection, null);
});
