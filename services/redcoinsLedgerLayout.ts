import type { RedCoinsEntry } from './redcoins';

export type LedgerCell = {
  key: string; offset: number; length: number;
} & ({ kind: 'day'; date: string; title: string; total: number } | { kind: 'entry'; entry: RedCoinsEntry });
export interface LedgerAnchor { key: string; inset: number; index: number }

/** Complete ledger, bounded rendered window. Exact geometry avoids estimated
 * spacer corrections as the user scrolls through months of mixed row types. */
export function buildLedgerLayout(entries: RedCoinsEntry[], fontScale = 1) {
  const scale = Math.max(1, fontScale);
  const groups = new Map<string, RedCoinsEntry[]>();
  entries.forEach(entry => {
    const parsed = new Date(entry.date);
    const date = Number.isFinite(parsed.getTime())
      ? `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
      : entry.date.slice(0, 10);
    const rows = groups.get(date) || []; rows.push(entry); groups.set(date, rows);
  });
  const cells: LedgerCell[] = [], stickyIndices: number[] = [];
  let offset = 0;
  for (const [date, rows] of groups) {
    const length = Math.ceil(26 * scale);
    stickyIndices.push(cells.length);
    cells.push({ kind: 'day', key: `day:${date}`, date, title: new Date(`${date}T12:00:00`).toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase(), total: rows.reduce((cents, row) => cents + (row.type === 'expense' ? -1 : row.type === 'income' ? 1 : 0) * Math.round(row.amount * 100), 0) / 100, offset, length });
    offset += length;
    for (const entry of rows) {
      const length = Math.ceil((entry.type === 'transfer' || entry.status === 'pending' || entry.status === 'reconciled' ? 64 : 54) * scale);
      cells.push({ kind: 'entry', key: `entry:${entry.id}`, entry, offset, length }); offset += length;
    }
  }
  return { cells, stickyIndices, height: offset };
}

export function captureLedgerAnchor(cells: LedgerCell[], scrollOffset: number): LedgerAnchor | null {
  if (!cells.length) return null;
  const y = Math.max(0, scrollOffset);
  let low = 0, high = cells.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (cells[middle].offset <= y) low = middle; else high = middle - 1;
  }
  return { key: cells[low].key, inset: y - cells[low].offset, index: low };
}

/** Preserve row + partial offset across insertions, edits and deletions. A
 * deleted anchor falls forward to the nearest surviving old row, then back. */
export function restoreLedgerAnchor(anchor: LedgerAnchor | null, previous: LedgerCell[], next: LedgerCell[]) {
  if (!anchor || !next.length) return 0;
  const byKey = new Map(next.map(cell => [cell.key, cell]));
  const exact = byKey.get(anchor.key);
  if (exact) return exact.offset + Math.min(anchor.inset, Math.max(0, exact.length - 1));
  for (let index = anchor.index + 1; index < previous.length; index++) {
    const found = byKey.get(previous[index].key); if (found) return found.offset;
  }
  for (let index = anchor.index - 1; index >= 0; index--) {
    const found = byKey.get(previous[index].key); if (found) return found.offset;
  }
  return 0;
}
