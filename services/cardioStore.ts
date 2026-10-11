import * as SQLite from 'expo-sqlite';
import type { CardioSession } from './cardioCore';
let database: Promise<SQLite.SQLiteDatabase> | null = null;
async function db() {
  if (!database) database = (async () => {
    const connection = await SQLite.openDatabaseAsync('leanlog-cardio.db');
    await connection.execAsync('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS cardio_current (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS cardio_history (id TEXT PRIMARY KEY, ended_at INTEGER NOT NULL, payload TEXT NOT NULL);');
    return connection;
  })().catch(error => { database = null; throw error; });
  return database;
}
export async function loadCardioSession() {
  const row = await (await db()).getFirstAsync<{ payload: string }>('SELECT payload FROM cardio_current WHERE id=1');
  return row ? JSON.parse(row.payload) as CardioSession : null;
}
export async function updateCardioSession(change: (current: CardioSession | null) => CardioSession | null) {
  const connection = await db();
  let next: CardioSession | null = null;
  await connection.withExclusiveTransactionAsync(async tx => {
    const row = await tx.getFirstAsync<{ payload: string }>('SELECT payload FROM cardio_current WHERE id=1');
    const current = row ? JSON.parse(row.payload) as CardioSession : null;
    next = change(current);
    if (next === current) return;
    if (next) await tx.runAsync('INSERT OR REPLACE INTO cardio_current(id,payload) VALUES(1,?)', JSON.stringify(next));
    else await tx.runAsync('DELETE FROM cardio_current WHERE id=1');
    if (next?.status === 'saved') await tx.runAsync('INSERT OR REPLACE INTO cardio_history(id,ended_at,payload) VALUES(?,?,?)', next.id, next.endedAt ?? next.startedAt, JSON.stringify(next));
  });
  return next as CardioSession | null;
}
export async function loadCardioHistory() {
  const rows = await (await db()).getAllAsync<{ payload: string }>('SELECT payload FROM cardio_history ORDER BY ended_at DESC LIMIT 30');
  return rows.map(row => JSON.parse(row.payload) as CardioSession);
}
