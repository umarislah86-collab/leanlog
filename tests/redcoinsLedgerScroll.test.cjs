const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
function load(file, mocks = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText, { exports, Date, console, require: id => {
    if (!(id in mocks)) throw Error('Unexpected dependency: ' + id);
    return mocks[id];
  } });
  return exports;
}
const model = load('services/redcoinsLedgerLayout.ts');
const row = (id, date = '2026-10-01T10:00:00', extra = {}) => ({ id: String(id), date, type: 'expense', item: 'Coffee', amount: 13.9, account: 'Aeon', category: 'Food', subcategory: 'Dining', ...extra });
const history = () => Array.from({ length: 5000 }, (_, index) => row(index, new Date(new Date('2026-10-07T12:00:00').getTime() - index * 6 * 3600000).toISOString(), { type: index % 3 === 0 ? 'transfer' : 'expense', status: index % 5 === 0 ? 'pending' : 'cleared' }));

test('complete multi-year ledger has exact contiguous offsets, unique keys and stable day headers', () => {
  const entries = history(), layout = model.buildLedgerLayout(entries);
  assert.equal(layout.cells.filter(cell => cell.kind === 'entry').length, 5000);
  assert.equal(new Set(layout.cells.map(cell => cell.key)).size, layout.cells.length);
  let offset = 0;
  for (const cell of layout.cells) { assert.equal(cell.offset, offset); offset += cell.length; }
  assert.equal(layout.height, offset);
  for (const index of layout.stickyIndices) assert.equal(layout.cells[index].kind, 'day');
  assert.equal(layout.cells.at(-1).entry.id, '4999');
});

test('deep scrolling and unchanged refresh never change month or partial-row position', () => {
  const entries = history(), before = model.buildLedgerLayout(entries).cells;
  const after = model.buildLedgerLayout(entries.map(entry => ({ ...entry }))).cells;
  for (let index = 0; index < before.length; index += 17) {
    const y = before[index].offset + 9;
    const anchor = model.captureLedgerAnchor(before, y);
    assert.equal(anchor.key, before[index].key);
    assert.equal(model.restoreLedgerAnchor(anchor, before, after), y);
  }
});

test('new entries at top preserve old transaction and inset; deletion chooses nearest survivor', () => {
  const entries = history(), before = model.buildLedgerLayout(entries).cells;
  const index = before.findIndex(cell => cell.key === 'entry:2000');
  const anchor = model.captureLedgerAnchor(before, before[index].offset + 13);
  const after = model.buildLedgerLayout([row('new', '2026-10-08T10:00:00'), ...entries]).cells;
  assert.equal(model.restoreLedgerAnchor(anchor, before, after), after.find(cell => cell.key === anchor.key).offset + 13);
  const deleted = model.buildLedgerLayout(entries.filter(entry => entry.id !== '2000')).cells;
  assert.equal(model.restoreLedgerAnchor(anchor, before, deleted), deleted.find(cell => cell.key === before[index + 1].key).offset);
});

test('scaled text, transfer and status rows have deterministic geometry; totals use full day and cents', () => {
  const entries = [row('a'), row('b', undefined, { amount: 20.1, type: 'income' }), row('c', undefined, { type: 'transfer', amount: 100 }), row('d', undefined, { status: 'reconciled' })];
  const layout = model.buildLedgerLayout(entries, 1.5);
  assert.equal(layout.cells[0].total, -7.7);
  assert.equal(layout.cells[0].length, 39);
  assert.equal(layout.cells.find(cell => cell.key === 'entry:a').length, 81);
  assert.equal(layout.cells.find(cell => cell.key === 'entry:c').length, 96);
  assert.equal(layout.cells.find(cell => cell.key === 'entry:d').length, 96);
  assert.equal(model.restoreLedgerAnchor(null, [], []), 0);
});

function componentRuntime() {
  let cursor = 0; const hooks = [], effects = [], calls = [];
  const controller = { scrollToOffset: value => calls.push(value) };
  const react = {
    createElement: (type, props, ...children) => { if (type === 'FlatList' && props.ref) props.ref.current = controller; return { type, props: { ...props, children } }; },
    useRef: initial => { const index = cursor++; hooks[index] ||= { current: initial }; return hooks[index]; },
    useMemo: (factory, deps) => { const index = cursor++, old = hooks[index]; if (!old || deps.some((dep, i) => dep !== old.deps[i])) hooks[index] = { deps, value: factory() }; return hooks[index].value; },
    useLayoutEffect: (effect, deps) => { const index = cursor++, old = hooks[index]; if (!old || deps.some((dep, i) => dep !== old[i])) effects.push(effect); hooks[index] = deps; },
  };
  const { RedCoinsLedgerList } = load('components/RedCoinsLedgerList.tsx', { react, 'react-native': { FlatList: 'FlatList', View: 'View', useWindowDimensions: () => ({ fontScale: 1 }) }, '../services/redcoinsLedgerLayout': model });
  return { calls, render: props => { cursor = 0; const result = RedCoinsLedgerList({ filterKey: 'all', renderEntry: () => null, renderDay: () => null, contentStyle: {}, emptyStyle: {}, ...props }); effects.splice(0).forEach(effect => effect()); return result.props; } };
}

test('actual list wiring retains deep scroll on refresh, anchors insertion, resets only for changed filters', () => {
  const runtime = componentRuntime(), entries = history();
  let props = runtime.render({ entries });
  assert.equal(props.onEndReached, undefined, 'no growing pagination prefix');
  assert.equal(props.removeClippedSubviews, false);
  const index = props.data.findIndex(cell => cell.key === 'entry:2000');
  const offset = props.data[index].offset + 11;
  props.onScroll({ nativeEvent: { contentOffset: { y: offset } } });
  props = runtime.render({ entries: entries.map(entry => ({ ...entry })), extraData: { revision: 2 } });
  assert.equal(runtime.calls.length, 0, 'ordinary refresh must not issue any scroll command');
  props = runtime.render({ entries: [row('new', '2026-10-08T10:00:00'), ...entries] });
  assert.equal(runtime.calls.at(-1).offset, props.data.find(cell => cell.key === 'entry:2000').offset + 11);
  assert.equal(runtime.calls.at(-1).animated, false);
  props.onContentSizeChange();
  props = runtime.render({ entries: entries.slice(-50), filterKey: 'June' });
  assert.equal(runtime.calls.at(-1).offset, 0);
  for (let i = 0; i < props.data.length; i++) {
    const measured = props.getItemLayout(null, i);
    assert.equal(measured.offset, props.data[i].offset); assert.equal(measured.length, props.data[i].length);
    assert.equal(props.renderItem({ item: props.data[i] }).props.style.height, measured.length);
  }
});
