import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyEntryBalance, createRedCoinsDeletion, type RedCoinsEntry, type RedCoinsState } from './redcoins';
import { loggerCategories } from './redcoinsLogger';

export type BatchAction =
  | { kind: 'name'; value: string }
  | { kind: 'amount'; value: number }
  | { kind: 'date'; day: string }
  | { kind: 'account'; account: string; toAccount?: string }
  | { kind: 'category'; category: string; subcategory: string }
  | { kind: 'labels'; mode: 'add' | 'replace' | 'remove' | 'clear'; labels: string[] }
  | { kind: 'status'; value: NonNullable<RedCoinsEntry['status']> }
  | { kind: 'delete' };
const CLIPBOARD_KEY = 'redcoins_bulk_clipboard_v1';
const cloneEntry = (entry: RedCoinsEntry): RedCoinsEntry => ({ ...entry, labels: [...(entry.labels || [])] });
const uniqueLabels = (labels: string[]) => [...new Set(labels.map(label => label.trim()).filter(Boolean))];
const validDate = (day: string) => {
  const date = new Date(`${day}T12:00:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(date.getTime()) || date.getFullYear() !== Number(day.slice(0, 4)) || date.getMonth() + 1 !== Number(day.slice(5, 7)) || date.getDate() !== Number(day.slice(8, 10))) throw new Error('Choose a valid date.');
  return date;
};
const moveDate = (entry: RedCoinsEntry, day: string) => {
  const target = validDate(day);
  const original = new Date(entry.date);
  target.setHours(original.getHours(), original.getMinutes(), original.getSeconds(), original.getMilliseconds());
  return target.toISOString();
};

function validateEntry(state: RedCoinsState, entry: RedCoinsEntry) {
  if (!entry.item.trim()) throw new Error('Title cannot be empty.');
  if (!Number.isFinite(entry.amount) || entry.amount <= 0) throw new Error('Amount must be greater than zero.');
  if (!Number.isFinite(new Date(entry.date).getTime())) throw new Error('Choose a valid date.');
  if (!state.accounts.some(a => a.name === entry.account)) throw new Error(`Account “${entry.account}” no longer exists.`);
  if (entry.type === 'transfer' && (!state.accounts.some(a => a.name === entry.toAccount) || entry.account === entry.toAccount)) throw new Error('Transfers need two different existing accounts.');
}

/** Validate every row before mutating a cloned state; failures never partially apply. */
export function applyRedCoinsBatch(state: RedCoinsState, ids: string[], action: BatchAction, now = new Date()): RedCoinsState {
  const selected = new Set(ids);
  const rows = state.entries.filter(entry => selected.has(entry.id));
  if (!rows.length || rows.length !== selected.size) throw new Error('Selection changed. Close and select the transactions again.');
  if (action.kind === 'name' && !action.value.trim()) throw new Error('Title cannot be empty.');
  if (action.kind === 'amount' && (!Number.isFinite(action.value) || action.value <= 0)) throw new Error('Amount must be greater than zero.');
  if (action.kind === 'date') validDate(action.day);
  if (action.kind === 'account' && !action.account && !action.toAccount) throw new Error('Choose an account to change.');
  if (action.kind === 'category') {
    const types = new Set(rows.map(entry => entry.type));
    if (types.size !== 1 || types.has('transfer')) throw new Error('For category changes, select only expenses or only incomes. Transfers do not use categories.');
    const choices = loggerCategories(state.categories, state.entries, rows[0].type);
    if (!choices.some(category => category.name === action.category && category.subcategories.includes(action.subcategory))) throw new Error('Choose a category valid for this transaction type.');
  }
  const replacements = new Map<string, RedCoinsEntry>();
  if (action.kind !== 'delete') for (const row of rows) {
    const updated = cloneEntry(row);
    if (action.kind === 'name') updated.item = action.value.trim();
    if (action.kind === 'amount') updated.amount = Math.round(action.value * 100) / 100;
    if (action.kind === 'date') updated.date = moveDate(row, action.day);
    if (action.kind === 'account') {
      if (action.account) updated.account = action.account;
      if (updated.type === 'transfer' && action.toAccount) updated.toAccount = action.toAccount;
    }
    if (action.kind === 'category') { updated.category = action.category; updated.subcategory = action.subcategory; }
    if (action.kind === 'status') updated.status = action.value;
    if (action.kind === 'labels') {
      const labels = uniqueLabels(action.labels);
      updated.labels = action.mode === 'clear' ? [] : action.mode === 'replace' ? labels : action.mode === 'add' ? uniqueLabels([...(row.labels || []), ...labels]) : (row.labels || []).filter(label => !labels.includes(label));
    }
    validateEntry(state, updated);
    updated.editedAt = now.toISOString();
    replacements.set(row.id, updated);
  }
  const next: RedCoinsState = { ...state, accounts: state.accounts.map(a => ({ ...a })), entries: [], deletedEntries: [...(state.deletedEntries || [])] };
  for (const original of state.entries) {
    if (!selected.has(original.id)) { next.entries.push(original); continue; }
    if (action.kind === 'delete') {
      if (original.balanceEffectApplied ?? new Date(original.date).getTime() <= now.getTime()) applyEntryBalance(next, original, -1, true);
      next.deletedEntries.push(createRedCoinsDeletion(original));
      continue;
    }
    const updated = replacements.get(original.id)!;
    if (action.kind === 'amount' || action.kind === 'date' || action.kind === 'account') {
      if (original.balanceEffectApplied ?? new Date(original.date).getTime() <= now.getTime()) applyEntryBalance(next, original, -1, true);
      updated.balanceEffectApplied = new Date(updated.date).getTime() <= now.getTime();
      if (updated.balanceEffectApplied) applyEntryBalance(next, updated, 1, true);
    }
    // Suppress the original imported counterpart when a previously reconciled
    // local row is changed, so the next Bluecoins refresh cannot resurrect it.
    if (original.origin !== 'bluecoins' && original.reconciledImportId) next.deletedEntries.push(createRedCoinsDeletion(original));
    next.entries.push(updated);
  }
  next.accounts.forEach(a => { a.balance = Math.round(a.balance * 100) / 100; });
  return next;
}

export async function copyRedCoinsEntries(entries: RedCoinsEntry[]) {
  if (!entries.length) throw new Error('Select transactions to copy.');
  await AsyncStorage.setItem(CLIPBOARD_KEY, JSON.stringify({ version: 1, entries: entries.map(cloneEntry) }));
}
export async function readRedCoinsClipboard(): Promise<RedCoinsEntry[]> {
  const raw = await AsyncStorage.getItem(CLIPBOARD_KEY);
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.version === 1 && Array.isArray(parsed.entries) ? parsed.entries.filter((e: RedCoinsEntry) => e && ['income', 'expense', 'transfer'].includes(e.type) && typeof e.item === 'string' && typeof e.amount === 'number' && typeof e.date === 'string' && typeof e.account === 'string' && (!e.labels || Array.isArray(e.labels) && e.labels.every(label => typeof label === 'string'))).map(cloneEntry) : [];
  } catch { return []; }
}
export function pasteRedCoinsEntries(state: RedCoinsState, copied: RedCoinsEntry[], day: string | null, now = new Date(), createId = () => `paste-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`): RedCoinsState {
  if (!copied.length) throw new Error('Copy transactions first.');
  if (day) validDate(day);
  const entries = copied.map(original => {
    const entry: RedCoinsEntry = {
      id: createId(), type: original.type, item: original.item, amount: original.amount,
      date: day ? moveDate(original, day) : original.date,
      account: original.account, toAccount: original.type === 'transfer' ? original.toAccount : undefined,
      category: original.category, subcategory: original.subcategory, note: original.note,
      labels: [...(original.labels || [])], attachment: original.attachment, split: original.split,
      origin: 'redcoins', repeat: 'none', status: 'cleared', loggedAt: now.toISOString(),
      duplicateOfId: original.duplicateOfId || original.reconciledImportId || original.id,
    };
    validateEntry(state, entry);
    if (entry.type !== 'transfer' && !loggerCategories(state.categories, state.entries, entry.type).some(category => category.name === entry.category && category.subcategories.includes(entry.subcategory))) throw new Error(`Category for “${entry.item}” is no longer available. Update the source entry and copy again.`);
    entry.balanceEffectApplied = new Date(entry.date).getTime() <= now.getTime();
    return entry;
  });
  const usedIds = new Set(state.entries.map(entry => entry.id));
  for (const entry of entries) { if (usedIds.has(entry.id)) throw new Error('Duplicate transaction ID. Please try again.'); usedIds.add(entry.id); }
  const next = { ...state, accounts: state.accounts.map(a => ({ ...a })), entries: [...entries, ...state.entries] };
  entries.forEach(entry => { if (entry.balanceEffectApplied) applyEntryBalance(next, entry, 1, true); });
  next.accounts.forEach(a => { a.balance = Math.round(a.balance * 100) / 100; });
  return next;
}
