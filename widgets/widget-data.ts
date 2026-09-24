import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ActivityEntry, FoodEntry } from '../types';
import type { LeanLogWidgetProps } from './LeanLogWidget';

export async function getWidgetData(): Promise<LeanLogWidgetProps> {
  const [foodRaw, goalRaw, healthRaw, agendaRaw] = await Promise.all([
    AsyncStorage.getItem('calorie_entries'),
    AsyncStorage.getItem('calorie_goal'),
    AsyncStorage.getItem('widget_health_snapshot'),
    AsyncStorage.getItem('widget_agenda_snapshot'),
  ]);
  const food: FoodEntry[] = foodRaw ? JSON.parse(foodRaw) : [];
  const today = new Date().toLocaleDateString('ms-MY');
  const eaten = food.filter((entry) => entry.date === today).reduce((sum, entry) => sum + entry.calories, 0);
  const health = healthRaw ? JSON.parse(healthRaw) : { steps: 0 };
  const agenda = agendaRaw ? JSON.parse(agendaRaw) : [];
  return {
    eaten,
    goal: Number(goalRaw) || 2000,
    steps: Number(health.steps) || 0,
    nextEvent: agenda[0]?.title || '',
    updated: new Date().toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' }),
  };
}
