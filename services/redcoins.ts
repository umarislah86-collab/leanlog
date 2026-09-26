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
}
export interface RedCoinsState {
  entries: RedCoinsEntry[]; accounts: RedCoinsAccount[]; categories: RedCoinsCategory[]; trash: RedCoinsEntry[];
  payday: number; monthlyBudget: number; safetyBuffer: number; importedSource?: string; createdAt: string;
}

const id = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const accountType = (name: string): RedCoinsAccountType => /platinum|credit/i.test(name) ? 'Credit card' : /persona|prima|loan|mortgage/i.test(name) ? 'Liability' : /wallet|cash/i.test(name) ? 'Cash' : 'Bank';

export function freshRedCoinsState(summary?: BluecoinsSummary | null): RedCoinsState {
  const accountMap = new Map<string, RedCoinsAccount>();
  summary?.cashReality.cashAccounts.forEach((a) => accountMap.set(a.name, { id: id(), name: a.name, type: accountType(a.name), balance: a.balance }));
  summary?.cashReality.creditCards.forEach((a) => accountMap.set(a.name, { id: id(), name: a.name, type: 'Credit card', balance: -a.outstanding, limit: a.creditLimit }));
  summary?.guardOptions.accounts.forEach((name) => { if (!accountMap.has(name)) accountMap.set(name, { id: id(), name, type: accountType(name), balance: 0 }); });
  const categories = (summary?.guardOptions.categories || ['Food & Dining', 'Transport', 'Utilities', 'Entertainment', 'Household', 'People']).map((name, index) => ({
    id: id(), name, icon: ['🍴', '⛽', '⌁', '▶', '⌂', '♥'][index % 6],
    subcategories: summary?.guardOptions.subcategories.filter((sub) => sub !== name).slice(index * 5, index * 5 + 5) || ['General'],
  }));
  return {
    entries: [], accounts: [...accountMap.values()], categories, trash: [], payday: summary?.monthly.payday || 25,
    monthlyBudget: summary?.monthly.budget || 2000, safetyBuffer: summary?.cashReality.safetyBuffer || 0,
    importedSource: summary?.sourceName, createdAt: new Date().toISOString(),
  };
}

export async function loadRedCoins(summary?: BluecoinsSummary | null) {
  const raw = await AsyncStorage.getItem(STATE_KEY);
  if (raw) return JSON.parse(raw) as RedCoinsState;
  const state = freshRedCoinsState(summary);
  await saveRedCoins(state);
  return state;
}
export const saveRedCoins = (state: RedCoinsState) => AsyncStorage.setItem(STATE_KEY, JSON.stringify(state));

export function applyEntryBalance(state: RedCoinsState, entry: RedCoinsEntry, direction = 1) {
  const source = state.accounts.find((a) => a.name === entry.account);
  const target = state.accounts.find((a) => a.name === entry.toAccount);
  if (entry.type === 'expense' && source) source.balance -= entry.amount * direction;
  if (entry.type === 'income' && source) source.balance += entry.amount * direction;
  if (entry.type === 'transfer') { if (source) source.balance -= entry.amount * direction; if (target) target.balance += entry.amount * direction; }
}

const csv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
export async function exportRedCoinsCsv(state: RedCoinsState) {
  const header = ['Date', 'Time', 'Type', 'Item', 'Category', 'Subcategory', 'Account', 'Transfer Account', 'Amount', 'Currency', 'Notes', 'Labels', 'Status'];
  const rows = state.entries.map((entry) => {
    const date = new Date(entry.date);
    return [date.toISOString().slice(0, 10), date.toTimeString().slice(0, 5), entry.type, entry.item, entry.category, entry.subcategory, entry.account, entry.toAccount || '', entry.amount.toFixed(2), 'MYR', entry.note || '', (entry.labels || []).join('|'), entry.status || 'cleared'].map(csv).join(',');
  });
  const uri = `${FileSystem.cacheDirectory}RedCoins-to-Bluecoins-${new Date().toISOString().slice(0, 10)}.csv`;
  await FileSystem.writeAsStringAsync(uri, `\ufeff${[header.map(csv).join(','), ...rows].join('\r\n')}`);
  await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Export RedCoins for Bluecoins' });
}

export async function exportRedCoinsBackup(state: RedCoinsState) {
  const uri = `${FileSystem.cacheDirectory}RedCoins-backup-${new Date().toISOString().slice(0, 10)}.json`;
  await FileSystem.writeAsStringAsync(uri, JSON.stringify({ format: 'redcoins-backup', version: 1, exportedAt: new Date().toISOString(), state }, null, 2));
  await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Backup RedCoins' });
}
