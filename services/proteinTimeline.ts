import type { FoodEntry, MealCategory } from '../types';

export interface ProteinTimelineDay {
  key: string;
  date: Date;
  protein: number;
  entries: FoodEntry[];
  meals: Record<MealCategory, number>;
}
const dayKey = (date: Date) => `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
export function foodCalendarDate(value: string): Date | null {
  const local = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!local && !iso) return null;
  const day = Number(local ? local[1] : iso![3]);
  const month = Number(local ? local[2] : iso![2]);
  const year = Number(local ? local[3] : iso![1]);
  const date = new Date(year, month - 1, day, 12);
  return year >= 1970 && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}
/** Newest first: swiping left advances toward older dates, through every gap. */
export function buildProteinTimeline(food: FoodEntry[], now = new Date()): ProteinTimelineDay[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const buckets = new Map<string, FoodEntry[]>();
  let first = today;
  for (const entry of food) {
    const date = foodCalendarDate(entry.date);
    if (!date || date > today) continue;
    if (date < first) first = date;
    const key = dayKey(date);
    const rows = buckets.get(key) || []; rows.push(entry); buckets.set(key, rows);
  }
  const result: ProteinTimelineDay[] = [];
  for (const date = new Date(today); date >= first; date.setDate(date.getDate() - 1)) {
    const key = dayKey(date), entries = buckets.get(key) || [];
    const meals: Record<MealCategory, number> = { sarapan: 0, tengahari: 0, malam: 0, snek: 0 };
    for (const entry of entries) {
      const grams = (entry.items || []).reduce((sum, item) => sum + (Number.isFinite(item.protein) && item.protein > 0 ? item.protein : 0), 0);
      const category = Object.prototype.hasOwnProperty.call(meals, entry.category) ? entry.category : 'snek';
      meals[category] += grams;
    }
    const protein = Math.round(Object.values(meals).reduce((sum, grams) => sum + grams, 0) * 10) / 10;
    result.push({ key, date: new Date(date), protein, entries, meals });
  }
  return result;
}
