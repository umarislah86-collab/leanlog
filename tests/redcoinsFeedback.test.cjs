const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');
function load(name, mocks = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, `../services/${name}.ts`), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, { exports, Date, console, require: (id) => {
    if (id === './redcoinsAccountIdentity') return load('redcoinsAccountIdentity', { '@react-native-async-storage/async-storage': mocks['@react-native-async-storage/async-storage'] });
    if (!(id in mocks)) throw new Error(`Unexpected dependency ${id}`);
    return mocks[id];
  } });
  return exports;
}
const { loggerCategories, loggerSuggestions } = load('redcoinsLogger');
const { evaluateRedCoinsGuards } = load('redcoinsGuards');
const e = (id, amount, type = 'expense', date = '2026-10-03T09:00:00+08:00') => ({ id, item: 'Coffee', category: 'Food', subcategory: 'Drinks', account: 'Card', amount, type, date });
const now = new Date('2026-10-05T09:00:00+08:00');

test('same category and subcategory name can correctly belong to both types', () => {
  const cats = [{ id: 'bank', name: 'Bank', icon: 'wallet', subcategories: ['Taxes', 'Rebates', 'Shared'], subcategoryTypes: { Taxes: ['expense'], Rebates: ['income'], Shared: ['income', 'expense'] } }];
  assert.equal(JSON.stringify(loggerCategories(cats, [], 'expense')[0].subcategories), JSON.stringify(['Taxes', 'Shared']));
  assert.equal(JSON.stringify(loggerCategories(cats, [], 'income')[0].subcategories), JSON.stringify(['Rebates', 'Shared']));
  assert.equal(loggerCategories(cats, [], 'transfer').length, 0);
});
test('metadata wins over incorrect old ledger classification', () => {
  const cats = [{ name: 'Food', subcategories: ['Drinks'], subcategoryTypes: { Drinks: ['expense'] } }];
  assert.equal(loggerCategories(cats, [e('1', 5, 'income')], 'income').length, 0);
});
test('legacy categories fall back to live ledger evidence, unknown stays hidden', () => {
  const cats = [{ name: 'Food', subcategories: ['Drinks', 'Unknown'] }];
  assert.equal(JSON.stringify(loggerCategories(cats, [e('1', 5)], 'expense')[0].subcategories), '["Drinks"]');
});
test('suggestions show latest amount, irrespective of input order', () => {
  const suggestions = loggerSuggestions([e('old', 3, 'expense', '2026-10-01T09:00:00+08:00'), e('new', 7)], 'cof', 'expense', now.getTime());
  assert.equal(suggestions[0].amount, 7);
  assert.equal(suggestions[0].usageCount, 2);
});
test('suggestions exclude opposite transaction type and future entries', () => {
  const suggestions = loggerSuggestions([e('expense', 7), e('income', 100, 'income'), e('future', 200, 'expense', '2026-10-07T09:00:00+08:00')], 'coffee', 'expense', now.getTime());
  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].id, 'expense');
  assert.equal(loggerSuggestions([e('1', 5)], '', 'expense').length, 0);
});
const config = { id: 'g', name: 'Card', scope: 'account', target: 'Card', limit: 1400, cycle: 'salary', enabled: true, thresholds: [50], tone: 'normal' };
const cycle = { cycleStart: '2026-09-25', cycleEnd: '2026-10-24' };
test('guard actual excludes future, income and transfers; current total is 447.04', () => {
  const rows = [e('1', 378.04), e('2', 69), e('future', 133.30, 'expense', '2026-10-07T09:00:00+08:00'), e('income', 50, 'income'), e('transfer', 200, 'transfer')];
  assert.equal(evaluateRedCoinsGuards([config], rows, cycle, now)[0].spent, 447.04);
});
test('new guard, changed limit, and removed guard reflect supplied live configuration', () => {
  const result = evaluateRedCoinsGuards([{ ...config, id: 'new', limit: 100 }], [e('1', 40)], cycle, now);
  assert.equal(result[0].id, 'new');
  assert.equal(result[0].percent, 40);
  assert.equal(result[0].remaining, 60);
  assert.equal(evaluateRedCoinsGuards([], [e('1', 40)], cycle, now).length, 0);
});

