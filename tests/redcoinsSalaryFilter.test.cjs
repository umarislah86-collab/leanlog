const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const exportsForTest = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('services/redcoinsSalaryFilter.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: exportsForTest, Date });
const { salaryFilterSources, visibleSalarySources, preferredSalarySource, salaryFilterCycle, salaryCycleOffset, ledgerMonthPeriod } = exportsForTest;
const now = new Date('2026-10-07T12:00:00');
const row = (id, item, subcategory = 'Salary', date = '2026-09-25T10:00:00', extra = {}) => ({ id, item, subcategory, category: 'Employer', date, type: 'income', amount: 1000, ...extra });

test('6pm salary is an exact half-open boundary: early loan stays old; later loan is new', () => {
  const entries = [row('aug', 'DXC', 'Salary', '2026-08-25T18:00:00'), row('sep', 'DXC', 'Salary', '2026-09-25T18:00:00')];
  const source = salaryFilterSources(entries, now)[0];
  const old = salaryFilterCycle(source, 1, now), current = salaryFilterCycle(source, 0, now);
  const before = new Date('2026-09-25T17:59:59').getTime(), at = new Date('2026-09-25T18:00:00').getTime();
  assert.equal(old.endExclusive, at); assert.equal(current.startInstant, at);
  assert.ok(before >= old.startInstant && before < old.endExclusive);
  assert.ok(at >= current.startInstant && at < current.endExclusive);
  assert.equal(exportsForTest.activeSalaryCycle(entries, 25, '', now).start.getTime(), at);
});

test('calendar payday and future salary cannot start a cycle until salary has actually been logged', () => {
  const entries = [row('sep', 'DXC', 'Salary', '2026-09-25T18:00:00'), row('future', 'DXC', 'Salary', '2026-10-25T18:00:00')];
  const waiting = new Date('2026-10-25T17:59:59');
  assert.equal(exportsForTest.activeSalaryCycle(entries, 25, '', waiting).start.getTime(), new Date(entries[0].date).getTime());
  assert.equal(exportsForTest.activeSalaryCycle(entries, 25, '', new Date('2026-10-25T18:00:00')).start.getTime(), new Date(entries[1].date).getTime());
});

test('default source list contains Salary only, while other income requires explicit expansion', () => {
  const sources = salaryFilterSources([row('s', 'DXC'), ...Array.from({ length: 300 }, (_, i) => row(String(i), `Other ${i}`, 'Rebates'))], now);
  assert.equal(sources.length, 301);
  assert.equal(visibleSalarySources(sources, '', false).length, 1);
  assert.equal(visibleSalarySources(sources, '', true).length, 301);
  assert.equal(visibleSalarySources(sources, 'DXC', false)[0].label, 'DXC · Salary');
  assert.equal(visibleSalarySources(sources, 'Other 12', false).length, 0);
});

test('source identity survives new transaction IDs, dates, amounts, whitespace and case', () => {
  const original = salaryFilterSources([row('old', 'DXC')], now)[0];
  const sources = salaryFilterSources([row('new', ' dxc ', ' salary ', '2026-09-26T10:00:00', { amount: 5000 })], now);
  assert.equal(sources[0].key, original.key);
  assert.equal(preferredSalarySource(sources, original.key).key, original.key);
});

test('last explicitly chosen non-salary source is retained; missing selection falls back to Salary, not random income', () => {
  const sources = salaryFilterSources([row('salary', 'DXC'), row('other', 'Interest', 'Dividends')], now);
  const interest = sources.find(source => !source.isSalary);
  assert.equal(preferredSalarySource(sources, interest.key).key, interest.key);
  assert.equal(preferredSalarySource(sources, 'deleted').isSalary, true);
  assert.equal(preferredSalarySource([interest], 'deleted'), undefined);
});

test('future, invalid dates and non-income entries are not salary anchors', () => {
  const sources = salaryFilterSources([row('valid', 'DXC'), row('future', 'Future', 'Salary', '2026-10-25T10:00:00'), row('invalid', 'Invalid', 'Salary', 'bad'), row('expense', 'Expense', 'Salary', undefined, { type: 'expense' })], now);
  assert.equal(sources.length, 1); assert.equal(sources[0].entries.length, 1);
});

test('same title in Salary and another category stays separate; month navigation uses real paydays', () => {
  const sources = salaryFilterSources([row('feb', 'DXC', 'Salary', '2026-02-24T10:00:00'), row('mar', 'DXC', 'Salary', '2026-03-27T10:00:00'), row('sep', 'DXC'), row('rebate', 'DXC', 'Rebates')], now);
  assert.equal(sources.length, 2);
  const source = sources.find(source => source.isSalary);
  const latest = salaryFilterCycle(source, 0, now);
  assert.equal(latest.startDay, '2026-09-25'); assert.equal(latest.endDay, '2026-10-07');
  const previous = salaryFilterCycle(source, 1, now);
  assert.equal(previous.startDay, '2026-03-27'); assert.equal(previous.endDay, '2026-09-25');
  assert.equal(previous.endExclusive, new Date('2026-09-25T10:00:00').getTime());
  assert.equal(salaryFilterCycle(source, 2, now).endDay, '2026-03-27');
});

test('multiple credits on one salary day create one boundary; offsets clamp to available cycles', () => {
  const source = salaryFilterSources([row('a', 'DXC'), row('b', 'DXC', 'Salary', '2026-09-25T14:00:00'), row('c', 'DXC', 'Salary', '2026-08-25T10:00:00')], now)[0];
  assert.equal(salaryFilterCycle(source, 0, now).count, 2);
  assert.equal(salaryFilterCycle(source, 999, now).offset, 1);
  assert.equal(salaryFilterCycle(source, -1, now).offset, 0);
});

test('month arrows use full inclusive months and roll across years without end-of-month drift', () => {
  const previous = ledgerMonthPeriod('2026-01-31', -1, now);
  assert.equal(previous.startDay, '2025-12-01'); assert.equal(previous.endDay, '2025-12-31');
  const next = ledgerMonthPeriod('2025-12-31', 1, now);
  assert.equal(next.startDay, '2026-01-01'); assert.equal(next.endDay, '2026-01-31');
  assert.equal(ledgerMonthPeriod('2026-03-31', -1, now).endDay, '2026-02-28');
  assert.equal(ledgerMonthPeriod('2024-03-31', -1, now).endDay, '2024-02-29');
});

test('All dates to Month defaults to current month, including future dated ledger rows in that month', () => {
  const period = ledgerMonthPeriod('', 0, now);
  assert.equal(period.startDay, '2026-10-01'); assert.equal(period.endDay, '2026-10-31');
  assert.equal(ledgerMonthPeriod(period.startDay, 1, now).startDay, '2026-11-01');
});

test('cycle arrows derive offset from applied date and same-day duplicate credits do not create extra steps', () => {
  const source = salaryFilterSources([row('july', 'DXC', 'Salary', '2026-07-24T10:00:00'), row('aug', 'DXC', 'Salary', '2026-08-25T10:00:00'), row('sep', 'DXC'), row('extra', 'DXC', 'Salary', '2026-09-25T15:00:00')], now)[0];
  let offset = salaryCycleOffset(source, '2026-08-25');
  assert.equal(offset, 1);
  const older = salaryFilterCycle(source, offset + 1, now);
  assert.equal(older.startDay, '2026-07-24'); assert.equal(older.endDay, '2026-08-25');
  offset = salaryCycleOffset(source, older.startDay);
  const newer = salaryFilterCycle(source, offset - 1, now);
  assert.equal(newer.startDay, '2026-08-25'); assert.equal(newer.endDay, '2026-09-25');
  assert.equal(salaryCycleOffset(source, 'missing'), 0);
});

test('actual ledger navigation handler changes dates only, keeps other filters, and uses selected salary', () => {
  const screen = fs.readFileSync('screens/RedCoinsScreen.tsx', 'utf8');
  const block = screen.slice(screen.indexOf('  const changeLedgerPeriod ='), screen.indexOf('  const report ='));
  const source = salaryFilterSources([row('aug', 'DXC', 'Salary', '2026-08-25T10:00:00'), row('sep', 'DXC')], now)[0];
  function harness(mode, startDay) {
    const values = { types: ['expense'], accounts: ['Aeon'], categories: ['Food'], subcategories: ['Dining'], search: 'coffee' };
    const forbidden = () => { throw Error('Period navigation must not replace unrelated filters'); };
    const output = {};
    const context = { exports: output, console, filterDateMode: mode, filterStartDay: startDay, ledgerSalary: source, ledgerCycleOffset: salaryCycleOffset(source, startDay), ledgerMonthPeriod, salaryFilterCycle, Keyboard: { dismiss: () => {} }, Alert: { alert: () => {} }, AsyncStorage: { setItem: async () => {} }, SALARY_FILTER_SOURCE_KEY: 'test', salarySelectionTouched: { current: false }, setFilterDateMode: value => { values.mode = value; }, setFilterStartDay: value => { values.startDay = value; }, setFilterEndDay: value => { values.endDay = value; }, setFilterDateLabel: value => { values.label = value; }, setReportLedgerWindow: () => {}, setSelectedIds: () => {}, setFilterSalaryKey: value => { values.salaryKey = value; }, setFilterOpen: () => {}, setFilterTypes: forbidden, setFilterAccounts: forbidden, setFilterCategories: forbidden, setFilterSubcategories: forbidden, setSearch: forbidden };
    vm.runInNewContext(ts.transpileModule(`${block}\nexports.navigate = changeLedgerPeriod;`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, context);
    return { values, navigate: output.navigate };
  }
  const month = harness('month', '2026-01-01'); month.navigate('month', -1);
  assert.equal(month.values.startDay, '2025-12-01'); assert.equal(month.values.endDay, '2025-12-31');
  const cycle = harness('cycle', '2026-09-25'); cycle.navigate('cycle', -1);
  assert.equal(cycle.values.startDay, '2026-08-25'); assert.equal(cycle.values.salaryKey, source.key);
  cycle.navigate('all'); assert.equal(cycle.values.startDay, ''); assert.equal(cycle.values.endDay, '');
  for (const result of [month.values, cycle.values]) {
    assert.deepEqual(result.accounts, ['Aeon']); assert.deepEqual(result.categories, ['Food']); assert.equal(result.search, 'coffee');
  }
});
