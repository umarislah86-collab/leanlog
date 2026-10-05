import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ActivityEntry, FoodEntry } from '../types';
import type { LeanLogWidgetProps } from './LeanLogWidget';
import { WIDGET_CASH_REALITY_KEY, WIDGET_GUARD_KEY, WidgetGuardSnapshot } from '../services/spendingGuards';
import { getDailyWidgetPreferences, selectedDailyAccounts } from './daily-widget-preferences';
import type { RedCoinsState } from '../services/redcoins';

export async function getWidgetData(widgetId?: number): Promise<LeanLogWidgetProps> {
  const [foodRaw, activityRaw, goalRaw, healthRaw, guardRaw, cashRealityRaw, stateRaw, preferences] = await Promise.all([
    AsyncStorage.getItem('calorie_entries'),
    AsyncStorage.getItem('activity_entries'),
    AsyncStorage.getItem('calorie_goal'),
    AsyncStorage.getItem('widget_health_snapshot'),
    AsyncStorage.getItem(WIDGET_GUARD_KEY),
    AsyncStorage.getItem(WIDGET_CASH_REALITY_KEY),
    AsyncStorage.getItem('redcoins_state_v1'),
    getDailyWidgetPreferences(widgetId),
  ]);
  const food: FoodEntry[] = foodRaw ? JSON.parse(foodRaw) : [];
  const activities: ActivityEntry[] = activityRaw ? JSON.parse(activityRaw) : [];
  const today = new Date().toLocaleDateString('ms-MY');
  const todayFood = food.filter((entry) => entry.date === today);
  const eaten = todayFood.reduce((sum, entry) => sum + entry.calories, 0);
  const burned = activities.filter((entry) => entry.date === today).reduce((sum, entry) => sum + entry.caloriesBurned, 0);
  const health = healthRaw ? JSON.parse(healthRaw) : { steps: 0 };
  const parsedGuards: WidgetGuardSnapshot | WidgetGuardSnapshot[] | null = guardRaw ? JSON.parse(guardRaw) : null;
  const guards = Array.isArray(parsedGuards) ? parsedGuards.slice(0, 4) : parsedGuards ? [parsedGuards] : [];
  const cashReality = cashRealityRaw ? JSON.parse(cashRealityRaw) : null;
  return {
    eaten,
    burned,
    meals: todayFood.length,
    goal: Number(goalRaw) || 2000,
    steps: Number(health.steps) || 0,
    guards,
    bottomMode: preferences.mode,
    accounts: selectedDailyAccounts(stateRaw ? (JSON.parse(stateRaw) as RedCoinsState).accounts : [], preferences),
    cashReality,
    updated: new Date().toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' }),
  };
}