const alarms = [];
const permissions = { granted: true, canAskAgain: true };
const notifications = {
  AndroidImportance: { HIGH: 4 }, AndroidNotificationVisibility: { PUBLIC: 1 },
  getPermissionsAsync: async () => permissions,
  requestPermissionsAsync: async () => { throw new Error('Background should never prompt'); },
  setNotificationChannelAsync: async () => {}, cancelScheduledNotificationAsync: async () => {},
};
const reminders = load('redcoinsReminders', {
  'expo-notifications': notifications,
  'bluecoins-drive-reader': { replaceRedCoinsAlarmsAsync: async (json) => alarms.push(JSON.parse(json)) },
  'react-native': { Platform: { OS: 'android' } },
});
const template = { ...e('ignored', 20), id: undefined, date: undefined };
const reminder = { id: 'series', enabled: true, automaticLog: true, frequency: 'daily', repeatEvery: 1, startDate: new Date(Date.now() - 60000).toISOString(), endType: 'occurrences', occurrences: 2, template };
test('auto-log only materializes due entries and never duplicates on repeated refresh', () => {
  const state = { entries: [], reminders: [reminder], deletedEntries: [] };
  const generated = reminders.materializeAutomaticReminders(state);
  assert.equal(generated.length, 1);
  assert.ok(generated[0].loggedAt);
  assert.equal(generated[0].date, reminder.startDate);
  assert.equal(reminders.materializeAutomaticReminders(state).length, 0);
});
test('deleted occurrence, paused schedule and reminder-only never auto-log', () => {
  const generatedId = `reminder-${reminder.id}-${new Date(reminder.startDate).getTime()}`;
  assert.equal(reminders.materializeAutomaticReminders({ entries: [], reminders: [reminder], deletedEntries: [{ id: generatedId }] }).length, 0);
  assert.equal(reminders.materializeAutomaticReminders({ entries: [], reminders: [{ ...reminder, enabled: false }], deletedEntries: [] }).length, 0);
  assert.equal(reminders.materializeAutomaticReminders({ entries: [], reminders: [{ ...reminder, automaticLog: false }], deletedEntries: [] }).length, 0);
});
test('auto-log blocks a transfer to a deleted account until its schedule is repaired', () => {
  const schedule = { ...reminder, template: { ...template, type: 'transfer', account: 'Card', toAccount: 'Deleted pot' } };
  const state = { accounts: [{ name: 'Card' }], entries: [], reminders: [schedule], deletedEntries: [] };
  assert.deepEqual(Array.from(reminders.missingReminderAccounts(schedule, state.accounts)), ['Deleted pot']);
  assert.equal(reminders.materializeAutomaticReminders(state).length, 0);
  assert.equal(state.entries.length, 0);
  state.accounts.push({ name: 'Replacement pot' });
  schedule.template.toAccount = 'Replacement pot';
  assert.equal(reminders.materializeAutomaticReminders(state).length, 1);
  assert.equal(reminders.materializeAutomaticReminders(state).length, 0);
});
test('Oct 3 08:51 Malaysia schedule stays absent at 08:50 and appears exactly at due', () => {
  const schedule = { ...reminder, startDate: '2026-10-03T08:51:00+08:00', occurrences: 1 };
  const state = { entries: [], reminders: [schedule], deletedEntries: [] };
  assert.equal(reminders.materializeAutomaticReminders(state, new Date('2026-10-03T08:50:59+08:00')).length, 0);
  const due = reminders.materializeAutomaticReminders(state, new Date('2026-10-03T08:51:00+08:00'));
  assert.equal(due.length, 1);
  assert.equal(due[0].loggedAt, '2026-10-03T00:51:00.000Z');
  assert.equal(reminders.materializeAutomaticReminders(state, new Date('2026-10-03T09:00:00+08:00')).length, 0);
});
test('both reminder and auto-log schedule native alarms, including without notification permission', async () => {
  permissions.granted = false;
  await reminders.syncReminderNotifications([reminder, { ...reminder, id: 'manual', automaticLog: false }, { ...reminder, id: 'paused', enabled: false }]);
  const rows = alarms.at(-1);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].automaticLog, true);
  assert.equal(rows[1].automaticLog, false);
  assert.ok(rows.every((row) => row.due > Date.now()));
});

