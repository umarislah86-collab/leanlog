const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../services/redcoinsLedgerSummary.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: exportsObject, Date });
const { filterLedgerEntries, summarizeLedgerEntries } = exportsObject;
const filters = { search: '', types: [], accounts: [], categories: [], subcategories: [], startDay: '', endDay: '' };
const entry = (id, amount, type = 'expense', extras = {}) => ({ id, amount, type, item: 'Grocery', account: 'Aeon', category: 'Food', subcategory: 'Groceries', date: new Date(2026, 9, 5, 10).toISOString(), ...extras });
test('full filtered totals and select-all set are independent of a loaded page', () => {
  const all = filterLedgerEntries(Array.from({ length: 250 }, (_, i) => entry(String(i), 0.1)), { ...filters, search: 'grocery' });
  assert.equal(all.length, 250);
  assert.equal(summarizeLedgerEntries(all).expense, 25);
  assert.equal(summarizeLedgerEntries(all.slice(0, 80)).expense, 8);
});
test('mixed types have separate totals, cent precision and transfers do not affect net', () => {
  const summary = summarizeLedgerEntries([entry('1', 0.1), entry('2', 0.2), entry('3', 100, 'income'), entry('4', 300, 'transfer')]);
  assert.equal(summary.expense, 0.3);
  assert.equal(summary.income, 100);
  assert.equal(summary.transfer, 300);
  assert.equal(summary.net, 99.7);
});
test('account filters match source or destination without counting a transfer twice', () => {
  const rows = filterLedgerEntries([entry('1', 300, 'transfer', { toAccount: 'Cimb' })], { ...filters, accounts: ['Aeon', 'Cimb'] });
  assert.equal(rows.length, 1);
  assert.equal(summarizeLedgerEntries(rows).transfer, 300);
  assert.equal(filterLedgerEntries(rows, { ...filters, accounts: ['Cimb'] }).length, 1);
});
test('type, category, subcategory, search and inclusive local date range use the same matching set', () => {
  const rows = [entry('1', 10), entry('2', 20, 'income'), entry('3', 30, 'expense', { subcategory: 'Snacks' }), entry('4', 40, 'expense', { date: new Date(2026, 9, 6, 0).toISOString() })];
  const matched = filterLedgerEntries(rows, { ...filters, types: ['expense'], categories: ['Food'], subcategories: ['Groceries'], search: 'GROCERY', startDay: '2026-10-05', endDay: '2026-10-05' });
  assert.equal(matched.length, 1);
  assert.equal(matched[0].id, '1');
  assert.equal(summarizeLedgerEntries(matched).expense, 10);
});
test('editing/removing rows recomputes totals, zero matches returns zeros', () => {
  const original = [entry('1', 10), entry('2', 30)];
  assert.equal(summarizeLedgerEntries(original).expense, 40);
  assert.equal(summarizeLedgerEntries([{ ...original[0], amount: 15 }]).expense, 15);
  const empty = summarizeLedgerEntries(filterLedgerEntries(original, { ...filters, search: 'no match' }));
  assert.equal(empty.count, 0);
  assert.equal(empty.net, 0);
});
test('future dated rows remain counted when visible but are explicitly flagged', () => {
  const now = new Date(2026, 9, 5, 11).getTime();
  const summary = summarizeLedgerEntries([entry('1', 10), entry('2', 20, 'expense', { date: new Date(2026, 9, 7, 10).toISOString() })], now);
  assert.equal(summary.expense, 30);
  assert.equal(summary.futureCount, 1);
});

test('report drilldowns use exact salary timestamps and exclude scheduled rows from all three metric totals', () => {
  const start = new Date(2026, 8, 25, 14).getTime(), endExclusive = new Date(2026, 9, 25, 15).getTime(), actualThrough = new Date(2026, 9, 7, 12).getTime();
  const rows = [
    entry('early', 999, 'income', { date: new Date(start - 1).toISOString() }),
    entry('salary', 1000, 'income', { date: new Date(start).toISOString() }),
    entry('expense', 13.9), entry('transfer', 300, 'transfer'),
    entry('due-exactly-now', 20.1, 'expense', { date: new Date(actualThrough).toISOString() }),
    entry('scheduled', 999, 'expense', { date: new Date(actualThrough + 1).toISOString() }),
    entry('next-salary', 999, 'income', { date: new Date(endExclusive).toISOString() }),
  ];
  const window = { start, endExclusive, actualThrough };
  for (const type of ['income', 'expense', 'transfer']) {
    const expected = rows.filter(row => row.type === type && new Date(row.date).getTime() >= start && new Date(row.date).getTime() < endExclusive && new Date(row.date).getTime() <= actualThrough);
    const actual = filterLedgerEntries(rows, { ...filters, types: [type], reportWindow: window });
    assert.deepEqual(Array.from(actual, row => row.id).sort(), expected.map(row => row.id).sort());
    assert.equal(summarizeLedgerEntries(actual)[type], type === 'income' ? 1000 : type === 'expense' ? 34 : 300);
  }
});

test('actual report card handler opens a clean ledger scope matching its displayed metric', () => {
  const screen = fs.readFileSync('screens/RedCoinsScreen.tsx', 'utf8');
  const block = screen.slice(screen.indexOf('  const openReportMetricLedger ='), screen.indexOf('  const finance ='));
  const output = {}, values = {};
  const report = { start: new Date(2026, 8, 25, 14), endExclusive: new Date(2026, 9, 25, 15), displayEnd: new Date(new Date(2026, 9, 25, 15).getTime() - 1), actualThrough: new Date(2026, 9, 7, 12).getTime(), cycleLabel: 'DXC · September 2026' };
  const context = { exports: output, report, reportMode: 'salary-cycle', Keyboard: { dismiss: () => {} }, dayKey: value => { const date = new Date(value); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }, reportDate: date => date.toISOString(), navigateSection: value => { values.section = value; } };
  for (const name of ['Search', 'SelectedIds', 'FilterTypes', 'FilterAccounts', 'FilterCategories', 'FilterSubcategories', 'FilterDateMode', 'FilterStartDay', 'FilterEndDay', 'FilterDateLabel', 'ReportLedgerWindow']) context['set' + name] = value => { values[name] = value; };
  vm.runInNewContext(ts.transpileModule(`${block}\nexports.open = openReportMetricLedger;`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, context);
  for (const type of ['income', 'expense', 'transfer']) {
    output.open(type);
    assert.equal(values.section, 'activity'); assert.equal(values.Search, '');
    assert.equal(values.FilterTypes[0], type);
    assert.equal(values.FilterAccounts.length, 0); assert.equal(values.FilterCategories.length, 0); assert.equal(values.FilterSubcategories.length, 0);
    assert.equal(values.ReportLedgerWindow.start, report.start.getTime()); assert.equal(values.ReportLedgerWindow.actualThrough, report.actualThrough);
  }
});
