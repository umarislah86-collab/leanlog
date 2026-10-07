const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(name, mocks = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(`services/${name}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: id => mocks[id] });
  return exports;
}
const { favoriteAccountsForHome: favorites } = load('redcoinsFavorites');
const accounts = Array.from({ length: 9 }, (_, i) => ({ id: `${i}`, name: `Account ${i}`, type: i === 7 ? 'Investment' : i === 8 ? 'Liability' : 'Bank', balance: i * 10 }));
test('legacy default remains six cash/bank/card accounts without mutating state', () => {
  const state = { accounts }; const before = JSON.stringify(state);
  assert.equal(favorites(state).length, 6); assert.equal(JSON.stringify(state), before);
});
test('explicit favorites support all types, more than six, and intentionally empty', () => {
  assert.equal(favorites({ accounts, favoriteAccountIds: accounts.map(a => a.id) }).length, 9);
  assert.equal(favorites({ accounts, favoriteAccountIds: [] }).length, 0);
});
test('stable IDs retain rename and live balances, ignore deleted IDs and duplicate selections', () => {
  const selected = { accounts, favoriteAccountIds: ['8', '7', '8', 'deleted'] };
  assert.equal(JSON.stringify(favorites(selected).map(a => a.id)), JSON.stringify(['8', '7']));
  const updated = { ...selected, accounts: accounts.map(a => a.id === '7' ? { ...a, name: 'Renamed pot', balance: 1856.97 } : a) };
  assert.equal(favorites(updated)[1].name, 'Renamed pot'); assert.equal(favorites(updated)[1].balance, 1856.97);
  const restored = JSON.parse(JSON.stringify(updated));
  assert.equal(favorites(restored)[1].balance, 1856.97);
});
test('source identity reconciliation redirects duplicate favorites without losing selection', () => {
  const { reconcileAccountIdentity } = load('redcoinsAccountIdentity', { '@react-native-async-storage/async-storage': {} });
  const original = { accounts: [{ id: 'old', name: 'Old pot', sourceAccountId: '42', type: 'Bank', balance: 1856.97 }, { id: 'duplicate', name: 'New pot', sourceAccountId: '42', type: 'Bank', balance: 999 }], favoriteAccountIds: ['duplicate'], entries: [], reminders: [], deletedEntries: [] };
  const { state } = reconcileAccountIdentity(original, [{ id: 'source', name: 'New pot', sourceAccountId: '42', type: 'Bank', balance: 999 }], []);
  assert.equal(state.favoriteAccountIds[0], 'old'); assert.equal(favorites(state)[0].balance, 1856.97);
});
