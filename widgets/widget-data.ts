import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ActivityEntry, FoodEntry } from '../types';
import type { LeanLogWidgetProps } from './LeanLogWidget';

export async function getWidgetData(): Promise<LeanLogWidgetProps> {
  const [foodRaw, activityRaw, goalRaw, healthRaw, agendaRaw] = await Promise.all([
    AsyncStorage.getItem('calorie_entries'),
    AsyncStorage.getItem('activity_entries'),
    AsyncStorage.getItem('calorie_goal'),
    AsyncStorage.getItem('widget_health_snapshot'),
    AsyncStorage.getItem('widget_agenda_snapshot'),
  ]);
  const food: FoodEntry[] = foodRaw ? JSON.parse(foodRaw) : [];
  const activities: ActivityEntry[] = activityRaw ? JSON.parse(activityRaw) : [];
  const today = new Date().toLocaleDateString('ms-MY');
  const todayFood = food.filter((entry) => entry.date === today);
  const eaten = todayFood.reduce((sum, entry) => sum + entry.calories, 0);
  const burned = activities.filter((entry) => entry.date === today).reduce((sum, entry) => sum + entry.caloriesBurned, 0);
  const health = healthRaw ? JSON.parse(healthRaw) : { steps: 0 };
  const agenda = agendaRaw ? JSON.parse(agendaRaw) : [];
  return {
    eaten,
    burned,
    meals: todayFood.length,
    goal: Number(goalRaw) || 2000,
    steps: Number(health.steps) || 0,
    nextEvent: agenda[0]?.title || '',
    updated: new Date().toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' }),
  };
}
