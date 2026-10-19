const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText, { exports, Date, console, require: id => {
    if (!(id in mocks)) throw new Error(`Unexpected dependency ${id}`);
    return mocks[id];
  } });
  return exports;
}
const stored = new Map();
const storage = { getItem: async key => stored.get(key) || null, setItem: async (key, value) => stored.set(key, value), removeItem: async key => stored.delete(key) };
const preferences = load('widgets/daily-widget-preferences.ts', { '@react-native-async-storage/async-storage': storage });
test('daily settings default safely and cap unique valid selections at four', async () => {
  assert.equal((await preferences.getDailyWidgetPreferences()).mode, 'guards');
  stored.set('widget_daily_preferences_99', 'broken JSON');
  assert.equal((await preferences.getDailyWidgetPreferences(99)).mode, 'guards');
  const normalized = preferences.normalizeDailyWidgetPreferences({ mode: 'accounts', accountIds: ['a', 'a', null, '', 'b', 'c', 'd', 'e'] });
  assert.equal(JSON.stringify(normalized.accountIds), '["a","b","c","d"]');
});
test('each daily widget keeps independent settings and deleting one leaves the other', async () => {
  await preferences.saveDailyWidgetPreferences(1, { mode: 'accounts', accountIds: ['b', 'a'] });
  await preferences.saveDailyWidgetPreferences(2, { mode: 'guards', accountIds: [] });
  assert.equal((await preferences.getDailyWidgetPreferences(1)).mode, 'accounts');
  assert.equal((await preferences.getDailyWidgetPreferences(2)).mode, 'guards');
  await preferences.deleteDailyWidgetPreferences(2);
  assert.equal(JSON.stringify((await preferences.getDailyWidgetPreferences(1)).accountIds), '["b","a"]');
});
const data = load('widgets/widget-data.ts', {
  './widget-theme': { getWidgetTheme: async () => 'cream' },
  '../services/redcoins': { getRedCoinsSummary: async () => ({}), loadRedCoins: async () => JSON.parse(stored.get('redcoins_state_v1') || '{"accounts":[]}') },
  '@react-native-async-storage/async-storage': storage, './daily-widget-preferences': preferences,
  '../services/spendingGuards': { WIDGET_GUARD_KEY: 'guards', WIDGET_CASH_REALITY_KEY: 'cash' },
});
test('account snapshot reads current balances and names in selection order, without replacing deleted accounts', async () => {
  stored.set('redcoins_state_v1', JSON.stringify({ accounts: [{ id: 'a', name: 'A', balance: 100 }, { id: 'b', name: 'B', balance: -20 }] }));
  assert.equal(JSON.stringify((await data.getWidgetData(1)).accounts.map(a => a.balance)), '[-20,100]');
  stored.set('redcoins_state_v1', JSON.stringify({ accounts: [{ id: 'a', name: 'Renamed', balance: 125 }, { id: 'unrelated', name: 'Other', balance: 999 }] }));
  const updated = await data.getWidgetData(1);
  assert.equal(updated.accounts.length, 1);
  assert.equal(updated.accounts[0].name, 'Renamed');
  assert.equal(updated.accounts[0].balance, 125);
});
const primitive = name => Object.assign(() => {}, { __name__: name, convertProps: props => props });
const { LeanLogWidget } = load('widgets/LeanLogWidget.tsx', {
  './widget-watermark': {widgetWatermark:node=>node},
  './widget-theme': { themedWidgetTree: node => node },
  react: require('react'), 'react-native-android-widget': { FlexWidget: primitive('LinearLayoutWidget'), TextWidget: primitive('TextWidget') },
});
const { buildWidgetTree } = require('../node_modules/react-native-android-widget/lib/commonjs/api/build-widget-tree');
const base = { eaten: 700, burned: 0, meals: 2, goal: 2000, steps: 3000, updated: '10:00', cashReality: null, guards: [{ id: 'g', name: 'Dining', percent: 20, spent: 80, limit: 400 }] };

