import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';
import type { RedCoinsState } from './redcoins';

const LEGACY_KEY = 'redcoins_state_v1';
const CHECKPOINT_KEY = 'redcoins_pre_sqlite_v1';
const REVISION = Symbol('redcoinsSqlRevision');
const GROUPS = ['entries', 'accounts', 'categories', 'reminders'] as const;
type Group = typeof GROUPS[number];
type Row = { kind: Group; id: string; rank: number; payload: string };
type Versioned = RedCoinsState & { [REVISION]?: number };
export function markRedCoinsRevision(state: RedCoinsState, revision: number) {
  Object.defineProperty(state, REVISION, { value: revision, enumerable: true, configurable: true, writable: true });
}
let database: Promise<SQLite.SQLiteDatabase> | null = null;
let cache: { revision: number; state: RedCoinsState; rows: Map<string, Row> } | null = null;

/** Clone records without serializing the whole ledger; keep the concurrency token. */
export function cloneRedCoinsState<T>(value: T): T {
  if (Array.isArray(value)) return value.map(cloneRedCoinsState) as T;
  if (value && typeof value === 'object') {
    const result: Record<PropertyKey, unknown> = {};
    for (const key of Reflect.ownKeys(value)) Object.defineProperty(result, key, { value: cloneRedCoinsState((value as Record<PropertyKey, unknown>)[key]), enumerable: true, configurable: true, writable: true });
    return result as T;
  }
  return value;
}
const rowKey = (kind: string, id: string) => `${kind}:${id}`;
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical((value as Record<string,unknown>)[key])])) : value;
const metadata = (state: RedCoinsState) => {
  const { entries, accounts, categories, reminders, ...rest } = state;
  return JSON.stringify(rest);
};
function records(state: RedCoinsState, previous = new Map<string, Row>(), entryIds?: string[]): Row[] {
  const rows: Row[] = [];
  for (const kind of GROUPS) {
    const items = state[kind] || [];
    const seen = new Set<string>();
    const ranks = items.map(item => previous.get(rowKey(kind, item.id))?.rank);
    // Preserve stable ranks for ordinary prepend/edit/delete. Rebase only for
    // actual reordering or exhausted floating-point gaps (never on each insert).
    const known = ranks.filter((rank): rank is number => rank !== undefined);
    const rebase = known.some((rank, i) => i > 0 && rank <= known[i - 1]);
    const nextKnown: (number | undefined)[] = new Array(items.length);
    let following: number | undefined;
    for (let i = items.length - 1; i >= 0; i--) { nextKnown[i] = following; if (ranks[i] !== undefined) following = ranks[i]; }
    let preceding: number | undefined;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item || typeof item.id !== 'string' || !item.id || seen.has(item.id)) throw new Error(`Invalid or duplicate ${kind} ID. Migration/save cancelled without changing balances.`);
      seen.add(item.id);
      const old = previous.get(rowKey(kind, item.id));
      const next = nextKnown[i];
      const rank = rebase ? i * 1024 : ranks[i] ?? (preceding === undefined ? (next ?? 1024) - 1024 : next === undefined ? preceding + 1024 : (preceding + next) / 2);
      if (preceding !== undefined && rank <= preceding) return records(state, new Map(), entryIds);
      preceding = rank;
      // The normal logger provides its changed ID. Unchanged ledger payloads
      // already in SQLite are not stringified or written again.
      const payload = kind === 'entries' && entryIds && !entryIds.includes(item.id) && old ? old.payload : JSON.stringify(item);
      rows.push({ kind, id: item.id, rank, payload });
    }
  }
  return rows;
}
function unpack(meta: string, rows: Row[], revision: number): RedCoinsState {
  const state = JSON.parse(meta) as Versioned;
  for (const kind of GROUPS) (state[kind] as unknown[]) = rows.filter(row => row.kind === kind).sort((a, b) => a.rank - b.rank).map(row => JSON.parse(row.payload));
  markRedCoinsRevision(state, revision);
  return state;
}
export function openRedCoinsSql(): Promise<SQLite.SQLiteDatabase> {
  if (!database) database = (async () => {
    const db = await SQLite.openDatabaseAsync('redcoins-store.db');
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = FULL;
      CREATE TABLE IF NOT EXISTS rc_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS rc_recovery (key TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS rc_records (kind TEXT NOT NULL, id TEXT NOT NULL, rank REAL NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)), PRIMARY KEY(kind,id));
      CREATE INDEX IF NOT EXISTS rc_entry_date ON rc_records(kind,json_extract(payload,'$.date') DESC,id DESC);
      CREATE INDEX IF NOT EXISTS rc_entry_account ON rc_records(kind,json_extract(payload,'$.account'));
      CREATE INDEX IF NOT EXISTS rc_entry_type ON rc_records(kind,json_extract(payload,'$.type'));
      CREATE VIEW IF NOT EXISTS redcoins_entries AS SELECT id,
        json_extract(payload,'$.type') type, json_extract(payload,'$.item') item,
        json_extract(payload,'$.amount') amount, json_extract(payload,'$.date') date,
        json_extract(payload,'$.account') account, json_extract(payload,'$.toAccount') to_account,
        json_extract(payload,'$.category') category, json_extract(payload,'$.subcategory') subcategory,
        json_extract(payload,'$.note') note, json_extract(payload,'$.labels') labels,
        json_extract(payload,'$.status') status, json_extract(payload,'$.repeat') repeat_value,
        json_extract(payload,'$.installments') installments, json_extract(payload,'$.split') split_value,
        json_extract(payload,'$.attachment') attachment, json_extract(payload,'$.origin') origin,
        json_extract(payload,'$.exportedAt') exported_at, json_extract(payload,'$.editedAt') edited_at,
        lower(coalesce(json_extract(payload,'$.item'),'') || ' ' || coalesce(json_extract(payload,'$.category'),'') || ' ' || coalesce(json_extract(payload,'$.subcategory'),'') || ' ' || coalesce(json_extract(payload,'$.account'),'') || ' ' || coalesce(json_extract(payload,'$.toAccount'),'') || ' ' || coalesce(json_extract(payload,'$.note'),'')) search_text
      FROM rc_records WHERE kind='entries';
    `);
    const version = await metaValue(db, 'schemaVersion');
    if (version && version !== '1') throw new Error('RedCoins database uses an unsupported schema. Do not downgrade or overwrite it.');
    return db;
  })().catch(error => { database = null; throw error; });
  return database;
}
async function metaValue(db: Pick<SQLite.SQLiteDatabase, 'getFirstAsync'>, key: string) {
  return (await db.getFirstAsync<{ value: string }>('SELECT value FROM rc_meta WHERE key=?', key))?.value;
}
export async function saveRedCoinsRecovery(key: string, raw: string) {
  const db = await openRedCoinsSql();
  const existing = await db.getFirstAsync<{ payload: string }>('SELECT payload FROM rc_recovery WHERE key=?', key);
  if (existing) return;
  // Preserve any checkpoint made by an earlier APK. Never create another
  // ledger-sized AsyncStorage entry: Android caps that database at 6 MB.
  const original = await AsyncStorage.getItem(key) ?? raw;
  await db.runAsync('INSERT OR IGNORE INTO rc_recovery(key,payload) VALUES (?,?)', key, original);
  const verified = await db.getFirstAsync<{ payload: string }>('SELECT payload FROM rc_recovery WHERE key=?', key);
  if (verified?.payload !== original) throw new Error('SQLite migration safety checkpoint could not be verified. Original data kept.');
}
async function applyRows(tx: Pick<SQLite.SQLiteDatabase, 'prepareAsync' | 'runAsync'>, state: RedCoinsState, previous: Map<string, Row>, revision: number, entryIds?: string[]) {
  if (state.accounts.some(account => !Number.isFinite(account.balance)) || state.entries.some(entry => !Number.isFinite(entry.amount))) throw new Error('Invalid money values. Nothing was saved.');
  const next = records(state, previous, entryIds);
  const nextMap = new Map(next.map(row => [rowKey(row.kind, row.id), row]));
  const insert = await tx.prepareAsync('INSERT OR REPLACE INTO rc_records(kind,id,rank,payload) VALUES (?,?,?,?)');
  try {
    for (const row of next) {
      const old = previous.get(rowKey(row.kind, row.id));
      if (!old || old.payload !== row.payload || old.rank !== row.rank) await insert.executeAsync(row.kind, row.id, row.rank, row.payload);
    }
  } finally { await insert.finalizeAsync(); }
  for (const old of previous.values()) if (!nextMap.has(rowKey(old.kind, old.id))) await tx.runAsync('DELETE FROM rc_records WHERE kind=? AND id=?', old.kind, old.id);
  const meta = metadata(state);
  await tx.runAsync('INSERT OR REPLACE INTO rc_meta(key,value) VALUES (?,?)', 'state', meta);
  await tx.runAsync('INSERT OR REPLACE INTO rc_meta(key,value) VALUES (?,?)', 'revision', String(revision));
  await tx.runAsync('INSERT OR REPLACE INTO rc_meta(key,value) VALUES (?,?)', 'initialized', '1');
  await tx.runAsync('INSERT OR REPLACE INTO rc_meta(key,value) VALUES (?,?)', 'schemaVersion', '1');
  const snapshot = cloneRedCoinsState(state);
  markRedCoinsRevision(snapshot, revision);
  return { revision, state: snapshot, rows: nextMap };
}
/** One-time exact snapshot migration. No FYDB, no balance replay, no deletion of recovery JSON. */
async function migrate(db: SQLite.SQLiteDatabase) {
  if (await metaValue(db, 'initialized')) return;
  const count = await db.getFirstAsync<{ count: number }>('SELECT count(*) count FROM rc_records');
  if (count?.count) throw new Error('RedCoins migration marker is missing. Existing SQL data kept; restore a verified backup.');
  const raw = await AsyncStorage.getItem(LEGACY_KEY);
  if (!raw) return;
  const state = JSON.parse(raw) as RedCoinsState;
  if (!Array.isArray(state.entries) || !Array.isArray(state.accounts) || !Array.isArray(state.categories) || (state.reminders !== undefined && !Array.isArray(state.reminders))) throw new Error('Legacy RedCoins snapshot is invalid. Original JSON kept; restore a verified backup.');
  if (state.accounts.some(account => !Number.isFinite(account.balance)) || state.entries.some(entry => !Number.isFinite(entry.amount))) throw new Error('Invalid money values. SQLite migration cancelled; original data kept.');
  await saveRedCoinsRecovery(CHECKPOINT_KEY, raw);
  // Releases before reminders existed have no field. Keep the original JSON
  // checkpoint byte-for-byte, then add only the missing optional collection.
  state.reminders ??= [];
  let migrated: typeof cache = null;
  await db.withExclusiveTransactionAsync(async tx => {
    if (await metaValue(tx, 'initialized')) return;
    migrated = await applyRows(tx, state, new Map(), 1);
    const actual = await tx.getAllAsync<Row>('SELECT kind,id,rank,payload FROM rc_records');
    const expected = migrated.rows;
    if (actual.length !== expected.size || actual.some(row => { const old = expected.get(rowKey(row.kind,row.id)); return !old || row.payload !== old.payload || row.rank !== old.rank; }) || await metaValue(tx, 'state') !== metadata(state)) throw new Error('SQLite migration verification failed; transaction rolled back.');
  });
  if (migrated) cache = migrated;
}
async function replayPreferences(db: SQLite.SQLiteDatabase) {
  await db.withExclusiveTransactionAsync(async tx => {
    const raw = await metaValue(tx, 'pendingPreferences');
    if (!raw) return;
    const pairs = Object.entries(JSON.parse(raw) as Record<string,string>);
    if (pairs.length) await AsyncStorage.multiSet(pairs);
    await tx.runAsync('DELETE FROM rc_meta WHERE key=?', 'pendingPreferences');
  });
}
/** Audit passes migrateLegacy=false: never applies due entries or migrates legacy finance data. */
export async function readRedCoinsSql(migrateLegacy = true): Promise<RedCoinsState | null> {
  const db = await openRedCoinsSql();
  if (migrateLegacy) { await migrate(db); await replayPreferences(db); }
  let result: RedCoinsState | null = null;
  await db.withExclusiveTransactionAsync(async tx => {
    const revision = await metaValue(tx, 'revision');
    if (!revision) {
      const count = await tx.getFirstAsync<{ count: number }>('SELECT count(*) count FROM rc_records');
      if (await metaValue(tx, 'initialized') || count?.count) throw new Error('RedCoins SQL revision is missing. Database kept; restore a verified backup.');
      return;
    }
    if (!Number.isSafeInteger(Number(revision)) || Number(revision) < 1) throw new Error('RedCoins SQL revision is invalid. Database kept.');
    if (cache?.revision === Number(revision)) { result = cloneRedCoinsState(cache.state); return; }
    const meta = await metaValue(tx, 'state');
    if (!meta) throw new Error('RedCoins SQLite metadata is missing. Original recovery JSON was not overwritten.');
    const rows = await tx.getAllAsync<Row>('SELECT kind,id,rank,payload FROM rc_records');
    cache = { revision: Number(revision), state: unpack(meta, rows, Number(revision)), rows: new Map(rows.map(row => [rowKey(row.kind,row.id),row])) };
    result = cloneRedCoinsState(cache.state);
  });
  if (!result && !migrateLegacy) { const raw = await AsyncStorage.getItem(LEGACY_KEY); return raw ? JSON.parse(raw) : null; }
  return result;
}
export async function hasRedCoinsSqlData() {
  const db = await openRedCoinsSql();
  return !!await metaValue(db, 'initialized') || !!await AsyncStorage.getItem(LEGACY_KEY);
}
/** Records + account balances + schedules + metadata commit atomically. */
export async function writeRedCoinsSql(state: RedCoinsState, options: { entryIds?: string[]; expectedRaw?: string; preferences?: Record<string,string> } = {}) {
  const db = await openRedCoinsSql();
  await migrate(db);
  let committed: typeof cache = null;
  let savedRevision = 0;
  await db.withExclusiveTransactionAsync(async tx => {
    const revision = Number(await metaValue(tx, 'revision') || 0);
    if (!Number.isSafeInteger(revision) || revision < 0 || (revision === 0 && await metaValue(tx, 'initialized'))) throw new Error('RedCoins SQL revision is invalid. Nothing was saved.');
    let previous = cache?.revision === revision ? cache.rows : new Map<string,Row>();
    if (revision && cache?.revision !== revision) { const rows = await tx.getAllAsync<Row>('SELECT kind,id,rank,payload FROM rc_records'); previous = new Map(rows.map(row => [rowKey(row.kind,row.id),row])); }
    if (options.expectedRaw !== undefined) {
      const meta = await metaValue(tx, 'state');
      const current = meta ? unpack(meta, [...previous.values()], revision) : null;
      if (JSON.stringify(canonical(current)) !== JSON.stringify(canonical(JSON.parse(options.expectedRaw)))) throw new Error('RedCoins changed while the preview was open. Preview it again.');
    } else if ((state as Versioned)[REVISION] !== undefined && (state as Versioned)[REVISION] !== revision) {
      throw new Error('RedCoins changed during this edit. Please reopen and try again.');
    }
    committed = await applyRows(tx, state, previous, revision + 1, options.entryIds);
    savedRevision = revision + 1;
    if (options.preferences) await tx.runAsync('INSERT OR REPLACE INTO rc_meta(key,value) VALUES (?,?)', 'pendingPreferences', JSON.stringify(options.preferences));
  });
  if (committed) cache = committed;
  // Preference replay is journalled in the SAME commit. If native mirroring
  // fails after commit, next load retries; never report the ledger as unsaved.
  if (options.preferences) { try { await replayPreferences(db); } catch (error) { console.warn('RedCoins saved; preference replay will retry', error); } }
  return savedRevision;
}
