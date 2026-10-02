import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RedCoinsState } from '../services/redcoins';
import { nextReminderOccurrence } from '../services/redcoinsReminders';
import type { AutomationWidgetRow, CashWidgetData, WidgetAccount } from './RedCoinsWidgets';
import { WIDGET_CASH_REALITY_KEY } from '../services/spendingGuards';

const REDCOINS_STATE_KEY = 'redcoins_state_v1';
const accountPreferenceKey = (widgetId: number) => `widget_account_snapshot_${widgetId}`;
export const widgetUpdatedTime = () => new Date().toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });

async function state() {
  const raw = await AsyncStorage.getItem(REDCOINS_STATE_KEY);
  return raw ? JSON.parse(raw) as RedCoinsState : null;
}
export async function getWidgetAccounts() { return (await state())?.accounts || []; }
export async function saveWidgetAccount(widgetId: number, name: string) { await AsyncStorage.setItem(accountPreferenceKey(widgetId), name); }
export async function deleteWidgetAccount(widgetId: number) { await AsyncStorage.removeItem(accountPreferenceKey(widgetId)); }
export async function getAccountWidgetData(widgetId: number): Promise<WidgetAccount | null> {
  const [saved, current] = await Promise.all([AsyncStorage.getItem(accountPreferenceKey(widgetId)), state()]);
  const account = current?.accounts.find((row) => row.name === saved) || current?.accounts[0];
  return account ? { name: account.name, type: account.type, balance: account.balance } : null;
}
export async function getCashWidgetData(): Promise<CashWidgetData> {
  const raw = await AsyncStorage.getItem(WIDGET_CASH_REALITY_KEY);
  return raw ? JSON.parse(raw) : null;
}
export async function getAutomationWidgetData(): Promise<AutomationWidgetRow[]> {
  const current = await state();
  if (!current) return [];
  return current.reminders.filter((row) => row.enabled).map((row) => {
    const due = nextReminderOccurrence(row);
    return due ? { id: row.id, item: row.template.item, amount: row.template.amount, due: due.toLocaleString('en-MY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), automatic: row.automaticLog, time: due.getTime() } : null;
  }).filter((row): row is AutomationWidgetRow & { time: number } => !!row).sort((a, b) => a.time - b.time);
}