test('daily macros sum consumed items only for today and render in the native widget tree', async () => {
  stored.set('calorie_entries', JSON.stringify([
    { date: new Date().toLocaleDateString('ms-MY'), calories: 500, items: [{ protein: 20, karbohidrat: 40, lemak: 8 }, { protein: 10, karbohidrat: 5, lemak: 2 }] },
    { date: 'yesterday', calories: 999, items: [{ protein: 999, karbohidrat: 999, lemak: 999 }] },
  ]));
  const result = await data.getWidgetData();
  assert.equal(JSON.stringify(result.macros), JSON.stringify({ protein: 30, carbs: 45, fat: 10 }));
  const tree = JSON.stringify(buildWidgetTree(LeanLogWidget({ ...base, macros: result.macros })));
  assert.ok(tree.includes('P 30g · C 45g · F 10g'));
  const native = buildWidgetTree(LeanLogWidget({ ...base, macros: result.macros }));
  const row = JSON.stringify(native.children[1]);
  assert.ok(row.includes('STEPS') && row.includes('MEALS') && row.includes('BURNED') && row.includes('P 30g · C 45g · F 10g'));
  assert.equal(native.children[2].props.style.height, 3, 'one shared metrics row sits immediately above the progress bar');
  stored.delete('calorie_entries');
  assert.equal(JSON.stringify((await data.getWidgetData()).macros), JSON.stringify({ protein: 0, carbs: 0, fat: 0 }));
});
test('cash row distinguishes selected account total from true cash, preserving negative balances and zero', () => {
  for (const [available, trueCash, left, right] of [
    [2500, -1029, 'AVAILABLE RM 2,500', 'TRUE -RM 1,029'],
    [-50, -200, 'AVAILABLE -RM 50', 'TRUE -RM 200'],
    [0, 0, 'AVAILABLE RM 0', 'TRUE RM 0'],
  ]) {
    const tree = JSON.stringify(buildWidgetTree(LeanLogWidget({ ...base, cashReality: { liquidBalance: available, trueSpendable: trueCash, cardOutstanding: 0, sourceDate: '2026-10-19' } })));
    assert.ok(tree.includes(left));
    assert.ok(tree.includes(right));
    assert.ok(tree.indexOf(left) < tree.indexOf(right));
  }
});

test('actual widget tree builder accepts default guards and empty, odd, full account grids', () => {
  assert.match(JSON.stringify(buildWidgetTree(LeanLogWidget(base))), /DINING/);
  for (const count of [0, 1, 4]) {
    const accounts = Array.from({ length: count }, (_, i) => ({ name: `Long account name ${i}`, balance: i === 0 ? -378.04 : 100, type: 'Bank' }));
    const tree = JSON.stringify(buildWidgetTree(LeanLogWidget({ ...base, bottomMode: 'accounts', accounts })));
    assert.match(tree, /\+ FOOD/);
    assert.match(tree, /\+ ACTIVITY/);
    assert.match(tree, /\+ MONEY/);
    assert.match(tree, /leanlog:\/\/quick\/food/);
    assert.match(tree, /leanlog:\/\/quick\/activity/);
    assert.match(tree, /leanlog:\/\/redcoins\/new/);
    assert.doesNotMatch(tree, /DINING/);
    if (count) { assert.match(tree, /378.04/); assert.match(tree, /section=accounts/); }
    else assert.match(tree, /Choose accounts/);
  }
});

test('compact snapshot columns share weights and odd rows use all available width', () => {
  const collect = (element, result = []) => {
    if (Array.isArray(element)) element.forEach(child => collect(child, result));
    else if (element?.props) { result.push(element); collect(element.props.children, result); }
    return result;
  };
  for (const bottomMode of ['accounts', 'guards']) {
    for (const count of [1, 2, 3, 4]) {
      const names = ['A', 'VERY LONG ACCOUNT NAME', 'AEON', 'CIMB PLATINUM'];
      const props = { ...base, bottomMode,
        accounts: names.slice(0, count).map((name, i) => ({ name, type: 'Bank', balance: i ? -961 : 115.68 })),
        guards: names.slice(0, count).map((name, i) => ({ id: `${i}`, name, percent: i * 10, spent: 123, limit: 400 })),
      };
      const rows = collect(LeanLogWidget(props)).filter(e => String(e.key || '').startsWith(`${bottomMode === 'accounts' ? 'account' : 'guard'}-row-`));
      assert.equal(rows.length, Math.ceil(count / 2));
      rows.forEach(row => {
        const cells = collect(row.props.children).filter(e => e.props.style?.width === 0 && e.props.style?.height === 27);
        assert.equal(cells.length, Math.min(2, count - rows.indexOf(row) * 2), 'no empty placeholder in odd rows');
        cells.forEach(cell => assert.equal(cell.props.style.flex, 1));
        assert.equal(cells[0].props.style.marginRight, cells.length === 2 ? 3 : 0);
        if (cells[1]) assert.equal(cells[1].props.style.marginRight || 0, 0);
      });
      assert.doesNotThrow(() => buildWidgetTree(LeanLogWidget(props)));
    }
  }
});