test('state writes retain order, and externally restored state is not masked by a stale cache', async () => {
  let stored;
  const writes = [];
  const storage = { getItem: async () => stored, setItem: async (_, value) => { writes.push(JSON.parse(value).monthlyBudget); stored = value; } };
  const service = load('redcoins', {
    '@react-native-async-storage/async-storage': storage,
    'expo-file-system/legacy': {}, 'expo-sharing': {}, './exportFile': {},
    './redcoinsReminders': { materializeAutomaticReminders: () => [] },
    './spendingGuards': {}, './redcoinsEvents': { emitRedCoinsChange: () => {} }, './redcoinsGuards': {},
  });
  const base = { entries: [], accounts: [], categories: [], reminders: [], deletedEntries: [], monthlyBudget: 100 };
  await Promise.all([service.saveRedCoins(base), service.saveRedCoins({ ...base, monthlyBudget: 200 })]);
  assert.deepEqual(writes, [100, 200]);
  assert.equal((await service.loadRedCoins()).monthlyBudget, 200);
  stored = JSON.stringify({ ...base, monthlyBudget: 900 });
  assert.equal((await service.loadRedCoins()).monthlyBudget, 900);
});

test('due reconciliation updates the account balance once across repeated loads', async () => {
  let stored = JSON.stringify({ entries: [], accounts: [{ id: 'a', name: 'Card', balance: 100, type: 'Bank' }], categories: [], deletedEntries: [], reminders: [{ ...reminder, occurrences: 1 }], monthlyBudget: 100 });
  const service = load('redcoins', {
    '@react-native-async-storage/async-storage': { getItem: async () => stored, setItem: async (_, value) => { stored = value; } },
    'expo-file-system/legacy': {}, 'expo-sharing': {}, './exportFile': {},
    './redcoinsReminders': reminders, './spendingGuards': {},
    './redcoinsEvents': { emitRedCoinsChange: () => {} }, './redcoinsGuards': {},
  });
  const first = await service.loadRedCoins();
  assert.equal(first.entries.length, 1);
  assert.equal(first.accounts[0].balance, 80);
  const second = await service.loadRedCoins();
  assert.equal(second.entries.length, 1);
  assert.equal(second.accounts[0].balance, 80);
});

test('Bluecoins refresh preserves account identity and icons for widget selections', async () => {
  let stored = JSON.stringify({ entries: [], accounts: [{ id: 'stable-account', name: 'Aeon', balance: 100, type: 'Bank', icon: 'wallet' }], categories: [], reminders: [], deletedEntries: [], monthlyBudget: 100 });
  const service = load('redcoins', {
    '@react-native-async-storage/async-storage': { getItem: async () => stored, setItem: async (_, value) => { stored = value; } },
    'expo-file-system/legacy': {}, 'expo-sharing': {}, './exportFile': {},
    './redcoinsReminders': { materializeAutomaticReminders: () => [] }, './spendingGuards': {},
    './redcoinsEvents': { emitRedCoinsChange: () => {} }, './redcoinsGuards': {},
  });
  const summary = { redcoins: { entries: [], categories: [], accounts: [{ name: 'Aeon', balance: 125, type: 'Bank' }] }, monthly: { payday: 25, budget: 100 }, cashReality: { safetyBuffer: 0 }, sourceName: 'backup' };
  const refreshed = await service.loadRedCoins(summary);
  assert.equal(refreshed.accounts[0].id, 'stable-account');
  assert.equal(refreshed.accounts[0].icon, 'wallet');
  assert.equal(refreshed.accounts[0].balance, 125);
  assert.equal((await service.loadRedCoins(summary)).accounts[0].id, 'stable-account');
});
