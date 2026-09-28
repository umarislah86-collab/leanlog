import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { BluecoinsSummary } from './bluecoins';

const STATE_KEY = 'redcoins_state_v1';

export type RedCoinsType = 'expense' | 'income' | 'transfer';
export type RedCoinsAccountType = 'Bank' | 'Cash' | 'Credit card' | 'Liability' | 'Investment';
export interface RedCoinsAccount { id: string; name: string; type: RedCoinsAccountType; balance: number; limit?: number }
export interface RedCoinsCategory { id: string; name: string; icon: string; subcategories: string[] }
export interface RedCoinsEntry {
  id: string; type: RedCoinsType; item: string; amount: number; date: string; account: string; toAccount?: string;
  category: string; subcategory: string; note?: string; labels?: string[]; status?: 'cleared' | 'pending';
  repeat?: 'none' | 'weekly' | 'monthly' | 'installment'; installments?: number; split?: string; attachment?: string;
  origin?: 'bluecoins' | 'redcoins';
  exportedAt?: string;
  editedAt?: string;
}
export interface RedCoinsExportBatch { id: string; createdAt: string; entryIds: string[]; confirmedAt?: string }
export interface RedCoinsState {
  entries: RedCoinsEntry[]; accounts: RedCoinsAccount[]; categories: RedCoinsCategory[]; trash: RedCoinsEntry[];
  payday: number; monthlyBudget: number; safetyBuffer: number; importedSource?: string; createdAt: string;
  exportBatches: RedCoinsExportBatch[];
  subcategoryBudgets: Record<string, number>;
  entryDefaults?: Partial<Record<RedCoinsType, { account: string; toAccount?: string; category: string; subcategory: string }>>;
}

const id = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const accountType = (name: string): RedCoinsAccountType => /platinum|credit/i.test(name) ? 'Credit card' : /persona|prima|loan|mortgage/i.test(name) ? 'Liability' : /wallet|cash/i.test(name) ? 'Cash' : 'Bank';

export function freshRedCoinsState(summary?: BluecoinsSummary | null): RedCoinsState {
  const accountMap = new Map<string, RedCoinsAccount>();
  summary?.redcoins.accounts.forEach((a) => accountMap.set(a.name, { id: id(), ...a }));
  const categories = (summary?.redcoins.categories || []).map(({ name, subcategories }, index) => ({
    id: id(), name, icon: ['▰', '●', '⛽', '🍴', '⌂', '♥', '✈', '⌁'][index % 8], subcategories,
  }));
  return {
    entries: summary?.redcoins.entries || [], accounts: [...accountMap.values()], categories, trash: [], exportBatches: [], subcategoryBudgets: {}, entryDefaults: {}, payday: summary?.monthly.payday || 25,
    monthlyBudget: summary?.monthly.budget || 2000, safetyBuffer: summary?.cashReality.safetyBuffer || 0,
    importedSource: summary?.sourceName, createdAt: new Date().toISOString(),
  };
}

