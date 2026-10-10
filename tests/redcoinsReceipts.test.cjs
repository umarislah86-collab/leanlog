const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { sqliteHarness } = require('./helpers/redcoins-sql.cjs');
function load(name, mocks = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(`services/${name}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, { exports, Date, console, require: id => {
    if (id in mocks) return mocks[id];
    if (id === './receiptFiles') return load('receiptFiles');
    throw Error(`Unexpected dependency ${id}`);
  } });
  return exports;
}
const entry = { id: 'entry-12345', item: 'Books / school', amount: 123.45, date: '2026-10-10T12:00:00' };
const receipt = () => ({ id: 'rc-original-123', originalName: 'receipt.pdf', mimeType: 'application/pdf', size: 456, md5: 'a'.repeat(32), localFileName: 'rc-original-123.pdf', createdAt: '2026-10-10T12:01:00', status: 'pending' });
function serviceRuntime(options = {}) {
  const sql = sqliteHarness(); const values = new Map();
  const storage = { getItem: async key => values.get(key) ?? null, setItem: async (key, value) => values.set(key, value), removeItem: async key => values.delete(key), multiSet: async pairs => pairs.forEach(([k, v]) => values.set(k, v)) };
  const store = load('redcoinsSqlStore', { 'expo-sqlite': sql.expo, '@react-native-async-storage/async-storage': storage });
  const files = new Map([['file:///source.pdf', { exists: true, isDirectory: false, size: 456, md5: 'a'.repeat(32) }]]);
  const filesystem = { documentDirectory: 'file:///app/', FileSystemUploadType: { BINARY_CONTENT: 0 }, FileSystemSessionType: { FOREGROUND: 0 }, getInfoAsync: async uri => files.get(uri) || { exists: false }, makeDirectoryAsync: async () => {}, copyAsync: async ({ from, to }) => { files.set(to, { ...files.get(from) }); }, deleteAsync: async uri => { files.delete(uri); }, uploadAsync: options.upload || (async () => { throw Error('unused'); }) };
  let serial = 0;
  const folder = 'content://folder';
  const bytes = 'JVBERi1vcmlnaW5hbA==';
  filesystem.EncodingType = { Base64: 'base64' };
  filesystem.StorageAccessFramework = {
    requestDirectoryPermissionsAsync: async () => ({ granted: true, directoryUri: folder }),
    readDirectoryAsync: async uri => [...files.keys()].filter(key => key.startsWith(uri + '/')),
    createFileAsync: async (uri, name) => { const key = `${uri}/file-${++serial}`; files.set(key, { exists: true, data: '', name }); return key; },
  };
  filesystem.readAsStringAsync = async uri => { const value = files.get(uri); if (!value) throw Error('missing file'); return value.data ?? bytes; };
  filesystem.writeAsStringAsync = async (uri, data) => { const file = files.get(uri); if (!file) throw Error('missing file'); file.data = data; };
  let conflict = null;
  const service = { loadRedCoins: () => store.readRedCoinsSql(), saveRedCoins: async (state, source, ids) => { if (conflict) { const cb = conflict; conflict = null; await cb(); } return store.writeRedCoinsSql(state, { entryIds: ids }); } };
  const receipts = load('redcoinsReceipts', { '@react-native-async-storage/async-storage': storage, 'expo-file-system/legacy': filesystem,  'react-native': { Platform: { OS: 'android' } }, './redcoins': service,  });
  const initial = { monthlyBudget: 1000, safetyBuffer: 50, payday: 25, entries: [{ ...entry, type: 'expense', account: 'Bank', category: 'Books', subcategory: '', receipts: [receipt()] }], accounts: [{ id: 'bank', name: 'Bank', balance: 876.55 }], categories: [], reminders: [] };
  // Durable records never store the temporary upload URI.
  delete initial.entries[0].receipts[0].localUri;
  return { sql, store, receipts, files, values, initial, filesystem, folder, bytes, creations: () => serial, conflict: cb => { conflict = cb; } };
}
test('receipt update commits targeted metadata in real SQLite without changing transaction fields or account balances', async () => {
  const r = serviceRuntime(); await r.store.writeRedCoinsSql(r.initial);
  const updated = { ...receipt(), status: 'saved', savedUri: 'content://folder/receipt', savedFolderUri: 'content://folder', savedName: 'receipt.pdf' };
  await r.receipts.updateRedCoinsReceipt(entry.id, updated);
  const saved = await r.store.readRedCoinsSql();
  assert.equal(saved.accounts[0].balance, 876.55); assert.equal(saved.entries[0].amount, 123.45);
  assert.equal(saved.entries[0].receipts[0].status, 'saved'); assert.equal(saved.entries[0].receipts[0].localUri, undefined);
  const restarted = load('redcoinsSqlStore', { 'expo-sqlite': r.sql.expo, '@react-native-async-storage/async-storage': { getItem: async () => null } });
  assert.equal((await restarted.readRedCoinsSql()).entries[0].receipts[0].savedUri, 'content://folder/receipt');
});
test('receipt update retries stale revision against latest financial edit and preserves new note and balance', async () => {
  const r = serviceRuntime(); await r.store.writeRedCoinsSql(r.initial);
  r.conflict(async () => { const latest = await r.store.readRedCoinsSql(); latest.entries[0].note = 'Edited during copy'; latest.accounts[0].balance = 777; await r.store.writeRedCoinsSql(latest); });
  await r.receipts.updateRedCoinsReceipt(entry.id, { ...receipt(), savedUri: 'content://folder/receipt' });
  const saved = await r.store.readRedCoinsSql();
  assert.equal(saved.entries[0].note, 'Edited during copy'); assert.equal(saved.accounts[0].balance, 777);
  assert.equal(saved.entries[0].receipts[0].savedUri, 'content://folder/receipt');
});
test('a deleted transaction or detached receipt cannot be resurrected by folder save completion', async () => {
  const r = serviceRuntime(); await r.store.writeRedCoinsSql({ ...r.initial, entries: [] });
  await assert.rejects(r.receipts.updateRedCoinsReceipt(entry.id, receipt()), /removed/);
  await r.store.writeRedCoinsSql({ ...r.initial, entries: [{ ...r.initial.entries[0], receipts: [] }] });
  await assert.rejects(r.receipts.updateRedCoinsReceipt(entry.id, receipt()), /no longer attached/);
  assert.equal((await r.store.readRedCoinsSql()).entries[0].receipts.length, 0);
});
test('staging retains original byte size/checksum and rejects missing, oversized or unsupported files', async () => {
  const r = serviceRuntime(); const staged = await r.receipts.stageRedCoinsReceipt('file:///source.pdf', 'scan.pdf', 'application/pdf');
  assert.equal(staged.size, 456); assert.equal(staged.md5, 'a'.repeat(32)); assert.equal(staged.status, 'pending'); assert.equal(staged.localUri, undefined);
  assert(r.files.has(r.receipts.receiptLocalUri(staged)));
  await assert.rejects(r.receipts.stageRedCoinsReceipt('file:///missing.pdf', 'scan.pdf', 'application/pdf'), /empty or unavailable/);
  r.files.set('file:///huge.pdf', { exists: true, size: 21 * 1024 * 1024 });
  await assert.rejects(r.receipts.stageRedCoinsReceipt('file:///huge.pdf', 'scan.pdf', 'application/pdf'), /smaller than 20 MB/);
  await assert.rejects(r.receipts.stageRedCoinsReceipt('file:///source.pdf', 'script.exe', 'application/octet-stream'), /photo or PDF/);
});
test('restored metadata cannot read arbitrary local file paths or traverse receipt directory', () => {
  const r = serviceRuntime();
  for (const localFileName of ['../database.db', '/etc/passwd', 'file:///app/secret.pdf', 'rc-another-file.pdf']) assert.equal(r.receipts.receiptLocalUri({ ...receipt(), localFileName }), undefined);
  assert.equal(r.receipts.receiptLocalUri({ ...receipt(), localFileName: undefined, localUri: 'file:///app/secret.pdf' }), undefined);
});
test('discarding an unsaved draft frees only its app copy; source and reserved/saved originals survive', async () => {
  const r = serviceRuntime();
  const draft = await r.receipts.stageRedCoinsReceipt('file:///source.pdf', 'scan.pdf', 'application/pdf');
  const reserved = { ...draft, id: 'rc-reserved-123', localFileName: 'rc-reserved-123.pdf', savedUri: 'content://folder/receipt' };
  r.files.set(r.receipts.receiptLocalUri(reserved), { exists: true });
  await r.receipts.discardReceiptDrafts([draft, reserved]);
  assert(r.files.has('file:///source.pdf')); assert(!r.files.has(r.receipts.receiptLocalUri(draft)));
  assert(r.files.has(r.receipts.receiptLocalUri(reserved)));
});
test('failed or corrupted copy is discarded before accepting a draft while source remains intact', async () => {
  for (const interrupted of [true, false]) {
    const r = serviceRuntime();
    r.filesystem.copyAsync = async ({ to }) => { r.files.set(to, { exists: true, size: 456, md5: 'b'.repeat(32) }); if (interrupted) throw Error('disk full'); };
    await assert.rejects(r.receipts.stageRedCoinsReceipt('file:///source.pdf', 'scan.pdf', 'application/pdf'), interrupted ? /disk full/ : /saved completely/);
    assert.equal(r.files.size, 1); assert.equal(r.files.get('file:///source.pdf').md5, 'a'.repeat(32));
  }
});
test('receipt links survive JSON backup validation, while invalid or arbitrary file references are rejected', () => {
  const format = load('redcoinsBackupFormat');
  const r = serviceRuntime(); const state = { ...r.initial, createdAt: '2026-10-01T00:00:00', accounts: [{ ...r.initial.accounts[0], type: 'Bank' }] };
  const backup = () => JSON.stringify({ format: 'redcoins-backup', version: 1, exportedAt: '2026-10-10T00:00:00', state });
  assert.equal(format.parseRedCoinsBackup(backup()).state.entries[0].receipts[0].md5, 'a'.repeat(32));
  state.entries[0].receipts[0].localUri = 'file:///private/other.pdf';
  assert.throws(() => format.parseRedCoinsBackup(backup()), /arbitrary local file paths/);
  delete state.entries[0].receipts[0].localUri;
  state.entries[0].receipts[0].savedUri = 'file:///private/secret';
  assert.throws(() => format.parseRedCoinsBackup(backup()), /Invalid receipt savedUri/);
});

async function ready() {
  const r = serviceRuntime();
  await r.store.writeRedCoinsSql(r.initial);
  r.files.set(r.receipts.receiptLocalUri(receipt()), { exists: true, isDirectory: false, size: 456, md5: 'a'.repeat(32), data: r.bytes });
  await r.receipts.chooseReceiptFolder();
  return r;
}
test('folder picker remembers grant and cancellation preserves the previous folder', async () => {
  const r = await ready();
  assert.equal((await r.receipts.savedReceiptFolder()).folderUri, r.folder);
  r.filesystem.StorageAccessFramework.requestDirectoryPermissionsAsync = async () => ({ granted: false });
  assert.equal(await r.receipts.chooseReceiptFolder(), null);
  assert.equal((await r.receipts.savedReceiptFolder()).folderUri, r.folder);
  await r.receipts.clearReceiptFolder();
  assert.equal(await r.receipts.savedReceiptFolder(), null);
});
test('folder save verifies original bytes and commits only receipt metadata with an audit-friendly filename', async () => {
  const r = await ready();
  const done = await r.receipts.saveReceiptToFolder(entry.id, receipt().id);
  assert.equal(done.status, 'saved');
  assert.equal(r.files.get(done.savedUri).data, r.bytes);
  assert.match(done.savedName, /^2026-10-10_Books _ school_RM123.45_entry-12345_rc-original-123.pdf$/);
  assert.equal(done.savedFolderUri, r.folder);
  const saved = await r.store.readRedCoinsSql();
  assert.equal(saved.accounts[0].balance, 876.55);
  assert.equal(saved.entries[0].amount, 123.45);
  assert(!JSON.stringify(saved).includes(r.bytes));
  await r.receipts.saveReceiptToFolder(entry.id, receipt().id);
  assert.equal(r.creations(), 1);
});
test('retry recovers a completed folder write after a lost response without creating another file', async () => {
  const r = await ready(), write = r.filesystem.writeAsStringAsync;
  r.filesystem.writeAsStringAsync = async (uri, data) => { await write(uri, data); throw Error('provider interrupted'); };
  await assert.rejects(r.receipts.saveReceiptToFolder(entry.id, receipt().id), /interrupted/);
  const failed = (await r.store.readRedCoinsSql()).entries[0].receipts[0];
  assert.equal(failed.status, 'failed'); assert(failed.savedUri);
  r.filesystem.writeAsStringAsync = async () => { throw Error('should not rewrite verified copy'); };
  assert.equal((await r.receipts.saveReceiptToFolder(entry.id, receipt().id)).status, 'saved');
  assert.equal(r.creations(), 1);
});
test('partial or corrupted folder copy is detected and retry repairs the reserved file', async () => {
  const r = await ready(), write = r.filesystem.writeAsStringAsync;
  r.filesystem.writeAsStringAsync = async (uri) => { r.files.get(uri).data = 'bad'; };
  await assert.rejects(r.receipts.saveReceiptToFolder(entry.id, receipt().id), /verification failed/);
  r.filesystem.writeAsStringAsync = write;
  const saved = await r.receipts.saveReceiptToFolder(entry.id, receipt().id);
  assert.equal(r.files.get(saved.savedUri).data, r.bytes);
  assert.equal(r.creations(), 1);
});
test('folder permission failure or missing original leaves financial data and original reference intact', async () => {
  const r = await ready();
  r.filesystem.StorageAccessFramework.readDirectoryAsync = async () => { throw Error('permission revoked'); };
  await assert.rejects(r.receipts.saveReceiptToFolder(entry.id, receipt().id), /permission revoked/);
  assert.equal(r.creations(), 0);
  assert.equal((await r.store.readRedCoinsSql()).accounts[0].balance, 876.55);
  r.files.delete(r.receipts.receiptLocalUri(receipt()));
  await assert.rejects(r.receipts.saveReceiptToFolder(entry.id, receipt().id), /missing or changed/);
});
test('restored receipt destination outside the granted folder cannot be overwritten', async () => {
  const r = await ready();
  const foreign = 'content://private/secret.pdf';
  r.files.set(foreign, { exists: true, data: 'private' });
  await r.receipts.updateRedCoinsReceipt(entry.id, { ...receipt(), savedUri: foreign, savedFolderUri: r.folder });
  const done = await r.receipts.saveReceiptToFolder(entry.id, receipt().id);
  assert.notEqual(done.savedUri, foreign);
  assert.equal(r.files.get(foreign).data, 'private');
});
test('changing folder after interrupted write does not silently redirect the reserved receipt', async () => {
  const r = await ready();
  r.filesystem.writeAsStringAsync = async () => { throw Error('interrupted'); };
  await assert.rejects(r.receipts.saveReceiptToFolder(entry.id, receipt().id), /interrupted/);
  r.filesystem.StorageAccessFramework.requestDirectoryPermissionsAsync = async () => ({ granted: true, directoryUri: 'content://another' });
  await r.receipts.chooseReceiptFolder();
  await assert.rejects(r.receipts.saveReceiptToFolder(entry.id, receipt().id), /original receipt folder/);
  assert.equal(r.creations(), 1);
});

test('restored destination inside the selected folder cannot overwrite an unrelated document', async () => {
  const r = await ready();
  const foreign = `${r.folder}/important.pdf`;
  r.files.set(foreign, { exists: true, data: 'private' });
  await r.receipts.updateRedCoinsReceipt(entry.id, { ...receipt(), savedUri: foreign, savedFolderUri: r.folder });
  const done = await r.receipts.saveReceiptToFolder(entry.id, receipt().id);
  assert.notEqual(done.savedUri, foreign);
  assert.equal(r.files.get(foreign).data, 'private');
});
