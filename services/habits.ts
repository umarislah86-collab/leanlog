import AsyncStorage from '@react-native-async-storage/async-storage';

const HABITS_KEY = 'tiny_habits_v1';
const CHECKINS_KEY = 'tiny_habit_checkins_v1';

export type HabitStatus = 'done' | 'skip';
export type TinyHabit = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  activeDays: number[];
};

export type HabitCheckins = Record<string, Record<string, HabitStatus>>;

const defaults: TinyHabit[] = [
  { id: 'water', name: 'Water first', emoji: '💧', color: '#79BCE8', activeDays: [0, 1, 2, 3, 4, 5, 6] },
  { id: 'walk', name: 'Walk 10 min', emoji: '🚶', color: '#8FD6B4', activeDays: [0, 1, 2, 3, 4, 5, 6] },
  { id: 'veg', name: 'Eat greens', emoji: '🥬', color: '#E8B84A', activeDays: [0, 1, 2, 3, 4, 5, 6] },
  { id: 'no_spend', name: 'No-spend day', emoji: '🪙', color: '#FF856B', activeDays: [1, 2, 3, 4, 5] },
];

export const habitDateKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export async function loadTinyHabits() {
  const [habitsRaw, checkinsRaw] = await Promise.all([
    AsyncStorage.getItem(HABITS_KEY), AsyncStorage.getItem(CHECKINS_KEY),
  ]);
  const habits: TinyHabit[] = habitsRaw ? JSON.parse(habitsRaw) : defaults;
  if (!habitsRaw) await AsyncStorage.setItem(HABITS_KEY, JSON.stringify(habits));
  return { habits, checkins: checkinsRaw ? JSON.parse(checkinsRaw) as HabitCheckins : {} };
}

export async function setHabitStatus(habitId: string, status?: HabitStatus) {
  const raw = await AsyncStorage.getItem(CHECKINS_KEY);
  const all: HabitCheckins = raw ? JSON.parse(raw) : {};
  const date = habitDateKey();
  const today = { ...(all[date] || {}) };
  if (status) today[habitId] = status;
  else delete today[habitId];
  all[date] = today;
  await AsyncStorage.setItem(CHECKINS_KEY, JSON.stringify(all));
  return all;
}

export async function saveTinyHabits(habits: TinyHabit[]) {
  await AsyncStorage.setItem(HABITS_KEY, JSON.stringify(habits));
}

export function habitReport(habit: TinyHabit, checkins: HabitCheckins, days = 30) {
  let scheduled = 0;
  let done = 0;
  let skipped = 0;
  const cursor = new Date();
  for (let offset = 0; offset < days; offset += 1) {
    if (habit.activeDays.includes(cursor.getDay())) {
      scheduled += 1;
      const status = checkins[habitDateKey(cursor)]?.[habit.id];
      if (status === 'done') done += 1;
      if (status === 'skip') skipped += 1;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return { scheduled, done, skipped, completion: scheduled ? Math.round((done / scheduled) * 100) : 0 };
}

export function habitStreak(habit: TinyHabit, checkins: HabitCheckins) {
  let streak = 0;
  const cursor = new Date();
  for (let offset = 0; offset < 366; offset += 1) {
    const scheduled = habit.activeDays.includes(cursor.getDay());
    const status = checkins[habitDateKey(cursor)]?.[habit.id];
    if (scheduled && status === 'done') streak += 1;
    else if (scheduled && status !== 'skip' && offset > 0) break;
    else if (scheduled && status !== 'skip' && offset === 0) {
      // Today is still in progress and should not break yesterday's streak.
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