export async function loadRedCoins(summary?: BluecoinsSummary | null) {
  const raw = await AsyncStorage.getItem(STATE_KEY);
  if (raw) {
    const saved = JSON.parse(raw) as RedCoinsState;
    if (summary?.redcoins) {
      const own = saved.entries.filter((entry) => entry.origin !== 'bluecoins');
      const editedImported = saved.entries.filter((entry) => entry.origin === 'bluecoins' && entry.editedAt);
      const editedById = new Map(editedImported.map((entry) => [entry.id, entry]));
      const trashedImportedIds = new Set((saved.trash || []).filter((entry) => entry.origin === 'bluecoins').map((entry) => entry.id));
      const customAccounts = saved.accounts.filter((account) => !summary.redcoins.accounts.some((source) => source.name === account.name));
      const customCategories = saved.categories.filter((category) => !summary.redcoins.categories.some((source) => source.name === category.name));
      const refreshed = freshRedCoinsState(summary);
      editedImported.forEach((edited) => {
        const original = refreshed.entries.find((entry) => entry.id === edited.id);
        if (original) applyEntryBalance(refreshed, original, -1);
        applyEntryBalance(refreshed, edited, 1);
      });
      refreshed.entries.filter((entry) => trashedImportedIds.has(entry.id)).forEach((entry) => applyEntryBalance(refreshed, entry, -1));
      refreshed.entries = [...own, ...refreshed.entries.filter((entry) => !trashedImportedIds.has(entry.id)).map((entry) => editedById.get(entry.id) || entry), ...editedImported.filter((entry) => !refreshed.entries.some((source) => source.id === entry.id))].sort((a, b) => b.date.localeCompare(a.date));
      refreshed.accounts.push(...customAccounts);
      refreshed.categories.push(...customCategories);
      refreshed.trash = saved.trash || [];
      refreshed.exportBatches = saved.exportBatches || [];
      refreshed.subcategoryBudgets = saved.subcategoryBudgets || {};
      refreshed.entryDefaults = saved.entryDefaults || {};
      refreshed.payday = saved.payday || refreshed.payday;
      refreshed.monthlyBudget = saved.monthlyBudget || refreshed.monthlyBudget;
      refreshed.safetyBuffer = saved.safetyBuffer ?? refreshed.safetyBuffer;
      await saveRedCoins(refreshed);
      return refreshed;
    }
    return { ...saved, subcategoryBudgets: saved.subcategoryBudgets || {}, entryDefaults: saved.entryDefaults || {} };
  }
  const state = freshRedCoinsState(summary);
  await saveRedCoins(state);
  return state;
}
export const saveRedCoins = (state: RedCoinsState) => AsyncStorage.setItem(STATE_KEY, JSON.stringify(state));

const entrySignature = (entry: Pick<RedCoinsEntry, 'item' | 'amount' | 'date' | 'account'>) =>
  `${entry.date.slice(0, 10)}|${entry.item.trim().toLowerCase()}|${entry.amount.toFixed(2)}|${entry.account.trim().toLowerCase()}`;

