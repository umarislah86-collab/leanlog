import type { FoodEntry } from '../types';

// Keep the original estimate so repeated edits never compound rounding errors.
export function applyFoodPortion(entry: FoodEntry, portion: number): FoodEntry {
  if (!Number.isFinite(portion) || portion <= 0) throw new Error('Invalid portion');
  const base = entry.portionBase ?? { calories: entry.calories, items: entry.items };
  return {
    ...entry,
    portion,
    portionBase: base,
    calories: Math.round(base.calories * portion),
    items: base.items.map(item => ({
      ...item,
      kalori: Math.round(item.kalori * portion),
      protein: (item.protein || 0) * portion,
      karbohidrat: (item.karbohidrat || 0) * portion,
      lemak: (item.lemak || 0) * portion,
    })),
  };
}
