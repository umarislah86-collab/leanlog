import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ActivityEntry, FoodEntry, WeightEntry } from '../types';

export type QuickNote = { id: string; text: string; date: string; time: string; pinned?: boolean };

export type WeeklyReview = {
  eatenAverage: number;
  previousEatenAverage: number;
  loggedDays: number;
  workoutCount: number;
  weightChange: number | null;
  headline: string;
  observations: string[];
};

export type PersonalStreaks = {
  logging: number;
  calorieTarget: number;
  movement: number;
  protein: number;
};

export const localDateKey = (date = new Date()) => date.toLocaleDateString('ms-MY');

export function parseLocalDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00`);
  const parts = value.split('/').map(Number);
  if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0], 12);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

const dateOffset = (days: number) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return localDateKey(date);
};

const caloriesFor = (entries: FoodEntry[], date: string) => entries
  .filter((entry) => entry.date === date)
  .reduce((sum, entry) => sum + entry.calories, 0);

const proteinFor = (entries: FoodEntry[], date: string) => entries
  .filter((entry) => entry.date === date)
  .reduce((sum, entry) => sum + entry.items.reduce((itemSum, item) => itemSum + (item.protein || 0), 0), 0);

function countStreak(check: (date: string) => boolean) {
  let streak = 0;
  for (let day = 0; day < 365; day += 1) {
    if (!check(dateOffset(day))) break;
    streak += 1;
  }
  return streak;
}

export function calculateStreaks(food: FoodEntry[], activities: ActivityEntry[], goal: number): PersonalStreaks {
  const proteinGoal = Math.round(goal * 0.25 / 4);
  return {
    logging: countStreak((date) => food.some((entry) => entry.date === date)),
    calorieTarget: countStreak((date) => {
      const total = caloriesFor(food, date);
      return total > 0 && total <= goal;
    }),
    movement: countStreak((date) => activities.some((entry) => entry.date === date)),
    protein: countStreak((date) => proteinFor(food, date) >= proteinGoal),
  };
}

export function calculateWeeklyReview(
  food: FoodEntry[], activities: ActivityEntry[], weights: WeightEntry[], goal: number,
): WeeklyReview {
  const currentDates = Array.from({ length: 7 }, (_, index) => dateOffset(index));
  const previousDates = Array.from({ length: 7 }, (_, index) => dateOffset(index + 7));
  const currentTotals = currentDates.map((date) => caloriesFor(food, date));
  const previousTotals = previousDates.map((date) => caloriesFor(food, date));
  const loggedDays = currentTotals.filter((value) => value > 0).length;
  const eatenAverage = Math.round(currentTotals.reduce((sum, value) => sum + value, 0) / Math.max(loggedDays, 1));
  const previousLogged = previousTotals.filter((value) => value > 0);
  const previousEatenAverage = Math.round(previousTotals.reduce((sum, value) => sum + value, 0) / Math.max(previousLogged.length, 1));
  const workoutCount = activities.filter((entry) => currentDates.includes(entry.date)).length;
  const recentWeights = weights
    .filter((entry) => Date.now() - parseLocalDate(entry.date).getTime() <= 8 * 86400000)
    .sort((a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime());
  const weightChange = recentWeights.length >= 2
    ? Number((recentWeights[recentWeights.length - 1].weight - recentWeights[0].weight).toFixed(1))
    : null;
  const observations: string[] = [];
  if (loggedDays < 5) observations.push(`You logged ${loggedDays}/7 days — consistency is the clearest next win.`);
  else observations.push(`Strong consistency: ${loggedDays}/7 days recorded.`);
  if (eatenAverage && eatenAverage <= goal) observations.push(`Average intake stayed within your ${goal.toLocaleString()} kcal target.`);
  if (eatenAverage > goal) observations.push(`Average intake was ${eatenAverage - goal} kcal above target.`);
  observations.push(workoutCount ? `${workoutCount} movement session${workoutCount === 1 ? '' : 's'} recorded.` : 'No movement sessions were recorded this week.');
  if (weightChange !== null) observations.push(`Weight moved ${weightChange > 0 ? '+' : ''}${weightChange} kg across the week.`);
  const headline = loggedDays >= 5
    ? (eatenAverage <= goal ? 'A steady week — keep the rhythm.' : 'Consistent logging; now tune the average.')
    : 'A lighter data week — rebuild the habit gently.';
  return { eatenAverage, previousEatenAverage, loggedDays, workoutCount, weightChange, headline, observations };
}

export async function loadInsightData() {
  const [foodRaw, activitiesRaw, weightsRaw, goalRaw, notesRaw] = await Promise.all([
    AsyncStorage.getItem('calorie_entries'),
    AsyncStorage.getItem('activity_entries'),
    AsyncStorage.getItem('weight_entries'),
    AsyncStorage.getItem('calorie_goal'),
    AsyncStorage.getItem('quick_notes'),
  ]);
  const food: FoodEntry[] = foodRaw ? JSON.parse(foodRaw) : [];
  const activities: ActivityEntry[] = activitiesRaw ? JSON.parse(activitiesRaw) : [];
  const weights: WeightEntry[] = weightsRaw ? JSON.parse(weightsRaw) : [];
  const notes: QuickNote[] = notesRaw ? JSON.parse(notesRaw) : [];
  const goal = Number(goalRaw) || 2000;
  return {
    food, activities, weights, notes, goal,
    streaks: calculateStreaks(food, activities, goal),
    weekly: calculateWeeklyReview(food, activities, weights, goal),
  };
}