export async function mergeRedCoinsIntoBudgetCoach(source: BluecoinsSummary): Promise<BluecoinsSummary> {
  const raw = await AsyncStorage.getItem(STATE_KEY);
  if (!raw) return source;
  const state = JSON.parse(raw) as RedCoinsState;
  const imported = new Set((source.redcoins?.entries || []).map(entrySignature));
  const pending = state.entries.filter((entry) => entry.origin !== 'bluecoins' && !imported.has(entrySignature(entry)));
  if (!pending.length) return source;
  const summary = JSON.parse(JSON.stringify(source)) as BluecoinsSummary;
  const sourceDate = new Date();
  const lastSevenStart = new Date(sourceDate); lastSevenStart.setHours(0, 0, 0, 0); lastSevenStart.setDate(lastSevenStart.getDate() - 6);
  const cycleStart = new Date(`${summary.monthly.cycleStart}T00:00:00`);
  const cycleEnd = new Date(`${summary.monthly.cycleEnd}T23:59:59`);
  const expenseRows = pending.filter((entry) => entry.type === 'expense');
  const allExpenses = [...(summary.redcoins?.entries || []).filter((entry) => entry.type === 'expense'), ...expenseRows];
  summary.days = Array.from({ length: 7 }, (_, offset) => { const date = new Date(lastSevenStart); date.setDate(lastSevenStart.getDate() + offset); const key = date.toISOString().slice(0, 10); const rows = allExpenses.filter((entry) => entry.date.slice(0, 10) === key); return { date: key, spent: rows.reduce((sum, entry) => sum + entry.amount, 0), transactions: rows.length }; });
  const sevenRows = allExpenses.filter((entry) => new Date(entry.date) >= lastSevenStart && new Date(entry.date) <= sourceDate);
  summary.total = sevenRows.reduce((sum, entry) => sum + entry.amount, 0);
  summary.transactionCount = sevenRows.length;
  summary.average = summary.total / 7;
  const sevenCategories = new Map<string, number>();
  sevenRows.forEach((entry) => sevenCategories.set(entry.category, (sevenCategories.get(entry.category) || 0) + entry.amount));
  summary.topCategories = [...sevenCategories].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount).slice(0, 3);
  summary.topCategory = summary.topCategories[0]?.name || summary.topCategory;
  summary.topCategoryAmount = summary.topCategories[0]?.amount || 0;

  const cycleRows = expenseRows.filter((entry) => { const date = new Date(entry.date); return date >= cycleStart && date <= cycleEnd; });
  const addedCycleSpend = cycleRows.reduce((sum, entry) => sum + entry.amount, 0);
  summary.monthly.spent += addedCycleSpend;
  summary.monthly.remaining = summary.monthly.budget - summary.monthly.spent;
  const remainingDays = Math.max(1, Math.ceil((cycleEnd.getTime() - sourceDate.getTime()) / 86400000));
  summary.monthly.safeToday = Math.max(0, summary.monthly.remaining / remainingDays);
  summary.monthly.projected += addedCycleSpend;
  summary.monthly.projectedLow += addedCycleSpend;
  summary.monthly.projectedHigh += addedCycleSpend;
  const categoryMap = new Map(summary.monthly.topCategories.map((item) => [item.name, item]));
  cycleRows.forEach((entry) => {
    const category = categoryMap.get(entry.category) || { name: entry.category, amount: 0, share: 0, details: [] };
    category.amount += entry.amount;
    const detail = category.details.find((item) => item.subcategory === entry.subcategory && item.item === entry.item);
    if (detail) { detail.amount += entry.amount; detail.transactions += 1; } else category.details.push({ subcategory: entry.subcategory, item: entry.item, amount: entry.amount, share: 0, transactions: 1 });
    categoryMap.set(entry.category, category);
  });
  summary.monthly.topCategories = [...categoryMap.values()].sort((a, b) => b.amount - a.amount).map((category) => ({ ...category, share: summary.monthly.spent ? category.amount / summary.monthly.spent * 100 : 0, details: category.details.map((detail) => ({ ...detail, share: category.amount ? detail.amount / category.amount * 100 : 0 })).sort((a, b) => b.amount - a.amount) }));

  const accountByName = new Map(state.accounts.map((account) => [account.name, account]));
  summary.cashReality.cashAccounts.forEach((account) => { const latest = accountByName.get(account.name); if (latest) account.balance = latest.balance; });
  summary.cashReality.creditCards.forEach((card) => { const latest = accountByName.get(card.name); if (latest) card.outstanding = Math.max(0, -latest.balance); });
  summary.cashReality.liquidBalance = summary.cashReality.cashAccounts.filter((account) => account.selected).reduce((sum, account) => sum + account.balance, 0);
  summary.cashReality.cardOutstanding = summary.cashReality.creditCards.reduce((sum, card) => sum + card.outstanding, 0);
  summary.cashReality.trueSpendable = Math.min(summary.monthly.remaining, summary.cashReality.liquidBalance - summary.cashReality.cardOutstanding - summary.cashReality.safetyBuffer);
  summary.cashReality.coveragePercent = summary.cashReality.cardOutstanding ? summary.cashReality.liquidBalance / summary.cashReality.cardOutstanding * 100 : 100;
  summary.spendingGuards.forEach((guard) => {
    const guardStart = new Date(`${guard.cycleStart}T00:00:00`); const guardEnd = new Date(`${guard.cycleEnd}T23:59:59`);
    const extras = expenseRows.filter((entry) => { const date = new Date(entry.date); if (date < guardStart || date > guardEnd) return false; return guard.scope === 'account' ? entry.account === guard.target : guard.scope === 'category' ? entry.category === guard.target : entry.subcategory === guard.target; });
    const added = extras.reduce((sum, entry) => sum + entry.amount, 0);
    guard.spent += added; guard.remaining = guard.limit - guard.spent; guard.percent = guard.limit ? guard.spent / guard.limit * 100 : 0; guard.projected += added;
    guard.level = guard.percent >= 100 ? 'breached' : guard.percent >= 85 ? 'danger' : guard.percent >= 70 ? 'slow-down' : guard.percent >= 50 ? 'heads-up' : 'safe';
    const breakdown = new Map(guard.breakdown.map((item) => [item.name, item.amount]));
    extras.forEach((entry) => { const key = guard.scope === 'account' ? entry.subcategory : entry.category; breakdown.set(key, (breakdown.get(key) || 0) + entry.amount); });
    guard.breakdown = [...breakdown].map(([name, amount]) => ({ name, amount, share: guard.spent ? amount / guard.spent * 100 : 0 })).sort((a, b) => b.amount - a.amount).slice(0, 6);
    guard.transactions = [...guard.transactions, ...extras.map((entry) => ({ date: entry.date.slice(0, 10), amount: entry.amount, itemName: entry.item, category: entry.category, subcategory: entry.subcategory, note: entry.note || '', origin: 'redcoins' as const }))].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  });
  return summary;
}

