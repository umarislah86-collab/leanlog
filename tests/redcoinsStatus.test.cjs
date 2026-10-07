const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const api = {};
const compile = code => ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
vm.runInNewContext(compile(fs.readFileSync('services/redcoinsStatus.ts', 'utf8')), { exports: api });
const { bluecoinsReviewStatus, repairLegacyBluecoinsStatuses } = api;

test('Bluecoins 0/1/2/3 map to None/Cleared/Reconciled/Void, never Pending', () => {
  assert.deepEqual([0, 1, 2, 3].map(bluecoinsReviewStatus), ['none', 'cleared', 'reconciled', 'void']);
  for (const value of [null, undefined, 999, NaN]) assert.equal(bluecoinsReviewStatus(value), 'none');
  const source = fs.readFileSync('services/bluecoins.ts', 'utf8');
  assert.ok(source.includes('status: bluecoinsReviewStatus(row.status)'));
  assert.ok(source.includes('sourceStatus: row.status'));
});

test('lossy old Pending is unclassified, not falsely cleared, without changing balances/dates/amounts', () => {
  const state = { accounts: [{ balance: 1856.97 }], entries: [{ id: 'old', origin: 'bluecoins', status: 'pending', date: '2026-08-01', amount: 100 }] };
  assert.equal(repairLegacyBluecoinsStatuses(state), true);
  assert.equal(state.entries[0].status, 'none'); assert.equal(state.entries[0].legacyStatusUnknown, true);
  assert.equal(state.accounts[0].balance, 1856.97); assert.equal(state.entries[0].amount, 100); assert.equal(state.entries[0].date, '2026-08-01');
  const once = JSON.stringify(state); assert.equal(repairLegacyBluecoinsStatuses(state), false); assert.equal(JSON.stringify(state), once);
});

test('user edits, real local Pending, new mapped rows and existing Cleared/Reconciled are preserved', () => {
  const rows = [
    { origin: 'bluecoins', status: 'pending', editedAt: '2026-10-07' },
    { origin: 'redcoins', status: 'pending' },
    { origin: 'bluecoins', status: 'pending', statusMappingVersion: 1 },
    { origin: 'bluecoins', status: 'cleared' }, { origin: 'bluecoins', status: 'reconciled' },
  ];
  repairLegacyBluecoinsStatuses({ entries: rows });
  assert.deepEqual(rows.map(row => row.status), ['pending', 'pending', 'pending', 'cleared', 'reconciled']);
});

test('known raw source status can restore reconciliation/void without guessing', () => {
  const rows = [0, 1, 2, 3].map(sourceStatus => ({ origin: 'bluecoins', status: 'pending', sourceStatus }));
  repairLegacyBluecoinsStatuses({ entries: rows });
  assert.deepEqual(rows.map(row => row.status), ['none', 'cleared', 'reconciled', 'void']);
});

test('SQLite index fingerprint notices a status-only migration without an editedAt timestamp', () => {
  const source = fs.readFileSync('services/redcoinsLedger.ts', 'utf8');
  const block = source.slice(source.indexOf('const fingerprint ='), source.indexOf('export async function syncRedCoinsLedger'));
  const output = {};
  vm.runInNewContext(compile(`${block}\nexports.fingerprint = fingerprint;`), { exports: output, LEDGER_INDEX_VERSION: 1 });
  const row = { id: 'old', date: '2026-08-01', status: 'pending' };
  assert.notEqual(output.fingerprint([row]), output.fingerprint([{ ...row, status: 'none' }]));
});
