import * as SQLite from 'expo-sqlite';
import type { RedCoinsEntry, RedCoinsType } from './redcoins';

const DB_NAME = 'redcoins-ledger.db';
const LEDGER_INDEX_VERSION = '2';
let database: Promise<SQLite.SQLiteDatabase> | null = null;

const openLedger = () => {
  if (!database) database = (async () => {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      CREATE TABLE IF NOT EXISTS redcoins_entries (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL,
        item TEXT NOT NULL,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        account TEXT NOT NULL,
        to_account TEXT,
        category TEXT NOT NULL,
        subcategory TEXT NOT NULL,
        note TEXT,
        labels TEXT,
        status TEXT,
        repeat_value TEXT,
        installments INTEGER,
        split_value TEXT,
        attachment TEXT,
        origin TEXT,
        exported_at TEXT,
        edited_at TEXT,
        search_text TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS redcoins_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS redcoins_entries_date_idx ON redcoins_entries(date DESC, id DESC);
      CREATE INDEX IF NOT EXISTS redcoins_entries_type_idx ON redcoins_entries(type);
      CREATE INDEX IF NOT EXISTS redcoins_entries_account_idx ON redcoins_entries(account);
      CREATE INDEX IF NOT EXISTS redcoins_entries_category_idx ON redcoins_entries(category);
    `);
    const indexedVersion = await db.getFirstAsync<{ value: string }>('SELECT value FROM redcoins_meta WHERE key = ?', 'search_index_version');
    if (indexedVersion?.value !== LEDGER_INDEX_VERSION) {
      await db.execAsync(`
        UPDATE redcoins_entries
        SET search_text = lower(
          coalesce(item, '') || ' ' || coalesce(category, '') || ' ' ||
          coalesce(subcategory, '') || ' ' || coalesce(account, '') || ' ' ||
          coalesce(to_account, '') || ' ' || coalesce(note, '')
        );
        INSERT OR REPLACE INTO redcoins_meta(key,value) VALUES ('search_index_version','2');
      `);
    }
    return db;
  })();
  return database;
};

const normalizedSearch = (entry: RedCoinsEntry) => [entry.item, entry.category, entry.subcategory, entry.account, entry.toAccount, entry.note]
  .filter(Boolean).join(' ').toLowerCase();

const values = (entry: RedCoinsEntry) => [
  entry.id, entry.type, entry.item, entry.amount, entry.date, entry.account, entry.toAccount || null,
  entry.category, entry.subcategory, entry.note || null, JSON.stringify(entry.labels || []), entry.status || null,
  entry.repeat || null, entry.installments || null, entry.split || null, entry.attachment || null,
  entry.origin || null, entry.exportedAt || null, entry.editedAt || null, normalizedSearch(entry),
];

const UPSERT = `INSERT OR REPLACE INTO redcoins_entries
  (id,type,item,amount,date,account,to_account,category,subcategory,note,labels,status,repeat_value,installments,split_value,attachment,origin,exported_at,edited_at,search_text)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;

const fingerprint = (entries: RedCoinsEntry[]) => {
  let hash = 2166136261;
  entries.forEach((entry) => {
    const token = `${entry.id}|${entry.date}|${entry.editedAt || ''}|${entry.exportedAt || ''}`;
    for (let index = 0; index < token.length; index += 1) hash = Math.imul(hash ^ token.charCodeAt(index), 16777619);
  });
  return `${LEDGER_INDEX_VERSION}:${entries.length}:${hash >>> 0}`;
};

export async function syncRedCoinsLedger(entries: RedCoinsEntry[]) {
  const db = await openLedger();
  const signature = fingerprint(entries);
  const current = await db.getFirstAsync<{ value: string }>('SELECT value FROM redcoins_meta WHERE key = ?', 'fingerprint');
  if (current?.value === signature) return;
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM redcoins_entries');
    const statement = await db.prepareAsync(UPSERT);
    try {
      for (const entry of entries) await statement.executeAsync(values(entry));
    } finally { await statement.finalizeAsync(); }
    await db.runAsync('INSERT OR REPLACE INTO redcoins_meta(key,value) VALUES (?,?)', 'fingerprint', signature);
  });
}

export async function upsertRedCoinsLedgerEntry(entry: RedCoinsEntry) {
  const db = await openLedger();
  await db.runAsync(UPSERT, values(entry));
  await db.runAsync('DELETE FROM redcoins_meta WHERE key = ?', 'fingerprint');
}

export async function deleteRedCoinsLedgerEntry(id: string) {
  const db = await openLedger();
  await db.runAsync('DELETE FROM redcoins_entries WHERE id = ?', id);
  await db.runAsync('DELETE FROM redcoins_meta WHERE key = ?', 'fingerprint');
}

export interface LedgerQuery {
  search: string;
  types: RedCoinsType[];
  accounts: string[];
  categories: string[];
  subcategories: string[];
  day: string;
  limit: number;
}

type EntryRow = Omit<RedCoinsEntry, 'labels'> & { to_account: string | null; labels: string | null; repeat_value: RedCoinsEntry['repeat']; split_value: string | null; exported_at: string | null; edited_at: string | null };

const parseLabels = (value: string | null) => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((label): label is string => typeof label === 'string') : [];
  } catch {
    return [];
  }
};

const mapRow = (row: EntryRow): RedCoinsEntry => ({
  id: row.id, type: row.type, item: row.item, amount: row.amount, date: row.date, account: row.account,
  toAccount: row.to_account || undefined, category: row.category, subcategory: row.subcategory, note: row.note || undefined,
  labels: parseLabels(row.labels), status: row.status, repeat: row.repeat_value || undefined,
  installments: row.installments || undefined, split: row.split_value || undefined, attachment: row.attachment || undefined,
  origin: row.origin, exportedAt: row.exported_at || undefined, editedAt: row.edited_at || undefined,
});

const whereFor = (query: LedgerQuery) => {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (query.search.trim()) { clauses.push('instr(search_text, ?) > 0'); params.push(query.search.trim().toLowerCase()); }
  if (query.types.length) {
    clauses.push(`type IN (${query.types.map(() => '?').join(',')})`);
    params.push(...query.types);
  }
  if (query.accounts.length) {
    const placeholders = query.accounts.map(() => '?').join(',');
    clauses.push(`(account IN (${placeholders}) OR to_account IN (${placeholders}))`);
    params.push(...query.accounts, ...query.accounts);
  }
  if (query.categories.length) {
    clauses.push(`category IN (${query.categories.map(() => '?').join(',')})`);
    params.push(...query.categories);
  }
  if (query.subcategories.length) {
    clauses.push(`subcategory IN (${query.subcategories.map(() => '?').join(',')})`);
    params.push(...query.subcategories);
  }
  if (query.day) { clauses.push('substr(date,1,10) = ?'); params.push(query.day); }
  return { sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
};

export async function queryRedCoinsLedger(query: LedgerQuery) {
  const db = await openLedger();
  const where = whereFor(query);
  const rows = await db.getAllAsync<EntryRow>(`SELECT * FROM redcoins_entries ${where.sql} ORDER BY date DESC, id DESC LIMIT ?`, ...where.params, query.limit);
  const total = await db.getFirstAsync<{ total: number }>(`SELECT COUNT(*) AS total FROM redcoins_entries ${where.sql}`, ...where.params);
  return { entries: rows.map(mapRow), total: total?.total || 0 };
}
