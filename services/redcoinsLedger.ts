import type { RedCoinsEntry, RedCoinsType } from './redcoins';
import { openRedCoinsSql, readRedCoinsSql } from './redcoinsSqlStore';

const openLedger = openRedCoinsSql;

export async function syncRedCoinsLedger(_entries: RedCoinsEntry[]) {
  // Compatibility hook: queries now use the authoritative store's live view.
  // There is no second ledger copy to rebuild or replay from a stale snapshot.
  await readRedCoinsSql();
}

export async function upsertRedCoinsLedgerEntry(_entry: RedCoinsEntry) {
  await openLedger();
}

export async function deleteRedCoinsLedgerEntry(_id: string) {
  await openLedger();
}

export interface LedgerQuery {
  search: string;
  types: RedCoinsType[];
  accounts: string[];
  categories: string[];
  subcategories: string[];
  startDay: string;
  endDay: string;
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
  if (query.startDay) { clauses.push('substr(date,1,10) >= ?'); params.push(query.startDay); }
  if (query.endDay) { clauses.push('substr(date,1,10) <= ?'); params.push(query.endDay); }
  return { sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
};

export async function queryRedCoinsLedger(query: LedgerQuery) {
  const db = await openLedger();
  const where = whereFor(query);
  const rows = await db.getAllAsync<EntryRow>(`SELECT * FROM redcoins_entries ${where.sql} ORDER BY date DESC, id DESC LIMIT ?`, ...where.params, query.limit);
  const total = await db.getFirstAsync<{ total: number }>(`SELECT COUNT(*) AS total FROM redcoins_entries ${where.sql}`, ...where.params);
  return { entries: rows.map(mapRow), total: total?.total || 0 };
}
