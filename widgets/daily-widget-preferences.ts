import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RedCoinsAccount } from '../services/redcoins';

export type DailyWidgetPreferences = { mode: 'guards' | 'accounts'; accountIds: string[] };
const preferenceKey = (widgetId: number) => `widget_daily_preferences_${widgetId}`;
export function normalizeDailyWidgetPreferences(value?: Partial<DailyWidgetPreferences> | null): DailyWidgetPreferences {
  return {
    mode: value?.mode === 'accounts' ? 'accounts' : 'guards',
    accountIds: [...new Set((Array.isArray(value?.accountIds) ? value.accountIds : []).filter((id): id is string => typeof id === 'string' && !!id))].slice(0, 4),
  };
}
export async function getDailyWidgetPreferences(widgetId?: number) {
  if (widgetId == null) return normalizeDailyWidgetPreferences();
  const raw = await AsyncStorage.getItem(preferenceKey(widgetId));
  try { return normalizeDailyWidgetPreferences(raw ? JSON.parse(raw) : null); }
  catch { return normalizeDailyWidgetPreferences(); }
}
export async function saveDailyWidgetPreferences(widgetId: number, preferences: DailyWidgetPreferences) {
  await AsyncStorage.setItem(preferenceKey(widgetId), JSON.stringify(normalizeDailyWidgetPreferences(preferences)));
}
export async function deleteDailyWidgetPreferences(widgetId: number) { await AsyncStorage.removeItem(preferenceKey(widgetId)); }
export function selectedDailyAccounts(accounts: RedCoinsAccount[], preferences: DailyWidgetPreferences) {
  return preferences.accountIds.map((id) => accounts.find((account) => account.id === id)).filter((account): account is RedCoinsAccount => !!account);
}
