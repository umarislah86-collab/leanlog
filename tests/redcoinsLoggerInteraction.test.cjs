const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const screen = fs.readFileSync('screens/RedCoinsScreen.tsx', 'utf8');
const ast = ts.createSourceFile('screen.tsx', screen, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const root = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'RedCoinsScreen');
const declarations = new Map(root.body.statements.filter(ts.isVariableStatement).flatMap(statement => [...statement.declarationList.declarations]).map(node => [node.name.getText(ast), node]));
const transpile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
const flush = () => new Promise(resolve => setImmediate(resolve));

function runtime(patch = {}) {
  const events = [];
  let paint, resolveWrite, rejectWrite, writes = 0;
  const state = { entries: [], reminders: [], accounts: [{ name: 'Bank', balance: 100 }], categories: [], createdAt: '2026-10-01' };
  const exports = {};
  const context = {
    exports, console, Date, Number, Promise,
    state, entrySaveLock: { current: false }, receiptBusy: false,
    item: 'Coffee', amount: '10', account: 'Bank', toAccount: '', type: 'expense',
    category: 'Food', subcategory: 'Drinks',
    incomePeriod: '', schedulingOnly: false, repeat: 'none', reminderEndType: 'never',
    reminderEndDate: '', installments: '', editingEntryId: null,
    entryDate: new Date(), note: '', labels: '', receiptDrafts: [], reviewingDetectionId: null,
    summaryRequest: { current: 0 }, localWriteSource: { current: {} },
    Keyboard: { dismiss: () => events.push('keyboard') },
    Alert: { alert: (title, message) => events.push(['alert', title, message]) },
    setEntrySaving: saving => events.push(['saving', saving]),
    setEntryOpen: visible => events.push(['modal', visible]),
    setState: next => events.push(['state', next]),
    afterRedCoinsPaint: () => paint ? Promise.resolve() : new Promise(resolve => { paint = resolve; }),
    commitRedCoinsPreview: async actions => {
      actions.preview();
      try { await actions.yieldToUI(); await actions.write(); }
      catch (error) { await actions.rollback(); throw error; }
    },
    saveRedCoins: next => { writes++; events.push(['write', next]); return new Promise((resolve, reject) => { resolveWrite = resolve; rejectWrite = reject; }); },
    loadRedCoins: async () => state,
    applyEntryBalance: () => events.push('prepare-balances'),
    navigateSection: section => events.push(['section', section]),
    upsertRedCoinsLedgerEntry: async () => events.push('index'),
    setLedgerRevision: () => {}, refreshLiveBluecoins: async () => {}, refreshLeanLogWidget: async () => {},
    ...patch,
  };
  const code = ['saveEntryInternal', 'saveEntry'].map(name => `const ${name} = ${declarations.get(name).initializer.getText(ast)};`).join('\n');
  vm.runInNewContext(transpile(code + '\nexports.run = saveEntry;'), context);
  return { context, events, run: exports.run, paint: () => paint(), resolve: () => resolveWrite(), reject: () => rejectWrite(new Error('disk full')), writes: () => writes };
}

test('actual Save handler hides and yields before ledger preparation; duplicate taps cannot write twice', async () => {
  const r = runtime();
  const pending = r.run();
  assert.deepEqual(r.events.find(event => Array.isArray(event) && event[0] === 'modal'), ['modal', false]);
  assert.ok(!r.events.includes('prepare-balances'));
  assert.equal(r.writes(), 0);
  await r.run();
  assert.equal(r.writes(), 0);
  r.paint(); await flush();
  assert.equal(r.writes(), 1, JSON.stringify(r.events));
  assert.equal(r.context.entrySaveLock.current, true, 'retain write lock while modal is gone');
  r.resolve(); await pending; await flush();
  assert.equal(r.context.entrySaveLock.current, false);
  assert.ok(r.events.includes('index'));
});

test('actual Save failure restores durable state and reopens the unchanged draft', async () => {
  const r = runtime(); const pending = r.run();
  r.paint(); await flush(); r.reject(); await pending;
  const modal = r.events.filter(event => Array.isArray(event) && event[0] === 'modal');
  assert.deepEqual(modal.at(-1), ['modal', true]);
  assert.equal(r.context.item, 'Coffee'); assert.equal(r.context.amount, '10');
  assert.equal(r.events.filter(event => Array.isArray(event) && event[0] === 'state').at(-1)[1], r.context.state);
  assert.ok(!r.events.includes('index'));
  assert.equal(r.context.entrySaveLock.current, false);
});

test('incomplete entry stays open and duplicate-income cancellation reopens without a write', async () => {
  let r = runtime({ amount: '' }); await r.run();
  assert.ok(!r.events.some(event => Array.isArray(event) && event[0] === 'modal' && event[1] === false));
  assert.equal(r.writes(), 0);
  r = runtime({ type: 'income', findIncomeDuplicates: () => [{ id: 'old', item: 'Salary', amount: 10, date: new Date().toISOString() }],
    Alert: { alert: (title, message, buttons) => { if (title === 'Possible duplicate income') buttons[0].onPress(); } } });
  const pending = r.run(); r.paint(); await pending;
  assert.equal(r.writes(), 0);
  assert.deepEqual(r.events.filter(event => Array.isArray(event) && event[0] === 'modal').at(-1), ['modal', true]);
});

test('page cache ignores new render closures but invalidates on ledger, filter or theme changes', () => {
  const exports = {};
  vm.runInNewContext(transpile(fs.readFileSync('components/RedCoinsPageContent.tsx', 'utf8')), { exports, require: () => ({ memo: render => render }) });
  const state = { entries: [] }, palette = {}, selected = [];
  const previous = { snapshot: { state, palette, selected }, renderContent: () => 'old' };
  const next = { snapshot: { state, palette, selected }, renderContent: () => 'new form draft' };
  assert.equal(exports.sameRedCoinsPageInputs(previous, next), true);
  for (const key of ['state', 'palette', 'selected']) assert.equal(exports.sameRedCoinsPageInputs(previous, { ...next, snapshot: { ...next.snapshot, [key]: {} } }), false);
  assert.equal(exports.sameRedCoinsPageInputs(previous, { ...next, snapshot: { ...next.snapshot, extra: 1 } }), false);
});