export function applyEntryBalance(state: RedCoinsState, entry: RedCoinsEntry, direction = 1) {
  const source = state.accounts.find((a) => a.name === entry.account);
  const target = state.accounts.find((a) => a.name === entry.toAccount);
  if (entry.type === 'expense' && source) source.balance -= entry.amount * direction;
  if (entry.type === 'income' && source) source.balance += entry.amount * direction;
  if (entry.type === 'transfer') { if (source) source.balance -= entry.amount * direction; if (target) target.balance += entry.amount * direction; }
}

const csv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
export async function exportRedCoinsCsv(state: RedCoinsState, mode: 'pending' | 'all' = 'pending'): Promise<RedCoinsExportBatch | null> {
  const header = ['Date', 'Time', 'Type', 'Item', 'Category', 'Subcategory', 'Account', 'Transfer Account', 'Amount', 'Currency', 'Notes', 'Labels', 'Status'];
  const selected = state.entries.filter((entry) => entry.origin !== 'bluecoins' && (mode === 'all' || !entry.exportedAt));
  if (!selected.length) return null;
  const rows = selected.map((entry) => {
    const date = new Date(entry.date);
    return [date.toISOString().slice(0, 10), date.toTimeString().slice(0, 5), entry.type, entry.item, entry.category, entry.subcategory, entry.account, entry.toAccount || '', entry.amount.toFixed(2), 'MYR', entry.note || '', (entry.labels || []).join('|'), entry.status || 'cleared'].map(csv).join(',');
  });
  const uri = `${FileSystem.cacheDirectory}RedCoins-to-Bluecoins-${new Date().toISOString().slice(0, 10)}.csv`;
  await FileSystem.writeAsStringAsync(uri, `\ufeff${[header.map(csv).join(','), ...rows].join('\r\n')}`);
  await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Export RedCoins for Bluecoins' });
  return { id: `export-${Date.now()}`, createdAt: new Date().toISOString(), entryIds: selected.map((entry) => entry.id) };
}

export function confirmRedCoinsExport(state: RedCoinsState, batchId: string): RedCoinsState {
  const confirmedAt = new Date().toISOString();
  const batch = state.exportBatches.find((item) => item.id === batchId);
  if (!batch) return state;
  return {
    ...state,
    entries: state.entries.map((entry) => batch.entryIds.includes(entry.id) ? { ...entry, exportedAt: confirmedAt } : entry),
    exportBatches: state.exportBatches.map((item) => item.id === batchId ? { ...item, confirmedAt } : item),
  };
}

export async function exportRedCoinsBackup(state: RedCoinsState) {
  const uri = `${FileSystem.cacheDirectory}RedCoins-backup-${new Date().toISOString().slice(0, 10)}.json`;
  await FileSystem.writeAsStringAsync(uri, JSON.stringify({ format: 'redcoins-backup', version: 1, exportedAt: new Date().toISOString(), state }, null, 2));
  await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Backup RedCoins' });
}
